# Soundscape audio files (ElevenLabs)

The **Frequencies** tab (Brown Noise, 432 Hz, Binaural, Delta, Theta) is
synthesized live in the browser and needs no files.

The **Nature** and **Music** tabs use looping audio files. A few are synthesized
today (Rain, Ocean Waves, Wind, Ambient); the rest are marked **soon** in the app
until their file is dropped in here. To light one up: add the file at the exact
path below, then flip `soon: true` off for that entry in `app/page.tsx`
(the `SOUNDSCAPES` array). Send me the files and I'll wire them in.

## Files to add

| Tab | Option | Save the file as |
|-----|--------|------------------|
| Nature | Thunderstorm | `public/sounds/nature/thunderstorm.mp3` |
| Nature | Windchimes | `public/sounds/nature/windchimes.mp3` |
| Music | Piano | `public/sounds/music/piano.mp3` |
| Music | LoFi | `public/sounds/music/lofi.mp3` |
| Music | Singing Bowls | `public/sounds/music/singing-bowls.mp3` |
| Music | Strings | `public/sounds/music/strings.mp3` |

Optional: you can also replace the synthesized ones with ElevenLabs versions by
adding `rain.mp3` / `ocean.mp3` / `wind.mp3` (Nature) and `ambient.mp3` (Music),
and pointing those entries at the files.

## What makes a good file

- **Format:** `.mp3` (or `.m4a`), mono or stereo, ~128 kbps is plenty.
- **Length:** about **60 seconds**. The app loops it seamlessly, so it should
  **loop cleanly** — no obvious click, fade, or "seam" at the wrap point. In the
  ElevenLabs catalog these are usually labelled as loops; when generating, ask
  for a seamless/loopable ambient bed.
- **Level:** consistent, no big volume swings or a loud transient right at the
  start. The app already mixes these under the voice.
- **Keep it calm:** no sudden peaks (a thunderclap is fine, but keep it gentle
  and spread out, not a jump-scare).

## How to get them from ElevenLabs

Either route works:
1. **Catalog / library:** download a ~1-minute loopable ambient track (e.g.
   "ambient rain for meditation") and save it under the matching name above.
2. **Generate:** use Sound Effects for nature (thunderstorm, windchimes) and
   Music for the musical beds (piano, LoFi, singing bowls, strings), request a
   loopable ~60s clip, and save it under the matching name.

Drop the files in these folders (or send them to me) and they go live on the
next deploy.
