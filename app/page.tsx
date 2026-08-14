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

type Soundscape = "silence" | "rain" | "ocean" | "drone";
const SOUNDSCAPES: { id: Soundscape; label: string }[] = [
  { id: "silence", label: "Off" },
  { id: "rain", label: "Rain" },
  { id: "ocean", label: "Ocean" },
  { id: "drone", label: "Drone" },
];

type Accent = "us" | "uk";

interface Prefs {
  name: string;
  voice: VoiceChoice;
  soundscape: Soundscape;
}
const PREFS_KEY = "elevenmind.prefs.v1";

// Constant, exact playback speed for voiced segments (Web Audio is clock-locked).
const VOICE_RATE = 1.0;
// The soundscape sits under the voice as background, not beside it.
const AMBIENT_LEVEL = { drone: 0.12, noise: 0.3 } as const;

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
  onVoiceEnded: (() => void) | null = null;

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

    let t = ctx.currentTime + 0.15;
    let lastSrc: AudioBufferSourceNode | null = null;
    for (const d of decoded) {
      if (d.buffer) {
        try {
          const src = ctx.createBufferSource();
          src.buffer = d.buffer;
          src.playbackRate.value = VOICE_RATE;
          src.connect(ctx.destination);
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

  startAmbient(kind: Soundscape) {
    this.stopAmbient();
    if (kind === "silence") return;
    const ctx = this.ensureCtx();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.ambientMaster = master;

    if (kind === "drone") {
      [110, 164.81, 220].forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = i === 0 ? 0.5 : 0.22;
        osc.connect(g).connect(master);
        osc.start();
        this.ambientNodes.push(osc, g);
      });
    } else {
      const noise = this.brownNoise(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = kind === "rain" ? 1600 : 520;
      noise.connect(filter).connect(master);
      this.ambientNodes.push(noise, filter);

      if (kind === "ocean") {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.08;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 340;
        lfo.connect(lfoGain).connect(filter.frequency);
        lfo.start();
        this.ambientNodes.push(lfo, lfoGain);
      }
    }

    const target = kind === "drone" ? AMBIENT_LEVEL.drone : AMBIENT_LEVEL.noise;
    master.gain.linearRampToValueAtTime(target, ctx.currentTime + 3);
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
    this.stopAmbient();
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
}

// ---------------------------------------------------------------------------
// The living night sky: a quiet starfield with a couple of Webb-style
// diffraction stars, and a slow aurora borealis drifting above. Fixed behind
// every screen so the whole app is one continuous world.
// ---------------------------------------------------------------------------
function SkyCanvas() {
  const starRef = useRef<HTMLCanvasElement>(null);
  const auroraRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const starCv = starRef.current;
    const auroraCv = auroraRef.current;
    if (!starCv || !auroraCv) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let W = 0;
    let H = 0;
    let raf = 0;

    function drawStars() {
      const cv = starCv!;
      W = window.innerWidth;
      H = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.width = W + "px";
      cv.style.height = H + "px";
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const base = ctx.createLinearGradient(0, 0, 0, H);
      base.addColorStop(0, "#05060f");
      base.addColorStop(0.6, "#080b16");
      base.addColorStop(1, "#0b0d1c");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, W, H);

      const count = Math.round((W * H) / 3400);
      for (let i = 0; i < count; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const r =
          Math.random() < 0.85
            ? Math.random() * 0.7 + 0.2
            : Math.random() * 1.1 + 0.7;
        ctx.globalAlpha = 0.2 + Math.random() * 0.5;
        ctx.fillStyle = Math.random() < 0.12 ? "#cfe0ff" : "#ffffff";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ([
        [0.2, 0.12, 13, "#cfe0ff"],
        [0.8, 0.18, 10, "#ffffff"],
      ] as [number, number, number, string][]).forEach(([hx, hy, len, col]) => {
        const x = hx * W;
        const y = hy * H;
        ctx.save();
        ctx.translate(x, y);
        ctx.globalCompositeOperation = "screen";
        const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, len * 0.8);
        cg.addColorStop(0, "rgba(255,255,255,0.9)");
        cg.addColorStop(0.4, col);
        cg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(0, 0, len * 0.8, 0, 6.283);
        ctx.fill();
        ([
          [0, 2.2],
          [Math.PI, 2.2],
          [Math.PI / 2, 0.8],
          [-Math.PI / 2, 0.8],
        ] as [number, number][]).forEach(([ang, sc]) => {
          const ex = Math.cos(ang - Math.PI / 2) * len * sc;
          const ey = Math.sin(ang - Math.PI / 2) * len * sc;
          const lg = ctx.createLinearGradient(0, 0, ex, ey);
          lg.addColorStop(0, "rgba(255,255,255,0.55)");
          lg.addColorStop(1, "rgba(255,255,255,0)");
          ctx.strokeStyle = lg;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        });
        ctx.restore();
      });
    }

    let auctx: CanvasRenderingContext2D | null = null;
    function sizeAurora() {
      const cv = auroraCv!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.width = W + "px";
      cv.style.height = H + "px";
      auctx = cv.getContext("2d");
      if (auctx) auctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const BANDS = [
      { yc: 0.16, amp: 0.03, freq: 1.6, sp: 0.06, phase: 0, top: "rgba(120,240,180,0.16)", mid: "rgba(80,210,190,0.10)", spread: 0.24 },
      { yc: 0.21, amp: 0.036, freq: 2.3, sp: 0.045, phase: 1.7, top: "rgba(150,255,200,0.13)", mid: "rgba(90,180,220,0.08)", spread: 0.22 },
      { yc: 0.27, amp: 0.034, freq: 1.9, sp: 0.05, phase: 3.1, top: "rgba(150,110,220,0.09)", mid: "rgba(120,90,200,0.05)", spread: 0.2 },
    ];
    function drawAurora(time: number) {
      if (!auctx) return;
      auctx.clearRect(0, 0, W, H);
      auctx.globalCompositeOperation = "lighter";
      const s = time / 1000;
      BANDS.forEach((b) => {
        const topY = b.yc * H;
        const botY = (b.yc + b.spread) * H;
        auctx!.beginPath();
        auctx!.moveTo(-4, botY);
        for (let x = -4; x <= W + 4; x += 7) {
          const u = x / W;
          const y =
            topY +
            Math.sin(u * b.freq * 6.283 + s * b.sp + b.phase) * b.amp * H +
            Math.sin(u * b.freq * 2.7 * 6.283 + s * b.sp * 1.7 + b.phase) *
              b.amp *
              0.35 *
              H;
          auctx!.lineTo(x, y);
        }
        auctx!.lineTo(W + 4, botY);
        auctx!.closePath();
        const g = auctx!.createLinearGradient(0, topY - 0.05 * H, 0, botY);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(0.16, b.top);
        g.addColorStop(0.5, b.mid);
        g.addColorStop(1, "rgba(0,0,0,0)");
        auctx!.fillStyle = g;
        auctx!.fill();
      });
      auctx.globalCompositeOperation = "source-over";
      if (!reduce) raf = requestAnimationFrame(drawAurora);
    }

    function rebuild() {
      drawStars();
      sizeAurora();
    }
    rebuild();
    raf = requestAnimationFrame(drawAurora);

    let rz: number | undefined;
    function onResize() {
      window.clearTimeout(rz);
      rz = window.setTimeout(rebuild, 150);
    }
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(rz);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <>
      <canvas className="sky" ref={starRef} aria-hidden="true" />
      <canvas className="sky" ref={auroraRef} aria-hidden="true" />
    </>
  );
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

type Screen = "setup" | "generating" | "player";

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
  const [soundscape, setSoundscape] = useState<Soundscape>("rain");
  const [saveDefault, setSaveDefault] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [script, setScript] = useState("");
  const [note, setNote] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showTranscript, setShowTranscript] = useState(true);

  const engineRef = useRef<AudioEngine>(new AudioEngine());
  const endTimerRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const selected = getContext(context) ?? CONTEXTS[0];
  const soundLabel =
    SOUNDSCAPES.find((s) => s.id === soundscape)?.label ?? "Off";
  const totalSecs = duration * 60;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Prefs;
        if (p.name) setName(p.name);
        if (p.voice) setVoice(p.voice);
        if (p.soundscape) setSoundscape(p.soundscape);
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
      if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

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
      const prefs: Prefs = { name, voice, soundscape };
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } else {
      localStorage.removeItem(PREFS_KEY);
    }
  }

  function chooseIntention(id: ContextId) {
    setContext(id);
    setError(null);
    setTrayOpen(true);
  }

  async function begin() {
    // Unlock the audio engine within this tap so mobile browsers will let the
    // voice + soundscape play once ready.
    engineRef.current.unlock();

    setError(null);
    persistPrefs();
    setElapsed(0);
    setShowTranscript(true);
    setTrayOpen(false);
    setScreen("generating");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, context, durationMin: duration, voice }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || `Request failed (${res.status})`);

      setScript(data.script || "");
      setNote(typeof data.note === "string" ? data.note : "");
      setIsPreview(Boolean(data.mock));
      setScreen("player");
      startPlayback(Array.isArray(data.segments) ? data.segments : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setScreen("setup");
    }
  }

  function startPlayback(
    segments: { audio: string | null; pauseAfter: number }[]
  ) {
    const eng = engineRef.current;
    eng.onVoiceEnded = () => eng.fadeOutAmbient(8);
    eng.startAmbient(soundscape);
    eng.playSegments(segments);
    setPlaying(true);
    setElapsed(0);
    startTick();

    if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    endTimerRef.current = window.setTimeout(
      () => eng.fadeOutAmbient(8),
      totalSecs * 1000
    );
  }

  function togglePlay() {
    if (playing) {
      engineRef.current.suspend();
      stopTick();
      setPlaying(false);
    } else {
      engineRef.current.resume();
      startTick();
      setPlaying(true);
    }
  }

  function end() {
    engineRef.current.stop();
    if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    stopTick();
    setPlaying(false);
    setElapsed(0);
    setScreen("setup");
  }

  const inhale = elapsed % 9 < 4;
  const breathCue = !playing ? "Paused" : inhale ? "Breathe in" : "Breathe out";
  const breathSub = !playing
    ? "Tap play to continue"
    : inhale
      ? "Slowly, through the nose"
      : "Slowly, through the mouth";

  const moodOn = trayOpen || screen === "player";

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
            <div className="step done">
              <div className="dot" />
              <div>Reading the room</div>
            </div>
            <div className="step active">
              <div className="dot" />
              <div>Writing your words</div>
            </div>
            <div className="step">
              <div className="dot" />
              <div>Finding the voice</div>
            </div>
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
              <div className="body">{cleanScript(script)}</div>
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
          Every session is written fresh for you. Not medical or therapeutic
          advice.
        </div>
      </main>
    );
  }

  return (
    <>
      <SkyCanvas />
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
                <div className="seg">
                  <button
                    className={voice === "female" ? "on" : ""}
                    onClick={() => setVoice("female")}
                  >
                    Her
                  </button>
                  <button
                    className={voice === "male" ? "on" : ""}
                    onClick={() => setVoice("male")}
                  >
                    Him
                  </button>
                </div>
                <div className="flags">
                  <button
                    className={`flagbtn ${accent === "us" ? "on" : ""}`}
                    onClick={() => setAccent("us")}
                    aria-label="American accent"
                  >
                    🇺🇸
                  </button>
                  <button
                    className="flagbtn soon"
                    aria-label="British accent (coming soon)"
                    disabled
                  >
                    🇬🇧
                  </button>
                </div>
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
              <div className="rail">
                {SOUNDSCAPES.map((s) => (
                  <button
                    key={s.id}
                    className={`chip ${soundscape === s.id ? "on" : ""}`}
                    onClick={() => setSoundscape(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
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
            <div className="tray-hint">Tap outside to go back</div>
          </div>
        </>
      )}
    </>
  );
}

// Strip <break/> tags so the read-along text is human-readable.
function cleanScript(s: string): string {
  return s
    .replace(/<break[^>]*\/?>/g, "\n")
    .replace(/\s*—\s*/g, ", ") // no em dashes in the read-along
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
