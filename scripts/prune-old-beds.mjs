// Report Vercel Blob usage and (optionally) delete the orphaned previous-gen MP3
// soundscape beds left behind by the FLAC migration.
//
// Why they exist: upload-blob.mjs only ever ADDS or overwrites a blob by key; it
// never deletes. The new beds are `sounds/<Name>.flac`; the old ones were
// `sounds/<Name>.mp3` (different keys), so uploading the FLACs did not replace
// them. The 15 old MP3 beds still sit in Blob, unreferenced, using storage.
//
// Read-only by default: prints a usage breakdown and lists what it WOULD delete.
// Pass --delete to actually remove the orphaned beds (nothing else is touched).
//
//   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx node scripts/prune-old-beds.mjs
//   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx node scripts/prune-old-beds.mjs --delete

import { list, del } from "@vercel/blob";

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN is not set (Vercel > Storage > relaxedapp-blob > .env.local).");
  process.exit(1);
}
const DELETE = process.argv.includes("--delete");

// The 15 previous-generation soundscape beds (pre-FLAC), by their exact Blob
// keys. This is an allowlist: the script only ever removes these, never the
// voice cache, voice previews, sound previews, or the new FLAC beds.
const OLD_BEDS = [
  "Rain.mp3", "Ocean.mp3", "Wind.mp3", "Thunderstorm.mp3", "WindChimes.mp3",
  "Ambient.mp3", "Piano.mp3", "LoFi.mp3", "Singing-Bowl.mp3", "Harp.mp3",
  "BrownNoise.mp3", "432Hz.mp3", "Binaural.mp3", "Delta.mp3", "Theta.mp3",
].map((f) => `sounds/${f}`);

const mb = (b) => (b / 1048576).toFixed(1) + " MB";

// Gather every blob (paginated).
let cursor;
const all = [];
do {
  const page = await list({ token: TOKEN, cursor, limit: 1000 });
  all.push(...page.blobs);
  cursor = page.cursor;
} while (cursor);

// Usage breakdown by top-level prefix.
const byPrefix = {};
let total = 0;
for (const b of all) {
  const p = b.pathname.split("/")[0] || "(root)";
  (byPrefix[p] ||= { n: 0, size: 0 });
  byPrefix[p].n++;
  byPrefix[p].size += b.size || 0;
  total += b.size || 0;
}
console.log(`\nVercel Blob: ${all.length} files, ${mb(total)} used of 1024 MB (free tier)\n`);
for (const [p, v] of Object.entries(byPrefix).sort((a, b) => b[1].size - a[1].size)) {
  console.log(`  ${p.padEnd(16)} ${String(v.n).padStart(5)} files   ${mb(v.size)}`);
}

// Orphaned old beds still present?
const present = all.filter((b) => OLD_BEDS.includes(b.pathname));
const orphanSize = present.reduce((a, b) => a + (b.size || 0), 0);
console.log(`\nOrphaned old MP3 beds: ${present.length}/15 present   ${mb(orphanSize)}`);
for (const b of present) console.log(`  - ${b.pathname}   ${mb(b.size)}`);

if (!present.length) {
  console.log("\nNothing to prune. (Old beds already gone.)");
} else if (!DELETE) {
  console.log(`\nDry run. Re-run with --delete to remove these ${present.length} files and reclaim ${mb(orphanSize)}.`);
} else {
  for (const b of present) {
    await del(b.url, { token: TOKEN });
    console.log(`deleted ${b.pathname}`);
  }
  console.log(`\nRemoved ${present.length} orphaned beds, reclaimed ${mb(orphanSize)}.`);
}
