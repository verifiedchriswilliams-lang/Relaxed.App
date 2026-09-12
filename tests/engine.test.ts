import { describe, it, expect } from "vitest";
import { blueprintFor, audioProfile } from "@/lib/engine";

describe("blueprintFor (session arc planning)", () => {
  it("scene target seconds sum to the body budget (within rounding)", () => {
    const bp = blueprintFor("custom", 10);
    const sum = bp.scenes.reduce((a, s) => a + s.targetSeconds, 0);
    // Rounding can drift by at most ~half a second per scene.
    expect(Math.abs(sum - bp.bodyTargetSeconds)).toBeLessThanOrEqual(bp.scenes.length);
  });

  it("clamps duration to the 3..60 minute band", () => {
    const tiny = blueprintFor("custom", 1);
    const huge = blueprintFor("custom", 999);
    // 1 min clamps up to 3 (180s), 999 clamps down to 60 (3600s).
    expect(tiny.bodyTargetSeconds).toBeLessThanOrEqual(180);
    expect(huge.bodyTargetSeconds).toBeLessThanOrEqual(3600);
    expect(huge.bodyTargetSeconds).toBeGreaterThan(tiny.bodyTargetSeconds);
  });

  it("reserves the arrival lead but caps it at ~a third of the session", () => {
    const total = 10 * 60;
    const withLead = blueprintFor("custom", 10, { leadSeconds: 60 });
    expect(withLead.bodyTargetSeconds).toBe(total - 60);

    // An absurd lead is capped at 34% of total, never starving the body.
    const capped = blueprintFor("custom", 10, { leadSeconds: 10_000 });
    expect(capped.bodyTargetSeconds).toBeGreaterThanOrEqual(total - total * 0.34 - 1);
  });

  it("gives every scene a positive word budget and target", () => {
    for (const s of blueprintFor("custom", 15).scenes) {
      expect(s.targetSeconds).toBeGreaterThan(0);
      expect(s.wordBudget).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("audioProfile (scene-based envelope)", () => {
  it("sleep thins the voice out toward the end while the bed persists", () => {
    const p = audioProfile("sleep");
    expect(p.voice(1)).toBeLessThan(p.voice(0));
    expect(p.voice(1)).toBeLessThan(0.5);
    // The bed never drops out; it stays present to carry the sleeper.
    expect(p.bed(1)).toBeGreaterThan(0.5);
  });

  it("the default profile keeps steady presence, softening only at the close", () => {
    const p = audioProfile("meditation");
    expect(p.voice(0.5)).toBe(1);
    expect(p.voice(1)).toBeLessThanOrEqual(1);
    expect(p.bed(0.5)).toBe(1);
  });

  it("relax and stress-relief share the gentler ease-out profile", () => {
    const relax = audioProfile("relax");
    const stress = audioProfile("stress-relief");
    expect(relax.voice(1)).toBe(stress.voice(1));
    expect(relax.bed(1)).toBe(stress.bed(1));
    expect(relax.voice(1)).toBeLessThan(1);
  });

  it("multipliers stay within a sane [0,1] range across progress", () => {
    for (const ctx of ["sleep", "relax", "meditation", "flow"] as const) {
      const p = audioProfile(ctx);
      for (let x = 0; x <= 1; x += 0.25) {
        expect(p.bed(x)).toBeGreaterThan(0);
        expect(p.bed(x)).toBeLessThanOrEqual(1);
        expect(p.voice(x)).toBeGreaterThan(0);
        expect(p.voice(x)).toBeLessThanOrEqual(1);
      }
    }
  });
});
