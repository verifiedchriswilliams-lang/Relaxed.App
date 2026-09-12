import { describe, it, expect } from "vitest";
import {
  normGain,
  bedAndVoice,
  VOICE_TARGET,
  PEAK_CEIL,
  BED_SOLO,
} from "@/lib/audio/levels";

describe("normGain (loudness normalization)", () => {
  it("boosts a quiet, low-peak signal toward the target", () => {
    // rms well below target, peak far from the ceiling => gain > 1.
    const g = normGain(-40, -30, VOICE_TARGET);
    expect(g).toBeGreaterThan(1);
    // db applied is target - rms = -24 - (-40) = 16 dB => 10^(16/20).
    expect(g).toBeCloseTo(Math.pow(10, 16 / 20), 5);
  });

  it("attenuates a loud signal below the target", () => {
    const g = normGain(-10, -6, VOICE_TARGET);
    expect(g).toBeLessThan(1);
  });

  it("never lets the peak exceed the ceiling", () => {
    // A hot peak (-0.5) is above the ceiling (-1.5): the peak cap must dominate,
    // holding gain below what the rms target alone would ask for.
    const rms = -12;
    const peak = -0.5;
    const g = normGain(rms, peak, VOICE_TARGET);
    const resultingPeak = peak + 20 * Math.log10(g);
    expect(resultingPeak).toBeLessThanOrEqual(PEAK_CEIL + 1e-9);
  });

  it("is the min of the rms move and the peak headroom", () => {
    const rms = -20;
    const peak = -2;
    const target = -24;
    const expectedDb = Math.min(target - rms, PEAK_CEIL - peak);
    expect(normGain(rms, peak, target)).toBeCloseTo(Math.pow(10, expectedDb / 20), 6);
  });
});

describe("bedAndVoice (selection -> concrete gains + bed)", () => {
  it("returns a bed source and level for a real soundscape", () => {
    const r = bedAndVoice("female", "us", "rain");
    expect(r.src).toBeTruthy();
    expect(r.src).toContain("Rain.mp3");
    expect(typeof r.level).toBe("number");
    expect(r.voiceGain).toBeGreaterThan(0);
  });

  it("plays the bed louder when there is no voice (solo)", () => {
    const withVoice = bedAndVoice("female", "us", "ocean");
    const solo = bedAndVoice("none", "us", "ocean");
    // Same bed, but solo targets BED_SOLO (louder) than the under-voice target.
    expect(solo.level).toBeGreaterThan(withVoice.level!);
  });

  it("gives a voiceless session a neutral voice gain", () => {
    // 'none' has no VOICE_STATS entry, so voiceGain falls back to 1.
    expect(bedAndVoice("none", "us", "rain").voiceGain).toBe(1);
  });

  it("has no bed source for a soundscape with no file (silence)", () => {
    const r = bedAndVoice("female", "us", "silence");
    expect(r.src).toBeUndefined();
    expect(r.level).toBeUndefined();
  });

  it("exposes the solo target as louder than nothing", () => {
    expect(BED_SOLO).toBeGreaterThan(-30);
  });
});
