# relaxed.app — Roadmap

Living doc. relaxed.app is the standalone brand; elevenmind.io is the same
codebase forked by `NEXT_PUBLIC_BRAND` (see `lib/brand.ts`). Keep scope changes
brand-aware.

Strategic thesis (agreed after a product review): make the *moment* exceptional,
remove all friction, add private continuity, then build the ecosystem. Don't spend
months on Apple integrations wrapped around an experience that still makes someone
wait 30 seconds for a meditation to start. North star: **relaxed should feel like a
luxury object, not a wellness utility.** The wedge vs. Calm/Headspace is not a
bigger catalog, it's "tell relaxed what you need and it makes one for you."

## Shipped

- Personalized pipeline: Claude writes the script, ElevenLabs voices it, played over
  an ElevenLabs soundscape with a breathing visual + transcript.
- Intentions: meditation, sleep, flow, relax, stress-relief, plus "In your words"
  (a live, bespoke script from a short phrase) — now on by default for relaxed.
- Voice Her/Him x US/UK, or None. 15 soundscapes across Nature/Music/Frequencies,
  each with a line motif in the player ring.
- Full "stem" identity, dark-only. Breathing orb synced to the breath cue.
- Native iOS app (Capacitor shell over the hosted site) — in App Store review.
- Privacy page; anonymous Vercel analytics; US + Canada; `support@relaxed.app` live;
  in-app Contact + Privacy links.

## Code we already have (so several "big" items are cheaper than they look)

- **Client-held true silence.** `AudioEngine.playSegments` schedules real silence
  between spoken lines on the audio clock with the ambient bed continuing — we
  already do "voice, silence, breath, silence, voice," not gappy `<break>` TTS.
- **A streaming path.** `AudioEngine.playStream` voices lines as it plays.
- **A structured session assembler.** `lib/sessions.ts` `assembleSession` already
  builds arrival/body/close with duration-band pacing — the "meditation engine"
  skeleton exists.
- **A dual-bus mixer.** Separate voice + ambient buses exist to build ducking on.
- Presets are largely pre-cached in Vercel Blob (only the name line is live TTS),
  so the 10-40s wait is essentially the **custom** path, not every session.

## Phase 0 — make the existing product feel expensive (do first)

Phase 0 web work is complete and lives on the `phase0-web` branch (preview only;
not yet merged to production). Remaining Phase 0 items are the native/App Store
follow-ups noted at the end.

- ✅ **Instant start (Make Your Own).** Tapping Begin goes straight to the player:
  the bed + breathing orb start at once, a short fixed arrival is spoken through the
  existing TTS path, and Claude's personalized body streams in behind it. No
  "composing" screen, no 10-40s wait. (`playCustomStream` in app/page.tsx.)
- ✅ **Audio craft.** Voice ducking (the bed dips under each line and swells back in
  the long pauses), an arrival bloom (bed comes in sparse then fills over ~30s), and
  soft synthesized singing-bowl bells at start and close. Built on the existing bus.
  Scene-mapped bed intensity tied to script sections is a later refinement.
- ✅ **Onboarding as ritual, not config.** The tray opens minimal — intention,
  duration, Begin — with voice/soundscape folded behind a "Customize" row that shows
  the current pick at a glance (e.g. "Her · Ocean Waves") and expands on demand.
- ✅ **Post-session micro-feedback + Replay.** One-tap "How do you feel?" on the
  closing screen and a "recent" list on the home screen that restores every choice
  with one tap. Both on-device (localStorage), no accounts. (lib/history.ts.)
- ✅ **Lightweight anonymous event analytics** (session start/complete/abandon,
  replay, feedback) via Vercel custom events. No accounts, no identifiers, no free
  text — never the name or the custom phrase, only the shape. (lib/analytics.ts.)
- ✅ **iPad / Mac layout:** widened column + enlarged orb on tablet-plus screens.
- ✅ **iOS build-2 native changes** (splash cross-fade + beveled launch mark), shipped
  in the 1.1 build.
- Polish: continue refining orb motion, typography/spacing, generation states.
- Native follow-ups still open: none blocking; revisit lock-screen richness and
  further haptics as the native app iterates.

## Phase 1 — make the AI genuinely special (the moat)

- **Meditation Engine.** Have the system emit a structured session (emotional
  objective, pacing, breath pattern, opening/body/visualization/reflection/close,
  audio cues); Claude fills each part to explicit constraints. The app owns timing;
  Claude owns language; ElevenLabs owns voice. Extends `assembleSession`.
- **Scene-based sessions** (adaptive audio experiences, esp. sleep: voice thins out,
  ambient continues).
- **Make "In your words" the flagship** — "Tell relaxed what you need."

## Phase 2 — private continuity (retention without gamification)

- **Optional Sign in with Apple.** Anonymous mode stays fully functional; Private
  mode unlocks history, favorites, replay library, preferences, cross-device.
- **Welcome Back / mood check-in**: "How are you arriving?" tunes the session.
- Memory is transparent and useful ("Again? 10 min · Relax · Rain"), never
  surveillant. No streaks, badges, or leaderboards.

## Phase 3 — monetize (overlaps Phase 2)

- Test **relaxed+** (~$9.99/mo or ~$59.99/yr): unlimited personalized sessions, all
  voices/soundscapes, "In your words," continuity, premium audio. Sell "your own
  meditation whenever you need it," not "AI." Validate willingness to pay before the
  large ecosystem build, but not before Phase 0 makes the moment worth paying for.

## Phase 4 — Apple ecosystem (after product-market signal)

Order by behavioral value:
1. **Apple Watch** (strongest retention play — where people actually meditate).
2. **Widgets / Lock Screen** ("5-min reset," "What do you need?").
3. **Siri / App Intents** ("Hey Siri, give me five minutes to reset").
4. **HealthKit** Mindful Minutes (invisible infrastructure, not a headline).
5. **iPad** optimized layout — already universal, so a layout job, not a new app.
   Minimalism makes the big canvas gorgeous (enormous orb, generous negative space).
6. **tvOS** — deferred. Capacitor can't target tvOS, so it's a **separate native
   SwiftUI app** hitting the same APIs. TV is a great playback surface but a poor
   discovery/control surface; build only if data shows people want phone-to-TV
   sessions. Highest effort, lowest near-term ROI of the platforms.

## Explicitly not building

Streaks, social features, public profiles, leaderboards, notification spam, or
"AI-powered" gimmicks. They cheapen the luxury-object positioning.

## Later / exploration

- Multi-day programs / journeys.
- Accounts backend (e.g. Supabase) if continuity outgrows on-device storage.
- Android (Capacitor already supports it).
- Broaden availability beyond US + Canada (watch EU trader / DSA obligations).
