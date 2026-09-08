// The soundscape catalog: three families (Nature / Music / Frequencies), five
// each, all ElevenLabs recordings that load as looping audio files. Measured
// loudness (rms/peak/trim) drives normalization in ./levels. Data + pure lookups
// only, so this is safe to import anywhere (routes, tests, the client).

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
  // Nature — ElevenLabs recordings (looping).
  { id: "rain", label: "Rain", cat: "nature", src: "/sounds/Rain.mp3", rms: -42.5, peak: -14.4, trim: -3 },
  { id: "ocean", label: "Ocean Waves", cat: "nature", src: "/sounds/Ocean.mp3", rms: -25.1, peak: -5.3, trim: -4 },
  { id: "wind", label: "Wind", cat: "nature", src: "/sounds/Wind.mp3", rms: -43.4, peak: -24.0, trim: -1.5 },
  { id: "thunder", label: "Thunderstorm", cat: "nature", src: "/sounds/Thunderstorm.mp3", rms: -37.9, peak: -14.5, trim: -0.5 },
  { id: "windchimes", label: "Windchimes", cat: "nature", src: "/sounds/WindChimes.mp3", rms: -32.4, peak: -16.5 },
  // Music — ElevenLabs recordings.
  { id: "pad", label: "Ambient", cat: "music", src: "/sounds/Ambient.mp3", rms: -21.7, peak: -10.4, trim: 2 },
  { id: "piano", label: "Piano", cat: "music", src: "/sounds/Piano.mp3", rms: -36.2, peak: -13.1, trim: -1 },
  { id: "lofi", label: "LoFi", cat: "music", src: "/sounds/LoFi.mp3", rms: -16.1, peak: -0.1, trim: 1 },
  { id: "bowls", label: "Singing Bowls", cat: "music", src: "/sounds/Singing-Bowl.mp3", rms: -14.6, peak: -0.4 },
  { id: "harp", label: "Harp", cat: "music", src: "/sounds/Harp.mp3", rms: -17.4, peak: -0.4, trim: -0.5 },
  // Frequencies — all ElevenLabs recordings now.
  { id: "brown", label: "Brown Noise", cat: "frequencies", src: "/sounds/BrownNoise.mp3", rms: -37.0, peak: -18.8 },
  { id: "pad432", label: "432 Hz", cat: "frequencies", src: "/sounds/432Hz.mp3", rms: -16.8, peak: -2.4 },
  { id: "binaural", label: "Binaural", cat: "frequencies", src: "/sounds/Binaural.mp3", rms: -15.9, peak: -2.7, trim: 1.5 },
  { id: "delta", label: "Delta", cat: "frequencies", src: "/sounds/Delta.mp3", rms: -12.7, peak: -0.2, trim: 2 },
  { id: "theta", label: "Theta", cat: "frequencies", src: "/sounds/Theta.mp3", rms: -17.2, peak: -2.8, trim: 2 },
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
