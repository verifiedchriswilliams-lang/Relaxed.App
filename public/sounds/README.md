# Soundscape audio files (ElevenLabs)

All 15 soundscape beds are ElevenLabs recordings served as looping MP3s. They are
**not** committed to git; they live in Vercel Blob and are resolved at runtime
through `NEXT_PUBLIC_BLOB_BASE_URL` (see `lib/assets.ts` and
[../../docs/infrastructure.md](../../docs/infrastructure.md)). This folder holds
this README plus any beds you keep locally for offline dev.

The three families (Nature / Music / Frequencies) are all file-based today. The
Web Audio engine still contains procedural generators (noise, tones, binaural),
but no current soundscape uses them, so they are effectively legacy.

## The beds (paths are relative to `/sounds/`)

| Family | Options (files) |
|--------|-----------------|
| Nature | `Rain.mp3`, `Ocean.mp3`, `Wind.mp3`, `Thunderstorm.mp3`, `WindChimes.mp3` |
| Music | `Ambient.mp3`, `Piano.mp3`, `LoFi.mp3`, `Singing-Bowl.mp3`, `Harp.mp3` |
| Frequencies | `BrownNoise.mp3`, `432Hz.mp3`, `Binaural.mp3`, `Delta.mp3`, `Theta.mp3` |

The `src`, family, and measured loudness (`rms`/`peak`/`trim`) for each live in the
`SOUNDSCAPES` array in `app/page.tsx`.

## Adding or replacing a bed

1. Produce a seamless ~60s loop (see guidance below) and name it to match the
   `src` in `SOUNDSCAPES` (or add a new entry there + a motif in
   `lib/soundMotifs.tsx`).
2. Upload it to Blob: `node scripts/upload-blob.mjs public/sounds` (see
   [../../docs/operations-runbook.md](../../docs/operations-runbook.md)).
3. Measure and set its loudness trim: `node scripts/measure-beds.mjs`.

## What makes a good file

- **Format:** `.mp3` (or `.m4a`), mono or stereo, ~128 kbps is plenty.
- **Length:** about **60 seconds**, looping cleanly (no click/fade/seam at the
  wrap). When generating in ElevenLabs, ask for a seamless/loopable ambient bed.
- **Level:** consistent, no big swings or a loud transient at the start (the app
  mixes these under the voice and applies a measured trim).
- **Keep it calm:** no sudden peaks or jump-scares.
