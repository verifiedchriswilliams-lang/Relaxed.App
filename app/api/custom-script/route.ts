import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDurationBand, SCRIPT_SYSTEM_PROMPT } from "@/lib/contexts";

// Writes a fully bespoke meditation for a short phrase the user typed, live via
// Claude. Returns the script as timed segments (text + the silence after each),
// which the client then voices per-line and streams. This is the one path that
// generates a script on demand; the presets use the cached templates.
export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

interface Body {
  name?: string;
  phrase?: string;
  durationMin?: number;
}

export interface CustomSegment {
  text: string; // spoken words for this line
  pauseAfter: number; // seconds of stillness after it
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

// Stretch (or gently compress) the pauses so speech + silence fills the chosen
// length, leaving a short tail of quiet at the end. Mirrors lib/sessions.
function fitToDuration(segs: CustomSegment[], durationMin: number): CustomSegment[] {
  if (!segs.length) return segs;
  const target = durationMin * 60;
  const speech = segs.reduce((a, s) => a + speechSecs(s.text), 0);
  const weight = segs.reduce((a, s) => a + Math.max(s.pauseAfter, 0.5), 0) || 1;
  const tail = Math.min(0.08 * target, 25);
  const budget = Math.max(target - speech - tail, segs.length * 2);
  return segs.map((s) => {
    const w = Math.max(s.pauseAfter, 0.5);
    const p = Math.max(2, Math.min(120, (w / weight) * budget));
    return { text: s.text, pauseAfter: Math.round(p * 10) / 10 };
  });
}

function buildPrompt(name: string, phrase: string, durationMin: number): string {
  const band = getDurationBand(durationMin);
  // Enough separate spoken lines to anchor a session of this length: the pauses
  // between them fill the time, but there must be enough lines to spread across
  // it (too few and the session cannot reach its duration).
  const lineTarget = Math.max(8, Math.min(28, Math.round(durationMin * 1.2) + 4));
  return [
    `Name: ${name}`,
    `Session type: Custom, written live for what this person is carrying right now.`,
    `What they typed (a short phrase): "${phrase}"`,
    ``,
    `Build the whole session around their words. Open by gently acknowledging what they named (paraphrase it warmly, in your own words, do not just repeat it back verbatim), then guide plain, secular breath-and-body mindfulness shaped to that situation, and let the close speak back to it.`,
    `SAFETY: If their words suggest they may be in crisis or thinking of harming themselves, keep the session especially gentle and grounding, make no attempt at therapy or advice, and include one soft line that reaching out to someone they trust, or a helpline, is a strong and kind thing to do. Otherwise do not mention helplines. Never diagnose, and never promise an outcome.`,
    `Target length: ${durationMin} minutes`,
    `Pacing for this length: ${band.guidance}`,
    `Write roughly ${lineTarget} short spoken lines, each a sentence or two, separated by the pause tags. Spread them across the whole session so the pauses can carry the time; do not front-load all the words.`,
    ``,
    `Write the spoken mindfulness script now, spoken words plus <break time="2.5s" /> tags only. Fill the time mainly with silence and returns to the breath, not with extra words.`,
  ].join("\n");
}

// A no-key fallback so Custom still demonstrates end to end in preview mode.
function fallbackScript(name: string, phrase: string): CustomSegment[] {
  const who = name || "there";
  return [
    { text: `Hello, ${who}. Let's take this time for what you're carrying.`, pauseAfter: 6 },
    { text: `Settle into a comfortable position, and let the eyes close.`, pauseAfter: 8 },
    { text: `Take one slow breath in, and let it go completely.`, pauseAfter: 10 },
    { text: `Whatever brought you here, you can set it down for these few minutes.`, pauseAfter: 12 },
    { text: `Just feel the breath, arriving, and leaving.`, pauseAfter: 14 },
    { text: `There is nothing to fix right now. Only this breath, and the next.`, pauseAfter: 14 },
    { text: `When you're ready, ${who}, let the eyes open, gently.`, pauseAfter: 4 },
  ];
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
  const durationMin = Math.min(30, Math.max(3, Number(body.durationMin) || 10));
  if (!phrase) return NextResponse.json({ error: "No phrase" }, { status: 400 });

  const who = name || "friend";
  const apiKey = clean(process.env.ANTHROPIC_API_KEY);

  // Preview mode: no key, still return a coherent (generic) bespoke-ish session.
  if (!apiKey) {
    const segs = fitToDuration(fallbackScript(name, phrase), durationMin);
    return NextResponse.json({ segments: segs, mock: true });
  }

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1600,
      system: SCRIPT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPrompt(who, phrase, durationMin) }],
    });
    const raw = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    let segs = fitToDuration(parseBreaks(raw), durationMin);
    if (segs.length < 3) {
      // Model returned something unusable; fall back so the session still plays.
      segs = fitToDuration(fallbackScript(name, phrase), durationMin);
    }
    return NextResponse.json({ segments: segs });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generation failed" },
      { status: 502 }
    );
  }
}
