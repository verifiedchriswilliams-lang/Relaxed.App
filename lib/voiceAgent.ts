// The ElevenLabs guided-agent integration for the relaxed voiced first run.
//
// The agent (configured in the ElevenLabs dashboard, see docs/voice-agent-spec.md) runs
// the setup conversation and drives the UI by calling client tools, which we map to the
// app's own handlers. The orb reacts to the AGENT's output here (getOutputByteFrequency),
// exactly as it reacts to the app's own TTS elsewhere, never to the microphone.
//
// Mic timing: the caller starts this INSIDE the "tap to begin" gesture with no app audio
// running, so getUserMedia opens the mic in a clean iOS audio session (a running AudioContext,
// or a call outside a user gesture, makes it throw InvalidStateError). The agent speaks the
// greeting via its dashboard "First message" and then listens, so there is a single audio
// system (the SDK), the way our other working ElevenLabs build does it.
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
  /** Tell the agent something the user did on screen (e.g. tapped a soundscape), so it
   *  stays in sync with UI selections and can acknowledge + move on. */
  notify: (text: string) => void;
  /** Mute/unmute the agent's mic input. Used to stop on-screen previews (a voice clip, a
   *  soundscape bed) from feeding the agent's transcription while the user auditions. */
  setMicMuted: (muted: boolean) => void;
  /** End the conversation and release the mic. Safe to call more than once. */
  stop: () => Promise<void>;
}

export interface DisconnectInfo {
  reason?: string; // "error" | "agent" | "user"
  message?: string;
  closeCode?: number;
  closeReason?: string;
}

export interface StartVoiceAgentOptions {
  tools: AgentTools;
  dynamicVariables: AgentDynamicVars;
  onConnect?: () => void;
  onDisconnect?: (info?: DisconnectInfo) => void;
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
  } catch (e) {
    // Surface WHY (so the caller's diagnostics can tell a mic deny apart from a connect
    // failure) before falling back to the tap/type flow.
    opts.onError?.(new Error("mic:" + ((e as { name?: string } | null)?.name || "denied")));
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

  // Base session config shared by public and private agents. WebSocket (not WebRTC): this
  // is the connection our working iOS build uses, and it is the reliable path for the mic
  // on iOS Safari.
  const base: Record<string, unknown> = {
    connectionType: "websocket",
    clientTools,
    dynamicVariables: opts.dynamicVariables,
    // No client overrides: the agent's opening line comes from its dashboard "First message"
    // (overrides have to be explicitly enabled on the agent or the session is dropped right
    // after connect). The greeting is configured there.
    onConnect: () => opts.onConnect?.(),
    onDisconnect: (d: DisconnectInfo | undefined) =>
      opts.onDisconnect?.(
        d
          ? { reason: d.reason, message: d.message, closeCode: d.closeCode, closeReason: d.closeReason }
          : undefined,
      ),
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
        // getOutputVolume() is synchronous and works on both connection types (0..1, where
        // 0 is -100dB and 1 is -30dB). Scale so a speaking voice drives the orb well.
        const v = conv.getOutputVolume ? conv.getOutputVolume() : 0;
        return Math.min(1, (typeof v === "number" ? v : 0) * 2.2);
      } catch {
        return 0;
      }
    },
    notify: (text: string) => {
      if (stopped || !text) return;
      try {
        conv.sendUserMessage?.(text);
      } catch {
        /* non-fatal: the agent just won't hear about this tap */
      }
    },
    setMicMuted: (muted: boolean) => {
      if (stopped) return;
      try {
        conv.setMicMuted?.(muted);
      } catch {
        /* non-fatal */
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
