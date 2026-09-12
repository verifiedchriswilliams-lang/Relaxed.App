import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, clientIp, __resetRateLimits } from "@/lib/rateLimit";

beforeEach(() => __resetRateLimits());

describe("rateLimit (fixed window)", () => {
  it("allows up to the limit, then blocks within the window", () => {
    const opts = { limit: 3, windowSec: 60, now: 1_000 };
    expect(rateLimit("k", opts).ok).toBe(true);
    expect(rateLimit("k", opts).ok).toBe(true);
    const third = rateLimit("k", opts);
    expect(third.ok).toBe(true);
    expect(third.remaining).toBe(0);
    // Fourth request in the same window is blocked.
    const fourth = rateLimit("k", opts);
    expect(fourth.ok).toBe(false);
    expect(fourth.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    expect(rateLimit("k", { limit: 1, windowSec: 60, now: 0 }).ok).toBe(true);
    expect(rateLimit("k", { limit: 1, windowSec: 60, now: 1_000 }).ok).toBe(false);
    // 60s later the window rolls over.
    expect(rateLimit("k", { limit: 1, windowSec: 60, now: 61_000 }).ok).toBe(true);
  });

  it("tracks distinct keys independently", () => {
    const opts = { limit: 1, windowSec: 60, now: 0 };
    expect(rateLimit("a", opts).ok).toBe(true);
    expect(rateLimit("b", opts).ok).toBe(true); // different key, own budget
    expect(rateLimit("a", opts).ok).toBe(false);
  });

  it("treats a non-positive limit as disabled (fail-open)", () => {
    for (let i = 0; i < 100; i++) {
      expect(rateLimit("k", { limit: 0, windowSec: 60, now: i }).ok).toBe(true);
    }
  });

  it("reports remaining count as it counts down", () => {
    const opts = { limit: 5, windowSec: 60, now: 0 };
    expect(rateLimit("k", opts).remaining).toBe(4);
    expect(rateLimit("k", opts).remaining).toBe(3);
  });
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for hop", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.5, 70.41.3.18" });
    expect(clientIp(h)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip, then a shared bucket", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
