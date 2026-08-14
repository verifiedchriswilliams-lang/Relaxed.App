# Voice caching (how sessions are voiced)

Sessions are no longer written fresh by Claude on every request. For a given
state and length the script is essentially fixed, so we keep a canonical script
per state in `lib/sessionScripts.json`. Each line is either:

- a **common line** (same for everyone) — voiced **once per voice** and cached, or
- a **name line** (contains `{name}`) — synthesized **live** per session (1–2 short lines).

At request time `app/api/generate/route.ts` assembles the session: cached common
lines are returned as static URLs (instant, free, off the CDN), and only the name
line(s) are sent to ElevenLabs. That makes generation near-instant and cheap, and
keeps the personalization.

## Building the cache

You run this locally with your ElevenLabs key (it can't run in the sandbox/CI):

```bash
# 1. make sure your key is in .env.local
#    ELEVENLABS_API_KEY=sk_...

# 2. build the cache (all four voices: Her/Him x US/UK)
npm run build:voices

# ...or just the voices you use:
node scripts/build-voice-cache.mjs female-uk male-uk

# 3. commit the results and push
git add public/voice-cache lib/voiceCacheManifest.json
git commit -m "Build voice cache"
git push
```

The script writes one MP3 per (voice, common line) into `public/voice-cache/`,
named by a hash, and updates `lib/voiceCacheManifest.json` (the list of hashes
the route treats as cached). It **skips files that already exist**, so re-running
after a small change only does the new work.

## When to re-run

- **You edited a line** in `lib/sessionScripts.json` → re-run (the changed line
  gets a new hash and is re-voiced; the old file is now unused and can be deleted).
- **You added a variant** → re-run.
- **You added or changed a voice** → re-run (optionally just that voice key).

Until the cache is built, everything still works: any line that isn't cached is
synthesized live as a fallback, just slower and a touch more costly. So the app
is never broken by a missing cache, it just gets faster once you build it.

## Notes

- Voice IDs and delivery settings (speed/stability) come from the same env vars
  the app uses, so cached audio matches live audio.
- The cache is voice-specific. Four voices x ~65 common lines is a few hundred
  small MP3s. If that grows large for git later, move `public/voice-cache` to a
  blob store (Vercel Blob / S3) and point `cacheUrl()` at it.
