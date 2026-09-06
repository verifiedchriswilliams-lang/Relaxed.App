# Risks & Technical Debt

> An honest register of known limitations, debt, and reconciliation items. Written
> for a buyer who will find these anyway — better to name them and show they are
> understood and bounded. Nothing here is a surprise to the team.

## Severity legend

- 🔴 **High** — address before scale / material to a deal.
- 🟠 **Medium** — plan to address; manageable near-term.
- 🟢 **Low** — hygiene; cheap to fix.

## Organizational

- 🔴 **Bus factor of 1.** A solo founder with AI-assisted development. There is no
  second engineer and no institutional redundancy. The codebase is small,
  conventional, and heavily commented (which lowers onboarding cost), but
  continuity depends on one person today.
- 🟠 **No formal design source of record.** The design system is CSS custom
  properties + a few SVG paths, not a published component library or a Figma file
  of record. Adoptable, but not tooled.

## Engineering

- 🔴 **No automated tests.** <a id="testing"></a> Zero unit, integration, or e2e
  tests. QA is manual (the last checklist is [qa-phase0.md](./qa-phase0.md)). The
  audio engine, loudness math, and duration-fitting are exactly the kind of logic
  that benefits from tests. This is the highest engineering-quality gap.
- 🟠 **One very large component.** `app/page.tsx` is ~2,580 lines holding the UI
  state machine and the `AudioEngine`. It works and is commented, but it should be
  decomposed (extract the engine and each screen) before the team grows.
- 🟠 **No CI quality gate.** The two GitHub Actions are content-build utilities;
  there is no automated build/lint/test check on PRs. Vercel catches build breaks
  post-push, not pre-merge.
- 🟢 **No committed ESLint config.** `npm run lint` would scaffold one on first
  run; there is no enforced ruleset today.
- 🟢 **No dependency scanning.** No Dependabot/Snyk; low-cost to add.

## Security & abuse
<a id="security--abuse"></a>

- 🔴 **Unauthenticated paid routes, no rate limiting.** `/api/custom-script` and
  `/api/tts` call paid providers with no application-level rate limiting or bot
  protection. This is the main cost-exposure and abuse risk. Presets are cheap
  (cache-first); the custom path is the exposure. Mitigation options are in
  [security.md](./security.md#5-recommended-hardening-prioritized).
- 🟠 **Content safety is prompt-only.** The crisis-handling clause lives in the
  Claude prompt; there is no separate safety classifier or escalation surface.
  Adequate for the current positioning; a clinical-grade bar would want more.
- 🟢 **No security headers.** `next.config.mjs` is empty; no CSP or related headers.

## Product / scaling

- 🟠 **No accounts, no cross-device continuity.** All state is `localStorage` on
  one device; clearing site data or switching devices loses history and prefs.
  This is a deliberate Phase 2 tradeoff, not an accident, but it caps retention
  mechanics until an accounts backend exists.
- 🟠 **Provider dependency / single points of failure.** The core experience
  depends on Anthropic and ElevenLabs availability and pricing. Degradation modes
  exist (preview/fallback), but there is no second provider.
- 🟢 **Availability limited to US + Canada.** EU expansion needs a GDPR/DSA pass.

## iOS

- 🟠 **Guideline 4.2 exposure.** A web-wrapper app can draw "minimum
  functionality" scrutiny; mitigated with review notes emphasizing real-time
  generated audio and background playback, but a re-review risk on major changes.
- 🟢 **`ios/` project is not fully version-controlled.** It is regenerated from
  `capacitor.config.ts` + `assets/` (Pods/build/copied assets are gitignored),
  which is standard for Capacitor but means the Xcode project state is not
  reproducible from git alone without the generation step.
- 🟢 **Launch-screen caching** requires delete/restart/reinstall to verify new
  splashes — a footgun documented in [ios-native.md](./ios-native.md).

## Documentation reconciliation
<a id="documentation-reconciliation"></a>

Discrepancies found during this documentation pass (code is authoritative):

- 🟢 **`ANTHROPIC_MODEL` default.** `.env.example` says `claude-opus-5`; the code
  default is `claude-sonnet-5` (`app/api/custom-script/route.ts:12`). Decide the
  intended production model and align `.env.example`.
- 🟢 **`ELEVENLABS_OUTPUT_FORMAT` default.** `.env.example` says `mp3_22050_32`; the
  code default is `mp3_44100_128` (the compact format is only the inline-line
  fallback). Align `.env.example`.
- 🟢 **`SILENCE_SCALE`** appears in `.env.example` but is not read anywhere in the
  current code. Remove it or wire it up.
- 🟢 **Stale doc bodies (now refreshed):** `voice-cache.md` previously instructed
  committing cache MP3s to git (contradicts `.gitignore` + the Blob flow);
  `blob-migration.md` read as if the git removal was still pending; `ios-build.md`
  said Node 18 while CI uses Node 22. These were corrected in the documentation
  pass; re-check on the next change.
- 🟢 **`README.md` (root) was stale** (claimed browser-synthesized soundscapes with
  no files, "wraps to iOS later", 10–40s generate-then-play). Rewritten to point
  at this docs set.
- 🟢 **Legacy storage key name.** On-device prefs use `elevenmind.prefs.v1` for both
  brands. Harmless, but confusing; consider a brand-neutral key with a migration.

## Suggested first 90 days for an acquiring team

1. Add rate limiting to the paid routes (🔴 cost/abuse).
2. Introduce a test harness for the audio/timing/loudness logic (🔴 quality).
3. Decompose `app/page.tsx` (🟠 maintainability).
4. Stand up CI (build + lint + test + dependency scan) as a merge gate.
5. Plan the accounts backend for cross-device continuity (🟠 retention).
6. Complete the IP checklist in [third-party-ip.md](./third-party-ip.md#8-ip-diligence-checklist).
