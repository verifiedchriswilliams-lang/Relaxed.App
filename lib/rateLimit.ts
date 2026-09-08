// Best-effort, per-instance rate limiting for the paid API routes.
//
// The custom-script / tts / generate routes are unauthenticated and call paid
// providers (Anthropic, ElevenLabs), so an abuser hammering them spends real
// credits. This is a lightweight first line of defence: a fixed-window counter
// keyed by client IP, held in module memory.
//
// IMPORTANT — what this does and does not do:
//  - It runs in-process, so each warm serverless instance has its own counters.
//    A burst from one IP usually lands on one warm instance and is caught; a
//    highly distributed flood across many cold instances is not fully bounded.
//    For durable, cross-instance limiting, back this with a shared store
//    (Vercel KV / Upstash Redis) behind the same `rateLimit()` signature.
//  - It is deliberately **fail-open**: any internal error returns "allowed" so a
//    limiter bug can never take the product down. The cost of a miss is a few
//    extra provider calls, never a blocked session for a legitimate user.
//
// The core `rateLimit()` is a pure function (inject `now` for tests); the route
// glue (reading the IP, building the 429) lives in `enforceRateLimit()`.

export interface RateLimitResult {
  ok: boolean;
  /** Requests still allowed in the current window (0 when blocked). */
  remaining: number;
  /** Seconds until the window resets (for a Retry-After header). */
  retryAfterSec: number;
  /** The window's request ceiling, for an X-RateLimit-Limit header. */
  limit: number;
}

interface Bucket {
  count: number;
  resetAt: number; // epoch ms when the window rolls over
}

// Keyed by `${name}:${ip}`. Module-scoped, so it survives across warm
// invocations on the same instance and resets on a cold start.
const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the map can't grow without bound under many distinct
// IPs. Runs at most once per sweep interval, on a normal request path (no timer,
// which serverless would not keep alive anyway).
let lastSweep = 0;
const SWEEP_EVERY_MS = 60_000;
function sweep(now: number) {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitOptions {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
  /** Injectable clock for tests; defaults to Date.now(). */
  now?: number;
}

// Pure fixed-window check. Increments the caller's counter and reports whether
// this request is within the limit. Same key + window = one rolling ceiling.
export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const { limit, windowSec } = opts;
  const now = opts.now ?? Date.now();
  const windowMs = windowSec * 1000;

  // A non-positive limit disables limiting for that route (fail-open by config).
  if (!Number.isFinite(limit) || limit <= 0) {
    return { ok: true, remaining: Number.POSITIVE_INFINITY, retryAfterSec: 0, limit: 0 };
  }

  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: windowSec, limit };
  }

  existing.count += 1;
  const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfterSec, limit };
  }
  return { ok: true, remaining: limit - existing.count, retryAfterSec, limit };
}

// Test-only: clear all counters between cases.
export function __resetRateLimits() {
  buckets.clear();
  lastSweep = 0;
}

// Derive a client key from the standard proxy headers. Vercel sets
// `x-forwarded-for` (client first) and `x-real-ip`. Falls back to a shared
// bucket when neither is present, which throttles unknown-origin traffic
// together rather than not at all.
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

// Per-route ceilings (requests per 60s per IP), overridable by env so limits can
// be tuned in Vercel without a deploy. Chosen generously: a real session never
// approaches these, but a scripted abuser is capped.
//  - custom-script: the pricey Claude path; a person starts a handful at most.
//  - tts: one call per spoken line, streamed as the session plays, so a real
//    session trickles these out over minutes, not in a burst.
//  - generate: preset assembly (mostly cached), cheap but still provider-backed.
function envLimit(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}

export const ROUTE_LIMITS: Record<string, number> = {
  "custom-script": envLimit("RL_CUSTOM_PER_MIN", 8),
  tts: envLimit("RL_TTS_PER_MIN", 40),
  generate: envLimit("RL_GENERATE_PER_MIN", 12),
};

// Route glue: enforce the named route's limit for this request. Returns a 429
// `Response` to short-circuit with, or `null` to proceed. Never throws.
export function enforceRateLimit(headers: Headers, route: keyof typeof ROUTE_LIMITS): Response | null {
  try {
    const limit = ROUTE_LIMITS[route];
    const res = rateLimit(`${route}:${clientIp(headers)}`, { limit, windowSec: 60 });
    if (res.ok) return null;
    return new Response(
      JSON.stringify({ error: "Too many requests. Please slow down and try again shortly." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(res.retryAfterSec),
          "X-RateLimit-Limit": String(res.limit),
          "X-RateLimit-Remaining": String(res.remaining),
          "Cache-Control": "no-store",
        },
      }
    );
  } catch {
    // Fail open: a limiter fault must never block a real session.
    return null;
  }
}
