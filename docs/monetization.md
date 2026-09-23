# Monetization & Apple's Paid Applications Agreement

> What signing Apple's **Paid Applications Agreement (Schedule 2)** means for the
> plans to charge — **premium soundscapes** (a digital unlock) and a possible
> **`relaxed+` subscription**. This logs the constraints so they don't get lost.
> **Not legal or tax advice** — consult an advisor before launch (the agreement
> itself says the relationship "may have important legal and/or tax consequences").

## Status

- **Paid Applications Agreement (Schedule 2):** ✅ Active (signed 2026-09-16).
- **Bank account:** ✅ Active (Bank of America, USD).
- **U.S. tax form (W-9):** ✅ Active (submitted 2026-09-16).
- **Small Business Program (SBP):** ⏳ enrollment **submitted 2026-09-17**, awaiting
  Apple's approval email (approved within ~15 days of fiscal month-end). Grants the
  15% commission rate.
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

## Decided model (2026-09-17)

**A one-time, non-consumable in-app purchase at $4.99 (US) that unlocks the 9
premium soundscapes plus infinite (∞) sessions.** No subscription for now —
`relaxed+` stays parked in the roadmap "Someday" bucket.

**Split revised 2026-09-23 (was 3 free / 5 premium per family):** now **5 free +
3 premium per family**, so **15 free + 9 premium** across the 24. The catalog's
`tier` values currently encode the OLD ratio (9 free / 15 premium) and must be
flipped when 1.3 is built.

**Row ordering + premium picks (working proposal 2026-09-23).** The array order in
`lib/audio/soundscapes.ts` *is* the tray display order, so reordering and tiering
happen in one pass. Principle: **order each row by broad appeal descending
(most-familiar free beds on the left), with the 3 most distinctive "specialty"
beds anchored on the far right as the locked premium set** — so a new user meets
the crowd-pleasers first and the lock reads as the deluxe end of the shelf, not a
random gate. Same rule across all three families; keep Rain first in Nature (it's
`FIRST_TIME_SOUND`).

**CONFIRMED 2026-09-23** (Frequencies premium changed from the proposal: Binaural
→ Green Noise, so Binaural is free and Green Noise is locked).

| Family | Free (left → right) | Premium (locked 3, far right) |
|---|---|---|
| Nature | Rain · Ocean · Thunderstorm · Wind · Birdsong | Babbling Brook · Campfire · Windchimes |
| Music | Ambient · Piano · LoFi · Warm Strings · Harp | Singing Bowls · Kalimba · Flute |
| Frequencies | White Noise · Brown Noise · 432 Hz · Binaural · Alpha | Green Noise · Theta · Delta |

Rationale per family: Nature locks the cozy/niche textures and keeps classic
weather/water free; Music keeps the broad music beds free and locks the signature
instruments; Frequencies keeps the mainstream noises + 432 Hz + binaural free and
locks green noise and the deep-entrainment tones (theta, delta).

**Infinite is part of the unlock (decided).** The ∞ stop ships **free** in the
marketing build, then in 1.3 the $4.99 entitlement gates it (standard 5–60
lengths stay free). One "premium" entitlement covers both the 9 beds and ∞, not a
second product.

**Premium voices (added 2026-09-23, in 1.3).** Ten named premium voices (5 female,
5 male) join the **same** $4.99 unlock — no price change, more value. The free
`her / him / none` control is unchanged (those four already have personas in
`lib/voices.json`: Charlie, Mila, Tyler, Hunter); premium voices live in a
collapsed **"more voices"** reveal beneath it, shown as named chips with the same
paywall grammar as beds (preview always free, lock, thick-outline "previewing"
state, gate only at Begin). **No pre-cache:** premium voices stream live via the
existing per-line TTS path (like the custom flow), so Blob storage stays flat
(pre-caching 10 voices would add ~430 MB and blow the 1 GB free tier). Cost is
per-play ElevenLabs at runtime only. Each voice needs one small tray-preview clip.

Voices (ElevenLabs library voice IDs = the slug at the end of each voice URL):

| Name | Gender | Accent | Voice ID |
|---|---|---|---|
| Willow | F | English | `82LXuLkvkwPWqokoMRFf` |
| Natasha | F | American | `Atp5cNFg1Wj5gyKD7HWV` |
| Mira | F | German | `thNHFcPYszCz6ZPG6mUp` |
| Almee | F | English | `zA6D7RyKdc2EClouEMkP` |
| Alisa | F | Indian | `J8Jo6V3F3HsRR4u13XbM` |
| Kai | M | Australian | `3FP8zog6uhdEdir09I9N` |
| Drew | M | American | `wgHvco1wiREKN0BdyVx5` |
| Brad | M | Australian | `HZTk7bUIkiI7yT7FKH4h` |
| Solomon | M | American | `PTX7PgQRJRPEzGT9exN9` |
| Gavin | M | South African | `zUbTLhK65qJM6Ic7eQj1` |

All 10 IDs unique (confirmed 2026-09-23). **Still to confirm:** per-voice
**commercial distribution rights** for each library voice (ties into
third-party-ip.md).

Unlock copy grows to cover all three (see unlock-bar copy below):
"unlock 9 sounds, 10 voices, and infinite."

- **Product type:** non-consumable IAP (permanent unlock, one product across the
  account). **Restore Purchases** is required (Apple), and StoreKit tracks the
  purchase against the Apple ID so it restores on the user's other devices.
- **Price:** $4.99 in the US; Apple auto-generates localized prices per storefront
  from the chosen price point. At 15% (once SBP is approved) that nets ≈ $4.24
  before tax.
- **Entitlement:** cached on-device (fits the no-accounts model); the source of
  truth is the StoreKit transaction, re-checked on launch.

### Release sequencing
1. **1.2.2 — all 24 soundscapes + infinite, free (marketing build).** The audio,
   ∞ sessions, instant previews and new motifs are already live on the web (prod),
   so this is a **native build to refresh the App Store listing**: "What's New"
   copy (24 sounds, infinite sessions, upgraded voice model — verify the exact
   ElevenLabs model id before claiming a version), refreshed screenshots, then
   submit. Everything unlocked; no StoreKit. Free version, no IAP.
2. **1.3 — add the IAP.** Introduce the $4.99 unlock; gate the **9 premium beds +
   infinite**; flip the catalog `tier` values to the 15-free / 9-premium split.
   Requires a native build (StoreKit) and the paywall UI below.
   **Gate: submit 1.3 only after 1.2.2 is approved and released** — do not have two
   builds in review at once.

### UX: locked sounds stay previewable
Even after the gate goes up, **every sound previews free** on tap in the tray — the
purchase unlocks *using a premium bed in a full session*, not hearing it. Locked
beds show a small lock in the chip and still audition; the paywall appears only at
**Begin**, if a locked bed is the chosen session soundscape. Preview keeps the
"fall in love first" path intact.

### Chip states (chosen 1.3 treatment)
The soundscape carousel stays a single horizontal row (no cascading). Locks live
inline on the chips; the only added element is one unlock bar below the carousel.
- **Free, selected:** full Bone fill (today's `.on` state) — "it's yours."
- **Premium, previewing (locked):** a **thick Bone outline**, glass interior, lock
  still shown — reads as active/playing but visibly not-yet-owned (reuses the
  selected *shape* while withholding the *fill*).
- **Premium, idle:** glass pill with a small inline lock.

### Unlock bar copy (must not read as a subscription)
One calm bar under the carousel. It must make the one-time nature unmistakable
(Apple guidelines + user trust). Chosen copy:
- Title: **"unlock 9 sounds, 10 voices, and infinite"** (or the shorter "unlock all
  premium" with the "9 sounds · 10 voices · infinite" line beneath, as mocked)
- Sub: **"one time, not a subscription. previews are always free."**
- Button: **"$4.99 once"**

No renewal/subscription language anywhere. (House rule: no em dashes in this copy.)

### Open question for the build — the web/native split
The purchase is **StoreKit (native)**, but the app is a web shell and the premium
beds are web-delivered (FLAC on Blob, gated by `tier`). So the native layer must
signal "premium unlocked" to the web layer (a Capacitor bridge, like haptics /
notifications), and the web gates the beds on it. **On the plain web (a browser),
there is no StoreKit, so there is no purchase path** — decide whether premium is
simply **locked/hidden on the web** (native-only unlock) or later sold on the web
too (e.g. Stripe + the audio "reader" carve-out).
**DECIDED 2026-09-23: native-only unlock.** Premium (beds, voices, ∞) is
purchasable only in the iOS app via StoreKit; on the plain web those items show
locked (previewable, not usable in a session), no web purchase for now. Web
selling (Stripe) stays a later option.

## To-do before we charge (the paywall project)

1. **Enroll in the App Store Small Business Program** (→ 15%). *(submitted
   2026-09-17, awaiting approval.)*
2. **Complete banking + tax forms + tax category** in App Store Connect. *(done —
   all Active.)*
3. **Create the IAP product** in App Store Connect: one non-consumable, $4.99,
   product ID **`app.relaxed.premium`** (matches the plugin), review screenshot +
   description. *(pending — see native/ios-plugin/README.md.)*
4. **StoreKit purchase + Capacitor bridge.** *(scaffolded on `iap-1.3`:*
   *`lib/entitlement.ts` + `native/ios-plugin/` — Swift StoreKit 2 plugin with*
   *getEntitlement / purchase / restore + a live updates listener. Remaining: add*
   *the two files to the Xcode project and test, per the plugin README.)*
5. **`tier` gate + lock/buy UI.** *(done on `iap-1.3`: lock states on premium beds*
   *and voices, the gate at Begin covering beds + voices + infinite, and the unlock*
   *sheet. Everything still previews free.)*
6. **Web/native split.** *(decided: native-only unlock — see above.)*

## Content / marketing guardrails
- Don't use child-pressuring purchase language ("buy now!", "upgrade now!") aimed
  at children (§5.4). Low risk for a mindfulness app, but keep upsell copy calm and
  adult-directed.
- No em dashes in any user-facing paywall copy (house rule).

See also: [roadmap.md](./roadmap.md) ("Someday — relaxed+ paywall"),
[third-party-ip.md](./third-party-ip.md) (provider terms), and the soundscape
`tier` field in [audio-engine.md](./audio-engine.md#6-soundscapes).
