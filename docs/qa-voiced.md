# QA — voiced first run

A thorough test pass for the voiced onboarding (behind `VOICED_HELLO_ENABLED`) before it
goes live. Work top to bottom; note anything that feels off, not just hard failures. See
[voice-agent-spec.md](./voice-agent-spec.md) and [product-spec.md](./product-spec.md).

## 0. Set up a test build

- **Local:** `NEXT_PUBLIC_VOICED_HELLO=1 npm run dev`, with `ELEVENLABS_API_KEY` and
  `ANTHROPIC_API_KEY` in `.env.local` (the agent id is baked in).
- **Shareable (recommended):** a Vercel **Preview** of `feat/voiced-onboarding-orb` with
  `NEXT_PUBLIC_VOICED_HELLO=1` added to the **Preview** environment (keys already available
  to Preview). Open the preview URL in desktop + **mobile Safari**. Production stays off.
- To reset "new user" state between runs: clear site data, or in the console
  `localStorage.clear()` then reload.

## 1. New user, voice path (mic granted)

- [ ] Load screen shows the stem "r" + "tap to begin", continuous with the splash.
- [ ] The tap unlocks audio and starts the stem→orb intro video (no silent/muted greeting).
- [ ] After the video, the orb greets in Rhythm (= Her/US) and **drifts up once**.
- [ ] Mic prompt appears at the right moment (after the greeting), grant it.
- [ ] Agent guides **name → intention → time → soundscape → voice → review**, one at a time.
- [ ] She sounds like a coach, not a form (no "you can say…", no "the screen/list").
- [ ] Intention maps correctly to the highlighted pill (sleep/flow/relax/breathe/meditate),
      and a personal phrase becomes a **custom** intention.
- [ ] Soundscape + voice: she tells you to choose on screen; tapping a pill previews audio,
      records it, and she acknowledges and moves on **without asking which one**.
- [ ] Orb stays put (up), content always below it, never overlapping.
- [ ] Review sentence is correct and every bold word is editable (pencil / tap to change).
- [ ] "remember me" toggle works; "begin" (tap or say) starts compose.
- [ ] Compose: orb **drifts down to centre**, the three steps light up, footer reads right.
- [ ] Session: orb centred, the soundscape motif glows in the **quieted core**, orb breathes
      with the cue; pause freezes it; transcript toggle works.
- [ ] Close: "well done, {name}" above the orb, mood check below, then the parting line.

## 2. New user, fallback path (mic declined / no agent)

- [ ] Decline the mic → the flow continues entirely by **tap/type**, every step reachable.
- [ ] "type instead" works for name and intention; hints are tappable; pickers work.
- [ ] The orb still reacts to the app's own TTS lines (if keys present) and is calm otherwise.

## 3. Returning user

- [ ] With a saved name + history, relaunch opens on **welcome back** (orb centred).
- [ ] Last session shows; **repeat last session** replays it; **something new** drifts the
      orb up and starts the voice flow (name skipped, greeted by name).
- [ ] History entry (top-right) is present.

## 4. Edge cases

- [ ] **Pure soundscape** (voice = none): session plays with no guide voice; core still shows
      the soundscape motif.
- [ ] **Premium locks** (if not entitled): open-ended time, premium soundscapes/voices show a
      lock; the agent/flow steers to a free choice.
- [ ] Change a choice at **review** (each editable word) → the selection and sentence update.
- [ ] Interrupt/resume: background the tab/app mid-flow and return; nothing wedged.
- [ ] Say "something else" early in intention → handled warmly, becomes custom.

## 5. Orb / motion

- [ ] Orb only ever makes **two** moves (up after forming, down at compose); no per-screen
      jumping.
- [ ] Orb reacts to the **voice** (agent's or app's), **never** the mic.
- [ ] Reduced-motion setting calms the animation (no harsh motion).

## 6. iOS app (native)

- [ ] The app loads the hosted site; the native splash → web load screen is a seamless
      stem-on-Ink moment.
- [ ] **Microphone works in the app**: this needs `NSMicrophoneUsageDescription` in the
      shipped Info.plist (WKWebView `getUserMedia`). If absent, it needs an app update —
      verify in Xcode on the Mac.
- [ ] Audio unlocks on the first tap (no silent session), including a watch-initiated start
      if relevant.

## 7. Production safety

- [ ] With the flag **off** (production default), relaxed shows the **classic** home/player
      unchanged, and **ElevenMind** is completely unaffected.
- [ ] No console errors from the orb/agent when the flag is off.

## 8. Before flipping live

- [ ] Secure the agent: enable signed URLs on the ElevenLabs agent and set
      `NEXT_PUBLIC_ELEVENLABS_AGENT_PRIVATE=1` (the `/api/eleven-token` route is ready).
- [ ] Decide on the intro-video **poster frame** (avoid a cold-load Ink gap).
- [ ] Final sign-off, then set `NEXT_PUBLIC_VOICED_HELLO=1` on **Production**.
