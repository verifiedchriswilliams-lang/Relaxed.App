// The breathing cycle, shared by the player orb and the on-screen cue so they
// can never drift: 6s inhale, a 2.5s hold at the top, 6s exhale (a 14.5s cycle).
// Pure math, so the timing is unit-tested directly.

export const BREATH_IN = 6;
export const BREATH_HOLD = 2.5;
export const BREATH_OUT = 6;
export const BREATH_CYCLE = BREATH_IN + BREATH_HOLD + BREATH_OUT;

export function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

// For a position t seconds into playback, the eased breath amount (0 = fully
// exhaled, 1 = fully inhaled / held at the top) and which phase we're in. The
// orb scales with `pb`; the cue words read from `phase` — one source of truth,
// so "Breathe in" always lands with the ring expanding.
export function breathAt(t: number): { pb: number; phase: "in" | "hold" | "out" } {
  const c = ((t % BREATH_CYCLE) + BREATH_CYCLE) % BREATH_CYCLE;
  if (c < BREATH_IN) return { pb: easeInOut(c / BREATH_IN), phase: "in" };
  if (c < BREATH_IN + BREATH_HOLD) return { pb: 1, phase: "hold" };
  return {
    pb: easeInOut(1 - (c - BREATH_IN - BREATH_HOLD) / BREATH_OUT),
    phase: "out",
  };
}
