# relaxed.app

**AI-personalized mindfulness.** Every session is written fresh for you — your name, what you need (meditation, sleep, flow, relax, stress relief), how long, and which voice — then voiced aloud. Two AIs in a trench coat: **Claude** writes the meditation script, **ElevenLabs** speaks it.

Built with Next.js. Runs on the web today; wraps to iOS later.

---

## How it works

```
You pick: name · goal · length · voice · soundscape
        │
        ▼
Claude  ─ writes a meditation script tailored to you, with pacing/pause tags
        │
        ▼
ElevenLabs ─ turns the script into a spoken voice (MP3)
        │
        ▼
Browser ─ plays the voice over a synthesized soundscape,
          with a breathing-circle visual, and remembers your prefs
```

The five session types live in `lib/contexts.ts` — each one just reshapes the tone of the script; the pipeline is identical. Soundscapes (rain / ocean / drone) are **synthesized in the browser** with the Web Audio API, so there are no audio files to license or host.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Add your keys
cp .env.example .env.local
#    then open .env.local and paste in the two keys (see below)

# 3. Run it
npm run dev
#    → open http://localhost:3000
```

**No keys yet?** The app still runs in **preview mode** — Claude/ElevenLabs are skipped, you get a sample script on screen and the soundscape + breathing visual, so you can feel the whole flow before spending a cent.

---

## Getting the two API keys

### 1. Anthropic (Claude) — writes the script

1. Go to **https://console.anthropic.com** and sign in / sign up.
2. Add a little credit (Settings → Billing — a few dollars covers a lot of testing; each session is a fraction of a cent of script).
3. Settings → **API Keys** → **Create Key**, copy it.
4. Paste into `.env.local` as `ANTHROPIC_API_KEY=...`

### 2. ElevenLabs — speaks the script

1. Go to **https://elevenlabs.io** and sign up. The **free tier** gives you monthly characters — plenty for a proof of concept. (For real usage the **Starter/Creator** plan is the one to watch; TTS is billed per character.)
2. Click your avatar → **Profile + API key** → copy the key.
3. Paste into `.env.local` as `ELEVENLABS_API_KEY=...`
4. *(Optional)* Pick your two voices: open the **Voices** library, choose a male and a female voice you like, copy each voice ID, and set `ELEVENLABS_VOICE_MALE` / `ELEVENLABS_VOICE_FEMALE`. The built-in fallbacks are ElevenLabs' free preset voices "Adam" and "Rachel".

**Selected production voices** (baked into the app as defaults — no env vars needed, just the API key):

| Slot | Name | Voice ID |
|------|------|----------|
| Her · US | — | `7AvtJrjTNyBhBxEvNPIZ` |
| Him · US | — | `6bPfTtSpgxgD0GeBVfqu` |
| Her · UK | Almee | `zA6D7RyKdc2EClouEMkP` |
| Him · UK | Theo | `UmQN7jS1Ee8B1czsUtQh` |

The user picks Her/Him and a US or UK accent in the tray; the app sends both to `/api/generate`, which resolves the right voice. Each slot can be overridden with `ELEVENLABS_VOICE_{FEMALE,MALE}_{US,UK}`. These voices live in a private ElevenLabs collection, so the account's own API key must be the one in use for them to resolve; otherwise ElevenLabs falls back to a preset voice.

> **Cost note:** meditations are mostly *silence*, so the script uses `<break/>` pause tags rather than paying to synthesize quiet. A 10-minute session is only ~1,000 spoken words. Cheap per session — worth watching as users scale.

---

## Deploy (Vercel)

1. Push this repo to GitHub.
2. Import it at **https://vercel.com/new**.
3. Add the two environment variables (`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`) in the Vercel project settings.
4. Deploy. Point `relaxed.app` at it in the domains tab.

Keys live only on the server (in the `/api/generate` route) — they are never exposed to the browser.

---

## Project layout

```
app/
  page.tsx            The whole experience: setup → generating → player
  layout.tsx          App shell + metadata
  globals.css         Styling (a calm first pass — Claude Design refines this)
  api/generate/
    route.ts          Server: Claude (script) → ElevenLabs (voice)
lib/
  contexts.ts         The 5 session types + the script-writer prompt
.env.example          Copy to .env.local and fill in
```

## Known limitations (it's a POC)

- **Pacing** relies on ElevenLabs `<break/>` tags (max 3s each). Real minute-long silences need padding — the soundscape covers the gap after the voice ends and fades at your chosen duration. Good enough to feel the magic; a later version can stitch true silence.
- **No accounts** — preferences are saved in `localStorage` on the device. Add auth (e.g. Supabase) when you want cross-device + saved sessions.
- **Generate-then-play** — a session takes ~10–40s to produce. Fine for a POC; streaming/pre-generation is a later optimization.

## Roadmap

- **Voice previews.** When the user taps Her / Him, play a short cached clip of that voice saying something brief ("Hello, I'm ready for your session whenever you are") so they can hear each voice while choosing. Cache one small file per voice rather than calling ElevenLabs on every tap.
- **Soundscape / music previews.** Same idea for the soundscape picker: a short taste of rain / ocean / drone (and later, ElevenLabs music beds) as the user selects, so they know what they're choosing before the session starts.
- Claude Design pass on the UI (`globals.css` + `page.tsx`).
- Decide on accounts + saved/favorite sessions.
- Later: Capacitor/native wrapper for the App Store.
