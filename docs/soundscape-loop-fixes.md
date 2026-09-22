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
| Green Noise | Frequencies | crossfade `d=2` | ✅ |
| Theta | Frequencies | crossfade `d=1` | ✅ |
| Delta | Frequencies | crossfade `d=2` | ⏳ file pending |
| Alpha | Frequencies | crossfade `d=2` | ⏳ file pending |
| Binaural | Frequencies | crossfade `d=2` **(special: keep true L/R; test the beat carefully)** | ⏳ file pending |
| Kalimba | Music | crossfade `d=0.5` | ✅ |
| Warm Strings | Music | producer re-cutting the loop (loop point itself is off; crossfade won't fix a bad loop) | ⏳ back to producer |
| Flute | Music | **re-edit needed** — end fades to silence then jumps (bounced with a fade ending, not a loop); crossfade can't fix. Raw is a placeholder, NOT shippable. | ↩️ back to producer |
| Ambient | Music | crossfade `d=2` (sustained pad; clean, no chord doubling) | ✅ |
| Piano | Music | crossfade `d=0.3` (plucked; between harp 0.2 and kalimba 0.5) | ✅ |
| Singing Bowls | Music | crossfade `d=3` (long metallic sustain; blend clean, no two-tone ring) | ✅ |
| Harp | Music | crossfade `d=0.2` (sharp plucks, less overlap than kalimba) | ✅ |
| LoFi | Music | crossfade `d=0.2` (has melody + beat; long xfade stacked two phrases → dissonant buzz, so kept short like the plucked beds) | ✅ |
| Rain | Nature | none expected (broadband) | ⏳ test raw |
| Ocean Waves | Nature | none expected (broadband) | ⏳ test raw |
| Birdsong | Nature | none expected | ⏳ test raw |
| Wind | Nature | none expected (broadband) | ⏳ test raw |
| Thunderstorm | Nature | crossfade `d=2` (rain bed loops, but a clap near the edge made the seam abrupt) | ✅ |
| Windchimes | Nature | none expected | ⏳ test raw |
| Babbling Brook | Nature | crossfade `d=3` (faint water-texture seam; long blend since water has no rhythm to smear) | ✅ |
| Campfire | Nature | crossfade `d=2` (crackle at the head made the seam pop; random crackle blends, no dissonance risk) | ✅ |
