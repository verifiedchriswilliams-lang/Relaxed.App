import { describe, it, expect, vi, afterEach } from "vitest";
import { timeAgo, mmss, transcriptLines, greetingFor } from "@/lib/format";

afterEach(() => vi.useRealTimers());

describe("timeAgo", () => {
  it("buckets recent → coarse units", () => {
    const now = 1_000_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(timeAgo(now)).toBe("now");
    expect(timeAgo(now - 30_000)).toBe("now"); // < 45s
    expect(timeAgo(now - 5 * 60_000)).toBe("5m");
    expect(timeAgo(now - 3 * 3_600_000)).toBe("3h");
    expect(timeAgo(now - 2 * 86_400_000)).toBe("2d");
    expect(timeAgo(now - 14 * 86_400_000)).toBe("2w");
    expect(timeAgo(now - 60 * 86_400_000)).toBe("2mo");
  });

  it("never shows a negative age for a future timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    expect(timeAgo(2_000_000)).toBe("now");
  });
});

describe("mmss", () => {
  it("formats seconds as m:ss with a padded seconds field", () => {
    expect(mmss(0)).toBe("0:00");
    expect(mmss(5)).toBe("0:05");
    expect(mmss(65)).toBe("1:05");
    expect(mmss(600)).toBe("10:00");
    expect(mmss(59.9)).toBe("0:59");
  });
});

describe("transcriptLines", () => {
  it("splits on newlines and converts em dashes to commas (brand rule)", () => {
    expect(transcriptLines("breathe in — and out")).toEqual(["breathe in, and out"]);
    expect(transcriptLines("one\ntwo")).toEqual(["one", "two"]);
    expect(transcriptLines("")).toEqual([]);
  });
});

describe("greetingFor", () => {
  it("greets by time of day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 9, 0, 0));
    expect(greetingFor()).toBe("Good morning");
    vi.setSystemTime(new Date(2026, 0, 1, 14, 0, 0));
    expect(greetingFor()).toBe("Good afternoon");
    vi.setSystemTime(new Date(2026, 0, 1, 21, 0, 0));
    expect(greetingFor()).toBe("Good evening");
  });
});
