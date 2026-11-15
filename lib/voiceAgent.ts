// The ElevenLabs guided-agent integration for the relaxed voiced first run.
//
// The agent (configured in the ElevenLabs dashboard, see docs/voice-agent-spec.md) runs
// the setup conversation and drives the UI by calling client tools, which we map to the
// app's own handlers. The orb reacts to the AGENT's output here (getOutputByteFrequency),
// exactly as it reacts to the app's own TTS elsewhere, never to the microphone.
//
// Mic timing is Option A: the caller plays a pre-rendered greeting (mic off), then calls
// startVoiceAgent, which requests the mic and connects with the agent's first message
// overridden to empty so it simply listens for the spoken name.
//
// The SDK is dynamically imported so it stays out of every bundle until a session is
// actually started. The whole path is dormant unless NEXT_PUBLIC_ELEVENLABS_AGENT_ID is
// set, so with no agent configured the app falls back to the tap/type flow.

export interface AgentTools {
  set_name: (p: { name?: string }) => void;
  set_intention: (p: { intention?: string; phrase?: string }) => void;
  set_duration: (p: { minutes?: number; open_ended?: boolean }) => void;
  set_soundscape: (p: { soundscape?: string }) => void;
  set_voice: (p: { selection?: string; name?: string }) => void;
  begin_session: () => void;
}

// Injected into the agent's prompt at connect (all strings, per the SDK).
export interface AgentDynamicVars {
  user_name: string;
  is_returning: string; // "true" | "false"
  has_premium: string; // "true" | "false"
  last_session_summary: string;
}

export interface VoiceAgentController {
  /** 0..1 level of the agent's own voice this frame, for the orb (0 when silent). */
  getOutputLevel: () => number;
  /** End the conversation and release the mic. Safe to call more than once. */
  stop: () => Promise<void>;
}

export interface StartVoiceAgentOptions {
  tools: AgentTools;
  dynamicVariables: AgentDynamicVars;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (err: unknown) => void;
  /** "speaking" = agent talking, "listening" = waiting for the user. */
  onModeChange?: (mode: "speaking" | "listening") => void;
  /** For a private agent: an app route that returns { signedUrl } or { conversationToken }. */
  signedUrlEndpoint?: string;
}

// The configured guided-onboarding agent. Public ids are not secret (they ship in the
// browser bundle for any NEXT_PUBLIC_* value anyway), so a default is baked in for
// zero-config testing; an env var overrides it per environment.
const DEFAULT_AGENT_ID = "agent_4101m7ecnkfnfwmt2bpt1by316zs";

export function agentId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID?.trim() || DEFAULT_AGENT_ID;
  return id || undefined;
}

export function agentConfigured(): boolean {
  return !!agentId();
}

// Normalise the SDK's byte frequency data to the same 0..1 feel as engine.voiceLevel,
// so the orb behaves identically whether the voice is the app's TTS or the agent.
function levelFrom(data: Uint8Array | undefined | null): number {
  if (!data || data.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i] / 255;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / data.length) * 4);
}

export async function startVoiceAgent(
  opts: StartVoiceAgentOptions,
): Promise<VoiceAgentController | null> {
  const id = agentId();
  if (!id) return null;
  if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) return null;

  // Option A: request the mic now (right after the pre-rendered greeting). If the user
  // declines, there is no voice input, so fall back to the tap/type flow (return null).
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // We don't need the stream handle; the SDK opens its own. Release this probe.
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    return null;
  }

  let Conversation: typeof import("@elevenlabs/client").Conversation;
  try {
    ({ Conversation } = await import("@elevenlabs/client"));
  } catch (err) {
    opts.onError?.(err);
    return null;
  }

  // Wrap each app handler as an SDK client tool (async, returns a short ack).
  const t = opts.tools;
  const clientTools: Record<string, (params: Record<string, unknown>) => Promise<string>> = {
    set_name: async (p) => {
      t.set_name({ name: typeof p.name === "string" ? p.name : undefined });
      return "ok";
    },
    set_intention: async (p) => {
      t.set_intention({
        intention: typeof p.intention === "string" ? p.intention : undefined,
        phrase: typeof p.phrase === "string" ? p.phrase : undefined,
      });
      return "ok";
    },
    set_duration: async (p) => {
      t.set_duration({
        minutes: typeof p.minutes === "number" ? p.minutes : undefined,
        open_ended: p.open_ended === true,
      });
      return "ok";
    },
    set_soundscape: async (p) => {
      t.set_soundscape({ soundscape: typeof p.soundscape === "string" ? p.soundscape : undefined });
      return "ok";
    },
    set_voice: async (p) => {
      t.set_voice({
        selection: typeof p.selection === "string" ? p.selection : undefined,
        name: typeof p.name === "string" ? p.name : undefined,
      });
      return "ok";
    },
    begin_session: async () => {
      t.begin_session();
      return "ok";
    },
  };

  // Base session config shared by public and private agents.
  const base: Record<string, unknown> = {
    connectionType: "webrtc",
    clientTools,
    dynamicVariables: opts.dynamicVariables,
    // Option A: the pre-rendered clip already greeted + asked the name, so the live
    // agent opens silent and just listens.
    overrides: { agent: { firstMessage: "" } },
    onConnect: () => opts.onConnect?.(),
    onDisconnect: () => opts.onDisconnect?.(),
    onError: (e: unknown) => opts.onError?.(e),
    onModeChange: (ev: { mode?: string } | undefined) => {
      const m = ev?.mode === "speaking" ? "speaking" : "listening";
      opts.onModeChange?.(m);
    },
  };

  // Public agent connects by id; a private agent (NEXT_PUBLIC_ELEVENLABS_AGENT_PRIVATE=1,
  // with auth enabled on the agent) needs a short-lived token from our own server route
  // (never the API key in the client). An explicit endpoint overrides the default route.
  const endpoint =
    opts.signedUrlEndpoint ??
    (process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_PRIVATE === "1" ? "/api/eleven-token" : undefined);
  let auth: Record<string, unknown> = { agentId: id };
  if (endpoint) {
    try {
      const res = await fetch(endpoint);
      if (res.ok) {
        const j = (await res.json()) as { signedUrl?: string; conversationToken?: string };
        if (j.conversationToken) auth = { conversationToken: j.conversationToken };
        else if (j.signedUrl) auth = { signedUrl: j.signedUrl };
      }
    } catch (err) {
      opts.onError?.(err);
      return null;
    }
  }

  let conv: Awaited<ReturnType<typeof Conversation.startSession>>;
  try {
    // The SDK's option type is wider than our typed base; cast at the boundary.
    conv = await Conversation.startSession({ ...auth, ...base } as Parameters<
      typeof Conversation.startSession
    >[0]);
  } catch (err) {
    opts.onError?.(err);
    return null;
  }

  let stopped = false;
  return {
    getOutputLevel: () => {
      if (stopped) return 0;
      try {
        return levelFrom(conv.getOutputByteFrequencyData?.());
      } catch {
        return 0;
      }
    },
    stop: async () => {
      if (stopped) return;
      stopped = true;
      try {
        await conv.endSession();
      } catch {
        /* already gone */
      }
    },
  };
}
