# OC Knowledge: relaxed.app

A knowledge base for "Other.Chris" (OC), the ElevenLabs voice agent on usernamedchris.com.
This file covers one of Chris Williams' projects: **relaxed.app**. Everything here is
drawn from the repository (code, docs, commit history, config). Where something could not
be verified from the repo, it is marked "(needs Chris)" or left as a question at the end.
No secrets, keys, or private user data are included.

---

## 1. One-liner

relaxed.app is an AI-personalized mindfulness app that writes and voices a brand-new
guided meditation for you in the moment, instead of handing you a fixed library of
pre-recorded sessions.

## 2. The elevator pitch (spoken)

relaxed is a meditation app that makes the session for you, right when you need it. You
tell it what you want, whether that is to sleep, to focus, to meditate, or just to relax,
and how long you have, and it writes a fresh guided meditation and speaks it to you in a
calm voice over an ambient soundscape. If you would rather, you can just say or type what
you are carrying that day, something like "I am wired and I cannot wind down," and it
writes a session for exactly that. Under the hood, Claude writes the script and ElevenLabs
gives it a voice, but the whole thing is designed so it does not feel like a robot reading
text. It feels like a real guided sit, mostly silence and breath, with words only when
they help. My whole bet is that the future of this is not a bigger catalog, it is "tell it
what you need and it makes one for you."

## 3. The problem and the why

The existing meditation apps are content libraries. Calm and Headspace have big catalogs
of pre-recorded sessions, and you scroll and pick one that is roughly close to how you
feel. That is fine, but it is generic, and the catalog is the moat. relaxed takes the
opposite approach: there is no catalog to scroll. You describe the moment, and the app
composes a session for that moment, in your chosen voice and length, with a soundscape
under it. The product thesis, written into the repo, is "make the moment exceptional,
remove all friction, add private continuity, then build the ecosystem," with a north star
that relaxed should feel like a luxury object, not a wellness utility.

There is also a privacy angle that shaped the product. relaxed has no accounts and no
backend database. Everything about you stays on your device. You do not sign up, and there
is nothing to log into, which removes a whole layer of friction and a whole layer of data
risk at the same time.

The deeper personal "why," the origin story and what specifically pushed me to build this
rather than something else, is not written down in the code. (needs Chris)

## 4. What it actually does

Here is the experience from first open to the calm moment it is going for.

**The welcome.** New visitors on relaxed open to a voiced welcome. The "r" mark sits in a
soft, breathing glow, and when you tap to begin, the orb actually speaks to you:
"Welcome to relaxed. What should we call you?" You can then say your name out loud or type
it, and it becomes an editable part of the greeting at the top so you can fix it if it
mishears. This voiced, conversational onboarding is the newest direction for the product.

**Setting up a session.** The home screen asks "What would you like to do?" The flagship
option is a card called **make your own** with the subline "Let us create a personalized,
guided session for whatever you need." That is the bespoke path. Below a divider there are
the common intentions: **meditate, sleep, flow, relax**. You pick an intention or you make
your own, then choose a length and a voice and a soundscape in a tray.

**The two paths.**

- The **preset path** (meditate, sleep, flow, relax) assembles a session from a set of
  written script variants, personalizes it with your name, and voices it. Because most of
  the lines are pre-voiced and cached, these sessions are nearly instant and nearly free to
  produce.
- The **make your own** path takes a short phrase you say or type, up to about seventy
  characters, and writes a fully bespoke meditation live with Claude for exactly that. This
  one has an "instant start": instead of making you wait through a long "composing" screen,
  the session begins right away with a spoken arrival and the breathing orb, while Claude
  writes the rest of it in parallel and it streams in line by line.

**The session itself.** You land on the player: a breathing orb with a soft glow behind
it that expands and contracts on a six seconds in, two and a half seconds hold, six seconds
out rhythm, the soundscape playing underneath, and a karaoke-style transcript that
highlights the current line. There are three controls, a stop square, a play/pause, and a
transcript toggle. The important design idea is that a real guided meditation is mostly
silence, so the app schedules real pauses on the audio clock with the ambient bed
continuing, rather than talking the whole time.

**Durations and voices.** Lengths run from five minutes up to sixty, plus an infinite
option that just loops the soundscape until you end it, which is good for sleep or staying
in flow. You can pick a voice (there are free voices in Her and Him, each in a US and a UK
accent, plus ten premium named voices), or choose no voice at all for a pure soundscape
session.

**After.** When a session ends there is a quiet "well done" close and an optional one-tap
mood reflection. Your recent sessions are kept on the device so you can replay the exact
one you liked.

**On other devices.** There is a native Apple Watch app (a standalone breathing pacer, a
remote for a session playing on your phone, and now the ability to start a session from
your wrist), and an Apple TV app in development for the living room.

## 5. How it works under the hood

### For a smart non-engineer

relaxed is a web app that is also wrapped as an iPhone app. When you set up a session, your
phone or browser sends a small request to the server: your name, your intention or your
typed phrase, and the length. The server does one of two things. For a preset, it stitches
together pre-written and mostly pre-voiced lines. For a "make your own," it asks Claude to
write a brand-new script, then asks ElevenLabs to speak each line. The actual mixing, the
voice over the soundscape, the silences, the breathing visual, all happens on your own
device in real time. Nothing about you is stored on a server. Your preferences and history
live only on your phone.

### For engineers

**Tech stack.**

- **Framework:** Next.js 14 (App Router), React 18, TypeScript in strict mode.
- **Hosting:** Vercel. The server side is three stateless serverless API routes; there is
  no long-running backend.
- **Client audio:** the Web Audio API, with a hand-written mixer (`lib/audio/engine.ts`).
  No audio library.
- **Media storage:** Vercel Blob holds the soundscape beds, the cached voice lines, and the
  short preview clips. They are served over the CDN; the app resolves paths through
  `NEXT_PUBLIC_BLOB_BASE_URL`.
- **iOS shell:** Capacitor 8, a WKWebView pointing at the live site, plus app-local native
  plugins. Because it loads the hosted site, web changes reach installed apps immediately;
  only genuinely native work needs an App Store build.
- **Analytics:** Vercel Web Analytics, first-party and cookieless, plus a handful of
  anonymous, shape-only custom events. No accounts, no identifiers, never the name or the
  typed phrase.
- **Styling:** hand-authored CSS with custom properties, no framework.
- **Testing:** Vitest unit tests for the pure logic, run in CI alongside the build and a
  documentation-drift check.

**AI and models.**

- **Claude (Anthropic)** writes the meditation scripts, through the official Anthropic SDK.
  The default model in the code is `claude-opus-5`, overridable by an environment variable
  (`claude-sonnet-5` is noted as a cheaper near-equal option). Claude is used only on the
  "make your own" path; presets never call it.
- **ElevenLabs** turns script lines into spoken audio, using the `eleven_multilingual_v2`
  model over REST. Voice delivery is tuned for calm (a slow speaking rate and high
  stability by default). ElevenLabs is also the voice behind the new spoken onboarding.
- **On-device speech recognition** is used for the voiced onboarding so you can say your
  name. In the iOS app this runs through the Apple `Speech` framework on the device, so the
  audio never leaves the phone. On the web it falls back to the browser's speech API.
- There are **no** image, video, or embedding models, and **no** vector store. This is not
  a retrieval product; it is a generation-and-mixing product.

**Prompt strategy, in plain language.** There is one system prompt that defines the writer:
a warm, plainspoken, secular mindfulness guide for a broad, modern audience. It has strong
guardrails baked in. It is told to keep everything concrete and physical (the breath, the
body, the chair), to avoid all new-age or metaphysical language and all religious framing,
to make no medical or therapeutic claims and never promise outcomes, and to write the
session as mostly silence, using pause tags rather than more words. For the bespoke path,
there is an additional safety instruction: if the person's words suggest they may be in
crisis or thinking about self-harm, keep the session especially gentle and grounding,
attempt no therapy, and include one soft line that reaching out to someone they trust or a
helpline is a strong and kind thing to do. The output is only the spoken words plus pause
tags, and, matching the house style, it uses no em dashes.

**Key logic: the Meditation Engine.** Every session, preset or bespoke, follows the same
five-part arc (arrive, anchor, practice, deepen, close). The app hands Claude that
structure with a per-scene objective and a rough word budget, then fits the pauses in each
scene to hit a time target, so a longer session is the same few instructions opened out
with much more silence, not more talking. There is also a per-intention audio envelope:
for sleep, for instance, the voice thins out toward the end. The principle, stated in the
code, is "the app owns timing, Claude owns language, ElevenLabs owns voice."

**Caching and cost.** Preset sessions are cache-first. A manifest of 1,912 pre-voiced
common lines lives in Blob; the server only synthesizes the personalized name line and
anything not yet cached. That makes presets fast and cheap. Only the bespoke path pays for
a full live generation each time. Paid routes are protected by a simple per-IP,
fixed-window rate limiter.

**Degraded and preview modes.** The app is built to always produce a coherent session. If
there is no Anthropic key, the custom route returns a generic fallback script. If there is
no ElevenLabs key, sessions play as guided silence over the bed with a "preview mode" note.
If a single line fails to synthesize mid-session, that line becomes silence and the pause
is preserved. If a bespoke body comes back empty, it degrades gracefully to a
sounds-only session.

**Data and privacy.** There is no database. Per-user state (preferences, the last ten
sessions, favorites, a small mood log, a few one-time flags) lives in the browser's
localStorage on the single device. The only things that ever leave the device are the
generation requests: on the bespoke path the name and the short phrase go to Claude, and
only the already-written lines of prose go to ElevenLabs (never the raw phrase). API keys
live only in server environment variables and are never shipped to the browser.

**Two brands from one codebase.** A build-time flag, `NEXT_PUBLIC_BRAND`, produces either
relaxed.app (the standalone product, a dark-only "stem r" identity) or ElevenMind at
elevenmind.io (described in the repo as the ElevenLabs demo, with a night-sky look and
explicit "voiced by ElevenLabs" attribution). The exact nature of the ElevenLabs
relationship is not spelled out in the code. (needs Chris)

## 6. Design and product decisions

- **No catalog.** The product deliberately has no browsable library. Generation is the
  differentiator, so a bigger content library is explicitly called out as not the goal.
- **No accounts, no backend.** A deliberate privacy and speed-to-market choice.
  Cross-device sync is parked as a future item precisely because it would mean adding an
  accounts backend and giving up the no-backend elegance.
- **Instant start over a "composing" screen.** Early on there was a deliberate pause screen
  that walked through "composing" steps; the bespoke path later moved to instant start,
  playing an arrival immediately while the body streams in, so you are never staring at a
  spinner.
- **Client-owned timing.** Rather than paying ElevenLabs to render long silences, the app
  schedules real pauses on the Web Audio clock. This is both a cost decision and a quality
  decision, because it lets a session breathe.
- **Loudness normalized by measurement.** Every soundscape bed and voice was measured and
  normalized so they sit at matched perceived loudness, which is unusual polish for an
  indie app and is visible all over the audio code.
- **Thin native shell.** iOS is a WKWebView over the live site, so most changes ship
  instantly over the web, and only native concerns need App Store review.
- **Two brands, one source.** ElevenMind and relaxed share a codebase and stay at feature
  parity, selected by a build flag.
- **Removed along the way (from commit history):** an "Off" soundscape option was removed
  so every session keeps a bed; a standalone "composing" wait gave way to instant start.

## 7. Timeline and status

- **Started 2026-08-13** (per the project's own overview doc; the first few weeks were
  roughly 146 commits, the large majority AI-authored under Chris's direction using Claude
  Code). Note: the current main branch was later squashed, so its earliest commit shows
  September 2026, but the true start is mid-August 2026, and the original granular history
  is preserved on an archive tag.
- **Built and shipped, in order:** the personalized generation pipeline and the audio
  engine; the 24-soundscape library and the voice roster; the bespoke "make your own" path
  with instant start; the $4.99 premium in-app purchase (version 1.3); the native Apple
  Watch app (version 1.4); in-app offer-code redemption and watch line-art polish (1.4.1);
  start-a-session-from-the-watch and a watch-face widget (1.4.2, launched October 2026); a
  web "download on the App Store" strip.
- **Currently live:** the web app at relaxed.app (continuous deploy on every push), and the
  iOS app on the App Store in 47 countries, with the premium unlock active.
- **In development:** a native Apple TV (tvOS) app for the living room (slated as version
  1.5), and the voiced, conversational onboarding (the orb greets you by voice; name by
  voice is built; answering intention, duration, voice, and soundscape by voice is the next
  phase).
- **Development model:** solo founder, Chris Williams, developing AI-assisted. Bus factor is
  one, which the docs name as the single largest organizational risk.

The repo also reads as deliberately diligence-ready: there is an unusually complete set of
internal docs (architecture, audio engine, security, data privacy, monetization, roadmap,
risks), and the roadmap frames the product partly as a portfolio artifact for product and
engineering leadership conversations. Whether the goal is acquisition, a job, a real
business, or some mix, is not stated outright. (needs Chris)

## 8. Numbers and facts

Only facts the code proves:

- **Two AI providers:** Anthropic (Claude, default `claude-opus-5`) for scripts, ElevenLabs
  (`eleven_multilingual_v2`) for voice.
- **Three server API routes:** generate, custom-script, tts. No database.
- **24 soundscapes**, in three families (Nature, Music, Frequencies), eight each. Fifteen
  are free, nine are premium.
- **Voices:** four free (Her and Him, each US and UK accent) plus ten premium named voices,
  or no voice at all for a sounds-only session.
- **1,912 pre-voiced common lines** cached for the preset path.
- **Preset content:** five intentions, each with five script variants.
- **Session lengths:** 5, 10, 15, 20, 30, 45, 60 minutes, plus infinite.
- **Breathing cadence:** six seconds in, two and a half seconds hold, six seconds out, a
  14.5-second cycle, shared everywhere including the Apple Watch.
- **Monetization:** a single $4.99 one-time in-app purchase that unlocks all premium (nine
  soundscapes, ten voices, infinite sessions), via StoreKit 2, under Apple's Small Business
  Program (15 percent). Free-access offer codes exist for friends and testers, including a
  universal code.
- **Availability:** 47 countries on the App Store.
- **Platforms:** web, iOS (iPhone and "Designed for iPad" on Mac), Apple Watch. Apple TV in
  development. No Android yet.

## 9. Glossary

- **make your own / "In your words":** the flagship bespoke path, where you say or type a
  short phrase and the app writes a fully custom meditation for it.
- **Preset / intention:** one of the four ready paths, meditate, sleep, flow, relax,
  assembled from written variants rather than generated live.
- **Instant start:** the design where a bespoke session begins immediately with a spoken
  arrival while the rest is written in parallel and streams in.
- **Arrival / body:** the arrival is the fixed opening spoken right away; the body is the
  Claude-written remainder that streams in after.
- **Soundscape / bed:** the looping ambient audio under a session (rain, ocean, a piano
  pad, a frequency tone, and so on).
- **Meditation Engine:** the internal system that gives every session the same five-part
  arc and fits the silences to the chosen length.
- **Breathing orb:** the glowing, breathing circle on the player that paces your breath.
- **Soundscape motif / line art:** the single-line drawing for each soundscape, shown in
  the player ring and on the Apple Watch.
- **Voice cache:** the library of pre-voiced common lines in Blob storage that makes presets
  fast and cheap.
- **Voiced onboarding:** the new conversational first-run where the orb greets you by voice
  and you can answer by voice.
- **Stem mark / the "r":** relaxed's lowercase "r" logo, an open single stroke.
- **ElevenMind:** the sibling brand (elevenmind.io) built from the same codebase, described
  in the repo as the ElevenLabs demo.
- **Premium unlock:** the one-time $4.99 purchase that opens all premium voices,
  soundscapes, and infinite sessions.

## 10. Likely questions and good answers

**What is relaxed?**
It is a mindfulness app that writes a new guided meditation for you in the moment instead of
giving you a library to scroll. You tell it what you need and how long you have, and it
composes and speaks a session, with Claude writing the words and ElevenLabs giving them a
voice, over an ambient soundscape.

**Is it free?**
It is free to download and use. There is a one-time $4.99 purchase that unlocks all the
premium voices and soundscapes and infinite-length sessions, but there is a real free tier
with plenty of voices and soundscapes. It is a one-time unlock, not a subscription. And
honestly, I would rather you try it and give me feedback than pay for it, so I hand out free
codes pretty freely.

**How do I use it?**
Open it, tell it your name, then either pick an intention like sleep or focus, or just say
what is on your mind, choose how long you have, and press begin. It starts almost right
away.

**What makes it different from Calm or Headspace?**
Those are content libraries, big catalogs of pre-recorded sessions you browse. relaxed has
no catalog. It makes the session for you, for the specific thing you are dealing with, in
the voice and length you want. The bet is that generation beats inventory.

**What model does it use?**
Two AI systems. Claude from Anthropic writes the script, on the Opus model by default.
ElevenLabs voices it, using their multilingual v2 model. For the new voice onboarding, the
speech recognition runs on your device using Apple's Speech framework, so your voice does
not leave the phone.

**How does the generation actually work?**
For a custom session, the app sends your phrase and name to Claude with a system prompt that
makes it write a calm, grounded, mostly-silent script with pause tags. Then each line gets
sent to ElevenLabs to be spoken, and the app schedules the audio with real silences in
between, over the soundscape, on your device. The trick is that the app owns the timing, so
it feels like a real sit and not a robot reading a paragraph.

**Why is it so fast? Doesn't generating a meditation take a while?**
Two reasons. Preset sessions reuse a big cache of pre-voiced lines, so they are nearly
instant. And the custom path uses what I call instant start: it plays a spoken arrival and
starts the breathing right away, and writes the rest in the background and streams it in, so
you are never waiting on a loading screen.

**Where is my data stored?**
On your device, full stop. There are no accounts and no database. Your preferences and your
recent sessions live in your browser or app storage and never go to a server. The only thing
that leaves your device is the request to write a session, and even then it is just your
name and your short phrase to Claude, and the finished lines to ElevenLabs.

**Is my voice recorded or sent anywhere when I speak my name?**
No. In the iPhone app the speech recognition happens on the device itself, so the audio
never leaves your phone. We only keep the text of your name, the same as if you had typed
it, and you can always type instead.

**Can I use my own words, not just the preset topics?**
Yes, that is the whole point of the make-your-own path. You give it a short phrase, something
like "I keep replaying a conversation and I cannot let it go," and it writes a session for
exactly that.

**What voices are there?**
Free voices in a Her and a Him, each in US and UK accents, and then ten premium named voices
with different personalities. Or you can pick no voice and just have the soundscape and the
breathing, which a lot of people like for sleep.

**How many soundscapes are there?**
Twenty-four, in three families: Nature, Music, and Frequencies, eight in each. Things like
rain, ocean, campfire, a warm piano, singing bowls, and frequency tones. They are all
loudness-matched so nothing is jarringly louder than anything else.

**Does it work offline?**
The soundscape-only path and cached content work with very little network, but generating a
new custom session needs a connection to reach the AI providers. There is no full offline
mode.

**Is there an Apple Watch app?**
Yes, a real native one, not a web wrapper. It is a standalone breathing pacer that logs
Mindful Minutes to Apple Health, it works as a remote for a session playing on your phone,
and you can now start a session right from your wrist and it plays on your phone.

**Is there an Android version?**
Not yet. The web app could be wrapped for Android with the same toolkit, but it has not been
built. iOS came first on purpose.

**What is the tech stack?**
Next.js and React with TypeScript, hosted on Vercel, with three small serverless API routes
and no database. The audio is a custom Web Audio mixer. iOS is a thin Capacitor shell over
the live site with a few native plugins. Media lives on Vercel Blob. It is deliberately
small and conventional.

**Who built it?**
I did, solo, developing heavily with AI, specifically Claude Code. It is a one-person
project, which is both the charm and the biggest risk.

**Why did you build it?**
The honest, personal version of that answer is not something I want OC to make up. The short
product version is that I think the meditation apps are generic content libraries, and I
wanted to see if an app that makes the session for you, in the moment, could feel more like
a luxury object than a utility. (needs Chris for the fuller story)

**Who is it for?**
People who want to actually take a calm minute without scrolling a menu to find the right
recording. Beyond that, the specific target audience is not pinned down in the project.
(needs Chris)

**What is next?**
A native Apple TV app for the living room, and the big one, the voiced conversational
onboarding, where the app talks to you and you answer out loud to set up your whole session,
not just your name. On-device speech, always optional, with typing as a fallback.

**Isn't this just ChatGPT plus a text-to-speech voice?**
The models are off-the-shelf, sure, but the product is in everything around them: the way
the app schedules real silence and breath so it feels like a sit, the instant start, the
loudness-matched soundscapes, the five-part session arc, the per-intention audio shaping,
and the no-account privacy design. A raw chatbot reading text aloud would not feel like
this.

**Isn't it risky to let an AI write meditations? What if it says something harmful?**
There are real guardrails in the system prompt. It is told to stay secular and grounded,
make no medical or therapeutic claims, and never promise outcomes. And there is a specific
crisis clause: if someone's words suggest they might be in crisis, it keeps things gentle,
attempts no therapy, and gently points toward reaching out to someone trusted. The content
is also private to you, never shared or posted.

**What are its limitations?**
It needs a connection for new custom sessions, there is no cross-device sync yet because
there are no accounts, it is iOS and web only for now, and it is a one-person project so the
pace depends on me. It is also deliberately minimal, so if you want a giant library of
celebrity sleep stories, this is not that.

**How does it make money? Is it a subscription?**
It is a one-time $4.99 unlock for all the premium content and infinite sessions, not a
subscription. Why one-time instead of a subscription is a product choice I would rather
explain myself. (needs Chris)

**Is it related to ElevenLabs?**
The voices are ElevenLabs, and there is a sibling version of the app called ElevenMind that
is framed as an ElevenLabs demo. The exact nature of that relationship is something I should
describe myself. (needs Chris)

## 11. What OC should NOT say

- Do not state user numbers, download counts, revenue, or growth figures. None of that is in
  the repo, and OC should not invent it.
- Do not present the Apple TV app or the full voiced-conversation onboarding (beyond the
  welcome and name-by-voice) as shipped. They are in development.
- Do not claim cross-device sync, accounts, or an Android app. Those do not exist.
- Do not describe the nature of any ElevenLabs partnership as fact. The repo only calls
  ElevenMind "the ElevenLabs demo"; the real relationship is for Chris to state.
- Do not promise health or clinical outcomes. relaxed is explicitly wellness, not treatment,
  and makes no medical claims.
- Do not share any API keys, voice IDs, internal URLs, environment variable values, or user
  data. None of those belong in conversation.
- Do not invent the origin story, the business goal, the target user, or the pricing
  rationale. Those are marked as questions for Chris.
- Do not overstate the AI. Claude and ElevenLabs are off-the-shelf; the product is the
  experience built around them.

## 12. Questions for Chris

1. What is the real origin story? What specifically made you start relaxed on August 13,
   2026, rather than something else?
2. What is the actual goal for this project: a real growing business, an acquisition, a
   portfolio piece for product and engineering leadership conversations, a job, or some
   combination? The roadmap hints at the portfolio framing; which is it, really?
3. Who is the specific target user, in your words? Who is the person you picture opening
   this?
4. Any numbers you are comfortable with OC sharing: downloads, active users, sessions
   generated, revenue, conversion to the paid unlock?
5. What is the real relationship with ElevenLabs? Is ElevenMind an official demo, a
   partnership, a submission, or just a differently-branded build you made? What can OC say
   about it?
6. Why a one-time $4.99 unlock instead of a subscription? What is the pricing philosophy?
7. How do people find relaxed today? Is it being actively marketed, and if so, how
   (LinkedIn, App Store, word of mouth)?
8. Where did the name "relaxed.app" come from, and is there a story to the lowercase "r"
   stem identity?
9. What would you do differently if you started over, and what are you proudest of?
10. What is the honest current traction and status you want OC to convey: "live and in use,"
    "live but early," "a polished prototype," something else?
11. How far do you want to take the voiced conversation vision, and is that the headline of
    where relaxed is going next?
12. Is acquisition genuinely on the table, and if someone asks OC "is this for sale," what
    should it say?
