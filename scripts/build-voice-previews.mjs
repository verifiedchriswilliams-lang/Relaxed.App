// Generate a short audition clip for each voice slot, so the tray can play a
// taste of "Her/Him" in the chosen accent the moment the user taps it.
//
// One clip per slot -> public/voice-previews/<slot>.mp3
//   female-us.mp3  male-us.mp3  female-uk.mp3  male-uk.mp3
// The app plays /voice-previews/<voice>-<accent>.mp3 (resolved through
// NEXT_PUBLIC_BLOB_BASE_URL like the rest of the media).
//
// Run locally with your ElevenLabs key (it can't run in CI/sandbox):
//   node scripts/build-voice-previews.mjs                 # all four
//   node scripts/build-voice-previews.mjs female-uk male-uk
// With BLOB_READ_WRITE_TOKEN set, clips upload straight to Vercel Blob;
// otherwise they're written to public/voice-previews for you to commit.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// --- minimal .env.local loader ---------------------------------------------
for (const f of [".env.local", ".env"]) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const clean = (v) => (v ? v.replace(/[^\x21-\x7E]/g, "") : v);
const API_KEY = clean(process.env.ELEVENLABS_API_KEY);
if (!API_KEY) {
  console.error("ELEVENLABS_API_KEY is not set (add it to .env.local).");
  process.exit(1);
}

const FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";
const SPEED = Number(process.env.ELEVENLABS_SPEED ?? 1.0) || 1.0;
const STABILITY = Number(process.env.ELEVENLABS_STABILITY ?? 0.85) || 0.85;

// Same voice IDs as the route / cache builder.
const VOICES = {
  "female-us": clean(process.env.ELEVENLABS_VOICE_FEMALE_US) || "7AvtJrjTNyBhBxEvNPIZ",
  "male-us": clean(process.env.ELEVENLABS_VOICE_MALE_US) || "6bPfTtSpgxgD0GeBVfqu",
  "female-uk":
    clean(process.env.ELEVENLABS_VOICE_FEMALE_UK) ||
    clean(process.env.ELEVENLABS_VOICE_FEMALE) ||
    "bgU7lBMo69PNEOWHFqxM",
  "male-uk":
    clean(process.env.ELEVENLABS_VOICE_MALE_UK) ||
    clean(process.env.ELEVENLABS_VOICE_MALE) ||
    "UmQN7jS1Ee8B1czsUtQh",
};

// Each voice introduces *itself* — a distinct line with its own warmth and
// personality, so choosing a voice feels like choosing a guide, not a setting.
// Override a single slot with VOICE_PREVIEW_TEXT_<SLOT> (e.g.
// VOICE_PREVIEW_TEXT_FEMALE_UK), or all of them with VOICE_PREVIEW_TEXT.
const PREVIEW_TEXTS = {
  "female-us":
    "Hey — I'm really glad you're here. Let's take a breath together, and let everything else fall away.",
  "male-us":
    "Take your time settling in. I'm right here with you — we'll go slow, and we'll go easy.",
  "female-uk":
    "Whenever you're ready, come and sit with me. We'll let the day grow quiet, and simply breathe.",
  "male-uk":
    "There's nothing to do now but rest. Stay with me, and let each breath carry you a little deeper.",
};
const previewText = (slot) =>
  process.env[`VOICE_PREVIEW_TEXT_${slot.toUpperCase().replace(/-/g, "_")}`] ||
  process.env.VOICE_PREVIEW_TEXT ||
  PREVIEW_TEXTS[slot] ||
  "Hi. Whenever you're ready, we'll begin — together.";

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
let blobPut = null;
if (BLOB_TOKEN) {
  ({ put: blobPut } = await import("@vercel/blob"));
}

const wanted = process.argv.slice(2);
const slots = wanted.length ? wanted.filter((k) => VOICES[k]) : Object.keys(VOICES);
if (!slots.length) {
  console.error("No valid slots. Choose from:", Object.keys(VOICES).join(", "));
  process.exit(1);
}

const OUT_DIR = path.join(ROOT, "public", "voice-previews");
fs.mkdirSync(OUT_DIR, { recursive: true });

async function synth(voiceId, text) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${FORMAT}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: STABILITY,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
          speed: SPEED,
        },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

let made = 0;
let failed = 0;
for (const slot of slots) {
  const voiceId = VOICES[slot];
  try {
    const buf = await synth(voiceId, previewText(slot));
    fs.writeFileSync(path.join(OUT_DIR, `${slot}.mp3`), buf);
    if (blobPut) {
      await blobPut(`voice-previews/${slot}.mp3`, buf, {
        access: "public",
        token: BLOB_TOKEN,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "audio/mpeg",
      });
    }
    made++;
    console.log(`  ${slot} (${voiceId}) ok`);
  } catch (e) {
    failed++;
    console.error(`  ${slot} FAILED: ${e.message}`);
  }
}

console.log(
  `\nDone. made ${made}, failed ${failed}.` +
    (blobPut
      ? " Uploaded to Blob."
      : " Commit public/voice-previews/*.mp3 and push.")
);
if (failed) process.exit(1);
