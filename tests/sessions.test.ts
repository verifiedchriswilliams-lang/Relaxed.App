import { describe, it, expect } from "vitest";
import {
  assembleSession,
  variantCount,
  sessionTranscript,
  type ResolvedLine,
} from "@/lib/sessions";

describe("assembleSession", () => {
  it("returns spoken lines for a valid session", () => {
    const lines = assembleSession("meditation", 10, 0);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => typeof l.text === "string" && l.text.length > 0)).toBe(true);
  });

  it("clamps every silence gap to a sane 2..120s", () => {
    for (const min of [5, 10, 30]) {
      for (const l of assembleSession("meditation", min, 0)) {
        expect(l.pause).toBeGreaterThanOrEqual(2);
        expect(l.pause).toBeLessThanOrEqual(120);
      }
    }
  });

  it("includes at least as many lines at a longer duration (band inclusion)", () => {
    const short = assembleSession("meditation", 5, 0).length;
    const long = assembleSession("meditation", 30, 0).length;
    expect(long).toBeGreaterThanOrEqual(short);
  });

  it("selects variants deterministically and wraps out-of-range indices", () => {
    const n = variantCount("meditation");
    expect(n).toBeGreaterThan(0);
    // -1 wraps to the last variant; n wraps back to 0.
    expect(assembleSession("meditation", 10, -1)).toEqual(
      assembleSession("meditation", 10, n - 1)
    );
    expect(assembleSession("meditation", 10, n)).toEqual(
      assembleSession("meditation", 10, 0)
    );
  });

  it("falls back to meditation for an unknown context", () => {
    // Cast through unknown: exercises the runtime fallback, not the type.
    const bogus = assembleSession("not-a-context" as unknown as "meditation", 10, 0);
    expect(bogus).toEqual(assembleSession("meditation", 10, 0));
  });
});

describe("sessionTranscript", () => {
  it("resolves the {name} token, defaulting to 'friend'", () => {
    const lines: ResolvedLine[] = [
      { text: "hello {name}", pause: 5, name: true },
      { text: "breathe", pause: 5, name: false },
    ];
    expect(sessionTranscript(lines, "Chris")).toBe("hello Chris\nbreathe");
    expect(sessionTranscript(lines, "  ")).toBe("hello friend\nbreathe");
  });
});
