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
- **iOS + Mac** — a Capacitor shell over the hosted site. **1.3 (the IAP build)
  released/live; 1.4 (Apple Watch) released/live.** Mac ("Designed for iPad") is
  fully functional via a capability-detected WASM-FLAC decode fallback for its
  WKWebView. 47 countries availability.
- **Apple Watch (1.4, live)** — a net-new native **SwiftUI** companion:
  a standalone breathing-haptic pacer (1 / 3 / 5 / 10-minute, luminous orb,
  HealthKit Mindful Minutes, a mindfulness extended-runtime session, no phone
  needed), a **phone↔watch remote** over WatchConnectivity (mirror + control an
  active phone session), and the **soundscape line art** ported to a SwiftUI
  Canvas. Source in `native/watch/` (see its README).
- **Free-access offer codes** — 500 one-time StoreKit offer codes on the premium
  IAP for testers/friends, redeemed via the App Store app. Current state and the
  redemption flow live in [status.md](./status.md).
- **Brand parity** — relaxed.app and elevenmind.io run the same build at feature
  parity, with ElevenMind retaining its ElevenLabs / ElevenMusic attribution.

## Reusable foundation (why the backlog is cheaper than it looks)

The pieces the next releases lean on already exist: on-device history with full
replayable scripts + moods (`lib/history.ts`), an event hook for telemetry
(`lib/analytics.ts`), a structured session assembler (`lib/sessions.ts`), scene
envelopes + a dual-bus (voice + ambient) mixer in the audio engine, a voice-cache
builder for the free voices (`build-voice-cache.mjs`), and the Xcode project that
the Watch target (now shipped in 1.4) and a future Live Activity ride in. Most of
the plan below is surfacing and extending machinery that's already here.

## The plan (next releases)

Ordered by effort-to-impact and demo value, not ambition. The big native lift (the
Watch) has shipped; these keep the momentum.

> **Reprioritized 2026-10-07:** **tvOS was pulled forward from "Someday" to 1.5**
> (Chris's call), and the personalization loop + Live Activity each shift back one. The
> tvOS V1 is built and staged in `native/tvos/` — see its
> [README](../native/tvos/README.md) and [status.md](./status.md).

1. **1.5 — Apple TV (native, ambient V1).** *Effort: M. Net-new native platform, real
   depth, strong for sleep / ambient wind-down in the living room.* A native tvOS
   (SwiftUI + `AVAudioEngine`) app: pick a soundscape + a length with the remote, then a
   full-screen breathing orb with the soundscape line art plays across the room while the
   bed loops. Reuses the breath cadence, the brand, the motifs, and the measured loudness
   normalization (`normGain`). **Guided AI voice is deferred to tvOS v2** (the voice
   mix/ducking port, same reason the Watch shipped silent first); V1 ships the 15 free
   beds. Like the Watch it can't reuse the Capacitor/Web-Audio app, so it's genuinely
   native. Source + Xcode setup in `native/tvos/`.

2. **1.6 — Local personalization loop.** *Effort: S/M. Strongest retention move
   with zero new infrastructure.* After a session, capture lightweight feedback
   (👍/👎, "more/less like this") and a one-tap **"make another like this"** that
   reuses the last session's intention/voice/soundscape and nudges the next
   generation. Builds entirely on the on-device history that already exists — no
   accounts, no backend. Reframes "no accounts" from an MVP limitation into a
   deliberate product stance. Keep it invisible: no dashboard, no score, no streak.

3. **1.7 — Live Activity (Lock Screen breath clock).** *Effort: M. Highest
   native-credibility-per-effort.* A Lock Screen / Dynamic Island Live Activity
   showing the breath clock + elapsed time during an active session. Genuinely
   native (WidgetKit/ActivityKit) and independently demoable. (Home-screen
   streak/intention widgets are explicitly *not* in scope — see "Explicitly not
   building".)

**Android — strong parallel consideration.** *Effort: M. Business breadth over
portfolio depth — slot it by appetite.* The web app already runs under Capacitor,
so this is mostly the native shell + **Google Play Billing** (porting the StoreKit
entitlement) + a Play Store listing. It proves cross-platform delivery and
multi-store monetization, and there's real demonstrated demand (Android users who
can't install the iOS app today). Honest trade-off: it's more a *port* than a
net-new skill, so it moves the "can ship across platforms" axis more than the "can
build hard native things" axis that the Watch already owns. Worth doing — sequence
it against 1.5/1.6 by appetite: whether the next conversation you're optimizing for
values breadth (ship it sooner) or more native depth. Reuses the paywall,
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
- **Privacy-conscious product telemetry** — ✅ the conversion + generation funnel
  shipped (2026-09-29): `paywall_shown → purchase_start → purchase_success/fail`,
  `restore_*`, and `custom_body_ok`/`custom_no_body` on top of the existing
  session events, all shape-only (see [data-privacy.md](./data-privacy.md)).
  Remaining nice-to-have: **time-to-first-audio** (timing from Begin to first
  sound) and a server-side view of TTS/route failures.
- **Foundation** — self-host fonts, security headers/CSP, dependency scanning +
  ESLint, `AudioEngine`/UI test coverage (only pure logic is tested today), and
  remove the dead procedural-audio code.

## Depth / experience candidates (fold into releases, not standalone headlines)

Real "make the moment better" work — but hardest to *show* in a five-minute demo,
and much of it is half-built, so weave it into the releases above rather than
spending a headline on it:

- ✅ **Intention-aware arrival (shipped 2026-09-29).** The instant-start arrival
  and the body writer are now posture-aware (`lib/arrival.ts`): a walk / drive /
  workout is no longer met with "sit down and close your eyes." Remaining: the
  detection is keyword-based, so an odd phrasing falls back to the seated default —
  a smarter (or model-assisted) read could sharpen it later.
- **Per-persona script styles (voice personalities, part 2).** Each premium voice
  now has its **own** preview line (shipped 2026-09-29), so the reveal no longer
  feels like clones. The bigger bet is still open: cater the generated *script
  style* to each persona so the voice + words read as one guide, not a narrator
  reading a shared script. *Effort: M+.*
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
- **tvOS app** — ✅ **pulled forward to 1.5 (2026-10-07); no longer parked.** A native
  tvOS (SwiftUI + AVAudioEngine) build for the big screen: pick a soundscape with the
  remote and let a session play across the room, especially strong for **sleep** and
  ambient wind-down. V1 is built in `native/tvos/`; see "The plan" above and the
  folder's README.
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
- **Home-screen widgets as a headline** and a giant premium content library (more
  beds isn't the differentiator — generation is).
