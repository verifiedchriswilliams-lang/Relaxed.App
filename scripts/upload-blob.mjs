// Sync local public media (soundscape beds + the voice cache) to Vercel Blob.
//
// The large MP3s no longer live in git — they're hosted on a Vercel Blob store
// and the app resolves them through NEXT_PUBLIC_BLOB_BASE_URL (see lib/assets.ts).
// This script uploads whatever is on disk under the given directories, keeping
// each file's path relative to public/ as its Blob key. So:
//
//   public/sounds/Rain.mp3        ->  <base>/sounds/Rain.mp3
//   public/voice-cache/abc.mp3    ->  <base>/voice-cache/abc.mp3
//
// It needs a Blob read-write token in the environment:
//   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx node scripts/upload-blob.mjs
//
// Optional args pick which directories to sync (default: both):
//   node scripts/upload-blob.mjs public/sounds
//   node scripts/upload-blob.mjs public/sounds public/voice-cache
//
// Existing blobs are skipped by default so re-runs only upload new files; pass
// --force to re-upload everything. Uploads are idempotent (addRandomSuffix off,
// so the key is stable). It runs from anywhere that can reach Vercel Blob — the
// GitHub Action (.github/workflows/sync-blob.yml) or your own machine.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { put, list } from "@vercel/blob";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!TOKEN) {
  console.error(
    "BLOB_READ_WRITE_TOKEN is not set.\n" +
      "Get it from Vercel → Storage → your Blob store → .env.local tab, then:\n" +
      "  BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx node scripts/upload-blob.mjs"
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const dirArgs = args.filter((a) => a !== "--force");
const dirs = (dirArgs.length ? dirArgs : ["public/sounds", "public/voice-cache"]).map(
  (d) => path.resolve(ROOT, d)
);

// Only these extensions are media worth hosting; skip READMEs etc.
const MEDIA = new Set([".mp3", ".wav", ".ogg", ".m4a"]);

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (MEDIA.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

// Blob key = path relative to public/, forward-slashed, no leading slash.
const keyFor = (file) => path.relative(PUBLIC, file).split(path.sep).join("/");

const files = dirs.flatMap(walk);
if (!files.length) {
  console.error("No media files found under:", dirs.join(", "));
  process.exit(1);
}

// Fetch existing blob keys once so we can skip unchanged files cheaply.
const existing = new Set();
if (!force) {
  let cursor;
  do {
    const page = await list({ token: TOKEN, cursor, limit: 1000 });
    for (const b of page.blobs) existing.add(b.pathname);
    cursor = page.cursor;
  } while (cursor);
}

console.log(
  `Syncing ${files.length} file(s) to Vercel Blob` +
    (force ? " (force: re-uploading all)" : ` (${existing.size} already present)`)
);

let uploaded = 0;
let skipped = 0;
let failed = 0;
let base = "";

// Bounded concurrency so we don't open hundreds of sockets at once.
async function run(items, limit, fn) {
  let i = 0;
  async function worker() {
    for (;;) {
      const idx = i++;
      if (idx >= items.length) return;
      await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

await run(files, 8, async (file) => {
  const key = keyFor(file);
  if (!force && existing.has(key)) {
    skipped++;
    return;
  }
  try {
    const res = await put(key, fs.readFileSync(file), {
      access: "public",
      token: TOKEN,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "audio/mpeg",
    });
    if (!base) base = new URL(res.url).origin;
    uploaded++;
    process.stdout.write(`\r  uploaded ${uploaded}, skipped ${skipped}   `);
  } catch (e) {
    failed++;
    console.error(`\n  FAILED ${key}: ${e.message}`);
  }
});
process.stdout.write("\n");

// Recover the base even when everything was skipped, so the reminder still shows.
if (!base && existing.size) {
  const anyBlob = (await list({ token: TOKEN, limit: 1 })).blobs[0];
  if (anyBlob) base = new URL(anyBlob.url).origin;
}

console.log(`\nDone. uploaded ${uploaded}, skipped ${skipped}, failed ${failed}.`);
if (base) {
  console.log(`\nBlob base URL: ${base}`);
  console.log(
    "Set this in Vercel (Project → Settings → Environment Variables) as:\n" +
      `  NEXT_PUBLIC_BLOB_BASE_URL=${base}\n` +
      "then redeploy. Media will be served from Blob."
  );
}
if (failed) process.exit(1);
