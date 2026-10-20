import { describe, expect, it } from "vitest";
import { parseSpokenName } from "@/lib/speech";

describe("parseSpokenName", () => {
  it("returns a bare name capitalized", () => {
    expect(parseSpokenName("chris")).toBe("Chris");
    expect(parseSpokenName("Chris")).toBe("Chris");
  });

  it("strips common carrier phrases", () => {
    expect(parseSpokenName("my name is Chris")).toBe("Chris");
    expect(parseSpokenName("I'm Chris")).toBe("Chris");
    expect(parseSpokenName("call me Chris")).toBe("Chris");
    expect(parseSpokenName("it's Chris")).toBe("Chris");
    expect(parseSpokenName("this is Chris")).toBe("Chris");
  });

  it("strips a leading greeting/filler", () => {
    expect(parseSpokenName("hi, my name is Chris")).toBe("Chris");
    expect(parseSpokenName("um I'm Chris")).toBe("Chris");
  });

  it("keeps up to two words (first + last) and trims punctuation", () => {
    expect(parseSpokenName("Chris Williams")).toBe("Chris Williams");
    expect(parseSpokenName("my name is Chris Williams.")).toBe("Chris Williams");
    expect(parseSpokenName("Mary Jane Watson")).toBe("Mary Jane");
  });

  it("handles empty / whitespace", () => {
    expect(parseSpokenName("")).toBe("");
    expect(parseSpokenName("   ")).toBe("");
  });

  it("caps the length", () => {
    const long = "Supercalifragilisticexpialidociousandthensomeextralongname";
    expect(parseSpokenName(long).length).toBeLessThanOrEqual(40);
  });
});
