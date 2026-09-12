import { describe, it, expect } from "vitest";
import {
  breathAt,
  easeInOut,
  BREATH_IN,
  BREATH_HOLD,
  BREATH_OUT,
  BREATH_CYCLE,
} from "@/lib/breath";

describe("breath clock", () => {
  it("has a 14.5s cycle (6 + 2.5 + 6)", () => {
    expect(BREATH_CYCLE).toBe(14.5);
    expect(BREATH_IN + BREATH_HOLD + BREATH_OUT).toBe(BREATH_CYCLE);
  });

  it("easeInOut is bounded [0,1] and symmetric around 0.5", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 6);
    for (let x = 0; x <= 1; x += 0.1) {
      const y = easeInOut(x);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
  });

  it("reports the right phase across the cycle", () => {
    expect(breathAt(0).phase).toBe("in");
    expect(breathAt(BREATH_IN - 0.01).phase).toBe("in");
    expect(breathAt(BREATH_IN + 1).phase).toBe("hold");
    expect(breathAt(BREATH_IN + BREATH_HOLD + 1).phase).toBe("out");
  });

  it("holds fully inhaled (pb=1) during the hold", () => {
    expect(breathAt(BREATH_IN + 1).pb).toBe(1);
  });

  it("is fully exhaled (pb≈0) at the start of inhale", () => {
    expect(breathAt(0).pb).toBeCloseTo(0, 6);
  });

  it("is periodic over the cycle", () => {
    for (const t of [0, 1.3, 4.7, 8.2, 13.9]) {
      expect(breathAt(t).pb).toBeCloseTo(breathAt(t + BREATH_CYCLE).pb, 6);
      expect(breathAt(t).phase).toBe(breathAt(t + BREATH_CYCLE).phase);
    }
  });

  it("handles negative time without NaN (modulo wrap)", () => {
    const b = breathAt(-3);
    expect(Number.isNaN(b.pb)).toBe(false);
    expect(b.pb).toBeGreaterThanOrEqual(0);
    expect(b.pb).toBeLessThanOrEqual(1);
  });
});
