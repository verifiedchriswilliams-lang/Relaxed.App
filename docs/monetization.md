# Monetization & Apple's Paid Applications Agreement

> What signing Apple's **Paid Applications Agreement (Schedule 2)** means for the
> plans to charge — **premium soundscapes** (a digital unlock) and a possible
> **`relaxed+` subscription**. This logs the constraints so they don't get lost.
> **Not legal or tax advice** — consult an advisor before launch (the agreement
> itself says the relationship "may have important legal and/or tax consequences").

## Status

- **Paid Applications Agreement (Schedule 2):** being signed ~2026-09-16.
- **Small Business Program (SBP):** ☐ not enrolled yet (separate opt-in — do this
  to get the 15% rate).
- **Banking + tax forms:** ☐ to confirm/complete in App Store Connect.
- **In-app purchases:** none yet. The app is free; the soundscape `tier` field
  (`free`/`premium`) is data only and everything is unlocked.
- **Schedule 3 (Custom App Distribution / enterprise via Volume Content):** not
  applicable to relaxed (consumer app).

## The rules that shape our plans

### 1. In-app digital sales MUST use Apple In-App Purchase (IAP)
Premium soundscapes and any `relaxed+` subscription bought **inside the app** must
go through **StoreKit IAP** (§3.11). No Stripe / PayPal / web checkout for in-app
digital goods. So the paywall is a **native StoreKit build**, not a web change.

### 2. Commission: 30%, or 15% via the Small Business Program
- Standard commission is **30%** (§3.4(a)).
- The **Small Business Program** drops it to **15%** for developers under **$1M**
  total proceeds in the prior calendar year (§3.4(b)) — we are far under. Enrolling
  is a **separate application** (Apple approves within ~15 days of month-end); it is
  **not** automatic on signing this agreement. **Do it** — it's the biggest lever.
- Auto-renew subscriptions also drop to 15% after a customer's first paid year, but
  SBP already gives 15% from day one.
- Eligibility aggregates across **"Associated Developer Accounts"** (>50%
  owned/controlled). One account today → simple.
- **Pricing math at 15%:** ~$9.99/mo nets ≈ $8.49 before tax; ~$59.99/yr ≈ $51.

### 3. Money doesn't flow until banking + tax are set up
- Remittance is **wire-only**, paid **~45 days** after the month closes, above a
  monthly minimum threshold (§3.5).
- You must complete **bank details + tax forms + tax categorization** in App Store
  Connect (Exhibit C / §3.3), or Apple **holds your proceeds in trust**. Complete
  this **before** enabling any paid product.
- Apple collects/remits VAT/sales tax in many regions, but **you pick the tax
  category** and indemnify Apple for mistakes (§3.2).

### 4. You bear refunds
Apple can refund users (within 90 days, or for subscription/defect issues) and
**you reimburse**, including chargebacks (§6.3, §3.8(c)). Apple can withhold/offset
payouts to cover them, especially at termination (§7.1). Budget for it.

### 5. Subscription specifics (if `relaxed+` is a subscription)
- Durations weekly→annual; use **Subscription Groups** for upgrade/downgrade/
  cross-grade (§3.8).
- Must **clearly disclose** title, length, and price, and **Privacy Policy + Terms
  of Use links must be reachable in-app** (§3.8(b)). We have `/privacy`; a **Terms
  of Use** page needs adding.
- Honor the full subscription period plus any Billing Grace Period.
- **Price increases** for existing subscribers require consent in some regions, or
  auto-renew is disabled (§3.9).

### 6. The "reader" carve-out (a possible alternative model)
Audio is a listed **"reader"** category (§3.11 / Guideline 3.1.3(a)). A reader app
may let users play content **bought outside the app** (e.g. `relaxed+` sold on our
website, unlocked in-app), and — **except in the US storefront, where in-app links
to external offers are now allowed** — you may **not** market those external offers
inside the app. This is a lever to consider (sell on web, avoid the IAP cut) but is
nuanced and largely mutually exclusive with a clean IAP model. **Default plan: IAP.**

### 7. Growth tools available
- **Offer Codes** (§3.13): give free/discounted access (press, testers, promos).
- **Bundles / Complete My Bundle** (§3.14): sell multiple apps together (less
  relevant with a single app today).

## To-do before we charge (the paywall project)

1. **Enroll in the App Store Small Business Program** (→ 15%).
2. **Complete banking + tax forms + tax category** in App Store Connect.
3. **Build the StoreKit IAP:** premium-soundscapes unlock (non-consumable) and/or
   `relaxed+` (auto-renewable). Include **Restore Purchases**; store the
   entitlement **on-device** (fits the no-accounts model).
4. **Add an in-app Terms of Use** link alongside `/privacy` (subscription
   requirement).
5. **Wire the `tier` gate** in `lib/audio/soundscapes.ts` to the entitlement (the
   data is already there; nothing is gated today).
6. **Decide the model** — one-time unlock vs subscription vs both — and set pricing
   with the 15% cut and refund exposure in mind.

## Content / marketing guardrails
- Don't use child-pressuring purchase language ("buy now!", "upgrade now!") aimed
  at children (§5.4). Low risk for a mindfulness app, but keep upsell copy calm and
  adult-directed.
- No em dashes in any user-facing paywall copy (house rule).

See also: [roadmap.md](./roadmap.md) ("Someday — relaxed+ paywall"),
[third-party-ip.md](./third-party-ip.md) (provider terms), and the soundscape
`tier` field in [audio-engine.md](./audio-engine.md#6-soundscapes).
