# Design System & Brand

> The "stem" identity for relaxed.app, its design tokens, and the mechanism that
> produces two brands from one codebase. Implementation: `app/globals.css` (base),
> `app/relaxed.css` (relaxed overrides), `lib/brand.ts`, `lib/mark.tsx`,
> `lib/iconArt.ts`, `lib/soundMotifs.tsx`.

> **Source of record.** A formal brand handoff lives in
> [`brand/relaxed-stem/`](./brand/relaxed-stem/README.md): the exact mark
> geometry, the full palette, the type scale, motion specs, accessibility rules,
> and production SVG artwork (`assets/icon`, `assets/wordmark`, `assets/lockup`)
> plus `tokens.json` / `tokens.css`. That handoff is authoritative for the mark,
> palette, and type; this document describes **what is actually implemented in the
> app**, which is a deliberate subset (see "Spec vs implementation" at the end).

## 1. The two-brand fork

`lib/brand.ts` selects a brand at **build time** from `NEXT_PUBLIC_BRAND`:
`"relaxed"` → relaxed.app; anything else → ElevenMind (default, so the existing
ElevenMind deployment is untouched). The chosen `BRAND` object carries `id, name,
strong, light, domain, url, support`.

- **Runtime gate:** `const IS_RELAXED = BRAND.id === "relaxed"` (`app/page.tsx:31`).
- **CSS gate:** `<html data-brand={BRAND.id}>` (`app/layout.tsx`), and every
  relaxed rule is scoped under `[data-brand="relaxed"]`.
- **Feature gate:** the bespoke "Make Your Own" path is on by default for relaxed,
  off for ElevenMind, overridable by `NEXT_PUBLIC_ENABLE_CUSTOM`
  (`lib/contexts.ts`).

What differs by brand:

| Aspect | relaxed.app | ElevenMind |
|---|---|---|
| World | Single committed **dark** Ink/Bone world, no imagery, no accent color | Night-sky: fixed aurora photo, translucent glass, per-intention colored gradient orbs |
| Mark | Lowercase "r" **stem** stroke | Two-bar "11" glyph |
| Type | Figtree | Manrope |
| Chrome case | Lowercase labels/controls | Normal case |
| Attribution | Contact / Privacy footer links | "Voiced by ElevenLabs · scored with ElevenMusic" |
| Icon / OG | Bone stem on Ink tile | Teal "11" on dark-blue gradient |
| Theme color | `#121110` | `#070912` |

## 2. relaxed identity tokens

Defined under `:root[data-brand="relaxed"]` in `app/relaxed.css` (overriding the
ElevenMind base in `globals.css`). relaxed is **deliberately dark-only.**

**Color**
| Token | Value | Role |
|---|---|---|
| `--night-0`, `--night-1` | `#121110` | Ink — the ground (both grounds are Ink) |
| `--ink-0` | `#efebe3` | Bone — primary text/marks |
| `--ink-1` | `rgba(239,235,227,.72)` | Secondary text |
| `--ink-2` | `rgba(239,235,227,.5)` | Tertiary (the ".app" suffix, placeholders) |
| `--glass` | `#1c1b18` | Raised surface (solid; no blur) |
| `--glass-line` | `rgba(239,235,227,.14)` | Hairline |
| `--glass-strong` | `#efebe3` | Selected/primary fill = Bone |
| `--rx-invert-fg` | `#121110` | Ink text on a Bone fill |
| `--rx-line-strong` | `rgba(239,235,227,.24)` | Stronger hairline |
| `--rx-hover` | `rgba(239,235,227,.06)` | Hover wash |

**Type**
- `--rx-font-family` = Figtree (loaded in `layout.tsx`, weights 300–600), applied
  via `--font`.

**Motion** (calmer, no overshoot)
| Token | Value | Role |
|---|---|---|
| `--rx-ease-breath` | `cubic-bezier(.37,0,.63,1)` | The breathing curve |
| `--rx-breath` | `14.5s` | Ornamental pulse cadence (composing/closing glow); matches the 14.5s guided breath so the world breathes as one |
| `--rx-ease-soft` | `cubic-bezier(.16,.84,.44,1)` | UI settle, no overshoot |
| `--t-ui` | `0.34s` | ~2× the ElevenMind base (0.16s) |
| `--ease-ui`, `--ease-spring` | remapped to `--rx-ease-soft` | Kills the springy overshoot |

Structural moves: solid surfaces (no `backdrop-filter`), a monochrome breathing
bloom behind orbs, a breathing ring driven by a shared JS clock variable (`--pb`)
rather than a keyframe (so it holds when paused), a calm `rx-screen-in` fade on
each screen transition, and an iPad/large-screen scale-up at ≥768px.

## 3. The "stem" mark

The lowercase "r" reduced to a single open stroke — a stem and a shoulder, no
terminal — on a 100×100 grid, always **stroked, never filled**, with flat caps.

- `STEM_PATH = "M40 74 V40 C40 30 49 26 60 26"` (`lib/mark.tsx:5`). The geometry is
  exact and must not be redrawn by eye.
- `stemStroke(px)`: 16 below 24px, 14 below 40px, else 13 — the weight compensates
  as the mark shrinks so it keeps resolving.
- `StemGlyph` renders it in-product (inherits `currentColor`); the wordmark uses a
  tight-cropped inline version; the favicon/apple-icon/OG marks reuse the same
  path (Bone on Ink) via `lib/iconArt.ts`.

## 4. The orbit ("recent") glyph

`OrbitGlyph` (`lib/mark.tsx`) is a proprietary counterclockwise circular arrow — a
single Bone stroke with a leading arrowhead, "the orb's orbit run backward" — used
for the history entry point and the history page header. Counterclockwise (arrow
leading down-left) reads as going back in time. Drawn in the same thin line
language as the rest of the identity, no fill, no color.

## 5. Soundscape motifs

Each soundscape has a distinct line motif (`lib/soundMotifs.tsx`) that animates
inside the player's breathing ring, with per-motif keyframes (ripple, fall, drift,
spin, sway, pulse, shimmer, flash, bob, pluck, swirl, chime). These are the only
"illustration" in the relaxed world and stay monochrome line art.

## 6. Accessibility & motion

- The design respects reduced-motion preferences (the base stylesheet has a
  reduced-motion block; relaxed's ring is JS-clock driven and calm by default).
- Contrast: Bone (`#efebe3`) on Ink (`#121110`) is high-contrast; secondary/tertiary
  inks step down deliberately for hierarchy.
- Icon-only controls carry `aria-label`s (e.g. the history entry, back, and star
  buttons).

## 7. Brand assets in the repo

- `assets/icon.png` (1024²) — source app icon (flat; iOS 26 applies the live bevel).
- `assets/splash.png`, `assets/splash-dark.png` (2732²) — source launch images
  (the beveled "r" is baked in, since launch images don't get the live bevel).
- These feed `@capacitor/assets` to generate all native icon/splash sizes; see
  [ios-native.md](./ios-native.md).

## 8. Spec vs implementation (reconciled)

The [brand handoff](./brand/relaxed-stem/README.md) has been **updated to match the
shipped product** (2026-09-07): where an earlier spec value and the code once
differed, the shipped decision now wins and is recorded in the handoff and its
token files (`tokens.json`, `tokens.css`). Decisions baked in:

- **Dark-only.** The product ships a single dark Ink/Bone world; the handoff's
  light `--rx-paper` mode and light tile are retained only as a light/print
  alternate (favicons, print, merch), explicitly not used in the app.
- **Dark palette is canonical.** The handoff now carries the shipped dark scale
  (Bone stepped by opacity: `--ink-0/1/2`, `--glass`, `--glass-line`, etc.), and
  records that the ".app" suffix and placeholders are **Bone at 50%**, not a flat
  gray hex.
- **Breathing cadence 14.5s** (6s in / 2.5s hold / 6s out), and a single soft
  decelerate (`cubic-bezier(.16,.84,.44,1)`) at 0.34s as the UI motion signature.

The mark geometry, wordmark, spacing, and radius specs were already consistent and
are unchanged. Going forward the handoff and the code are kept in sync by hand
(there is no automated token pipeline; see below).

## 9. Diligence note

The design system is intentional and consistent. It exists both as a formal
handoff (mark geometry, palette, type, motion, production SVGs, tokens under
[`brand/relaxed-stem/`](./brand/relaxed-stem/README.md)) and as the shipped
implementation (CSS custom properties + SVG paths in code). There is no published
component library, Storybook, or automated token pipeline connecting the two, so
the handoff and the code are kept in sync by hand. Tracked in
[risks-tech-debt.md](./risks-tech-debt.md).
