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
| Provider cost spike | Unauthenticated custom/tts abuse | Add rate limiting (see [security.md](./security.md#5-recommended-hardening-prioritized)). |
