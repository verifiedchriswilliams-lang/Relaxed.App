# relaxed.app — Documentation

This is the living technical and product documentation set for **relaxed.app**, an
AI-personalized mindfulness app. It is written to the standard a sophisticated
acquirer's technical and product diligence would expect: precise, current, and
grounded in the actual code, with every non-obvious claim traceable to a file.

> **Status at a glance.** Live in production on the web (`relaxed.app`) and on the
> iOS App Store. Next.js on Vercel; no database; two AI providers (Anthropic for
> scripts, ElevenLabs for voice). Solo founder, AI-assisted development. See
> [overview.md](./overview.md) for the full snapshot.

## How this set is organized

| # | Document | What it covers |
|---|---|---|
| 1 | [overview.md](./overview.md) | Product, positioning, current status, tech-stack snapshot, team. Start here. |
| 2 | [architecture.md](./architecture.md) | System design, component boundaries, request lifecycles, key decisions. |
| 3 | [product-spec.md](./product-spec.md) | Features, user flows, intentions, voices, soundscapes, personalization. |
| 4 | [audio-engine.md](./audio-engine.md) | The Web Audio engine and AI pipeline — the core differentiator. |
| 5 | [design-system.md](./design-system.md) | The "stem" identity, design tokens, and the two-brand fork. |
| 6 | [data-privacy.md](./data-privacy.md) | Data inventory, on-device storage, analytics, third-party data flows, compliance posture. |
| 7 | [security.md](./security.md) | Secrets handling, attack surface, content safety, dependency posture. |
| 8 | [infrastructure.md](./infrastructure.md) | Hosting, environments, the complete env-var reference, Blob storage, CI/CD, domains. |
| 9 | [ios-native.md](./ios-native.md) | The Capacitor iOS shell and how it relates to the web app. |
| 10 | [operations-runbook.md](./operations-runbook.md) | Run, build, deploy, release, rotate keys, rebuild audio caches, measure loudness. |
| 11 | [repository-map.md](./repository-map.md) | File-by-file / module-by-module code map. |
| 12 | [third-party-ip.md](./third-party-ip.md) | Dependencies, licenses, provider terms, asset & voice provenance, IP ownership. |
| 13 | [risks-tech-debt.md](./risks-tech-debt.md) | Honest known limitations, technical debt, and reconciliation items. |
| 14 | [roadmap.md](./roadmap.md) | Product strategy and phased plan. |
| 15 | [CHANGELOG.md](./CHANGELOG.md) | Release history (web + iOS). |

### Detailed runbooks & assets (referenced by the above)

- [ios-build.md](./ios-build.md) — step-by-step iOS build & App Store submission.
- [blob-migration.md](./blob-migration.md) — moving media to Vercel Blob.
- [voice-cache.md](./voice-cache.md) — the pre-voiced line cache.
- [qa-phase0.md](./qa-phase0.md) — the Phase 0 QA checklist (historical record).
- [brand/relaxed-stem/](./brand/relaxed-stem/README.md) — the formal brand identity
  handoff: mark geometry, palette, type, motion, and production SVG artwork + tokens.
- `screenshots/` — reference captures of the main screens (home, tray, composing, player).

## Keeping this living (enforced, not just hoped)

Documentation is part of the definition of done, and there are mechanisms to keep
it that way:

- **`npm run check:docs`** ([scripts/check-docs.mjs](../scripts/check-docs.mjs))
  validates every internal link and a set of pinned, drift-prone facts read live
  from the code (Claude model default, voice-cache size, breath cadence, the
  stem-mark path, dependency versions, on-device storage keys, brand colours). If
  a pinned value changes in code but not in the docs, the check fails.
- **CI** runs the same check on every push and PR
  ([.github/workflows/docs-check.yml](../.github/workflows/docs-check.yml)), so
  drift fails the build.
- **[CLAUDE.md](../CLAUDE.md)** carries the working agreement and the **code → docs
  map**: which doc to update when you touch a given part of the code. Since
  development is AI-assisted, this is loaded every session.
- **The PR template** ([.github/pull_request_template.md](../.github/pull_request_template.md))
  carries a docs checklist.

Conventions:

- **Source of truth is the code** for behavior; the **brand package**
  ([brand/relaxed-stem/](./brand/relaxed-stem/README.md)) is the source of truth
  for identity. When a doc and the code disagree, fix the doc. Known items:
  [risks-tech-debt.md](./risks-tech-debt.md#documentation-reconciliation).
- **Cite files.** Prefer `path:line` references over prose descriptions of code.
- **Update in the same commit.** A material change updates its doc; user-facing
  changes get a [CHANGELOG](./CHANGELOG.md) entry.
- **No em dashes in user-facing product copy** (a brand rule). These internal
  docs are exempt, but the app's strings must use commas, periods, or "and".
- **Add a pin.** When you add a value worth protecting from drift, add a check to
  `scripts/check-docs.mjs` so it can never silently fall out of sync again.

_Last full pass: 2026-09-07 (Sunday). Reconcile the items in
[risks-tech-debt.md](./risks-tech-debt.md#documentation-reconciliation) when
convenient._
