# relaxed.app — Roadmap

Part of the [documentation set](./README.md). Living doc. relaxed.app is the
standalone brand; elevenmind.io is the same codebase forked by
`NEXT_PUBLIC_BRAND` (see `lib/brand.ts`). Keep scope changes brand-aware.

Strategic thesis: make the *moment* exceptional, remove all friction, add private
continuity, then build the ecosystem. North star: **relaxed should feel like a
luxury object, not a wellness utility.** The wedge vs. Calm/Headspace is not a
bigger catalog, it's "tell relaxed what you need and it makes one for you."

> **Portfolio lens (2026-09-25).** relaxed is also a portfolio artifact for
> product/engineering leadership conversations. That reframes what to build next:
> optimize for demonstrating *judgment, native depth, and taste* — not scale. The
> engineering story (real-time Claude→ElevenLabs→Web-Audio pipeline, perceptual
> loudness normalization, gapless looping, the capability-detected Mac decode
> fallback, StoreKit, CI + docs discipline) already proves "can build" and
> "understands architecture." The next few releases should prove the third thing:
> **knowing what *not* to build.** So — **deeper, not wider**, and protect the
> constraints that make this elegant (no accounts, no backend, on-device state,
> minimal surface). This direction was pressure-tested against two external product
> reviews; their consensus and ours agree: **Watch over Android for portfolio,
> personalization over accounts, experience quality over content inventory.**

## Shipped

The personalized experience, its depth, and monetization are live in production:

- **Personalized pipeline** — Claude writes the script, ElevenLabs voices it,
  played over an ElevenLabs soundscape with a breathing visual + transcript.
  **Instant start:** the bed + breathing begin at once and the body streams in
  behind a short spoken arrival (no "composing" wait on the custom path).
- **Meditation Engine** — custom sessions are a structured arc
  (settle → body → visualization → reflection → close); the app owns timing,
  Claude owns language, ElevenLabs owns voice. A per-intention audio envelope
  shapes bed/voice over the session (for sleep the voice thins toward the end).
  (`lib/engine.ts`, `lib/sessions.ts`; see [audio-engine.md](./audio-engine.md).)
- **Continuity, on-device** — recents + saved (exact replay, revoiced never
  rewritten), post-session mood, a daily reminder (local notification), and a
  rotating warm greeting. All localStorage, no accounts. (`lib/history.ts`.)
- **Breadth** — 24 seamless FLAC soundscapes (Nature/Music/Frequencies, 8 each),
  free + premium voices (Her/Him × US/UK, plus 10 named premium personas) or None,
  durations 5–60 or **infinite ∞**. Loudness is measured and normalized across the
  whole voice + bed roster (`measure-beds`, `measure-voices`).
- **Monetization** — a **StoreKit 2** IAP: the **$4.99 one-time "unlock all
  premium"** (9 premium beds, 10 premium voices, infinite sessions), gated only
  where a purchase is possible so the web and pre-IAP apps are unaffected. Small
  Business Program approved (15%). See [monetization.md](./monetization.md).
- **iOS + Mac** — a Capacitor shell over the hosted site. **1.2.2 live; 1.3 (the
  IAP build) in review.** Mac ("Designed for iPad") is fully functional via a
  capability-detected WASM-FLAC decode fallback for its WKWebView. EU/EEA + UK +
  AU + NZ + US + Canada availability.
- **Brand parity** — relaxed.app and elevenmind.io run the same build at feature
  parity, with ElevenMind retaining its ElevenLabs / ElevenMusic attribution.

## Reusable foundation (why the backlog is cheaper than it looks)

The pieces the next releases lean on already exist: on-device history with full
replayable scripts + moods (`lib/history.ts`), an event hook for telemetry
(`lib/analytics.ts`), a structured session assembler (`lib/sessions.ts`), scene
envelopes + a dual-bus (voice + ambient) mixer in the audio engine, a voice-cache
builder for the free voices (`build-voice-cache.mjs`), and the Xcode project that
a Watch target / Live Activity would ride in. Most of the plan below is surfacing
and extending machinery that's already here.

## The plan (after 1.3 lands)

Ordered by effort-to-impact and demo value, not ambition. Ship momentum first,
then the big native lift.

1. **1.4 — Local personalization loop.** *Effort: S/M. Strongest retention move
   with zero new infrastructure.* After a session, capture lightweight feedback
   (👍/👎, "more/less like this") and a one-tap **"make another like this"** that
   reuses the last session's intention/voice/soundscape and nudges the next
   generation. Builds entirely on the on-device history that already exists — no
   accounts, no backend. Reframes "no accounts" from an MVP limitation into a
   deliberate product stance. Keep it invisible: no dashboard, no score, no streak.

2. **1.5 — Live Activity (Lock Screen breath clock).** *Effort: M (first native
   Swift). Highest native-credibility-per-effort, and a lower-risk warm-up for the
   Watch.* A Lock Screen / Dynamic Island Live Activity showing the breath clock +
   elapsed time during an active session. Genuinely native (WidgetKit/ActivityKit),
   independently demoable, and it exercises the Swift muscle at a fraction of the
   Watch's scope. (Home-screen streak/intention widgets are explicitly *not* in
   scope — see "Explicitly not building".)

3. **1.6 — Apple Watch companion (flagship native).** *Effort: L. The single
   strongest portfolio move: it ends the "it's a Capacitor wrapper" conversation.*
   A genuinely native **SwiftUI** app that does three things exceptionally well:
   pick a **1 / 3 / 5 / 10-minute** session, **haptic breathing guidance**, and
   write **Mindful Minutes to HealthKit**. Optionally hand a phone-generated
   session to the wrist (WatchConnectivity). **Scope discipline:** do *not* port
   relaxed.app to the Watch; the Watch version is *more* minimal than the phone.
   Standalone on-watch AI playback (an AVAudioEngine rebuild) is explicitly v2.
   watchOS can't reuse the Capacitor/Web-Audio app, so this is a net-new Swift
   build — the point is precisely that it demonstrates native depth.

**Android — strong parallel consideration.** *Effort: M. Business breadth over
portfolio depth — slot it by appetite.* The web app already runs under Capacitor,
so this is mostly the native shell + **Google Play Billing** (porting the StoreKit
entitlement) + a Play Store listing. It proves cross-platform delivery and
multi-store monetization, and there's real demonstrated demand (Android users who
can't install the iOS app today). Honest trade-off: it's more a *port* than a
net-new skill, so it moves the "can ship across platforms" axis more than the "can
build hard native things" axis that the Watch owns. Worth doing — sequence it
against 1.5/1.6 depending on whether the next conversation you're optimizing for
values breadth (ship it sooner) or native depth (Watch first). Reuses the paywall,
entitlement, and audio work wholesale.

## Quiet hygiene (do alongside, never as a headline)

Good engineering, but not release headlines. Several matter more now that the
product charges money:

- **Cache the premium voices** — they live-synth per play today, a real per-play
  cost + latency risk now that they're paid. Extend `build-voice-cache.mjs`
  (already does the free voices) to the premium roster.
- **Durable, cross-instance rate limiting** — the current limiter is per-instance
  and in-memory (`lib/rateLimit.ts`); back it with a shared store. See
  [risks-tech-debt.md](./risks-tech-debt.md).
- **Privacy-conscious product telemetry** — extend the existing `ev()` hook
  (`lib/analytics.ts`) into a small funnel: paywall exposure → purchase,
  time-to-first-audio, TTS/generation failures, completion, abandons. Instrument
  *behavior* without accounts or storing anyone's intentions — that restraint is
  itself the product-leadership story. Keep it within the
  [privacy model](./data-privacy.md).
- **Foundation** — self-host fonts, security headers/CSP, dependency scanning +
  ESLint, `AudioEngine`/UI test coverage (only pure logic is tested today), and
  remove the dead procedural-audio code.

## Depth / experience candidates (fold into releases, not standalone headlines)

Real "make the moment better" work — but hardest to *show* in a five-minute demo,
and much of it is half-built, so weave it into the releases above rather than
spending a headline on it:

- **Smarter generation arc** — make the intent→emotional-state→session-arc model a
  felt product capability, not just an engine envelope. The structured arc and
  scene envelopes already exist (`lib/sessions.ts`, `setSession`); the work is
  prompt sophistication, not new plumbing.
- **Adaptive audio over the session** — let the bed itself shift intensity / width
  / density across arrival → middle → close, using the existing `ambientScene`
  machinery. No user controls; it just feels better.
- **Spatial audio (Tier 1, web-deliverable)** — in-browser HRTF panners +
  convolution reverb for "enveloping calm" with no native build. Research done;
  native head-tracking is out (it breaks the web-shell model). See the
  [spatial-audio research brief](./spatial-audio-research.md).

## Someday (parked — revisit after paying-user signal)

- **Accounts + cross-device sync** — the biggest *business* gap, but a weak
  *portfolio* move: auth, a database, privacy-policy surface, sync conflicts, and
  entitlement sync, in exchange for "log in on another device." Deliberately
  deferred until real usage shows cross-device continuity matters; it also trades
  away the no-backend elegance. When it comes, it future-proofs the IAP.
- **Rest of the Apple ecosystem** — Siri / App Intents, standalone HealthKit
  beyond the Watch write, and **Apple Watch v2** (phone-free on-watch playback).
- **ElevenMind iPad layout pass** — its own aurora/glass large-screen design.
- **Exploration** — multi-day programs / journeys, a second script/voice provider
  for resilience (Anthropic + ElevenLabs are single points of failure today),
  availability beyond the current storefronts.

## Explicitly not building

These would cheapen the luxury-object positioning or the restraint that is the
whole point:

- **Streaks, social features, public profiles, leaderboards, badges, challenges,
  notification spam, "mindfulness scores."** Hard no — they undermine the philosophy.
- **On-device / local LLM script generation (WebLLM / quantized in-browser model).**
  A quantized model would generate materially worse scripts than Claude, balloon
  the bundle, and undermine the core differentiator. It's curiosity, not judgment —
  and saying no to it *is* the judgment signal.
- **A WebGL / shader audio visualizer.** relaxed is deliberately dark, minimal, and
  text-forward; the breathing orb's plainness is a *choice*. A fluid shader risks
  fighting the brand. (A subtle, on-brand enhancement could be revisited, but not a
  gaudy "wow" visualizer.)
- **Home-screen widgets as a headline**, a giant premium content library (more beds
  isn't the differentiator — generation is), and **tvOS** (Capacitor can't target
  it; a TV is a poor control surface for this product — highest effort, lowest ROI).
