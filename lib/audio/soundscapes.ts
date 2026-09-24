// The soundscape catalog: three families (Nature / Music / Frequencies), eight
// each (24 total), all ElevenLabs recordings that load as seamless looping audio
// files. Measured loudness (rms/peak/trim) drives normalization in ./levels. Data
// + pure lookups only, so this is safe to import anywhere (routes, tests, client).
//
// `tier` records the free/premium split (5 free + 3 premium per family = 15 free,
// 9 premium). Until the 1.3 paywall ships this is DATA ONLY — every bed is unlocked
// and playable; the gate will read `tier` to lock the premium beds behind the IAP.
//
// Loudness: rms/peak/trim below are MEASURED from the final FLAC masters
// (volumedetect mean_volume + ebur128 true peak/LUFS via scripts/measure-beds.mjs).
// `trim` is the LUFS-vs-RMS perceptual correction relative to the 24-bed median
// (median excess 2.3 dB), so hissy/bright beds sit lower and low tones sit higher.

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
// dull/low beds a touch higher. Values below are the measured set for the 24
// FLAC masters (median perceived excess 2.3 dB; trims round to the nearest 0.5).
export const SOUNDSCAPES: SoundDef[] = [
  // Order within each family IS the tray order: 5 free beds first (broad appeal,
  // most-familiar left), then the 3 premium beds anchored on the right so the
  // paywall lock sits at the deluxe end of the row. Tiers confirmed 2026-09-23.
  //
  // Nature — free: Rain, Ocean, Thunderstorm, Wind, Birdsong.
  { id: "rain", label: "Rain", cat: "nature", tier: "free", src: "/sounds/Rain.flac", rms: -49.0, peak: -22.5, trim: -2 },
  { id: "ocean", label: "Ocean Waves", cat: "nature", tier: "free", src: "/sounds/Ocean.flac", rms: -35.0, peak: -12.1, trim: -1.5 },
  { id: "thunder", label: "Thunderstorm", cat: "nature", tier: "free", src: "/sounds/Thunderstorm.flac", rms: -40.9, peak: -11.3 },
  { id: "wind", label: "Wind", cat: "nature", tier: "free", src: "/sounds/Wind.flac", rms: -47.7, peak: -30.3, trim: -0.5 },
  { id: "birdsong", label: "Birdsong", cat: "nature", tier: "free", src: "/sounds/Birdsong.flac", rms: -52.5, peak: -30.2, trim: -1.5 },
  { id: "brook", label: "Babbling Brook", cat: "nature", tier: "premium", src: "/sounds/BabblingBrook.flac", rms: -48.0, peak: -24.8, trim: -2 },
  { id: "campfire", label: "Campfire", cat: "nature", tier: "premium", src: "/sounds/Campfire.flac", rms: -51.6, peak: -10.9, trim: -1.5 },
  { id: "windchimes", label: "Windchimes", cat: "nature", tier: "premium", src: "/sounds/Windchimes.flac", rms: -34.9, peak: -16.2, trim: -0.5 },
  // Music — free: Ambient, Piano, LoFi, Warm Strings, Harp.
  { id: "pad", label: "Ambient", cat: "music", tier: "free", src: "/sounds/Ambient.flac", rms: -18.9, peak: -11.3, trim: 1 },
  { id: "piano", label: "Piano", cat: "music", tier: "free", src: "/sounds/Piano.flac", rms: -37.5, peak: -15.5, trim: -1 },
  { id: "lofi", label: "LoFi", cat: "music", tier: "free", src: "/sounds/LoFi.flac", rms: -19.8, peak: -10.7, trim: 0.5 },
  { id: "strings", label: "Warm Strings", cat: "music", tier: "free", src: "/sounds/WarmStrings.flac", rms: -19.7, peak: -11.3 },
  { id: "harp", label: "Harp", cat: "music", tier: "free", src: "/sounds/Harp.flac", rms: -25.7, peak: -11.3, trim: -1 },
  { id: "bowls", label: "Singing Bowls", cat: "music", tier: "premium", src: "/sounds/SingingBowls.flac", rms: -17.7, peak: -10.8 },
  { id: "kalimba", label: "Kalimba", cat: "music", tier: "premium", src: "/sounds/Kalimba.flac", rms: -18.4, peak: -9.9 },
  { id: "flute", label: "Flute", cat: "music", tier: "premium", src: "/sounds/Flute.flac", rms: -20.5, peak: -11.2 },
  // Frequencies — free: White Noise, Brown Noise, 432 Hz, Binaural, Alpha.
  { id: "whitenoise", label: "White Noise", cat: "frequencies", tier: "free", src: "/sounds/WhiteNoise.flac", rms: -22.5, peak: -11.1, trim: -0.5 },
  { id: "brown", label: "Brown Noise", cat: "frequencies", tier: "free", src: "/sounds/BrownNoise.flac", rms: -39.1, peak: -21.1 },
  { id: "pad432", label: "432 Hz", cat: "frequencies", tier: "free", src: "/sounds/432Hz.flac", rms: -16.2, peak: -1.8 },
  { id: "binaural", label: "Binaural", cat: "frequencies", tier: "free", src: "/sounds/Binaural.flac", rms: -26.5, peak: -12.0 },
  { id: "alpha", label: "Alpha", cat: "frequencies", tier: "free", src: "/sounds/Alpha.flac", rms: -18.8, peak: -11.3 },
  { id: "green", label: "Green Noise", cat: "frequencies", tier: "premium", src: "/sounds/GreenNoise.flac", rms: -15.9, peak: -8.4, trim: 0.5 },
  { id: "theta", label: "Theta", cat: "frequencies", tier: "premium", src: "/sounds/Theta.flac", rms: -19.7, peak: -11.3, trim: 2 },
  { id: "delta", label: "Delta", cat: "frequencies", tier: "premium", src: "/sounds/Delta.flac", rms: -16.6, peak: -8.6, trim: 1.5 },
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
