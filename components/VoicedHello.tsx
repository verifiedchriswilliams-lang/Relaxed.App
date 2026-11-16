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
  /** Called on the "tap to begin" gesture: unlock the audio engine so the orb can sound
   *  (mobile/WKWebView block audio until a user gesture). */
  onUnlockAudio?: () => void;
  // Live setters: called as each choice is made so the app's state stays in sync.
  onPickName: (name: string) => void;
  onPickContext: (id: ContextId, customPhrase?: string) => void;
  onPickDuration: (minutes: number, openEnded: boolean) => void;
  onPickSoundscape: (id: Soundscape) => void;
  onPickVoice: (voice: VoiceChoice, accent: Accent) => void;
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
  onPickName,
  onPickContext,
  onPickDuration,
  onPickSoundscape,
  onPickVoice,
  onBegin,
  onRepeatLast,
  onHistory,
  onExit,
}: VoicedHelloProps) {
  // Everyone starts on the load screen (the static stem + "tap to begin"). That tap is
  // the audio-unlock gesture, and it visually continues the native splash.
  const [step, setStep] = useState<Step>("load");
  const [introDone, setIntroDone] = useState(false);
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

  // The "tap to begin" gesture: unlock audio (so the orb can sound), prime the mic, then
  // either play the stem->orb intro video (new) or go straight to welcome-back (returning).
  // iOS Safari only allows getUserMedia from inside a user gesture, so we request mic
  // permission HERE (on the tap), not later after the greeting, otherwise Safari blocks it
  // without even prompting. We drop the probe stream immediately; the agent opens its own
  // mic once permission is granted.
  const begin = () => {
    onUnlockAudio?.();
    if (agentConfigured()) {
      try {
        navigator.mediaDevices
          ?.getUserMedia?.({ audio: true })
          .then((s) => s.getTracks().forEach((t) => t.stop()))
          .catch(() => {});
      } catch {
        /* no mic API: the tap/type fallback still works */
      }
    }
    setStep(isReturning ? "returning" : "intro");
  };

  // Intro video (only while on the "intro" step) -> hand off to the orb.
  useEffect(() => {
    if (step !== "intro") return;
    const v = videoRef.current;
    if (!v) return;
    const done = () => setIntroDone(true);
    v.addEventListener("ended", done);
    v.addEventListener("error", done);
    const safety = window.setTimeout(done, 8000);
    v.play?.().catch(() => {});
    return () => {
      v.removeEventListener("ended", done);
      v.removeEventListener("error", done);
      window.clearTimeout(safety);
    };
  }, [step]);

  // Once the orb is live, greet and ask the first question (the name). Option A: play the
  // greeting (app TTS, mic off), then connect the agent so it listens for the name. If no
  // agent is configured, this is just the greeting and the tap/type flow takes over.
  useEffect(() => {
    if (step !== "intro" || !introDone) return;
    setStep("name");
    void (async () => {
      await say(
        "Welcome to relaxed. We'll make a guided journey, just for you. First, what should we call you?",
      );
      void startAgent();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, introDone]);

  // Returning: greet by name once we land on the welcome-back step (after the tap).
  useEffect(() => {
    if (step !== "returning") return;
    void say(knownName ? `Welcome back, ${knownName}.` : "Welcome back.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const orbUp = introDone && step !== "intro" && step !== "returning";
  // The orb is always in "speaking" mode: it brightens/warms to the app's own voice
  // (voiceLevel) whenever a line plays, and settles calm when silent (level ~0). It
  // never reacts to the mic.
  const orbMode = "speaking" as const;

  // ---- handlers (shared by tap and the voice agent) ----
  // `fromAgent` = the agent's own tool call (it already knows + is speaking), so we don't
  // echo back to it. A tap (fromAgent false) while the agent drives is reported to the
  // agent via notify() so it acknowledges and advances, keeping voice + UI in lock-step.
  const agentOn = () => agentActive.current;

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

  // Start the guided agent (Option A). The caller has already played the greeting; this
  // requests the mic and connects with an empty first message so the agent just listens.
  // If it can't connect (no agent configured, mic denied, error), the tap/type fallback
  // stays in control. The agent's client tools call the very same commit* handlers, so
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
      },
      onDisconnect: () => {
        agentActive.current = false;
      },
      onError: () => {
        agentActive.current = false;
      },
    });
    agentRef.current = ctrl;
  }

  // End the agent (and release the mic) when the overlay goes away.
  useEffect(() => {
    return () => {
      void agentRef.current?.stop();
      agentRef.current = null;
      agentActive.current = false;
    };
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
      {/* LOAD: the intro video's exact first frame (the glossy stem), so it is pixel-
          identical to where the video begins, no size jump, and continuous with the native
          splash. The tap unlocks audio + mic and kicks off the animation (or welcome-back). */}
      {step === "load" && (
        <button className="vh-load" onClick={begin} aria-label="Tap to begin">
          <img className="vh-loadimg" src="/orb/intro-first.jpg" alt="" aria-hidden="true" />
          <span className="vh-tap">tap to begin</span>
        </button>
      )}

      {step === "intro" && !introDone && (
        <video
          ref={videoRef}
          className="vh-video"
          src="/orb/intro.mp4"
          poster="/orb/intro-first.jpg"
          muted
          playsInline
          preload="auto"
        />
      )}

      {step !== "load" && step !== "intro" && (
        <div className={`vh-orb${orbUp ? " up" : ""}`}>
          <RingOrb mode={orbMode} levelSource={orbLevel} reduced={reduced} running />
        </div>
      )}

      {/* Persistent escape hatch: never trap anyone in the flow. Drops to the classic home.
          Hidden on the load screen (nothing to escape yet) and on the review/returning
          steps, which carry their own "not now". */}
      {step !== "load" &&
        step !== "intro" &&
        step !== "review" &&
        step !== "returning" && (
          <button className="vh-skip" onClick={onExit} aria-label="Skip setup">
            skip
          </button>
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
        <div className="vh-zone">
          <div className="vh-mid" style={{ justifyContent: "flex-start", gap: 10, paddingTop: 4 }}>
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
                    onClick={() => commitSoundscape(s.id)}
                  >
                    {s.label.toLowerCase()} {locked && <LockIcon />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VOICE (optional, last) */}
      {step === "voice" && (
        <div className="vh-zone">
          <div className="vh-mid" style={{ justifyContent: "flex-start", gap: 10, paddingTop: 4 }}>
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
                      className={`vh-pill${voiceSel === o.voice ? " sel" : ""}${locked ? " locked" : ""}`}
                      onClick={() => commitVoice(o)}
                    >
                      {o.label.toLowerCase()} {locked && <LockIcon />}
                    </button>
                  );
                })}
              </div>
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
                void (async () => {
                  await say("Let's make something new. What do you need right now?");
                  void startAgent();
                })();
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
