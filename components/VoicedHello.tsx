"use client";

// The relaxed voiced first run (behind VOICED_HELLO_ENABLED). A full-screen overlay
// over the home. On open it plays the load video (the stem resolving into the orb), then
// hands off to the living <RingOrb>, which guides setup: name -> intention -> time ->
// soundscape -> voice -> review -> begin. The orb floats up once for the settings and is
// handed back to centre by the app's compose screen; it reacts only to the APP's own
// voice (via voiceLevel), never the mic.
//
// This component owns the flow UI and works entirely by tap/type (the guaranteed
// fallback). The ElevenLabs guided agent, when configured, drives the SAME handlers
// (pick*) through the integration layer, so voice and tap stay in lock-step. three.js
// loads only with this component, which the page imports lazily (ssr:false).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RingOrb from "@/components/RingOrb";
import { CONTEXTS, type ContextId, type VoiceChoice, INFINITE } from "@/lib/contexts";
import { SOUNDSCAPES, SOUND_CATS } from "@/lib/audio/soundscapes";
import type { Soundscape, SoundCat, Accent } from "@/lib/audio/types";
import { PREMIUM_VOICES_FEMALE, PREMIUM_VOICES_MALE } from "@/lib/premiumVoices";
import GUIDES from "@/lib/voices.json";
import {
  agentConfigured,
  startVoiceAgent,
  type AgentTools,
  type VoiceAgentController,
} from "@/lib/voiceAgent";

type Step =
  | "load"
  | "intro"
  | "name"
  | "nameHeard"
  | "intention"
  | "time"
  | "soundscape"
  | "voice"
  | "review"
  | "returning";

export interface LastSessionLite {
  label: string; // e.g. "Sleep"
  sub: string; // e.g. "10 min · Rain"
}

export interface VoicedHelloProps {
  /** Returning user (has a stored name + a last session): open on the welcome-back step. */
  isReturning?: boolean;
  knownName?: string;
  lastSession?: LastSessionLite | null;
  /** True when there are no premium locks for this user (entitled or no IAP available). */
  hasPremium?: boolean;
  reduced?: boolean;
  /** The app's own voice output level, 0..1 (engine.voiceLevel), for the orb. */
  voiceLevel: () => number;
  /** Speak a line through the app's TTS (drives the orb). Optional (silent if absent). */
  speak?: (text: string) => Promise<void> | void;
  /** Called on "tap to begin" ONLY on the no-agent (app-TTS) path: unlock the audio engine so
   *  the orb can sound. On the agent path we deliberately never touch the engine during
   *  onboarding, so the iOS audio session stays clean for the agent's mic. */
  onUnlockAudio?: () => void;
  /** Mark the voiced welcome as seen (so it doesn't replay), without touching audio. Called on
   *  the begin gesture regardless of path. */
  onMarkSeen?: () => void;
  // Live setters: called as each choice is made so the app's state stays in sync.
  onPickName: (name: string) => void;
  onPickContext: (id: ContextId, customPhrase?: string) => void;
  onPickDuration: (minutes: number, openEnded: boolean) => void;
  onPickSoundscape: (id: Soundscape) => void;
  onPickVoice: (voice: VoiceChoice, accent: Accent) => void;
  /** Audition a soundscape bed / a voice clip while the user is choosing (tap to hear). */
  onPreviewSoundscape?: (id: Soundscape) => void;
  onPreviewVoice?: (voice: VoiceChoice, accent: Accent) => void;
  /** Stop any audition in progress. */
  onStopPreview?: () => void;
  /** Confirm at review: begin composing (the app reads the now-synced state). */
  onBegin: () => void;
  /** Returning: repeat the last session as-is. */
  onRepeatLast?: () => void;
  /** Open the history/recent list (returning). */
  onHistory?: () => void;
  /** Leave the voiced flow and fall back to the classic home. */
  onExit: () => void;
}

const LockIcon = () => (
  <svg className="vh-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
const PencilIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
    <path d="M14.5 5.5l4 4M4 20l1-4L16 5a2 2 0 0 1 3 3L8 19l-4 1z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const KeyboardIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
    <rect x="3" y="7" width="18" height="11" rx="2" />
    <path d="M7 11h.01M11 11h.01M15 11h.01M8 15h8" strokeLinecap="round" />
  </svg>
);

// Intentions offered in the voice flow (maps to ContextId). "something else" -> custom.
const INTENTS: { id: ContextId; label: string }[] = [
  { id: "sleep", label: "sleep" },
  { id: "flow", label: "flow" },
  { id: "relax", label: "relax" },
  { id: "stress-relief", label: "breathe" },
  { id: "meditation", label: "meditate" },
];
const TIME_STOPS: number[] = [5, 10, 15, 20, 30];

// The opening line. With the agent, it is the agent's first message (spoken by the agent over
// the stem->orb animation); without an agent it is spoken by app TTS and the tap/type flow runs.
const GREETING =
  "Welcome to relaxed. We'll make a guided journey, just for you. First, what should we call you?";
const GREETING_RETURN = "Let's make something new. What do you need right now?";

// Free voices keyed by the app's voice+accent; premium by id.
type VoiceOpt = { key: string; label: string; voice: VoiceChoice; accent: Accent; premium: boolean };
const G = GUIDES as Record<string, { name: string; blurb: string }>;
const FREE_FEMALE: VoiceOpt[] = [
  { key: "female-us", label: G["female-us"].name, voice: "female", accent: "us", premium: false },
  { key: "female-uk", label: G["female-uk"].name, voice: "female", accent: "uk", premium: false },
];
const FREE_MALE: VoiceOpt[] = [
  { key: "male-us", label: G["male-us"].name, voice: "male", accent: "us", premium: false },
  { key: "male-uk", label: G["male-uk"].name, voice: "male", accent: "uk", premium: false },
];
const PREM_FEMALE: VoiceOpt[] = PREMIUM_VOICES_FEMALE.map((v) => ({
  key: v.id, label: v.name, voice: v.id as VoiceChoice, accent: "us", premium: true,
}));
const PREM_MALE: VoiceOpt[] = PREMIUM_VOICES_MALE.map((v) => ({
  key: v.id, label: v.name, voice: v.id as VoiceChoice, accent: "us", premium: true,
}));

export default function VoicedHello({
  isReturning = false,
  knownName = "",
  lastSession = null,
  hasPremium = false,
  reduced,
  voiceLevel,
  speak,
  onUnlockAudio,
  onMarkSeen,
  onPickName,
  onPickContext,
  onPickDuration,
  onPickSoundscape,
  onPickVoice,
  onPreviewSoundscape,
  onPreviewVoice,
  onStopPreview,
  onBegin,
  onRepeatLast,
  onHistory,
  onExit,
}: VoicedHelloProps) {
  // Everyone starts on the load screen (the static stem + "tap to begin"). That tap is
  // the audio-unlock gesture, and it visually continues the native splash.
  const [step, setStep] = useState<Step>("load");
  const [introDone, setIntroDone] = useState(false);
  // The orb first appears exactly where the video left it (centred), then gently drifts up
  // as it starts to speak. `drifted` flips a beat after the conversation opens, so the rise
  // is a smooth motion rather than an instant jump at the hand-off.
  const [drifted, setDrifted] = useState(false);
  // Load screen has two phases: "mic" (first run: voice-first explainer + mic permission)
  // then "begin" (tap to begin). `loadReady` gates the bottom copy until we've checked
  // whether mic was already asked, so only the "r" shows until then (no flash).
  const [loadPhase, setLoadPhase] = useState<"mic" | "begin">("begin");
  const [loadReady, setLoadReady] = useState(false);

  // Diagnostics (hidden unless the page is opened with ?vhdebug=1). A live readout of the
  // mic result + agent connection state + listening/speaking mode, so a single run tells us
  // exactly where the voice path stops, instead of inferring from "it can't hear me".
  const [dbg] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("vhdebug") === "1";
    } catch {
      return false;
    }
  });
  const [micResult, setMicResult] = useState("?");
  const [micFailed, setMicFailed] = useState(false);
  const [agentState, setAgentState] = useState("idle");
  const [agentErr, setAgentErr] = useState("");
  const [agentMode, setAgentMode] = useState("");
  // Keep the video's frozen last frame under the orb briefly so the orb can cross-fade in
  // over it (no hard cut), then drop the video.
  const [videoGone, setVideoGone] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // The ElevenLabs guided agent (when configured). agentActive flips true once it is
  // connected and driving; until then (and if it never connects) the tap/type + app-TTS
  // fallback runs. agentRef holds the controller for the orb's level + teardown.
  const agentRef = useRef<VoiceAgentController | null>(null);
  const agentActive = useRef(false);

  // Collected selections (local mirror for display; also pushed to the app via pick*).
  const [name, setName] = useState(knownName);
  const [context, setContext] = useState<ContextId | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [openEnded, setOpenEnded] = useState(false);
  const [soundscape, setSoundscape] = useState<Soundscape | null>(null);
  const [voiceLabel, setVoiceLabel] = useState<string>("");
  const [voiceSel, setVoiceSel] = useState<VoiceChoice | null>(null);
  const [remember, setRemember] = useState(true);

  // UI-only state
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [soundTab, setSoundTab] = useState<SoundCat>("nature");
  const [voiceTab, setVoiceTab] = useState<"her" | "him" | "none">("her");
  // The selected voice pill's key (free voices share a `voice` value across accents, so the
  // highlight + "continue" track the exact option by key).
  const [selVoiceKey, setSelVoiceKey] = useState<string>("");

  // Speak a line through the app TTS. The orb reacts on its own via voiceLevel, so this
  // just needs to fire the audio (best-effort; silent if no speak fn is wired). Once the
  // live agent is driving, IT does the talking, so app-TTS lines are suppressed.
  const say = useCallback(
    async (line: string) => {
      if (!speak || agentActive.current) return;
      try {
        await speak(line);
      } catch {
        /* best-effort */
      }
    },
    [speak],
  );

  // The orb's level: the agent's own output while it drives, else the app's TTS.
  const orbLevel = useCallback(() => {
    if (agentActive.current && agentRef.current) return agentRef.current.getOutputLevel();
    return voiceLevel();
  }, [voiceLevel]);

  // Decide the load phase once (client): first run shows the mic explainer + permission;
  // after we've asked once, go straight to "tap to begin". Also prime the video so it is
  // decoded and ready to play instantly (no stutter) when they tap.
  useEffect(() => {
    let asked = false;
    let forced = false;
    try {
      asked = localStorage.getItem("relaxed.micasked.v1") === "1";
      forced = new URLSearchParams(window.location.search).get("voiced") === "1";
    } catch {
      /* ignore */
    }
    // Show the mic step on first run, or always when testing via an explicit ?voiced=1.
    setLoadPhase(agentConfigured() && (forced || !asked) ? "mic" : "begin");
    setLoadReady(true);
    // Prime the decoder with load() (not play()): buffer the video so play() on tap starts
    // promptly, WITHOUT the brief visible playback the old play()/pause() trick caused (it
    // showed a few frames of the animation through the mic modal before "tap to begin"). The
    // poster (the "r", = frame 0) covers any small start delay, so the hand-off stays seamless.
    const v = videoRef.current;
    if (v) {
      try {
        v.load();
      } catch {
        /* ignore */
      }
    }
  }, []);

  // First-run step 1: the voice-first explainer's "allow microphone". iOS only prompts for
  // getUserMedia from inside a gesture, so this button IS the gesture. Whether they allow
  // or deny, we move on to "tap to begin" (the flow still works by tap/type without mic).
  const requestMic = async () => {
    try {
      localStorage.setItem("relaxed.micasked.v1", "1");
    } catch {
      /* ignore */
    }
    // No mic API at all (rare): send them to the classic tap/type home.
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicResult("unsupported");
      onExit();
      return;
    }
    // This tap IS the kickoff (like the reference build's one-tap "start"). Request the mic in
    // the gesture; the system prompt's "Allow" doubles as "tap to begin": on grant we start the
    // voiced flow and connect the agent right here. Decline/blocked -> the classic text home,
    // so a mic-less visitor types everything instead of hearing a voice they can't answer.
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      mic.getTracks().forEach((t) => t.stop()); // permission secured; the agent opens its own
      setMicResult("granted");
      setMicFailed(false);
      // Unlock iOS audio OUTPUT in this gesture (a 1-sample silent play on a throwaway context,
      // closed right after). The agent connects later (when the orb establishes, not in a
      // gesture), so this is what lets her voice play then.
      try {
        const AC =
          (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) {
          const actx = new AC();
          const b = actx.createBuffer(1, 1, 22050);
          const s = actx.createBufferSource();
          s.buffer = b;
          s.connect(actx.destination);
          s.start(0);
          window.setTimeout(() => actx.close().catch(() => {}), 150);
        }
      } catch {
        /* ignore */
      }
      begin(); // grant = begin: play the intro; the agent connects when the orb establishes
    } catch (err) {
      const nm = (err as { name?: string } | null)?.name || "unknown";
      setMicResult("declined:" + nm);
      // Don't silently drop into the classic UI: a stuck permission or a transient iOS audio
      // hiccup also throws here, and auto-exiting hides why and offers no retry. Stay on the
      // card, show what happened, and let them try again or choose to type.
      setMicFailed(true);
    }
  };

  // "tap to begin". The agent is connected RIGHT HERE, inside the tap gesture, with no app
  // audio running (exactly how our working ElevenLabs build does it): on iOS getUserMedia must
  // run in a user gesture and with a clean audio session, otherwise it throws InvalidStateError.
  // The agent speaks the greeting (its first message) over the stem->orb video. Only the
  // no-agent fallback unlocks our engine (for app-TTS); the agent path never touches it here.
  const begin = () => {
    onMarkSeen?.();
    if (isReturning) {
      setStep("returning");
      return;
    }
    setStep("intro");
    // The agent is connected when the orb ESTABLISHES (see the intro effect), not here, so she
    // doesn't talk over the stem->orb video. We unlock audio output in this gesture (below, in
    // requestMic) so her voice still plays even though the connect happens after the video.
    if (!agentConfigured()) {
      onUnlockAudio?.(); // no agent: unlock the engine so the app-TTS greeting can play
    }
    const v = videoRef.current;
    if (v) {
      v.play?.().catch(() => {});
      window.setTimeout(() => setIntroDone(true), 8000); // safety: never hang on the video
    } else {
      setIntroDone(true);
    }
  };

  // The intro video is mounted across the load + intro steps (same element). Listen for its
  // end so we can hand off to the live orb.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const done = () => setIntroDone(true);
    v.addEventListener("ended", done);
    v.addEventListener("error", done);
    return () => {
      v.removeEventListener("ended", done);
      v.removeEventListener("error", done);
    };
  }, [step]);

  // When the video resolves into the orb, run the visual hand-off. The AGENT (already
  // connecting since the tap) greets via its first message, so there is no app audio here.
  // Only the no-agent fallback speaks the greeting with app TTS and drives the tap/type flow.
  useEffect(() => {
    if (step !== "intro" || !introDone) return;
    setStep("name");
    // Cross-fade: the orb fades in over the video's frozen last frame, then the video drops.
    const drop = window.setTimeout(() => setVideoGone(true), 900);
    // Let the orb settle where the video left it (centred) for a beat, then drift up.
    const rise = window.setTimeout(() => setDrifted(true), 1100);
    // Now that the orb has established, connect the agent (she greets here, over the orb, not
    // over the video). Audio output was unlocked in the tap, so her voice plays. No agent ->
    // app-TTS greeting + tap/type.
    if (agentConfigured()) {
      void startAgent();
    } else {
      void say(GREETING);
    }
    return () => {
      window.clearTimeout(drop);
      window.clearTimeout(rise);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, introDone]);

  // Returning: greet by name on the welcome-back step. Only on the no-agent path (app TTS); on
  // the agent path we keep the audio session clean so the agent's mic connects when the user
  // taps "something new" (the agent greets then). The welcome-back text is on screen regardless.
  useEffect(() => {
    if (step !== "returning" || agentConfigured()) return;
    void say(knownName ? `Welcome back, ${knownName}.` : "Welcome back.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Up only after the brief settle (drifted), and never on the welcome-back step.
  const orbUp = drifted && step !== "intro" && step !== "returning";
  // The orb is always in "speaking" mode: it brightens/warms to the app's own voice
  // (voiceLevel) whenever a line plays, and settles calm when silent (level ~0). It
  // never reacts to the mic.
  const orbMode = "speaking" as const;

  // ---- handlers (shared by tap and the voice agent) ----
  // `fromAgent` = the agent's own tool call (it already knows + is speaking), so we don't
  // echo back to it. A tap (fromAgent false) while the agent drives is reported to the
  // agent via notify() so it acknowledges and advances, keeping voice + UI in lock-step.
  const agentOn = () => agentActive.current;

  // Audition (preview) without committing: a tap plays the bed / voice clip and highlights the
  // choice; a "continue" button (or the agent's own tool) confirms + advances. While a preview
  // plays we mute the agent's mic so the audio doesn't feed its transcription; it auto-unmutes
  // after the clip (~7.5s) or when the user acts.
  const previewTimer = useRef<number | null>(null);
  const muteAgentForPreview = () => {
    agentRef.current?.setMicMuted(true);
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => {
      agentRef.current?.setMicMuted(false);
      previewTimer.current = null;
    }, 7500);
  };
  const endPreview = () => {
    if (previewTimer.current) {
      window.clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }
    onStopPreview?.();
    agentRef.current?.setMicMuted(false);
  };
  const auditionSoundscape = (s: Soundscape) => {
    setSoundscape(s);
    onPickSoundscape(s);
    muteAgentForPreview();
    onPreviewSoundscape?.(s);
  };
  const auditionVoice = (opt: VoiceOpt) => {
    setSelVoiceKey(opt.key);
    setVoiceSel(opt.voice);
    setVoiceLabel(opt.label);
    onPickVoice(opt.voice, opt.accent);
    muteAgentForPreview();
    onPreviewVoice?.(opt.voice, opt.accent);
  };

  const commitName = (n: string, fromAgent = false) => {
    const clean = n.trim();
    if (!clean) return;
    setName(clean);
    onPickName(clean);
    setTyping(false);
    setDraft("");
    if (agentOn()) {
      if (!fromAgent) agentRef.current?.notify(`My name is ${clean}.`);
      setStep("intention"); // the agent speaks the ack + the next question
    } else {
      setStep("nameHeard");
      void say(`Lovely to meet you, ${clean}.`).then(() => {
        setStep("intention");
        void say("So, what are you hoping for today? Maybe winding down, unwinding, a few minutes to breathe, or something else, just let me know.");
      });
    }
  };

  const commitIntention = (id: ContextId, phrase?: string, fromAgent = false) => {
    setContext(id);
    onPickContext(id, phrase);
    setTyping(false);
    setDraft("");
    setStep("time");
    if (agentOn()) {
      if (!fromAgent) {
        const label = INTENTS.find((i) => i.id === id)?.label ?? (phrase || "that");
        agentRef.current?.notify(`I'd like a ${label} session.`);
      }
    } else {
      void say("How much time do you have?");
    }
  };

  const commitDuration = (minutes: number, open: boolean, fromAgent = false) => {
    setDuration(minutes);
    setOpenEnded(open);
    onPickDuration(minutes, open);
    setTyping(false);
    setDraft("");
    setStep("soundscape");
    if (agentOn()) {
      if (!fromAgent) agentRef.current?.notify(open ? "Open-ended, please." : `${minutes} minutes.`);
    } else {
      void say("Now choose a soundscape for your session. Tap any one to hear it.");
    }
  };

  const commitSoundscape = (id: Soundscape, fromAgent = false) => {
    endPreview();
    setSoundscape(id);
    onPickSoundscape(id);
    setStep("voice");
    const label = SOUNDSCAPES.find((s) => s.id === id)?.label ?? id;
    if (agentOn()) {
      if (!fromAgent) agentRef.current?.notify(`I chose ${label} for the soundscape.`);
    } else {
      void say("Now choose a voice to guide your session, or no voice at all. Tap to hear each one.");
    }
  };

  const commitVoice = (opt: VoiceOpt | null, fromAgent = false) => {
    endPreview();
    if (!opt) {
      setVoiceSel("none");
      setVoiceLabel("");
      onPickVoice("none", "us");
    } else {
      setVoiceSel(opt.voice);
      setVoiceLabel(opt.label);
      onPickVoice(opt.voice, opt.accent);
    }
    setStep("review");
    if (agentOn()) {
      if (!fromAgent) agentRef.current?.notify(opt ? `I'd like ${opt.label}'s voice.` : "No voice, just the soundscape.");
    } else {
      void say("Here's your session.");
    }
  };

  // Map an agent set_voice({selection,name}) to a VoiceOpt and record it.
  const ALL_VOICE_OPTS: VoiceOpt[] = [...FREE_FEMALE, ...FREE_MALE, ...PREM_FEMALE, ...PREM_MALE];
  const commitVoiceFromAgent = (selection?: string, voiceName?: string) => {
    if (selection === "none") return commitVoice(null, true);
    if (voiceName) {
      const byName = ALL_VOICE_OPTS.find(
        (o) => o.key === voiceName || o.label.toLowerCase() === voiceName.toLowerCase(),
      );
      if (byName) return commitVoice(byName, true);
    }
    if (selection === "him") return commitVoice(FREE_MALE[0], true);
    return commitVoice(FREE_FEMALE[0], true); // default "her"
  };

  // Start the guided agent. Called INSIDE the begin/"something new" tap gesture with no app
  // audio running, so the mic opens cleanly on iOS. The agent speaks its dashboard first
  // message (the greeting) and then listens. If it can't connect (no agent, mic denied, error),
  // the
  // tap/type fallback stays in control. Its client tools call the same commit* handlers, so
  // voice and tap drive identical state.
  async function startAgent() {
    if (!agentConfigured() || agentRef.current) return;
    const tools: AgentTools = {
      set_name: ({ name: n }) => {
        if (n) commitName(n, true);
      },
      set_intention: ({ intention, phrase }) => {
        if (intention) commitIntention(intention as ContextId, phrase, true);
      },
      set_duration: ({ minutes, open_ended }) =>
        commitDuration(open_ended ? INFINITE : minutes ?? 10, !!open_ended, true),
      set_soundscape: ({ soundscape: s }) => {
        if (s) commitSoundscape(s as Soundscape, true);
      },
      set_voice: ({ selection, name: vn }) => commitVoiceFromAgent(selection, vn),
      begin_session: () => onBegin(),
    };
    setAgentState("connecting");
    const ctrl = await startVoiceAgent({
      tools,
      dynamicVariables: {
        user_name: knownName,
        is_returning: isReturning ? "true" : "false",
        has_premium: hasPremium ? "true" : "false",
        last_session_summary: lastSession ? `${lastSession.label}, ${lastSession.sub}` : "",
      },
      onConnect: () => {
        agentActive.current = true;
        setAgentState("connected");
      },
      onDisconnect: (info) => {
        agentActive.current = false;
        setAgentState("ended");
        const why = info
          ? [info.reason, info.closeReason || info.message, info.closeCode]
              .filter((x) => x !== undefined && x !== "")
              .join(" ")
          : "";
        if (why) setAgentErr(why);
      },
      onError: (e) => {
        agentActive.current = false;
        setAgentState("error");
        setAgentErr(String((e as { message?: string } | null)?.message ?? e ?? ""));
      },
      onModeChange: (m) => setAgentMode(m),
    });
    agentRef.current = ctrl;
    // startVoiceAgent returns null when it couldn't get a controller (no agent, mic denied,
    // import/connect failure). onError above already carries the reason when there was one.
    if (!ctrl) setAgentState((s) => (s === "error" ? s : "no-controller"));
  }

  // End the agent (and release the mic) when the overlay goes away.
  useEffect(() => {
    return () => {
      if (previewTimer.current) window.clearTimeout(previewTimer.current);
      void agentRef.current?.stop();
      agentRef.current = null;
      agentActive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Labels for the review sentence.
  const ctxLabel = useMemo(
    () => (context ? CONTEXTS.find((c) => c.id === context)?.label ?? context : ""),
    [context],
  );
  const soundName = useMemo(
    () => (soundscape ? SOUNDSCAPES.find((s) => s.id === soundscape)?.label ?? soundscape : ""),
    [soundscape],
  );
  const durLabel = openEnded ? "open-ended" : duration ? `${duration}-minute` : "";

  // ---- render helpers ----
  const soundsFor = (cat: SoundCat) => SOUNDSCAPES.filter((s) => s.cat === cat);

  const voiceOptsFor = (tab: "her" | "him" | "none"): VoiceOpt[] =>
    tab === "her" ? [...FREE_FEMALE, ...PREM_FEMALE] : tab === "him" ? [...FREE_MALE, ...PREM_MALE] : [];

  return (
    <div className="vh" role="dialog" aria-label="Welcome to relaxed">
      {dbg && (
        <div className="vh-dbg" aria-hidden="true">
          build:nov17-c · mic:{micResult} · agent:{agentState}
          {agentErr ? ` (${agentErr})` : ""} · mode:{agentMode || "-"}
        </div>
      )}
      {/* The intro video is one element across load -> intro -> (briefly) the orb cross-fade.
          On load it shows its own first frame (poster = the glossy stem), so the "r" you tap
          is literally frame one of the animation, no element swap, no black blink. It stays
          as a frozen last frame under the orb while the orb fades in, then drops. */}
      {!videoGone && (
        <video
          ref={videoRef}
          className={`vh-video${step !== "load" && step !== "intro" ? " fading" : ""}`}
          src="/orb/intro.mp4"
          poster="/orb/intro-first.jpg"
          muted
          playsInline
          preload="auto"
        />
      )}

      {/* LOAD: first run shows the voice-first explainer + mic permission, then "tap to
          begin"; after we've asked once, straight to "tap to begin". The "r" (video poster)
          is the backdrop. */}
      {step === "load" && loadReady && loadPhase === "mic" && (
        <div className="vh-load vh-load-modal">
          <div className="vh-miccard">
            {!micFailed ? (
              <>
                <div className="vh-micwhy">
                  relaxed is a voice-first experience. allow the microphone to set up your session
                  just by talking.
                </div>
                <button className="vh-begin" onClick={requestMic}>allow microphone</button>
                <button className="vh-type" onClick={onExit}>maybe later</button>
              </>
            ) : (
              <>
                <div className="vh-micwhy">
                  the microphone didn&rsquo;t start. if you meant to allow it, make sure it&rsquo;s
                  on for relaxed.app in your browser settings, then try again. or set up by typing.
                </div>
                <div className="vh-micerr">{micResult}</div>
                <button className="vh-begin" onClick={requestMic}>try again</button>
                <button className="vh-type" onClick={onExit}>type instead</button>
              </>
            )}
          </div>
        </div>
      )}
      {step === "load" && loadReady && loadPhase === "begin" && (
        <button className="vh-load vh-load-tap" onClick={begin} aria-label="Tap to begin">
          <span className="vh-tap">tap to begin</span>
        </button>
      )}

      {step !== "load" && step !== "intro" && (
        <div
          className={`vh-orb vh-orb-in${orbUp ? " up" : ""}${
            step === "soundscape" || step === "voice" ? " pick" : ""
          }`}
        >
          <RingOrb mode={orbMode} levelSource={orbLevel} reduced={reduced} running />
        </div>
      )}

      {/* NAME */}
      {step === "name" && (
        <div className="vh-zone">
          <div className="vh-mid">
            <div className="vh-ask">what should we call you?</div>
            {typing && (
              <input
                className="vh-input"
                autoFocus
                value={draft}
                placeholder="your name"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitName(draft);
                }}
                aria-label="your name"
              />
            )}
          </div>
          <div className="vh-foot">
            {typing ? (
              <button className="vh-begin" onClick={() => commitName(draft)}>continue</button>
            ) : (
              <button className="vh-type" onClick={() => setTyping(true)}>
                <KeyboardIcon /> type instead
              </button>
            )}
          </div>
        </div>
      )}

      {/* NAME HEARD */}
      {step === "nameHeard" && (
        <div className="vh-zone">
          <div className="vh-mid">
            <div className="vh-name">
              nice to meet you, <b>{name}</b>
              <button className="vh-type" aria-label="edit name" onClick={() => { setTyping(true); setStep("name"); }}>
                <PencilIcon />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INTENTION */}
      {step === "intention" && (
        <div className="vh-zone">
          <div className="vh-mid">
            <div className="vh-ask">what do you need right now?</div>
            {typing ? (
              <input
                className="vh-input"
                autoFocus
                value={draft}
                placeholder="in your own words"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && draft.trim()) commitIntention("custom", draft.trim());
                }}
                aria-label="what you need"
              />
            ) : (
              <div className="vh-hints">
                {INTENTS.map((it, i) => (
                  <span key={it.id} style={{ display: "contents" }}>
                    {i > 0 && <span className="vh-dot">·</span>}
                    <button className="vh-hintb" onClick={() => commitIntention(it.id)}>{it.label}</button>
                  </span>
                ))}
                <span className="vh-dot">·</span>
                <button className="vh-hintb" onClick={() => setTyping(true)}>something else</button>
              </div>
            )}
          </div>
          <div className="vh-foot">
            {typing && <button className="vh-begin" onClick={() => draft.trim() && commitIntention("custom", draft.trim())}>continue</button>}
          </div>
        </div>
      )}

      {/* TIME */}
      {step === "time" && (
        <div className="vh-zone">
          <div className="vh-mid">
            <div className="vh-ask">how much time do you have?</div>
            <div className="vh-hints">
              {TIME_STOPS.map((m, i) => (
                <span key={m} style={{ display: "contents" }}>
                  {i > 0 && <span className="vh-dot">·</span>}
                  <button className="vh-hintb" onClick={() => commitDuration(m, false)}>{m}</button>
                </span>
              ))}
              <span className="vh-dot">·</span>
              <button
                className="vh-hintb"
                onClick={() => commitDuration(INFINITE, true)}
                aria-label="open-ended (premium)"
              >
                open-ended {!hasPremium && <LockIcon />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOUNDSCAPE (required) */}
      {step === "soundscape" && (
        <div className="vh-zone picker">
          <div className="vh-mid">
            <div className="vh-title">choose a soundscape</div>
            <div className="vh-tabs">
              {SOUND_CATS.map((c) => (
                <button key={c.id} className={`vh-tab${soundTab === c.id ? " on" : ""}`} onClick={() => setSoundTab(c.id)}>
                  {c.label.toLowerCase()}
                </button>
              ))}
            </div>
            <div className="vh-pills">
              {soundsFor(soundTab).map((s) => {
                const locked = s.tier === "premium" && !hasPremium;
                return (
                  <button
                    key={s.id}
                    className={`vh-pill${soundscape === s.id ? " sel" : ""}${locked ? " locked" : ""}`}
                    onClick={() => auditionSoundscape(s.id)}
                  >
                    {s.label.toLowerCase()} {locked && <LockIcon />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="vh-foot">
            {soundscape && (
              <button className="vh-begin" onClick={() => commitSoundscape(soundscape)}>continue</button>
            )}
          </div>
        </div>
      )}

      {/* VOICE (optional, last) */}
      {step === "voice" && (
        <div className="vh-zone picker">
          <div className="vh-mid">
            <div className="vh-title">choose a voice</div>
            <div className="vh-tabs">
              {(["her", "him", "none"] as const).map((t) => (
                <button key={t} className={`vh-tab${voiceTab === t ? " on" : ""}`} onClick={() => setVoiceTab(t)}>{t}</button>
              ))}
            </div>
            {voiceTab === "none" ? (
              <button className="vh-begin" onClick={() => commitVoice(null)}>just the soundscape</button>
            ) : (
              <div className="vh-pills">
                {voiceOptsFor(voiceTab).map((o) => {
                  const locked = o.premium && !hasPremium;
                  return (
                    <button
                      key={o.key}
                      className={`vh-pill${selVoiceKey === o.key ? " sel" : ""}${locked ? " locked" : ""}`}
                      onClick={() => auditionVoice(o)}
                    >
                      {o.label.toLowerCase()} {locked && <LockIcon />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="vh-foot">
            {voiceTab !== "none" && selVoiceKey && (
              <button className="vh-begin" onClick={() => {
                const opt = ALL_VOICE_OPTS.find((o) => o.key === selVoiceKey);
                if (opt) commitVoice(opt);
              }}>continue</button>
            )}
          </div>
        </div>
      )}

      {/* REVIEW */}
      {step === "review" && (
        <div className="vh-zone">
          <div className="vh-mid" style={{ gap: 12 }}>
            <div className="vh-lead">ready{name ? `, ${name}` : ""}?</div>
            <div className="vh-review">
              a <button className="vh-ed" onClick={() => setStep("time")}>{durLabel}</button>{" "}
              <button className="vh-ed" onClick={() => setStep("intention")}>{ctxLabel.toLowerCase()}</button> session with{" "}
              <button className="vh-ed" onClick={() => setStep("soundscape")}>{soundName.toLowerCase()}</button>
              {voiceSel && voiceSel !== "none" ? (
                <>
                  , guided by <button className="vh-ed" onClick={() => setStep("voice")}>{voiceLabel.toLowerCase()}</button>
                </>
              ) : (
                <>
                  , <button className="vh-ed" onClick={() => setStep("voice")}>no voice</button>
                </>
              )}
            </div>
          </div>
          <div className="vh-foot">
            <div className="vh-remember">
              <span>remember me on this device</span>
              <button className={`vh-toggle${remember ? " on" : ""}`} aria-pressed={remember} aria-label="remember me" onClick={() => setRemember((v) => !v)} />
            </div>
            <button className="vh-begin" onClick={onBegin}>begin session</button>
            <button className="vh-type" onClick={onExit}>not now</button>
          </div>
        </div>
      )}

      {/* RETURNING */}
      {step === "returning" && (
        <>
          {onHistory && (
            <button className="vh-hist" onClick={onHistory}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 2.6-6.3M3 4v3h3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              history
            </button>
          )}
          <div className="vh-top">
            <div className="vh-lead">welcome back{knownName ? `, ${knownName}` : ""}</div>
            {lastSession && <div className="vh-detail">{lastSession.label.toLowerCase()} · {lastSession.sub.toLowerCase()}</div>}
          </div>
          <div className="vh-bot">
            {onRepeatLast && lastSession && (
              <button className="vh-begin" onClick={onRepeatLast}>repeat last session</button>
            )}
            <button
              className="vh-ghost"
              onClick={() => {
                setStep("intention");
                if (agentConfigured()) {
                  void startAgent(); // connect in this gesture; agent greets (dashboard first message)
                } else {
                  onUnlockAudio?.();
                  void say(GREETING_RETURN);
                }
              }}
            >
              something new
            </button>
            <button className="vh-type" onClick={onExit}>not now</button>
          </div>
        </>
      )}
    </div>
  );
}
