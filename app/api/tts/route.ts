import { NextRequest, NextResponse } from "next/server";
import {
  voiceConfig,
  synthesizeBytes,
  type Gender,
  type Accent,
} from "@/lib/tts";

// One line of voice, on demand. The Custom session calls this once per line and
// streams playback as each returns, so time-to-first-audio is a few seconds
// rather than waiting for the whole script. Returns the MP3 bytes directly.
export const runtime = "nodejs";
export const maxDuration = 60;

interface TtsBody {
  text?: string;
  voice?: "female" | "male";
  accent?: "us" | "uk";
}

export async function POST(req: NextRequest) {
  let body: TtsBody;
  try {
    body = (await req.json()) as TtsBody;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const text = (body.text || "").trim().slice(0, 600);
  if (!text) return NextResponse.json({ error: "No text" }, { status: 400 });

  const voice: Gender = body.voice === "male" ? "male" : "female";
  const accent: Accent = body.accent === "uk" ? "uk" : "us";

  const cfg = voiceConfig(voice, accent);
  if (!cfg) {
    // No ElevenLabs key configured; the client treats this line as silence.
    return NextResponse.json({ error: "Voice not configured" }, { status: 503 });
  }

  try {
    const bytes = await synthesizeBytes(text, cfg);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Synthesis failed" },
      { status: 502 }
    );
  }
}
