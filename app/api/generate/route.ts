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

async function writeScript(
  name: string,
  contextId: string,
  durationMin: number
): Promise<string> {
  const context = getContext(contextId);
  if (!context) throw new Error(`Unknown session type: ${contextId}`);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    // No Anthropic key → deterministic mock script so the flow still works.
    return MOCK_SCRIPT;
  }

  const client = new Anthropic({ apiKey: anthropicKey });
  const message = await client.messages.create({
    model: "claude-opus-5",
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
  const key = process.env.ELEVENLABS_API_KEY;
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

    const script = await writeScript(name, contextId, durationMin);
    const audio = await synthesizeVoice(script, voice);

    return NextResponse.json({
      script,
      audio, // data: URL, or null in mock mode
      mock: audio === null,
      durationMin,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
