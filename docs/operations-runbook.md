# Operations Runbook

> How to run, build, deploy, release, and maintain relaxed.app. Configuration and
> env details are in [infrastructure.md](./infrastructure.md).

## Local development

```bash
npm install
cp .env.example .env.local      # then paste in the keys you have
npm run dev                     # http://localhost:3000
```

- With **no keys**, the app runs in preview mode (guided silence + on-screen
  script; a generic fallback for the custom path). You can feel the whole flow
  before spending a cent.
- With keys, set at minimum `ANTHROPIC_API_KEY` (custom path) and
  `ELEVENLABS_API_KEY` (voice). For the relaxed brand locally, set
  `NEXT_PUBLIC_BRAND=relaxed`.

Build & lint:

```bash
npm run build      # production build (also the pre-deploy sanity check)
npm run lint       # next lint (no committed ruleset yet)
```

## Deploy (web)

Production deploys automatically when you push to `main` (Vercel Git
integration). To ship:

```bash
git checkout main && git pull
# make changes
npm run build            # verify it compiles
git commit -am "..."     # see commit conventions below
git push origin main     # Vercel builds + deploys to relaxed.app
```

There is no manual deploy step. A broken build fails in Vercel; run `npm run build`
locally first.

## Release (iOS)

Only needed for native changes (icon, splash, `capacitor.config.ts`, Info.plist,
plugins). On a Mac:

```bash
npm install
npx cap add ios          # first time only (generates ios/)
npm run ios:assets       # regenerate icons + splash from assets/
npm run ios:sync         # copy web assets + register native plugins
npm run ios:open         # open Xcode
npx cap ls ios           # verify plugins are registered
```

Then in Xcode: signing/team, Bundle ID `app.relaxed`, min iOS 16.4, Product ▸
Archive ▸ Distribute ▸ App Store Connect. Full detail (Info.plist edits, App Store
Connect fields, review notes) is in [ios-build.md](./ios-build.md).

> **Always run both `ios:assets` and `ios:sync` before archiving.** Skipping them
> ships a build without the current icon/splash and without native plugins.
> To verify a new launch screen on device: delete the app, restart the phone,
> reinstall (iOS caches the launch image aggressively).

## EU / App Store availability
<a id="eu--app-store-availability"></a>

Expanding beyond US + Canada (planned for 1.2). The app collects no personal data
server-side and analytics are anonymous and cookieless, so GDPR exposure is low,
but EU distribution still has gates. Status:

- ✅ **Privacy policy** covers the GDPR essentials: on-device storage, processors
  (Anthropic / ElevenLabs / Vercel), international transfers (US), legal basis,
  data-subject rights, and a supervisory-authority complaint note (`/privacy`).
- ☐ **DSA trader status** (App Store Connect → Business): provide and verify
  trader contact info (legal name, address, email, phone). **Required** for EU
  distribution; Apple withholds EU availability until it's verified.
- ☐ **App availability** (App Store Connect → Pricing and Availability): add the
  EU countries.
- ☐ **App Privacy "nutrition label":** confirm it reflects reality, no data
  linked to identity; anonymous analytics as "not linked to you," or "Data Not
  Collected" if nothing qualifies.
- ☐ **Provider DPAs:** confirm Anthropic / ElevenLabs / Vercel data-processing
  terms cover EU processing of the custom phrase (diligence, [third-party-ip](./third-party-ip.md)).
- ☐ **Age rating:** confirm it's set (EU child-data age can be 16).

No cookie-consent banner is needed (Vercel analytics is cookieless and
non-identifying). See [data-privacy.md](./data-privacy.md).

## Rebuild the voice cache

When session templates change (new/edited common lines) or a voice ID changes:

```bash
# locally, with ELEVENLABS_API_KEY (+ voice overrides) and BLOB_READ_WRITE_TOKEN set
npm run build:voices     # voices new common lines, updates lib/voiceCacheManifest.json, uploads to Blob
npm run build:previews   # rebuilds the four tray audition clips
```

Or run the **"Build voice cache"** GitHub Action (manual). It commits the updated
manifest and uploads to Blob. Existing keys are skipped, so it only voices what
changed. See [voice-cache.md](./voice-cache.md).

> **After adding script variants:** new common lines are not in the cache yet, so
> they synthesize live (slower, and they cost per play) until you run
> `build:voices`. Run it once after editing `lib/sessionScripts.json` so the new
> lines are pre-voiced to Blob.

## Sync media to Blob

When you add or change soundscape beds (or want to re-push audio):

```bash
# with BLOB_READ_WRITE_TOKEN set
node scripts/upload-blob.mjs                 # uploads public/sounds + public/voice-cache
node scripts/upload-blob.mjs public/sounds --force   # force re-upload one dir
```

Or run the **"Sync media to Blob"** Action. The script prints the Blob base URL;
set it as `NEXT_PUBLIC_BLOB_BASE_URL` in the Vercel project. See
[blob-migration.md](./blob-migration.md).

## Rebalance audio loudness

To re-measure and re-level beds or voice previews (requires a real `ffmpeg` with
the `ebur128` filter — the Homebrew/apt build, not a stripped one):

```bash
NEXT_PUBLIC_BLOB_BASE_URL="https://<store>.public.blob.vercel-storage.com" \
  node scripts/measure-beds.mjs
# or point at a local folder:
node scripts/measure-beds.mjs --dir /path/to/sounds
```

It prints recommended per-bed `trim` values (for `SOUNDSCAPES` in `app/page.tsx`)
and per-preview gains (for `PREVIEW_GAIN`). Paste the numbers back into the code.
The tool writes nothing itself. Background: [audio-engine.md](./audio-engine.md#5-loudness-normalization-the-it-just-sounds-right-work).

## Add a soundscape

1. Add the bed file drop per `public/sounds/README.md` (seamless ~60s loop mp3).
2. Add the entry to `SOUNDSCAPES` in `app/page.tsx` (id, label, cat, src, and
   measured rms/peak/trim); add a motif in `lib/soundMotifs.tsx`.
3. Upload via `upload-blob.mjs`, set `soon: false`, measure loudness, deploy.

## Rotate a key

1. Rotate in the provider console (Anthropic / ElevenLabs) or regenerate the Blob
   token in Vercel.
2. Update the value in the Vercel project env vars (both brand projects if shared)
   and in the GitHub Actions secret if CI uses it.
3. Redeploy (push, or trigger a redeploy) so the new value is picked up.

## Billing & cost monitoring

Two independent provider accounts bill for generation. The **custom "In your
words" path** is the only thing that spends Claude tokens; presets play from the
voice cache and cost nothing at Anthropic. ElevenLabs bills separately for voice.

### Where to check

| Provider | Console | What to watch |
|---|---|---|
| Anthropic (Claude) | [console.anthropic.com](https://console.anthropic.com) → **Billing** (credit balance) and **Usage** (tokens/spend by key + model) | Credit balance; monthly spend; opus output-token volume |
| ElevenLabs (voice) | [elevenlabs.io](https://elevenlabs.io) → Profile → **Subscription / Usage** | Remaining monthly character quota |

### Don't get cut off

- **Auto-reload (Anthropic) should stay ON.** When credits hit $0, custom
  generation starts failing for users with no warning. Auto-reload (Billing →
  the balance card) tops the balance up automatically so it can't run dry. It is
  currently enabled; if it ever shows off, turn it back on.
- Set a **usage/spend limit + email alert** in Anthropic Billing so a runaway
  climb pages you before it matters. There is a monthly spend cap (a safety
  ceiling, well above normal spend) plus alert thresholds.

### Cost model (what actually drives the bill)

- The model is **`claude-opus-5`** (`$5 / $25` per million input / output tokens).
  **Output tokens dominate** each custom generation (a full script is ~1k output
  tokens vs a few hundred input), so the bill scales with custom-session volume
  and script length, not with input size.
- **Prompt caching is enabled** on the system prompt (`cache_control` in
  `app/api/custom-script/route.ts`), but it is a **modest, at-scale** saving, not
  a lever you feel at low volume: it only discounts the reused system-prompt
  prefix (~15% of per-call cost), output tokens are not cacheable, and a cache
  **hit** only happens when two sessions land within the ~5-minute window. At low
  sporadic volume most calls just write the cache (roughly neutral); the win
  arrives when sessions cluster or volume grows. Per-request cache telemetry
  (`cache_read` / `cache_write` token counts) is logged to the Vercel function
  logs, so you can confirm it engages by running two sessions back to back.
- **The biggest cost lever is the model itself.** `claude-opus-5` was chosen
  deliberately for script quality; `claude-sonnet-5` is ~2.5× cheaper per token
  (`$2 / $10`). To trade quality for cost, set `ANTHROPIC_MODEL=claude-sonnet-5`
  in the Vercel project (overrides the code default) rather than editing code.
  See the model note in [infrastructure.md](./infrastructure.md).

## Commit & branch conventions

- Small, focused commits with a scannable subject (see the git history for the
  house style, e.g. `audio: level all 15 soundscapes by measured LUFS`).
- User-facing product copy must contain **no em dashes** (brand rule) — use
  commas, periods, or "and".
- `main` is production; push there to deploy. Keep brand-scoped changes
  brand-aware so relaxed and ElevenMind don't disturb each other.

## Common incidents

| Symptom | Likely cause | Fix |
|---|---|---|
| Voice silent, script shows | No/È invalid `ELEVENLABS_API_KEY`, or private voice IDs under a different key | Check the Vercel env var; confirm the account owning the private voices is the key in use. |
| Custom path returns fallback text | No `ANTHROPIC_API_KEY` or Claude error | Check the key; check function logs. |
| New splash/haptics missing in the app | `ios:assets`/`ios:sync` skipped, or launch-screen cache | Re-run both, re-archive; delete/reinstall the app. |
| Audio 404s | `NEXT_PUBLIC_BLOB_BASE_URL` wrong or media not uploaded | Re-run `upload-blob.mjs`; verify the base URL. |
| Provider cost spike | Unauthenticated custom/tts abuse | Add rate limiting (see [security.md](./security.md#5-recommended-hardening-prioritized)); watch spend per [Billing & cost monitoring](#billing--cost-monitoring). |
| Custom generation suddenly failing for everyone | Anthropic credits hit $0 | Check the balance ([console.anthropic.com](https://console.anthropic.com) → Billing); confirm auto-reload is on. See [Billing & cost monitoring](#billing--cost-monitoring). |
