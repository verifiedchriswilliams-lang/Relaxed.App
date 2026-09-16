// Shared audio-domain types, used by the soundscape catalog, the loudness
// helpers, the playback engine, and the player UI. Kept dependency-free so any
// of those can import it without pulling in the others.

// The soundscape identifiers. "nature" and "music" beds are ElevenLabs recordings
// that load as looping audio files; "frequencies" are also ElevenLabs recordings
// now. `drone`/`pink`/`white` remain in the type for the engine's legacy
// synthesis path even though they are not currently surfaced in the tray.
export type Soundscape =
  | "silence"
  | "rain"
  | "ocean"
  | "birdsong"
  | "wind"
  | "thunder"
  | "windchimes"
  | "brook"
  | "campfire"
  | "pad"
  | "piano"
  | "lofi"
  | "bowls"
  | "harp"
  | "strings"
  | "kalimba"
  | "flute"
  | "brown"
  | "pad432"
  | "whitenoise"
  | "binaural"
  | "delta"
  | "theta"
  | "green"
  | "alpha"
  | "drone"
  | "pink"
  | "white";

export type SoundCat = "nature" | "music" | "frequencies";

export type Accent = "us" | "uk";

// Free vs premium. Data only for now: everything is unlocked and playable. The
// paywall (StoreKit entitlement) is a separate project that will gate "premium"
// beds; until then this just records the intended split.
export type SoundTier = "free" | "premium";

export interface SoundDef {
  id: Soundscape;
  label: string;
  cat: SoundCat;
  tier?: SoundTier; // free (unlocked) vs premium (gated once the paywall ships)
  src?: string; // looping audio file (ElevenLabs); absent => synthesized
  soon?: boolean; // asset not added yet; shown but disabled
  // Measured loudness of the file (dBFS): integrated RMS and true peak. Used to
  // normalize every bed to the same perceived level without clipping.
  rms?: number;
  peak?: number;
  // Per-bed perceptual trim (dB), same idea as the voices: equal RMS is not
  // equal loudness. A bright / hissy bed (broadband HF, e.g. ocean) reads louder
  // than its RMS, so a negative trim pulls it down; a dull / low-frequency bed
  // reads quieter and can take a positive trim. Tune from measured LUFS.
  trim?: number;
}
