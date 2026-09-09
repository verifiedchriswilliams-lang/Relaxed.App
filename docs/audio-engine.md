# Audio Engine & AI Pipeline

> This is the technical heart of the product: how a session is written, voiced,
> mixed, and played. The client-side `AudioEngine` (`app/page.tsx:283`) and the
> loudness/timing model are the differentiating engineering. Architecture-level
> flows are in [architecture.md](./architecture.md).

## 1. Two script paths

### A. Preset / template (`/api/generate`)

Preset intentions (meditate, sleep, flow, relax, stress-relief) are assembled from
hand-authored templates, not written live:

- `lib/sessionScripts.json` holds `Record<ContextId, ScriptLine[][]>`: **5 script
  variants per intention**, each variant a list of `ScriptLine` =
  `{ text, pause, from?, name? }`. One master template per intention serves every
  duration.
- `assembleSession(contextId, durationMin, variant)` (`lib/sessions.ts:61`):
  1. Picks a variant (rotated deterministically per user via a `variantSeq`
     counter, so repeats vary).
  2. Filters lines by duration band (`from` gates a line to longer sessions;
     `BAND_RANK` short→deep).
  3. **Stretches the pauses to fill the chosen duration**: `target =
     durationMin*60`; speech time estimated at `words / 2.2` sec; a tail of
     `min(8% of target, 25s)` of quiet is reserved; the remaining budget is
     distributed across pauses weighted by each line's base pause, clamped to
     2–120s.
- Name lines carry a literal `{name}` token and `name: true`; they are the only
  lines personalized per user.

### B. Live bespoke ("In your words", `/api/custom-script`)

The user's typed phrase (≤70 chars) becomes a session written on demand by Claude,
now on the **Meditation Engine** (see [§9](#9-the-meditation-engine-phase-1)):

- Model: `ANTHROPIC_MODEL` env, **code default `claude-opus-5`**
  (`app/api/custom-script/route.ts`). `max_tokens: 1600`, a fixed
  `SCRIPT_SYSTEM_PROMPT` (`lib/contexts.ts`), and a per-request user prompt built
  from the session **blueprint** (`buildPrompt()` + `lib/engine.ts`).
- **Prompt caching:** the fixed system prompt is sent as an `ephemeral` cache
  prefix (`cache_control`), so when sessions cluster within the cache window the
  reused prefix bills at ~0.1x input. The per-request user prompt sits after it,
  so it never invalidates the prefix. Cache hits are logged per request
  (`cache_read_input_tokens`) in the Vercel function logs. Note the model's
  output tokens dominate cost and are not cacheable, so this is a modest, mainly
  at-scale saving.
- The prompt hands Claude the arc scene by scene; the response is split on
  `[scene:key]` markers and each scene's prose is parsed with `parseBreaks()` and
  fit to that scene's own second target (`fitScene`), so the arc stays balanced.
  If no markers are emitted, it falls back to a whole-script fit.
- **Instant-start awareness:** the request carries `leadSeconds` (how many
  seconds of spoken "arrival" the client already played) and `arrivalText` (the
  exact arrival lines), so the body targets `duration − arrival` and Claude is
  told the session already began — it continues rather than greeting again.
- **Safety:** the prompt includes a crisis clause (if the phrase suggests
  self-harm, keep it gentle and grounding, suggest reaching out, never diagnose).
  See [data-privacy.md](./data-privacy.md) and [security.md](./security.md#content-safety).

### C. One line on demand (`/api/tts`)

Voices a single trimmed line (≤600 chars) to raw MP3. This powers the custom
path's line-by-line streaming. Returns `503` when no ElevenLabs key (client treats
the line as silence).

## 2. Voice resolution & synthesis

- The user picks **Her/Him** and a **US/UK** accent; the client sends both, and
  `resolveVoiceId(gender, accent)` (`lib/tts.ts:32`) maps to an ElevenLabs voice
  ID via `VOICE_TABLE`, falling back `-us → -uk` and then to a baked default:

  | Slot | Default voice ID | Env override(s) |
  |---|---|---|
  | Her · US | `7AvtJrjTNyBhBxEvNPIZ` | `ELEVENLABS_VOICE_FEMALE_US` |
  | Him · US | `6bPfTtSpgxgD0GeBVfqu` | `ELEVENLABS_VOICE_MALE_US` |
  | Her · UK | `bgU7lBMo69PNEOWHFqxM` | `ELEVENLABS_VOICE_FEMALE_UK`, `ELEVENLABS_VOICE_FEMALE` |
  | Him · UK ("Theo") | `UmQN7jS1Ee8B1czsUtQh` | `ELEVENLABS_VOICE_MALE_UK`, `ELEVENLABS_VOICE_MALE` |

- Synthesis (`lib/tts.ts`, `/api/generate`): `model_id: eleven_multilingual_v2`,
  `voice_settings { stability (env, default 0.85), similarity_boost 0.75,
  style 0.0, use_speaker_boost true, speed (env, default 1.0, clamped 0.7–1.2) }`.
- **Diligence note:** the default voice IDs live in a *private* ElevenLabs
  collection, so they resolve only under the account's own API key; a different
  key falls back to ElevenLabs preset voices. Voice provenance and licensing are
  in [third-party-ip.md](./third-party-ip.md).

## 3. Voice cache (cost & latency control)

Presets are made nearly free by pre-voicing their reusable lines:

- Every distinct **common (non-name) line** across all templates is voiced once
  per voice slot and stored as `voice-cache/<key>.mp3` on Vercel Blob.
- `key = sha1("<voiceId>\n<text>").hex.slice(0,20)` (`lib/voiceCache.ts:17`).
- `lib/voiceCacheManifest.json` (`{ "keys": [...] }`, **1,448 entries**) is loaded
  into a `Set`; `isCached(key)` is an O(1) membership test.
- At request time (`/api/generate`): cached common lines resolve to a Blob CDN
  URL (free, fast); the **name line and any uncached line** are synthesized live.
  A bounded worker pool (`TTS_CONCURRENCY`, default 4, max 6) does the live calls;
  a per-line failure yields `null` audio (the pause is kept).
- Live **name** lines are returned inline at full fidelity (`CACHE_FORMAT`,
  `mp3_44100_128`); a not-yet-cached **common** line is synthesized inline in a
  compact format (`mp3_22050_32`) to stay under Vercel's ~4.5 MB response cap.
  Cached common lines are served as Blob URLs, off the payload entirely.
- The cache is rebuilt by `scripts/build-voice-cache.mjs` (see
  [voice-cache.md](./voice-cache.md) and [operations-runbook.md](./operations-runbook.md)).

## 4. The AudioEngine (`class AudioEngine`, `app/page.tsx:283`)

A single Web Audio `AudioContext`, unlocked inside the Begin tap (and, on iOS, put
into the `playback` category so sessions play through the mute switch). The graph:

```
voice BufferSources ──► voiceGain ─────────────────────────────► destination
ambient bed (file loop or synth) ──► ambientMaster ──► ambientDuck ──► destination
                                        (level+fades)   (voice ducking)
```

- **Voice bus:** one gain node per session at the normalized voice level; every
  spoken line is a `BufferSource` through it.
- **Ambient bed:** all 15 current soundscapes (Nature, Music, and Frequencies) are
  hosted looping MP3s (`startFile`, `loop = true`) served from Blob. The engine
  also contains procedural generators, brown/white/pink noise (Paul Kellet pink),
  filtered noise with an LFO swell, sine-partial tones, and binaural (two panned
  carriers), but **no current soundscape uses them** (every bed has a `src`), so
  that synthesis path is effectively legacy/unused today. See
  [risks-tech-debt.md](./risks-tech-debt.md).
- **Bloom** (`bloomMaster`): the bed comes in sparse (0 → 82% of level over 3s)
  then fills to full over 30s, so a session opens quietly and settles.
- **Ducking** (`duckForLine`): the bed dips to ~55% (~5 dB) under each spoken
  line with a 0.3s attack and swells back to full during pauses ≥2s; ramps are
  clamped to "now" so a lagging TTS fetch never schedules in the past (a bug that
  was fixed during hardening).
- **Bells** (`playBell`): synthesized singing-bowl tones (fundamental + inharmonic
  partials, exponential decay). A 396 Hz cue opens; a 264 Hz tone (a fifth below)
  closes.

### Instant-start streaming (custom path)

`playCustomStream` runs two phases on one timeline:

1. **Arrival (immediate):** a fixed 3-line arrival (`customArrival()`) streams at
   once so the user hears a voice within a second, while the bed and breathing orb
   start.
2. **Body (parallel):** the client awaits Claude's script, then `streamInto`
   fetches/decodes each body line with a concurrency-3 pool and schedules each
   `BufferSource` in order, chaining from the current cursor, ducking per line.

If the body never arrives, the bed keeps playing; an empty body degrades to a
sounds-only session (with a note and a `custom_no_body` event). Presets use
`playSegments`, which pre-decodes all segments and schedules them on the AC clock,
holding the pauses client-side.

## 5. Loudness normalization (the "it just sounds right" work)

Equal RMS is not equal perceived loudness, so the engine combines RMS matching
with per-source perceptual trims measured offline.

- **Targets** (dBFS): `VOICE_TARGET −24`, `BED_UNDER_VOICE −33`, `BED_SOLO −19`,
  `PEAK_CEIL −1.5`.
- `normGain(rms, peak, target) = 10^(min(target−rms, PEAK_CEIL−peak)/20)` — an
  RMS match, capped so true peaks stay under the ceiling.
- **Per-voice** stats + trims (`VOICE_STATS`): the male voices are lifted ~+2.5 dB
  and one UK voice trimmed −3.5 dB, so Her/Him sit at equal perceived loudness.
- **Per-bed** trims (`SOUNDSCAPES[].trim`): all 15 soundscapes were measured by
  **LUFS (ITU-R BS.1770, via ffmpeg `ebur128`)** and trimmed to equal perceived
  loudness — e.g. the ocean bed was calmed, dull/low beds lifted.
- `bedAndVoice(voice, accent, soundscape)` computes the voice gain and bed level
  for every playback path from these tables, so loudness can't drift between the
  session, the sounds-only path, and previews.
- **Previews** are a separate unnormalized surface: tray voice-audition clips use
  `PREVIEW_GAIN` (measured per clip, target −18 LUFS, capped under −1 dBFS);
  soundscape auditions play 6s of the real bed at `BED_SOLO + trim`.
- The offline measurement tool is `scripts/measure-beds.mjs` (see
  [operations-runbook.md](./operations-runbook.md#rebalance-audio-loudness)).

## 6. Soundscapes

15 beds across three families:

- **Nature** (rain, ocean, wind, thunderstorm, windchimes), **Music** (ambient
  pad, piano, lo-fi, singing bowls, harp), and **Frequencies** (brown noise,
  432 Hz, binaural, delta, theta) are **all looping MP3 files** (ElevenLabs
  recordings) served from Blob. (The Frequencies beds were once browser-synthesized
  but are now files, like the rest; the engine's synth generators are unused.)
- `FIRST_TIME_SOUND = "rain"` is the default bed for a new user. A sounds-only
  session (voice = none) plays just the bed at the solo target with the breathing
  orb, calling neither AI provider.

## 7. Breathing model

One breathing clock drives both the orb and the on-screen cue: `BREATH_IN 6s`,
`BREATH_HOLD 2.5s`, `BREATH_OUT 6s` (a 14.5s cycle). It advances only while
playing, so pausing freezes the orb mid-breath and resumes in phase; a single
`requestAnimationFrame` loop updates a CSS variable (`--pb`) and the cue phase.

## 8. Failure & degradation summary

| Condition | Behavior |
|---|---|
| No ElevenLabs key | Session plays as guided silence over the bed (`mock: true`, preview note). |
| No Anthropic key | Custom path uses a hardcoded fallback script. |
| A line's TTS fails | That line becomes silence; its pause is preserved. |
| Empty custom body | Degrades to sounds-only; emits `custom_no_body`. |
| Screen locks (web) | A wake lock is requested; true background/locked playback needs the native app. |
| Screen locks (iOS app) | Background audio keeps playing (Info.plist `audio` mode). |

## 9. The Meditation Engine (Phase 1)

> Built on the `phase1-engine` branch. `lib/engine.ts` is the structure; the
> custom-script route fills it with Claude; the AudioEngine plays it with a
> per-intention audio envelope.

### Structure (the app owns it)

`lib/engine.ts` defines an ordered **arc of scenes** for a session:
`settle → body → visualization → reflection → close` (sleep uses its own shape:
settle → softening → drift → trail-off). Each `Scene` carries a `share` of the
length, a `breath` feel, and an `objective`. `blueprintFor(context, durationMin,
{ leadSeconds })` turns that into a `Blueprint`: each scene gets a concrete
`targetSeconds` (its share of the writeable body, after reserving the spoken
arrival) and a rough `wordBudget` (`targetSeconds × 0.33 × 2.2`).

### Language (Claude fills it)

`/api/custom-script` hands Claude the blueprint scene by scene (each with its
objective, breath, and word budget) and asks it to emit each movement prefixed by
an exact `[scene:key]` marker, continuing from the spoken arrival. The response is
split on those markers; each scene's prose is parsed into `{text, pauseAfter}`
segments and **fit to that scene's `targetSeconds`** (`fitScene`), so the arc is
balanced rather than front-loaded. If the model omits markers, it falls back to a
whole-script fit; if that is unusable, to a scene-tagged canned script. The
response is `{ segments: [{text, pauseAfter, scene}], scenes: [{key, title}] }`.

### Audio (the browser plays it) — scene-based envelope

Scene-based audio is a separate, progress-driven layer that applies to **every**
session (presets and custom), so presets get it without re-authoring. `lib/engine.ts`
exports an `AudioProfile` per context, `bed(progress)` and `voice(progress)`
multipliers over 0..1:

- **Sleep:** `voice` falls from 1 to ~0.35 across the second half while `bed`
  stays present (~0.95 → 0.85) — the guidance recedes and the sound carries the
  sleeper. This is the headline "voice thins out, ambient continues."
- **Relax / Breathe:** ease out a little sooner and softer.
- **Default:** steady, with a gentle softening in the last stretch.

In the `AudioEngine`, a new `ambientScene` gain node sits between the master
(bloom) and the duck: `bed → master → ambientScene → ambientDuck → destination`.
`setSession(profile, totalSec)` is called after `startAmbient`; then, as each line
is scheduled, `applyEnvelope(at)` computes `progress = (at − playStartTime) /
totalSec` and ramps the session voice bus toward `voiceGain × voice(progress)` and
`ambientScene` toward `bed(progress)`. The bloom and closing fade (on the master)
and the voice ducking (on the duck) are untouched, each node keeps one job.

### Flagship entry

On relaxed, the home leads with a "tell relaxed what you need" field (the bespoke
path), with presets below under "or choose a practice." See
[product-spec.md](./product-spec.md).
