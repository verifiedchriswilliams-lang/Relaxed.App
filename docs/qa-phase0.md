# Phase 0 web — QA checklist (`phase0-web` preview)

Run this on the **Vercel preview** for `phase0-web`, ideally on a **real phone**
(the audio and haptics need a device, not a desktop tab). Nothing here is live on
relaxed.app until the branch is merged.

Open the preview: Vercel dashboard → relaxed project → Deployments → the
`phase0-web` build → Visit.

## 1. Instant start (the big one)
1. Home → **Make Your Own** → type a phrase (e.g. "a big presentation tomorrow").
2. Tap **Begin Session**.
   - ✅ You land on the player **immediately** — bed sound + breathing orb start
     at once. No "composing" screen, no spinner wait.
   - ✅ A soft **bell**, then a short spoken **arrival** ("Let's begin, …") within
     a couple of seconds.
   - ✅ The personalized guide fades in **behind** the arrival a few seconds later,
     with the transcript filling in.
3. Let it run to the end (use a 3-min session to keep it quick).
   - ✅ The guide's **closing line finishes** before the session ends — it is NOT
     cut off by the closing bell / "Well done" screen.

## 2. Audio craft
- ✅ While the guide speaks, the **bed dips** a little; in the long pauses it
  **swells back up**. It should feel like breathing, not pumping.
- ✅ The bed comes in **gently** (sparse → full over the first ~30s), not at full
  blast instantly.
- ✅ A **soft bell** at the start and a **lower bell** at completion.

## 3. Post-session feedback
- On the **Well done** screen: ✅ "How do you feel?" with three taps
  (much calmer / a little calmer / about the same).
- Tap one → ✅ it's replaced by a quiet "Thank you, noted just for you."

## 4. Replay
- After finishing (or starting) a session, go **Home**.
  - ✅ A **recent** list appears with your session(s).
  - ✅ Tapping one restores every choice and opens the tray ready to Begin.
  - ✅ A long custom phrase truncates with "…", it doesn't overflow the row.

## 5. Onboarding as ritual
- Pick any intention → ✅ the tray opens **minimal**: intention, duration, Begin.
- ✅ A **Customize** row shows the current pick ("Her · Ocean Waves"); tapping it
  expands voice + soundscape + Remember.
- ✅ You can start a session **without ever opening Customize** (good defaults).

## 6. Nothing regressed
- ✅ A normal **preset** session (Sleep / Relax / etc.) still composes and plays.
- ✅ **None (sounds only)** still plays a pure soundscape.
- ✅ Pause/resume, End, and lock-screen controls still work.

## Known limitations (by design, not bugs)
- The spoken arrival is a fixed opening; the personalized part is the body.
- Feedback and recent history are **on this device only** (localStorage) — they
  don't sync across devices and clear if site data is cleared.
- Scene-mapped bed intensity (bed changes with the script's sections) is a later
  refinement; today the bed blooms in and fades out.

If all of the above holds, the branch is good to merge to `main` (which is when it
goes live on relaxed.app and, through the shell, in the iOS app).
