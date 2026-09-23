# Soundscape loop-fix log

> Per-bed record of the seamless-loop treatment applied to the producer's masters
> before they become web beds. A hard, sample-accurate loop (the app + the loop
> tester) exposes clicks/hard-onsets that DAW loop-preview hides. Fix with
> `scripts/seamless-loop.sh <file> <d>` (crossfades the end into the start; `d` is
> the crossfade seconds). Keep this table current as each bed is confirmed.

**Rules of thumb** (revised after doing all 24 — the real split is *formless vs.
pitched*, not sustained vs. plucked)
- **Formless / broadband** (noise, rain, wind, ocean, thunder, fire, water,
  brook, and un-pitched pads/ambient): **long** crossfade, `d=2`–`3` (up to `4`),
  no downside — there's no rhythm or pitch to smear. Some (white, windchimes)
  pass clean raw.
- **Pitched or rhythmic** (anything with a defined note or beat — strings, flute,
  binaural, kalimba, harp, piano, lo-fi): **short** crossfade, `d=0.2`–`0.5`. A
  long overlap stacks two different pitches/phrases and combs into a **dissonant
  high-pitched buzz/squawk**. When a long fade buzzes, go *shorter*, never longer;
  `d=0.2` was the reliable rescue (binaural, strings, flute, lo-fi).
- **Single sustained tones are the exception** (delta, alpha, singing bowls,
  ambient): one held pitch tolerates a **long** blend (`d=2`–`3`) cleanly. It's
  *rich/beating* tones (binaural's L/R beat, bowed-string vibrato, breathy flute)
  that comb and demand the short blend.
- **Diagnosing a persistent buzz at every length:** the recipe already moves the
  seam to a continuous interior point, so a squawk that survives *both* long and
  short blends is a defect baked into the bounce (bad loop edge) — send it back to
  the producer to re-cut at a clean zero-crossing, don't keep chasing `d`.

**Status:** ✅ confirmed by ear · ⏳ expected setting, not yet confirmed · file not yet received

| Bed | Family | Loop treatment | Status |
|---|---|---|---|
| White Noise | Frequencies | none (clean raw) | ✅ |
| Brown Noise | Frequencies | crossfade `d=2` | ✅ |
| 432 Hz | Frequencies | crossfade `d=2` | ✅ |
| Green Noise | Frequencies | crossfade `d=2` | ✅ |
| Theta | Frequencies | crossfade `d=1` | ✅ |
| Delta | Frequencies | crossfade `d=3` (single low tone; d=3 A/B'd cleaner than d=2, no buzz/beating) | ✅ |
| Alpha | Frequencies | crossfade `d=3` (single tone like Delta; clean, no buzz) | ✅ |
| Binaural | Frequencies | crossfade `d=0.2` **(pure tones: long xfade combs into a buzz; kept short like LoFi. Beat still pulses — recipe blends time, not channels)** | ✅ |
| Kalimba | Music | crossfade `d=0.5` | ✅ |
| Warm Strings | Music | crossfade `d=0.2` (re-cut file; long xfade squawked/combed on the bowed pitch, only a very short blend was clean) | ✅ |
| Flute | Music | crossfade `d=0.2` (re-cut file; pitched wind tone, short blend only — long xfade squawks like strings/binaural) | ✅ |
| Ambient | Music | crossfade `d=2` (sustained pad; clean, no chord doubling) | ✅ |
| Piano | Music | crossfade `d=0.3` (plucked; between harp 0.2 and kalimba 0.5) | ✅ |
| Singing Bowls | Music | crossfade `d=3` (long metallic sustain; blend clean, no two-tone ring) | ✅ |
| Harp | Music | crossfade `d=0.2` (sharp plucks, less overlap than kalimba) | ✅ |
| LoFi | Music | crossfade `d=0.2` (has melody + beat; long xfade stacked two phrases → dissonant buzz, so kept short like the plucked beds) | ✅ |
| Rain | Nature | crossfade `d=2` (faint low rumble under the hiss; d=1 left a trace, d=2 clean) | ✅ |
| Ocean Waves | Nature | crossfade `d=1` (light blend cleared the swell seam; undetectable) | ✅ |
| Birdsong | Nature | crossfade `d=2` (chirps over ambience; blend undetectable, no doubled call) | ✅ |
| Wind | Nature | crossfade `d=2` (gusty; a gust-level mismatch caught at the seam) | ✅ |
| Thunderstorm | Nature | crossfade `d=2` (rain bed loops, but a clap near the edge made the seam abrupt) | ✅ |
| Windchimes | Nature | raw (no crossfade) — pitched chimes; both d=1 and d=0.5 dulled the attack, raw is the cleanest | ✅ |
| Babbling Brook | Nature | crossfade `d=3` (faint water-texture seam; long blend since water has no rhythm to smear) | ✅ |
| Campfire | Nature | crossfade `d=2` (crackle at the head made the seam pop; random crackle blends, no dissonance risk) | ✅ |
