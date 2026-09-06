# Third-Party Dependencies, Licensing & IP

> What the product depends on, under what terms, and who owns what. This is the
> section an acquirer's legal/IP diligence will read most closely. Items marked
> **[confirm]** need a primary-source check before relying on them.

## 1. Direct dependencies & licenses

Runtime (`dependencies`):

| Package | Version | License (typical) |
|---|---|---|
| `next` | 14.2.35 | MIT |
| `react`, `react-dom` | 18.3.1 | MIT |
| `@anthropic-ai/sdk` | 0.68.0 | MIT |
| `@capacitor/core`, `/ios`, `/haptics`, `/splash-screen`, `/status-bar` | 8.x | MIT |
| `@vercel/analytics` | 2.0.1 | MPL-2.0 / Apache-2.0 **[confirm]** |

Dev (`devDependencies`):

| Package | Version | License (typical) |
|---|---|---|
| `@capacitor/cli`, `@capacitor/assets` | 8.x / 3.0.5 | MIT |
| `@vercel/blob` | 2.8.0 | Apache-2.0 **[confirm]** |
| `typescript` | ^5 | Apache-2.0 |
| `@types/*` | — | MIT |

- The tree is small and dominated by permissive (MIT/Apache) licenses. There are
  **no copyleft (GPL) runtime dependencies** in the direct set.
- `package-lock.json` is committed, so the full transitive tree is pinned.
- **[confirm]** Run a license scan over the transitive tree (e.g.
  `license-checker`) for a definitive SBOM before close. No scan is committed today.

## 2. AI / cloud service providers (commercial terms)

| Provider | Used for | Diligence items |
|---|---|---|
| **Anthropic (Claude)** | Writing bespoke scripts (custom path) | **[confirm]** commercial API terms, data-retention and no-training-on-inputs settings, rate limits, pricing. Model `claude-sonnet-5` (overridable). |
| **ElevenLabs** | Text-to-speech for all voiced sessions | **[confirm]** commercial usage rights for generated audio, per-character pricing tier, and — critically — **voice licensing** (see §4). |
| **Vercel** | Hosting, serverless functions, Blob storage, Web Analytics | **[confirm]** plan tier, bandwidth/function limits, DPA. |

These are the only external runtime services. There is no other SaaS, no payment
processor (no monetization yet), and no third-party auth.

## 3. Cost model (per session, qualitative)

- **Preset sessions are nearly free:** common lines are pre-voiced and served from
  Blob; only the name line (and any uncached line) is synthesized live.
- **Custom ("In your words") sessions are the cost driver:** one Claude completion
  (~1,600 max tokens) plus per-line ElevenLabs synthesis for the whole body.
- Meditations are mostly silence, so spoken word count per session is low
  (a 10-minute session is ~1,000 spoken words), keeping TTS spend modest.
- The main financial risk is **unauthenticated abuse of the custom/tts routes**
  (no rate limiting today) — see [security.md](./security.md).

## 4. Voices & audio assets — provenance

This is the highest-value IP question after the source code.

- **Voices:** the four default ElevenLabs voice IDs live in a **private ElevenLabs
  collection** tied to the account, and resolve only under that account's API key.
  **[confirm]** the licensing/usage rights for each voice for commercial
  distribution (ElevenLabs voices carry per-voice usage terms; some are the
  customer's, some are ElevenLabs library voices with their own conditions). This
  should be documented per voice before close.
- **Soundscape beds:** the Nature/Music beds are hosted MP3s (roadmap describes
  them as ElevenLabs catalog loops or generated). **[confirm]** the source and
  license of each bed file. The Frequencies family (brown noise, 432 Hz, binaural,
  delta, theta) is **synthesized in-browser** with no files, so it carries no
  third-party asset licensing.
- **Bells** are synthesized in the Web Audio engine (no sample files).
- **Fonts:** Manrope and Figtree are open-source (SIL Open Font License) **[confirm]**,
  loaded via `next/font` (Google Fonts).
- **`public/aurora.jpg`** (ElevenMind background): **[confirm]** its source/license.
  Not used by the relaxed brand.

## 5. Owned IP (created for relaxed)

- **Source code:** the Next.js app, the `AudioEngine`, the loudness-normalization
  model and measured trim tables, the preset script templates
  (`lib/sessionScripts.json`), the Claude prompts, and the cache system.
- **Brand identity:** the "stem" mark (`STEM_PATH`), the orbit glyph, the
  soundscape motifs, the icon/splash art, and the two-brand system.
- **Copy:** all product copy, the arrival lines, the fallback scripts.
- **The relaxed.app domain and app name** (`app.relaxed` bundle id).

Development was **AI-assisted** (Claude Code) under the founder's direction. **[confirm]**
that the founder's contract/terms with any tooling do not encumber ownership;
under Anthropic's terms the user owns the outputs, but an acquirer will want this
stated. There is no third-party contractor code in the tree.

## 6. Licensing of this repository

- **There is no `LICENSE` file.** By default this makes the code **proprietary /
  all rights reserved**, which is appropriate for a private product but should be
  made explicit (add a proprietary notice, or the acquirer's standard) at or
  before close.

## 7. The ElevenMind entanglement

The repository also produces **ElevenMind** (the ElevenLabs demo brand), including
"Voiced by ElevenLabs / scored with ElevenMusic" attribution. Any acquisition must
decide the disposition of the ElevenMind brand, its domain (`elevenmind.io`), and
whether the shared codebase is transferred with the ElevenMind fork removed or
retained. This is a structuring item, not a technical one, but it lives in the same
repo. See [design-system.md](./design-system.md#1-the-two-brand-fork).

## 8. IP diligence checklist

- [ ] Full license scan / SBOM of the transitive dependency tree.
- [ ] Per-voice ElevenLabs licensing documented (commercial distribution rights).
- [ ] Per-bed soundscape source/license documented.
- [ ] Font (Manrope, Figtree) and `aurora.jpg` licenses confirmed.
- [ ] Anthropic & ElevenLabs commercial terms + data settings confirmed.
- [ ] Add an explicit repository license / proprietary notice.
- [ ] Resolve the ElevenMind brand disposition.
- [ ] Confirm founder ownership of AI-assisted output is unencumbered.
