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
import { asset } from "@/lib/assets";

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
  // for voice ducking: it eases the whole bed down ~2 dB while the guide speaks
  // and back up only in the longer pauses (kept gentle so steady beds don't pump).
  // Separate from the master so it never fights the fade-in bloom or closing fade.
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

  // --- Codec-decode fallback (Mac Catalyst / "iPad app on Mac") -------------
  // In the "Designed for iPad on Mac" WKWebView, Web Audio's decodeAudioData
  // cannot run the codec decoders (MP3/AAC/FLAC) — it returns null — even though
  // the same WebKit in Safari decodes fine and oscillators still play. iOS and
  // the web are unaffected. We probe once; when decode is broken we play the bed
  // and voice through <audio> elements (HTMLMediaElement uses AVFoundation's
  // decoders, which DO work there) piped into the same graph via
  // MediaElementAudioSourceNode. `decodeOk` gates every fallback branch, so on
  // iOS/web (probe passes) none of this code runs.
  private decodeOk: boolean | null = null;
  private decodeProbe: Promise<boolean> | null = null;
  private bedMediaEls: HTMLAudioElement[] = [];
  private voiceMediaEls: HTMLAudioElement[] = [];
  private mediaTimers = new Set<ReturnType<typeof setTimeout>>();
  private mediaIntervals = new Set<ReturnType<typeof setInterval>>();
  private voiceCancel: (() => void) | null = null;
  private previewMediaEl: HTMLAudioElement | null = null;

  // Probe whether decodeAudioData can decode a real codec-compressed file. Runs
  // once, cached. Uses an actual shipped MP3 (never a hand-built one) so a false
  // negative is impossible on a platform that can decode: if the fetch fails we
  // assume decode works (the safe default) and keep the normal path.
  private async ensureDecodeOk(ctx: AudioContext): Promise<boolean> {
    if (this.decodeOk !== null) return this.decodeOk;
    if (!this.decodeProbe) {
      this.decodeProbe = (async () => {
        let arr: ArrayBuffer;
        try {
          arr = await (await fetch(asset("/sound-previews/Rain.mp3"))).arrayBuffer();
        } catch {
          // Network/probe failure is ambiguous, so assume decode works and keep
          // the normal (buffer) path — never push a healthy platform to fallback.
          return true;
        }
        try {
          await this.decode(ctx, arr.slice(0));
          return true; // codec decode works (iOS / web / Safari)
        } catch {
          return false; // fetched fine but decode failed = broken codec (Mac app)
        }
      })();
    }
    this.decodeOk = await this.decodeProbe;
    return this.decodeOk;
  }

  private trackTimer(ms: number, fn: () => void): void {
    const t = setTimeout(() => {
      this.mediaTimers.delete(t);
      fn();
    }, ms);
    this.mediaTimers.add(t);
  }
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.trackTimer(ms, resolve));
  }
  // Simple bed duck for the media-voice path (the buffer path uses duckForLine).
  private duckMedia(down: boolean): void {
    const duck = this.ambientDuck;
    if (!duck || !this.ctx) return;
    const now = this.ctx.currentTime;
    const g = duck.gain;
    try {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      // Match duckForLine: a gentle ~2 dB dip, not a deep duck, so the bed doesn't
      // pump between lines on steady/broadband beds.
      g.linearRampToValueAtTime(down ? 0.8 : 1, now + (down ? 0.35 : 0.6));
    } catch {
      /* ignore */
    }
  }

  // Decode a FLAC bed to an AudioBuffer in JS (WASM, off the main thread), for
  // runtimes where the native decodeAudioData can't (Mac app). Lets us loop the
  // bed sample-accurately (loop=true) exactly like iOS, with no crossfade seam.
  // The decoder is dynamically imported so iOS/web never load it. Returns null on
  // any failure so the caller can fall back to the <audio> crossfade.
  private async decodeFlacToBuffer(ctx: AudioContext, src: string): Promise<AudioBuffer | null> {
    try {
      const bytes = new Uint8Array(await (await fetch(src)).arrayBuffer());
      const { FLACDecoderWebWorker } = await import("@wasm-audio-decoders/flac");
      const decoder = new FLACDecoderWebWorker();
      await decoder.ready;
      let decoded;
      try {
        decoded = await decoder.decodeFile(bytes);
      } finally {
        try {
          await decoder.free();
        } catch {
          /* ignore */
        }
      }
      const { channelData, samplesDecoded, sampleRate } = decoded;
      if (!channelData?.length || !samplesDecoded || this.ctx !== ctx) return null;
      const buf = ctx.createBuffer(channelData.length, samplesDecoded, sampleRate);
      for (let ch = 0; ch < channelData.length; ch++) {
        buf.getChannelData(ch).set(channelData[ch].subarray(0, samplesDecoded));
      }
      return buf;
    } catch {
      return null;
    }
  }

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
    // Warm the decode-capability probe now (fire-and-forget) so it's resolved
    // before the first preview/session needs it — no first-tap latency.
    void this.ensureDecodeOk(ctx);
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

  // Fetch + decode a URL into an AudioBuffer, caching it for later previews.
  // Returns null (never throws) if the file is missing or undecodable, so the
  // caller can fall back or stay quiet.
  private async fetchDecode(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
    const cached = this.previewCache.get(url);
    if (cached) return cached;
    try {
      const arr = await (await fetch(url)).arrayBuffer();
      const buf = await this.decode(ctx, arr);
      this.previewCache.set(url, buf);
      return buf;
    } catch {
      return null;
    }
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

    if (!(await this.ensureDecodeOk(ctx))) {
      if (this.ctx === ctx) await this.playSegmentsMedia(ctx, segments);
      return;
    }

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

  // Voice fallback: play each segment through an <audio> element (native decoder)
  // in sequence, piped into the same voiceBus, holding each pause on a timer.
  // playStartTime/lineStarts are kept in real time so activeLineIndex() (and thus
  // the transcript karaoke) still tracks. Only runs where decodeAudioData is broken.
  private async playSegmentsMedia(
    ctx: AudioContext,
    segments: { audio: string | null; pauseAfter: number }[]
  ) {
    const voiceBus = this.makeVoiceBus(ctx);
    this.playStartTime = ctx.currentTime;
    this.lineStarts = [];
    let cancelled = false;
    this.voiceCancel = () => {
      cancelled = true;
    };
    const stopped = () => cancelled || this.ctx !== ctx;
    for (let i = 0; i < segments.length; i++) {
      if (stopped()) return;
      this.lineStarts.push(Math.max(0, ctx.currentTime - this.playStartTime));
      const seg = segments[i];
      if (seg.audio) {
        await this.playClipMedia(ctx, voiceBus, seg.audio, seg.pauseAfter, stopped);
      } else {
        await this.wait(seg.pauseAfter * 1000);
      }
    }
    if (!stopped()) this.onVoiceEnded?.();
  }

  // Play one voice clip via <audio> -> voiceBus, ducking the bed for it, then
  // hold the trailing pause. Resolves when the clip and its pause are done.
  private playClipMedia(
    ctx: AudioContext,
    voiceBus: GainNode,
    audioSrc: string,
    pauseAfter: number,
    stopped: () => boolean
  ): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.duckMedia(false);
        if (stopped()) return resolve();
        this.wait(pauseAfter * 1000).then(resolve);
      };
      try {
        const el = new Audio();
        if (/^https?:/i.test(audioSrc)) el.crossOrigin = "anonymous";
        el.src = audioSrc;
        const node = ctx.createMediaElementSource(el);
        node.connect(voiceBus);
        this.ambientNodes.push(node);
        this.voiceMediaEls.push(el);
        this.duckMedia(true);
        el.onended = finish;
        el.onerror = finish;
        el.play().catch(finish);
      } catch {
        finish();
      }
    });
  }

  // Streaming (Custom) voice fallback: same media path, but each line's audio
  // arrives as an ArrayBuffer we wrap in a blob URL. Mirrors playCustomStream's
  // arrival-then-body phases without the buffer decode/schedule.
  private async playCustomStreamMedia(
    ctx: AudioContext,
    arrival: { text: string; pauseAfter: number }[],
    bodyPromise: Promise<{ text: string; pauseAfter: number }[]>,
    fetchAudio: (text: string) => Promise<ArrayBuffer | null>,
    onBody?: (body: { text: string; pauseAfter: number }[]) => void
  ) {
    const voiceBus = this.makeVoiceBus(ctx);
    this.playStartTime = ctx.currentTime;
    this.lineStarts = [];
    let cancelled = false;
    this.voiceCancel = () => {
      cancelled = true;
    };
    const stopped = () => cancelled || this.ctx !== ctx;
    const playList = async (segs: { text: string; pauseAfter: number }[]) => {
      for (let i = 0; i < segs.length; i++) {
        if (stopped()) return;
        this.lineStarts.push(Math.max(0, ctx.currentTime - this.playStartTime));
        let url: string | null = null;
        try {
          const arr = await fetchAudio(segs[i].text);
          if (arr) url = URL.createObjectURL(new Blob([arr], { type: "audio/mpeg" }));
        } catch {
          url = null;
        }
        if (stopped()) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (url) {
          await this.playClipMedia(ctx, voiceBus, url, segs[i].pauseAfter, stopped);
          URL.revokeObjectURL(url);
        } else {
          await this.wait(segs[i].pauseAfter * 1000);
        }
      }
    };
    if (arrival.length) await playList(arrival);
    if (stopped()) return;
    let body: { text: string; pauseAfter: number }[] = [];
    try {
      body = await bodyPromise;
    } catch {
      body = [];
    }
    if (stopped()) return;
    onBody?.(body);
    if (body.length) {
      await playList(body);
      if (!stopped()) this.onVoiceEnded?.();
    }
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
    if (!(await this.ensureDecodeOk(ctx))) {
      return this.playCustomStreamMedia(ctx, arrival, bodyPromise, fetchAudio, onBody);
    }
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
    // A gentle dip, not a duck: the voice already sits ~9 dB over the bed, so the
    // dip is only for a little extra clarity. Kept shallow (~2 dB) and recovered
    // only in the longer pauses, so steady beds (white/green/brown noise) don't
    // audibly swell and pump between lines.
    const DUCK = 0.8; // bed sits ~2 dB down under the voice
    const ATTACK = 0.4; // how quickly it eases down as a line begins
    const UNDUCK_MIN = 3.5; // only breathe back up in the longer pauses
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
    // Media-element beds (fallback path) are disconnected via their node above
    // but keep playing until paused.
    this.mediaIntervals.forEach((iv) => clearInterval(iv));
    this.mediaIntervals.clear();
    this.bedMediaEls.forEach((el) => {
      try {
        el.pause();
        el.src = "";
      } catch {
        /* ignore */
      }
    });
    this.bedMediaEls = [];
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
    opts?: { seconds?: number; gain?: number; offset?: number; fadeIn?: number; fallback?: string }
  ) {
    // Fade out any current preview first (this bumps the token counter), THEN
    // claim our token — otherwise stopPreview would invalidate our own token
    // and the guard below would bail before playback.
    this.stopPreview();
    this.setPlaybackCategory();
    const ctx = this.ensureCtx();
    await ctx.resume().catch(() => {});
    const token = ++this.previewToken;
    if (!(await this.ensureDecodeOk(ctx))) {
      this.previewMedia(ctx, src, opts, token);
      return;
    }
    // Prefer a small dedicated preview clip (near-instant to fetch + decode); if
    // it's missing, fall back to the full bed so the audition is never silent.
    // Full beds are long lossless files, so the fallback path is slower — that's
    // the graceful degradation, not the normal path.
    let buf =
      this.previewCache.get(src) ??
      (await this.fetchDecode(ctx, src)) ??
      (opts?.fallback
        ? this.previewCache.get(opts.fallback) ?? (await this.fetchDecode(ctx, opts.fallback))
        : null);
    // Superseded by a newer tap, or the engine was torn down, while decoding.
    if (!buf || token !== this.previewToken || this.ctx !== ctx) return;

    const target = opts?.gain ?? 0.6;
    // Start a little way into the file: many beds ramp in from ~1-2s of near
    // silence, and an audition should be audible immediately, not after dead
    // air. Clamp so we never seek past the end.
    const offset = Math.min(Math.max(opts?.offset ?? 0, 0), Math.max(0, buf.duration - 1));
    const dur = Math.min(opts?.seconds ?? buf.duration, buf.duration - offset);
    // Quick but audible fade-in so the audition eases in the moment you tap
    // rather than punching in, with a gentle tail so it doesn't cut off harshly.
    const fadeIn = opts?.fadeIn ?? 0.02;
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

  // Preview fallback: audition a clip via an <audio> element (native decoder),
  // gained and length-capped like the buffer path. Only for the codec-broken
  // runtime (Mac app); iOS/web use the buffer path above.
  private previewMedia(
    ctx: AudioContext,
    src: string,
    opts:
      | { seconds?: number; gain?: number; offset?: number; fadeIn?: number; fallback?: string }
      | undefined,
    token: number
  ) {
    try {
      const el = new Audio();
      if (/^https?:/i.test(src)) el.crossOrigin = "anonymous";
      el.src = src;
      const gain = ctx.createGain();
      gain.gain.value = opts?.gain ?? 0.6;
      const node = ctx.createMediaElementSource(el);
      node.connect(gain).connect(ctx.destination);
      const offset = Math.max(opts?.offset ?? 0, 0);
      if (offset > 0) {
        el.addEventListener("loadedmetadata", () => {
          try {
            if (isFinite(el.duration)) el.currentTime = Math.min(offset, Math.max(0, el.duration - 1));
          } catch {
            /* ignore */
          }
        });
      }
      const teardown = () => {
        if (this.previewMediaEl !== el) return;
        this.previewMediaEl = null;
        try {
          el.pause();
          node.disconnect();
          gain.disconnect();
        } catch {
          /* already gone */
        }
      };
      // Superseded by a newer tap while we were probing/awaiting.
      if (token !== this.previewToken) {
        this.previewMediaEl = el;
        teardown();
        return;
      }
      this.previewMediaEl = el;
      el.onended = teardown;
      el.play().catch(() => {});
      if (opts?.seconds) this.trackTimer(opts.seconds * 1000, teardown);
    } catch {
      /* quiet */
    }
  }

  stopPreview() {
    this.previewToken++; // supersede any decode still in flight
    if (this.previewMediaEl) {
      try {
        this.previewMediaEl.pause();
        this.previewMediaEl.onended = null;
        this.previewMediaEl.src = "";
      } catch {
        /* ignore */
      }
      this.previewMediaEl = null;
    }
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
    // Cancel any in-flight media-voice sequence and tear down its elements/timers.
    this.voiceCancel?.();
    this.voiceCancel = null;
    this.mediaTimers.forEach((t) => clearTimeout(t));
    this.mediaTimers.clear();
    this.voiceMediaEls.forEach((el) => {
      try {
        el.pause();
        el.onended = null;
        el.onerror = null;
        el.src = "";
      } catch {
        /* ignore */
      }
    });
    this.voiceMediaEls = [];
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
    // On a runtime where decodeAudioData can't run codecs (Mac Catalyst), decode
    // the FLAC ourselves in JS (WASM, off-thread) so we can loop the exact bed
    // sample-accurately with loop=true — identical to iOS, no crossfade. If that
    // fails we fall back to the <audio> crossfade so the bed is never silent.
    // iOS/web keep the gapless AudioBufferSourceNode path below.
    if (!(await this.ensureDecodeOk(ctx))) {
      const buf = await this.decodeFlacToBuffer(ctx, src);
      if (this.ambientMaster !== master || this.ctx !== ctx) return;
      if (buf) {
        const s = ctx.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        s.connect(master);
        s.start();
        this.ambientNodes.push(s);
      } else {
        this.startFileMedia(ctx, src, master);
      }
      return;
    }
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

  // Bed fallback: seamless loop through TWO <audio> elements (native decoder)
  // that crossfade at the loop seam, piped into the ambient master so gain/ducking
  // still apply. A plain <audio loop> gaps at the restart; here, as the playing
  // element nears its end we start the other from 0 and equal-power-ish crossfade
  // over a short overlap, hiding the media element's imprecise loop timing. The
  // beds are already mastered as seamless loops, so the brief overlap is
  // inaudible. Only runs on the codec-broken runtime (Mac app).
  private startFileMedia(ctx: AudioContext, src: string, master: GainNode) {
    try {
      const OVERLAP = 0.22; // seconds of crossfade at the seam
      const MARGIN = 0.15; // start early so the outgoing element never cuts mid-fade
      const mk = () => {
        const el = new Audio();
        el.crossOrigin = "anonymous"; // Blob sends ACAO:* so the node isn't muted
        el.preload = "auto";
        el.src = src;
        const gain = ctx.createGain();
        const node = ctx.createMediaElementSource(el);
        node.connect(gain).connect(master);
        this.ambientNodes.push(node, gain);
        this.bedMediaEls.push(el);
        return { el, gain };
      };
      const a = mk();
      const b = mk();
      a.gain.gain.value = 1;
      b.gain.gain.value = 0;
      let active = a;
      let standby = b;
      let fading = false;
      // Equal-power (constant-energy) crossfade curves, so the overlap neither
      // dips nor bumps. Kept short so the pad's end and start barely coexist.
      const N = 48;
      const fadeOut = new Float32Array(N);
      const fadeIn = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const x = i / (N - 1);
        fadeOut[i] = Math.cos((x * Math.PI) / 2);
        fadeIn[i] = Math.sin((x * Math.PI) / 2);
      }
      // Standby is pre-seeked to 0 and ready, so the swap has no seek/play hitch.
      try {
        b.el.currentTime = 0;
      } catch {
        /* ignore */
      }
      a.el.play().catch(() => {});

      const poll = setInterval(() => {
        if (this.ctx !== ctx) return; // stopped/superseded
        const el = active.el;
        const dur = el.duration;
        if (!fading && isFinite(dur) && dur > 0 && el.currentTime >= dur - OVERLAP - MARGIN) {
          fading = true;
          const cur = standby;
          const prev = active;
          cur.el.play().catch(() => {});
          const now = ctx.currentTime;
          try {
            prev.gain.gain.cancelScheduledValues(now);
            prev.gain.gain.setValueCurveAtTime(fadeOut, now, OVERLAP);
            cur.gain.gain.cancelScheduledValues(now);
            cur.gain.gain.setValueCurveAtTime(fadeIn, now, OVERLAP);
          } catch {
            // Fallback if a curve overlaps existing automation.
            prev.gain.gain.setValueAtTime(0, now + OVERLAP);
            cur.gain.gain.setValueAtTime(1, now + OVERLAP);
          }
          this.trackTimer(OVERLAP * 1000 + 120, () => {
            try {
              prev.el.pause();
              prev.el.currentTime = 0; // pre-seek for its next turn (no hitch)
              prev.gain.gain.setValueAtTime(0, ctx.currentTime);
            } catch {
              /* ignore */
            }
            active = cur;
            standby = prev;
            fading = false;
          });
        }
      }, 40);
      this.mediaIntervals.add(poll);
    } catch {
      /* carry on quietly */
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
