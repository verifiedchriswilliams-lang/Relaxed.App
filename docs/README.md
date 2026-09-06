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

## Conventions for keeping this living

- **Source of truth is the code.** When a doc and the code disagree, the code
  wins and the doc is wrong — fix the doc. Known discrepancies are tracked in
  [risks-tech-debt.md](./risks-tech-debt.md#documentation-reconciliation).
- **Cite files.** Prefer `path:line` references over prose descriptions of code.
- **Update on change.** A material change to a subsystem should update the
  relevant doc in the same commit. Releases get a [CHANGELOG](./CHANGELOG.md) entry.
- **No em dashes in user-facing product copy** (a brand rule). These internal
  docs are exempt, but the app's strings must use commas, periods, or "and".

_Last full pass: 2026-09-07 (Sunday). Reconcile the items in
[risks-tech-debt.md](./risks-tech-debt.md#documentation-reconciliation) when
convenient._
