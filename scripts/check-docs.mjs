// Documentation drift checker. Keeps docs/ honest as the code changes.
//
// Two kinds of checks:
//   1. Link integrity — every relative Markdown link in the docs (and the root
//      README) points at a file that exists.
//   2. Pinned facts — a set of distinctive, drift-prone values are read live from
//      the source of truth (the code) and must still appear in the docs that cite
//      them. If a value changes in code, the matching doc check fails, so the doc
//      has to be updated in the same change.
//
// Run: `npm run check:docs`  (also runs in CI on push/PR).
// Exit code 0 = all good; 1 = drift found. Add new pinned facts as the product
// grows — the goal is that changing a documented value can't pass silently.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const failures = [];
const notes = [];

function fail(check, detail) {
  failures.push(`✗ ${check}\n    ${detail}`);
}
function ok(check) {
  notes.push(`✓ ${check}`);
}

// ---------------------------------------------------------------- link integrity
// Every ](./x) / ](../x) relative link in a Markdown file must resolve. Anchors
// (#...) and external (http...) links are ignored; only file existence is checked.
function checkLinks() {
  const mdFiles = execSync(
    "git ls-files '*.md' 'docs/**/*.md' README.md",
    { cwd: ROOT, encoding: "utf8" }
  )
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set();
  let broken = 0;
  for (const f of mdFiles) {
    if (seen.has(f)) continue;
    seen.add(f);
    const body = read(f);
    const linkRe = /\]\((\.\.?\/[^)#]+?)(?:#[^)]*)?\)/g;
    let m;
    while ((m = linkRe.exec(body))) {
      const target = resolve(dirname(join(ROOT, f)), m[1]);
      if (!existsSync(target)) {
        broken++;
        fail("link integrity", `${f} → ${m[1]} (missing ${relative(ROOT, target)})`);
      }
    }
  }
  if (broken === 0) ok(`link integrity (${seen.size} markdown files scanned)`);
}

// ---------------------------------------------------------------- pinned facts
// Helper: assert a live code value appears (as one of some acceptable renderings)
// in each of the given docs.
function mustAppear(label, renderings, docs) {
  const cands = renderings.filter(Boolean).map(String);
  for (const doc of docs) {
    if (!existsSync(join(ROOT, doc))) {
      fail(label, `doc missing: ${doc}`);
      continue;
    }
    const body = read(doc);
    const hit = cands.some((c) => body.includes(c));
    if (!hit) {
      fail(
        label,
        `expected one of [${cands.join(" | ")}] in ${doc} (source of truth changed?)`
      );
    }
  }
  if (!failures.some((x) => x.startsWith(`✗ ${label}`))) ok(`${label} → ${cands[0]}`);
}

function grab(file, re, name) {
  const m = read(file).match(re);
  if (!m) {
    fail("read source value", `could not find ${name} in ${file}`);
    return null;
  }
  return m[1];
}

function checkPinnedFacts() {
  // 1. Voice cache manifest size.
  try {
    const n = JSON.parse(read("lib/voiceCacheManifest.json")).keys.length;
    mustAppear(
      "voice-cache manifest count",
      [n, n.toLocaleString("en-US")],
      ["docs/audio-engine.md", "docs/voice-cache.md"]
    );
  } catch (e) {
    fail("voice-cache manifest count", String(e));
  }

  // 2. Claude model default.
  const model = grab(
    "app/api/custom-script/route.ts",
    /ANTHROPIC_MODEL\s*\|\|\s*"([^"]+)"/,
    "ANTHROPIC_MODEL default"
  );
  if (model)
    mustAppear("Claude model default", [model], [
      "docs/infrastructure.md",
      "docs/audio-engine.md",
      "docs/overview.md",
    ]);

  // 3. Breath cadence (cycle seconds), from the three constants.
  const bin = grab("app/page.tsx", /BREATH_IN\s*=\s*([\d.]+)/, "BREATH_IN");
  const bhold = grab("app/page.tsx", /BREATH_HOLD\s*=\s*([\d.]+)/, "BREATH_HOLD");
  const bout = grab("app/page.tsx", /BREATH_OUT\s*=\s*([\d.]+)/, "BREATH_OUT");
  if (bin && bhold && bout) {
    const cycle = (parseFloat(bin) + parseFloat(bhold) + parseFloat(bout))
      .toString();
    mustAppear("breath cadence (cycle s)", [cycle], [
      "docs/audio-engine.md",
      "docs/design-system.md",
      "docs/brand/relaxed-stem/assets/tokens.css",
    ]);
    // tokens.json stores ms
    mustAppear("breath cadence (ms in tokens.json)", [
      (parseFloat(cycle) * 1000).toString(),
    ], ["docs/brand/relaxed-stem/assets/tokens.json"]);
  }

  // 3b. Screen transition duration (rx-screen-in) ⇄ brand tokens.
  const screen = grab(
    "app/relaxed.css",
    /rx-screen-in\s+([\d.]+)s/,
    "rx-screen-in duration"
  );
  if (screen) {
    mustAppear("screen transition (s in tokens.css)", [`${screen}s`], [
      "docs/brand/relaxed-stem/assets/tokens.css",
    ]);
    mustAppear("screen transition (ms in tokens.json)", [
      (parseFloat(screen) * 1000).toString(),
    ], ["docs/brand/relaxed-stem/assets/tokens.json"]);
  }

  // 4. The stem mark path — identity's exact geometry.
  const stem = grab("lib/mark.tsx", /STEM_PATH\s*=\s*"([^"]+)"/, "STEM_PATH");
  if (stem)
    mustAppear("stem mark path", [stem], [
      "docs/design-system.md",
      "docs/brand/relaxed-stem/README.md",
      "docs/brand/relaxed-stem/assets/tokens.json",
    ]);

  // 5. Next.js version.
  const pkg = JSON.parse(read("package.json"));
  mustAppear("Next.js version", [pkg.dependencies.next], ["docs/overview.md"]);

  // 6. Default ElevenLabs voice IDs (from lib/tts.ts) must be documented.
  const tts = read("lib/tts.ts");
  const ids = [...tts.matchAll(/"([A-Za-z0-9]{20})"/g)].map((m) => m[1]);
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length) {
    for (const id of uniqueIds) {
      mustAppear(`voice id ${id}`, [id], ["docs/audio-engine.md"]);
    }
  }

  // 7. On-device localStorage keys must all be in the privacy inventory.
  const KEY_RE = /"(relaxed\.[a-z.]+v\d+|elevenmind\.[a-z.]+v\d+|em_variant_seq)"/g;
  const src = read("lib/history.ts") + read("app/page.tsx");
  const keys = [...new Set([...src.matchAll(KEY_RE)].map((m) => m[1]))];
  for (const k of keys) {
    mustAppear(`storage key ${k}`, [k], ["docs/data-privacy.md"]);
  }

  // 8. Brand colours: Ink + Bone must match between code and the brand tokens.
  const relaxedCss = read("app/relaxed.css").toLowerCase();
  const tokensCss = read("docs/brand/relaxed-stem/assets/tokens.css").toLowerCase();
  for (const hex of ["#121110", "#efebe3"]) {
    if (!relaxedCss.includes(hex)) fail("brand colour", `${hex} not in app/relaxed.css`);
    else if (!tokensCss.includes(hex))
      fail("brand colour", `${hex} in code but not in tokens.css`);
    else ok(`brand colour ${hex} (code ⇄ tokens)`);
  }
}

// ---------------------------------------------------------------- run
checkLinks();
checkPinnedFacts();

console.log("\nDocumentation check\n===================");
for (const n of notes) console.log(n);
if (failures.length) {
  console.log("");
  for (const f of failures) console.log(f);
  console.log(
    `\n${failures.length} problem(s). A pinned value changed in the code but not in the docs, ` +
      `or a link is broken. Update the doc (or the check) and re-run.\n`
  );
  process.exit(1);
}
console.log("\nAll documentation checks passed.\n");
