# relaxed.app — Roadmap

Part of the [documentation set](./README.md). Living doc. relaxed.app is the
standalone brand; elevenmind.io is the same codebase forked by
`NEXT_PUBLIC_BRAND` (see `lib/brand.ts`). Keep scope changes brand-aware.

Strategic thesis (agreed after a product review): make the *moment* exceptional,
remove all friction, add private continuity, then build the ecosystem. North
star: **relaxed should feel like a luxury object, not a wellness utility.** The
wedge vs. Calm/Headspace is not a bigger catalog, it's "tell relaxed what you
need and it makes one for you."

> **Descoped 2026-09-13.** The forward plan is deliberately three items (see
> **Active backlog**). Everything that used to sit in Phases 3–4 and "later" is
> either parked behind paying-user signal or explicitly not being built. The
> phase-by-phase history now lives in **Shipped** and in
> [CHANGELOG.md](./CHANGELOG.md).

## Shipped

The personalized experience and its depth are live in production (this was
Phases 0–2 of the original plan):

- **Personalized pipeline** — Claude writes the script, ElevenLabs voices it,
  played over an ElevenLabs soundscape with a breathing visual + transcript.
  **Instant start:** the bed + breathing begin at once and the body streams in
  behind a short spoken arrival (no "composing" wait on the custom path).
- **Meditation Engine** — custom sessions are a structured arc
  (settle → body → visualization → reflection → close); the app owns timing,
  Claude owns language, ElevenLabs owns voice. A per-intention audio envelope
  shapes bed/voice over the session (for sleep the voice thins toward the end).
  (`lib/engine.ts`, `lib/sessions.ts`; see [audio-engine.md](./audio-engine.md).)
- **The flagship + shared home** — "make your own" leads the home above the
  common intentions, with a compact, editable greeting; both brands share the
  home information architecture (relaxed: text-only, Bone; ElevenMind: aurora,
  glass, coloured orbs).
- **Continuity, on-device** — recents + saved (exact replay, revoiced never
  rewritten), post-session mood, a daily reminder (local notification), and a
  rotating warm greeting. All localStorage, no accounts. (`lib/history.ts`.)
- **Breadth** — 24 soundscapes (Nature/Music/Frequencies, 8 each), voices Her/Him
  × US/UK or None, durations 5–60, several script variants per intention.
- **iOS** — a Capacitor shell over the hosted site, live on the App Store.
  **1.2 (daily-reminder plugin + refreshed screenshots) is released for
  US + Canada.**
- **Brand parity** — relaxed.app and elevenmind.io run the same build and reach
  feature parity (home IA, greeting, history, footer), with ElevenMind retaining
  its ElevenLabs / ElevenMusic attribution.

## Reusable foundation (why the backlog is cheaper than it looks)

Client-held true silence on the audio clock (`AudioEngine.playSegments`), a
streaming path (`playStream`), a structured session assembler (`lib/sessions.ts`),
and a dual-bus (voice + ambient) mixer for ducking already exist. Presets are
largely pre-cached in Vercel Blob (only the name line is live TTS).

## Active backlog

The only planned work right now.

1. **Soundscape audio → infinite sessions + ∞ slider.** Expand to **24 seamless
   FLAC beds** (8 per family) and normalize levels (`measure-beds`). The catalog,
   the `tier` field (3 free + 5 premium, unlocked for now), and the FLAC pipeline
   are **built and staged**; everything is unlocked. This unlocks **infinite
   sessions** (a seamless loop plays as long as the person wants), surfaced as an
   **∞ stop** at the end of the duration slider
   (`5 · 10 · 15 · 20 · 30 · 45 · 60 · ∞`, kept as equal-spaced notches).
   - **Dependency:** the producer's seamless-loop masters (in progress). Once they
     land: convert to FLAC, run `measure-beds`, upload to Blob, then merge the
     staged catalog. The ∞ slider stop is the remaining small engineering.

2. **EU launch — 1.2.1.** ✅ Done. DSA trader verification passed; the EU/EEA
   (plus UK, Australia, and New Zealand) were added to availability, and 1.2.1
   (which also fixes the launch screen) is released. See the
   [operations runbook](./operations-runbook.md) EU checklist.

3. **Apple Watch — v1 companion.** A native watchOS (SwiftUI) app that rides in
   the existing Xcode project and shares the App Store listing + backend APIs:
   a **breathing-haptic pacer** on the wrist (no audio pipeline needed),
   **start / pause / end** a session that plays on the phone (WatchConnectivity),
   a **complication + quick "5-min reset"**, and optional **HealthKit Mindful
   Minutes**.
   - **Reality:** this is the one item that leaves the web stack — watchOS can't
     reuse the Capacitor / Web Audio app, so it's a net-new Swift/SwiftUI build
     (Medium effort, a skill set we don't use yet). Standalone on-watch playback
     (rebuilding the audio engine in AVAudioEngine so a session runs phone-free)
     is explicitly **v2 / someday**, not this scope.

## Someday (parked — revisit after paying-user signal; not planned)

- **relaxed+ paywall test** (~$9.99/mo or ~$59.99/yr): unlimited personalized
  sessions, all voices/soundscapes, "In your words," continuity, premium audio.
  The monetization bet, held until premium audio makes the moment worth paying
  for.
- **ElevenMind iPad layout pass** — its own aurora/glass large-screen design
  (relaxed already has one; the shared iPad treatment is relaxed-scoped).
- **Rest of the Apple ecosystem** — Widgets / Lock Screen, Siri / App Intents,
  standalone HealthKit, and **Apple Watch v2** (phone-free on-watch playback).
- **Engine refinements** — fold presets into full blueprints (needs content
  re-authoring + a voice-cache rebuild), per-scene (not just progress-based)
  audio cues, a visible session arc in the player.
- **Exploration** — multi-day programs / journeys, an accounts backend
  (e.g. Supabase) if continuity outgrows on-device storage, Android (Capacitor
  supports it), availability beyond EU + US + Canada.

## Explicitly not building

Streaks, social features, public profiles, leaderboards, notification spam, or
"AI-powered" gimmicks — they cheapen the luxury-object positioning. **tvOS** is
also off the table: Capacitor can't target it (it would be a separate native
SwiftUI app), and a TV is a poor discovery/control surface for this product —
highest effort, lowest near-term ROI of the platforms.
