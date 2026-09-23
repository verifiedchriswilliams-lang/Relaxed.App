import { describe, it, expect } from "vitest";
import {
  DURATIONS,
  DURATION_STOPS,
  INFINITE,
  isInfinite,
  guideMinutes,
  INFINITE_GUIDE_MIN,
} from "@/lib/contexts";
import { assembleSession } from "@/lib/sessions";

describe("endless (∞) duration", () => {
  it("adds the ∞ sentinel as the last slider stop, after 60", () => {
    expect(DURATION_STOPS[DURATION_STOPS.length - 1]).toBe(INFINITE);
    expect(DURATION_STOPS.slice(0, -1)).toEqual([...DURATIONS]);
    // Sentinel is negative so it never collides with a real minute count...
    expect(INFINITE).toBeLessThan(0);
    // ...and survives a JSON round-trip (Infinity would become null).
    expect(JSON.parse(JSON.stringify({ d: INFINITE })).d).toBe(INFINITE);
  });

  it("isInfinite only matches the sentinel, not real durations", () => {
    expect(isInfinite(INFINITE)).toBe(true);
    for (const m of DURATIONS) expect(isInfinite(m)).toBe(false);
  });

  it("guideMinutes collapses ∞ to the guided-arc length, else passes through", () => {
    expect(guideMinutes(INFINITE)).toBe(INFINITE_GUIDE_MIN);
    for (const m of DURATIONS) expect(guideMinutes(m)).toBe(m);
  });

  it("the guided-arc length assembles a real, in-range session", () => {
    const lines = assembleSession("meditation", guideMinutes(INFINITE), 0);
    expect(lines.length).toBeGreaterThan(0);
    expect(INFINITE_GUIDE_MIN).toBeGreaterThanOrEqual(3);
    expect(INFINITE_GUIDE_MIN).toBeLessThanOrEqual(60);
  });
});
