import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rateLimit";

// Short-lived auth for a PRIVATE ElevenLabs onboarding agent (Security -> enable_auth).
// The browser never sees the API key: it calls this route, which mints a 15-minute
// WebRTC conversation token (preferred) or a signed WebSocket URL, server-side, using
// ELEVENLABS_API_KEY. lib/voiceAgent.ts fetches this only when the agent is marked
// private (NEXT_PUBLIC_ELEVENLABS_AGENT_PRIVATE=1); a public agent never hits it.
//
// Keep the agent public and this route stays dormant. Nothing here changes behavior
// until auth is turned on both on the agent and via that env flag.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AGENT_ID = "agent_4101m7ecnkfnfwmt2bpt1by316zs";

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req.headers, "eleven-token");
  if (limited) return limited;

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Voice agent not configured" }, { status: 503 });
  }

  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID?.trim() || AGENT_ID;
  const headers = { "xi-api-key": key };

  // Preferred: a WebRTC conversation token (the client connects with connectionType
  // "webrtc"). Fall back to a signed WebSocket URL if the token endpoint is unavailable.
  try {
    const tokenRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      { headers, cache: "no-store" },
    );
    if (tokenRes.ok) {
      const j = (await tokenRes.json()) as { token?: string };
      if (j.token) return NextResponse.json({ conversationToken: j.token });
    }

    const urlRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      { headers, cache: "no-store" },
    );
    if (urlRes.ok) {
      const j = (await urlRes.json()) as { signed_url?: string };
      if (j.signed_url) return NextResponse.json({ signedUrl: j.signed_url });
    }

    return NextResponse.json({ error: "Could not mint agent token" }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "Could not reach voice agent service" }, { status: 502 });
  }
}
