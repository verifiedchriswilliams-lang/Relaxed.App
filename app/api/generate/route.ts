import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  getContext,
  buildUserPrompt,
  SCRIPT_SYSTEM_PROMPT,
} from "@/lib/contexts";

// Node runtime so the ElevenLabs binary responses decode cleanly.
export const runtime = "nodejs";
// Long (20-30 min) sessions need headroom for the script + many voice segments.
// Capped to the plan's real limit by Vercel (Hobby 60s, Pro/Fluid up to 300s).
export const maxDuration = 300;

interface GenerateBody {
  name?: string;
  context?: string;
  durationMin?: number;
  voice?: "female" | "male";
  accent?: "us" | "uk";
}

// A short, real sample script used only in mock mode (no ElevenLabs key set),
// so the app is fully explorable before you wire in the paid voice API.
const MOCK_SCRIPT =
  `Hello, and welcome. <break time="2s" /> Let's take this moment just for you. ` +
  `<break time="2.5s" /> Settle into a comfortable position, and when you're ready, ` +
  `let your eyes gently close. <break time="3s" /> Take a slow breath in... ` +
  `<break time="2s" /> and a long breath out. <break time="3s" /> ` +
  `There is nothing to do here but breathe. <break time="3s" /> ` +
  `(This is a preview. Add your ElevenLabs key to hear it spoken aloud.)`;

// Cap on ElevenLabs calls per session, to stay within the function time budget.
const MAX_SEGMENTS = 20;

// Give every scripted pause a little more room so sessions breathe. This scales
// the silence the writer asked for (via break tags) without touching the words,
// lowering the share of the session that is spoken. Tunable via env.
const SILENCE_SCALE = Math.min(
  2,
  Math.max(1, Number(process.env.SILENCE_SCALE ?? 1.25) || 1.25)
);

// Voice audio is returned inline (base64) in the JSON response, which Vercel
// caps at ~4.5MB. At the default 128kbps a 20-30 min session's speech blows past
// that and the request fails. A compact 32kbps/22kHz mono MP3 is plenty for a
// calm spoken voice over a soundscape and keeps even long sessions well under
// the cap. Overridable via env if we later move audio out of the JSON payload.
const OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_22050_32";

// How many ElevenLabs calls to run at once. Long sessions have many segments;
// doing them sequentially overruns the function timeout, so fan them out.
const TTS_CONCURRENCY = Math.min(
  6,
  Math.max(1, Number(process.env.TTS_CONCURRENCY ?? 4) || 4)
);

// API keys pasted into a dashboard can pick up invisible characters (e.g. the
// U+2028 line separator), which break HTTP header encoding with a "cannot
// convert argument to a ByteString" error. Real keys are printable ASCII only,
// so strip anything outside that range and trim surrounding whitespace.
function cleanKey(raw: string | undefined): string | undefined {
  const cleaned = raw?.replace(/[^\x21-\x7E]/g, "");
  return cleaned || undefined;
}

async function writeScript(
  name: string,
  contextId: string,
  durationMin: number
): Promise<string> {
  const context = getContext(contextId);
  if (!context) throw new Error(`Unknown session type: ${contextId}`);

  const anthropicKey = cleanKey(process.env.ANTHROPIC_API_KEY);
  if (!anthropicKey) {
    // No Anthropic key → deterministic mock script so the flow still works.
    return MOCK_SCRIPT;
  }

  const client = new Anthropic({ apiKey: anthropicKey });
  // Model is env-configurable so cost/quality can be tuned without a code change.
  // Default is Opus 5 (best script quality); claude-sonnet-5 is a cheaper option.
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-5";
  const message = await client.messages.create({
    model,
    max_tokens: 4000,
    system: SCRIPT_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: buildUserPrompt({ name, context, durationMin }) },
    ],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return text || MOCK_SCRIPT;
}

// ---------------------------------------------------------------------------
// Pacing. ElevenLabs caps a rendered <break> at ~3s and renders long / stacked
// pauses unreliably, so a whole meditation baked into one clip bunches up and
// finishes far too early. Instead we split the script at its <break> tags into
// speakable segments plus the pause (seconds) that should follow each, voice
// each segment separately, and let the CLIENT place the real silences on its
// own clock. That spreads the guidance across the full session duration.
// ---------------------------------------------------------------------------
interface Segment {
  text: string;
  pauseAfter: number;
}

function splitIntoSegments(script: string): Segment[] {
  const tokens = script.split(/(<break\s+time="[\d.]+s"\s*\/?>)/gi);
  const segs: Segment[] = [];
  let cur = "";
  for (const tok of tokens) {
    const m = tok.match(/^<break\s+time="([\d.]+)s"\s*\/?>$/i);
    if (m) {
      const pause = parseFloat(m[1]) || 0;
      if (cur.trim()) {
        segs.push({ text: cur.trim(), pauseAfter: pause });
        cur = "";
      } else if (segs.length) {
        // Consecutive break tags (a long stacked silence) merge into one pause.
        segs[segs.length - 1].pauseAfter += pause;
      }
      // A break before any speech is dropped (no awkward opening silence).
    } else {
      cur += tok;
    }
  }
  if (cur.trim()) segs.push({ text: cur.trim(), pauseAfter: 0 });
  return segs;
}

// Keep the number of TTS calls bounded by merging the shortest adjacent pairs.
function mergeToMax(segs: Segment[], max: number): Segment[] {
  const out = segs.map((s) => ({ ...s }));
  while (out.length > max) {
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < out.length - 1; i++) {
      const len = out[i].text.length + out[i + 1].text.length;
      if (len < best) {
        best = len;
        idx = i;
      }
    }
    out.splice(idx, 2, {
      text: `${out[idx].text} ${out[idx + 1].text}`,
      pauseAfter: out[idx + 1].pauseAfter,
    });
  }
  return out;
}

interface VoiceConfig {
  key: string;
  voiceId: string;
  speed: number;
  stability: number;
}

type Gender = "female" | "male";
type Accent = "us" | "uk";

// Voice IDs per gender + accent. Each slot may be overridden by an env var;
// otherwise it uses the curated default. The UK slots also fall back to the
// legacy single-accent vars (ELEVENLABS_VOICE_FEMALE / _MALE) so older setups
// keep working. A real voice ID is a short token, never an "sk_" key.
const VOICE_TABLE: Record<string, { envs: string[]; def: string }> = {
  "female-uk": {
    envs: ["ELEVENLABS_VOICE_FEMALE_UK", "ELEVENLABS_VOICE_FEMALE"],
    def: "zA6D7RyKdc2EClouEMkP", // Almee
  },
  "male-uk": {
    envs: ["ELEVENLABS_VOICE_MALE_UK", "ELEVENLABS_VOICE_MALE"],
    def: "UmQN7jS1Ee8B1czsUtQh", // Theo
  },
  "female-us": {
    envs: ["ELEVENLABS_VOICE_FEMALE_US"],
    def: "7AvtJrjTNyBhBxEvNPIZ",
  },
  "male-us": {
    envs: ["ELEVENLABS_VOICE_MALE_US"],
    def: "6bPfTtSpgxgD0GeBVfqu",
  },
};

function isVoiceId(v: string | undefined): v is string {
  return !!v && !v.startsWith("sk_") && v.length <= 40;
}

function resolveVoiceId(gender: Gender, accent: Accent): string {
  const row = VOICE_TABLE[`${gender}-${accent}`] ?? VOICE_TABLE[`${gender}-uk`];
  for (const name of row.envs) {
    const v = cleanKey(process.env[name]);
    if (isVoiceId(v)) return v;
  }
  return row.def;
}

function voiceConfig(voice: Gender, accent: Accent): VoiceConfig | null {
  const key = cleanKey(process.env.ELEVENLABS_API_KEY);
  if (!key) return null;

  const voiceId = resolveVoiceId(voice, accent);

  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));
  const speed = clamp(
    Number(process.env.ELEVENLABS_SPEED ?? 1.0) || 1.0,
    0.7,
    1.2
  );
  const stability = clamp(
    Number(process.env.ELEVENLABS_STABILITY ?? 0.85) || 0.85,
    0,
    1
  );
  return { key, voiceId, speed, stability };
}

async function synthesizeSegment(
  text: string,
  cfg: VoiceConfig
): Promise<string> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${cfg.voiceId}?output_format=${OUTPUT_FORMAT}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": cfg.key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: cfg.stability,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
          speed: cfg.speed,
        },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs error ${res.status}: ${detail.slice(0, 300)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return `data:audio/mpeg;base64,${buf.toString("base64")}`;
}

interface OutSegment {
  audio: string | null; // data: URL, or null if this segment's voice failed
  pauseAfter: number; // seconds of real silence to hold after this segment
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateBody;
    const name = (body.name || "").slice(0, 60);
    const contextId = body.context || "meditation";
    const durationMin = Number(body.durationMin) || 5;
    const voice = body.voice === "male" ? "male" : "female";
    const accent = body.accent === "uk" ? "uk" : "us";

    const cfg = voiceConfig(voice, accent);

    // Graceful degradation: a session should never dead-end on a red error. If
    // Claude can't write, fall back to a sample script; if ElevenLabs can't
    // speak, return the written session to read along with. The soundscape and
    // breathing visual always play.
    let script: string;
    let scriptFailed = false;
    try {
      script = await writeScript(name, contextId, durationMin);
    } catch (err) {
      console.error("[generate] script generation failed, using sample:", err);
      script = MOCK_SCRIPT;
      scriptFailed = true;
    }

    let segments: OutSegment[] = [];
    let voiceFailed = false;

    if (!scriptFailed && cfg) {
      const speak = mergeToMax(splitIntoSegments(script), MAX_SEGMENTS);
      // Synthesize segments with bounded concurrency so long sessions (many
      // segments) finish inside the function timeout. Order is preserved.
      const audios: (string | null)[] = new Array(speak.length).fill(null);
      let next = 0;
      const worker = async () => {
        for (;;) {
          const i = next++;
          if (i >= speak.length) return;
          try {
            audios[i] = await synthesizeSegment(speak[i].text, cfg);
          } catch (err) {
            console.error("[generate] segment synthesis failed:", err);
            audios[i] = null; // keep the pause, drop just this segment's audio
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(TTS_CONCURRENCY, speak.length) }, worker)
      );

      segments = speak.map((s, i) => ({
        audio: audios[i],
        pauseAfter: s.pauseAfter * SILENCE_SCALE,
      }));

      // If not a single segment came back, treat voice as unavailable and fall
      // back to read-along rather than playing silent gaps.
      if (!segments.some((s) => s.audio)) {
        voiceFailed = true;
        segments = [];
      }
    }

    const hasVoice = segments.some((s) => s.audio);

    let note: string | undefined;
    if (scriptFailed) {
      note =
        "We couldn't compose a fresh session just now, so here's a sample one. Please try again in a moment.";
    } else if (voiceFailed) {
      note =
        "The voice is unavailable right now, so here's your session to read along with.";
    } else if (!cfg) {
      note = "Preview mode. Add your ElevenLabs key to hear this spoken aloud.";
    }

    return NextResponse.json({
      script,
      segments, // [{ audio, pauseAfter }] scheduled with real silences by the client
      mock: !hasVoice,
      note,
      durationMin,
    });
  } catch (err) {
    // Only truly unexpected errors (e.g. malformed request) reach here.
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
