"use client";

import { useEffect, useRef, useState } from "react";
import {
  CONTEXTS,
  DURATIONS,
  getContext,
  type ContextId,
  type Duration,
  type VoiceChoice,
} from "@/lib/contexts";
import { asset } from "@/lib/assets";
import GUIDES from "@/lib/voices.json";

// ElevenMind wordmark: the family bar glyph, then Eleven (700) + Mind (400).
function Wordmark() {
  return (
    <div className="wm" aria-label="ElevenMind">
      <span className="bars" aria-hidden="true">
        <i />
        <i />
      </span>
      <span className="name">
        <b>Eleven</b>
        <span>Mind</span>
      </span>
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
}
const SOUNDSCAPES: SoundDef[] = [
  // Nature — ElevenLabs recordings (looping).
  { id: "rain", label: "Rain", cat: "nature", src: "/sounds/Rain.mp3", rms: -42.5, peak: -14.4 },
  { id: "ocean", label: "Ocean Waves", cat: "nature", src: "/sounds/Ocean.mp3", rms: -25.1, peak: -5.3 },
  { id: "wind", label: "Wind", cat: "nature", src: "/sounds/Wind.mp3", rms: -43.4, peak: -24.0 },
  { id: "thunder", label: "Thunderstorm", cat: "nature", src: "/sounds/Thunderstorm.mp3", rms: -37.9, peak: -14.5 },
  { id: "windchimes", label: "Windchimes", cat: "nature", src: "/sounds/WindChimes.mp3", rms: -32.4, peak: -16.5 },
  // Music — ElevenLabs recordings.
  { id: "pad", label: "Ambient", cat: "music", src: "/sounds/Ambient.mp3", rms: -21.7, peak: -10.4 },
  { id: "piano", label: "Piano", cat: "music", src: "/sounds/Piano.mp3", rms: -36.2, peak: -13.1 },
  { id: "lofi", label: "LoFi", cat: "music", src: "/sounds/LoFi.mp3", rms: -16.1, peak: -0.1 },
  { id: "bowls", label: "Singing Bowls", cat: "music", src: "/sounds/Singing-Bowl.mp3", rms: -14.6, peak: -0.4 },
  { id: "harp", label: "Harp", cat: "music", src: "/sounds/Harp.mp3", rms: -17.4, peak: -0.4 },
  // Frequencies — all ElevenLabs recordings now.
  { id: "brown", label: "Brown Noise", cat: "frequencies", src: "/sounds/BrownNoise.mp3", rms: -37.0, peak: -18.8 },
  { id: "pad432", label: "432 Hz", cat: "frequencies", src: "/sounds/432Hz.mp3", rms: -16.8, peak: -2.4 },
  { id: "binaural", label: "Binaural", cat: "frequencies", src: "/sounds/Binaural.mp3", rms: -15.9, peak: -2.7 },
  { id: "delta", label: "Delta", cat: "frequencies", src: "/sounds/Delta.mp3", rms: -12.7, peak: -0.2 },
  { id: "theta", label: "Theta", cat: "frequencies", src: "/sounds/Theta.mp3", rms: -17.2, peak: -2.8 },
];

// Loudness normalization. Bring every bed to a common target and every voice to
// a common target, both capped so peaks never exceed the ceiling (no clipping).
// Measured RMS/peak in dBFS; all tunable by ear from here.
const VOICE_TARGET = -24; // where all voices land
const BED_UNDER_VOICE = -33; // beds sit ~9 dB below the voice (~10% louder than -34)
const BED_SOLO = -19; // louder for a no-voice, sounds-only session (~10% up)
const PEAK_CEIL = -1.5; // never let a peak go above this

// Measured over 28 lines per voice. `trim` is a small perceptual adjustment on
// top of RMS matching: a compressed / dense voice sounds louder than its RMS
// suggests, so we aim it a little lower. (female-uk has the lowest crest factor,
// so she reads loudest at equal RMS and needs the most trim.)
const VOICE_STATS: Record<
  string,
  { rms: number; peak: number; trim?: number }
> = {
  "female-us": { rms: -18.5, peak: -1.6 },
  "male-us": { rms: -25.1, peak: -5.1 },
  "female-uk": { rms: -14.8, peak: -1.3, trim: -3.5 },
  "male-uk": { rms: -24.5, peak: -4.3 },
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

type Accent = "us" | "uk";

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

// ---------------------------------------------------------------------------
// One audio engine for the whole session. Both the synthesized soundscape and
// the spoken voice play through a single Web Audio context, so on mobile they
// coexist, ignore the iOS silent switch, and play at the correct speed. The
// context is unlocked inside the Begin tap to satisfy mobile autoplay rules.
// ---------------------------------------------------------------------------
class AudioEngine {
  ctx: AudioContext | null = null;
  ambientMaster: GainNode | null = null;
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

  // Call synchronously inside a user gesture (the Begin tap) to unlock audio.
  unlock() {
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

    this.playStartTime = ctx.currentTime + 0.15;
    this.lineStarts = [];
    let t = this.playStartTime;
    let lastSrc: AudioBufferSourceNode | null = null;
    for (const d of decoded) {
      // Each line's start offset, whether or not it has audio (so the read-along
      // still follows along in preview / read-along mode).
      this.lineStarts.push(t - this.playStartTime);
      if (d.buffer) {
        try {
          const src = ctx.createBufferSource();
          src.buffer = d.buffer;
          src.playbackRate.value = VOICE_RATE;
          src.connect(voiceBus);
          src.start(t);
          this.voiceSegs.push(src);
          lastSrc = src;
          t += d.buffer.duration / VOICE_RATE;
        } catch {
          return;
        }
      }
      t += d.pauseAfter;
    }
    if (lastSrc) lastSrc.onended = () => this.onVoiceEnded?.();
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
    master.connect(ctx.destination);
    this.ambientMaster = master;

    // A hosted looping bed (ElevenLabs nature/music track).
    if (src) {
      this.startFile(ctx, src, master);
      master.gain.linearRampToValueAtTime(level ?? 0.4, ctx.currentTime + 3);
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

    master.gain.linearRampToValueAtTime(level ?? target, ctx.currentTime + 3);
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

type Screen = "setup" | "generating" | "player" | "complete";

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

export default function Home() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [name, setName] = useState("");
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

  const engineRef = useRef<AudioEngine>(new AudioEngine());
  const endTimerRef = useRef<number | null>(null);
  const completeTimerRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
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
      gain: 0.85,
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
        ? normGain(def.rms, def.peak, BED_SOLO)
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
        if (p.name) setName(p.name);
        if (p.voice) setVoice(p.voice);
        if (p.accent) setAccent(p.accent);
        if (p.soundscape) {
          setSoundscape(p.soundscape);
          setSoundTab(catOf(p.soundscape));
        }
        setSaveDefault(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

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

  // Karaoke: follow the spoken line on the player screen, synced to the audio
  // clock so it stays exact and pauses when the session pauses.
  useEffect(() => {
    if (screen !== "player") {
      setActiveLine(-1);
      return;
    }
    let raf = 0;
    const tick = () => {
      const idx = engineRef.current.activeLineIndex();
      setActiveLine((prev) => (prev === idx ? prev : idx));
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
    const top = el.offsetTop + el.clientHeight / 2 - c.clientHeight * 0.4;
    c.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [activeLine, showTranscript]);

  function startTick() {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      setElapsed((e) => (e < totalSecs ? e + 1 : e));
    }, 1000);
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

  function chooseIntention(id: ContextId) {
    setContext(id);
    setError(null);
    setVoicePicked(false); // open with no voice highlighted (preview on first tap)
    setSoundPicked(false); // ...and no soundscape highlighted either
    setSoundTab("nature"); // always open on the first category
    setTrayOpen(true);
  }

  async function begin() {
    // Unlock the audio engine within this tap so mobile browsers will let the
    // voice + soundscape play once ready. Stop any tray audition first.
    engineRef.current.stopPreview();
    engineRef.current.unlock();

    setError(null);
    persistPrefs();
    setElapsed(0);
    setShowTranscript(true);
    setTrayOpen(false);

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
      setGenStep(2);
      setScreen("player");
      startPlayback(Array.isArray(data.segments) ? data.segments : []);
    } catch (e) {
      window.clearTimeout(stepA);
      window.clearTimeout(stepB);
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setScreen("setup");
    }
  }

  function startPlayback(
    segments: { audio: string | null; pauseAfter: number }[]
  ) {
    const eng = engineRef.current;
    eng.onVoiceEnded = () => eng.fadeOutAmbient(8);

    // Normalize this voice to the common target so all four sound equally loud
    // (plus a small per-voice perceptual trim).
    const vs = VOICE_STATS[`${voice}-${accent}`];
    eng.voiceGainValue = vs
      ? normGain(vs.rms, vs.peak, VOICE_TARGET + (vs.trim ?? 0))
      : 1;

    // Normalize the bed to a common level: quiet under the voice, louder solo.
    const def = soundDef(soundscape);
    const src = def && !def.soon ? asset(def.src) : undefined;
    let level: number | undefined;
    if (src && def?.rms != null && def?.peak != null) {
      const target = voice === "none" ? BED_SOLO : BED_UNDER_VOICE;
      level = normGain(def.rms, def.peak, target);
    } else if (src) {
      level = voice === "none" ? 0.85 : 0.4;
    }
    eng.startAmbient(soundscape, src, level);
    eng.playSegments(segments);
    setPlaying(true);
    setElapsed(0);
    startTick();
    acquireWakeLock();

    if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    endTimerRef.current = window.setTimeout(completeSession, totalSecs * 1000);
  }

  // Reached the chosen duration: wind the sound down and, once it has faded a
  // little, ease into the closing screen (the audio keeps fading underneath).
  function completeSession() {
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
    if (playing) {
      engineRef.current.suspend();
      stopTick();
      setPlaying(false);
      releaseWakeLock();
    } else {
      engineRef.current.resume();
      startTick();
      setPlaying(true);
      acquireWakeLock();
    }
  }

  function end() {
    engineRef.current.stop();
    if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    if (completeTimerRef.current) window.clearTimeout(completeTimerRef.current);
    stopTick();
    releaseWakeLock();
    setPlaying(false);
    setElapsed(0);
    setScreen("setup");
  }

  // 6s in, a 2.5s hold at the top, 6s out (a 14.5s cycle).
  const breathPhase =
    elapsed % 14.5 < 6 ? "in" : elapsed % 14.5 < 8.5 ? "hold" : "out";
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
            <div className="disc" style={{ background: selected.art }} />
            <div className="halo" />
          </div>
          <div>
            <div className="gen-title">Composing your session</div>
            <div className="gen-detail">
              {(name.trim() || "You")} · {selected.label} · {duration} min ·{" "}
              {soundLabel}
            </div>
          </div>
          <div className="steps">
            {[
              <>Crafting your journey</>,
              <>
                Scoring your soundscape with <b>ElevenMusic</b>
              </>,
              <>
                Giving it voice with <b>ElevenLabs</b>
              </>,
            ].map((label, i) => (
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
          <div className="play-orb">
            <div
              className={`disc ${playing ? "breathe" : ""}`}
              style={
                {
                  background: selected.art,
                  "--pg": selected.glow,
                } as React.CSSProperties
              }
            />
            <div className="ring" />
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
                {
                  background: selected.art,
                  "--pg": selected.glow,
                } as React.CSSProperties
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
          <button
            className="done-btn"
            onClick={end}
            style={
              {
                "--cta-glow": selected.glow,
                "--cta-disc": selected.art,
              } as React.CSSProperties
            }
          >
            <span className="dot" />
            Done
          </button>
          <div className="done-credit">
            Voiced by <b>ElevenLabs</b> · scored with <b>ElevenMusic</b>
          </div>
        </div>
      </main>
    );
  } else {
    // ---- Setup: the night home ----
    content = (
      <main className="wrap">
        <div className="topbar">
          <Wordmark />
        </div>

        <div className="hero">
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
                    { background: c.art, "--og": c.glow } as React.CSSProperties
                  }
                />
                <span className="sname">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="footnote">
          Every session personalized for you.
          <br />
          <span className="credit">
            Voiced by <b>ElevenLabs</b> · scored with <b>ElevenMusic</b>
          </span>
          <br />
          Not medical or therapeutic advice.
        </div>
      </main>
    );
  }

  return (
    <>
      <div className="photo-sky" />
      <div className="photo-scrim" />
      <div
        className={`mood-glow ${moodOn ? "on" : ""}`}
        style={{ "--gc": selected.glow } as React.CSSProperties}
      />
      <div className="app">{content}</div>

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
                  {
                    background: selected.art,
                    "--og": selected.glow,
                  } as React.CSSProperties
                }
              />
              <div>
                <div className="tt">{selected.label}</div>
                <div className="ts">{selected.tagline}</div>
              </div>
            </div>

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
                <button
                  className={`chip ${
                    soundPicked && soundscape === "silence" ? "on" : ""
                  }`}
                  onClick={() => {
                    setSoundPicked(true);
                    setSoundscape("silence");
                    engineRef.current.stopPreview();
                  }}
                >
                  Off
                </button>
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
              style={
                {
                  "--cta-glow": selected.glow,
                  "--cta-disc": selected.art,
                } as React.CSSProperties
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
