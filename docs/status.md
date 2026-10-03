# Status & In-Flight

> **Read this first.** The living operational snapshot: what is live, what is in
> flight, and what is next. The [CHANGELOG](./CHANGELOG.md) is durable release
> history (the past); the [roadmap](./roadmap.md) is strategy (the future); this
> doc is the **now**, and it is updated the moment something changes so no finished
> work gets re-surfaced as a TODO. Keep it short and current.

_As of 2026-10-02._

## App Store state

| Version | State | What it is |
|---|---|---|
| **1.4** | **Released** (live) | Apple Watch build (standalone pacer + phone↔watch remote + soundscape line art). The native watchOS companion is live on the App Store. |
| **1.3** | **Released** (Ready for Distribution) | The live IAP build. Makes the **$4.99 premium unlock** available in production. |

## Live in production

- **Web** (`relaxed.app`): continuous deploy on push to `main` (Vercel).
- **iOS**: **1.3** is the live App Store build, premium IAP (`app.relaxed.premium`,
  Apple ID 6815434042) active and approved.
- **Premium unlock** (one-time $4.99): 9 soundscapes + 10 voices + infinite sessions.
- **Availability**: 47 countries.

## In flight

- **1.4.1 — in development** (a native build: needs an Xcode compile + resubmission).
  Planned scope: the **watch-remote motif fix** (done, in `main`), **in-app
  offer-code redemption** (done in source), and **watch line-art polish** (per-motif
  micro-animation + tighter breath sync, in progress). Web-side code deploys gated
  behind the native methods, so nothing is user-visible until the 1.4.1 build ships.

## Known issues

- **Watch remote motif (live in 1.4).** The phone-side `WatchBridgePlugin.updateState()`
  previously dropped the soundscape `motif` id when pushing state to the watch, so
  during phone↔watch remote control the watch shows the generic default motif
  instead of the per-soundscape line art (the 1.4.2 feature). Fixed in source
  (`native/ios-plugin/WatchBridgePlugin.swift` now forwards `motif`), but the **1.4
  build live on the App Store predates the fix** — it reaches users only in the next
  build (1.4.1). Cosmetic (the ring, countdown, and controls work regardless).
  Decision: ship a 1.4.1 for it, or fold the fix into 1.5. Standalone watch pacer is
  unaffected.

## Offer codes (free premium for friends/testers)

- **500 one-time-use offer codes** generated on the `app.relaxed.premium` IAP, under
  the **Free** offer. Eligibility: **"Never purchased before."** Expiry **2027-04-01**.
- Redeemed via the **App Store app → profile → Redeem Gift Card or Code** (one-time
  codes support the in-app manual field; custom codes would not). Tested end to end
  on 2026-10-02: redeeming unlocks premium immediately, no Restore needed (the
  `entitlementChanged` listener in `PremiumPlugin` fires on its own).
- Codes tracked in a private Google Sheet (name beside each code as it's assigned).
- **In-app redemption added in 1.4.1** — a "Redeem a code" button in the paywall opens
  Apple's native sheet (`PremiumPlugin.redeem()` → `AppStore.presentOfferCodeRedeemSheet`).
  Source complete; ships in the 1.4.1 build. This unlocks a **single universal custom
  offer code** (custom codes can't use the App Store manual field, only link/in-app),
  so once 1.4.1 is out you can hand out one memorable code instead of 500 discrete ones.

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
  App Store Apple Watch screenshots.

## Next up

- **Build + submit 1.4.1** on the Mac (Xcode): the motif fix, in-app redemption, and
  watch line-art polish.
- **Create the universal custom offer code** in App Store Connect once 1.4.1 is live,
  and switch the friends message to the in-app "Redeem a code" flow.
- **Apple Watch is live** — post the "Apple Watch is here" LinkedIn follow-up (teased
  "more next week" in the 2026-10-01 post).
- **1.5 candidates** (see [roadmap.md](./roadmap.md)): local personalization loop
  ("make another like this"), or Live Activity. Not yet chosen.

---

_Maintenance: update the table and the in-flight list whenever App Store state,
monetization, or a shipped/outbound item changes. When a version is approved and
released, move its narrative detail into the [CHANGELOG](./CHANGELOG.md) and leave
only the current state here._
