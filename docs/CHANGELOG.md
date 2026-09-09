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

### Unreleased — `phase2` branch (in preview)
Phase 2: private continuity and depth. Built on a branch for review, not deployed.
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

### Unreleased — `phase1-engine` branch (in preview)
Phase 1: "make the AI genuinely special." Built on a branch for review, not yet
merged to production.
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
