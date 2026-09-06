# Moving audio to Vercel Blob

The soundscape beds (`public/sounds`, ~110 MB) and the pre-voiced voice cache
(`public/voice-cache`, ~53 MB) are too big to keep living in git. They now move
to a **Vercel Blob** store; the app resolves every audio path through
`NEXT_PUBLIC_BLOB_BASE_URL` (see `lib/assets.ts`).

The code is written so this is **safe and reversible**: while the env var is
unset, everything is served from `/public` exactly as before.

> **Status: complete.** This migration has already been done. All MP3s are
> gitignored (only `lib/voiceCacheManifest.json` is tracked), audio is served from
> Vercel Blob, and `NEXT_PUBLIC_BLOB_BASE_URL` is set in the Vercel project. The
> steps below are kept as the runbook for standing up Blob again (new
> environment, new store, or a fresh clone).

Small images (`public/aurora.jpg`, the OG images) stay in git — this is only
about the large audio.

## One-time setup (you do this in Vercel + GitHub)

1. **Create the Blob store.** Vercel dashboard → your project → **Storage** →
   **Create** → **Blob** → give it a name → **Create**. Connect it to the
   project when prompted.

2. **Copy the token.** Open the store → **`.env.local`** tab → copy the value
   of `BLOB_READ_WRITE_TOKEN` (starts with `vercel_blob_rw_…`).

3. **Add it as a GitHub secret.** Repo → **Settings** → **Secrets and
   variables** → **Actions** → **New repository secret**:
   - Name: `BLOB_READ_WRITE_TOKEN`
   - Value: the token from step 2

## Upload the audio (one click)

4. Repo → **Actions** → **Sync media to Blob** → **Run workflow** (leave the
   inputs blank). It uploads everything under `public/sounds` and
   `public/voice-cache` to Blob and, at the end of the log, prints:

   ```
   Blob base URL: https://xxxxxxxx.public.blob.vercel-storage.com
   ```

   Copy that URL.

## Point the app at Blob

5. Vercel → project → **Settings** → **Environment Variables** → add:
   - Name: `NEXT_PUBLIC_BLOB_BASE_URL`
   - Value: the base URL from step 4 (no trailing slash)
   - Environments: Production (and Preview if you want)

6. **Redeploy** (Vercel → Deployments → ⋯ → Redeploy, or push any commit).
   The app now streams audio from Blob. Test a session end to end — pick a
   soundscape, generate, confirm the voice and bed both play.

## Remove the MP3s from git (done)

7. **Complete.** The MP3s are removed from git and `.gitignore` excludes all
   audio (`*.mp3`, `public/sounds/`, `public/voice-cache/`, `public/voice-previews/`),
   so they never creep back in. Only `lib/voiceCacheManifest.json` is tracked.

## How it works afterward

- **Playback:** `lib/assets.ts` turns `/sounds/Rain.mp3` into
  `<base>/sounds/Rain.mp3`. Soundscape beds and cached voice lines both go
  through it.
- **New voice-cache lines** (e.g. when you add a script variant): the
  **Build voice cache** workflow now uploads freshly synthesized lines straight
  to Blob (it reads the same `BLOB_READ_WRITE_TOKEN` secret) and commits only
  the manifest — no more MP3s in git.
- **New soundscapes:** drop the file in `public/sounds`, run **Sync media to
  Blob** again (it skips what's already uploaded).
- **Local dev:** with no `NEXT_PUBLIC_BLOB_BASE_URL` in `.env.local`, the app
  falls back to files in `/public`. Keep a few beds locally, or set the base
  URL in `.env.local` to pull from Blob.
