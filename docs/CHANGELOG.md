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

### 1.1.1 — in review (submitted 2026-09)
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
