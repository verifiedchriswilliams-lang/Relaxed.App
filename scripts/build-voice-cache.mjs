// Pre-voice the common (non-name) lines of every session template, once per
// voice, into public/voice-cache/ and write lib/voiceCacheManifest.json.
//
// Run locally with your ElevenLabs key (it can't run in CI/sandbox):
//   node scripts/build-voice-cache.mjs                # all four voices
//   node scripts/build-voice-cache.mjs female-us male-us   # just some
//
// Then commit the new files in public/voice-cache/ and lib/voiceCacheManifest.json
// and push. Re-run whenever you change a script line or add a voice; existing
// files are skipped, so it only does the new work.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// --- minimal .env.local loader (so you don't need dotenv) -------------------
function loadEnv() {
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
}
loadEnv();

const clean = (v) => (v ? v.replace(/[^\x21-\x7E]/g, "") : v);
const API_KEY = clean(process.env.ELEVENLABS_API_KEY);
if (!API_KEY) {
  console.error("ELEVENLABS_API_KEY is not set (add it to .env.local).");
  process.exit(1);
}

// Must match lib/voiceCache.ts / the route.
const CACHE_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";
const SPEED = Number(process.env.ELEVENLABS_SPEED ?? 1.0) || 1.0;
const STABILITY = Number(process.env.ELEVENLABS_STABILITY ?? 0.85) || 0.85;

// Voice IDs per gender+accent, env-overridable, matching the route's defaults.
const VOICES = {
  "female-us": clean(process.env.ELEVENLABS_VOICE_FEMALE_US) || "7AvtJrjTNyBhBxEvNPIZ",
  "male-us": clean(process.env.ELEVENLABS_VOICE_MALE_US) || "6bPfTtSpgxgD0GeBVfqu",
  "female-uk":
    clean(process.env.ELEVENLABS_VOICE_FEMALE_UK) ||
    clean(process.env.ELEVENLABS_VOICE_FEMALE) ||
    "zA6D7RyKdc2EClouEMkP",
  "male-uk":
    clean(process.env.ELEVENLABS_VOICE_MALE_UK) ||
    clean(process.env.ELEVENLABS_VOICE_MALE) ||
    "UmQN7jS1Ee8B1czsUtQh",
};

const wanted = process.argv.slice(2);
const voiceKeys = wanted.length
  ? wanted.filter((k) => VOICES[k])
  : Object.keys(VOICES);
if (!voiceKeys.length) {
  console.error("No valid voices. Choose from:", Object.keys(VOICES).join(", "));
  process.exit(1);
}

// --- gather the unique common lines from the templates ----------------------
const scripts = JSON.parse(
  fs.readFileSync(path.join(ROOT, "lib", "sessionScripts.json"), "utf8")
);
const commonLines = new Set();
for (const variants of Object.values(scripts)) {
  for (const variant of variants) {
    for (const line of variant) {
      if (!line.name) commonLines.add(line.text);
    }
  }
}
const lines = [...commonLines];

const cacheKey = (voiceId, text) =>
  crypto.createHash("sha1").update(`${voiceId}\n${text}`).digest("hex").slice(0, 20);

const OUT_DIR = path.join(ROOT, "public", "voice-cache");
fs.mkdirSync(OUT_DIR, { recursive: true });

const MANIFEST = path.join(ROOT, "lib", "voiceCacheManifest.json");
const existing = fs.existsSync(MANIFEST)
  ? new Set(JSON.parse(fs.readFileSync(MANIFEST, "utf8")).keys ?? [])
  : new Set();

async function synth(voiceId, text) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${CACHE_FORMAT}`,
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

// simple bounded-concurrency runner
async function run(tasks, limit, fn) {
  let i = 0;
  let done = 0;
  const total = tasks.length;
  async function worker() {
    for (;;) {
      const idx = i++;
      if (idx >= tasks.length) return;
      await fn(tasks[idx]);
      done++;
      process.stdout.write(`\r  ${done}/${total}   `);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, total) }, worker));
  process.stdout.write("\n");
}

const keys = new Set(existing);
let made = 0;
let skipped = 0;
let failed = 0;

for (const vk of voiceKeys) {
  const voiceId = VOICES[vk];
  console.log(`\nVoice ${vk} (${voiceId}) — ${lines.length} lines`);
  const jobs = lines.map((text) => ({ text, key: cacheKey(voiceId, text) }));
  await run(jobs, 3, async ({ text, key }) => {
    const file = path.join(OUT_DIR, `${key}.mp3`);
    if (fs.existsSync(file)) {
      keys.add(key);
      skipped++;
      return;
    }
    try {
      const buf = await synth(voiceId, text);
      fs.writeFileSync(file, buf);
      keys.add(key);
      made++;
    } catch (e) {
      failed++;
      console.error(`\n  FAILED "${text.slice(0, 40)}...": ${e.message}`);
    }
  });
}

fs.writeFileSync(
  MANIFEST,
  JSON.stringify({ keys: [...keys].sort() }, null, 0) + "\n"
);

console.log(
  `\nDone. made ${made}, skipped ${skipped}, failed ${failed}. Manifest has ${keys.size} keys.`
);
console.log(
  "Commit public/voice-cache/*.mp3 and lib/voiceCacheManifest.json, then push."
);
if (failed) process.exit(1);
