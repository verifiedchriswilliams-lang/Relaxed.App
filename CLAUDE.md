# CLAUDE.md — working agreement for relaxed.app

Guidance for anyone (human or AI) making changes here. relaxed.app is developed
AI-assisted with Claude Code, so this file is the durable place that keeps quality
and documentation consistent across sessions. Read it before making changes.

Full documentation lives in [`docs/`](./docs/README.md) — start there for how the
product works.

## The product in one line

An AI-personalized mindfulness app: Claude writes the meditation script, ElevenLabs
voices it, the browser mixes and plays it over an ambient soundscape. Next.js on
Vercel; no database; all per-user state on-device. One codebase, two brands
(relaxed.app + ElevenMind) via `NEXT_PUBLIC_BRAND`.

## Golden rules (do not break these)

1. **No em dashes in user-facing product copy.** Use commas, periods, or "and".
   (This applies to UI strings, scripts, and store copy — not internal docs.)
2. **relaxed is dark-only** with lowercase chrome. Keep brand-scoped changes
   brand-aware: never let a relaxed change disturb the ElevenMind build, or vice
   versa. Relaxed rules are scoped under `[data-brand="relaxed"]`.
3. **No model identifiers** (e.g. specific model names/versions) in commit
   messages, PR titles/bodies, code comments, or anything pushed to the repo.
   Keep those to chat only.
4. **`main` is production.** Pushing to `main` deploys to relaxed.app via Vercel.
   Verify `npm run build` before pushing.
5. **Commit trailer.** End commit messages with the co-author/session trailer used
   throughout the history.

## Documentation is part of "Done"

A change is not finished until the docs that describe it are updated **in the same
change**. This is enforced, not just requested:

- Run **`npm run check:docs`** before committing. It validates internal links and a
  set of pinned, drift-prone facts (model default, voice-cache size, breath
  cadence, stem-mark path, versions, storage keys, brand colours). CI runs it too
  (`.github/workflows/docs-check.yml`), so drift fails the build.
- If `check:docs` fails, either the code changed and a doc must catch up, or a new
  fact needs pinning — fix the doc (or add the pin in `scripts/check-docs.mjs`).
- User-facing changes get a [CHANGELOG](./docs/CHANGELOG.md) entry.

### Code → docs map

When you touch the left, update the right (same commit):

| If you change… | Update… |
|---|---|
| API routes (`app/api/**`), the pipeline, the audio engine/domain (`lib/audio/**`), or rate limiting (`lib/rateLimit.ts`) | [audio-engine.md](./docs/audio-engine.md) (and [security.md](./docs/security.md) for routes/limits), and [architecture.md](./docs/architecture.md) if a flow changes |
| Pure logic with a test (`lib/**`, `tests/**`) | add/adjust the `tests/*.test.ts` case in the same change |
| Screens / tray / history / onboarding in `app/page.tsx` | [product-spec.md](./docs/product-spec.md) |
| `lib/history.ts`, `lib/analytics.ts` (storage keys, events) | [data-privacy.md](./docs/data-privacy.md) (and the storage/event tables) |
| Env vars, `next.config.mjs`, `capacitor.config.ts`, CI workflows, `scripts/**` | [infrastructure.md](./docs/infrastructure.md), [operations-runbook.md](./docs/operations-runbook.md) |
| Native shell / Info.plist / assets | [ios-native.md](./docs/ios-native.md), [ios-build.md](./docs/ios-build.md) |
| `app/relaxed.css` tokens, `lib/mark.tsx`, `lib/brand.ts`, `lib/soundMotifs.tsx` | [design-system.md](./docs/design-system.md) **and** the brand source of truth in [`docs/brand/relaxed-stem/`](./docs/brand/relaxed-stem/README.md) (`tokens.json`, `tokens.css`) |
| Dependencies (`package.json`) | [overview.md](./docs/overview.md) (stack), [third-party-ip.md](./docs/third-party-ip.md) |
| Anything user-facing / a release | [CHANGELOG.md](./docs/CHANGELOG.md) |
| A new limitation or known gap | [risks-tech-debt.md](./docs/risks-tech-debt.md) |
| Files added/moved/removed | [repository-map.md](./docs/repository-map.md) |

## Source of truth

- **Code is authoritative for behavior.** If a doc and the code disagree, the code
  wins and the doc is wrong — fix the doc.
- **The brand package is the source of truth for identity.** The shipped decisions
  are recorded in [`docs/brand/relaxed-stem/`](./docs/brand/relaxed-stem/README.md)
  and its `tokens.json`/`tokens.css`; keep them in step with `app/relaxed.css`
  (the checker verifies Ink/Bone and the breath cadence match).
- Known reconciliation items live in
  [risks-tech-debt.md](./docs/risks-tech-debt.md#documentation-reconciliation).

## Testing / quality

- A **Vitest** unit suite (`tests/`, run `npm test`) covers the pure logic:
  loudness math + bed/voice selection (`lib/audio/levels`), the soundscape
  catalog, session blueprints + the audio envelope (`lib/engine`), the breath
  clock (`lib/breath`), history storage, rate limiting, and formatters. Add a test
  alongside any change to that logic. The `AudioEngine` graph and the React UI
  have no automated coverage yet, and audio/haptics still need real-device QA (see
  [qa-phase0.md](./docs/qa-phase0.md)); extending coverage there is the top
  remaining quality gap ([risks-tech-debt.md](./docs/risks-tech-debt.md#testing)).
- `npm run build`, `npm test`, and `npm run check:docs` must all pass. CI runs the
  build + tests (`ci.yml`) and the docs check on every PR.

## Common commands

```bash
npm run dev          # local dev (preview mode works with no API keys)
npm run build        # production build (pre-push sanity check)
npm test             # Vitest unit tests (pure logic)
npm run check:docs   # documentation drift + link check
npm run lint         # next lint
```

Operational procedures (deploy, iOS release, rebuild caches, rotate keys,
rebalance audio) are in [operations-runbook.md](./docs/operations-runbook.md).
