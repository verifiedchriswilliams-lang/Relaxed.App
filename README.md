# relaxed.app

**AI-personalized mindfulness.** Every session is written fresh for you, your
name, what you need (meditate, sleep, flow, relax), how long, and which voice, or
simply what you type in your own words, then voiced aloud over an ambient
soundscape with a breathing visual. **Claude** writes the meditation script;
**ElevenLabs** speaks it.

Next.js on Vercel, live on the web at [relaxed.app](https://relaxed.app) and on the
iOS App Store (a thin Capacitor shell over the hosted site).

> **📚 Full documentation:** see [`docs/`](./docs/README.md) — architecture,
> product spec, the audio engine, data & privacy, infrastructure, security,
> operations runbook, and more. This README is just the quick start.

---

## How it works (in one breath)

```
You pick: name · intention · length · voice · soundscape   (or type a phrase)
        │
        ▼
Claude   ─ writes the script (bespoke path) / templates (presets)
        │
        ▼
ElevenLabs ─ voices the lines (cache-first for presets)
        │
        ▼
Browser ─ plays voice + real silence over an ambient bed, with a breathing orb;
          the custom path starts instantly and streams the body in behind a
          spoken arrival. All prefs & history stay on the device.
```

Presets reuse pre-voiced lines from Vercel Blob, so they are fast and nearly free;
only the bespoke "In your words" path does a full live generation. The
"Frequencies" soundscapes are synthesized in the browser (no files); Nature and
Music beds are hosted audio. Full detail: [docs/audio-engine.md](./docs/audio-engine.md).

## Quick start

```bash
npm install
cp .env.example .env.local     # then paste in the keys you have
npm run dev                    # http://localhost:3000
```

**No keys?** The app runs in **preview mode**, guided silence with the script on
screen (and a generic fallback for the custom path), so you can feel the whole
flow before spending a cent.

For the relaxed brand locally, set `NEXT_PUBLIC_BRAND=relaxed`. The two keys that
unlock full behavior are `ANTHROPIC_API_KEY` (scripts) and `ELEVENLABS_API_KEY`
(voice). The **complete environment-variable reference** is in
[docs/infrastructure.md](./docs/infrastructure.md#3-environment-variables--complete-reference).

## Deploy

Production deploys automatically on push to `main` (Vercel). Set the environment
variables in the Vercel project; keys stay server-side and never reach the browser.
See [docs/operations-runbook.md](./docs/operations-runbook.md).

## Project layout (short)

```
app/    Next.js routes: page.tsx (the whole app + audio engine), 3 API routes, images
lib/    Logic: contexts, session templates, tts, voice cache, brand, marks, history, native
scripts/ Voice-cache / preview / blob-upload / loudness tools
docs/   Full documentation set (start at docs/README.md)
```

A file-by-file map is in [docs/repository-map.md](./docs/repository-map.md).

## Two brands, one codebase

`NEXT_PUBLIC_BRAND` selects **relaxed.app** (the standalone product) or
**ElevenMind** (the ElevenLabs demo) at build time. Keep brand-scoped changes
brand-aware. See [docs/design-system.md](./docs/design-system.md).

## License

No open-source license is granted; this is proprietary software, all rights
reserved. See [docs/third-party-ip.md](./docs/third-party-ip.md).
