import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  getContext,
  buildUserPrompt,
  SCRIPT_SYSTEM_PROMPT,
} from "@/lib/contexts";

// Keep this on the Node runtime so the ElevenLabs binary response streams cleanly.
export const runtime = "nodejs";
export const maxDuration = 60; // seconds — script + voice generation can take a while

interface GenerateBody {
  name?: string;
  context?: string;
  durationMin?: number;
  voice?: "female" | "male";
}

// A short, real sample script used only in mock mode (no ElevenLabs key set),
// so the app is fully explorable before you wire in the paid voice API.
const MOCK_SCRIPT =
  `Hello, and welcome. <break time="2s" /> Let's take this moment just for you. ` +
  `<break time="2.5s" /> Settle into a comfortable position, and when you're ready, ` +
  `let your eyes gently close. <break time="3s" /> Take a slow breath in... ` +
  `<break time="2s" /> and a long breath out. <break time="3s" /> ` +
  `There is nothing to do here but breathe. <break time="3s" /> ` +
  `(This is a preview — add your ElevenLabs key to hear it spoken aloud.)`;

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

async function synthesizeVoice(
  script: string,
  voice: "female" | "male"
): Promise<string | null> {
  const key = cleanKey(process.env.ELEVENLABS_API_KEY);
  if (!key) return null; // mock mode — client will show the script without audio

  const voiceId =
    voice === "male"
      ? process.env.ELEVENLABS_VOICE_MALE || "pNInz6obpgDQGcFmaJgB"
      : process.env.ELEVENLABS_VOICE_FEMALE || "21m00Tcm4TlvDq8ikWAM";

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateBody;
    const name = (body.name || "").slice(0, 60);
    const contextId = body.context || "meditation";
    const durationMin = Number(body.durationMin) || 5;
    const voice = body.voice === "male" ? "male" : "female";

    const hasVoiceKey = Boolean(cleanKey(process.env.ELEVENLABS_API_KEY));

    // Graceful degradation: a session should never dead-end on a red error.
    // If Claude can't write (no credit, outage, rate limit) we fall back to a
    // calm sample script; if ElevenLabs can't speak, we return the written
    // session to read along with. The soundscape + breathing visual always play.
    let script: string;
    let scriptFailed = false;
    try {
      script = await writeScript(name, contextId, durationMin);
    } catch (err) {
      console.error("[generate] script generation failed, using sample:", err);
      script = MOCK_SCRIPT;
      scriptFailed = true;
    }

    let audio: string | null = null;
    let voiceFailed = false;
    if (!scriptFailed) {
      try {
        audio = await synthesizeVoice(script, voice);
      } catch (err) {
        console.error("[generate] voice synthesis failed, read-along only:", err);
        voiceFailed = true;
      }
    }

    let note: string | undefined;
    if (scriptFailed) {
      note =
        "We couldn't compose a fresh session just now, so here's a sample one. Please try again in a moment.";
    } else if (voiceFailed) {
      note =
        "The voice is unavailable right now — here's your session to read along with.";
    } else if (audio === null && !hasVoiceKey) {
      note =
        "Preview mode — add your ElevenLabs key to hear this spoken aloud.";
    }

    return NextResponse.json({
      script,
      audio, // data: URL, or null when there is no spoken audio
      mock: audio === null,
      note,
      durationMin,
    });
  } catch (err) {
    // Only truly unexpected errors (e.g. malformed request) reach here.
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
