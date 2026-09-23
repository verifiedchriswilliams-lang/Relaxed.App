# Changelog

Release history for relaxed.app. The product ships on two cadences:

- **Web (continuous):** the Next.js app deploys to production on every push to
  `main` via Vercel. Because the iOS app is a thin shell over the hosted site
  (see [ios-native.md](./ios-native.md)), web changes reach every user
  immediately, including everyone already on an installed build.
- **iOS (App Store):** native-shell changes (launch screen, haptics,
  lock-screen integration, Info.plist capabilities) require an App Store build
  and Apple review.

Dates are commit dates (UTC). Exact App Store version/date boundaries should be
reconciled against App Store Connect; the native sections below reflect what each
build carried, not the review timeline.

---

## iOS — App Store releases

### 1.2.1 — released 2026-09-16 (US + Canada + EU/EEA, UK, AU, NZ)
The splash fix and the EU/international launch.
- **Corrected launch screen.** Regenerated the native `Splash.imageset` from the
  smaller-"r" source (the 1.2 binary shipped the oversized "r" because `ios:assets`
  wasn't re-run before archiving). The launch mark now has proper breathing room.
- **International availability.** With DSA trader verification passed, the app is
  now available across the EU/EEA, plus the UK, Australia, and New Zealand (42 new
  territories), on top of US + Canada. Availability is an App Store Connect setting,
  so it reached the live 1.2 build before this build; 1.2.1 carries it forward.
- All web-side work since 1.2 (the reminder fixes and warmer/personalized reminder
  copy) reaches this build automatically, as always.

### 1.2 — released 2026-09-14 (US + Canada)
Approved and released; the first build with the on-device reminder.
- **LocalNotifications plugin** (`@capacitor/local-notifications`) compiled in, so
  the daily practice reminder can actually schedule a repeating local notification
  at the user's chosen time (no server, no push tokens). This is the build the
  native-only reminder bell needed: the bell and sheet, hidden on the web, now
  appear in the app. iOS shows its permission prompt on first enable.
- **Refreshed App Store screenshots** (iPhone 6.5" + iPad 13") showing the current
  home, creation options, and history/saved screens, plus the improved iPad layout.
- All the web-side work since 1.1.1 (welcome-back removal + rotating greeting,
  reminder-as-top-right-bell, one-screen home, brand parity, the reminder toggle
  fix, and the native-only reminder gating) reaches this build automatically, since
  the app is a shell over the hosted site.

### 1.1.1 — released 2026-09-06
Native corrections plus a marketing refresh of the release notes.
- **Beveled launch screen.** The launch image now uses the app icon's exact
  Liquid-Glass "r" (extracted from the rendered icon), centered on Ink, so the
  splash matches the home-screen icon. (Launch images do not receive iOS 26's
  live icon bevel, so it is baked into the splash.)
- **Haptics registration.** The 1.1 build shipped the haptics code but skipped
  `ios:assets` / `ios:sync`, so the plugin was never compiled in. 1.1.1 registers
  `@capacitor/haptics` correctly, and the web layer resolves it via
  `registerPlugin` on the remote page.
- Release notes updated to announce the Phase 0 web features (instant start,
  recent/favorites, audio leveling) to the store audience.

### 1.1 — released
The native bridge and player hardening.
- **Lock-screen / Now Playing controls** via MediaSession: full-bleed
  per-soundscape artwork, brand-consistent metadata, play/pause/stop.
- **Wall-clock session timer** that survives the screen locking / backgrounding
  (JS timers are throttled when backgrounded).
- **iPad / larger-screen layout:** widened column, enlarged orb.
- **Calmer motion pass:** steady motifs, a single breathing clock driving the
  ring, soft screen transitions.
- Made the full Phase 0 web feature set (below) available through the shell.
- _Note:_ the beveled splash and haptics were intended here but did not function
  in the shipped build (assets/sync were skipped); both are corrected in 1.1.1.

### 1.0 — initial submission
- The thin **Capacitor iOS shell** (WKWebView over `https://relaxed.app`).
- Dark (Ink) launch splash, light status bar, safe-area insets.
- Background audio (sessions keep playing when the screen locks), configured in
  Info.plist.
- `/privacy` policy page added for App Store submission.

---

## Web — continuous (Vercel)

### 2026-09-16 — Soundscape library expanded to 24 (seamless FLAC)
- **The soundscape catalog grows from 15 to 24 beds**, eight per family: Nature
  adds Birdsong, Babbling Brook, and Campfire; Music adds Warm Strings, Kalimba,
  and Flute; Frequencies adds White Noise, Green Noise, and Alpha.
- **All beds move to seamless-looping FLAC.** The engine loops the whole decoded
  buffer, so lossy MP3/AAC leave an audible gap at the loop seam; lossless FLAC
  has none, and it plays on iOS. This is also what makes infinitely long sessions
  possible (a clean loop plays forever).
- **A free/premium split is recorded per bed** (3 free + 5 premium per family) but
  **not yet enforced — every soundscape is unlocked.** The paywall that gates the
  premium beds is a separate, later project.
- **Every bed passed a seamless-loop QA pass.** Each master was auditioned on a
  hard sample-accurate loop (the way the engine plays it) and given the crossfade
  it needed so the wrap is inaudible; formless beds take a long blend, pitched
  ones a short one, two were re-cut by the producer. Settings are recorded in
  [soundscape-loop-fixes.md](./soundscape-loop-fixes.md) and applied in one pass
  by `scripts/finalize-beds.sh`.
- **Levels are measured, not guessed.** All 24 were normalized from measured RMS +
  true peak + a K-weighted (LUFS) perceptual trim, so no bed overpowers the voice
  and they sit at equal perceived loudness (`scripts/measure-beds.mjs`).
- Under the hood: `tier` field on the catalog and a FLAC-aware upload pipeline.
- **The reminder copy is warmer and more varied,** expanded from three lines to
  seven, and now **greets you by name** when one is saved ("Chris, a little calm
  is waiting.") — falling back to a name-free line otherwise. The name is read
  on-device and never leaves it.
- **The notification title is now brand-aware** ("relaxed" for relaxed,
  "ElevenMind" for ElevenMind). It was hardcoded to "relaxed", which would have
  mislabeled an ElevenMind notification.

### 2026-09-15 — Fix: allowing notifications from the bell now schedules the reminder
- **Granting permission from the reminder sheet asked, but never armed the
  schedule.** `openReminder` requested permission yet didn't schedule, so a user
  who enabled a reminder and *then* allowed notifications (without also touching
  the time or toggle afterward) got permission but no scheduled notification, and
  nothing fired. `openReminder` now re-applies the reminder (`saveReminder`),
  which requests permission *and* schedules when granted. The prompt still only
  appears once, so re-applying on open is a no-op when already allowed.

### 2026-09-14 — Fix: the reminder now asks for notification permission
- **A reminder could be set without ever prompting for notification permission,**
  so it silently never fired (with notifications off at the OS level, there was
  no way for it to deliver). Permission is now requested in context: the iOS
  prompt shows when the reminder is turned on, and again when the bell is
  reopened on an enabled reminder that hasn't been granted yet — so a reminder
  that was set before permission was asked gets a chance to ask. If permission
  was denied (iOS only prompts once), the sheet points the user to Settings.

### 2026-09-14 — Fix: the reminder sheet closed while setting the time (iOS)
- **Changing the hour or minute closed the whole reminder sheet** as if "done"
  had been tapped, before the user could finish. Two iOS interactions were to
  blame: the backdrop closed on any click that reached it (including the stray
  click the native time picker fires when it dismisses), and the time field was
  briefly `disabled` on each change, which force-dismissed the open picker
  mid-adjust. Now the backdrop closes only on a deliberate tap that both starts
  and ends on it, and the time field stays live during its (quick, idempotent)
  save. The sheet closes only via "done" or a real tap outside.

### 2026-09-14 — Daily reminder is now native-only
- **The reminder bell and sheet are hidden on the web** (both brands). The
  reminder is a native local notification, and the web has no on-device
  scheduler, so the browser control could never fire (and its preference
  wouldn't sync to the phone anyway). Rather than show a control that does
  nothing, the bell now renders only where a notification can actually be
  scheduled (`notificationsAvailable()`), so it appears in the app from 1.2 on
  and is absent on the web and pre-1.2 builds. No "saved but won't fire yet"
  messaging: the feature simply goes live once the capable build is installed.
  The now-unreachable "delivered in the app" fallback copy was removed, and the
  permission hint is brand-neutral.

### 2026-09-14 — Active-state reminder bell
- **The top-right reminder bell now shows an active state when a reminder is
  on.** With a reminder set, the bell fills in (and reads at full strength
  instead of the resting 0.7), matching the saved-session star's "filled =
  active" language, so an armed reminder is obvious at a glance from the home
  screen. Its `aria-label` becomes "Daily reminder is on". Both brands.

### 2026-09-14 — Fix: the daily-reminder toggle did nothing
- **The "remind me daily" switch was dead unless a notification could be
  scheduled that instant.** `saveReminder` forced `enabled:false` whenever it
  couldn't schedule (on the web, or before notification permission was granted),
  so the toggle flipped straight back and the preference was even saved as
  *disabled* — so it never activated later either. Now the toggle reflects the
  user's **intent**: it turns on and persists immediately, then tries to schedule
  and shows honest status ("we'll nudge you at HH:MM", a "turn on notifications in
  Settings" hint if permission was denied, or "saved, delivered in the app" on the
  web). The on-open re-sync no longer prompts for permission on launch. Regression
  test added in `tests/reminders.test.ts`.

### 2026-09-13 — Home tightened to one screen; reminder becomes a top-right bell
- **Fits on one screen again.** Trimmed the home's vertical spacing (hero padding,
  header height, the header→prompt gap, intention gaps) so it no longer overflows
  and scrolls on a normal phone. Both brands.
- **Daily reminder moved out of the footer to a top-right bell glyph** (both
  brands) — a soft, rounded hand-bell (a calm meditation bell, not a sharp alert),
  its stroke weight matched to the history orbit mark beside it so the two read as
  the same size. The orbit mark sits to its left when there is history. This
  also fixes an inconsistency where relaxed said "Reminder" and ElevenMind said
  "Daily reminder" in the footer — the UI is now identical across brands.
- **Footer:** now just the disclaimer + Contact · Privacy. On ElevenMind the
  ElevenLabs / ElevenMusic credit breaks onto two lines ("Voiced by ElevenLabs" /
  "scored with ElevenMusic") so it reads cleanly, with Contact · Privacy beneath.

### 2026-09-13 — ElevenMind flagship reads as frosted glass
- **"make your own" is now translucent on ElevenMind.** Over the aurora, the
  near-solid white slab looked stark; it's now a frosted-glass card (62% white
  with the brand's blur/saturate) so the sky shows through softly, dark label
  still fully legible. Scoped to ElevenMind; relaxed keeps its solid Bone card.

### 2026-09-13 — ElevenMind: history entry + footer links (parity)
- **History & saved are now reachable on ElevenMind.** The top-bar orbit glyph
  that opens "your sessions" was relaxed-only, so ElevenMind stored recents and
  favorites with no way to view them. It now appears on both brands (once there
  is history), and its first-reveal hint does too.
- **ElevenMind footer gains Contact + Privacy.** Its footer had only "Daily
  reminder"; it now matches relaxed with Contact (mailto) and Privacy links,
  styled in the muted footer register (base `.foot-links a` added so the anchors
  aren't browser-blue on non-relaxed brands).

### 2026-09-13 — ElevenMind home reaches parity with relaxed
- **Same home information architecture on both brands.** The compact, editable
  greeting header (tap the name to edit) and the "make your own" flagship (above
  an "or pick a common intention" divider) were relaxed-only; ElevenMind still had
  a standing name-field box and showed "Make Your Own" as a plain tile at the
  bottom of the list. Both are now shared. ElevenMind keeps its own visual world
  (aurora, glass, coloured intention orbs) and its ElevenLabs / ElevenMusic
  attribution; relaxed is unchanged (text-only intentions, Bone flagship).

### 2026-09-13 — Home footer links reachable on every device
- **Fixed: Reminder / Contact / Privacy could be unreachable.** The night home is
  a locked, single screen; on a short device its content overflowed and the
  footer was clipped off the bottom, and on a notched device the links tucked
  under the home indicator. The footer now clears the bottom safe area, and the
  home scrolls when (and only when) it can't fit, so the links are always
  reachable. It still centers on one screen when it fits.

### 2026-09-13 — Rotating greeting replaces the welcome-back check-in
- **Removed the "how are you arriving?" sheet.** Auto-assigning a session type
  from a mood tap read as clutter and wasn't intuitive. The returning-user warmth
  now lives inline: the home header greeting rotates per visit among the time of
  day and a couple of two-word welcomes ("Welcome back", "Good to see you",
  "Hello again"), always as "___, {name}". No extra screen, no tap. Both brands
  rotate the greeting for returning users (ElevenMind keeps its time-of-day
  greeting for a first-time visitor with no name yet). (The `relaxed.arriving.v1`
  storage key is retired.)

### 2026-09-13 — Better iPad layout for the sessions list
- **iPad "your sessions" now uses the space.** On large screens (≥768px) the
  history list was inheriting the phone's tight rows and hugging the top with an
  empty lower half. It now has roomier cards, larger type, and the list is
  centered as a group so the margins sit balanced (a long list still anchors to
  the top and scrolls). Scoped to relaxed; phone and ElevenMind are unchanged.

### 2026-09-12 — Phase 2 merged: longer sessions, variety, exact replay, reminders
Phase 2: continuity and depth (the soundscape-audio + infinite-session work is
still parked pending new audio files).
- **Longer sessions:** 45 and 60 minute options, with a new "extended" pacing band.
- **More variety:** two more script variants per intention (3 → 5 each), so
  meditate / sleep / flow / relax / stress-relief feel fresh far longer. (New
  common lines synthesize live until the voice cache is rebuilt.)
- **Sessions replay exactly:** each session's resolved script (words + pauses) is
  saved on-device; replaying reproduces it, revoiced, never rewritten (bespoke
  sessions no longer drift, and presets no longer re-roll a different variant).
- **Recents/saved play immediately:** tapping a saved session goes straight to the
  player instead of the tray, and End returns to the history page it came from.
- **Daily reminder:** an on-device daily practice reminder (a local notification
  at a chosen time; no server, no accounts). The native plugin lands in the 1.2
  build; the preference is stored and re-syncs when the plugin is present.
- **Welcome back check-in:** a gentle once-a-day "how are you arriving?" for
  returning users that tunes the session, fully dismissible.
- **Brand parity:** the daily reminder and welcome-back check-in now work on both
  brands (ElevenMind gets a footer reminder entry; the check-in is no longer
  relaxed-only). The other Phase 2 features were already brand-agnostic.
- **EU readiness (for 1.2):** the privacy policy now states the GDPR essentials
  (data-subject rights, international transfers, legal basis, supervisory-authority
  complaint). Remaining EU gates are App-Store-side; see the runbook checklist.

### 2026-09-12 — Hardening merged: rate limiting, tests + CI, decomposition
- **Rate limiting on the paid routes.** `/api/custom-script`, `/api/tts`, and
  `/api/generate` now enforce a per-IP fixed-window limit (`lib/rateLimit.ts`,
  tunable via `RL_*_PER_MIN`) so unauthenticated abuse can't run up provider
  spend. Best-effort per serverless instance; a shared store is the durable
  upgrade.
- **First automated tests.** A Vitest suite (54 tests) covers the pure
  audio/timing/loudness logic, history storage, and rate limiting; a CI workflow
  runs the build + tests on every PR.
- **`app/page.tsx` decomposed** from ~2,900 to ~1,920 lines: the `AudioEngine`,
  the soundscape/loudness domain, and the breath/format helpers moved to
  `lib/audio/**`, `lib/breath.ts`, and `lib/format.ts`. No behavior change.

### 2026-09-08 — Flagship "make your own" reads as primary
- The "make your own" label on the home screen is now the largest text in the
  choice area (bigger than the common intentions), so the Bone card reads as the
  primary action instead of the box shrinking its label below the intentions.

### 2026-09-08 — Status-bar overlap fix (safe-area insets)
- **Fixed:** on iPhones with a Dynamic Island / notch, the player's title + timer
  (and the home wordmark) rendered under the status bar. The app now draws edge to
  edge (`viewport-fit=cover`) and the top chrome clears the status bar via
  `env(safe-area-inset-top)`. Because the iOS shell loads the hosted page, this
  reaches installed builds on deploy, no new App Store build required.

### 2026-09-08 — History page scrolls; script model set to opus
- **Scrollable sessions list.** On the single-screen relaxed shell, the history
  page's saved + recent list is now its own inner scroller: the back-button bar
  stays fixed while the sessions scroll, so a long saved list stays fully
  reachable. (ElevenMind, which scrolls its page normally, is unchanged.)
- **Custom scripts now written by `claude-opus-5`.** The "In your words" path's
  code-default model moved from `claude-sonnet-5` to `claude-opus-5` for the
  richest script writing. `.env.example` and the docs were aligned, and the two
  other stale env defaults (`ELEVENLABS_OUTPUT_FORMAT`, the unused `SILENCE_SCALE`)
  were reconciled at the same time.

### Phase 1 — the meditation engine (merged to production)
Phase 1: "make the AI genuinely special." Merged to `main` and live.
- **Meditation Engine** (`lib/engine.ts`): the custom "In your words" session is
  now written to a structured arc (settle → body → visualization → reflection →
  close), each scene with its own second target that the app fits, so the session
  is balanced end to end. The app owns timing; Claude owns language.
- **Scene-based audio**: a per-intention envelope shapes bed intensity and voice
  presence over the session; for **sleep the voice thins out** toward the end
  while the bed continues. Applies to presets and custom.
- **"In your words" is the flagship**: under "What would you like to do?",
  "make your own" is a filled (Bone) primary card above an "or pick a common
  intention" divider, with the common intentions as quiet rows below.
- **Home header refined**: the name is an editable part of the headline (no
  standing box). First run asks "what should we call you?" with a field; a
  remembered name shows the greeting with a tap-to-edit pencil. The intentions
  section is pinned to a fixed position so it never shifts between states.
- **Recent/history entry first-reveal hint**: the first time the orbit mark
  appears (after the first session), it pulses with a small "history and saved"
  tooltip that fades in and out on the soft ease, once ever.
- **History page reworked**: titled "your sessions", **saved on top** then recent;
  any row **swipes left to delete** it. Launch-screen mark ("r") reduced ~35% (a
  native asset, lands in the next iOS build).


### 2026-09-06 — History redesign, audio leveling, tray, instant-start fix
- **History page.** Replaced the broken home "recents" stack with a dedicated
  history screen reached from an orbit-mark entry point (a proprietary
  counterclockwise "orbit run backward" glyph in the stem line language). Shows
  **recent** (rolling last 10, reverse-chronological, with time-ago and full
  detail: length · voice · accent · soundscape) and **saved** favorites (starred,
  kept indefinitely). One tap replays any session. On-device only.
- **Audio leveling.** Level-matched the male voices toward the female voices
  (~+2.5 dB perceptual), leveled all 15 soundscapes by measured LUFS (calmed the
  ocean bed especially), and level-matched the four tray voice-preview clips.
- **Tray onboarding.** First-time users get a clean slate (Nature tab, nothing
  preselected); returning users see their saved voice/accent/soundscape
  prepopulated. Dropped the "Customize" collapse in favor of exposing all options.
- **Instant-start double-intro fix.** The generated body no longer re-greets the
  user after the spoken arrival.
- **Single-screen lock** for the relaxed brand (no scroll / no rubber-band bounce).

### 2026-09-05 — Phase 0 experience
- **Instant start (Make Your Own):** Begin goes straight to the player; a fixed
  spoken arrival plays while Claude's personalized body streams in behind it.
- **Audio craft:** voice ducking (bed dips under each line, swells in the
  pauses), an arrival bloom (bed fills over ~30s), soft synthesized
  singing-bowl bells at start and close.
- **Post-session micro-feedback** ("How do you feel?") and **one-tap replay.**
- **Onboarding as ritual:** minimal tray.
- **Anonymous product analytics** (Vercel custom events; no accounts, no
  identifiers, never the name or phrase).
- **Hardening:** fixed instant-start timer overrun, a ducking scheduling edge,
  closing-line truncation, and history de-duplication.

### 2026-09-04 — Native bridge + player
- Native haptics + lock-screen Now Playing bridge; per-soundscape artwork.
- Wall-clock timer; steady motif; one-clock breathing ring; iPad layout.

### 2026-09-03 — "In your words" + App Store prep
- Enabled the bespoke "In your words" / Make Your Own path for relaxed.
- Reframed the home prompt; added in-app Contact + Privacy links; lowercased
  chrome; copy polish on the custom input.

### 2026-08-29 to 08-31 — The "stem" identity + iOS scaffold
- Applied the full **stem** brand identity as a brand-scoped reskin: dark-only
  world, lowercase "r" mark, monochrome atmosphere, per-soundscape line motifs
  inside the player ring.
- Scaffolded the **Capacitor iOS shell**.
- Added the `/privacy` page; removed em dashes from all user-facing copy.
- Calmer motion pass; deeper breathing ring.

### 2026-08-14 to 08-21 — Personalization, custom path, brand fork
- **Two-brand fork** via `NEXT_PUBLIC_BRAND` (ElevenMind / relaxed.app).
- **Custom / "In your words" path:** live Claude script + per-line TTS +
  streaming playback.
- Session-complete closing screen; karaoke transcript; 15 script variants across
  techniques; contextual default soundscape per intention.
- Play through the iOS mute switch; Vercel Web Analytics.

### 2026-08-13 — MVP scaffold
- Initial proof of concept: personalized mindfulness pipeline (Claude writes the
  script → ElevenLabs voices it → browser plays it over a soundscape with a
  breathing visual).

---

_Maintained by hand from the commit history. When cutting a release, add the
App Store version and the notable user-facing changes here._
