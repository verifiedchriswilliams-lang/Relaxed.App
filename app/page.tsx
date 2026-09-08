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
import { haptic, setNowPlaying, setPlaybackState, clearNowPlaying } from "@/lib/native";
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
  type RecentSession,
} from "@/lib/history";
import { ev } from "@/lib/analytics";
import { audioProfile, type AudioProfile } from "@/lib/engine";

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
function timeAgo(at: number): string {
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 45) return "now";
  const m = s / 60;
  if (m < 60) return `${Math.round(m)}m`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h`;
  const d = h / 24;
  if (d < 7) return `${Math.round(d)}d`;
  const w = d / 7;
  if (w < 5) return `${Math.round(w)}w`;
  return `${Math.round(d / 30)}mo`;
}

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

// Three soundscape families, five each. The "frequencies" family is synthesized
// live in the browser (Web Audio, no files). "nature" and "music" beds come from
// ElevenLabs (catalog loops or generated) and load as looping audio files;
// options without an asset yet are marked `soon`. `drone`/`pink`/`white` remain
// in the type for the engine even though they are not currently surfaced.
type Soundscape =
  | "silence"
  | "rain"
  | "ocean"
  | "wind"
  | "thunder"
  | "windchimes"
  | "pad"
  | "piano"
  | "lofi"
  | "bowls"
  | "harp"
  | "brown"
  | "pad432"
  | "binaural"
  | "delta"
  | "theta"
  | "drone"
  | "pink"
  | "white";
type SoundCat = "nature" | "music" | "frequencies";

const SOUND_CATS: { id: SoundCat; label: string }[] = [
  { id: "nature", label: "Nature" },
  { id: "music", label: "Music" },
  { id: "frequencies", label: "Frequencies" },
];

interface SoundDef {
  id: Soundscape;
  label: string;
  cat: SoundCat;
  src?: string; // looping audio file (ElevenLabs); absent => synthesized
  soon?: boolean; // asset not added yet; shown but disabled
  // Measured loudness of the file (dBFS): integrated RMS and true peak. Used to
  // normalize every bed to the same perceived level without clipping.
  rms?: number;
  peak?: number;
  // Per-bed perceptual trim (dB), same idea as the voices: equal RMS is not
  // equal loudness. A bright / hissy bed (broadband HF, e.g. ocean) reads louder
  // than its RMS, so a negative trim pulls it down; a dull / low-frequency bed
  // reads quieter and can take a positive trim. Tune from measured LUFS.
  trim?: number;
}
// `trim` is the per-bed perceptual correction (dB) from a measured LUFS pass
// (ITU-R BS.1770, K-weighted — see scripts/measure-beds.mjs). Each bed's trim
// shifts its RMS target so that, after normalization, they all land at equal
// PERCEIVED loudness rather than equal RMS: bright/hissy beds sit a touch lower,
// dull/low beds a touch higher. Ocean measured near parity, but its wave-crash /
// hiss character reads aggressive, so it's kept deliberately below parity.
const SOUNDSCAPES: SoundDef[] = [
  // Nature — ElevenLabs recordings (looping).
  { id: "rain", label: "Rain", cat: "nature", src: "/sounds/Rain.mp3", rms: -42.5, peak: -14.4, trim: -3 },
  { id: "ocean", label: "Ocean Waves", cat: "nature", src: "/sounds/Ocean.mp3", rms: -25.1, peak: -5.3, trim: -4 },
  { id: "wind", label: "Wind", cat: "nature", src: "/sounds/Wind.mp3", rms: -43.4, peak: -24.0, trim: -1.5 },
  { id: "thunder", label: "Thunderstorm", cat: "nature", src: "/sounds/Thunderstorm.mp3", rms: -37.9, peak: -14.5, trim: -0.5 },
  { id: "windchimes", label: "Windchimes", cat: "nature", src: "/sounds/WindChimes.mp3", rms: -32.4, peak: -16.5 },
  // Music — ElevenLabs recordings.
  { id: "pad", label: "Ambient", cat: "music", src: "/sounds/Ambient.mp3", rms: -21.7, peak: -10.4, trim: 2 },
  { id: "piano", label: "Piano", cat: "music", src: "/sounds/Piano.mp3", rms: -36.2, peak: -13.1, trim: -1 },
  { id: "lofi", label: "LoFi", cat: "music", src: "/sounds/LoFi.mp3", rms: -16.1, peak: -0.1, trim: 1 },
  { id: "bowls", label: "Singing Bowls", cat: "music", src: "/sounds/Singing-Bowl.mp3", rms: -14.6, peak: -0.4 },
  { id: "harp", label: "Harp", cat: "music", src: "/sounds/Harp.mp3", rms: -17.4, peak: -0.4, trim: -0.5 },
  // Frequencies — all ElevenLabs recordings now.
  { id: "brown", label: "Brown Noise", cat: "frequencies", src: "/sounds/BrownNoise.mp3", rms: -37.0, peak: -18.8 },
  { id: "pad432", label: "432 Hz", cat: "frequencies", src: "/sounds/432Hz.mp3", rms: -16.8, peak: -2.4 },
  { id: "binaural", label: "Binaural", cat: "frequencies", src: "/sounds/Binaural.mp3", rms: -15.9, peak: -2.7, trim: 1.5 },
  { id: "delta", label: "Delta", cat: "frequencies", src: "/sounds/Delta.mp3", rms: -12.7, peak: -0.2, trim: 2 },
  { id: "theta", label: "Theta", cat: "frequencies", src: "/sounds/Theta.mp3", rms: -17.2, peak: -2.8, trim: 2 },
];

// Loudness normalization. Bring every bed to a common target and every voice to
// a common target, both capped so peaks never exceed the ceiling (no clipping).
// Measured RMS/peak in dBFS; all tunable by ear from here.
const VOICE_TARGET = -24; // where all voices land
const BED_UNDER_VOICE = -33; // beds sit ~9 dB below the voice (~10% louder than -34)
const BED_SOLO = -19; // louder for a no-voice, sounds-only session (~10% up)
const PEAK_CEIL = -1.5; // never let a peak go above this

// Measured over 28 lines per voice. `trim` is a small perceptual adjustment on
// top of RMS matching, because equal RMS is not equal loudness:
//  - A compressed / dense voice sounds louder than its RMS suggests, so we aim
//    it a little lower (negative trim). female-uk has the lowest crest factor,
//    so she reads loudest at equal RMS and needs the most trim.
//  - A lower-pitched voice carries more low-frequency energy, which the ear
//    hears as quieter at the same measured level (equal-loudness contours), so
//    the male voices sound softer than the women even when matched by RMS. We
//    give them a positive trim to aim a couple dB hotter — capped by the peak
//    ceiling in normGain, so no clipping.
const VOICE_STATS: Record<
  string,
  { rms: number; peak: number; trim?: number }
> = {
  "female-us": { rms: -18.5, peak: -1.6 },
  "male-us": { rms: -25.1, peak: -5.1, trim: 2.5 },
  "female-uk": { rms: -14.8, peak: -1.3, trim: -3.5 },
  "male-uk": { rms: -24.5, peak: -4.3, trim: 2.5 },
};

// Tray-audition gains for the voice PREVIEW clips (previewVoice). These are
// separate recordings from the session voice and were played at a flat gain, so
// the male clips read far quieter than the female ones. Measured by LUFS
// (scripts/measure-beds.mjs) and matched to a common audition loudness, capped
// so peaks stay under -1 dBFS. male-uk is peak-limited so it lands ~2 dB shy of
// the rest, but that's far closer than the ~12 dB raw gap.
const PREVIEW_GAIN: Record<string, number> = {
  "female-us": 1.19,
  "female-uk": 0.65,
  "male-us": 1.95,
  "male-uk": 2.04,
};

// Linear gain to move a signal (rms/peak dBFS) toward a target loudness, capped
// so the peak stays under the ceiling.
function normGain(rms: number, peak: number, targetRms: number): number {
  const db = Math.min(targetRms - rms, PEAK_CEIL - peak);
  return Math.pow(10, db / 20);
}
function catOf(id: Soundscape): SoundCat {
  return SOUNDSCAPES.find((s) => s.id === id)?.cat ?? "nature";
}
function soundDef(id: Soundscape): SoundDef | undefined {
  return SOUNDSCAPES.find((s) => s.id === id);
}

// The calm nature bed that sits underneath a first-time tray (Nature tab, nothing
// preselected) so Begin still works if the user never picks a soundscape.
const FIRST_TIME_SOUND: Soundscape = "rain";

type Accent = "us" | "uk";

// The normalized voice gain and the bed's file + level for a given selection,
// shared by every playback path so loudness can't drift between them. `solo`
// (no voice) plays the bed louder; otherwise it sits under the voice.
function bedAndVoice(voice: VoiceChoice, accent: Accent, soundscape: Soundscape) {
  const vs = VOICE_STATS[`${voice}-${accent}`];
  const voiceGain = vs ? normGain(vs.rms, vs.peak, VOICE_TARGET + (vs.trim ?? 0)) : 1;
  const def = soundDef(soundscape);
  const src = def && !def.soon ? asset(def.src) : undefined;
  let level: number | undefined;
  if (src && def?.rms != null && def?.peak != null) {
    const target = voice === "none" ? BED_SOLO : BED_UNDER_VOICE;
    level = normGain(def.rms, def.peak, target + (def.trim ?? 0));
  } else if (src) {
    level = voice === "none" ? 0.85 : 0.4;
  }
  return { voiceGain, src, level };
}

interface Prefs {
  name: string;
  voice: VoiceChoice;
  accent: Accent;
  soundscape: Soundscape;
}
const PREFS_KEY = "elevenmind.prefs.v1";

// Constant, exact playback speed for voiced segments (Web Audio is clock-locked).
const VOICE_RATE = 1.0;

// Minimum time to hold the "composing your session" screen. The cache makes a
// session ready almost instantly; this brief, deliberate pause makes it feel
// personally composed rather than pulled off a shelf.
const MIN_GENERATING_MS = 8500;

// Timeline cursor carried through streamInto, so a second batch of lines (the
// Custom body, after the arrival) chains straight onto the first.
interface StreamState {
  started: boolean;
  cursor: number;
  lastSrc: AudioBufferSourceNode | null;
}

// ---------------------------------------------------------------------------
// One audio engine for the whole session. Both the synthesized soundscape and
// the spoken voice play through a single Web Audio context, so on mobile they
// coexist, ignore the iOS silent switch, and play at the correct speed. The
// context is unlocked inside the Begin tap to satisfy mobile autoplay rules.
// ---------------------------------------------------------------------------
class AudioEngine {
  ctx: AudioContext | null = null;
  ambientMaster: GainNode | null = null;
  // A gain node downstream of the master that the bed passes through, used only
  // for voice ducking: it dips the whole bed a few dB while the guide speaks and
  // swells it back up in the long meditative pauses. Kept separate from the
  // master so it never fights the master's fade-in bloom or the closing fade.
  private ambientDuck: GainNode | null = null;
  // The bed level the duck envelope is holding just before the next attack, so
  // each line's ramp starts from a known anchor (avoids clicks / long ramps).
  private duckHold = 1;
  // Scene-based audio (Phase 1): a gain downstream of the master carries the
  // per-progress bed intensity envelope, and the current session's voice bus is
  // kept so its gain can be rolled as the voice thins out (e.g. toward sleep).
  private ambientScene: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private profile: AudioProfile | null = null;
  private sessionTotalSec = 0;
  ambientNodes: AudioNode[] = [];
  voiceSegs: AudioBufferSourceNode[] = [];
  voiceGainValue = 1; // per-voice loudness normalization, set before playSegments
  onVoiceEnded: (() => void) | null = null;
  // Karaoke sync: the AudioContext time the voice began, and each line's start
  // offset (seconds) from that. Lets the transcript follow along with the voice.
  playStartTime = 0;
  lineStarts: number[] = [];
  // Short audition clips (voice greetings, soundscape beds) played while the
  // user is choosing in the tray. Independent of the session buses so a preview
  // can be started/stopped freely; decoded buffers are cached per source.
  private previewSource: AudioBufferSourceNode | null = null;
  private previewGain: GainNode | null = null;
  private previewToken = 0;
  private previewCache = new Map<string, AudioBuffer>();

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctx();
    }
    return this.ctx;
  }

  // By default iOS treats Web Audio as "ambient", which obeys the hardware mute
  // switch, so a silenced phone plays nothing. Declaring the audio as "playback"
  // (iOS 16.4+) makes it ignore the mute switch, like a music or podcast app.
  // No-op where unsupported. Call from any gesture that starts sound (Begin, or
  // a tray preview tap).
  private setPlaybackCategory() {
    try {
      const nav = navigator as unknown as { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = "playback";
    } catch {
      /* unsupported; nothing to do */
    }
  }

  // Call synchronously inside a user gesture (the Begin tap) to unlock audio.
  unlock() {
    this.setPlaybackCategory();
    const ctx = this.ensureCtx();
    ctx.resume().catch(() => {});
    try {
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch {
      /* ignore */
    }
  }

  private decode(ctx: AudioContext, arr: ArrayBuffer): Promise<AudioBuffer> {
    return new Promise<AudioBuffer>((resolve, reject) => {
      // Modern browsers return a Promise; older Safari uses callbacks.
      const ret = ctx.decodeAudioData(arr, resolve, reject);
      if (ret && typeof (ret as Promise<AudioBuffer>).then === "function") {
        (ret as Promise<AudioBuffer>).then(resolve, reject);
      }
    });
  }

  // Play the spoken session as a sequence of segments, each followed by a real
  // silence, all scheduled on the AudioContext's own clock. The pauses are held
  // here on the client (ElevenLabs can't render long silences reliably), so a
  // session lasts its full duration instead of the voice finishing early.
  async playSegments(
    segments: { audio: string | null; pauseAfter: number }[]
  ) {
    if (!segments?.length) return;
    const ctx = this.ensureCtx();
    await ctx.resume().catch(() => {});

    const decoded = await Promise.all(
      segments.map(async (s) => {
        if (!s.audio) return { buffer: null, pauseAfter: s.pauseAfter };
        try {
          const arr = await (await fetch(s.audio)).arrayBuffer();
          return {
            buffer: await this.decode(ctx, arr),
            pauseAfter: s.pauseAfter,
          };
        } catch {
          return { buffer: null, pauseAfter: s.pauseAfter };
        }
      })
    );

    if (!this.ctx) return; // ended while decoding

    // Per-voice normalization: all segments run through one gain node so every
    // voice lands at the same loudness.
    const voiceBus = ctx.createGain();
    voiceBus.gain.value = this.voiceGainValue;
    voiceBus.connect(ctx.destination);
    this.ambientNodes.push(voiceBus);
    this.voiceBus = voiceBus;

    this.playStartTime = ctx.currentTime + 0.15;
    this.lineStarts = [];
    let t = this.playStartTime;
    let lastSrc: AudioBufferSourceNode | null = null;
    for (const d of decoded) {
      // Each line's start offset, whether or not it has audio (so the read-along
      // still follows along in preview / read-along mode).
      this.lineStarts.push(t - this.playStartTime);
      this.applyEnvelope(t);
      if (d.buffer) {
        try {
          const src = ctx.createBufferSource();
          src.buffer = d.buffer;
          src.playbackRate.value = VOICE_RATE;
          src.connect(voiceBus);
          src.start(t);
          this.voiceSegs.push(src);
          lastSrc = src;
          const dur = d.buffer.duration / VOICE_RATE;
          this.duckForLine(t, dur, d.pauseAfter);
          t += dur;
        } catch {
          return;
        }
      }
      t += d.pauseAfter;
    }
    if (lastSrc) lastSrc.onended = () => this.onVoiceEnded?.();
  }

  // Instant-start Custom: the personalized body isn't written yet when the user
  // taps Begin, so we open with a short, fixed arrival (spoken through the same
  // TTS path) the moment playback starts, then stream the body lines in behind
  // it once Claude returns them. The bed + breathing (started by the caller) are
  // already running, so there's no wait — the guide simply joins a beat later.
  // Timeline, transcript sync and completion continue seamlessly across the two
  // phases because both write into the same lineStarts / cursor state.
  async playCustomStream(
    arrival: { text: string; pauseAfter: number }[],
    bodyPromise: Promise<{ text: string; pauseAfter: number }[]>,
    fetchAudio: (text: string) => Promise<ArrayBuffer | null>,
    onBody?: (body: { text: string; pauseAfter: number }[]) => void
  ) {
    const ctx = this.ensureCtx();
    await ctx.resume().catch(() => {});
    const voiceBus = this.makeVoiceBus(ctx);
    this.lineStarts = [];
    const state: StreamState = {
      started: false,
      cursor: ctx.currentTime + 0.2,
      lastSrc: null,
    };

    // Phase A — the arrival, playing right away.
    if (arrival.length) {
      await this.streamInto(ctx, voiceBus, arrival, fetchAudio, state);
    }
    if (this.ctx !== ctx) return; // ended during the arrival

    // Phase B — the personalized body, once it's written.
    let body: { text: string; pauseAfter: number }[] = [];
    try {
      body = await bodyPromise;
    } catch {
      body = [];
    }
    if (this.ctx !== ctx) return; // ended while waiting on the script
    onBody?.(body);
    if (body.length) {
      await this.streamInto(ctx, voiceBus, body, fetchAudio, state);
      // Only fade out at the true end of the guided body. If the body never
      // arrived, we leave the bed running so it degrades to a sounds-only
      // session rather than fading to silence after the arrival.
      if (this.ctx === ctx && state.lastSrc) {
        state.lastSrc.onended = () => this.onVoiceEnded?.();
      }
    }
  }

  private makeVoiceBus(ctx: AudioContext): GainNode {
    const voiceBus = ctx.createGain();
    voiceBus.gain.value = this.voiceGainValue;
    voiceBus.connect(ctx.destination);
    this.ambientNodes.push(voiceBus);
    this.voiceBus = voiceBus;
    return voiceBus;
  }

  // Scene-based audio (Phase 1): the per-context envelope + the session length,
  // set once per session (after startAmbient) so applyEnvelope can shape the bed
  // and voice as the session progresses. Null profile = no envelope (flat).
  setSession(profile: AudioProfile | null, totalSec: number) {
    this.profile = profile;
    this.sessionTotalSec = Math.max(0, totalSec);
  }

  // Roll the bed intensity and voice presence toward the envelope's values for
  // this point in the session, anchored to a line's start time. Called as each
  // line is scheduled, so a Sleep session's voice thins out over the second half
  // while the bed stays present, and every session softens gently at the close.
  private applyEnvelope(at: number) {
    if (!this.profile || !this.sessionTotalSec || !this.ctx) return;
    const p = Math.max(0, Math.min(1, (at - this.playStartTime) / this.sessionTotalSec));
    const anchor = Math.max(this.ctx.currentTime, at - 0.05);
    if (this.voiceBus) {
      const g = this.voiceBus.gain;
      g.cancelScheduledValues(anchor);
      g.setValueAtTime(g.value, anchor);
      g.linearRampToValueAtTime(this.voiceGainValue * this.profile.voice(p), at + 0.25);
    }
    if (this.ambientScene) {
      const g = this.ambientScene.gain;
      g.cancelScheduledValues(anchor);
      g.setValueAtTime(g.value, anchor);
      g.linearRampToValueAtTime(this.profile.bed(p), at + 2);
    }
  }

  // Core streaming loop for playCustomStream: synthesize a batch of lines with a
  // small worker pool, then schedule them in order as each decodes, chaining the
  // timeline from `state.cursor`. Appending a second batch (the body, after the
  // arrival) is just another call with the same state.
  private async streamInto(
    ctx: AudioContext,
    voiceBus: GainNode,
    segments: { text: string; pauseAfter: number }[],
    fetchAudio: (text: string) => Promise<ArrayBuffer | null>,
    state: StreamState
  ) {
    // One promise per line, resolved by the fetch/decode workers below.
    const settle: Array<(b: AudioBuffer | null) => void> = [];
    const ready: Promise<AudioBuffer | null>[] = segments.map(
      (_, i) => new Promise((res) => (settle[i] = res))
    );
    let next = 0;
    const worker = async () => {
      for (;;) {
        const i = next++;
        if (i >= segments.length) return;
        let buf: AudioBuffer | null = null;
        try {
          const arr = await fetchAudio(segments[i].text);
          if (arr && this.ctx === ctx) buf = await this.decode(ctx, arr);
        } catch {
          buf = null;
        }
        settle[i](buf);
      }
    };
    const CONCURRENCY = 3;
    for (let k = 0; k < Math.min(CONCURRENCY, segments.length); k++) worker();

    for (let i = 0; i < segments.length; i++) {
      const buf = await ready[i];
      if (this.ctx !== ctx) return; // stopped while waiting
      const now = ctx.currentTime;
      const startAt = Math.max(state.cursor, now + 0.05);
      if (!state.started) {
        this.playStartTime = startAt;
        state.started = true;
      }
      this.lineStarts.push(startAt - this.playStartTime);
      this.applyEnvelope(startAt);
      let dur = 0;
      if (buf) {
        try {
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.playbackRate.value = VOICE_RATE;
          src.connect(voiceBus);
          src.start(startAt);
          this.voiceSegs.push(src);
          state.lastSrc = src;
          dur = buf.duration / VOICE_RATE;
          this.duckForLine(startAt, dur, segments[i].pauseAfter);
        } catch {
          return;
        }
      }
      state.cursor = startAt + dur + segments[i].pauseAfter;
    }
  }

  // Which line is being spoken right now (or just spoken, during its pause).
  // -1 before the first line. Pause-aware: a suspended context freezes its
  // clock, so this holds while paused.
  activeLineIndex(): number {
    if (!this.ctx || !this.lineStarts.length) return -1;
    const off = this.ctx.currentTime - this.playStartTime;
    let idx = -1;
    for (let i = 0; i < this.lineStarts.length; i++) {
      if (this.lineStarts[i] <= off) idx = i;
      else break;
    }
    return idx;
  }

  startAmbient(kind: Soundscape, src?: string, level?: number) {
    this.stopAmbient();
    if (kind === "silence") return;
    const ctx = this.ensureCtx();
    const master = ctx.createGain();
    master.gain.value = 0;
    // bed sources -> master (level + fades) -> scene (intensity envelope) ->
    // duck (voice ducking) -> out. Scene is separate from the master so the
    // per-progress intensity arc never fights the arrival bloom or closing fade.
    const scene = ctx.createGain();
    scene.gain.value = this.profile ? this.profile.bed(0) : 1;
    const duck = ctx.createGain();
    duck.gain.value = 1;
    this.duckHold = 1;
    master.connect(scene);
    scene.connect(duck);
    duck.connect(ctx.destination);
    this.ambientMaster = master;
    this.ambientScene = scene;
    this.ambientDuck = duck;
    this.ambientNodes.push(scene, duck);

    // A hosted looping bed (ElevenLabs nature/music track).
    if (src) {
      this.startFile(ctx, src, master);
      this.bloomMaster(master, ctx, level ?? 0.4);
      return;
    }

    // Background ceilings: noise beds sit around a third of the voice; sustained
    // tones and binaural beats run quieter still (they fatigue faster).
    let target = 0.3;
    const push = (...n: AudioNode[]) => this.ambientNodes.push(...n);

    // A looping noise source, optionally shaped by a filter with a slow swell.
    const noiseBed = (
      source: AudioBufferSourceNode,
      filterType: BiquadFilterType | null,
      freq: number,
      swell?: { rate: number; depth: number }
    ) => {
      if (filterType) {
        const f = ctx.createBiquadFilter();
        f.type = filterType;
        f.frequency.value = freq;
        source.connect(f).connect(master);
        push(source, f);
        if (swell) {
          const lfo = ctx.createOscillator();
          lfo.frequency.value = swell.rate;
          const lg = ctx.createGain();
          lg.gain.value = swell.depth;
          lfo.connect(lg).connect(f.frequency);
          lfo.start();
          push(lfo, lg);
        }
      } else {
        source.connect(master);
        push(source);
      }
    };

    // A soft chord of sine partials (drone / pad / 432 Hz).
    const tones = (freqs: number[], gains: number[], level: number) => {
      target = level;
      freqs.forEach((fr, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = fr;
        const gain = ctx.createGain();
        gain.gain.value = gains[i] ?? 0.25;
        osc.connect(gain).connect(master);
        osc.start();
        push(osc, gain);
      });
    };

    // Two carriers a few Hz apart, panned hard left/right: the ear hears the
    // difference as a beat. Needs headphones to work as intended.
    const binaural = (beat: number, carrier: number) => {
      target = 0.16;
      const side = (freq: number, pan: number) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.value = 0.5;
        osc.connect(gain);
        let out: AudioNode = gain;
        if (typeof ctx.createStereoPanner === "function") {
          const p = ctx.createStereoPanner();
          p.pan.value = pan;
          gain.connect(p);
          out = p;
          push(p);
        }
        out.connect(master);
        osc.start();
        push(osc, gain);
      };
      side(carrier, -1);
      side(carrier + beat, 1);
    };

    switch (kind) {
      case "rain":
        noiseBed(this.brownNoise(ctx), "lowpass", 1600);
        break;
      case "ocean":
        noiseBed(this.brownNoise(ctx), "lowpass", 520, { rate: 0.08, depth: 340 });
        break;
      case "wind":
        target = 0.26;
        noiseBed(this.brownNoise(ctx), "bandpass", 500, { rate: 0.05, depth: 320 });
        break;
      case "brown":
        noiseBed(this.brownNoise(ctx), null, 0);
        break;
      case "pink":
        noiseBed(this.pinkNoise(ctx), null, 0);
        break;
      case "white":
        noiseBed(this.whiteNoise(ctx), "lowpass", 8000);
        break;
      case "drone":
        tones([110, 164.81, 220], [0.5, 0.22, 0.22], 0.12);
        break;
      case "pad432":
        tones([216, 432, 648], [0.5, 0.28, 0.16], 0.11);
        break;
      case "pad":
        tones([130.81, 164.81, 196.0], [0.4, 0.3, 0.3], 0.12);
        break;
      case "binaural":
        binaural(10, 200);
        break;
      case "delta":
        binaural(3.2, 100);
        break;
      case "theta":
        binaural(6, 200);
        break;
    }

    this.bloomMaster(master, ctx, level ?? target);
  }

  // Bed intensity arc: come in present but sparse over a few seconds (the
  // arrival), then keep blooming to full richness over the next half-minute, so
  // the space fills in gently rather than snapping to full the instant it opens.
  private bloomMaster(master: GainNode, ctx: AudioContext, level: number) {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(0, t);
    master.gain.linearRampToValueAtTime(level * 0.82, t + 3);
    master.gain.linearRampToValueAtTime(level, t + 30);
  }

  // Voice ducking: dip the bed while a line is spoken and, when the pause after
  // it is long enough to be worth it, swell it back up so the silence breathes.
  // Ramps chain from duckHold (the level held before this line) so there are no
  // clicks and short pauses simply stay ducked instead of pumping.
  private duckForLine(startAt: number, dur: number, pauseAfter: number) {
    const duck = this.ambientDuck;
    if (!duck) return;
    const DUCK = 0.55; // bed sits ~5 dB down under the voice
    const ATTACK = 0.3; // how quickly it dips as a line begins
    const UNDUCK_MIN = 2; // only recover in pauses at least this long
    const g = duck.gain;
    // Never anchor in the past: when synthesis lags, startAt is ~now, so clamp
    // the attack to now (the dip just happens a touch quicker) instead of
    // scheduling a setValueAtTime behind the clock.
    const now = this.ctx ? this.ctx.currentTime : startAt;
    const attackStart = Math.max(startAt - ATTACK, this.playStartTime, now);
    g.setValueAtTime(this.duckHold, attackStart);
    g.linearRampToValueAtTime(DUCK, Math.max(startAt, attackStart + 0.01));
    this.duckHold = DUCK;
    const lineEnd = startAt + dur;
    if (pauseAfter >= UNDUCK_MIN) {
      const recStart = lineEnd + 0.25;
      const recEnd = lineEnd + pauseAfter - 0.4;
      if (recEnd > recStart) {
        g.setValueAtTime(DUCK, recStart);
        g.linearRampToValueAtTime(1, recEnd);
        this.duckHold = 1;
      }
    }
  }

  // A soft singing-bowl bell, synthesized (no asset): a warm fundamental with a
  // couple of quiet partials and a long exponential tail. Used as a gentle
  // start and end cue. Nodes are tracked so stop() silences a ringing tail.
  playBell(opts?: { gain?: number; f0?: number; decay?: number; when?: number }) {
    const ctx = this.ensureCtx();
    const t0 = ctx.currentTime + (opts?.when ?? 0);
    const gain = opts?.gain ?? 0.07;
    const f0 = opts?.f0 ?? 396;
    const decay = opts?.decay ?? 5;
    const partials: [number, number][] = [
      [1, 1],
      [2.01, 0.42],
      [2.77, 0.16],
    ];
    for (const [ratio, rel] of partials) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f0 * ratio;
      const ge = ctx.createGain();
      ge.gain.setValueAtTime(0.0001, t0);
      ge.gain.linearRampToValueAtTime(gain * rel, t0 + 0.02);
      ge.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
      osc.connect(ge).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + decay + 0.1);
      this.ambientNodes.push(osc, ge);
    }
  }

  suspend() {
    this.ctx?.suspend().catch(() => {});
  }
  resume() {
    this.ctx?.resume().catch(() => {});
  }

  fadeOutAmbient(seconds = 6) {
    if (this.ctx && this.ambientMaster) {
      const now = this.ctx.currentTime;
      this.ambientMaster.gain.cancelScheduledValues(now);
      this.ambientMaster.gain.setValueAtTime(this.ambientMaster.gain.value, now);
      this.ambientMaster.gain.linearRampToValueAtTime(0, now + seconds);
    }
  }

  private stopAmbient() {
    this.ambientNodes.forEach((n) => {
      try {
        if ("stop" in n && typeof (n as OscillatorNode).stop === "function") {
          (n as OscillatorNode).stop();
        }
        n.disconnect();
      } catch {
        /* already stopped */
      }
    });
    this.ambientNodes = [];
    this.ambientMaster = null;
    this.ambientScene = null;
    this.ambientDuck = null;
    this.voiceBus = null;
    this.profile = null;
    this.sessionTotalSec = 0;
    this.duckHold = 1;
  }

  // Audition a clip while choosing (a voice greeting, or a taste of a bed).
  // seconds caps the length (beds); omit to play a whole clip (voice). Called
  // from a tap, so the context unlocks. Any prior preview is faded out first.
  async preview(
    src: string,
    opts?: { seconds?: number; gain?: number; offset?: number }
  ) {
    // Fade out any current preview first (this bumps the token counter), THEN
    // claim our token — otherwise stopPreview would invalidate our own token
    // and the guard below would bail before playback.
    this.stopPreview();
    this.setPlaybackCategory();
    const ctx = this.ensureCtx();
    await ctx.resume().catch(() => {});
    const token = ++this.previewToken;
    let buf = this.previewCache.get(src);
    if (!buf) {
      try {
        const arr = await (await fetch(src)).arrayBuffer();
        buf = await this.decode(ctx, arr);
        this.previewCache.set(src, buf);
      } catch {
        return; // clip missing/undecodable (e.g. not generated yet) — stay quiet
      }
    }
    // Superseded by a newer tap, or the engine was torn down, while decoding.
    if (token !== this.previewToken || this.ctx !== ctx) return;

    const target = opts?.gain ?? 0.6;
    // Start a little way into the file: many beds ramp in from ~1-2s of near
    // silence, and an audition should be audible immediately, not after dead
    // air. Clamp so we never seek past the end.
    const offset = Math.min(Math.max(opts?.offset ?? 0, 0), Math.max(0, buf.duration - 1));
    const dur = Math.min(opts?.seconds ?? buf.duration, buf.duration - offset);
    // Near-instant onset so the audition registers the moment you tap (a hair
    // of fade avoids a click), with a gentle tail so it doesn't cut off harshly.
    const fadeIn = 0.02;
    const fadeOut = 0.4;
    const gain = ctx.createGain();
    const src2 = ctx.createBufferSource();
    src2.buffer = buf;
    src2.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    const end = now + Math.max(dur, fadeIn + fadeOut);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(target, now + fadeIn);
    gain.gain.setValueAtTime(target, Math.max(now + fadeIn, end - fadeOut));
    gain.gain.linearRampToValueAtTime(0, end);
    src2.start(now, offset);
    src2.stop(end + 0.05);
    src2.onended = () => {
      if (this.previewSource === src2) {
        this.previewSource = null;
        this.previewGain = null;
      }
      try {
        src2.disconnect();
        gain.disconnect();
      } catch {
        /* already gone */
      }
    };
    this.previewSource = src2;
    this.previewGain = gain;
  }

  stopPreview() {
    this.previewToken++; // supersede any decode still in flight
    const s = this.previewSource;
    const g = this.previewGain;
    this.previewSource = null;
    this.previewGain = null;
    if (this.ctx && g) {
      const now = this.ctx.currentTime;
      try {
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(0, now + 0.1);
      } catch {
        /* ignore */
      }
    }
    if (s) {
      try {
        s.onended = null;
        s.stop((this.ctx?.currentTime ?? 0) + 0.12);
      } catch {
        /* already stopped/ended */
      }
      const dead = { s, g };
      setTimeout(() => {
        try {
          dead.s.disconnect();
          dead.g?.disconnect();
        } catch {
          /* already gone */
        }
      }, 200);
    }
  }

  stop() {
    this.voiceSegs.forEach((s) => {
      try {
        s.onended = null;
        s.stop();
      } catch {
        /* already stopped or not yet started */
      }
    });
    this.voiceSegs = [];
    this.lineStarts = [];
    this.stopAmbient();
    this.stopPreview();
    // Decoded buffers are bound to this context; drop them so a fresh context
    // re-decodes rather than reusing buffers from a closed context.
    this.previewCache.clear();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  private brownNoise(ctx: AudioContext): AudioBufferSourceNode {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start();
    return src;
  }

  // Load a looping audio file (an ElevenLabs bed) into the ambient bus. The file
  // itself should be a seamless ~60s loop. Async; if it fails, the session (and
  // breathing visual) continue in silence.
  private async startFile(ctx: AudioContext, src: string, master: GainNode) {
    try {
      const arr = await (await fetch(src)).arrayBuffer();
      const buf = await this.decode(ctx, arr);
      if (this.ambientMaster !== master) return; // changed or stopped meanwhile
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.connect(master);
      s.start();
      this.ambientNodes.push(s);
    } catch {
      /* file missing/undecodable; carry on quietly */
    }
  }

  private whiteNoise(ctx: AudioContext): AudioBufferSourceNode {
    const size = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start();
    return src;
  }

  // Pink noise (equal energy per octave) via the Paul Kellet approximation.
  private pinkNoise(ctx: AudioContext): AudioBufferSourceNode {
    const size = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < size; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start();
    return src;
  }
}

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

function greetingFor(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// The breathing cycle, shared by the orb and the on-screen cue so they can never
// drift: 6s inhale, a 2.5s hold at the top, 6s exhale (a 14.5s cycle).
const BREATH_IN = 6;
const BREATH_HOLD = 2.5;
const BREATH_OUT = 6;
const BREATH_CYCLE = BREATH_IN + BREATH_HOLD + BREATH_OUT;

function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

// The one-tap post-session reflection. Warm, low-pressure, all positive-or-
// neutral so it never feels like a grade.
const MOODS = ["much calmer", "a little calmer", "about the same"] as const;

// For a position t seconds into playback, the eased breath amount (0 = fully
// exhaled, 1 = fully inhaled / held at the top) and which phase we're in. The
// orb scales with `pb`; the cue words read from `phase` — one source of truth,
// so "Breathe in" always lands with the ring expanding.
function breathAt(t: number): { pb: number; phase: "in" | "hold" | "out" } {
  const c = ((t % BREATH_CYCLE) + BREATH_CYCLE) % BREATH_CYCLE;
  if (c < BREATH_IN) return { pb: easeInOut(c / BREATH_IN), phase: "in" };
  if (c < BREATH_IN + BREATH_HOLD) return { pb: 1, phase: "hold" };
  return {
    pb: easeInOut(1 - (c - BREATH_IN - BREATH_HOLD) / BREATH_OUT),
    phase: "out",
  };
}

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
    setRecent(loadRecent());
    setFavs(loadFavs());
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

  // Save the session that's starting to on-device history, so it can be replayed
  // later with one tap. Called from begin() for every kind of session.
  function rememberSession() {
    const phrase = customText.trim();
    const label = selected.custom
      ? phrase
        ? `“${phrase}”`
        : selected.label
      : selected.label;
    const soundBit = voice === "none" ? "sounds only" : soundLabel;
    setRecent(
      pushRecent({
        context,
        label,
        sub: `${duration} min · ${soundBit}`,
        duration,
        voice,
        accent,
        soundscape,
        customText: selected.custom ? phrase : undefined,
        at: Date.now(),
      })
    );
  }

  // One-tap replay: restore every choice from a past session and open the tray
  // pre-filled, ready to begin (or tweak). Works from the home or the history
  // page, so it returns to setup first before opening the tray.
  function replay(r: RecentSession) {
    ev("session_replay", { context: r.context, duration: r.duration });
    engineRef.current.stopPreview();
    setError(null);
    setContext(r.context as ContextId);
    setDuration(r.duration as Duration);
    setVoice(r.voice as VoiceChoice);
    setVoicePicked(true);
    setAccent(r.accent as Accent);
    setSoundscape(r.soundscape as Soundscape);
    setSoundPicked(true);
    setSoundTab(catOf(r.soundscape as Soundscape));
    setCustomText(r.customText ?? "");
    setScreen("setup");
    setTrayOpen(true);
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
    setScreen("setup");
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
          {IS_RELAXED && (
            <>
              <br />
              <span className="foot-links">
                <a href={`mailto:${BRAND.support}`}>Contact</a>
                <span className="dotsep">·</span>
                <a href="/privacy">Privacy</a>
              </span>
            </>
          )}
        </div>
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
function transcriptLines(s: string): string[] {
  if (!s) return [];
  return s.split("\n").map((l) => l.replace(/\s*—\s*/g, ", ").trim());
}
