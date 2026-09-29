import { describe, it, expect } from "vitest";
import { detectPosture, arrivalLines, postureDirective } from "@/lib/arrival";

describe("detectPosture", () => {
  it("defaults to still for empty or seated intentions", () => {
    expect(detectPosture("")).toBe("still");
    expect(detectPosture(null)).toBe("still");
    expect(detectPosture("wind down before bed")).toBe("still");
    expect(detectPosture("I'm anxious about a presentation")).toBe("still");
  });

  it("detects moving intentions (eyes open, in motion)", () => {
    expect(detectPosture("a 15 minute walk")).toBe("moving");
    expect(detectPosture("going for a run")).toBe("moving");
    expect(detectPosture("something for my workout")).toBe("moving");
    expect(detectPosture("stretching after the gym")).toBe("moving");
    expect(detectPosture("a hike this morning")).toBe("moving");
  });

  it("detects driving as its own (strictest) mode", () => {
    expect(detectPosture("a drive through the countryside")).toBe("driving");
    expect(detectPosture("my commute home")).toBe("driving");
    expect(detectPosture("driving to work")).toBe("driving");
  });

  it("does not false-positive on words that merely contain a keyword", () => {
    expect(detectPosture("eating cookies on the couch")).toBe("still");
    expect(detectPosture("a walkthrough of my day")).toBe("still");
  });
});

describe("arrivalLines", () => {
  it("greets by name and keeps a posture-neutral first breath", () => {
    const lines = arrivalLines("Chris", "still");
    expect(lines).toHaveLength(3);
    expect(lines[0].text).toBe("Let's begin, Chris.");
    expect(lines[2].text).toContain("slow breath");
  });

  it("tells a seated person to close their eyes, but never a mover or driver", () => {
    expect(arrivalLines("", "still")[1].text.toLowerCase()).toContain("eyes close");
    expect(arrivalLines("", "moving")[1].text.toLowerCase()).not.toContain("close");
    expect(arrivalLines("", "moving")[1].text.toLowerCase()).not.toContain("sit");
    const driving = arrivalLines("", "driving")[1].text.toLowerCase();
    expect(driving).toContain("road");
    expect(driving).not.toContain("close your eyes");
  });

  it("omits the name gracefully", () => {
    expect(arrivalLines("  ", "still")[0].text).toBe("Let's begin.");
  });
});

describe("postureDirective", () => {
  it("is empty for the seated default and non-empty otherwise", () => {
    expect(postureDirective("still")).toBe("");
    expect(postureDirective("moving")).not.toBe("");
    expect(postureDirective("driving")).not.toBe("");
  });

  it("forbids closing the eyes for both active modes", () => {
    expect(postureDirective("moving").toLowerCase()).toContain("do not");
    expect(postureDirective("driving").toLowerCase()).toContain("eyes must stay on the road");
  });
});
