# Overview

## What relaxed.app is

relaxed.app is an **AI-personalized mindfulness app**. Instead of a fixed catalog
of pre-recorded meditations, it composes a session for the individual in the
moment: the user picks an intention (meditate, sleep, flow, relax), a length, and
a voice, or simply types what they are carrying ("In your words"), and the app
writes and voices a bespoke guided session, played over an ambient soundscape
with a breathing visual.

Two AI systems do the work: **Claude (Anthropic)** writes the meditation script,
and **ElevenLabs** speaks it. The application owns the timing and the mix, so a
session is not gappy text-to-speech but "voice, silence, breath, silence, voice"
scheduled on the audio clock with an ambient bed underneath.

## Product thesis

> Make the *moment* exceptional, remove all friction, add private continuity,
> then build the ecosystem. North star: **relaxed should feel like a luxury
> object, not a wellness utility.**

The wedge against Calm and Headspace is not a bigger library, it is "tell relaxed
what you need and it makes one for you." The full strategy and phased plan live in
[roadmap.md](./roadmap.md).

## Current status (2026-09)

| Dimension | State |
|---|---|
| Web | **Live in production** at `relaxed.app` (Vercel, deploys on every push to `main`). |
| iOS | **On the App Store.** v1.1 released; v1.1.1 in review (see [CHANGELOG](./CHANGELOG.md)). |
| Android | Not built. Capacitor supports it; deferred. |
| Accounts | None. All per-user state is on-device (`localStorage`). |
| Backend/DB | None. Three stateless serverless API routes; no persistence layer. |
| Availability | US + Canada (App Store). |
| Monetization | Not yet. Premium tier ("relaxed+") is a Phase 3 bet. |
| Analytics | Anonymous, aggregate-only (Vercel Web Analytics + custom events). No accounts, no identifiers, never the name or the typed phrase. |

## Technology stack (snapshot)

| Area | Choice | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) | 14.2.35 | React 18.3.1. |
| Language | TypeScript | ^5 | `strict: true`. |
| Hosting | Vercel | — | Serverless functions for API routes; static + edge for images. |
| Script AI | Anthropic Claude | SDK 0.68.0 | Model `claude-opus-5` (code default; overridable). |
| Voice AI | ElevenLabs | REST | `eleven_multilingual_v2`. |
| Media storage | Vercel Blob | SDK 2.8.0 | Soundscape beds, cached voice lines, previews. |
| Client audio | Web Audio API | — | Custom mixer; no audio library. |
| iOS shell | Capacitor | 8.5.0 | WKWebView over the hosted site + native plugins. |
| Analytics | Vercel Web Analytics | 2.0.1 | First-party, cookieless. |
| Styling | Hand-authored CSS | — | Custom properties; no framework. |

Full dependency and license detail is in [third-party-ip.md](./third-party-ip.md).
Full environment and infra detail is in [infrastructure.md](./infrastructure.md).

## The two-brand arrangement

The same codebase produces two independent products, selected at build time by
`NEXT_PUBLIC_BRAND`:

- **relaxed.app** — the standalone brand (this product): a dark-only "stem"
  identity, its own domain and support address, the bespoke "In your words" path
  on by default.
- **ElevenMind** (`elevenmind.io`) — the ElevenLabs demo: a night-sky look, with
  explicit "Voiced by ElevenLabs / scored with ElevenMusic" attribution.

Diligence note: because both brands share one repository, any acquisition scope
must clarify treatment of the ElevenMind brand and its ElevenLabs attribution.
See [design-system.md](./design-system.md) and [risks-tech-debt.md](./risks-tech-debt.md).

## Team & development model

- **Solo founder** (Chris Williams), with development done AI-assisted (Claude
  Code). Of 146 commits over the project's first ~3.5 weeks (first commit
  2026-08-13), the large majority are AI-authored under the founder's direction.
- **Bus factor is 1.** There is no second engineer. This is the single largest
  organizational risk and is called out in [risks-tech-debt.md](./risks-tech-debt.md).
- The codebase is small, conventional Next.js, and heavily commented, which
  lowers onboarding cost for an acquiring team.

## What a reviewer should read next

- To understand *how it works*: [architecture.md](./architecture.md) then
  [audio-engine.md](./audio-engine.md).
- To understand *what it does*: [product-spec.md](./product-spec.md).
- To assess *risk*: [data-privacy.md](./data-privacy.md),
  [security.md](./security.md), [third-party-ip.md](./third-party-ip.md),
  [risks-tech-debt.md](./risks-tech-debt.md).
