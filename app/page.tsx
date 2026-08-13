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

// ElevenMind wordmark: the family bar glyph (upright "11"), then Eleven (700)
// and Mind (400) with no space. The discs are session artwork only and never
// appear in the wordmark.
function Wordmark() {
  return (
    <div className="wordmark" aria-label="ElevenMind">
      <span className="em-bars" aria-hidden="true">
        <i />
        <i />
      </span>
      <span className="em-name">
        <b>Eleven</b>Mind
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

interface Prefs {
  name: string;
  voice: VoiceChoice;
  soundscape: Soundscape;
}
const PREFS_KEY = "elevenmind.prefs.v1";

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
  const [soundscape, setSoundscape] = useState<Soundscape>("rain");
  const [saveDefault, setSaveDefault] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [script, setScript] = useState("");
  const [note, setNote] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showTranscript, setShowTranscript] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ambientRef = useRef<Ambient>(new Ambient());
  const endTimerRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const selected = getContext(context) ?? CONTEXTS[0];
  const soundLabel =
    SOUNDSCAPES.find((s) => s.id === soundscape)?.label ?? "Off";
  const totalSecs = duration * 60;

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

  async function begin() {
    setError(null);
    persistPrefs();
    setElapsed(0);
    setShowTranscript(true);
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
      startPlayback(data.audio as string | null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setScreen("setup");
    }
  }

  function startPlayback(audio: string | null) {
    ambientRef.current.start(soundscape);
    setPlaying(true);
    setElapsed(0);
    startTick();

    if (audio && audioRef.current) {
      audioRef.current.src = audio;
      audioRef.current.play().catch(() => {});
    }

    // Fade the ambient out around the requested duration.
    if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    endTimerRef.current = window.setTimeout(
      () => ambientRef.current.fadeOut(8),
      totalSecs * 1000
    );
  }

  function togglePlay() {
    const a = audioRef.current;
    if (playing) {
      a?.pause();
      ambientRef.current.ctx?.suspend();
      stopTick();
      setPlaying(false);
    } else {
      a?.play().catch(() => {});
      ambientRef.current.ctx?.resume();
      startTick();
      setPlaying(true);
    }
  }

  function end() {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    ambientRef.current.stop();
    if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    stopTick();
    setPlaying(false);
    setElapsed(0);
    setScreen("setup");
  }

  // Breath cue derived from elapsed time (4s in / 5s out on a 9s cadence),
  // so it keeps cueing even under prefers-reduced-motion when the disc is still.
  const inhale = elapsed % 9 < 4;
  const breathCue = !playing ? "Paused" : inhale ? "Breathe in" : "Breathe out";
  const breathSub = !playing
    ? "Tap play to continue"
    : inhale
      ? "Slowly, through the nose"
      : "Slowly, through the mouth";

  // ---- Generating ----
  if (screen === "generating") {
    return (
      <main className="wrap">
        <div className="top">
          <Wordmark />
        </div>
        <div className="generating">
          <div className="gen-orb">
            <div
              className="disc spin"
              style={{ background: selected.art }}
            />
            <div className="halo" />
          </div>
          <div>
            <div className="gen-title">Composing Your Session</div>
            <div className="gen-detail">
              {(name.trim() || "You")} · {selected.label} · {duration} minutes ·{" "}
              {soundLabel}
            </div>
          </div>
          <div className="steps">
            <div className="step done">
              <div className="dot" />
              <div>Reading the room</div>
            </div>
            <div className="step active pulse">
              <div className="dot" />
              <div>Writing your words</div>
            </div>
            <div className="step">
              <div className="dot" />
              <div>Finding the voice</div>
            </div>
          </div>
          <div className="gen-foot">
            No progress bar. Settle in — find a position you can hold for{" "}
            {duration} minutes.
          </div>
        </div>
      </main>
    );
  }

  // ---- Player (dark) ----
  if (screen === "player") {
    return (
      <div className="player">
        <main className="wrap">
          <div className="player-top">
            <div className="ctx">
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
                style={{ background: selected.art }}
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
        <audio ref={audioRef} onEnded={() => ambientRef.current.fadeOut(8)} />
      </div>
    );
  }

  // ---- Setup ----
  const top3 = CONTEXTS.slice(0, 3);
  const bottom2 = CONTEXTS.slice(3);

  return (
    <main className="wrap">
      <div className="top">
        <Wordmark />
      </div>

      <div className="greeting">
        <div className="display">
          {greetingFor()}
          {name.trim() ? `, ${name.trim()}` : ""}
        </div>
        <div className="lede">Let&rsquo;s compose your session.</div>
      </div>

      <div className="section">
        <div className="label">Your name</div>
        <div className="namecard">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What should we call you?"
            maxLength={60}
            aria-label="Your name"
          />
        </div>
      </div>

      <div className="section">
        <div className="label">Session</div>
        <div className="sessions">
          <div className="session-row">
            {top3.map((c) => (
              <button
                key={c.id}
                className={`card tall ${context === c.id ? "active" : ""}`}
                onClick={() => setContext(c.id)}
              >
                <div className="thumb disc" style={{ background: c.art }} />
                <div className="cname">{c.label}</div>
              </button>
            ))}
          </div>
          <div className="session-row">
            {bottom2.map((c) => (
              <button
                key={c.id}
                className={`card wide ${context === c.id ? "active" : ""}`}
                onClick={() => setContext(c.id)}
              >
                <div className="thumb disc" style={{ background: c.art }} />
                <div className="cname">{c.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="label">Duration</div>
        <div className="pills">
          {DURATIONS.map((d, i) => (
            <button
              key={d}
              className={`pill ${duration === d ? "active" : ""}`}
              onClick={() => setDuration(d)}
            >
              {i === 0 ? `${d} min` : d}
            </button>
          ))}
        </div>
      </div>

      <div className="duo" style={{ marginTop: 22 }}>
        <div className="section" style={{ marginTop: 0 }}>
          <div className="label">Voice</div>
          <div className="segmented">
            <button
              className={`seg ${voice === "female" ? "active" : ""}`}
              onClick={() => setVoice("female")}
            >
              Her
            </button>
            <button
              className={`seg ${voice === "male" ? "active" : ""}`}
              onClick={() => setVoice("male")}
            >
              Him
            </button>
          </div>
        </div>
        <div className="section" style={{ marginTop: 0 }}>
          <div className="label">Soundscape</div>
          <div className="pills">
            {SOUNDSCAPES.map((s) => (
              <button
                key={s.id}
                className={`pill sm ${soundscape === s.id ? "active" : ""}`}
                onClick={() => setSoundscape(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
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

      <button className="begin" onClick={begin} disabled={!context}>
        Begin Session
      </button>
      <div className="summary">
        {duration} min · {selected.label} · {voice === "female" ? "Her" : "Him"}{" "}
        · {soundLabel}
      </div>

      <div className="footnote">
        Every session is written fresh for you. Not medical or therapeutic
        advice.
      </div>
    </main>
  );
}

// Strip <break/> tags so the read-along text is human-readable.
function cleanScript(s: string): string {
  return s
    .replace(/<break[^>]*\/?>/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
