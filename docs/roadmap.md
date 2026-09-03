# relaxed.app — Roadmap

Living doc. Captures what's shipped, what's next, and the bigger bets to make the
product feel genuinely premium. relaxed.app is the standalone brand; elevenmind.io
is the same codebase, forked by `NEXT_PUBLIC_BRAND` (see `lib/brand.ts`). Keep
scope changes brand-aware.

## Shipped

- Personalized session pipeline: Claude writes the script → ElevenLabs voices it →
  played over an ElevenLabs soundscape with a breathing visual + transcript.
- Intentions: meditation, sleep, flow, relax, stress-relief, plus "Make Your Own"
  (a live, bespoke script from a short phrase).
- Voice: Her / Him × US / UK accents, or None (sounds only).
- 15 soundscapes across Nature / Music / Frequencies, each with its own line motif
  in the player ring.
- Full "stem" identity, dark-only. Breathing orb synced to the breath cue.
- Native iOS app (Capacitor shell over the hosted site) — in App Store review.
- Privacy policy page; anonymous Vercel Web Analytics; US + Canada availability.
- `support@relaxed.app` email live.

## Next (near-term)

- **iPad-optimized layout.** The app is already universal; tune the responsive
  layout for tablet width (wider composition column, larger orb, no stretched
  single-column look). Verify on a real iPad.
- **tvOS app.** A big-screen ambient/meditation experience (soundscape + breathing
  visual as a lean-back session). NOTE: Capacitor does not target tvOS, so this is
  a **separate native SwiftUI app** that calls the same Vercel APIs — a new target,
  not a reuse of the iOS shell. Scope accordingly.
- Splash cross-fade folded into iOS build 2 (`capacitor.config.ts` change already
  in repo; needs `cap sync` + re-archive).
- `/support` page (Vercel-only, no native build).
- Optional: move email to Google Workspace for native reply-as `support@`.

## Premium bets (the three biggest levers)

### 1. Kill the wait + raise the audio craft
The gap between "impressive demo" and "premium daily app" is moment-to-moment
audio and zero waiting.
- Perceived **instant start**: pre-generate / stream the opening so a session
  begins immediately instead of the current ~10–40s generate-then-play.
- **True silence + seamless crossfades** between spoken lines (today pacing leans
  on ElevenLabs `<break/>` tags, capped at ~3s).
- **Layered, evolving soundscapes** instead of a single loop; a soft start/end
  bell; gentle swells.
- Proper **lock-screen / Now Playing** controls (artwork, scrubber) and CarPlay.

### 2. A memory / continuity layer (optional Sign in with Apple)
Today every session is stateless. Premium meditation lives on habit and a sense of
relationship.
- **Optional Sign in with Apple** (low-friction, privacy-aligned) unlocks streaks,
  history, favorites, and cross-device continuity — foundation for a later
  subscription.
- Claude weaves **continuity**: "Welcome back — last night we worked on winding
  down; tonight…"
- A one-tap **mood check-in** before and after that tunes future sessions.

### 3. Deep Apple-ecosystem integration (trust + habit)
Signature "real meditation app" touches, several low-lift now that we're native.
- **Apple Health** — log Mindful Minutes for each session (credibility + retention).
- **Apple Watch** companion — haptic breathing, start a session from the wrist.
- **Sleep mode** — dim-to-black, sleep timer, auto-stop, gentler voice.
- **Widgets + Siri Shortcut** — "start my evening wind-down."

## Later / exploration

- Multi-day programs / journeys ("7 nights to better sleep") vs one-off sessions.
- Monetization: free daily session + premium unlimited / programs.
- Accounts backend (e.g. Supabase) if continuity outgrows on-device storage.
- Android (Capacitor already supports it).
- Broaden availability beyond US + Canada (watch EU trader / DSA obligations).
