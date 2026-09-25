// Loudness normalization for voices and beds, plus the single source of truth
// for turning a (voice, accent, soundscape) selection into concrete gains and a
// bed file. Every playback path shares this so loudness can't drift between
// them. Pure math (measured RMS/peak in dBFS), so it is unit-tested directly.

import type { Soundscape, Accent } from "./types";
import type { VoiceChoice } from "@/lib/contexts";
import { soundDef } from "./soundscapes";
import { asset } from "@/lib/assets";
import { isPremiumVoice, type PremiumVoiceId } from "@/lib/premiumVoices";

export const VOICE_TARGET = -24; // where all voices land
export const BED_UNDER_VOICE = -33; // beds sit ~9 dB below the voice (~10% louder than -34)
export const BED_SOLO = -19; // louder for a no-voice, sounds-only session (~10% up)
export const PEAK_CEIL = -1.5; // never let a peak go above this
// Measured on ONE basis for all 14 voices (scripts/measure-voices.mjs, 2026-09-25):
// the same 10 representative session lines synthesized per voice at the session
// TTS settings, then ffmpeg RMS (volumedetect) + true peak + integrated LUFS. `trim`
// is the LUFS-vs-RMS perceptual correction relative to the roster median (median
// perceived excess 0.3 dB), because equal RMS is not equal loudness: a dense voice
// (mira) reads louder than its RMS and gets a negative trim; an airy/peaky one sits
// higher. After normalization every voice lands at ≈ VOICE_TARGET + median excess,
// so free and premium sit at equal *perceived* loudness — except a couple whose low
// RMS + limited peak headroom keep them peak-limited a few dB under (see below).
export const VOICE_STATS: Record<
  string,
  { rms: number; peak: number; trim?: number }
> = {
  "female-us": { rms: -19.1, peak: -2.5 },
  "male-us": { rms: -24.9, peak: -3.7 },
  "female-uk": { rms: -15.0, peak: -1.4 },
  "male-uk": { rms: -24.2, peak: -4.1, trim: 1 },
};
// Premium voices are single named personas (baked accent), so they key by id, not
// <voice>-<accent>. Same measured model + same basis as VOICE_STATS, so they sit
// level with the free voices in a session. A voice absent here falls back to raw
// gain (1.0) — premium voices only carry a measured entry, never a guess.
//   NOTE: willow (rms -43.8) and mira (dense, high crest) are peak-limited by the
//   -1.5 dBFS ceiling, so they land ~4-6 dB under the group and stay the quietest
//   even after +14 dB / +2.6 dB of make-up gain. The real fix is re-mastering those
//   two source clips hotter; the numbers below are the best normGain can reach.
export const PREMIUM_VOICE_STATS: Partial<
  Record<PremiumVoiceId, { rms: number; peak: number; trim?: number }>
> = {
  willow: { rms: -43.8, peak: -16.1, trim: 1 },
  natasha: { rms: -35.1, peak: -15.4, trim: -0.5 },
  mira: { rms: -35.2, peak: -4.1, trim: -4 },
  almee: { rms: -29.4, peak: -2.9, trim: -0.5 },
  alisa: { rms: -20.3, peak: -1.5, trim: 0.5 },
  kai: { rms: -32.7, peak: -11.2 },
  drew: { rms: -27.1, peak: -11.2, trim: 1 },
  brad: { rms: -19.0, peak: -3.2, trim: 1 },
  solomon: { rms: -21.6, peak: -2.2 },
  gavin: { rms: -27.3, peak: -5.1 },
};
// Tray-audition gains for the voice PREVIEW clips (previewVoice). These are
// separate short recordings from the session voice, so they carry their own
// measured gains: matched to a common audition loudness (-18 LUFS) and capped so
// peaks stay under -1 dBFS (scripts/measure-voices.mjs, pass 2). male-uk is
// peak-limited so it lands a touch shy, but far closer than the raw gap.
export const PREVIEW_GAIN: Record<string, number> = {
  "female-us": 1.26,
  "female-uk": 0.6,
  "male-us": 1.5,
  "male-uk": 2.09,
};
// The same audition-loudness matching for the PREMIUM voice preview clips
// (/voice-previews/<id>.mp3), keyed by voice id (scripts/measure-voices.mjs,
// pass 2). willow/natasha are very quiet clips, so they carry large make-up gains
// (still peak-capped under -1 dBFS). A voice absent here auditions at the fallback.
export const PREMIUM_PREVIEW_FALLBACK = 0.85;
export const PREMIUM_PREVIEW_GAIN: Partial<Record<PremiumVoiceId, number>> = {
  willow: 14.13,
  natasha: 8.22,
  mira: 3.09,
  almee: 1.66,
  alisa: 0.75,
  kai: 4.52,
  drew: 3.24,
  brad: 1.32,
  solomon: 1.46,
  gavin: 2.21,
};
// Linear gain to move a signal (rms/peak dBFS) toward a target loudness, capped
// so the peak stays under the ceiling.
export function normGain(rms: number, peak: number, targetRms: number): number {
  const db = Math.min(targetRms - rms, PEAK_CEIL - peak);
  return Math.pow(10, db / 20);
}
// The normalized voice gain and the bed's file + level for a given selection,
// shared by every playback path so loudness can't drift between them. `solo`
// (no voice) plays the bed louder; otherwise it sits under the voice.
// Measured loudness for the current voice: a premium voice keys by its id, a free
// voice by <voice>-<accent>. Undefined when unmeasured (→ unity gain in callers).
export function voiceStats(voice: VoiceChoice, accent: Accent) {
  return isPremiumVoice(voice)
    ? PREMIUM_VOICE_STATS[voice]
    : VOICE_STATS[`${voice}-${accent}`];
}
export function bedAndVoice(voice: VoiceChoice, accent: Accent, soundscape: Soundscape) {
  const vs = voiceStats(voice, accent);
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
