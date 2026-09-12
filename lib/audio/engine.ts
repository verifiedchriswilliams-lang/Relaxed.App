// The audio engine for a whole session. Both the ambient soundscape and the
// spoken voice play through one Web Audio context, so on mobile they coexist,
// ignore the iOS silent switch, and play at the correct speed. The context is
// unlocked inside the Begin tap to satisfy mobile autoplay rules.
//
// Self-contained: it owns Web Audio graph state only and takes callbacks
// (onVoiceEnded) rather than reaching into React. Extracted from the page
// component so the timing/mixing logic is isolated and independently testable.

import type { Soundscape } from "./types";
import type { AudioProfile } from "@/lib/engine";

// Constant, exact playback speed for voiced segments (Web Audio is clock-locked).
const VOICE_RATE = 1.0;

interface StreamState {
  started: boolean;
  cursor: number;
  lastSrc: AudioBufferSourceNode | null;
}

export class AudioEngine {
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
