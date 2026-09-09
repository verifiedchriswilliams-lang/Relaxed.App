import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDurationBand, SCRIPT_SYSTEM_PROMPT } from "@/lib/contexts";
import { blueprintFor, type Blueprint, type SceneKey } from "@/lib/engine";

// Writes a fully bespoke meditation for a short phrase the user typed, live via
// Claude, on the Meditation Engine (Phase 1). The app hands Claude a structured
// arc (settle -> body -> visualization -> reflection -> close) with a per-scene
// objective and word budget; Claude fills each scene, and we fit each scene's
// pauses to its own second target so the session is balanced end to end. Returns
// scene-tagged, timed segments (text + the silence after each), which the client
// voices per-line and streams.
export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

interface Body {
  name?: string;
  phrase?: string;
  durationMin?: number;
  // Seconds of spoken "arrival" the client plays before this body (instant
  // start). Subtracted from the fill target so the body plus the arrival add up
  // to the chosen length, and the closing line isn't clipped by the timer.
  leadSeconds?: number;
  // The exact arrival lines already spoken to the user (instant start), so the
  // body can continue seamlessly instead of greeting/settling a second time.
  arrivalText?: string;
}

export interface CustomSegment {
  text: string; // spoken words for this line
  pauseAfter: number; // seconds of stillness after it
  scene?: SceneKey; // which movement of the arc this line belongs to
}

const clean = (v: string | undefined) => v?.replace(/[^\x21-\x7E]/g, "") || undefined;
const speechSecs = (t: string) => t.trim().split(/\s+/).length / 2.2;

// Split "<break time='Xs'/>"-tagged prose into {text, pause} segments: each text
// chunk becomes a line, and the break tags right after it sum into its pause.
function parseBreaks(raw: string): CustomSegment[] {
  const tokens = raw.trim().split(/<break\s+time="([\d.]+)s"\s*\/?>/gi);
  const segs: CustomSegment[] = [];
  let curText = "";
  let curPause = 0;
  tokens.forEach((tok, i) => {
    if (i % 2 === 0) {
      const t = tok.replace(/\s+/g, " ").trim();
      if (!t) return;
      if (curText) {
        segs.push({ text: curText, pauseAfter: curPause });
        curPause = 0;
      }
      curText = t;
    } else {
      curPause += parseFloat(tok) || 0;
    }
  });
  if (curText) segs.push({ text: curText, pauseAfter: curPause });
  return segs;
}

// Fit one scene's pauses to fill its own second target, leaving a short tail of
// quiet. Mirrors the session assembler, scoped to a single movement so the whole
// arc stays balanced (the app owns timing; each scene keeps its share).
function fitScene(segs: CustomSegment[], targetSeconds: number): CustomSegment[] {
  if (!segs.length) return segs;
  const target = Math.max(targetSeconds, 20);
  const speech = segs.reduce((a, s) => a + speechSecs(s.text), 0);
  const weight = segs.reduce((a, s) => a + Math.max(s.pauseAfter, 0.5), 0) || 1;
  const tail = Math.min(0.05 * target, 8);
  const budget = Math.max(target - speech - tail, segs.length * 2);
  return segs.map((s) => {
    const w = Math.max(s.pauseAfter, 0.5);
    const p = Math.max(2, Math.min(120, (w / weight) * budget));
    return { text: s.text, pauseAfter: Math.round(p * 10) / 10, scene: s.scene };
  });
}

// Whole-script fallback fit (used when the model doesn't emit scene markers), so
// the session still fills its length. Targets (length - arrival) like the arc.
function fitWhole(
  segs: CustomSegment[],
  durationMin: number,
  leadSeconds = 0
): CustomSegment[] {
  const target = Math.max(durationMin * 60 - Math.max(0, leadSeconds), 60);
  return fitScene(segs, target);
}

// Parse a scene-tagged script into scene-scoped, per-scene-fit segments. The
// model is asked to prefix each movement with an exact [scene:key] marker; we
// split on those and fit each chunk to its planned seconds. Returns null if no
// markers are present so the caller can fall back to a whole-script fit.
function parseScenes(raw: string, blueprint: Blueprint): CustomSegment[] | null {
  const parts = raw.split(/\[scene:\s*([a-z]+)\s*\]/i);
  if (parts.length < 3) return null; // no markers found
  const byKey = new Map<string, number>();
  blueprint.scenes.forEach((s) => byKey.set(s.key, s.targetSeconds));
  const out: CustomSegment[] = [];
  // parts = [pre, key1, chunk1, key2, chunk2, ...]; ignore any preamble.
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i].toLowerCase() as SceneKey;
    const chunk = parts[i + 1] ?? "";
    const segs = parseBreaks(chunk).map((s) => ({ ...s, scene: key }));
    if (!segs.length) continue;
    const target = byKey.get(key) ?? blueprint.bodyTargetSeconds / blueprint.scenes.length;
    out.push(...fitScene(segs, target));
  }
  return out.length >= 3 ? out : null;
}

function buildPrompt(
  name: string,
  phrase: string,
  blueprint: Blueprint,
  arrivalText?: string
): string {
  const band = getDurationBand(blueprint.bodyTargetSeconds / 60);
  const arc = blueprint.scenes
    .map(
      (s) =>
        `[scene:${s.key}] ${s.title} (about ${s.wordBudget} spoken words, ~${s.targetSeconds}s). ${s.objective} Breath here: ${s.breath}.`
    )
    .join("\n");
  const opening = arrivalText
    ? `IMPORTANT — the session has ALREADY BEGUN. The person was just greeted and guided to settle with these exact spoken lines: "${arrivalText}". Continue seamlessly. Do NOT greet them again, do NOT re-introduce yourself, and do NOT repeat the settling-in or the first breath. Your very first line (the start of [scene:settle]) goes straight on from there.`
    : `Open by gently acknowledging what they named, then move through the arc below.`;
  return [
    `Name: ${name}`,
    `Session type: Custom, written live for what this person is carrying right now.`,
    `What they typed (a short phrase): "${phrase}"`,
    ``,
    opening,
    ``,
    `Write the session as the arc below, IN THIS ORDER. Begin each movement with its exact marker on its own line (for example "[scene:body]"), then the spoken words for that movement with <break> pause tags. The word counts are approximate targets, not limits; the app owns exact timing, so favor fewer words and more silence. Acknowledge and speak back to what they named across the body, visualization, and reflection; never give advice, diagnoses, or promises.`,
    ``,
    arc,
    ``,
    `SAFETY: If their words suggest they may be in crisis or thinking of harming themselves, keep the session especially gentle and grounding, make no attempt at therapy or advice, and include one soft line that reaching out to someone they trust, or a helpline, is a strong and kind thing to do. Otherwise do not mention helplines. Never diagnose, and never promise an outcome.`,
    `Overall pacing for this length: ${band.guidance}`,
    ``,
    `Output ONLY the scene markers and the spoken words plus <break time="2.5s" /> tags. No other headings, no commentary. Fill the time mainly with silence and returns to the breath, not with extra words.`,
  ].join("\n");
}

// A no-key fallback so Custom still demonstrates end to end in preview mode. A
// small scene-tagged arc, fit per scene like the live path.
function fallbackScript(
  name: string,
  blueprint: Blueprint,
  hasArrival = false
): CustomSegment[] {
  const who = name || "there";
  const s = (text: string, scene: SceneKey): CustomSegment => ({ text, pauseAfter: 4, scene });
  const lines: CustomSegment[] = [
    // Opening (dropped when the client arrival already greeted + settled).
    s(`Hello, ${who}. Let's take this time for what you're carrying.`, "settle"),
    s(`Settle into a comfortable position, and let the eyes close.`, "settle"),
    s(`Take one slow breath in, and let it go completely.`, "settle"),
    s(`Feel the breath arriving, and leaving. Nothing to fix right now.`, "body"),
    s(`Whatever brought you here, you can set it down for these few minutes.`, "body"),
    s(`If it helps, picture a place where you feel a little more at ease.`, "visualization"),
    s(`Notice how the body feels now, a touch softer than a moment ago.`, "reflection"),
    s(`When you're ready, ${who}, let the eyes open, gently.`, "close"),
  ];
  const chosen = hasArrival ? lines.slice(3) : lines;
  const byKey = new Map<string, number>();
  blueprint.scenes.forEach((sc) => byKey.set(sc.key, sc.targetSeconds));
  // Group by scene and fit each group to its planned seconds.
  const out: CustomSegment[] = [];
  const keys = [...new Set(chosen.map((l) => l.scene!))];
  for (const k of keys) {
    const grp = chosen.filter((l) => l.scene === k);
    const target = byKey.get(k) ?? blueprint.bodyTargetSeconds / blueprint.scenes.length;
    out.push(...fitScene(grp, target));
  }
  return out;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const name = (body.name || "").trim().slice(0, 60);
  const phrase = (body.phrase || "").replace(/\s+/g, " ").trim().slice(0, 70);
  const durationMin = Math.min(60, Math.max(3, Number(body.durationMin) || 10));
  // Clamp the reserved arrival to something sane (never more than a third of a
  // short session), so a bad client value can't starve the body.
  const leadSeconds = Math.min(
    Math.max(0, Number(body.leadSeconds) || 0),
    durationMin * 20
  );
  const arrivalText = (body.arrivalText || "").replace(/\s+/g, " ").trim().slice(0, 300) || undefined;
  if (!phrase) return NextResponse.json({ error: "No phrase" }, { status: 400 });

  const who = name || "friend";
  const apiKey = clean(process.env.ANTHROPIC_API_KEY);
  const blueprint = blueprintFor("custom", durationMin, { leadSeconds });
  const scenes = blueprint.scenes.map((s) => ({ key: s.key, title: s.title }));

  // Preview mode: no key, still return a coherent (generic) bespoke-ish session.
  if (!apiKey) {
    const segs = fallbackScript(name, blueprint, !!arrivalText);
    return NextResponse.json({ segments: segs, scenes, mock: true });
  }

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1600,
      // The system prompt is byte-stable across every request, so mark it as a
      // cache prefix. The per-request user prompt varies and sits after it in
      // messages[], so it never invalidates the cached prefix. Reads bill at
      // ~0.1x input; this pays off whenever sessions cluster within the cache
      // window, and is a no-op cost otherwise.
      system: [
        {
          type: "text",
          text: SCRIPT_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        { role: "user", content: buildPrompt(who, phrase, blueprint, arrivalText) },
      ],
    });
    // Cache telemetry (visible in Vercel function logs): cache_read_input_tokens
    // > 0 means the system prefix was served from cache. If it stays 0 across
    // back-to-back sessions, the prefix isn't being reused (or drifted).
    const u = msg.usage;
    console.log(
      `[custom-script] model=${DEFAULT_MODEL} in=${u.input_tokens} out=${u.output_tokens} cache_write=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0}`
    );
    const raw = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Prefer the scene-tagged parse (per-scene timing); fall back to a whole
    // script fit if the model didn't emit markers, then to the canned script.
    let segs = parseScenes(raw, blueprint) ?? fitWhole(parseBreaks(raw), durationMin, leadSeconds);
    if (segs.length < 3) {
      segs = fallbackScript(name, blueprint, !!arrivalText);
    }
    return NextResponse.json({ segments: segs, scenes });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generation failed" },
      { status: 502 }
    );
  }
}
