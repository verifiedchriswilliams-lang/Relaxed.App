import { describe, it, expect } from "vitest";
import {
  SOUNDSCAPES,
  SOUND_CATS,
  catOf,
  soundDef,
  FIRST_TIME_SOUND,
} from "@/lib/audio/soundscapes";

describe("soundscape catalog", () => {
  it("ships 24 beds across three families, eight each", () => {
    expect(SOUNDSCAPES).toHaveLength(24);
    for (const cat of SOUND_CATS) {
      expect(SOUNDSCAPES.filter((s) => s.cat === cat.id)).toHaveLength(8);
    }
  });

  it("splits each family into 3 free + 5 premium", () => {
    for (const cat of SOUND_CATS) {
      const inCat = SOUNDSCAPES.filter((s) => s.cat === cat.id);
      expect(inCat.filter((s) => s.tier === "free")).toHaveLength(3);
      expect(inCat.filter((s) => s.tier === "premium")).toHaveLength(5);
    }
    // Every bed carries a tier so the future paywall can gate on it.
    for (const s of SOUNDSCAPES) {
      expect(s.tier === "free" || s.tier === "premium").toBe(true);
    }
  });

  it("has a unique id and a source file per bed", () => {
    const ids = new Set(SOUNDSCAPES.map((s) => s.id));
    expect(ids.size).toBe(SOUNDSCAPES.length);
    for (const s of SOUNDSCAPES) {
      expect(s.src, `${s.id} needs a src`).toBeTruthy();
      expect(s.label).toBeTruthy();
    }
  });

  it("has plausible measured loudness where present (dBFS, peak <= 0)", () => {
    for (const s of SOUNDSCAPES) {
      if (s.peak != null) expect(s.peak).toBeLessThanOrEqual(0);
      if (s.rms != null) expect(s.rms).toBeLessThan(0);
    }
  });

  it("catOf resolves a bed's family and defaults safely", () => {
    expect(catOf("rain")).toBe("nature");
    expect(catOf("piano")).toBe("music");
    expect(catOf("delta")).toBe("frequencies");
    // Unknown id falls back to nature rather than throwing.
    expect(catOf("silence")).toBe("nature");
  });

  it("soundDef finds a bed or returns undefined", () => {
    expect(soundDef("rain")?.label).toBe("Rain");
    expect(soundDef("silence")).toBeUndefined();
  });

  it("the first-time default bed exists in the catalog", () => {
    expect(soundDef(FIRST_TIME_SOUND)).toBeDefined();
  });
});
