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

// id → filename (must match the `src` values in SOUNDSCAPES) and the RMS already
// measured in the app, so we can turn LUFS into a trim on top of RMS matching.
const BEDS = [
  { id: "rain", file: "Rain.mp3", rms: -42.5 },
  { id: "ocean", file: "Ocean.mp3", rms: -25.1 },
  { id: "wind", file: "Wind.mp3", rms: -43.4 },
  { id: "thunder", file: "Thunderstorm.mp3", rms: -37.9 },
  { id: "windchimes", file: "WindChimes.mp3", rms: -32.4 },
  { id: "pad", file: "Ambient.mp3", rms: -21.7 },
  { id: "piano", file: "Piano.mp3", rms: -36.2 },
  { id: "lofi", file: "LoFi.mp3", rms: -16.1 },
  { id: "bowls", file: "Singing-Bowl.mp3", rms: -14.6 },
  { id: "harp", file: "Harp.mp3", rms: -17.4 },
  { id: "brown", file: "BrownNoise.mp3", rms: -37.0 },
  { id: "pad432", file: "432Hz.mp3", rms: -16.8 },
  { id: "binaural", file: "Binaural.mp3", rms: -15.9 },
  { id: "delta", file: "Delta.mp3", rms: -12.7 },
  { id: "theta", file: "Theta.mp3", rms: -17.2 },
];

const dirArg = process.argv.indexOf("--dir");
const localDir = dirArg > -1 ? process.argv[dirArg + 1] : null;
const base = (process.env.NEXT_PUBLIC_BLOB_BASE_URL || "").replace(/\/+$/, "");
if (!localDir && !base) {
  console.error("Set NEXT_PUBLIC_BLOB_BASE_URL or pass --dir <folder>. See header.");
  process.exit(1);
}

// Run ffmpeg's ebur128 and parse integrated loudness (I) + true peak. ffmpeg
// logs the summary to stderr and exits 0 on success, so read stderr from BOTH
// the resolved result and any error, with a big buffer for the per-frame logs.
async function measure(path) {
  let out = "";
  try {
    const r = await run(
      "ffmpeg",
      ["-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
      { maxBuffer: 1024 * 1024 * 128 }
    );
    out = (r.stderr || "") + (r.stdout || "");
  } catch (e) {
    out = (e.stderr || "") + (e.stdout || "");
  }
  const lufs = out.match(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/g)?.pop();
  const peak = out.match(/Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS/g)?.pop();
  return {
    lufs: lufs ? parseFloat(lufs.match(/(-?\d+(?:\.\d+)?)/)[1]) : NaN,
    peak: peak ? parseFloat(peak.match(/(-?\d+(?:\.\d+)?)/)[1]) : NaN,
  };
}

const tmp = localDir ? null : await mkdtemp(join(tmpdir(), "beds-"));
const rows = [];
for (const b of BEDS) {
  let path;
  if (localDir) {
    path = join(localDir, b.file);
  } else {
    const res = await fetch(`${base}/sounds/${b.file}`);
    if (!res.ok) {
      console.error(`skip ${b.id}: ${res.status} ${base}/sounds/${b.file}`);
      continue;
    }
    path = join(tmp, b.file);
    await writeFile(path, Buffer.from(await res.arrayBuffer()));
  }
  const m = await measure(path);
  rows.push({ ...b, ...m, excess: m.lufs - b.rms });
}
if (tmp) await rm(tmp, { recursive: true, force: true });

// Perceptual excess = how much louder a bed reads (LUFS) than its raw RMS. The
// median bed is the reference; trim each other bed by the difference so, once
// RMS-normalized, they all land at equal *perceived* loudness.
const valid = rows.filter((r) => Number.isFinite(r.excess));
const med = valid.map((r) => r.excess).sort((a, b) => a - b)[Math.floor(valid.length / 2)] ?? 0;

console.log("\nid           LUFS     truePeak   trim (paste into SOUNDSCAPES)");
for (const r of rows) {
  const trim = Number.isFinite(r.excess) ? Math.round((med - r.excess) * 2) / 2 : NaN;
  console.log(
    r.id.padEnd(12),
    String(r.lufs).padStart(6),
    String(r.peak).padStart(8),
    "   ",
    Number.isFinite(trim) ? (trim === 0 ? "0" : `trim: ${trim}`) : "measure FAILED"
  );
}
console.log("\nReference (median) perceived excess:", med.toFixed(1), "dB — trims are relative to it.\n");
