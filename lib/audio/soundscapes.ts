// The soundscape catalog: three families (Nature / Music / Frequencies), eight
// each (24 total), all ElevenLabs recordings that load as seamless looping audio
// files. Measured loudness (rms/peak/trim) drives normalization in ./levels. Data
// + pure lookups only, so this is safe to import anywhere (routes, tests, client).
//
// `tier` records the intended free/premium split (3 free + 5 premium per family).
// It is DATA ONLY right now — every bed is unlocked and playable. The paywall is a
// later project; it will read `tier` to gate the premium beds.
//
// ⚠️ LOUDNESS PLACEHOLDERS: rms/peak/trim below are carried over from the previous
// MP3 masters and are NOT valid for the new FLAC masters. Before this catalog is
// merged/deployed, upload the final FLAC files and run `scripts/measure-beds.mjs`,
// then paste the refreshed values in. (The producer normalizes all 24 to a
// consistent target, so post-master values will cluster far tighter than these.)

import type { Soundscape, SoundCat, SoundDef } from "./types";

export const SOUND_CATS: { id: SoundCat; label: string }[] = [
  { id: "nature", label: "Nature" },
  { id: "music", label: "Music" },
  { id: "frequencies", label: "Frequencies" },
];

// `trim` is the per-bed perceptual correction (dB) from a measured LUFS pass
// (ITU-R BS.1770, K-weighted, see scripts/measure-beds.mjs). Each bed's trim
// shifts its RMS target so that, after normalization, they all land at equal
// PERCEIVED loudness rather than equal RMS: bright/hissy beds sit a touch lower,
// dull/low beds a touch higher. Ocean measured near parity, but its wave-crash /
// hiss character reads aggressive, so it's kept deliberately below parity.
export const SOUNDSCAPES: SoundDef[] = [
  // Nature — ElevenLabs recordings (seamless loops). Free: Rain, Ocean, Birdsong.
  { id: "rain", label: "Rain", cat: "nature", tier: "free", src: "/sounds/Rain.flac", rms: -42.5, peak: -14.4, trim: -3 },
  { id: "ocean", label: "Ocean Waves", cat: "nature", tier: "free", src: "/sounds/Ocean.flac", rms: -25.1, peak: -5.3, trim: -4 },
  { id: "birdsong", label: "Birdsong", cat: "nature", tier: "free", src: "/sounds/Birdsong.flac", rms: -24, peak: -3 },
  { id: "wind", label: "Wind", cat: "nature", tier: "premium", src: "/sounds/Wind.flac", rms: -43.4, peak: -24.0, trim: -1.5 },
  { id: "thunder", label: "Thunderstorm", cat: "nature", tier: "premium", src: "/sounds/Thunderstorm.flac", rms: -37.9, peak: -14.5, trim: -0.5 },
  { id: "windchimes", label: "Windchimes", cat: "nature", tier: "premium", src: "/sounds/Windchimes.flac", rms: -32.4, peak: -16.5 },
  { id: "brook", label: "Babbling Brook", cat: "nature", tier: "premium", src: "/sounds/BabblingBrook.flac", rms: -24, peak: -3 },
  { id: "campfire", label: "Campfire", cat: "nature", tier: "premium", src: "/sounds/Campfire.flac", rms: -24, peak: -3 },
  // Music — ElevenMusic recordings. Free: Ambient, Piano, LoFi.
  { id: "pad", label: "Ambient", cat: "music", tier: "free", src: "/sounds/Ambient.flac", rms: -21.7, peak: -10.4, trim: 2 },
  { id: "piano", label: "Piano", cat: "music", tier: "free", src: "/sounds/Piano.flac", rms: -36.2, peak: -13.1, trim: -1 },
  { id: "lofi", label: "LoFi", cat: "music", tier: "free", src: "/sounds/LoFi.flac", rms: -16.1, peak: -0.1, trim: 1 },
  { id: "bowls", label: "Singing Bowls", cat: "music", tier: "premium", src: "/sounds/SingingBowls.flac", rms: -14.6, peak: -0.4 },
  { id: "harp", label: "Harp", cat: "music", tier: "premium", src: "/sounds/Harp.flac", rms: -17.4, peak: -0.4, trim: -0.5 },
  { id: "strings", label: "Warm Strings", cat: "music", tier: "premium", src: "/sounds/WarmStrings.flac", rms: -20, peak: -3 },
  { id: "kalimba", label: "Kalimba", cat: "music", tier: "premium", src: "/sounds/Kalimba.flac", rms: -20, peak: -3 },
  { id: "flute", label: "Flute", cat: "music", tier: "premium", src: "/sounds/Flute.flac", rms: -20, peak: -3 },
  // Frequencies — ElevenLabs recordings. Free: Brown Noise, 432 Hz, White Noise.
  { id: "brown", label: "Brown Noise", cat: "frequencies", tier: "free", src: "/sounds/BrownNoise.flac", rms: -37.0, peak: -18.8 },
  { id: "pad432", label: "432 Hz", cat: "frequencies", tier: "free", src: "/sounds/432Hz.flac", rms: -16.8, peak: -2.4 },
  { id: "whitenoise", label: "White Noise", cat: "frequencies", tier: "free", src: "/sounds/WhiteNoise.flac", rms: -24, peak: -3 },
  { id: "binaural", label: "Binaural", cat: "frequencies", tier: "premium", src: "/sounds/Binaural.flac", rms: -15.9, peak: -2.7, trim: 1.5 },
  { id: "delta", label: "Delta", cat: "frequencies", tier: "premium", src: "/sounds/Delta.flac", rms: -12.7, peak: -0.2, trim: 2 },
  { id: "theta", label: "Theta", cat: "frequencies", tier: "premium", src: "/sounds/Theta.flac", rms: -17.2, peak: -2.8, trim: 2 },
  { id: "green", label: "Green Noise", cat: "frequencies", tier: "premium", src: "/sounds/GreenNoise.flac", rms: -24, peak: -3 },
  { id: "alpha", label: "Alpha", cat: "frequencies", tier: "premium", src: "/sounds/Alpha.flac", rms: -20, peak: -3, trim: 2 },
];

// The calm nature bed that sits underneath a first-time tray (Nature tab,
// nothing preselected) so Begin still works if the user never picks a soundscape.
export const FIRST_TIME_SOUND: Soundscape = "rain";

export function catOf(id: Soundscape): SoundCat {
  return SOUNDSCAPES.find((s) => s.id === id)?.cat ?? "nature";
}

export function soundDef(id: Soundscape): SoundDef | undefined {
  return SOUNDSCAPES.find((s) => s.id === id);
}
