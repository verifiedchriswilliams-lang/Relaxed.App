# Security

> Secrets handling, attack surface, content safety, and dependency posture. Data
> handling and privacy are in [data-privacy.md](./data-privacy.md).

## 1. Secrets

- **API keys are server-only.** `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, and
  `BLOB_READ_WRITE_TOKEN` are used only inside API routes / build scripts and are
  never in the client bundle. Only `NEXT_PUBLIC_*` values reach the browser, and
  those are non-secret by design (brand, blob base URL, custom flag).
- **Key hygiene:** `cleanKey()` strips non-printable characters from keys/voice
  IDs; `isVoiceId()` rejects anything that looks like a secret (an `sk_` prefix) or
  is too long, so a key can't be mistaken for a voice ID.
- **Storage:** secrets live in Vercel project env vars and GitHub Actions secrets.
  There is no secret in the repo. `.env.local` is gitignored.
- **Rotation:** rotate in the provider console, update the Vercel env var (and the
  GitHub secret if used by CI), redeploy. See
  [operations-runbook.md](./operations-runbook.md#rotate-a-key).

## 2. Attack surface

The server surface is three stateless POST routes; there is no database, no auth,
no user-supplied file upload, and no admin surface.

| Route | Input | Controls |
|---|---|---|
| `/api/generate` | name, context, duration, voice, accent, variantSeq | Inputs clamped (name ≤60, duration bounded, enums); output audio bounded; bounded TTS concurrency. |
| `/api/custom-script` | name, phrase, duration, leadSeconds, arrivalText | Inputs clamped (phrase ≤70, arrivalText ≤300, duration 3–30); empty phrase rejected (400). |
| `/api/tts` | text, voice, accent | Text ≤600; empty rejected (400); `no-store`. |

Notable properties and residual risks:

- **Prompt-injection surface:** the custom phrase is free text sent to Claude. The
  system prompt constrains output to a mindfulness script and the length is capped
  at 70 characters, which limits injection leverage, but a determined user could
  attempt to steer the script. Impact is low (the output is spoken meditation text
  played only to that user; no tools, no data access, no other users affected).
- **Cost/abuse:** the routes are unauthenticated and call paid providers. There is
  currently **no rate limiting or bot protection** at the application layer; abuse
  protection relies on Vercel platform limits. This is the main cost-exposure risk
  and is tracked in [risks-tech-debt.md](./risks-tech-debt.md#security--abuse).
  Preset sessions are cheap (cache-first); the custom path is the costly one.
- **No CSRF/session risk:** there is no authenticated session or cookie to forge;
  routes are pure content generators.
- **Transport:** HTTPS only (`cleartext: false` in the native shell; Vercel TLS on
  the web).
- **Output size:** `/api/generate` caps inline audio under Vercel's response limit
  by using a compact format for live lines, so a large session can't blow the
  response.

## 3. Content safety
<a id="content-safety"></a>

Because the bespoke path turns a user's words into a guided session, content
safety is a product-safety concern, not just a moderation one.

- The Claude prompt includes an explicit **crisis clause**: if the phrase suggests
  the person may be in crisis or considering self-harm, keep the session gentle
  and grounding, attempt no therapy or advice, include one soft line that reaching
  out to someone trusted or a helpline is a strong and kind thing to do, and never
  diagnose or promise an outcome.
- The UI states the app is **not medical or therapeutic advice**.
- Residual risk: there is no separate moderation/classification pass beyond the
  prompt instruction, and no logging of flagged content (by privacy design). An
  acquirer with a clinical-safety bar may want a dedicated safety classifier and an
  escalation/resources surface. Tracked in
  [risks-tech-debt.md](./risks-tech-debt.md).

## 4. Dependency posture

- Small dependency tree (see [third-party-ip.md](./third-party-ip.md)): Next/React,
  the Anthropic SDK, the Capacitor suite, `@vercel/analytics`, and `@vercel/blob`
  (dev). Fewer dependencies means a smaller supply-chain surface.
- `package-lock.json` is committed (pinned, reproducible installs).
- There is no automated dependency scanning (Dependabot/Snyk) configured. Low-cost
  to add; recommended. Tracked in [risks-tech-debt.md](./risks-tech-debt.md).

## 5. Recommended hardening (prioritized)

1. **Rate limit** `/api/custom-script` and `/api/tts` (per-IP token bucket, or
   Vercel's built-in protections) to cap provider spend under abuse.
2. Add **dependency scanning** (Dependabot) and a minimal CI check.
3. Consider a **safety classifier** on the custom phrase for a clinical-grade bar.
4. Add **security headers** (CSP, etc.) via `next.config.mjs` (currently empty).
5. Establish **key rotation cadence** and document last-rotated dates out of band.
