# Status & In-Flight

> **Read this first.** The living operational snapshot: what is live, what is in
> flight, and what is next. The [CHANGELOG](./CHANGELOG.md) is durable release
> history (the past); the [roadmap](./roadmap.md) is strategy (the future); this
> doc is the **now**, and it is updated the moment something changes so no finished
> work gets re-surfaced as a TODO. Keep it short and current.

_As of 2026-10-08._

## App Store state

| Version | State | What it is |
|---|---|---|
| **1.4.2** | **Released** (live) | More Apple Watch: start a session from the wrist (four-intention launcher) + a watch-face widget, plus the setup-screen layout polish. Approved and launched 2026-10-08. |
| **1.4.1** | **Released** | Maintenance build (14): watch-remote motif fix, in-app offer-code redemption, watch line-art polish. |
| **1.4** | **Released** (live) | Apple Watch build (standalone pacer + phone↔watch remote + soundscape line art). The native watchOS companion is live on the App Store. |
| **1.3** | **Released** (Ready for Distribution) | The live IAP build. Makes the **$4.99 premium unlock** available in production. |

## Live in production

- **Web** (`relaxed.app`): continuous deploy on push to `main` (Vercel).
- **iOS**: **1.4.2** is the live App Store build (Apple Watch app + in-app code
  redemption + start-a-session-from-the-watch + the watch-face widget); premium IAP
  (`app.relaxed.premium`, Apple ID 6815434042) active and approved.
- **Premium unlock** (one-time $4.99): 9 soundscapes + 10 voices + infinite sessions.
- **Availability**: 47 countries.

## In flight

- **Voiced onboarding — DISABLED on production (2026-11-13), pending a better first run.**
  Phases 1 + 2 (voiced "hello": the glowing "r" speaks the welcome, then asks the name by
  **mic**, "or type instead") were shipped 2026-10-20 but the first-run experience wasn't
  good enough to sit in front of every new visitor, so it's now **gated off behind a kill
  switch** (`VOICED_HELLO_ENABLED = false` in `app/page.tsx`). The flow stays in the code,
  not triggered. Recognition design unchanged (on-device `SpeechInput` plugin, or the
  browser speech API; typing always available). **Re-enable only after** the first-run moment
  is redesigned — that redesign has now **landed on `main` (2026-11-16), dormant behind the
  flag** (global default OFF, so production is unchanged for everyone). Turn it on per-device
  for testing with the **`relaxed.app/?voiced=1`** URL override (`?voiced=0` to turn off);
  flip the global `NEXT_PUBLIC_VOICED_HELLO=1` only to launch for all. The redesign replaces
  the static-glyph welcome with the **living Ring Orb** (`components/
  RingOrb.tsx`, a WebGL component) plus a **load video** (`public/orb/intro.mp4`, the stem
  resolving into the orb) that hands off to the live orb, all in `components/VoicedHello.tsx`
  behind the same `VOICED_HELLO_ENABLED` flag. The orb reacts only to the app's own voice
  (the agent's or the app's TTS, via `engine.voiceLevel()`), never the mic. Preview the orb
  in isolation at the dev route `/ring-orb`. Supersedes the earlier `liquid-glass-orb` spike.
  **Full build landed on main (flag still off):** the complete guided flow is
  built out, name → intention → time → **soundscape** → **voice** → review → begin, with the
  orb held at the video's last-frame centre for name/intention/time, then drifting up once
  (a slow, ~2.8s zen rise) and staying raised through **soundscape**, **voice** and **review**
  so it never drops back into the copy, then back to centre for compose/session/close
  (`components/VoicedHello.tsx`). It is driven by an **ElevenLabs guided agent**
  (`lib/voiceAgent.ts`, `@elevenlabs/client`, agent id in `NEXT_PUBLIC_ELEVENLABS_AGENT_ID`;
  spec in [voice-agent-spec.md](./voice-agent-spec.md)). The agent **connects inside the "tap to
  begin" gesture with no app audio running** (iOS throws `getUserMedia` `InvalidStateError`
  otherwise) and **speaks the greeting as its first message** over the stem→orb animation, the
  way our other working ElevenLabs build does it; **tap/type is the guaranteed fallback**, so it
  works with no agent. The **session screen** uses the living
  orb with the soundscape motif in a **quieted core** (`components/PlayOrb.tsx`,
  `public/orb/calm-play.png`), breathing with the clock. **In the agent path the user's voice
  leaves the device** (processed by ElevenLabs; disclosed in the mic prompt, approved) — see
  [data-privacy.md](./data-privacy.md). The ElevenLabs agent is **built and connected**
  (id `agent_4101m7ecnkfnfwmt2bpt1by316zs`, baked default; voice Rhythm = Her/US = Charlie,
  so the app-TTS greeting matches) and currently **public**. **Still to do before launching
  for everyone:** QA via `?voiced=1` (see [qa-voiced.md](./qa-voiced.md)); add
  `NSMicrophoneUsageDescription` to the iOS build (done locally 2026-11-16, needs an App
  Store submission — flag defaults off so the submitted build is unchanged in behavior);
  secure the agent (signed URLs + `NEXT_PUBLIC_ELEVENLABS_AGENT_PRIVATE=1`, token route
  `/api/eleven-token` is ready); optional intro-video poster frame; then flip the global
  flag on. A native release would be the 1.6 candidate (see
  [roadmap.md](./roadmap.md)).
  **Live-QA polish (2026-11-16, flag still off):** the load screen no longer flashes the
  classic home before the "r" (a pre-paint Ink cover, `html.vh-booting`, is set by an inline
  boot script in `app/layout.tsx` whenever the overlay will show, and released once React's
  own cover is up); the live orb's size at the video→orb hand-off was tuned to the video's
  final-frame core (`.vh-orb` height 56%); and the mic permission is now a centred card over
  the "r" that surfaces a **blocked** state. **Gotcha:** iOS Safari remembers a prior mic
  **deny per origin** and then rejects `getUserMedia` with no prompt, so a device tested
  earlier may never see the prompt again until its site permission is reset (aA → Website
  Settings → Microphone → Allow, or clear website data for relaxed.app). The radio demo
  prompts because that origin was allowed, not because of any header difference (neither
  site sets a Permissions-Policy). Safari mic state is per-origin and separate from the
  native app's `NSMicrophoneUsageDescription`.
  **Live-QA polish (2026-11-17, flag still off):** the orb now renders on a **transparent
  canvas everywhere** (`RingOrb transparent`, premultiplied coverage alpha), so there is no
  dark box behind it on the onboarding screens or the composer/player; the orb body stays
  fully opaque, so it is as bright as before. The pickers/review raise was softened (−30%, not
  −40%) and slowed to a ~2.8s zen drift, and the orb now **stays raised through review** (no
  drop into the mad-libs copy). The **composing orb** was enlarged to 300px to match the
  player and read as the same living orb, not a small placeholder. **Deferred (known, flag
  off):** classic-UI flash between "begin session" and the composing screen; soundscape/voice
  previews are louder than the agent voice; the agent keeps talking over the preview auditions
  (should fall quiet while previewing); and post-session / second-visit navigation back to the
  orb conversation (currently lands on the classic text UI).
- Nothing in Apple review. **1.4.2 approved and launched 2026-10-08** (start-from-watch +
  watch-face widget + setup-screen layout). 1.4.1 released 2026-10-04 (expedited). The web
  continues to deploy continuously on push to `main`.
- **Worth a real-world spot-check now that 1.4.2 is live** (on your iPhone + a paired
  watch, or the sim pair): tap an intention on the watch → the phone should start that
  session and actually play audio. That's the one **audio-gesture** path we couldn't
  verify pre-release (a watch-initiated start has no phone tap to unlock Web Audio;
  `startSession()` calls `unlock()` + `ensureRunning()`). If it doesn't start audio, that's
  the first thing to look at.
- **Web "download" strip** shipped (2026-10-07) and is live, with an `appstore_click`
  event for conversion.
- **1.5 = Apple TV (tvOS) — V1 built (2026-10-07), not yet in Xcode/submitted.** A
  net-new native tvOS (SwiftUI + `AVAudioEngine`) app: pick a soundscape + length with
  the remote, then a full-screen breathing orb with the soundscape line art while the bed
  loops. Reuses the breath cadence, brand, motifs, and the measured `normGain` loudness.
  **V1 = the 15 free beds, ambient only;** guided AI voice + premium/IAP deferred to tvOS
  v2 (the voice mix/ducking port, same reason the watch shipped silent first). Source +
  full Xcode target setup in [`native/tvos/`](../native/tvos/README.md). **Built blind
  (no Mac/Xcode in the cloud), so it needs the usual add-target + build pass on the Mac**;
  one required step before sound works: set `Config.blobBase` in `Catalog.swift` to the
  Blob base URL. This reprioritizes the roadmap (tvOS pulled forward to 1.5; personalization
  loop + Live Activity shift back one) — see [roadmap.md](./roadmap.md).

## Known issues

- None open. The watch-remote motif bug that shipped in 1.4 was fixed in **1.4.1** (the
  phone plugin now forwards the soundscape `motif`).

## Offer codes (free premium for friends/testers)

- **500 one-time-use offer codes** generated on the `app.relaxed.premium` IAP, under
  the **Free** offer. Eligibility: **"Never purchased before."** Expiry **2027-04-01**.
- Redeemed via the **App Store app → profile → Redeem Gift Card or Code** (one-time
  codes support the in-app manual field; custom codes would not). Tested end to end
  on 2026-10-02: redeeming unlocks premium immediately, no Restore needed (the
  `entitlementChanged` listener in `PremiumPlugin` fires on its own).
- Codes tracked in a private Google Sheet (name beside each code as it's assigned).
- **In-app redemption is live (1.4.1)** — a "Redeem a code" button in the paywall opens
  Apple's native sheet (`PremiumPlugin.redeem()` → `AppStore.presentOfferCodeRedeemSheet`).
  This unlocks a **single universal custom offer code** (custom codes can't use the App
  Store app's manual field, only link/in-app), so one memorable code can be handed out
  instead of 500 discrete ones. The link path works on any build; the in-app button
  needs 1.4.1+.
- **Universal custom code: `TRYRELAXED`** (created 2026-10-04) — the Free offer,
  redemption limit 1,000, expiry 2027-04-01. Redeem in-app (1.4.1+) or via the link
  `https://apps.apple.com/redeem?ctx=offercodes&id=6807080633&code=TRYRELAXED`.

## Email / infra

- **chris@relaxed.app** added (2026-10-02) and confirmed receiving. It and
  **support@relaxed.app** are aliases on the Workspace user `Chris@theprob.ai`
  (relaxed.app is a secondary domain in the **theprob.ai** Google Workspace); mail
  funnels to **verifiedchriswilliams@gmail.com**. Documented in
  [infrastructure.md](./infrastructure.md#email-relaxedapp).

## Marketing / outbound

- **LinkedIn release-notes post** published **2026-10-01** — "Premium is now live on
  relaxed.app." Covered: premium via in-app purchase, 10 premium voices, 9 premium
  soundscapes, infinite sessions; now in **47 countries**; asked people to download,
  give honest feedback, and **DM for a free promo code rather than pay**. 1.4 (Apple
  Watch) teased as "more next week." Link: https://lnkd.in/gYZKTF7y
- Assets produced: LinkedIn banner (1584×396), a phone+watch App Store hero image,
  App Store Apple Watch screenshots, and "now on Apple Watch" social graphics (square
  1080×1080, portrait 1080×1350, landscape 1200×630).
- **Web:** a quiet, dismissible "download on the App Store" strip on the relaxed web
  landing (→ `apps.apple.com/.../id6807080633`) to convert social traffic to installs.
  relaxed web only; hidden inside the native app. Taps fire a shape-only
  `appstore_click` event so conversion is measurable.

## Next up

- **⚠️ Accept the revised Apple Developer Program License Agreement by 2026-11-13.**
  Admin action only (sign in to the Apple Developer account → accept the new terms). No
  code/product change: the revised sections (3.2 security terms; 3.3.8(j) Live Assistance
  API; 3.3.8(k) App Replacement Entitlement; 6.4 HomeView widgets / CarPlay; Schedule 2/3
  Group Purchases / Volume Purchasing for *subscriptions*; Schedule 2/3 tax-info reporting)
  don't touch relaxed (one-time IAP, no subscriptions, no external links, no CarPlay/
  HomeView yet). **Missing the deadline revokes access to App Store Connect, Certificates/
  Identifiers/Profiles, and the API** — which would block the next submission (tvOS 1.5).
- **App Review Guidelines (2026-10-19 revision) — assessed; tracking compliant.** The
  only code action was gating the dev query flags (`?devUnlock`/`?devGate`) out of
  production for **2.5.19** (done, shipped 2026-10-19). **1.2** (AI content): covered
  (private/on-device, guard-railed generation, published contact) with a review-note
  stance. **2.3.14** (creative assets): keep pricing/claims out of any App Store
  marketing art. **3.1.1(a)** and **5**: not applicable. Full assessment in
  [security.md](./security.md#app-review-2026-10).
- **Finish the universal custom offer code** in App Store Connect (if not already), and
  switch the friends message to the in-app "Redeem a code" flow now that 1.4.1 is live.
- **Spot-check 1.4.1 on your iPhone**: the paywall's "Redeem a code" button appears and
  opens Apple's sheet.
- **"Start from your wrist" LinkedIn post** — 1.4.2 is live (2026-10-08), so the drafted
  post (announce start-a-session-from-the-watch + the watch-face widget) is ready to go.
  Copy is drafted; optionally pair with a watch-focused graphic.
- **Spot-check start-from-watch on hardware** now that 1.4.2 is live (see In flight): tap
  an intention on the watch and confirm the phone actually starts audio.
- **1.5 = Apple TV** (chosen 2026-10-07). V1 built (`native/tvos/`); next is the Mac
  Xcode pass (add the tvOS target, set `Config.blobBase`, build in the simulator), then
  iterate. Personalization loop + Live Activity shift to 1.6 / 1.7 (see
  [roadmap.md](./roadmap.md)).

## Housekeeping

- **Local git state (Chris's Mac) — bigger than first thought (updated 2026-10-07).**
  The working copy is on branch **`iap-1.3`**, sitting exactly at `origin/main`
  (`2064405`) with no local-only commits, so builds/archives are current (1.4.2 built
  and uploaded from it). Two things to clean up **after 1.4.2 is submitted**, done
  deliberately, not rushed:
  1. **Stale staged `ios/` cruft.** `git status` shows a *partial, inconsistent* set of
     generated `ios/` files **staged** (`A`/`AM`) but never committed (e.g.
     `ExtendedRuntime.swift` staged while `Views.swift` next to it is untracked). Clear
     it with `git reset` (unstages only — no files deleted, Xcode unaffected).
  2. **`.gitignore` vs reality contradiction.** The root `.gitignore` comment says the
     `ios/` project **"should be committed EXCEPT"** Pods/build/public — but `main` does
     **not** track `ios/`, and every doc (CLAUDE.md, ios-native.md, repository-map.md)
     plus the whole `cp native/... ios/...` sync workflow assumes `ios/` is **not**
     committed. Decide which is true (practice says *not committed*) and fix the
     `.gitignore` comment to match, so this stops confusing us.
  3. Then switch the working copy to `main` (`git checkout main`; confirm it tracks
     `origin/main`) and delete the stale `iap-1.3` label.

---

_Maintenance: update the table and the in-flight list whenever App Store state,
monetization, or a shipped/outbound item changes. When a version is approved and
released, move its narrative detail into the [CHANGELOG](./CHANGELOG.md) and leave
only the current state here._
