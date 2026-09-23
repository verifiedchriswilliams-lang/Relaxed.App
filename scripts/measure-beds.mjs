// Measure the perceived loudness (LUFS, K-weighted per ITU-R BS.1770) and true
// peak of every soundscape bed, and print a recommended per-bed `trim` (dB) for
// the SOUNDSCAPES table in app/page.tsx so they all sound equally loud — the
// bed-level equivalent of the voice `trim`. Equal RMS is not equal loudness:
// a bright/hissy bed (ocean) reads louder than a dull/low bed (brown, delta).
//
// Requirements: a real ffmpeg with the `ebur128` filter (the macOS/Homebrew or
// apt build — NOT the stripped Playwright one). Check with `ffmpeg -filters | grep ebur128`.
//
// Usage (files are on Vercel Blob):
//   NEXT_PUBLIC_BLOB_BASE_URL="https://xxxx.public.blob.vercel-storage.com" \
//     node scripts/measure-beds.mjs
// Or point at a local folder of the mp3s:
//   node scripts/measure-beds.mjs --dir /path/to/sounds
//
// Then paste the printed table back and the trims get set in app/page.tsx.

import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// The 24 FLAC beds (id → filename; must match the `src` basenames in
// lib/audio/soundscapes.ts). `rms`/`peak`/`trim` are all now MEASURED from the
// files themselves (volumedetect + ebur128), so the `rms` field below is only a
// vestigial label — the script no longer trusts it. Run against the final FLACs
// and paste the printed rms/peak/trim table back into the catalog.
const BEDS = [
  { id: "rain", file: "Rain.flac", rms: -42.5 },
  { id: "ocean", file: "Ocean.flac", rms: -25.1 },
  { id: "birdsong", file: "Birdsong.flac", rms: -24 },
  { id: "wind", file: "Wind.flac", rms: -43.4 },
  { id: "thunder", file: "Thunderstorm.flac", rms: -37.9 },
  { id: "windchimes", file: "Windchimes.flac", rms: -32.4 },
  { id: "brook", file: "BabblingBrook.flac", rms: -24 },
  { id: "campfire", file: "Campfire.flac", rms: -24 },
  { id: "pad", file: "Ambient.flac", rms: -21.7 },
  { id: "piano", file: "Piano.flac", rms: -36.2 },
  { id: "lofi", file: "LoFi.flac", rms: -16.1 },
  { id: "bowls", file: "SingingBowls.flac", rms: -14.6 },
  { id: "harp", file: "Harp.flac", rms: -17.4 },
  { id: "strings", file: "WarmStrings.flac", rms: -20 },
  { id: "kalimba", file: "Kalimba.flac", rms: -20 },
  { id: "flute", file: "Flute.flac", rms: -20 },
  { id: "brown", file: "BrownNoise.flac", rms: -37.0 },
  { id: "pad432", file: "432Hz.flac", rms: -16.8 },
  { id: "whitenoise", file: "WhiteNoise.flac", rms: -24 },
  { id: "binaural", file: "Binaural.flac", rms: -15.9 },
  { id: "delta", file: "Delta.flac", rms: -12.7 },
  { id: "theta", file: "Theta.flac", rms: -17.2 },
  { id: "green", file: "GreenNoise.flac", rms: -24 },
  { id: "alpha", file: "Alpha.flac", rms: -20 },
];

const dirArg = process.argv.indexOf("--dir");
const localDir = dirArg > -1 ? process.argv[dirArg + 1] : null;
const base = (process.env.NEXT_PUBLIC_BLOB_BASE_URL || "").replace(/\/+$/, "");
if (!localDir && !base) {
  console.error("Set NEXT_PUBLIC_BLOB_BASE_URL or pass --dir <folder>. See header.");
  process.exit(1);
}

// Run ffmpeg twice per file and parse: (1) ebur128 → integrated loudness (I,
// LUFS) + true peak; (2) volumedetect → mean_volume (integrated RMS, dBFS) which
// the catalog stores as `rms` and the engine normalizes from. ffmpeg logs both
// summaries to stderr and exits 0, so read stderr from resolved + error, with a
// big buffer for the per-frame logs.
async function ff(path, filter) {
  try {
    const r = await run(
      "ffmpeg",
      ["-hide_banner", "-nostats", "-i", path, "-af", filter, "-f", "null", "-"],
      { maxBuffer: 1024 * 1024 * 128 }
    );
    return (r.stderr || "") + (r.stdout || "");
  } catch (e) {
    return (e.stderr || "") + (e.stdout || "");
  }
}
async function measure(path) {
  const eb = await ff(path, "ebur128=peak=true");
  const vd = await ff(path, "volumedetect");
  const lufs = eb.match(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/g)?.pop();
  const tpeak = eb.match(/Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS/g)?.pop();
  const mean = vd.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/)?.[1];
  const maxv = vd.match(/max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/)?.[1];
  return {
    lufs: lufs ? parseFloat(lufs.match(/(-?\d+(?:\.\d+)?)/)[1]) : NaN,
    // Prefer ebur128 true peak; fall back to volumedetect sample peak.
    peak: tpeak ? parseFloat(tpeak.match(/(-?\d+(?:\.\d+)?)/)[1]) : (maxv ? parseFloat(maxv) : NaN),
    rms: mean ? parseFloat(mean) : NaN,
  };
}

// The four tray-audition clips (played by previewVoice), which are separate
// recordings from the session voice and are NOT normalized in the app — so
// they need their own measured, level-matched gains.
const VOICES = [
  { id: "female-us", file: "female-us.mp3" },
  { id: "female-uk", file: "female-uk.mp3" },
  { id: "male-us", file: "male-us.mp3" },
  { id: "male-uk", file: "male-uk.mp3" },
];

const tmp = localDir ? null : await mkdtemp(join(tmpdir(), "beds-"));

// Resolve a file to a local path: a folder passed with --dir, else download it
// from the Blob base under the given subdir.
async function pathFor(subdir, file, id) {
  if (localDir) return join(localDir, file);
  const url = `${base}/${subdir}/${file}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`skip ${id}: ${res.status} ${url}`);
    return null;
  }
  const p = join(tmp, file);
  await writeFile(p, Buffer.from(await res.arrayBuffer()));
  return p;
}

const rows = [];
for (const b of BEDS) {
  const path = await pathFor("sounds", b.file, b.id);
  if (!path) continue;
  const m = await measure(path);
  // Perceptual excess is measured LUFS vs the file's own measured RMS (not the
  // stale hardcoded value), so it's correct for freshly transcoded beds.
  rows.push({ ...b, ...m, excess: m.lufs - m.rms });
}

// Voice previews: level them to a comfortable common LUFS, capped so peaks stay
// under -1 dBFS. Output a linear gain to plug into previewVoice.
const PREVIEW_TARGET_LUFS = -18;
const voiceRows = [];
for (const v of VOICES) {
  const path = await pathFor("voice-previews", v.file, v.id);
  if (!path) continue;
  const m = await measure(path);
  const db = Number.isFinite(m.lufs)
    ? Math.min(PREVIEW_TARGET_LUFS - m.lufs, -1 - m.peak)
    : NaN;
  const gain = Number.isFinite(db) ? Math.round(Math.pow(10, db / 20) * 100) / 100 : NaN;
  voiceRows.push({ ...v, ...m, gain });
}

if (tmp) await rm(tmp, { recursive: true, force: true });

// Perceptual excess = how much louder a bed reads (LUFS) than its raw RMS. The
// median bed is the reference; trim each other bed by the difference so, once
// RMS-normalized, they all land at equal *perceived* loudness.
const valid = rows.filter((r) => Number.isFinite(r.excess));
const med = valid.map((r) => r.excess).sort((a, b) => a - b)[Math.floor(valid.length / 2)] ?? 0;

console.log("\nid            rms    peak    LUFS    trim   (paste all of this back)");
for (const r of rows) {
  const trim = Number.isFinite(r.excess) ? Math.round((med - r.excess) * 2) / 2 : NaN;
  console.log(
    r.id.padEnd(12),
    String(r.rms).padStart(6),
    String(r.peak).padStart(7),
    String(r.lufs).padStart(7),
    "  ",
    Number.isFinite(trim) ? (trim === 0 ? "0" : String(trim)) : "measure FAILED"
  );
}
console.log("\nReference (median) perceived excess:", med.toFixed(1), "dB — trims are relative to it.\n");

console.log("VOICE PREVIEWS (level-matched audition gains)");
console.log("id           LUFS     truePeak   preview gain (linear)");
for (const r of voiceRows) {
  console.log(
    r.id.padEnd(12),
    String(r.lufs).padStart(6),
    String(r.peak).padStart(8),
    "   ",
    Number.isFinite(r.gain) ? r.gain : "measure FAILED"
  );
}
console.log("");
