# Handoff: relaxed — "stem" identity

## Overview

`relaxed` is a personalized mindfulness app: the user gives their name, a context, a duration, a voice and a soundscape, and the app composes a guided session for them on demand. This handoff covers the **"stem" brand direction**, selected from three explored options.

The identity is one idea: the lowercase **r** reduced to a single stroke — a stem and a shoulder, no terminal. Everything else is restraint. There is no accent colour, no gradient, no illustration, no second typeface. Ink and bone only.

Two naming rules that must be applied consistently:

- **App Store / app name: `relaxed`** — no suffix. Lowercase.
- **Web wordmark: `relaxed.app`** — the `.app` is a detachable suffix set in Gray, never Ink. Removing it must never break the logo.
- Lowercase everywhere. `text-transform: uppercase` is not used anywhere in the product, including small UI labels — labels get positive tracking instead.

## About the design files

The `.dc.html` files in this bundle are **design references created in HTML** — prototypes showing intended look and behaviour, not production code to copy. Recreate them in the target codebase's existing environment (React, SwiftUI, Kotlin, whatever is already there) using its established patterns, component library and token system. If no environment exists yet, choose the most appropriate framework for the project.

The SVGs in `assets/` are the exception: those are production artwork, with one caveat noted under **Wordmark** below.

## Fidelity

**High-fidelity for the mark, medium for screens.** The mark geometry, the palette and the type specification are final and exact — do not redraw the mark by eye. Screen layouts in the reference file are a faithful intent, but should be rebuilt to the target platform's conventions and safe areas.

---

## 1. The mark

Single open path on a 100 × 100 grid. Stroke, not fill.

```
path:          M40 74 V40 C40 30 49 26 60 26
viewBox:       0 0 100 100
fill:          none
stroke-width:  13
stroke-linecap: butt      /* flat caps — never round */
```

Optical bounds are x 33.5–66.5, y 19.5–80.5, so the mark sits centred with ~20 units of clear space inside the tile. That clear space is part of the artwork — **do not add padding on top of it**.

### Stroke weight compensates at small sizes

| Rendered size | stroke-width |
|---|---|
| 40px and up | 13 |
| 24–39px | 14 |
| below 24px | 16 |

Files for each are in `assets/icon/`. Below ~14px the mark stops resolving — use the wordmark instead, not a further-thickened glyph.

### Don'ts

- Never round the caps. Never outline or add a stroke to the stroke.
- Never rotate, mirror, skew or re-space the path.
- Never fill the counter (the space under the shoulder).
- Never place the mark inside a circle.
- Never recolour it outside Ink and Bone.
- Never set the mark and the wordmark's own "r" adjacent at similar size — pick one.

### Files

```
assets/icon/
  relaxed-appicon-1024.svg              iOS / store, dark tile
  relaxed-icon-dark-tile-180.svg        dark tile, 23% radius
  relaxed-icon-light-tile-180.svg       light tile (bone), Ink stroke
  relaxed-icon-32.svg                   favicon, stroke 14
  relaxed-icon-18.svg                   smallest tile, stroke 16
  relaxed-glyph-bone.svg                bare glyph, no tile
  relaxed-glyph-ink.svg                 bare glyph, no tile
  relaxed-glyph-currentcolor.svg        bare glyph, inherits CSS color — use this in-app
  relaxed-android-foreground-432.svg    adaptive icon foreground (safe zone 264)
  relaxed-android-background-432.svg    adaptive icon background (solid Ink)
```

`relaxed-glyph-currentcolor.svg` is the one to use for in-product UI (nav, headers, loading states) so it inherits theme colour.

### Tile

- Squircle at **23% corner radius** of tile size. Use the platform superellipse on iOS/macOS; `border-radius: 23%` on web.
- Default is the **dark tile**: Ink `#121110` background, Bone `#EFEBE3` stroke, plus a 1px inset hairline `rgba(239,235,227,0.14)` when the tile sits on a dark surface so its edge stays visible.
- Light tile (Bone ground, Ink stroke) is the alternate — for light-mode favicons, print, and merchandise.

### Export sizes

| Use | Size | File |
|---|---|---|
| iOS app icon | 1024 | `relaxed-appicon-1024.svg` |
| iOS home screen | 180, 120 | derive from 1024 |
| Android adaptive | 432 fg + bg | the two `-432` files |
| PWA / manifest | 512, 192 | derive from 1024 |
| Favicon | 32, 16 | `relaxed-icon-32.svg` |
| Monochrome / notification | 24 | `relaxed-glyph-currentcolor.svg` |

Rasterise from the SVGs — the mark is pure geometry and scales cleanly.

---

## 2. Wordmark

**Figtree Regular (400), all lowercase, letter-spacing +1.5% (`0.015em`).**

- `relaxed` in Ink `#121110` (or Bone `#EFEBE3` reversed); `.app` in Gray `#8B857C`.
- The positive tracking is load-bearing — it is what separates this from a default app wordmark. Do not tighten it.
- Minimum clear space on all sides: the **cap height** of the type.
- Minimum size: 96px wide on screen, 24mm in print.
- Lockups: icon left of the wordmark at 52% of the wordmark's height, gap = one cap height; or icon centred above.

### ⚠ The wordmark SVGs contain live text

I cannot convert type to vector outlines. `assets/wordmark/*.svg` and `assets/lockup/*.svg` reference **Figtree** as a live font with a `system-ui` fallback. They render correctly wherever the webfont is available, but before using them as real logo files, open each once in Figma / Illustrator / Inkscape and **convert text to outlines**. Until then treat them as exact specifications rather than final artwork.

The icon and glyph SVGs have no text and need no such step.

### Files

```
assets/wordmark/
  relaxed-wordmark-ink.svg        primary (Ink + Gray suffix)
  relaxed-wordmark-bone.svg       reversed for dark surfaces
  relaxed-wordmark-mono-ink.svg   single colour, both words Ink
assets/lockup/
  relaxed-lockup-horizontal-light.svg
  relaxed-lockup-horizontal-dark.svg
  relaxed-lockup-stacked.svg
```

---

## 3. Design tokens

`assets/tokens.css` (custom properties) and `assets/tokens.json` (platform-agnostic) are in the bundle. Summary:

### Colour — the whole palette

```
--rx-ink    #121110   dark surface; primary text on light
--rx-bone   #EFEBE3   light surface; primary text on dark
--rx-paper  #FAF9F7   app background, light mode
--rx-gray   #8B857C   subdued text and the ".app" suffix
--rx-line   rgba(18,17,16,0.08)      hairline on light
--rx-line-d rgba(239,235,227,0.14)   hairline on dark
```

There is **no accent colour**. If the product later needs to distinguish session contexts, do it with a label and ordering, not with hue — the absence of colour is the identity.

Contrast: Ink on Paper 17.6:1 (AAA). Gray on Paper 4.6:1 (AA for body and above; do not use Gray below 14px, and never for interactive labels). Bone on Ink 15.9:1 (AAA).

### Type — Figtree only

Google Fonts, SIL Open Font License. Weights 300 / 400 / 500 / 600. Self-host; do not rely on the Google CDN in production.

| Role | Size / line | Weight | Tracking |
|---|---|---|---|
| Display | 46 / 48 | 500 | −1.5% |
| Title | 28 / 34 | 500 | −1% |
| Lede | 19 / 29 | 400 | +2% |
| Body | 16 / 27 | 400 | +1% |
| Action | 15 | 500 | +2% |
| Label | 11 | 400 | +12%, lowercase |
| Timecode | 20 | 400 | tabular-nums |

Negative tracking above 28px, positive below 20px. No uppercase anywhere.

### Space, radius, elevation

- 4pt base: 4 8 12 16 24 32 48 64. Mobile gutter 20, desktop 56, content column max 560.
- Radii 8 / 14 / 20 / pill. Anything the thumb touches is pill or 20. Icon tile 23%.
- Elevation is hairline-first: `1px var(--rx-line)` for grouping; `0 1px 3px rgba(18,17,16,0.08)` level 1 (pressed); `0 12px 28px -14px rgba(18,17,16,0.30)` level 2 (sheets only). No coloured or warm-tinted shadows.

### Motion

- **Breath loop 11s**: 4s in, 1s hold, 5s out, 1s rest, `cubic-bezier(.37,0,.63,1)`.
- Enter `cubic-bezier(.16,1,.3,1)`; exit `cubic-bezier(.4,0,1,1)`.
- Tap 120ms · select 220ms · screen change 480ms crossfade · setup→generating 900ms dissolve.
- Transitions fade and settle; they do not slide. Opacity plus a ≤8px lift only. Nothing overshoots or bounces.
- Audio leads: the soundscape fades in 1.2s before the player finishes composing itself.
- `prefers-reduced-motion`: hold the breathing element still and cross-fade the "breathe in / breathe out" caption pair on the same 11s cadence.

### Accessibility

- Every control ≥48px tall, ≥8px between targets. Play/pause is 88px — it gets pressed with eyes shut.
- Focus: 2px Ink ring at 3px offset, never removed.
- Selected states carry a filled Ink pill or a check, never colour alone (there is no colour).
- The player announces itself once ("your session is ready, 10 minutes") then stays quiet for screen readers; the read-along script panel is the accessible transcript.

---

## 4. In-app usage of the mark

- **App header**: `relaxed-glyph-currentcolor.svg` at 22px, left of the wordmark at 17px type.
- **Loading / composing state**: the glyph alone, centred, breathing on the 11s loop (scale 0.94 → 1.04, opacity 0.7 → 1). This is the one place the mark animates.
- **Player**: no mark. The screen is the session.
- **Empty states**: the glyph at 40px in Gray, nothing else.

Never animate the mark anywhere except the composing state.

---

## 5. Assets and licensing

No third-party or licensed assets. The mark is original geometry (path above). **Figtree** is on Google Fonts under the SIL Open Font License — free to download, self-host and ship. No raster or ICO files are included; generate them from the SVGs.

## 6. Files in this bundle

```
README.md                          this document
assets/                            production artwork + tokens (see above)
relaxed brand directions.dc.html   the three explored directions; "stem" is 2a.
                                   Useful context for why this one was chosen and
                                   what was rejected. Not an implementation target.
relaxed.app identity.dc.html       the earlier full brand system — screens (setup /
                                   generating / player at 390x880), component kit,
                                   motion and accessibility specs. NOTE: this file uses
                                   the SUPERSEDED serif-and-warm-paper identity. Take
                                   the screen structure, interaction model and component
                                   inventory from it; take all colour, type and mark
                                   decisions from this README, which overrides it.
support.js                         runtime for the .dc.html reference files
```

Open the `.dc.html` files directly in a browser.

## 7. Open items for the developer

- Raster exports (PNG/ICO) still need generating from the SVGs.
- The wordmark SVGs need their text outlined once (see §2).
- Figtree needs self-hosting: subset to latin + latin-ext, weights 400/500, woff2.
- The reference screens were designed at 390 × 880; verify the 88px play button and 48px controls against real device safe areas.
