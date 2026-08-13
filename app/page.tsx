"use client";

import { useEffect, useRef, useState } from "react";
import {
  CONTEXTS,
  DURATIONS,
  type ContextId,
  type Duration,
  type VoiceChoice,
} from "@/lib/contexts";

type Soundscape = "silence" | "rain" | "ocean" | "drone";
const SOUNDSCAPES: { id: Soundscape; label: string }[] = [
  { id: "silence", label: "Silence" },
  { id: "rain", label: "Rain" },
  { id: "ocean", label: "Ocean" },
  { id: "drone", label: "Drone" },
];

interface Prefs {
  name: string;
  voice: VoiceChoice;
  soundscape: Soundscape;
}
const PREFS_KEY = "relaxed.prefs.v1";

// ---------------------------------------------------------------------------
// Asset-free ambient engine: synthesizes soundscapes with the Web Audio API,
// so there are no audio files to license or ship. Layered *under* the voice.
// ---------------------------------------------------------------------------
class Ambient {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  nodes: AudioNode[] = [];

  start(kind: Soundscape) {
    this.stop();
    if (kind === "silence") return;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.master = master;

    if (kind === "drone") {
      [110, 164.81, 220].forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = i === 0 ? 0.5 : 0.22;
        osc.connect(g).connect(master);
        osc.start();
        this.nodes.push(osc, g);
      });
    } else {
      // Brown noise → filter it into "rain" (brighter) or "ocean" (rolling swell)
      const noise = this.brownNoise(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = kind === "rain" ? 1600 : 520;
      noise.connect(filter).connect(master);
      this.nodes.push(noise, filter);

      if (kind === "ocean") {
        // Slow LFO on the filter cutoff → the sound of waves breathing in and out
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.08;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 340;
        lfo.connect(lfoGain).connect(filter.frequency);
        lfo.start();
        this.nodes.push(lfo, lfoGain);
      }
    }

    // Gentle fade-in
    const target = kind === "drone" ? 0.16 : 0.5;
    master.gain.linearRampToValueAtTime(target, ctx.currentTime + 3);
  }

  fadeOut(seconds = 6) {
    if (this.ctx && this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0, now + seconds);
      window.setTimeout(() => this.stop(), seconds * 1000 + 200);
    }
  }

  stop() {
    this.nodes.forEach((n) => {
      try {
        if ("stop" in n && typeof (n as OscillatorNode).stop === "function") {
          (n as OscillatorNode).stop();
        }
        n.disconnect();
      } catch {
        /* already stopped */
      }
    });
    this.nodes = [];
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.master = null;
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

type Screen = "setup" | "generating" | "player";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [name, setName] = useState("");
  const [context, setContext] = useState<ContextId>("meditation");
  const [duration, setDuration] = useState<Duration>(5);
  const [voice, setVoice] = useState<VoiceChoice>("female");
  const [soundscape, setSoundscape] = useState<Soundscape>("rain");
  const [saveDefault, setSaveDefault] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [script, setScript] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [playing, setPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ambientRef = useRef<Ambient>(new Ambient());
  const endTimerRef = useRef<number | null>(null);

  // Load saved preferences on mount.
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
    return () => {
      ambientRef.current.stop();
      if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    };
  }, []);

  function persistPrefs() {
    if (saveDefault) {
      const prefs: Prefs = { name, voice, soundscape };
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } else {
      localStorage.removeItem(PREFS_KEY);
    }
  }

  async function begin() {
    setError(null);
    persistPrefs();
    setScreen("generating");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          context,
          durationMin: duration,
          voice,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);

      setScript(data.script || "");
      setIsPreview(Boolean(data.mock));
      setScreen("player");
      startPlayback(data.audio as string | null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setScreen("setup");
    }
  }

  function startPlayback(audio: string | null) {
    ambientRef.current.start(soundscape);
    setPlaying(true);

    if (audio && audioRef.current) {
      audioRef.current.src = audio;
      audioRef.current.play().catch(() => {});
    }

    // Fade the ambient out around the requested duration.
    if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    endTimerRef.current = window.setTimeout(
      () => ambientRef.current.fadeOut(8),
      duration * 60 * 1000
    );
  }

  function togglePlay() {
    const a = audioRef.current;
    if (playing) {
      a?.pause();
      ambientRef.current.ctx?.suspend();
      setPlaying(false);
    } else {
      a?.play().catch(() => {});
      ambientRef.current.ctx?.resume();
      setPlaying(true);
    }
  }

  function end() {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    ambientRef.current.stop();
    if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    setPlaying(false);
    setScreen("setup");
  }

  // ---- Render ----
  if (screen === "generating") {
    return (
      <main className="wrap">
        <Brand />
        <div className="player">
          <div className="spinner" />
          <div className="status">
            Composing your session
            <br />
            <span style={{ opacity: 0.7 }}>
              writing a {duration}-minute {labelFor(context)} just for you…
            </span>
          </div>
        </div>
      </main>
    );
  }

  if (screen === "player") {
    return (
      <main className="wrap">
        <Brand />
        <div className="player">
          <div className="orb-wrap">
            <div className={`orb ${playing ? "" : "paused"}`} />
          </div>
          <div className="orb-hint">{playing ? "Breathe with the light" : "Paused"}</div>
          <div className="controls">
            <button className="btn primary" onClick={togglePlay}>
              {playing ? "Pause" : "Resume"}
            </button>
            <button className="btn" onClick={end}>
              End session
            </button>
          </div>
          {isPreview && (
            <div className="status" style={{ maxWidth: 460 }}>
              Preview mode — add your ElevenLabs key to hear this spoken in{" "}
              {voice === "female" ? "a female" : "a male"} voice. Reading along
              below.
            </div>
          )}
          {(isPreview || script) && (
            <div className="scriptbox">{cleanScript(script)}</div>
          )}
        </div>
        <audio ref={audioRef} onEnded={() => ambientRef.current.fadeOut(8)} />
      </main>
    );
  }

  return (
    <main className="wrap">
      <Brand />

      <div className="section">
        <label>Your name</label>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What should we call you?"
          maxLength={60}
        />
      </div>

      <div className="section">
        <label>What do you need right now?</label>
        <div className="grid">
          {CONTEXTS.map((c) => (
            <button
              key={c.id}
              className={`card ${context === c.id ? "active" : ""}`}
              onClick={() => setContext(c.id)}
            >
              <div className="t">{c.label}</div>
              <div className="s">{c.tagline}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <label>Length</label>
        <div className="chips">
          {DURATIONS.map((d) => (
            <button
              key={d}
              className={`chip ${duration === d ? "active" : ""}`}
              onClick={() => setDuration(d)}
            >
              {d} min
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <label>Voice</label>
        <div className="chips">
          {(["female", "male"] as VoiceChoice[]).map((v) => (
            <button
              key={v}
              className={`chip ${voice === v ? "active" : ""}`}
              onClick={() => setVoice(v)}
            >
              {v === "female" ? "Female" : "Male"}
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <label>Soundscape</label>
        <div className="chips">
          {SOUNDSCAPES.map((s) => (
            <button
              key={s.id}
              className={`chip ${soundscape === s.id ? "active" : ""}`}
              onClick={() => setSoundscape(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <label className="save">
        <input
          type="checkbox"
          checked={saveDefault}
          onChange={(e) => setSaveDefault(e.target.checked)}
        />
        Remember my name, voice, and soundscape on this device
      </label>

      {error && <div className="err">{error}</div>}

      <button className="begin" onClick={begin} disabled={!context}>
        Begin session
      </button>

      <div className="footnote">
        Each session is written fresh for you. Not medical or therapeutic advice.
      </div>
    </main>
  );
}

function Brand() {
  return (
    <div className="brand">
      <h1>
        relaxed<span className="dot">.app</span>
      </h1>
      <p>personalized mindfulness, written for you</p>
    </div>
  );
}

function labelFor(id: ContextId): string {
  return CONTEXTS.find((c) => c.id === id)?.label.toLowerCase() ?? "session";
}

// Strip <break/> tags so the read-along text is human-readable.
function cleanScript(s: string): string {
  return s.replace(/<break[^>]*\/?>/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
