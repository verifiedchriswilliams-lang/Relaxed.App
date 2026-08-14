// Cached session templates.
//
// Every session for a given state is essentially the same script, spoken more
// or less spaciously depending on length, with only the name lines unique to
// the listener. So instead of writing a fresh script with Claude on every
// request (slow and costly), we keep a canonical script per state here. The
// common lines are voiced ONCE and cached (see lib/voiceCache.ts + the
// build-voice-cache script); only the {name} lines are synthesized per session.
//
// A single master per state serves every duration: each line carries the
// minimum duration band at which it appears (`from`), so shorter sessions are a
// subset of the longer ones, and the pauses scale up with length. This mirrors
// how a real guided sit opens out: the same few instructions, with more silence
// between them as the session grows.
//
// No em dashes anywhere (spoken and read-along both). Secular, plainspoken,
// in the spirit of the great modern mindfulness teachers, never woo.

import { ContextId, getDurationBand } from "./contexts";
import MASTERS_DATA from "./sessionScripts.json";

// Duration bands, smallest to largest. A line with `from: n` appears only when
// the chosen duration is at least band n.
const BAND_RANK: Record<string, number> = {
  short: 0,
  brief: 1,
  medium: 2,
  long: 3,
  deep: 4,
};

// Rough spoken length of a line at a slow, meditative pace (~2.2 words/sec).
function estimateSpeechSeconds(text: string): number {
  const words = text.replace(/\{name\}/g, "friend").trim().split(/\s+/).length;
  return words / 2.2;
}

export interface ScriptLine {
  text: string; // spoken words; name lines contain the literal token {name}
  pause: number; // base seconds of stillness after this line (short-band value)
  from?: number; // min band rank at which this line appears (default 0 = always)
  name?: boolean; // true if personalized (contains {name}); synthesized live
}

export interface ResolvedLine {
  text: string; // raw text (still contains {name} for name lines)
  pause: number; // final seconds of stillness after this line
  name: boolean;
}

// Template data lives in sessionScripts.json so the app and the cache builder
// (a plain Node script) read exactly the same source. Each state maps to one or
// more variants (rotated for freshness); add variants there with no code change.
const MASTERS = MASTERS_DATA as Record<ContextId, ScriptLine[][]>;

// Assemble the lines for a given state + duration + variant. Shorter sessions
// are a subset of the longer ones (via each line's `from` band). The authored
// `pause` values are relative weights; here they are stretched to fill the whole
// chosen duration, so the same handful of lines spreads across 5 minutes or 30,
// mostly as silence. A short tail of quiet is left at the end.
export function assembleSession(
  contextId: ContextId,
  durationMin: number,
  variant = 0
): ResolvedLine[] {
  const variants = MASTERS[contextId] ?? MASTERS.meditation;
  const chosen =
    variants[((variant % variants.length) + variants.length) % variants.length];
  const rank = BAND_RANK[getDurationBand(durationMin).id] ?? 0;
  const included = chosen.filter((l) => (l.from ?? 0) <= rank);

  const target = durationMin * 60;
  const speech = included.reduce((a, l) => a + estimateSpeechSeconds(l.text), 0);
  const weightSum = included.reduce((a, l) => a + l.pause, 0) || 1;
  // Leave a little quiet at the end (the soundscape carries the close).
  const tail = Math.min(0.08 * target, 25);
  const budget = Math.max(target - speech - tail, included.length * 2);

  return included.map((l) => {
    // Distribute the silence in proportion to the authored pause weights, then
    // clamp so no single gap is jarringly long or too short.
    const p = Math.max(2, Math.min(120, (l.pause / weightSum) * budget));
    return {
      text: l.text,
      name: !!l.name,
      pause: Math.round(p * 10) / 10,
    };
  });
}

export function variantCount(contextId: ContextId): number {
  return (MASTERS[contextId] ?? MASTERS.meditation).length;
}

// Every distinct common (non-name) line across all states and variants, used by
// the cache builder to know exactly what to pre-voice. Name lines are excluded
// (they are synthesized per session).
export function allCommonLines(): string[] {
  const set = new Set<string>();
  (Object.keys(MASTERS) as ContextId[]).forEach((id) => {
    MASTERS[id].forEach((variant) => {
      variant.forEach((line) => {
        if (!line.name) set.add(line.text);
      });
    });
  });
  return Array.from(set);
}

// The read-along transcript for a session (names resolved).
export function sessionTranscript(lines: ResolvedLine[], name: string): string {
  const who = name.trim() || "friend";
  return lines
    .map((l) => l.text.replace(/\{name\}/g, who))
    .join("\n");
}
