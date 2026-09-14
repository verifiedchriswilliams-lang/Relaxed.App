# relaxed.app — Product Brief & Roadmap (for external review)

**Purpose of this document:** a self-contained snapshot of what relaxed.app is,
what we believe, what we've built, and the (deliberately short) work we plan to
do next. It's written to be pasted into an LLM for a critique. The specific ask
is at the very bottom.

---

## 1. What relaxed.app is

An AI-personalized mindfulness app. Instead of browsing a catalog of pre-recorded
meditations, you tell relaxed what you need in a few words (or pick an intention
and a length), and it **writes a bespoke guided session on demand**: an AI writes
the script, a neural voice speaks it, and the browser mixes that voice live over
a continuous ambient soundscape with a breathing visual and a synced transcript.

**One line:** "Tell relaxed what you need and it makes one for you."

The wedge against Calm / Headspace is explicitly *not* a bigger library. It's
that every session is generated for this person, this moment, this length, right
now.

---

## 2. First principles & brand ethos

These are the beliefs the product is built to protect. They function as guardrails
for what we will and won't do.

1. **A luxury object, not a wellness utility.** Every decision optimizes for how
   the *moment* feels: calm, crafted, unhurried, premium. We would rather do a
   few things beautifully than many things adequately.
2. **The moment first, then continuity, then ecosystem.** Make the session
   itself exceptional and frictionless before building integrations around it.
   Don't wrap Apple Watch/Widgets/etc. around an experience that still makes
   someone wait 30 seconds for a meditation to start.
3. **Bespoke over catalog.** The AI generation is the moat. The value is "a
   session written for you," not "access to content."
4. **Zero friction to start.** Tapping Begin goes straight into the session, the
   bed and breathing begin instantly and a short spoken arrival plays while the
   personalized body streams in behind it. No "composing…" wait screen on the
   custom path.
5. **Private by default, on-device.** No accounts, no logins, no server-side user
   data. Your name, your history, your saved sessions, your reminder, all live in
   local storage on your own device. Privacy is a feature, not a settings page.
6. **No manipulation mechanics.** No streaks, badges, leaderboards, social feeds,
   public profiles, or notification spam. These cheapen the luxury positioning and
   we treat them as explicitly out of scope.
7. **Craft lives in the audio.** True silence between lines (on the audio clock,
   not gappy TTS), the ambient bed ducking under the voice and swelling back in
   the pauses, an arrival that blooms from sparse to full, soft singing-bowl bells
   at the start and close, and for sleep the voice thinning out toward the end.
8. **Restraint in the interface.** Dark-only, minimal, typographic. The breathing
   orb is the one focal point. No imagery, no chrome noise.

---

## 3. How a session works (end to end)

1. **Choose.** From the home screen: "make your own" (type a few words, e.g.
   "settle my mind before a hard conversation") or a common intention (meditate,
   sleep, flow, relax). Set length; pick voice and soundscape (or accept the
   remembered defaults).
2. **Generate.** The app assembles a structured session arc, then Claude writes
   each scene to fit that arc; the voice is synthesized by ElevenLabs; the bed is
   an ElevenLabs-scored soundscape.
3. **Play.** The breathing orb and ambient bed start immediately. The guide speaks
   over the bed with real silences for breathing; a transcript follows along; a
   breath cue rises and falls with a shared breathing clock. Sessions keep playing
   with the screen locked (background audio), show lock-screen / Now-Playing
   controls, and use gentle haptics.
4. **Close & remember.** A soft bell and a "how do you feel?" micro check-in. The
   exact session is saved on-device so it can be replayed identically (revoiced,
   never rewritten) or starred to keep.

**The "Meditation Engine":** the app emits an ordered arc of scenes
(settle → body → visualization → reflection → close), each with a share of the
length, a breath feel, and an objective. The app owns *timing*, Claude owns
*language*, ElevenLabs owns *voice*. A per-intention audio envelope shapes bed
intensity and voice presence across the session.

---

## 4. Feature surface (what exists today)

- **Home:** a compact, editable greeting ("Welcome back, Chris ✎", rotating with
  the time of day); "make your own" as the flagship; the common intentions below;
  a top-right **reminder bell** (native app only) and, once there's history, a
  **history/saved glyph** beside it.
- **Make your own:** a short free-text prompt → a bespoke session.
- **Options tray:** intention, duration, voice (Her/Him/None), accent (US/UK),
  soundscape (by family), a "remember me" toggle, Begin. Minimal by default,
  detail on demand.
- **Player:** breathing orb + ring synced to the breath, transcript, per-soundscape
  motif, lock-screen controls, background audio, wall-clock timer.
- **History & saved ("your sessions"):** recents (rolling 10) + saved
  (kept), each replayable in one tap; swipe to delete.
- **Daily reminder:** an on-device local notification at a chosen time (no server);
  native app only (the bell is hidden on the web, where nothing could schedule it).
- **Durations:** 5, 10, 15, 20, 30, 45, 60 minutes.
- **Voices:** ElevenLabs Her/Him × US/UK, or None (sounds only).
- **Soundscapes:** 15, across Nature / Music / Frequencies, each with a line motif
  in the player.

---

## 5. Design & identity

- **Dark-only** world: "Ink" (#121110) ground, "Bone" (#efebe3) foreground. No
  imagery.
- **Lowercase chrome** (wordmark, labels, tile names); sentences stay sentence
  case.
- A single **"stem" mark** (a lowercase "r" reduced to one open stroke) and an
  **orbit glyph** for history.
- **No em dashes in user-facing copy** (a house rule).
- Calm motion: soft screen transitions, a breathing ring driven by one shared
  clock, no springy overshoot.

---

## 6. Architecture & platform (brief)

- **Next.js (App Router) on Vercel; no database.** All per-user state is on-device
  (localStorage).
- **Audio is Web Audio in the browser** (a dual-bus voice+ambient mixer, client-
  scheduled silences, streaming voice). Script generation and TTS are server API
  routes; presets are largely pre-cached (only the name line is live TTS), so the
  generation wait is essentially the *custom* path, not every session.
- **iOS app** is a thin **Capacitor shell** (a WKWebView over the hosted site),
  so web changes reach installed apps immediately. Native adds: dark launch,
  background audio, lock-screen controls, haptics, and (in 1.2) local
  notifications.
- **Web ships continuously** (every push to `main`); **iOS ships via the App
  Store**.
- *(There is a sibling brand, ElevenMind, that runs the same codebase with a
  different visual skin and audio-vendor attribution. This brief is about
  relaxed.app; the sibling is out of scope here.)*

---

## 7. Privacy & data posture

The app collects essentially nothing identifiable. The name a user types stays on
their device; there are no accounts. Analytics are anonymous, aggregate page/event
counts only (no identifiers, no free text, never the name or the custom phrase).
A public privacy page ships with the app.

---

## 8. Where we are today (status)

- **Web:** live in production, continuously deployed.
- **iOS:** version 1.1.1 live on the App Store; **1.2** (adds the daily-reminder
  plugin + refreshed screenshots) **is in review for the US and Canada**.
- **Availability:** US + Canada. EU is next (see backlog), gated on Apple's
  Digital Services Act "trader" verification (submitted, in review).
- The personalized pipeline, the meditation engine, instant start, the flagship
  home, on-device continuity (recents/saved/reminder), and the audio craft are
  all shipped.

---

## 9. Active backlog (the only planned work)

Deliberately three items. Everything else has been parked or cut to protect focus.

1. **Premium soundscape audio → infinite sessions + an "∞" duration.**
   Replace the current ambient beds with premium, seamless-looping audio;
   normalize levels; set loop points so there is no audible gap at the restart.
   This unlocks **infinite sessions** (the bed loops as long as the person wants),
   surfaced as an **∞ stop** at the end of the duration slider
   (5 · 10 · 15 · 20 · 30 · 45 · 60 · ∞).
   *Dependency:* sourcing the right seamless-loop source audio (in progress, not
   yet found). Once files exist, the engineering is small.

2. **EU launch (version 1.2.1).**
   Add EU countries to availability and ship 1.2.1.
   *Dependency:* Apple's DSA trader verification (submitted, in review).

3. **Apple Watch — v1 "companion."**
   A native watchOS (SwiftUI) app that shares the App Store listing and backend:
   a breathing-haptic pacer on the wrist (no audio pipeline needed), start/pause/
   end a session that plays on the phone, a complication + quick "5-min reset,"
   and optional HealthKit "Mindful Minutes."
   *Reality:* this is the one item that leaves the web stack, watchOS can't reuse
   the Capacitor/Web-Audio app, so it's a net-new Swift build (medium effort).
   Standalone on-watch playback is deliberately deferred.

---

## 10. What we'd like your feedback on

Given the ethos (Section 2), where we are (Section 8), and the three-item active
backlog (Section 9):

1. **Holes in the roadmap.** What important work is *missing* from the active
   backlog that our own first principles would demand? What are we not seeing?
2. **Sequencing.** Is the order/right? Anything that should be pulled forward or
   is a prerequisite we've overlooked?
3. **Risks to the wedge.** What most threatens the "bespoke luxury object"
   positioning, and are we under-investing anywhere to defend it (quality of the
   generated scripts, voice/audio quality, latency, trust)?
4. **Retention & differentiation** without violating principle #6 (no streaks /
   gamification / social). What healthy retention mechanics fit a luxury,
   privacy-first product?
5. **Blind spots.** Anything about accessibility, content safety (it writes
   mental-health-adjacent language on demand), internationalization, cost/margin
   of on-demand generation, or discoverability that a focused team of one is
   likely to miss.
6. **What would you cut or add** if you had to keep the active backlog to five
   items or fewer?

Be specific and opinionated. Assume a solo, AI-assisted builder who values
restraint and will not add gamification or accounts to chase growth.
