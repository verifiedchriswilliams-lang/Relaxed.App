# Infrastructure & Environments

> Hosting, environment variables, media storage, CI/CD, and domains. Operational
> procedures (how to run things) are in [operations-runbook.md](./operations-runbook.md).

## 1. Hosting

- **Web app:** Next.js 14.2.35 on **Vercel**. `next.config.mjs` is empty (no custom
  rewrites, headers, image config, or output mode). API routes run as Node.js
  serverless functions; the `opengraph-image`, `twitter-image`, and `artwork`
  routes declare the edge runtime, while `icon` and `apple-icon` use the default
  runtime (both build brand-aware PNGs via `next/og`).
- **Deploy trigger:** push to `main` → Vercel builds and deploys to production.
  Web changes reach every user immediately, including installed iOS apps (the app
  is a shell over the hosted site).
- **iOS:** a Capacitor WKWebView pointing at `https://relaxed.app`. See
  [ios-native.md](./ios-native.md).

## 2. Two brand deployments, one repo

`NEXT_PUBLIC_BRAND` selects the brand at build time. Two Vercel projects (or two
build configs) produce:

| Brand | `NEXT_PUBLIC_BRAND` | Domain | Support |
|---|---|---|---|
| relaxed.app | `relaxed` | `relaxed.app` | support@relaxed.app |
| ElevenMind | unset / anything else | `elevenmind.io` | hello@elevenmind.io |

Each project sets its own env vars. Keep brand-scoped changes brand-aware so one
deployment never disturbs the other.

## 3. Environment variables — complete reference

### Server-side (secret; never exposed to the browser)

| Variable | Purpose | Default (code) |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude auth (custom path only) | none (custom disabled if unset) |
| `ANTHROPIC_MODEL` | Which Claude model writes the script | `claude-opus-5` |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS auth | none (voice disabled if unset) |
| `ELEVENLABS_SPEED` | Speaking rate (clamped 0.7–1.2) | 1.0 |
| `ELEVENLABS_STABILITY` | Delivery steadiness (0–1) | 0.85 |
| `ELEVENLABS_OUTPUT_FORMAT` | Cache/audio format | `mp3_44100_128` |
| `TTS_CONCURRENCY` | Parallel live TTS calls (1–6) | 4 |
| `ELEVENLABS_VOICE_FEMALE_US` | Her/US voice ID override | `7AvtJrjTNyBhBxEvNPIZ` |
| `ELEVENLABS_VOICE_MALE_US` | Him/US override | `6bPfTtSpgxgD0GeBVfqu` |
| `ELEVENLABS_VOICE_FEMALE_UK` | Her/UK override | `bgU7lBMo69PNEOWHFqxM` |
| `ELEVENLABS_VOICE_MALE_UK` | Him/UK override ("Theo") | `UmQN7jS1Ee8B1czsUtQh` |
| `ELEVENLABS_VOICE_FEMALE` / `ELEVENLABS_VOICE_MALE` | Legacy single-accent fallbacks (UK slot) | — |
| `VOICE_PREVIEW_TEXT` / `VOICE_PREVIEW_TEXT_<SLOT>` | Override audition-clip text | per-slot template |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token (build scripts + CI) | none |

### Public (`NEXT_PUBLIC_*`; shipped in the browser bundle)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_BRAND` | Selects relaxed vs elevenmind |
| `NEXT_PUBLIC_BLOB_BASE_URL` | Base origin for hosted audio; unset → serve from `/public` |
| `NEXT_PUBLIC_ENABLE_CUSTOM` | Toggle the "Make Your Own" tile |

> **Model note.** The production model is **`claude-opus-5`** (the code default;
> `.env.example` agrees). Vercel has no `ANTHROPIC_MODEL` override set, so the code
> default is what runs; setting the var in the Vercel project would override it
> per-environment. `ELEVENLABS_OUTPUT_FORMAT` and the code now agree on
> `mp3_44100_128`, and the unused `SILENCE_SCALE` knob has been removed from
> `.env.example`. History in
> [risks-tech-debt.md](./risks-tech-debt.md#documentation-reconciliation).

## 4. Media storage — Vercel Blob

Large audio is not in git; it is served from a single Vercel Blob store.

- The app resolves every root-relative `/public` path through
  `NEXT_PUBLIC_BLOB_BASE_URL` via `asset()` (`lib/assets.ts`). Unset → paths stay
  under `/public` (a safe, reversible fallback).
- **Folder layout** (Blob key = path relative to `public/`):
  - `sounds/` — soundscape beds (~110 MB).
  - `voice-cache/<hash>.mp3` — pre-voiced common lines (~53 MB, 1,448 keys).
  - `voice-previews/<slot>.mp3` — the four tray audition clips.
- All media blobs are **public** (`access: "public"`, `audio/mpeg`, stable keys).
  The only secret is the `BLOB_READ_WRITE_TOKEN`.
- Setup/upload runbook: [blob-migration.md](./blob-migration.md).

## 5. CI/CD (GitHub Actions)

Both workflows are **manual** (`workflow_dispatch`) and run on Node 22.

| Workflow | File | What it does | Secrets |
|---|---|---|---|
| Build voice cache | `.github/workflows/build-voice-cache.yml` | Pre-voices common lines + rebuilds the four preview clips; commits the manifest ("Build voice cache [skip ci]") and uploads to Blob | `ELEVENLABS_API_KEY`, the four `ELEVENLABS_VOICE_*`, `BLOB_READ_WRITE_TOKEN` |
| Sync media to Blob | `.github/workflows/sync-blob.yml` | Uploads local `public/**` media to Blob (`dirs` input; `force` to re-upload) | `BLOB_READ_WRITE_TOKEN` |

There is no automated build/test/deploy pipeline in Actions — production deploys
are handled by Vercel's Git integration on push to `main`.

## 6. Domains & DNS

- Production: `relaxed.app` (relaxed brand), `elevenmind.io` (ElevenMind brand),
  pointed at their Vercel projects in the Vercel domains tab.
- App Store bundle id: `app.relaxed`; app name "relaxed".

## 7. Runtimes & limits worth knowing

- `/api/generate`: Node runtime, `maxDuration 300s`. Cached lines are Blob URLs
  (off the payload); a not-yet-cached common line is synthesized inline in a
  compact format (`mp3_22050_32`) to stay under Vercel's ~4.5 MB response cap,
  while the live name line is inline at full fidelity (`mp3_44100_128`).
- `/api/custom-script`: Node runtime, `maxDuration 60s`.
- `/api/tts`: Node runtime, `maxDuration 60s`, `Cache-Control: no-store`.

## 8. Reproducibility / build tooling

- Node 22 (CI); TypeScript ^5 `strict: true`; path alias `@/* → ./*`.
- `npm run lint` = `next lint`, but **no committed ESLint config** exists (first
  run would scaffold one). Tracked in [risks-tech-debt.md](./risks-tech-debt.md).
- The iOS Xcode project (`ios/`) is generated locally via `npx cap add ios` and is
  not fully tracked in git (Pods, build, copied web assets are gitignored) — it is
  regenerated from `capacitor.config.ts` + `assets/`.
