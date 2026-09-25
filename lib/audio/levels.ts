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
export const VOICE_STATS: Record<
  string,
  { rms: number; peak: number; trim?: number }
> = {
  "female-us": { rms: -18.5, peak: -1.6 },
  "male-us": { rms: -25.1, peak: -5.1, trim: 2.5 },
  "female-uk": { rms: -14.8, peak: -1.3, trim: -3.5 },
  "male-uk": { rms: -24.5, peak: -4.3, trim: 2.5 },
};
// Premium voices are single named personas (baked accent), so they key by id, not
// <voice>-<accent>. Same measured model as VOICE_STATS (rms/peak in dBFS + optional
// perceptual trim), on the SAME loudness basis so they sit level with the free
// voices in a session. Measured over the representative session lines by
// scripts/measure-voices.mjs. A voice absent here falls back to raw gain (1.0),
// so premium voices only carry a measured entry — never a guess.
export const PREMIUM_VOICE_STATS: Partial<
  Record<PremiumVoiceId, { rms: number; peak: number; trim?: number }>
> = {
  // Filled from `node scripts/measure-voices.mjs` (pass 1). Until measured, these
  // stay empty and the voice plays at unity gain.
};
// Tray-audition gains for the voice PREVIEW clips (previewVoice). These are
// separate recordings from the session voice and were played at a flat gain, so
// the male clips read far quieter than the female ones. Measured by LUFS
// (scripts/measure-beds.mjs) and matched to a common audition loudness, capped
// so peaks stay under -1 dBFS. male-uk is peak-limited so it lands ~2 dB shy of
// the rest, but that's far closer than the ~12 dB raw gap.
export const PREVIEW_GAIN: Record<string, number> = {
  "female-us": 1.19,
  "female-uk": 0.65,
  "male-us": 1.95,
  "male-uk": 2.04,
};
// The same audition-loudness matching for the PREMIUM voice preview clips
// (/voice-previews/<id>.mp3), keyed by voice id. Measured by LUFS and capped under
// -1 dBFS, exactly like PREVIEW_GAIN (scripts/measure-voices.mjs, pass 2). A voice
// absent here auditions at PREMIUM_PREVIEW_FALLBACK.
export const PREMIUM_PREVIEW_FALLBACK = 0.85;
export const PREMIUM_PREVIEW_GAIN: Partial<Record<PremiumVoiceId, number>> = {
  // Filled from `node scripts/measure-voices.mjs` (pass 2).
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
