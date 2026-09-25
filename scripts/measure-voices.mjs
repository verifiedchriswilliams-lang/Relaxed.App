// Measure the perceived loudness (LUFS, K-weighted per ITU-R BS.1770), integrated
// RMS (volumedetect mean_volume) and true peak of every guide voice — the four
// free voices (gender x accent) AND the ten premium voices — on ONE common basis,
// then print the `VOICE_STATS` / `PREMIUM_VOICE_STATS` rows for lib/audio/levels.ts
// so all fourteen land at equal *perceived* loudness in a session.
//
// Why re-measure: equal RMS is not equal loudness (a dense/whispery voice reads
// differently from a bright/forward one), and the premium voices were never
// measured at all, so they play at raw gain 1 today — some whisper, some blast.
// This levels them against each other and against the free voices in one pass.
//
// Two independent passes:
//   1. SESSION voices (needs ELEVENLABS_API_KEY): synthesizes a fixed set of
//      representative session lines for each voice at the EXACT session settings
//      (lib/tts.ts synthesizeBytes: eleven_multilingual_v2, stability/speed from
//      env, similarity 0.75, style 0, speaker_boost), concatenates them, and
//      measures the whole — the same material a real session speaks. Prints the
//      VOICE_STATS + PREMIUM_VOICE_STATS rows with a unified perceptual trim.
//   2. PREVIEW clips (no key; reads Blob): measures the tray audition clips
//      (voice-previews/<gender>-<accent>.mp3 and voice-previews/<id>.mp3) and
//      prints level-matched audition gains for PREVIEW_GAIN / PREMIUM_PREVIEW_GAIN.
//
// Requirements: a real ffmpeg with the `ebur128` filter (Homebrew/apt build, NOT
// the stripped Playwright one). Check: `ffmpeg -filters | grep ebur128`.
//
// Usage (run on your Mac, with your key in .env.local):
//   NEXT_PUBLIC_BLOB_BASE_URL="https://xxxx.public.blob.vercel-storage.com" \
//     node scripts/measure-voices.mjs
//   node scripts/measure-voices.mjs --previews-only   # pass 2 only, no key/cost
//
// Then paste the printed tables back and the stats get set in lib/audio/levels.ts.

import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// --- minimal .env.local loader (so ELEVENLABS_* come through like the app) ----
for (const f of [".env.local", ".env"]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const clean = (v) => (v ? v.replace(/[^\x21-\x7E]/g, "") : v);
const previewsOnly = process.argv.includes("--previews-only");
const API_KEY = clean(process.env.ELEVENLABS_API_KEY);
const base = (process.env.NEXT_PUBLIC_BLOB_BASE_URL || "").replace(/\/+$/, "");

// The free voices and their default ElevenLabs IDs — MUST match lib/tts.ts
// VOICE_TABLE (env override falls back to the same defaults). accent "" for
// premium (baked accent, single clip).
const FREE_VOICES = [
  { id: "female-us", envs: ["ELEVENLABS_VOICE_FEMALE_US"], def: "7AvtJrjTNyBhBxEvNPIZ" },
  { id: "female-uk", envs: ["ELEVENLABS_VOICE_FEMALE_UK", "ELEVENLABS_VOICE_FEMALE"], def: "bgU7lBMo69PNEOWHFqxM" },
  { id: "male-us", envs: ["ELEVENLABS_VOICE_MALE_US"], def: "6bPfTtSpgxgD0GeBVfqu" },
  { id: "male-uk", envs: ["ELEVENLABS_VOICE_MALE_UK", "ELEVENLABS_VOICE_MALE"], def: "UmQN7jS1Ee8B1czsUtQh" },
];
function freeVoiceId(row) {
  for (const name of row.envs) {
    const v = clean(process.env[name]);
    if (v && !v.startsWith("sk_") && v.length <= 40) return v;
  }
  return row.def;
}

// Premium roster, parsed from lib/premiumVoices.ts (single source of truth).
const pvSrc = readFileSync(join(ROOT, "lib", "premiumVoices.ts"), "utf8");
const RE = /id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*gender:\s*"[^"]+",\s*accent:\s*"[^"]+",\s*voiceId:\s*"([^"]+)"/g;
const PREMIUM = [];
for (let m; (m = RE.exec(pvSrc)); ) PREMIUM.push({ id: m[1], name: m[2], voiceId: m[3] });
if (PREMIUM.length !== 10) {
  console.error(`Expected 10 premium voices, parsed ${PREMIUM.length}. Check lib/premiumVoices.ts.`);
  process.exit(1);
}

// A fixed, representative slice of real session language (settle -> breath ->
// body -> close), so every voice is measured over the same words. {name} is
// filled so the greeting line synthesizes normally. Kept stable so re-runs are
// comparable.
const LINES = [
  "Hello, and welcome, Alex.",
  "Let's set this time aside, just for you.",
  "Find a posture that feels steady and easy, and let the eyes close, or soften toward the floor.",
  "There is nothing to achieve here, and nothing to fix. You can let all of that go for now.",
  "Take one deeper breath, in through the nose, and let it out slowly.",
  "And let the breathing return to its own natural rhythm.",
  "If the mind wanders, that's completely natural. Just gently notice, and come back.",
  "Feel the weight of the body, held and supported, nothing to hold onto.",
  "Rest here for a moment, in the quiet, with nowhere to be.",
  "When you're ready, let the eyes open, and carry this ease with you.",
];

const SPEED = Number(process.env.ELEVENLABS_SPEED ?? 1.0) || 1.0;
const STABILITY = Number(process.env.ELEVENLABS_STABILITY ?? 0.85) || 0.85;
const FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";

// ---- ffmpeg measurement (shared with measure-beds.mjs) ----------------------
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
    peak: tpeak ? parseFloat(tpeak.match(/(-?\d+(?:\.\d+)?)/)[1]) : (maxv ? parseFloat(maxv) : NaN),
    rms: mean ? parseFloat(mean) : NaN,
  };
}

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

const tmp = await mkdtemp(join(tmpdir(), "voices-"));

// Synthesize every LINE for one voice, concat to a single mp3, and measure the
// whole (integrated LUFS over real session material). Returns {rms,peak,lufs}.
async function measureVoiceSession(id, voiceId) {
  const files = [];
  for (let i = 0; i < LINES.length; i++) {
    const buf = await synth(voiceId, LINES[i]);
    const p = join(tmp, `${id}-${i}.mp3`);
    await writeFile(p, buf);
    files.push(p);
  }
  const listPath = join(tmp, `${id}.txt`);
  await writeFile(listPath, files.map((f) => `file '${f}'`).join("\n"));
  const joined = join(tmp, `${id}.mp3`);
  await run("ffmpeg", ["-hide_banner", "-nostats", "-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", joined], { maxBuffer: 1024 * 1024 * 128 });
  return measure(joined);
}

// ---- Pass 1: session-voice loudness -----------------------------------------
const sessionRows = [];
if (!previewsOnly) {
  if (!API_KEY) {
    console.error("ELEVENLABS_API_KEY not set — skipping session pass (add it to .env.local, or use --previews-only).");
  } else {
    for (const v of FREE_VOICES) {
      try {
        const m = await measureVoiceSession(v.id, freeVoiceId(v));
        sessionRows.push({ id: v.id, kind: "free", ...m, excess: m.lufs - m.rms });
        console.error(`  measured ${v.id}`);
      } catch (e) {
        console.error(`  ${v.id} FAILED: ${e.message}`);
      }
    }
    for (const v of PREMIUM) {
      try {
        const m = await measureVoiceSession(v.id, v.voiceId);
        sessionRows.push({ id: v.id, kind: "premium", ...m, excess: m.lufs - m.rms });
        console.error(`  measured ${v.id} (${v.name})`);
      } catch (e) {
        console.error(`  ${v.id} FAILED: ${e.message}`);
      }
    }
  }
}

// ---- Pass 2: preview-clip audition gains (no key) ---------------------------
const PREVIEW_TARGET_LUFS = -18; // matches scripts/measure-beds.mjs
async function fetchToTmp(subdir, file) {
  if (!base) return null;
  const res = await fetch(`${base}/${subdir}/${file}`);
  if (!res.ok) {
    console.error(`  skip ${file}: ${res.status}`);
    return null;
  }
  const p = join(tmp, `pv-${file}`);
  await writeFile(p, Buffer.from(await res.arrayBuffer()));
  return p;
}
async function measurePreview(file) {
  const p = await fetchToTmp("voice-previews", file);
  if (!p) return null;
  const m = await measure(p);
  const db = Number.isFinite(m.lufs) ? Math.min(PREVIEW_TARGET_LUFS - m.lufs, -1 - m.peak) : NaN;
  const gain = Number.isFinite(db) ? Math.round(Math.pow(10, db / 20) * 100) / 100 : NaN;
  return { ...m, gain };
}

const previewRows = [];
if (base) {
  for (const v of FREE_VOICES) {
    const m = await measurePreview(`${v.id}.mp3`);
    if (m) previewRows.push({ id: v.id, ...m });
  }
  for (const v of PREMIUM) {
    const m = await measurePreview(`${v.id}.mp3`);
    if (m) previewRows.push({ id: v.id, ...m });
  }
} else {
  console.error("NEXT_PUBLIC_BLOB_BASE_URL not set — skipping preview pass.");
}

await rm(tmp, { recursive: true, force: true });

// ---- Report -----------------------------------------------------------------
// Unified perceptual trim: perceived excess = LUFS - RMS; the roster median is
// the reference; trim each voice by (median - its excess) so, once RMS-normalized
// to VOICE_TARGET, they all land at equal *perceived* loudness. Same model as beds.
if (sessionRows.length) {
  const valid = sessionRows.filter((r) => Number.isFinite(r.excess));
  const med = valid.map((r) => r.excess).sort((a, b) => a - b)[Math.floor(valid.length / 2)] ?? 0;
  console.log("\nSESSION VOICES — paste rms/peak/trim into lib/audio/levels.ts");
  console.log("(free -> VOICE_STATS, premium -> PREMIUM_VOICE_STATS)\n");
  console.log("id            kind      rms     peak    LUFS    trim");
  for (const r of sessionRows) {
    const trim = Number.isFinite(r.excess) ? Math.round((med - r.excess) * 2) / 2 : NaN;
    console.log(
      r.id.padEnd(12),
      r.kind.padEnd(8),
      String(r.rms).padStart(6),
      String(r.peak).padStart(7),
      String(r.lufs).padStart(7),
      "  ",
      Number.isFinite(trim) ? (trim === 0 ? "0" : String(trim)) : "FAILED"
    );
  }
  console.log("\nReference (median) perceived excess:", med.toFixed(1), "dB — trims are relative to it.");
}

if (previewRows.length) {
  console.log("\nPREVIEW CLIPS — level-matched audition gains (linear)");
  console.log("(free -> PREVIEW_GAIN, premium -> PREMIUM_PREVIEW_GAIN)\n");
  console.log("id            LUFS    truePeak   gain");
  for (const r of previewRows) {
    console.log(
      r.id.padEnd(12),
      String(r.lufs).padStart(6),
      String(r.peak).padStart(8),
      "   ",
      Number.isFinite(r.gain) ? r.gain : "FAILED"
    );
  }
}
console.log("");
