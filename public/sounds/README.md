# Soundscape audio files (ElevenLabs / ElevenMusic)

All 24 soundscape beds are ElevenLabs / ElevenMusic recordings, edited into
seamless loops and served as looping **FLAC** files. They are **not** committed to
git; they live in Vercel Blob and are resolved at runtime through
`NEXT_PUBLIC_BLOB_BASE_URL` (see `lib/assets.ts` and
[../../docs/infrastructure.md](../../docs/infrastructure.md)). This folder holds
this README plus any beds you keep locally for offline dev.

The three families (Nature / Music / Frequencies) are all file-based today. The
Web Audio engine still contains procedural generators (noise, tones, binaural),
but no current soundscape uses them, so they are effectively legacy.

**Why FLAC:** the engine loops the whole decoded buffer (`decodeAudioData` +
`loop = true`), so the file must be a sample-accurate seamless loop. Lossy codecs
(MP3/AAC) add encoder padding that decodes to a gap at the loop seam; FLAC is
lossless with no padding, so the loop is gapless, and it plays in iOS Safari /
WKWebView.

## The beds (paths are relative to `/sounds/`; 8 per family, 3 free + 5 premium)

| Family | Free | Premium |
|--------|------|---------|
| Nature | `Rain.flac`, `Ocean.flac`, `Birdsong.flac` | `Wind.flac`, `Thunderstorm.flac`, `Windchimes.flac`, `BabblingBrook.flac`, `Campfire.flac` |
| Music | `Ambient.flac`, `Piano.flac`, `LoFi.flac` | `SingingBowls.flac`, `Harp.flac`, `WarmStrings.flac`, `Kalimba.flac`, `Flute.flac` |
| Frequencies | `BrownNoise.flac`, `432Hz.flac`, `WhiteNoise.flac` | `Binaural.flac`, `Delta.flac`, `Theta.flac`, `GreenNoise.flac`, `Alpha.flac` |

The `src`, family, `tier`, and measured loudness (`rms`/`peak`/`trim`) for each
live in the `SOUNDSCAPES` array in `lib/audio/soundscapes.ts`. `tier` is data only
for now (everything unlocked); a later paywall project gates the premium beds.

## Adding or replacing a bed

1. Produce a seamless loop as **FLAC** (see guidance below) and name it to match
   the `src` in `SOUNDSCAPES` (or add a new entry there + a motif in
   `lib/soundMotifs.tsx`, else it falls back to the default wave).
2. Upload it to Blob: `node scripts/upload-blob.mjs public/sounds` (see
   [../../docs/operations-runbook.md](../../docs/operations-runbook.md)).
3. Measure and set its loudness trim: `node scripts/measure-beds.mjs`.

## What makes a good file

- **Format:** `.flac`, 48 kHz / 16-bit, stereo (pure-noise/single-tone beds may be
  mono to save size; keep Binaural true stereo). Lossless is required for a gapless
  loop, so **no MP3/AAC** for the final bed.
- **Length:** about **5 minutes**, looping cleanly (no click, fade, level dip, or
  seam at the wrap). The seamless loop is also what lets a session run infinitely.
- **Level:** consistent across beds (producer normalizes to a shared target with
  true-peak headroom); the app then applies its own measured per-bed trim.
- **Keep it calm:** no sudden peaks or jump-scares.
