"use client";

import { useEffect, useRef, useState } from "react";
import {
  CONTEXTS,
  DURATIONS,
  getContext,
  CUSTOM_MAX_CHARS,
  CUSTOM_ENABLED,
  type ContextId,
  type Duration,
  type VoiceChoice,
} from "@/lib/contexts";
import { asset } from "@/lib/assets";
import { BRAND } from "@/lib/brand";
import { StemGlyph, OrbitGlyph } from "@/lib/mark";
import { SoundMotif } from "@/lib/soundMotifs";
import { haptic, setNowPlaying, setPlaybackState, clearNowPlaying, isNativeApp } from "@/lib/native";
import {
  loadRecent,
  loadFavs,
  pushRecent,
  toggleFav,
  isFav,
  removeRecent,
  removeFav,
  recordMood,
  recentHintSeen,
  markRecentHintSeen,
  arrivingSeenToday,
  markArrivingSeen,
  updateRecentScript,
  type RecentSession,
  type SavedLine,
} from "@/lib/history";
import { ev } from "@/lib/analytics";
import {
  loadReminder,
  saveReminder,
  syncReminder,
  type ReminderPref,
} from "@/lib/reminders";
import { audioProfile, type AudioProfile } from "@/lib/engine";
import type { Soundscape, SoundCat, Accent } from "@/lib/audio/types";
import {
  SOUND_CATS,
  SOUNDSCAPES,
  FIRST_TIME_SOUND,
  catOf,
  soundDef,
} from "@/lib/audio/soundscapes";
import { PREVIEW_GAIN, normGain, bedAndVoice, BED_SOLO } from "@/lib/audio/levels";
import { AudioEngine } from "@/lib/audio/engine";
import { timeAgo, greetingFor, mmss, transcriptLines } from "@/lib/format";
import { breathAt } from "@/lib/breath";

// Which visual world are we in? relaxed swaps the aurora + coloured discs for
// the flat, no-accent "stem" identity; ElevenMind keeps its night sky.
const IS_RELAXED = BRAND.id === "relaxed";
import GUIDES from "@/lib/voices.json";

// Wordmark: the bar glyph, then the brand name in two weights
// (ElevenMind => Eleven + Mind; relaxed.app => relaxed + .app).
function Wordmark() {
  return (
    <div className="wm" aria-label={BRAND.name}>
      {IS_RELAXED ? (
        // Cropped tight to the mark's own edges so it can sit on the text
        // baseline (see .wm rules) instead of floating in a square canvas.
        <svg className="wmark" viewBox="33 19 34 56" fill="none" aria-hidden="true">
          <path
            d="M40 74 V40 C40 30 49 26 60 26"
            stroke="currentColor"
            strokeWidth={13}
            strokeLinecap="butt"
          />
        </svg>
      ) : (
        <span className="bars" aria-hidden="true">
          <i />
          <i />
        </span>
      )}
      <span className="name">
        <b>{BRAND.strong}</b>
        <span>{BRAND.light}</span>
      </span>
    </div>
  );
}

// Terse, lowercase "how long ago" for a history row (e.g. "now", "20m", "3h",
// "2d", "1w"). Kept short so it never crowds the session line.
// The save/favorite star: a thin Bone outline when not saved, filled Bone when
// saved. Line-art in the stem language, currentColor so it inherits row colour.
function StarGlyph({ filled }: { filled: boolean }) {
  return (
    <svg
      width={19}
      height={19}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.7}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.4l2.63 5.33 5.88.86-4.25 4.15 1 5.86L12 17.7l-5.26 2.76 1-5.86-4.25-4.15 5.88-.86z" />
    </svg>
  );
}

// A history/saved row that swipes left to reveal a delete action (iOS-style):
// drag the card left, tap the revealed trash to remove; tap the card (or swipe
// back) to close. Horizontal drags are captured; vertical gestures are ignored
// so they don't fight scrolling. onDelete removes the underlying session.
const SWIPE_REVEAL = 76;
function SwipeRow({
  onDelete,
  children,
}: {
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [open, setOpen] = useState(false);
  const drag = useRef<{
    x: number;
    y: number;
    active: boolean;
    decided: boolean;
    horizontal: boolean;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, active: true, decided: false, horizontal: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !d.active) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.decided) {
      if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
      d.decided = true;
      d.horizontal = Math.abs(mx) > Math.abs(my);
      if (d.horizontal) {
        try {
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    }
    if (!d.horizontal) return;
    const base = open ? -SWIPE_REVEAL : 0;
    // clamp: no rightward past closed, a little rubber past the reveal.
    setDx(Math.max(-SWIPE_REVEAL - 16, Math.min(0, base + mx)));
  };
  const onPointerUp = () => {
    const d = drag.current;
    if (!d) return;
    d.active = false;
    if (!d.horizontal) return;
    const shouldOpen = dx < -SWIPE_REVEAL / 2;
    setOpen(shouldOpen);
    setDx(shouldOpen ? -SWIPE_REVEAL : 0);
  };
  const settle = drag.current?.active ? "none" : "transform 0.28s var(--ease-ui)";

  return (
    <div className="hs-swipe">
      <div className="hs-del" aria-hidden={!open}>
        <button
          className="hs-del-btn"
          onClick={onDelete}
          aria-label="Delete this session"
          tabIndex={open ? 0 : -1}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <div
        className="hs-card"
        style={{ transform: `translateX(${dx}px)`, transition: settle }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // When open, a tap anywhere on the card closes it instead of activating
        // the row underneath.
        onClickCapture={(e) => {
          if (open) {
            e.stopPropagation();
            setOpen(false);
            setDx(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}


interface Prefs {
  name: string;
  voice: VoiceChoice;
  accent: Accent;
  soundscape: Soundscape;
}
const PREFS_KEY = "elevenmind.prefs.v1";


// Minimum time to hold the "composing your session" screen. The cache makes a
// session ready almost instantly; this brief, deliberate pause makes it feel
// personally composed rather than pulled off a shelf.
const MIN_GENERATING_MS = 8500;

// A duration slider that only lands on the given stops.
function DurationSlider({
  stops,
  value,
  onChange,
}: {
  stops: readonly number[];
  value: number;
  onChange: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const idx = Math.max(0, stops.indexOf(value as Duration));
  const pct = (idx / (stops.length - 1)) * 100;

  function idxFromClientX(clientX: number) {
    const el = ref.current;
    if (!el) return idx;
    const r = el.getBoundingClientRect();
    const ratio = (clientX - r.left) / r.width;
    return Math.max(0, Math.min(stops.length - 1, Math.round(ratio * (stops.length - 1))));
  }
  function pick(clientX: number) {
    onChange(stops[idxFromClientX(clientX)]);
  }

  useEffect(() => {
    function move(e: MouseEvent | TouchEvent) {
      if (!dragging.current) return;
      const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
      onChange(stops[idxFromClientX(cx)]);
      if ("touches" in e) e.preventDefault();
    }
    function up() {
      dragging.current = false;
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops]);

  return (
    <>
      <div
        className="slider"
        ref={ref}
        onMouseDown={(e) => {
          dragging.current = true;
          pick(e.clientX);
        }}
        onTouchStart={(e) => {
          dragging.current = true;
          pick(e.touches[0].clientX);
        }}
      >
        <div className="track">
          <div className="fill" style={{ width: `${pct}%` }} />
          {stops.map((_, i) => (
            <div
              key={i}
              className="tick"
              style={{ left: `${(i / (stops.length - 1)) * 100}%` }}
            />
          ))}
        </div>
        <button
          type="button"
          className="thumb"
          style={{ left: `${pct}%` }}
          aria-label="Duration"
        />
      </div>
      <div className="ticklabels">
        {stops.map((m, i) => (
          <span key={m} className={i === idx ? "on" : ""}>
            {m}
          </span>
        ))}
      </div>
    </>
  );
}

type Screen = "setup" | "history" | "generating" | "player" | "complete";

// The one-tap post-session reflection. Warm, low-pressure, all positive-or-
// neutral so it never feels like a grade.
const MOODS = ["much calmer", "a little calmer", "about the same"] as const;

// "How are you arriving?" options, each gently steering toward a fitting
// intention. The last one is a graceful "I'm alright" that just closes.
const ARRIVING: { key: string; label: string; context: ContextId | null }[] = [
  { key: "tense", label: "tense", context: "relax" },
  { key: "tired", label: "tired", context: "sleep" },
  { key: "restless", label: "restless", context: "meditation" },
  { key: "good", label: "I'm good", context: null },
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [name, setName] = useState("");
  // Home header: the name is an editable part of the headline, never a standing
  // box. Cold start shows the "what should we call you?" field; once a name is
  // committed (or loaded from prefs) the header becomes the greeting with a
  // tap-to-edit name. `nameCommitted` flips only on commit, so the field doesn't
  // disappear mid-typing.
  const [nameCommitted, setNameCommitted] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [context, setContext] = useState<ContextId>("meditation");
  const [duration, setDuration] = useState<Duration>(10);
  const [voice, setVoice] = useState<VoiceChoice>("female");
  const [accent, setAccent] = useState<Accent>("us");
  // Whether the user has picked a voice this tray-open. Starts false so nothing
  // is highlighted on open — the first tap both selects and plays a preview,
  // instead of a silent pre-selection. `voice` keeps a valid value underneath
  // so Begin still works if they never touch it.
  const [voicePicked, setVoicePicked] = useState(false);
  // Same idea for the soundscape: nothing highlighted on open, so the first tap
  // selects and previews. `soundscape` keeps a valid default underneath.
  const [soundPicked, setSoundPicked] = useState(false);
  // Custom: the short phrase the user types for a fully bespoke session.
  const [customText, setCustomText] = useState("");
  const [soundscape, setSoundscape] = useState<Soundscape>("rain");
  const [soundTab, setSoundTab] = useState<SoundCat>("nature");
  const [saveDefault, setSaveDefault] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [script, setScript] = useState("");
  const [note, setNote] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showTranscript, setShowTranscript] = useState(true);
  const [genStep, setGenStep] = useState(0);
  const [activeLine, setActiveLine] = useState(-1);
  const [breathPhase, setBreathPhase] = useState<"in" | "hold" | "out">("in");
  // Recent sessions (on-device) for one-tap replay, and the post-session
  // feedback the user taps on the closing screen. No accounts, no network.
  const [recent, setRecent] = useState<RecentSession[]>([]);
  // Saved (favorited) sessions, kept indefinitely on-device — the escape hatch
  // from the rolling ten-deep recent window.
  const [favs, setFavs] = useState<RecentSession[]>([]);
  const [mood, setMood] = useState<string | null>(null);
  // Which screen a session was launched from, so End / Done return there (e.g.
  // a session started from history goes back to history, not always home).
  const [playOrigin, setPlayOrigin] = useState<Screen>("setup");
  // A saved session waiting to start on the player. Set by replay(), consumed by
  // an effect once the restored choices have applied to state (so the timer's
  // totalSecs and the engine params match the session being replayed).
  const [pendingReplay, setPendingReplay] = useState<RecentSession | null>(null);
  // Daily practice reminder (on-device local notification): the stored pref and
  // whether the little settings sheet is open.
  const [reminder, setReminder] = useState<ReminderPref>({
    enabled: false,
    hour: 20,
    minute: 0,
  });
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  // "How are you arriving?" welcome-back check-in (once/day, returning users).
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  // First-reveal hint on the recent/history entry: pulse + a small tooltip the
  // first time it appears (after the first completed session), then never again.
  const [hintRecent, setHintRecent] = useState(false); // tooltip mounted
  const [hintShow, setHintShow] = useState(false); // drives the fade in/out
  const hintDoneRef = useRef(false);

  const engineRef = useRef<AudioEngine>(new AudioEngine());
  // Breathing: one smooth clock (seconds of playing time) drives both the orb
  // and the cue. It advances only while playing, so a pause freezes the orb
  // mid-breath and resumes exactly in phase.
  const playOrbRef = useRef<HTMLDivElement | null>(null);
  const playingRef = useRef(false);
  const breathClockRef = useRef(0);
  const breathTsRef = useRef<number | null>(null);
  const reduceMotionRef = useRef(false);
  // Lock-screen (MediaSession) controls call into the latest play/pause via this
  // ref, so the handlers we register once never go stale.
  const mediaActionRef = useRef({ play: () => {}, pause: () => {}, stop: () => {} });
  const endTimerRef = useRef<number | null>(null);
  const completeTimerRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  // Session clock kept in wall-clock time (ms of actual playback), so the timer
  // and the auto-end survive the screen locking / backgrounding, which throttles
  // JS timers. Pauses are excluded, so pausing correctly extends the session.
  const playedMsRef = useRef(0);
  const runStartRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Keep the phone from auto-sleeping during a session (which suspends browser
  // audio and kills playback). Foreground only; the OS releases it on lock, so
  // we re-request when the tab becomes visible again. True background/locked
  // playback (a phone in your pocket) needs the native app.
  async function acquireWakeLock() {
    try {
      const wl = navigator.wakeLock;
      if (wl && !wakeLockRef.current) {
        wakeLockRef.current = await wl.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      }
    } catch {
      /* unsupported or denied; the session simply behaves as before */
    }
  }
  function releaseWakeLock() {
    try {
      wakeLockRef.current?.release();
    } catch {
      /* already released */
    }
    wakeLockRef.current = null;
  }

  // Tray auditions. Voice greetings are short cached clips per voice slot;
  // soundscape previews play a few seconds of the real bed, level-matched. Both
  // fail silently if the asset isn't there yet (e.g. clips not generated).
  function previewVoice(v: VoiceChoice, a: Accent) {
    if (v === "none") {
      engineRef.current.stopPreview();
      return;
    }
    engineRef.current.preview(asset(`/voice-previews/${v}-${a}.mp3`), {
      gain: PREVIEW_GAIN[`${v}-${a}`] ?? 0.85,
    });
  }
  function previewSound(id: Soundscape) {
    const def = soundDef(id);
    if (!def || def.soon || !def.src) {
      engineRef.current.stopPreview();
      return;
    }
    const gain =
      def.rms != null && def.peak != null
        ? normGain(def.rms, def.peak, BED_SOLO + (def.trim ?? 0))
        : 0.7;
    // Skip past the bed's fade-in intro so the audition is audible at once.
    engineRef.current.preview(asset(def.src), { seconds: 6, gain, offset: 2.5 });
  }

  // Silence any audition the moment the tray closes (scrim tap, begin, etc.).
  useEffect(() => {
    if (!trayOpen) engineRef.current.stopPreview();
  }, [trayOpen]);

  const selected = getContext(context) ?? CONTEXTS[0];
  const soundLabel =
    SOUNDSCAPES.find((s) => s.id === soundscape)?.label ?? "Off";
  const totalSecs = duration * 60;
  // The named guide for the current voice + accent (null when "None").
  const guide =
    voice !== "none"
      ? (GUIDES as Record<string, { name: string; blurb: string }>)[
          `${voice}-${accent}`
        ]
      : null;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Prefs;
        if (p.name) {
          setName(p.name);
          setNameCommitted(true); // returning user: greeting, not the name field
        }
        if (p.voice) setVoice(p.voice);
        if (p.accent) setAccent(p.accent);
        // Ignore a saved "silence" (the removed Off option): every session
        // now keeps a bed, so fall back to the default soundscape.
        if (p.soundscape && p.soundscape !== "silence") {
          setSoundscape(p.soundscape);
          setSoundTab(catOf(p.soundscape));
        }
        setSaveDefault(true);
      }
    } catch {
      /* ignore */
    }
    const startRecent = loadRecent();
    setRecent(startRecent);
    setFavs(loadFavs());
    // Load the reminder pref and re-sync it to the OS schedule (so a reminder
    // set before the native plugin existed starts firing once it can).
    setReminder(loadReminder());
    syncReminder();
    // Welcome back: for an established returning user (either brand, has
    // history), offer a gentle once-a-day "how are you arriving?" that tunes the
    // session.
    if (startRecent.length > 0 && !arrivingSeenToday()) {
      setWelcomeOpen(true);
    }
  }, []);

  // The first time the recent/history entry appears (once there's history, e.g.
  // after the first completed session lands the user back home), pulse it with a
  // small tooltip so the newly-appeared glyph is intuitive. Once, ever.
  useEffect(() => {
    if (!IS_RELAXED || screen !== "setup" || hintDoneRef.current) return;
    if (recent.length === 0 && favs.length === 0) return;
    hintDoneRef.current = true;
    if (recentHintSeen()) return;
    markRecentHintSeen();
    setHintRecent(true); // mount
    const inT = window.setTimeout(() => setHintShow(true), 80); // next frame: fade in
    const outT = window.setTimeout(() => setHintShow(false), 5000); // begin fade out
    const endT = window.setTimeout(() => setHintRecent(false), 5500); // unmount after fade
    return () => {
      window.clearTimeout(inT);
      window.clearTimeout(outT);
      window.clearTimeout(endT);
    };
  }, [screen, recent.length, favs.length]);

  useEffect(() => {
    const engine = engineRef.current;
    return () => {
      engine.stop();
      releaseWakeLock();
      if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The OS drops the wake lock when the tab is hidden (e.g. a brief lock); grab
  // it again when the user returns while a session is still playing.
  useEffect(() => {
    function onVis() {
      if (
        document.visibilityState === "visible" &&
        playing &&
        screen === "player"
      ) {
        acquireWakeLock();
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, screen]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // Keep the lock-screen play/pause/stop pointed at the current handlers.
  mediaActionRef.current = {
    play: () => {
      if (!playing) togglePlay();
    },
    pause: () => {
      if (playing) togglePlay();
    },
    stop: () => end(),
  };

  // Lock screen / Control Center "Now Playing" card. Set the metadata + working
  // controls when a session is on the player, and clear it when we leave.
  useEffect(() => {
    if (screen !== "player") {
      clearNowPlaying();
      return;
    }
    setNowPlaying({
      title: selected.custom ? "Your session" : selected.label,
      artist: `${BRAND.name} · ${soundLabel}`,
      album: BRAND.name,
      category: soundDef(soundscape)?.cat,
      onPlay: () => mediaActionRef.current.play(),
      onPause: () => mediaActionRef.current.pause(),
      onStop: () => mediaActionRef.current.stop(),
    });
    return () => clearNowPlaying();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, selected.label, selected.custom, soundLabel, soundscape]);

  // Keep the lock-screen play/pause icon in sync (no scrubber — see native.ts).
  useEffect(() => {
    if (screen !== "player") return;
    setPlaybackState(playing);
  }, [screen, playing]);

  // Karaoke + breathing: one rAF loop on the player screen. It follows the
  // spoken line (synced to the audio clock) and advances the breathing clock
  // that drives both the orb (via the --pb custom property) and the cue words,
  // so the ring expands on "Breathe in", holds, and contracts on "Breathe out".
  useEffect(() => {
    if (screen !== "player") {
      setActiveLine(-1);
      return;
    }
    // Fresh breath clock each time we enter the player.
    breathClockRef.current = 0;
    breathTsRef.current = null;
    reduceMotionRef.current =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const tick = () => {
      const idx = engineRef.current.activeLineIndex();
      setActiveLine((prev) => (prev === idx ? prev : idx));

      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const last = breathTsRef.current;
      breathTsRef.current = now;
      if (last != null && playingRef.current) {
        breathClockRef.current += (now - last) / 1000;
      }
      const { pb, phase } = breathAt(breathClockRef.current);
      const orb = playOrbRef.current;
      if (orb) {
        orb.style.setProperty("--pb", reduceMotionRef.current ? "0.5" : pb.toFixed(4));
      }
      setBreathPhase((prev) => (prev === phase ? prev : phase));

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [screen]);

  // Keep the active line a little above center in the transcript, so there's
  // clear room below it for the upcoming words (the pane fades out its bottom
  // edge, so a dead-centered line reads as bottom-aligned).
  useEffect(() => {
    const c = transcriptRef.current;
    if (!c || activeLine < 0) return;
    const el = c.querySelector<HTMLElement>(`[data-line="${activeLine}"]`);
    if (!el) return;
    const top = el.offsetTop + el.clientHeight / 2 - c.clientHeight * 0.35;
    c.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [activeLine, showTranscript]);

  // Start a queued replay once the restored choices have applied to state and
  // we're on the player, so the timer (totalSecs) and engine match the session.
  useEffect(() => {
    if (pendingReplay && screen === "player") {
      const r = pendingReplay;
      setPendingReplay(null);
      startFromSaved(r);
    }
    // startFromSaved is a stable component function; deps are the trigger only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingReplay, screen]);

  // --- Session clock (wall-clock based) ---
  const nowMs = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now();
  function elapsedSecs(): number {
    const running = runStartRef.current != null ? nowMs() - runStartRef.current : 0;
    return (playedMsRef.current + running) / 1000;
  }
  function clockStart() {
    playedMsRef.current = 0;
    runStartRef.current = nowMs();
    completedRef.current = false;
  }
  function clockPause() {
    if (runStartRef.current != null) {
      playedMsRef.current += nowMs() - runStartRef.current;
      runStartRef.current = null;
    }
  }
  function clockResume() {
    if (runStartRef.current == null) runStartRef.current = nowMs();
  }

  function startTick() {
    if (tickRef.current) window.clearInterval(tickRef.current);
    // Re-read the wall clock each tick so the display stays accurate after the
    // phone was locked (a throttled interval just resumes at the right value),
    // and end the session when real playback time reaches the chosen length.
    tickRef.current = window.setInterval(() => {
      const e = elapsedSecs();
      setElapsed(Math.min(Math.floor(e), totalSecs));
      if (!completedRef.current && e >= totalSecs) {
        completedRef.current = true;
        completeSession();
      }
    }, 500);
  }
  function stopTick() {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  function persistPrefs() {
    if (saveDefault) {
      const prefs: Prefs = { name, voice, accent, soundscape };
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } else {
      localStorage.removeItem(PREFS_KEY);
    }
  }

  // Advance the per-state variant counter (persisted on the device) so each
  // successive session of a state cycles to the next script variant rather than
  // a random pick that can repeat.
  function nextVariantSeq(id: ContextId): number {
    try {
      const key = "em_variant_seq";
      const map = JSON.parse(localStorage.getItem(key) || "{}") as Record<
        string,
        number
      >;
      const next = (map[id] ?? -1) + 1;
      map[id] = next;
      localStorage.setItem(key, JSON.stringify(map));
      return next;
    } catch {
      return Math.floor(Math.random() * 1000);
    }
  }

  // Does this device have remembered preferences? Returning users see their
  // saved voice/accent/soundscape as the active choices; first-timers get a
  // clean slate with nothing preselected.
  function hasSavedPrefs(): boolean {
    try {
      return !!localStorage.getItem(PREFS_KEY);
    } catch {
      return false;
    }
  }

  // Commit the typed name from the home header: trim, remember it, and flip the
  // header from the field to the greeting. Empty input is ignored (stay in the
  // field) so a name can't be blanked out by tapping away.
  function commitName() {
    const n = name.trim();
    if (!n) return;
    setName(n);
    setNameCommitted(true);
    setEditingName(false);
    persistPrefs();
  }

  function chooseIntention(id: ContextId) {
    setContext(id);
    setError(null);
    const returning = hasSavedPrefs();
    if (returning) {
      // Returning: surface the remembered voice + accent + soundscape as the
      // active choices, on the soundscape's own tab. Nothing is reset.
      setVoicePicked(true);
      setSoundPicked(true);
      setSoundTab(catOf(soundscape));
    } else {
      // First time: nothing preselected, opened on Nature, so the first tap both
      // selects and previews (same as voice). A calm nature bed sits underneath
      // so Begin still works even if they never pick one.
      setVoicePicked(false);
      setSoundPicked(false);
      setSoundscape(FIRST_TIME_SOUND);
      setSoundTab("nature");
    }
    setTrayOpen(true);
  }

  // A history descriptor for the session currently set up in state. Its signature
  // (context/duration/voice/accent/soundscape/phrase) is what matches an entry
  // across recent and saved, so building it the same way here and when attaching
  // the script keeps them in sync.
  function currentSession(): RecentSession {
    const phrase = customText.trim();
    const label = selected.custom
      ? phrase
        ? `“${phrase}”`
        : selected.label
      : selected.label;
    const soundBit = voice === "none" ? "sounds only" : soundLabel;
    return {
      context,
      label,
      sub: `${duration} min · ${soundBit}`,
      duration,
      voice,
      accent,
      soundscape,
      customText: selected.custom ? phrase : undefined,
      at: Date.now(),
    };
  }

  // Save the session that's starting to on-device history, so it can be replayed
  // later with one tap. Called from begin() for every kind of session. The exact
  // script is attached separately once it's composed (rememberScript).
  function rememberSession() {
    setRecent(pushRecent(currentSession()));
  }

  // Attach the resolved script to the session just started, so a later replay
  // reproduces these exact words (revoiced) instead of writing a new session.
  function rememberScript(script: SavedLine[]) {
    if (!script.length) return;
    setRecent(updateRecentScript(currentSession(), script));
  }

  // --- Daily reminder (local notification) ---
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const reminderTimeLabel = (() => {
    const ap = reminder.hour < 12 ? "AM" : "PM";
    const hh = ((reminder.hour + 11) % 12) + 1;
    return `${hh}:${pad2(reminder.minute)} ${ap}`;
  })();

  async function toggleReminder(on: boolean) {
    setReminderBusy(true);
    const next = await saveReminder({ ...reminder, enabled: on });
    setReminder(next);
    setReminderBusy(false);
    ev("reminder_set", { on: next.enabled });
  }

  async function setReminderTime(value: string) {
    const [h, m] = value.split(":").map((x) => Number(x));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return;
    setReminderBusy(true);
    const next = await saveReminder({ enabled: reminder.enabled, hour: h, minute: m });
    setReminder(next);
    setReminderBusy(false);
  }

  // Welcome-back check-in: record how they're arriving, then either steer into a
  // fitting intention (opening the tray) or simply close. Once a day either way.
  function chooseArriving(opt: { key: string; context: ContextId | null }) {
    markArrivingSeen();
    ev("arriving", { mood: opt.key });
    setWelcomeOpen(false);
    if (opt.context) {
      recordMood({ mood: opt.key, context: opt.context, custom: false });
      chooseIntention(opt.context);
    }
  }

  function dismissWelcome() {
    markArrivingSeen();
    setWelcomeOpen(false);
  }

  // One-tap replay: restore every choice from a past session. If the exact
  // script was saved, playback starts immediately (deferred to the effect that
  // consumes pendingReplay); older entries without a saved script fall back to
  // restoring the choices in the tray.
  function replay(r: RecentSession) {
    ev("session_replay", { context: r.context, duration: r.duration });
    engineRef.current.stopPreview();
    setError(null);
    setPlayOrigin(screen);
    setContext(r.context as ContextId);
    setDuration(r.duration as Duration);
    setVoice(r.voice as VoiceChoice);
    setVoicePicked(true);
    setAccent(r.accent as Accent);
    setSoundscape(r.soundscape as Soundscape);
    setSoundPicked(true);
    setSoundTab(catOf(r.soundscape as Soundscape));
    setCustomText(r.customText ?? "");
    // Saved script → play it now (deferred so the restored choices land first).
    // No saved script (older entry) → restore into the tray to regenerate.
    if (r.script && r.script.length) {
      setPendingReplay(r);
      setScreen("player");
    } else {
      setScreen("setup");
      setTrayOpen(true);
    }
  }

  // Star / unstar a session so it's kept indefinitely, off the rolling window.
  function toggleFavorite(r: RecentSession) {
    haptic("light");
    setFavs(toggleFav(r));
  }

  // Swipe-to-delete a row from recent or from saved.
  function deleteRecent(r: RecentSession) {
    haptic("light");
    setRecent(removeRecent(r));
  }
  function deleteFavorite(r: RecentSession) {
    haptic("light");
    setFavs(removeFav(r));
  }

  // The post-session reflection: one tap, stored on-device, never blocking.
  function chooseMood(m: string) {
    if (mood) return;
    haptic("light");
    setMood(m);
    recordMood({ mood: m, context, custom: !!selected.custom });
    ev("feedback", { mood: m, context, custom: !!selected.custom });
  }

  // Let all three composing steps reach their green "done" state, including the
  // final one, before revealing the player, so the last step visibly completes
  // instead of jumping away while it's still active.
  async function finishComposing() {
    setGenStep(2); // final step active
    await new Promise((r) => setTimeout(r, 350));
    setGenStep(3); // final step completes: its dot eases to green
    await new Promise((r) => setTimeout(r, 1150));
  }

  async function begin() {
    // Unlock the audio engine within this tap so mobile browsers will let the
    // voice + soundscape play once ready. Stop any tray audition first.
    engineRef.current.stopPreview();
    engineRef.current.unlock();

    setError(null);
    setPlayOrigin("setup"); // Begin comes from the home/tray; End returns home.
    persistPrefs();
    rememberSession();
    setMood(null); // fresh reflection for this session
    setElapsed(0);
    setShowTranscript(true);
    setTrayOpen(false);

    const kind = voice === "none" ? "sounds" : selected.custom ? "custom" : "preset";
    ev("session_start", { kind, context, duration, voice, accent, soundscape });

    // No-voice: a pure soundscape session. Skip generation and the voice
    // entirely; go straight to the player with the soundscape + breathing visual.
    if (voice === "none") {
      setScript("");
      setNote("");
      setIsPreview(false);
      setScreen("player");
      startPlayback([]);
      return;
    }

    // Custom: instant start — straight to the player, bed + breathing now, and
    // the guide streams in behind a short arrival (see beginCustom).
    if (selected.custom) {
      beginCustom();
      return;
    }

    setScreen("generating");
    setGenStep(0);
    // Walk the "composing" steps so it reads as real work being done. Thanks to
    // the cache the session is usually ready almost instantly, but we hold the
    // generating screen for a short beat so it feels personally composed, not
    // pulled off a shelf.
    const started = Date.now();
    const stepA = window.setTimeout(() => setGenStep(1), 2000);
    const stepB = window.setTimeout(() => setGenStep(2), 4000);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          context,
          durationMin: duration,
          voice,
          accent,
          variantSeq: nextVariantSeq(context),
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || `Request failed (${res.status})`);

      setScript(data.script || "");
      setNote(typeof data.note === "string" ? data.note : "");
      setIsPreview(Boolean(data.mock));

      // Persist the exact script (name-resolved transcript lines paired with each
      // segment's pause) so a later replay reproduces it rather than re-rolling
      // the variant. The transcript is 1:1 with the segments.
      const segs = Array.isArray(data.segments) ? data.segments : [];
      const texts = String(data.script || "").split("\n");
      if (segs.length && texts.length === segs.length) {
        rememberScript(
          segs.map((s: { pauseAfter?: number }, i: number) => ({
            text: texts[i],
            pauseAfter: Number(s.pauseAfter) || 0,
          }))
        );
      }

      const wait = MIN_GENERATING_MS - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      window.clearTimeout(stepA);
      window.clearTimeout(stepB);
      await finishComposing();
      setScreen("player");
      startPlayback(Array.isArray(data.segments) ? data.segments : []);
    } catch (e) {
      window.clearTimeout(stepA);
      window.clearTimeout(stepB);
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setScreen("setup");
    }
  }

  // Custom flow, instant start: no "composing" screen and no wait. We go
  // straight to the player, start the bed + breathing immediately, speak a short
  // fixed arrival while Claude writes the personalized body, then stream the
  // body lines in behind the arrival (see AudioEngine.playCustomStream). If the
  // voice is set to None it's a pure soundscape, so this path doesn't apply.
  function customArrival(): { text: string; pauseAfter: number }[] {
    const who = name.trim();
    return [
      { text: who ? `Let's begin, ${who}.` : "Let's begin.", pauseAfter: 2.4 },
      {
        text: "Settle into a position you can rest in, and when you feel ready, let your eyes close.",
        pauseAfter: 3.2,
      },
      { text: "Take a slow breath in. And gently let it go.", pauseAfter: 4 },
    ];
  }

  function beginCustom() {
    const arrival = customArrival();
    setNote("");
    setIsPreview(false);
    // Show the arrival lines right away so the transcript isn't empty; the body
    // is appended in onBody once it's written.
    setScript(arrival.map((a) => a.text).join("\n"));
    setScreen("player");
    startCustomInstant(arrival);
  }

  // Kick off the instant Custom session: bed + breathing + clock start now, and
  // the arrival/body stream through the same normalized voice bus as a preset.
  function startCustomInstant(arrival: { text: string; pauseAfter: number }[]) {
    haptic("medium");
    const eng = engineRef.current;

    const { voiceGain, src, level } = bedAndVoice(voice, accent, soundscape);
    eng.voiceGainValue = voiceGain;
    eng.startAmbient(soundscape, src, level);
    // Scene-based audio: the per-intention envelope shapes the bed + voice over
    // the session's length (e.g. the voice thins out toward sleep).
    eng.setSession(audioProfile(context), duration * 60);
    eng.playBell({ gain: 0.06, f0: 396, decay: 4.5 }); // soft "enter" cue
    eng.onVoiceEnded = () => eng.fadeOutAmbient(8);

    const fetchAudio = async (text: string): Promise<ArrayBuffer | null> => {
      try {
        const r = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice, accent }),
        });
        if (!r.ok) return null;
        return await r.arrayBuffer();
      } catch {
        return null;
      }
    };

    // Reserve the arrival's spoken + pause time on the server so the body fills
    // (duration - arrival) and the two together land on the chosen length,
    // rather than the guide overrunning into the closing bell.
    const leadSeconds = Math.round(
      arrival.reduce(
        (a, s) => a + s.text.trim().split(/\s+/).length / 2.2 + s.pauseAfter,
        0
      )
    );

    const bodyPromise = (async () => {
      const res = await fetch("/api/custom-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phrase: customText.trim(),
          durationMin: duration,
          leadSeconds,
          // The exact arrival already spoken, so the body continues from it
          // instead of greeting/settling a second time.
          arrivalText: arrival.map((a) => a.text).join(" "),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      if (typeof data.mock === "boolean") setIsPreview(data.mock);
      return Array.isArray(data.segments)
        ? (data.segments as { text: string; pauseAfter: number }[])
        : [];
    })();
    // playCustomStream awaits this inside a try/catch, but it may early-return
    // (session ended during the arrival) before it ever does; mark it handled so
    // a rejected script fetch can't surface as an unhandled rejection.
    bodyPromise.catch(() => {});

    eng.playCustomStream(arrival, bodyPromise, fetchAudio, (body) => {
      if (body.length) {
        setScript(
          [...arrival.map((a) => a.text), ...body.map((s) => s.text)].join("\n")
        );
        // Persist the exact composed script (arrival + body) so a replay
        // reproduces these words rather than asking Claude for a new session.
        rememberScript([
          ...arrival.map((a) => ({ text: a.text, pauseAfter: a.pauseAfter })),
          ...body.map((s) => ({ text: s.text, pauseAfter: s.pauseAfter })),
        ]);
      } else {
        // The guide couldn't be written/reached; keep the bed going so it lands
        // as a calm sounds-only session rather than an error bounce.
        setNote(
          "We couldn't reach your guide just now, so let the sounds carry this one. Tap End whenever you're ready."
        );
        ev("custom_no_body", { context, duration });
      }
    });

    clockStart();
    setPlaying(true);
    setElapsed(0);
    startTick();
    acquireWakeLock();
  }

  function startPlayback(
    segments: { audio: string | null; pauseAfter: number }[]
  ) {
    haptic("medium");
    const eng = engineRef.current;
    eng.onVoiceEnded = () => eng.fadeOutAmbient(8);

    // Shared loudness normalization: voice to the common target, bed quiet under
    // the voice or louder solo (see bedAndVoice).
    const { voiceGain, src, level } = bedAndVoice(voice, accent, soundscape);
    eng.voiceGainValue = voiceGain;
    eng.startAmbient(soundscape, src, level);
    // Scene-based audio: shape the bed + voice over the session (e.g. the voice
    // thins out toward the end of a Sleep session while the bed carries on).
    eng.setSession(audioProfile(context), duration * 60);
    eng.playBell({ gain: 0.06, f0: 396, decay: 4.5 }); // soft "enter" cue
    eng.playSegments(segments);
    clockStart();
    setPlaying(true);
    setElapsed(0);
    startTick();
    acquireWakeLock();
  }

  // Play a saved session from its exact stored script (revoiced, never
  // rewritten). Invoked by the pendingReplay effect once the restored choices
  // are in state, so the timer and engine match. The whole script plays as one
  // streamed batch; the player's timer ends it at its length like any session.
  function startFromSaved(r: RecentSession) {
    const eng = engineRef.current;
    const lines: SavedLine[] = r.script ?? [];
    setNote("");
    setIsPreview(false);
    setScript(lines.map((l) => l.text).join("\n"));
    // Float it back to the top of recents, keeping its script.
    setRecent(pushRecent({ ...r, at: Date.now() }));
    haptic("medium");

    const rVoice = r.voice as VoiceChoice;
    const rAccent = r.accent as Accent;
    const { voiceGain, src, level } = bedAndVoice(
      rVoice,
      rAccent,
      r.soundscape as Soundscape
    );
    eng.voiceGainValue = voiceGain;
    eng.startAmbient(r.soundscape as Soundscape, src, level);
    eng.setSession(audioProfile(r.context as ContextId), r.duration * 60);
    eng.playBell({ gain: 0.06, f0: 396, decay: 4.5 });
    eng.onVoiceEnded = () => eng.fadeOutAmbient(8);

    // Sounds-only sessions have no voice to reproduce; the bed + timer carry it.
    if (rVoice !== "none" && lines.length) {
      const fetchAudio = async (text: string): Promise<ArrayBuffer | null> => {
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, voice: rVoice, accent: rAccent }),
          });
          if (!res.ok) return null;
          return await res.arrayBuffer();
        } catch {
          return null;
        }
      };
      eng.playCustomStream(lines, Promise.resolve([]), fetchAudio, () => {});
    }

    clockStart();
    setPlaying(true);
    setElapsed(0);
    startTick();
    acquireWakeLock();
  }

  // Reached the chosen duration: wind the sound down and, once it has faded a
  // little, ease into the closing screen (the audio keeps fading underneath).
  function completeSession() {
    haptic("success");
    ev("session_complete", {
      kind: voice === "none" ? "sounds" : selected.custom ? "custom" : "preset",
      context,
      duration,
    });
    clockPause();
    // A soft closing bell, a fifth below the opening one, as the bed winds down.
    engineRef.current.playBell({ gain: 0.055, f0: 264, decay: 6 });
    engineRef.current.fadeOutAmbient(6);
    stopTick();
    setPlaying(false);
    releaseWakeLock();
    if (completeTimerRef.current) window.clearTimeout(completeTimerRef.current);
    completeTimerRef.current = window.setTimeout(
      () => setScreen("complete"),
      2200
    );
  }

  function togglePlay() {
    haptic("light");
    if (playing) {
      engineRef.current.suspend();
      clockPause();
      stopTick();
      setPlaying(false);
      releaseWakeLock();
    } else {
      engineRef.current.resume();
      clockResume();
      startTick();
      setPlaying(true);
      acquireWakeLock();
    }
  }

  function end() {
    // Left the player before the session completed → an abandon (with how far
    // in). Completing flips completedRef first, so a natural finish isn't logged
    // here. No free text, just the shape.
    if (screen === "player" && !completedRef.current) {
      ev("session_abandon", {
        context,
        duration,
        elapsedSec: Math.floor(elapsedSecs()),
      });
    }
    engineRef.current.stop();
    clockPause();
    runStartRef.current = null;
    if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    if (completeTimerRef.current) window.clearTimeout(completeTimerRef.current);
    stopTick();
    releaseWakeLock();
    setPlaying(false);
    setElapsed(0);
    // Return to wherever the session was launched from (history if it was a
    // replay, otherwise home), not always home.
    setScreen(playOrigin);
  }

  // Cue words read from the same breathing clock as the orb (breathPhase state),
  // so they change exactly as the ring turns at the top and bottom of the breath.
  const breathCue = !playing
    ? "Paused"
    : breathPhase === "in"
      ? "Breathe in"
      : breathPhase === "hold"
        ? "Hold"
        : "Breathe out";
  const breathSub = !playing
    ? "Tap play to continue"
    : breathPhase === "in"
      ? "Slowly, through the nose"
      : breathPhase === "hold"
        ? "Gently, for a moment"
        : "Slowly, through the mouth";

  const moodOn = trayOpen || screen === "player" || screen === "complete";

  // ---- Screens ----
  let content: React.ReactNode;
  if (screen === "generating") {
    content = (
      <main className="wrap">
        <div className="topbar">
          <Wordmark />
        </div>
        <div className="generating">
          <div className="gen-orb">
            {IS_RELAXED ? (
              <StemGlyph size={92} className="gen-glyph" />
            ) : (
              <>
                <div className="disc" style={{ background: selected.art }} />
                <div className="halo" />
              </>
            )}
          </div>
          <div>
            <div className="gen-title">
              {selected.custom ? "Writing your session" : "Composing your session"}
            </div>
            <div className="gen-detail">
              {selected.custom && customText.trim() ? (
                <>
                  {name.trim() || "You"} · &ldquo;{customText.trim()}&rdquo; ·{" "}
                  {duration} min
                </>
              ) : (
                <>
                  {name.trim() || "You"} · {selected.label} · {duration} min ·{" "}
                  {soundLabel}
                </>
              )}
            </div>
          </div>
          <div className="steps">
            {(selected.custom
              ? [
                  <>Reading what you wrote</>,
                  <>Personalizing your session</>,
                  IS_RELAXED ? (
                    <>Giving it voice</>
                  ) : (
                    <>
                      Giving it voice with <b>ElevenLabs</b>
                    </>
                  ),
                ]
              : [
                  <>Crafting your journey</>,
                  IS_RELAXED ? (
                    <>Scoring your soundtrack</>
                  ) : (
                    <>
                      Scoring your soundscape with <b>ElevenMusic</b>
                    </>
                  ),
                  IS_RELAXED ? (
                    <>Giving it voice</>
                  ) : (
                    <>
                      Giving it voice with <b>ElevenLabs</b>
                    </>
                  ),
                ]
            ).map((label, i) => (
              <div
                key={i}
                className={`step ${i < genStep ? "done" : ""} ${
                  i === genStep ? "active" : ""
                }`}
              >
                <div className="dot" />
                <div>{label}</div>
              </div>
            ))}
          </div>
          <div className="gen-foot">
            No progress bar. Settle in, and find a position you can hold for{" "}
            {duration} minutes.
          </div>
        </div>
      </main>
    );
  } else if (screen === "player") {
    content = (
      <main className="wrap">
        <div className="player-top">
          <div>
            {selected.label} · {soundLabel}
          </div>
          <div className="time">
            {mmss(elapsed)} / {mmss(totalSecs)}
          </div>
        </div>

        <div className="player-center">
          <div className="play-orb" ref={playOrbRef}>
            <div
              className={`disc ${playing ? "breathe" : ""}`}
              style={
                IS_RELAXED
                  ? undefined
                  : ({
                      background: selected.art,
                      "--pg": selected.glow,
                    } as React.CSSProperties)
              }
            />
            <div className="ring" />
            {/* relaxed: the motif sits OUTSIDE the breathing disc so it stays
                steady (its own gentle motion) while the ring expands/contracts
                around it — otherwise it scales with the ring and jitters. */}
            {IS_RELAXED && <SoundMotif id={soundscape} />}
          </div>
          <div className="breath">
            <div className={`cue ${playing ? "pulse" : ""}`}>{breathCue}</div>
            <div className="sub">{breathSub}</div>
          </div>
        </div>

        <div>
          <div className="controls">
            <button className="cbtn" onClick={end} aria-label="End session">
              End
            </button>
            <button
              className="cbtn play"
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? (
                <span className="bars">
                  <i />
                  <i />
                </span>
              ) : (
                <span className="tri" />
              )}
            </button>
            <button
              className="cbtn"
              onClick={() => setShowTranscript((v) => !v)}
              aria-label="Toggle transcript"
            >
              <span className="lines">
                <i />
                <i />
                <i />
              </span>
            </button>
          </div>

          {showTranscript && (isPreview || script) && (
            <div className="transcript">
              <div className="thead">
                <div className="label">Transcript</div>
                <button onClick={() => setShowTranscript(false)}>
                  Tap to hide
                </button>
              </div>
              {note && <div className="preview">{note}</div>}
              <div className="body" ref={transcriptRef}>
                {transcriptLines(script).map((ln, i) => (
                  <p
                    key={i}
                    data-line={i}
                    className={`tline ${
                      i === activeLine ? "active" : i < activeLine ? "past" : ""
                    }`}
                  >
                    {ln}
                  </p>
                ))}
              </div>
            </div>
          )}
          {!showTranscript && (
            <button
              className="show-transcript"
              onClick={() => setShowTranscript(true)}
            >
              Show transcript
            </button>
          )}
        </div>
      </main>
    );
  } else if (screen === "complete") {
    // ---- Closing: a quiet "well done" ----
    content = (
      <main className="wrap done-wrap">
        <div className="done">
          <div className="done-orb">
            <div
              className="disc"
              style={
                IS_RELAXED
                  ? undefined
                  : ({
                      background: selected.art,
                      "--pg": selected.glow,
                    } as React.CSSProperties)
              }
            />
            <div className="ring" />
          </div>
          <div className="done-title">
            Well done{name.trim() ? <>, {name.trim()}</> : ""}.
          </div>
          <div className="done-sub">
            Take a moment before you go. The calm is yours to keep.
          </div>
          <div className="mood-check">
            {mood ? (
              <div className="mood-thanks">Thank you. Noted, just for you.</div>
            ) : (
              <>
                <div className="mood-prompt">How do you feel?</div>
                <div className="mood-row">
                  {MOODS.map((m) => (
                    <button
                      key={m}
                      className="mood-btn"
                      onClick={() => chooseMood(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            className="done-btn"
            onClick={end}
            style={
              IS_RELAXED
                ? undefined
                : ({
                    "--cta-glow": selected.glow,
                    "--cta-disc": selected.art,
                  } as React.CSSProperties)
            }
          >
            <span className="dot" />
            Done
          </button>
          {!IS_RELAXED && (
            <div className="done-credit">
              Voiced by <b>ElevenLabs</b> · scored with <b>ElevenMusic</b>
            </div>
          )}
        </div>
      </main>
    );
  } else if (screen === "history") {
    // ---- History: recent (rolling ten) + saved (kept indefinitely) ----
    // A saved session is shown only in Saved, so it never appears twice.
    const savedList = favs;
    const recentList = recent.filter((r) => !isFav(favs, r));
    // Build the detail line from the stored choices (not the saved `sub` string),
    // so every row shows length, voice, accent, and soundscape — and older
    // entries upgrade to the fuller line too. Voiceless sessions read "sounds only".
    const metaLine = (r: RecentSession) => {
      const mins = `${r.duration} min`;
      if (r.voice === "none") return `${mins} · sounds only`;
      const who = r.voice === "male" ? "Him" : "Her";
      const acc = r.accent === "uk" ? "UK" : "US";
      const snd = SOUNDSCAPES.find((s) => s.id === r.soundscape)?.label ?? "";
      return [mins, who, acc, snd].filter(Boolean).join(" · ");
    };
    const row = (r: RecentSession, i: number, group: "recent" | "saved") => {
      const saved = isFav(favs, r);
      return (
        <SwipeRow
          key={`${r.context}-${r.at}-${i}`}
          onDelete={() => (group === "saved" ? deleteFavorite(r) : deleteRecent(r))}
        >
          <button className="hs-main" onClick={() => replay(r)}>
            <span className="hs-top">
              <span className="hs-label">{r.label}</span>
              <span className="hs-time">{timeAgo(r.at)}</span>
            </span>
            <span className="hs-sub">{metaLine(r)}</span>
          </button>
          <button
            className={`hs-star ${saved ? "on" : ""}`}
            onClick={() => toggleFavorite(r)}
            aria-label={saved ? "Remove from saved" : "Save this session"}
            aria-pressed={saved}
          >
            <StarGlyph filled={saved} />
          </button>
        </SwipeRow>
      );
    };
    content = (
      <main className="wrap history-scroll">
        <div className="topbar history-bar">
          <button
            className="hb-back"
            onClick={() => setScreen("setup")}
            aria-label="Back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <Wordmark />
          <span className="hb-spacer" />
        </div>

        <div className="history">
          <div className="hh">
            <OrbitGlyph size={24} className="hh-mark" />
            <span className="hh-title">your sessions</span>
          </div>

          {/* Saved sits on top (kept indefinitely), then recent (rolling ten).
              Swipe any row left to delete it. */}
          {savedList.length > 0 && (
            <section className="hsec">
              <div className="hsec-label">saved</div>
              {savedList.map((r, i) => row(r, i, "saved"))}
            </section>
          )}

          <section className="hsec">
            {savedList.length > 0 && <div className="hsec-label">recent</div>}
            {recentList.length > 0 ? (
              recentList.map((r, i) => row(r, i, "recent"))
            ) : (
              <div className="hs-empty">
                {savedList.length > 0
                  ? "Nothing new since your saved sessions."
                  : "Your recent sessions will appear here."}
              </div>
            )}
          </section>
        </div>
      </main>
    );
  } else {
    // ---- Setup: the night home ----
    content = (
      <main className="wrap">
        <div className="topbar">
          <Wordmark />
          {IS_RELAXED && (recent.length > 0 || favs.length > 0) && (
            <div className="recent-entry-wrap">
              <button
                className={`recent-entry ${hintRecent ? "pulse" : ""}`}
                onClick={() => {
                  haptic("light");
                  setHintShow(false);
                  setHintRecent(false);
                  setScreen("history");
                }}
                aria-label="Recent and saved sessions"
              >
                <OrbitGlyph size={22} />
              </button>
              {hintRecent && (
                <span className={`recent-hint ${hintShow ? "show" : ""}`} role="status">
                  history and saved
                </span>
              )}
            </div>
          )}
        </div>

        <div className="hero">
          {/* Header. The name is an editable part of the headline, never a
              standing box. relaxed: cold start shows the field; a remembered
              name shows the greeting with a tap-to-edit name. ElevenMind keeps
              its original greeting + name field. */}
          {IS_RELAXED ? (
            // Fixed-height header so everything below (the prompt + intentions)
            // stays pinned regardless of state; the greeting sits on the same
            // line the cold-start field occupies.
            <div className="home-head">
              {nameCommitted && !editingName ? (
                <div className="greeting">
                  {greetingFor()},{" "}
                  <button
                    className="name-chip"
                    onClick={() => setEditingName(true)}
                    aria-label="Edit your name"
                  >
                    <b>{name.trim()}</b>
                    <svg className="pencil" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M14.5 5.5l4 4M4 20l1-4L16 5a2 2 0 0 1 3 3L8 19l-4 1z"
                        stroke="currentColor"
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <div className="ask-label">what should we call you?</div>
                  <div className="namefield glass">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          commitName();
                          e.currentTarget.blur();
                        }
                      }}
                      onBlur={commitName}
                      placeholder="your name"
                      maxLength={40}
                      autoFocus={editingName}
                      aria-label="Your name"
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="greeting">
                {greetingFor()}
                {name.trim() ? (
                  <>
                    , <b>{name.trim()}</b>
                  </>
                ) : (
                  ""
                )}
              </div>
              <div className="namefield glass">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What should we call you?"
                  maxLength={40}
                  aria-label="Your name"
                />
              </div>
            </>
          )}

          {IS_RELAXED && CUSTOM_ENABLED ? (
            <>
              {/* "Make your own" is the flagship: a filled (Bone) primary, above
                  a labeled divider and the common intentions. */}
              <div className="prompt">What would you like to do?</div>
              <button className="hero-make" onClick={() => chooseIntention("custom")}>
                <span className="hm-l">make your own</span>
                <span className="hm-s">
                  Let us create a personalized, guided session for whatever you need.
                </span>
              </button>
              <div className="hero-div">
                <span className="l" />
                or pick a common intention
                <span className="l" />
              </div>
              <div className="states states-wide">
                {CONTEXTS.filter((c) => !c.custom).map((c) => (
                  <button
                    key={c.id}
                    className="state"
                    onClick={() => chooseIntention(c.id)}
                  >
                    <span className="slabel">
                      <span className="sname">{c.label}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="prompt">What would you like to do?</div>
              <div className="states">
                {CONTEXTS.map((c) => (
                  <button
                    key={c.id}
                    className="state"
                    onClick={() => chooseIntention(c.id)}
                  >
                    <span
                      className="orb"
                      style={
                        IS_RELAXED
                          ? undefined
                          : ({ background: c.art, "--og": c.glow } as React.CSSProperties)
                      }
                    />
                    <span className="slabel">
                      <span className="sname">{c.label}</span>
                      {c.custom && (
                        <span className="ssub">
                          A guided session for whatever you need.
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

        </div>

        <div className="footnote">
          Every session personalized for you.
          <br />
          {!IS_RELAXED && (
            <>
              <span className="credit">
                Voiced by <b>ElevenLabs</b> · scored with <b>ElevenMusic</b>
              </span>
              <br />
            </>
          )}
          Not medical or therapeutic advice.
          {IS_RELAXED ? (
            <>
              <br />
              <span className="foot-links">
                <button
                  type="button"
                  className="foot-link-btn"
                  onClick={() => setReminderOpen(true)}
                >
                  Reminder
                </button>
                <span className="dotsep">·</span>
                <a href={`mailto:${BRAND.support}`}>Contact</a>
                <span className="dotsep">·</span>
                <a href="/privacy">Privacy</a>
              </span>
            </>
          ) : (
            <>
              <br />
              <span className="foot-links">
                <button
                  type="button"
                  className="foot-link-btn"
                  onClick={() => setReminderOpen(true)}
                >
                  Daily reminder
                </button>
              </span>
            </>
          )}
        </div>

        {reminderOpen && (
          <div
            className="rm-scrim"
            onClick={() => setReminderOpen(false)}
            role="presentation"
          >
            <div
              className="rm-sheet"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Daily reminder"
            >
              <div className="rm-title">daily reminder</div>
              <p className="rm-sub">
                A gentle nudge to take a few minutes for yourself, at the same time
                each day.
              </p>
              <div className="rm-row">
                <span>Remind me daily</span>
                <button
                  type="button"
                  className={`rm-toggle ${reminder.enabled ? "on" : ""}`}
                  role="switch"
                  aria-checked={reminder.enabled}
                  disabled={reminderBusy}
                  onClick={() => toggleReminder(!reminder.enabled)}
                >
                  <span className="rm-knob" />
                </button>
              </div>
              <div className={`rm-row ${reminder.enabled ? "" : "rm-dim"}`}>
                <span>Time</span>
                <input
                  type="time"
                  className="rm-time"
                  value={`${pad2(reminder.hour)}:${pad2(reminder.minute)}`}
                  disabled={reminderBusy || !reminder.enabled}
                  onChange={(e) => setReminderTime(e.target.value)}
                  aria-label="Reminder time"
                />
              </div>
              {reminder.enabled && (
                <p className="rm-conf">We&apos;ll nudge you at {reminderTimeLabel}.</p>
              )}
              {!isNativeApp() && (
                <p className="rm-note">Reminders are delivered in the relaxed app.</p>
              )}
              <button
                type="button"
                className="rm-done"
                onClick={() => setReminderOpen(false)}
              >
                done
              </button>
            </div>
          </div>
        )}

        {welcomeOpen && (
          <div className="rm-scrim" onClick={dismissWelcome} role="presentation">
            <div
              className="rm-sheet"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Welcome back"
            >
              <div className="rm-title">
                {name.trim() ? `welcome back, ${name.trim()}` : "welcome back"}
              </div>
              <p className="rm-sub">How are you arriving?</p>
              <div className="wb-moods">
                {ARRIVING.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    className={`wb-mood ${o.context ? "" : "wb-skip"}`}
                    onClick={() => chooseArriving(o)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <>
      {!IS_RELAXED && (
        <>
          <div className="photo-sky" />
          <div className="photo-scrim" />
          <div
            className={`mood-glow ${moodOn ? "on" : ""}`}
            style={{ "--gc": selected.glow } as React.CSSProperties}
          />
        </>
      )}
      {/* key={screen} remounts the screen subtree on every transition so the
          calm fade-in (relaxed's rx-screen-in) re-fires; audio/state live in
          refs and hooks on the parent, so this only re-animates the view. */}
      <div className="app" key={screen}>
        {content}
      </div>

      {/* Options tray (setup only) */}
      {screen === "setup" && (
        <>
          <div
            className={`scrim ${trayOpen ? "open" : ""}`}
            onClick={() => setTrayOpen(false)}
          />
          <div
            className={`tray glass ${trayOpen ? "open" : ""}`}
            role="dialog"
            aria-label="Session options"
          >
            <div className="grab" />
            <div className="tray-head">
              <span
                className="orb"
                style={
                  IS_RELAXED
                    ? undefined
                    : ({
                        background: selected.art,
                        "--og": selected.glow,
                      } as React.CSSProperties)
                }
              />
              <div>
                <div className="tt">{selected.label}</div>
                {/* The custom tray's own prompt ("What's on your mind?") already
                    says this, so drop the redundant tagline there; presets keep
                    it as their only descriptor. */}
                {!selected.custom && <div className="ts">{selected.tagline}</div>}
              </div>
            </div>

            {selected.custom && (
              <div className="opt">
                {/* The prompt lives in the placeholder now, so there's no
                    separate label line; aria-label keeps it accessible. */}
                <input
                  className="custom-input"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  maxLength={CUSTOM_MAX_CHARS}
                  value={customText}
                  onChange={(e) =>
                    setCustomText(e.target.value.replace(/\s+/g, " ").slice(0, CUSTOM_MAX_CHARS))
                  }
                  placeholder="what's on your mind? e.g. studying for a test"
                  aria-label="What's on your mind"
                />
                <div className="custom-hint">
                  A few words is perfect. We&apos;ll write a session just for
                  this.
                </div>
              </div>
            )}

            <div className="opt">
              <div className="ol">Voice</div>
              <div className="voicerow">
                <div className="seg seg3">
                  <button
                    className={voicePicked && voice === "female" ? "on" : ""}
                    onClick={() => {
                      setVoicePicked(true);
                      setVoice("female");
                      previewVoice("female", accent);
                    }}
                  >
                    Her
                  </button>
                  <button
                    className={voicePicked && voice === "male" ? "on" : ""}
                    onClick={() => {
                      setVoicePicked(true);
                      setVoice("male");
                      previewVoice("male", accent);
                    }}
                  >
                    Him
                  </button>
                  <button
                    className={voicePicked && voice === "none" ? "on" : ""}
                    onClick={() => {
                      setVoicePicked(true);
                      setVoice("none");
                      engineRef.current.stopPreview();
                    }}
                  >
                    None
                  </button>
                </div>
                {voicePicked && voice !== "none" && (
                  <div className="flags">
                    <button
                      className={`flagbtn ${accent === "us" ? "on" : ""}`}
                      onClick={() => {
                        setAccent("us");
                        previewVoice(voice, "us");
                      }}
                      aria-label="American accent"
                    >
                      🇺🇸
                    </button>
                    <button
                      className={`flagbtn ${accent === "uk" ? "on" : ""}`}
                      onClick={() => {
                        setAccent("uk");
                        previewVoice(voice, "uk");
                      }}
                      aria-label="British accent"
                    >
                      🇬🇧
                    </button>
                  </div>
                )}
              </div>
              {/* Always rendered so the tray height stays fixed; when "None"
                  is selected it's simply an empty reserved line. */}
              <div
                className="guide"
                aria-hidden={!voicePicked || voice === "none" || !guide}
              >
                {voicePicked && voice !== "none" && guide && (
                  <>
                    <span className="gname">{guide.name}</span>
                    <span className="gblurb">{guide.blurb}</span>
                  </>
                )}
              </div>
            </div>

            <div className="opt">
              <div className="ol">Duration</div>
              <DurationSlider
                stops={DURATIONS}
                value={duration}
                onChange={(v) => setDuration(v as Duration)}
              />
            </div>

            <div className="opt">
              <div className="ol">Soundscape</div>
              <div className="soundtabs">
                {SOUND_CATS.map((t) => (
                  <button
                    key={t.id}
                    className={soundTab === t.id ? "on" : ""}
                    onClick={() => setSoundTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="rail">
                {/* No "Off": every session keeps a continuous soundscape bed,
                    which also keeps iOS audio alive when the phone locks. */}
                {SOUNDSCAPES.filter((s) => s.cat === soundTab).map((s) => (
                  <button
                    key={s.id}
                    disabled={s.soon}
                    className={`chip ${
                      soundPicked && soundscape === s.id ? "on" : ""
                    } ${s.soon ? "soon" : ""}`}
                    onClick={() => {
                      if (s.soon) return;
                      setSoundPicked(true);
                      setSoundscape(s.id);
                      previewSound(s.id);
                    }}
                  >
                    {s.label}
                    {s.soon && <span className="soon-tag">soon</span>}
                  </button>
                ))}
              </div>
              {/* Always rendered so switching to Frequencies doesn't shift the
                  tray; it's just an empty reserved line for other tabs. */}
              <div className="sound-hint" aria-hidden={soundTab !== "frequencies"}>
                {soundTab === "frequencies" ? "Best with headphones" : ""}
              </div>
            </div>

            <div className="remember">
              <span>Remember me on this device</span>
              <button
                className={`switch ${saveDefault ? "on" : ""}`}
                role="switch"
                aria-checked={saveDefault}
                aria-label="Remember me on this device"
                onClick={() => setSaveDefault((v) => !v)}
              >
                <span className="knob" />
              </button>
            </div>

            {error && <div className="err">{error}</div>}

            <button
              className="begin"
              onClick={begin}
              disabled={selected.custom && !customText.trim()}
              style={
                IS_RELAXED
                  ? undefined
                  : ({
                      "--cta-glow": selected.glow,
                      "--cta-disc": selected.art,
                    } as React.CSSProperties)
              }
            >
              <span className="dot" />
              Begin Session
            </button>
            <button className="goback" onClick={() => setTrayOpen(false)}>
              Go back
            </button>
          </div>
        </>
      )}
    </>
  );
}

// One transcript line per spoken line, aligned 1:1 with the audio segments so
// the karaoke highlight can follow along. (No em dashes in the read-along.)
