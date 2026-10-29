# Liquid Glass Orb

A real-time WebGL orb for relaxed.app (Three.js + React Three Fiber), built toward
the approved reference image: a translucent glass sphere with warm ivory/champagne
light flowing through its interior, floating in near-black.

This is the **first pass (brief stages 1–3)**. It compiles, builds, and runs; the
**material tuning against the reference still has to happen on a real GPU** (see
"Verifying" below).

## Files

- `shaders.ts` — GLSL for the three materials (outer glass shell, internal ribbons,
  suspended motes). Each is independently tunable.
- `ribbonGeometry.ts` — builds the internal ribbons as real 3D swept surfaces
  (closed, organic loops) so they have genuine depth and view-dependent shading.
- `LiquidGlassOrb.tsx` — the reusable component and its scene, motion, and the
  audio-reactive interface. Renders its own `<Canvas>` so it can be dropped anywhere.

## Running the dev lab

```bash
npm run dev
# open http://localhost:3000/orb-lab
```

The lab shows the orb against black with a deterministic control panel: switch
idle / speaking / listening, drag the audio level, toggle a sim envelope (a
stand-in, **not** real voice), and toggle reduced motion. The route is not linked
from the app; open it directly.

## The interface (for the voice system later)

```ts
<LiquidGlassOrb
  audioLevel={0..1}     // already-smoothed voice amplitude
  isSpeaking={boolean}
  isListening={boolean}
  reducedMotion={boolean}
/>
```

The component never talks to the speech provider. When we integrate, feed it a
smoothed amplitude from the existing audio engine (an `AnalyserNode` on the TTS
output). `audioLevel` drives ribbon brightness/deformation, rim intensity, mote
brightness, and a very small scale change; the booleans set the resting energy.

## Rendering approach & tradeoffs

- **Glass before glow.** The outer shell is a custom Fresnel shader (champagne rim +
  two crisp speculars, near-clear center), *not* `MeshPhysicalMaterial` transmission.
  Transmission is expensive on mobile and needs an environment map; the Fresnel
  shell gives the "transparent glass, dark interior" read cheaply. Real transmission
  can be layered in later if the rim/refraction needs more depth — profile first.
- **Ribbons are geometry, not a billboard.** Five swept-surface loops in different
  orientations, shaded with a bright ivory edge and a translucent champagne body, so
  they overlap with real parallax.
- **Restraint.** Bloom is light (intensity 0.5, high threshold) so edges stay crisp;
  motes are ~44 points, not a particle field; motion is a slow sway + ~1% breathing,
  never a spin.
- **Performance.** DPR capped at 2, GPU-side animation via uniforms (no per-frame
  geometry rebuilds), resources disposed on unmount, reduced-motion respected.

## Verifying (important)

This was authored in an environment whose renderer is **software only**, which
cannot display transparent glass — so the look has **not** been visually confirmed.
Run the brief's comparison loop on a real GPU (iPhone Safari / a Mac browser):

1. Open `/orb-lab`, screenshot the actual canvas at the reference's orb size.
2. Compare to the reference, in this priority order: **glass first** (transparent
   shell, dark interior, champagne rim — not a glowing ball), **then ribbons**
   (depth, curvature, bright edges), **then lighting** (warm palette, restrained
   bloom, subtle halo), then motion.
3. Make targeted changes to `shaders.ts` / the `RIBBONS` config — don't rewrite.

## Likely discrepancies to expect on first GPU run

- Ribbon density/width and how "sculptural" vs. "linear" they read — the organic
  loop params in `RIBBONS` (and `ribbonGeometry`) are the first thing to tune.
- Shell transparency vs. rim strength — balance so the center stays dark and clear.
- Bloom amount — raise only if edges stay crisp.
- Overall size/framing on a portrait phone (the `scale` prop + camera distance).
- Whether a subtle real-transmission pass is worth the cost for added refraction.

## Not done yet (later brief stages)

Stage 4 voice states are stubbed through the interface but need real audio. Stage 5
is integration into the hello screen. Stage 6 is on-device profiling. Lock the
static look (stages 1–2) on a GPU before moving on.
