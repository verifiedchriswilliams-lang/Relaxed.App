# Soundscape loop-fix log

> Per-bed record of the seamless-loop treatment applied to the producer's masters
> before they become web beds. A hard, sample-accurate loop (the app + the loop
> tester) exposes clicks/hard-onsets that DAW loop-preview hides. Fix with
> `scripts/seamless-loop.sh <file> <d>` (crossfades the end into the start; `d` is
> the crossfade seconds). Keep this table current as each bed is confirmed.

**Rules of thumb**
- **Sustained** (drones, tones, pads, strings, flute, singing bowls): long
  crossfade, `d=2` (up to `4` if needed) — no downside.
- **Plucked / rhythmic** (kalimba, harp, maybe lo-fi): short crossfade, `d=0.5`
  (dial `0.3`–`1`); too long smears/doubles a note.
- **Pure noise + broadband nature** (white, rain, wind, ocean, thunder, campfire):
  usually nothing — test raw, leave as-is if clean.

**Status:** ✅ confirmed by ear · ⏳ expected setting, not yet confirmed · file not yet received

| Bed | Family | Loop treatment | Status |
|---|---|---|---|
| White Noise | Frequencies | none (clean raw) | ✅ |
| Brown Noise | Frequencies | crossfade `d=2` | ✅ |
| 432 Hz | Frequencies | crossfade `d=2` | ✅ |
| Green Noise | Frequencies | crossfade `d=2` | ⏳ expected |
| Theta | Frequencies | crossfade `d=2` | ⏳ expected |
| Delta | Frequencies | crossfade `d=2` | ⏳ file pending |
| Alpha | Frequencies | crossfade `d=2` | ⏳ file pending |
| Binaural | Frequencies | crossfade `d=2` **(special: keep true L/R; test the beat carefully)** | ⏳ file pending |
| Kalimba | Music | crossfade `d=0.5` | ✅ |
| Warm Strings | Music | producer re-cutting the loop (loop point itself is off; crossfade won't fix a bad loop) | ⏳ back to producer |
| Flute | Music | crossfade `d=2` | ⏳ expected |
| Ambient | Music | crossfade `d=2` | ⏳ file pending |
| Piano | Music | short crossfade `~d=0.5` (plucked/decaying) | ⏳ file pending |
| Singing Bowls | Music | crossfade `d=2`+ (long sustain) | ⏳ file pending |
| Harp | Music | crossfade `d=0.2` (sharp plucks, less overlap than kalimba) | ✅ |
| LoFi | Music | TBD (may have a beat → short, or already trimmed) | ⏳ file pending |
| Rain | Nature | none expected (broadband) | ⏳ test raw |
| Ocean Waves | Nature | none expected (broadband) | ⏳ test raw |
| Birdsong | Nature | none expected | ⏳ test raw |
| Wind | Nature | none expected (broadband) | ⏳ test raw |
| Thunderstorm | Nature | none expected | ⏳ test raw |
| Windchimes | Nature | none expected | ⏳ test raw |
| Babbling Brook | Nature | none expected (broadband) | ⏳ test raw |
| Campfire | Nature | none expected (broadband) | ⏳ test raw |
