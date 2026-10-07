# Status & In-Flight

> **Read this first.** The living operational snapshot: what is live, what is in
> flight, and what is next. The [CHANGELOG](./CHANGELOG.md) is durable release
> history (the past); the [roadmap](./roadmap.md) is strategy (the future); this
> doc is the **now**, and it is updated the moment something changes so no finished
> work gets re-surfaced as a TODO. Keep it short and current.

_As of 2026-10-07._

## App Store state

| Version | State | What it is |
|---|---|---|
| **1.4.2** | **Uploaded** (build 15, 2026-10-07) — preparing for submission | More Apple Watch: start a session from the wrist (four-intention launcher) + a watch-face widget, plus the setup-screen layout polish. In App Store Connect, needs "What's New" + Submit for Review. |
| **1.4.1** | **Released** (live) | Maintenance build (14): watch-remote motif fix, in-app offer-code redemption, watch line-art polish. |
| **1.4** | **Released** (live) | Apple Watch build (standalone pacer + phone↔watch remote + soundscape line art). The native watchOS companion is live on the App Store. |
| **1.3** | **Released** (Ready for Distribution) | The live IAP build. Makes the **$4.99 premium unlock** available in production. |

## Live in production

- **Web** (`relaxed.app`): continuous deploy on push to `main` (Vercel).
- **iOS**: **1.4.1** is the live App Store build (Apple Watch app + in-app code
  redemption); premium IAP (`app.relaxed.premium`, Apple ID 6815434042) active and approved.
- **Premium unlock** (one-time $4.99): 9 soundscapes + 10 voices + infinite sessions.
- **Availability**: 47 countries.

## In flight

- **1.4.2 uploaded to App Store Connect** (build 15, 2026-10-07) — **not yet submitted.**
  Two features: (1) the **watch-face widget** (`relaxed Watch Widget` Widget Extension,
  the "r" on the face as a one-tap launcher), and (2) **start a session from the watch** —
  the setup screen is now a launcher: the "relaxed" wordmark, a four-intention picker
  (meditate/sleep/flow/relax) that **starts on the phone** with the phone's own
  length/voice/soundscape, and a separate **just breathe** pacer (its own length picker)
  below a divider as the only thing that runs on the watch itself. Tapping an intention
  sends a `start` command the phone maps to the same `begin()` a phone tap runs.
  **To finish:** in App Store Connect, attach build 15, paste "What's New", **Submit for
  Review** (decide on expedited). **QA to do in TestFlight/on hardware:** the four pills
  need a real paired iPhone to actually start audio — the **audio-gesture** path (a
  watch-initiated start has no phone tap to unlock Web Audio; `startSession()` calls
  `unlock()` + `ensureRunning()`) is the thing to confirm.
- 1.4.1 released 2026-10-04 (expedited); the web continues to deploy continuously on
  push to `main`.
- **Web "download" strip** shipped (2026-10-07) and is live, with an `appstore_click`
  event for conversion.

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

- **Finish the universal custom offer code** in App Store Connect (if not already), and
  switch the friends message to the in-app "Redeem a code" flow now that 1.4.1 is live.
- **Spot-check 1.4.1 on your iPhone**: the paywall's "Redeem a code" button appears and
  opens Apple's sheet.
- **Apple Watch is live** — post the "Apple Watch is here" LinkedIn follow-up (teased
  "more next week" in the 2026-10-01 post).
- **1.5 candidates** (see [roadmap.md](./roadmap.md)): local personalization loop
  ("make another like this"), or Live Activity. Not yet chosen.

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
