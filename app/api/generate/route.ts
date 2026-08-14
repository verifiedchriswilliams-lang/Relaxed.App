import { NextRequest, NextResponse } from "next/server";
import {
  assembleSession,
  sessionTranscript,
  variantCount,
  type ResolvedLine,
} from "@/lib/sessions";
import { cacheKey, cacheUrl, isCached } from "@/lib/voiceCache";
import type { ContextId } from "@/lib/contexts";

// Node runtime so the ElevenLabs binary responses decode cleanly.
export const runtime = "nodejs";
// Only the name line(s) are synthesized per request now, so this is fast; the
// headroom is just insurance for a cold cache (first run before build-voice-cache).
export const maxDuration = 300;

interface GenerateBody {
  name?: string;
  context?: string;
  durationMin?: number;
  voice?: "female" | "male";
  accent?: "us" | "uk";
}

// How many live ElevenLabs calls to run at once (only for name lines and any
// not-yet-cached common lines). Tunable via env.
const TTS_CONCURRENCY = Math.min(
  6,
  Math.max(1, Number(process.env.TTS_CONCURRENCY ?? 4) || 4)
);

// Cached common lines are served as high-quality files (off the JSON payload),
// so they use full fidelity. Name lines are short and returned inline, so they
// use the same fidelity to match. Any not-yet-cached common line falls back to a
// compact inline format to keep the response under Vercel's ~4.5MB cap.
const CACHE_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";
const COMPACT_FORMAT = "mp3_22050_32";

// API keys pasted into a dashboard can pick up invisible characters (e.g. the
// U+2028 line separator), which break HTTP header encoding. Real keys are
// printable ASCII only, so strip anything outside that range.
function cleanKey(raw: string | undefined): string | undefined {
  const cleaned = raw?.replace(/[^\x21-\x7E]/g, "");
  return cleaned || undefined;
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
  const speed = clamp(Number(process.env.ELEVENLABS_SPEED ?? 1.0) || 1.0, 0.7, 1.2);
  const stability = clamp(
    Number(process.env.ELEVENLABS_STABILITY ?? 0.85) || 0.85,
    0,
    1
  );
  return { key, voiceId, speed, stability };
}

// Synthesize one line to an inline data: URL. Kept identical to the cache
// builder so a live-synthesized line matches its eventual cached version.
async function synthesizeInline(
  text: string,
  cfg: VoiceConfig,
  format: string
): Promise<string> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${cfg.voiceId}?output_format=${format}`,
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
  audio: string | null; // cached file URL, inline data: URL, or null
  pauseAfter: number; // seconds of real silence to hold after this line
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateBody;
    const name = (body.name || "").slice(0, 60);
    const contextId = (body.context || "meditation") as ContextId;
    const durationMin = Number(body.durationMin) || 5;
    const voice: Gender = body.voice === "male" ? "male" : "female";
    const accent: Accent = body.accent === "uk" ? "uk" : "us";
    const who = name.trim() || "friend";

    // Pick a variant to rotate for freshness (harmless when there is only one).
    const variant = Math.floor(Math.random() * variantCount(contextId));
    const lines: ResolvedLine[] = assembleSession(contextId, durationMin, variant);
    const transcript = sessionTranscript(lines, name);

    const cfg = voiceConfig(voice, accent);

    // No ElevenLabs key: preview mode. Return the read-along transcript and the
    // pauses so the soundscape + breathing visual still run the full length.
    if (!cfg) {
      return NextResponse.json({
        script: transcript,
        segments: lines.map((l) => ({ audio: null, pauseAfter: l.pause })),
        mock: true,
        note: "Preview mode. Add your ElevenLabs key to hear this spoken aloud.",
        durationMin,
      });
    }

    // Resolve each line to a segment. Cached common lines are just a URL (fast,
    // free). Name lines and any not-yet-cached common lines are synthesized live.
    const audios: (string | null)[] = new Array(lines.length).fill(null);
    const live: { i: number; text: string; format: string }[] = [];

    lines.forEach((l, i) => {
      if (l.name) {
        live.push({ i, text: l.text.replace(/\{name\}/g, who), format: CACHE_FORMAT });
        return;
      }
      const key = cacheKey(cfg.voiceId, l.text);
      if (isCached(key)) {
        audios[i] = cacheUrl(key); // served statically off the CDN
      } else {
        live.push({ i, text: l.text, format: COMPACT_FORMAT });
      }
    });

    // Synthesize the live lines with bounded concurrency.
    let next = 0;
    const worker = async () => {
      for (;;) {
        const k = next++;
        if (k >= live.length) return;
        const job = live[k];
        try {
          audios[job.i] = await synthesizeInline(job.text, cfg, job.format);
        } catch (err) {
          console.error("[generate] line synthesis failed:", err);
          audios[job.i] = null; // keep the pause, drop just this line's audio
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(TTS_CONCURRENCY, live.length || 1) }, worker)
    );

    const segments: OutSegment[] = lines.map((l, i) => ({
      audio: audios[i],
      pauseAfter: l.pause,
    }));
    const hasVoice = segments.some((s) => s.audio);

    // If nothing at all voiced (e.g. bad key / quota), fall back to read-along.
    const voiceFailed = !hasVoice;
    if (voiceFailed) {
      return NextResponse.json({
        script: transcript,
        segments: lines.map((l) => ({ audio: null, pauseAfter: l.pause })),
        mock: true,
        note: "The voice is unavailable right now, so here's your session to read along with.",
        durationMin,
      });
    }

    return NextResponse.json({
      script: transcript,
      segments,
      mock: false,
      durationMin,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
