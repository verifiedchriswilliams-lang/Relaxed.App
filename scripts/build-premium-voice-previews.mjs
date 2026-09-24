// Generate a short audition clip for each PREMIUM voice, so the tray can play a
// taste the moment the user taps one in "more voices".
//
// One clip per voice -> public/voice-previews/<id>.mp3  (willow.mp3, kai.mp3, ...)
// The app plays /voice-previews/<id>.mp3 (resolved through NEXT_PUBLIC_BLOB_BASE_URL
// like the rest of the media). Voice list is read straight from
// lib/premiumVoices.ts so names + IDs never drift from the app.
//
// Run locally with your ElevenLabs key (can't run in CI/sandbox):
//   node scripts/build-premium-voice-previews.mjs               # all 10
//   node scripts/build-premium-voice-previews.mjs willow kai    # just these
// With BLOB_READ_WRITE_TOKEN set, clips upload straight to Vercel Blob; otherwise
// they land in public/voice-previews/ (which is Blob-hosted, so upload after).

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
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
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

// Parse the premium roster out of lib/premiumVoices.ts (single source of truth).
const src = fs.readFileSync(path.join(ROOT, "lib", "premiumVoices.ts"), "utf8");
const RE = /id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*gender:\s*"[^"]+",\s*accent:\s*"[^"]+",\s*voiceId:\s*"([^"]+)"/g;
const ROSTER = [];
for (let m; (m = RE.exec(src)); ) ROSTER.push({ id: m[1], name: m[2], voiceId: m[3] });
if (ROSTER.length !== 10) {
  console.error(`Expected 10 premium voices, parsed ${ROSTER.length}. Check lib/premiumVoices.ts.`);
  process.exit(1);
}

// Each voice introduces itself by name (matches the tray label), so auditioning
// feels like meeting a guide. Override all with VOICE_PREVIEW_TEXT.
const previewText = (name) =>
  process.env.VOICE_PREVIEW_TEXT?.replace(/\{name\}/g, name) ||
  `I'm ${name}. Whenever you're ready, we'll begin.`;

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
let blobPut = null;
if (BLOB_TOKEN) ({ put: blobPut } = await import("@vercel/blob"));

const wanted = process.argv.slice(2);
const list = wanted.length ? ROSTER.filter((v) => wanted.includes(v.id)) : ROSTER;
if (!list.length) {
  console.error("No matching voices. Choose from:", ROSTER.map((v) => v.id).join(", "));
  process.exit(1);
}

const OUT_DIR = path.join(ROOT, "public", "voice-previews");
fs.mkdirSync(OUT_DIR, { recursive: true });

async function synth(voiceId, text) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${FORMAT}`,
    {
      method: "POST",
      headers: { "xi-api-key": API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: STABILITY, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true, speed: SPEED },
      }),
    }
  );
  if (!res.ok) throw new Error(`${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

let made = 0, failed = 0;
for (const v of list) {
  try {
    const buf = await synth(v.voiceId, previewText(v.name));
    fs.writeFileSync(path.join(OUT_DIR, `${v.id}.mp3`), buf);
    if (blobPut) {
      await blobPut(`voice-previews/${v.id}.mp3`, buf, {
        access: "public", token: BLOB_TOKEN, addRandomSuffix: false, allowOverwrite: true, contentType: "audio/mpeg",
      });
    }
    made++;
    console.log(`  ${v.id} — ${v.name} (${v.voiceId}) ok`);
  } catch (e) {
    failed++;
    console.error(`  ${v.id} FAILED: ${e.message}`);
  }
}

console.log(
  `\nDone. made ${made}, failed ${failed}.` +
    (blobPut ? " Uploaded to Blob." : " Now upload: node scripts/upload-blob.mjs public/voice-previews")
);
if (failed) process.exit(1);
