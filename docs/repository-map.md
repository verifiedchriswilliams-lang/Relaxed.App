# Repository Map

> A guided tour of the source tree so a new engineer can find anything quickly.
> Deep behavior is in the linked subsystem docs.

## Top-level layout

```
relaxed.app/
├── app/                  Next.js App Router: pages, API routes, generated images
├── lib/                  All non-UI logic: content, brand, audio helpers, native bridge
├── scripts/             One-off Node scripts (voice cache, previews, blob upload, loudness)
├── public/              Static assets (audio served from Blob in prod; READMEs here)
├── assets/              Source icon + splash images for iOS asset generation
├── native/www/          Capacitor offline fallback bundle
├── docs/                This documentation set
├── .github/workflows/   Two manual GitHub Actions (voice cache, blob sync)
├── capacitor.config.ts  iOS shell config
├── next.config.mjs      Empty (Next defaults)
├── tsconfig.json        TS config (strict), path alias @/* → ./*
└── package.json         Scripts + dependencies
```

## `app/` — routes & rendering

| Path | Kind | Purpose |
|---|---|---|
| `app/page.tsx` | Client component (~2,580 lines) | **The entire app**: the five-screen state machine + the `AudioEngine` class. The single most important file. |
| `app/layout.tsx` | Server | App shell, fonts (Manrope + Figtree), brand-templated metadata, `data-brand`, theme color, Vercel `<Analytics/>`. |
| `app/globals.css` | CSS | Base (ElevenMind) design system + all shared component styles. |
| `app/relaxed.css` | CSS | relaxed brand token overrides + relaxed-only structure (scoped `[data-brand="relaxed"]`). |
| `app/privacy/page.tsx` | Server | The privacy policy page (App Store requirement). |
| `app/api/generate/route.ts` | Node route | Preset session assembly + cache-first voicing. |
| `app/api/custom-script/route.ts` | Node route | Live bespoke script via Claude. |
| `app/api/tts/route.ts` | Node route | One line → MP3 (custom streaming). |
| `app/icon.tsx`, `app/apple-icon.tsx` | Edge image | Brand-aware favicon / home-screen icon. |
| `app/opengraph-image.tsx`, `app/twitter-image.tsx` | Edge image | Brand-aware share cards. |
| `app/artwork/route.tsx` | Edge route | 512² Now-Playing lock-screen artwork (`?c=<category>`). |

## `lib/` — logic & content

| File | Purpose | Doc |
|---|---|---|
| `lib/contexts.ts` | Intentions, durations, `VoiceChoice`, `CUSTOM_MAX_CHARS`, `CUSTOM_ENABLED`, the Claude `SCRIPT_SYSTEM_PROMPT`, duration bands, feature flags | [product-spec](./product-spec.md) |
| `lib/engine.ts` | Meditation Engine: session blueprint (`blueprintFor`, scene arc + per-scene targets) + per-intention audio envelope (`audioProfile`) | [audio-engine](./audio-engine.md#9-the-meditation-engine-phase-1) |
| `lib/sessions.ts` | Preset session assembler (`assembleSession`, pacing/fit, transcript, cache line enumeration) | [audio-engine](./audio-engine.md) |
| `lib/sessionScripts.json` | 5 intentions × 3 script variants (`ScriptLine[][]`) | [audio-engine](./audio-engine.md) |
| `lib/tts.ts` | Voice-ID resolution (`VOICE_TABLE`, `resolveVoiceId`) + ElevenLabs byte synthesis | [audio-engine](./audio-engine.md) |
| `lib/voiceCache.ts` | Cache key hashing, manifest membership (`isCached`), Blob URL | [audio-engine](./audio-engine.md), [voice-cache](./voice-cache.md) |
| `lib/voiceCacheManifest.json` | `{ keys: [...] }`, 1,448 cached-line hashes (tracked in git) | [voice-cache](./voice-cache.md) |
| `lib/assets.ts` | Prefixes `/public` paths with `NEXT_PUBLIC_BLOB_BASE_URL` in prod | [infrastructure](./infrastructure.md) |
| `lib/brand.ts` | Two-brand fork (`BRAND`, chosen from `NEXT_PUBLIC_BRAND`) | [design-system](./design-system.md) |
| `lib/mark.tsx` | `STEM_PATH`, `StemGlyph`, `OrbitGlyph`, `stemStroke` | [design-system](./design-system.md) |
| `lib/soundMotifs.tsx` | Per-soundscape line motifs in the player ring | [design-system](./design-system.md) |
| `lib/iconArt.ts` | Brand-aware icon/artwork tile art (data URIs) | [design-system](./design-system.md) |
| `lib/history.ts` | On-device recent (10) + favorites (100) + moods (50); `sessionSig` | [product-spec](./product-spec.md), [data-privacy](./data-privacy.md) |
| `lib/analytics.ts` | Anonymous first-party events (`ev`) | [data-privacy](./data-privacy.md) |
| `lib/native.ts` | Capacitor bridge: haptics + MediaSession; safe web no-ops | [ios-native](./ios-native.md) |
| `lib/voices.json` | Voice guide names used by the preview builder | [audio-engine](./audio-engine.md) |

## `scripts/` — maintenance tooling

| File | npm script | Purpose |
|---|---|---|
| `scripts/build-voice-cache.mjs` | `build:voices` | Pre-voice common lines → Blob + manifest |
| `scripts/build-voice-previews.mjs` | `build:previews` | Build the four tray audition clips |
| `scripts/upload-blob.mjs` | — (CI/local) | Upload `public/**` media to Blob |
| `scripts/measure-beds.mjs` | — (local) | Measure LUFS/peak → recommend trims/gains |

## `public/`, `assets/`, `native/`

- `public/sounds/README.md`, `public/voice-cache/README.md` — how media is dropped
  and served (files themselves live in Blob, not git).
- `assets/icon.png`, `assets/splash.png`, `assets/splash-dark.png` — source images
  for `@capacitor/assets`.
- `native/www/index.html` — the offline fallback shown if the hosted site is
  unreachable.
- `public/aurora.jpg` — the ElevenMind night-sky background (relaxed uses none).

## Where to make common changes

| I want to… | Go to |
|---|---|
| Change a preset script | `lib/sessionScripts.json` (then rebuild the voice cache) |
| Change the Claude prompt | `lib/contexts.ts` (`SCRIPT_SYSTEM_PROMPT`) + `app/api/custom-script/route.ts` (`buildPrompt`) |
| Add/adjust a soundscape | `SOUNDSCAPES` in `app/page.tsx` + `lib/soundMotifs.tsx` + Blob upload |
| Tune loudness | `VOICE_STATS`, `SOUNDSCAPES[].trim`, `PREVIEW_GAIN` in `app/page.tsx` (measure first) |
| Change a voice | `ELEVENLABS_VOICE_*` env or `VOICE_TABLE` defaults (then rebuild cache) |
| Change the look | `app/relaxed.css` (relaxed) / `app/globals.css` (shared) |
| Change native config | `capacitor.config.ts`, Info.plist (needs a new build) |
| Add an analytics event | `lib/analytics.ts` + a call site (keep it PII-free) |
