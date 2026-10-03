# Data & Privacy

> A complete inventory of what data exists, where it lives, what leaves the
> device, and to whom. The short version: **no accounts, no database, nothing
> personal leaves the phone except the minimum text needed to render a session,
> and analytics are anonymous and aggregate.**

## 1. Design posture

- **No user accounts.** There is no sign-up, no login, no user identifier.
- **No application database.** The server keeps no per-user state; the API routes
  are stateless and request-scoped.
- **On-device by default.** All personalization (name, preferences, history,
  favorites, mood log) is stored in the browser's `localStorage` on the one
  device and never transmitted.
- **Minimum necessary to third parties.** Only the text required to write and
  voice a session is sent to the AI providers, and only for that request.

## 2. Data inventory — on device (`localStorage`)

| Key | Contents | Notes |
|---|---|---|
| `elevenmind.prefs.v1` | `{ name, voice, accent, soundscape }` | The name is free text the user typed. Key is legacy-named `elevenmind.*` across both brands. |
| `relaxed.recent.v1` | Last 10 sessions (`RecentSession[]`) | Includes the custom phrase text (`customText`) and the exact resolved `script` (words + pauses) so a replay reproduces it. |
| `relaxed.favs.v1` | Saved sessions (`RecentSession[]`, cap 100) | Same shape; kept indefinitely. |
| `relaxed.moods.v1` | Last 50 post-session moods (`MoodEntry[]`) | `{ mood, context, custom, at }`; a fixed enum mood, not free text. |
| `relaxed.reminder.v1` | Daily-reminder pref `{ enabled, hour, minute }` | Non-personal; the local time for the on-device notification. The notification is scheduled by the OS, never sent to a server. |
| `em_variant_seq` | Per-intention script-variant counter | Non-personal; ensures repeats vary. |
| `relaxed.recentHint.v1` | One-time flag: the recent/history entry has been introduced | Non-personal; a single `"1"`. |

Everything above is readable only by the site's own origin, is never sent to any
server, and is cleared if the user clears site data or deletes the app. There is
no server-side copy and therefore no cross-device sync (a deliberate Phase 2
tradeoff).

## 3. Data flows — what leaves the device

| Destination | What is sent | What is NOT sent |
|---|---|---|
| **Anthropic (Claude)** — custom path only | The user's **name** (≤60), the typed **phrase** (≤70), the duration, pacing guidance, and the fixed arrival text already spoken (≤300). | Nothing on the preset path (presets never call Claude). No email, no identifiers, no device info. |
| **ElevenLabs** — voiced sessions | Only the **line text to be spoken** (arrival + Claude-written body for custom; name line + any uncached common line for presets), plus the voice ID and voice settings. | The raw phrase is never sent to ElevenLabs (only the generated prose). No identifiers. |
| **Vercel** (hosting) | Standard HTTPS request metadata (IP, user agent) inherent to serving the site and functions. | No application-level personal data is logged by the app. |
| **Vercel Web Analytics** | Anonymous pageviews + the custom product events below. | No accounts, no identifiers, no free text, never the name or phrase. |

The two rows below are **not** third-party transmission: Apple Health is an
on-device store the user controls, and the watch link is a device-to-device
channel (no server, no third party) between the user's own phone and watch.

| Destination | What is sent | What is NOT sent |
|---|---|---|
| **Apple HealthKit / Apple Health** (on-device; iOS/watch) | On a completed session, one **Mindful Minutes** category sample (start/end only). Write-only, user-permission gated, best-effort (silent no-op if denied). | No name, no phrase, no mood. The app **never reads** any Health data (authorization is `toShare:[mindful], read:[]`). |
| **WatchConnectivity** (phone↔watch; device-to-device) | The small session snapshot (`active`, `playing`, `title` = preset name or "Your session", `soundscape` label, `motif` = soundscape id, `remaining`/`total` whole seconds) plus play/pause/stop commands back from the watch. | No identifiers of any kind, never the custom phrase or the user's name. Goes only between the user's own paired devices, not to any server. |

The API keys for Anthropic and ElevenLabs are server-only and never reach the
browser (see [security.md](./security.md)).

## 4. Analytics events (anonymous, aggregate)

`lib/analytics.ts` wraps Vercel `track()` and attaches only the brand id plus
enum/shape values. Confirmed at every call site — no name or phrase is ever
included:

| Event | Properties |
|---|---|
| `session_start` | kind (sounds/custom/preset), context, duration, voice, accent, soundscape |
| `time_to_first_audio` | ms (Begin → guide first audible), kind |
| `session_complete` | kind, context, duration |
| `session_abandon` | context, duration, elapsedSec |
| `session_replay` | context, duration |
| `feedback` | mood (enum), context, custom (bool) |
| `custom_body_ok` | context, duration, lines (count) |
| `custom_no_body` | context, duration |
| `reminder_set` | on (bool) |
| `paywall_shown` | lockBed / lockVoice / lockInfinite (bools), soundscape, voice, duration |
| `purchase_start` | — |
| `purchase_success` | — |
| `purchase_fail` | reason (incomplete / error) |
| `restore_success` | — |
| `restore_none` | — |
| `redeem_start` | — |
| `redeem_success` | — |

Every event also carries `brand` and `platform` (ios / android / web), so app
traffic (the WKWebView shells load the same hosted page, so their events land in
the same Vercel analytics) can be told apart from web without any identifier.
`mood` is one of a fixed set ("much calmer" / "a little calmer" / "about the
same"), not free text. The monetization events (`paywall_shown` →
`purchase_start` → `purchase_success`/`purchase_fail`, plus `restore_*` and the
offer-code `redeem_*`) form the
conversion funnel; they carry only the *shape* of the selection (which locked
item, which soundscape/voice), never the name or the typed phrase, and no
purchase amount or receipt. Plus Vercel's cookieless auto-pageviews.

## 5. Retention & deletion

- **On-device data:** persists until the user clears site data or deletes the app;
  the recent list self-caps at 10, moods at 50, favorites at 100. There is no
  remote copy to delete.
- **Provider data:** governed by Anthropic's and ElevenLabs' retention policies
  for API requests (see [third-party-ip.md](./third-party-ip.md)). No provider
  request is tied to a user identity by relaxed.
- **Analytics:** aggregate metrics retained by Vercel per their policy; not
  attributable to an individual.

## 6. Compliance posture

- **App Store privacy:** declared as essentially no data collection (a name kept
  in `localStorage`, anonymous analytics). Export compliance: exempt
  (`ITSAppUsesNonExemptEncryption = NO`). Privacy Policy URL: `relaxed.app/privacy`
  (an in-app `/privacy` page exists; see `app/privacy/page.tsx`).
- **GDPR / UK GDPR:** minimal exposure — no accounts, no profiling, cookieless
  analytics. The lawful-basis surface is small because almost nothing personal is
  processed server-side. The privacy policy now states the GDPR essentials (rights,
  international transfers to US providers, legal basis). For EU **distribution**,
  the remaining gates are App-Store-side (DSA trader verification, App Privacy
  details) and confirming the AI-provider DPAs, see the checklist in
  [operations-runbook.md](./operations-runbook.md#eu--app-store-availability).
- **CCPA/CPRA:** no "sale" of personal information; minimal collection.
- **COPPA / age:** the product is not directed at children; there is no age gate.
  An acquirer should confirm App Store age rating and marketing alignment.
- **Health data:** the app offers mindfulness content and is **not** medical or
  therapeutic; the UI states this. The Apple Watch app now **writes** completed
  sessions to Apple Health as **Mindful Minutes** — write-only (it never reads any
  Health data), user-permission gated, and best-effort (a silent no-op if the user
  declines). Mood entries stay on-device, are not health records, and are **not**
  written to Health.
- **Availability:** 47 countries; further EU-specific gates (DSA/trader
  obligations) are noted in [roadmap.md](./roadmap.md).

## 7. Content safety

Because the bespoke path turns a user's free-text phrase into a guided session,
the Claude system/user prompt includes an explicit **crisis-handling clause**: if
the phrase suggests the person may be in crisis or considering self-harm, the
session stays gentle and grounding, makes no attempt at therapy or advice, and
includes one soft line that reaching out to someone trusted or a helpline is a
strong and kind thing to do; it never diagnoses or promises outcomes. See
[security.md](./security.md#content-safety) for the full treatment and residual
risks.

## 8. Diligence checklist (open items)

- [ ] Confirm Anthropic and ElevenLabs commercial terms and data-retention /
      training-use settings for API traffic (see [third-party-ip.md](./third-party-ip.md)).
- [ ] Confirm the App Store privacy nutrition label matches this document.
- [ ] EU expansion (1.2): complete the App-Store-side gates (DSA trader
      verification, availability, App Privacy) and confirm provider DPAs, per the
      [runbook checklist](./operations-runbook.md#eu--app-store-availability). The
      privacy-policy content is done.
- [ ] When accounts arrive (Phase 2), this document and the privacy policy must be
      revised for server-side personal data.
