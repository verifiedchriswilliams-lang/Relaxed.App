// The Meditation Engine (Phase 1).
//
// The app owns the *structure* of a session; Claude owns the *language*; the
// browser owns the *timing* and the *mix*. A session is an ordered arc of named
// scenes (settle, body, visualization, reflection, close), each with a share of
// the total length, a breath feel, and an objective. `blueprintFor` turns a
// context + duration into concrete per-scene second targets; the custom-script
// route hands those to Claude scene by scene, then fits each scene's pauses to
// its own target so the arc is balanced (not front-loaded).
//
// Scene-based audio is a separate, lighter layer: an `AudioProfile` per context
// shapes bed intensity and voice presence over the *progress* of the session
// (0..1). It applies to every session (presets and custom) at playback, and is
// what makes a Sleep session's voice thin out toward the end while the bed
// continues. Keeping the audio envelope progress-based (rather than tied to the
// discrete scenes) means presets get it for free without re-authoring them.

import type { ContextId } from "./contexts";

export type SceneKey =
  | "opening"
  | "settle"
  | "body"
  | "visualization"
  | "reflection"
  | "close";

export interface Scene {
  key: SceneKey;
  title: string;
  // What this movement is for. Handed to Claude as the scene's brief.
  objective: string;
  // A short breath feel for this movement (guidance only, plain words).
  breath: string;
  // Fraction of the writeable body this scene occupies (shares sum to ~1).
  share: number;
}

export interface PlannedScene extends Scene {
  targetSeconds: number;
  // A rough spoken-word budget for the scene, derived from its seconds and the
  // house "speak about a third, rest two thirds" ratio.
  wordBudget: number;
}

export interface Blueprint {
  context: ContextId;
  scenes: PlannedScene[];
  bodyTargetSeconds: number;
}

// House pacing: a guided sit is mostly silence. We aim to actually speak about a
// third of the time, at ~2.2 words/second.
const SPEAK_RATIO = 0.33;
const WORDS_PER_SEC = 2.2;

// The bespoke ("In your words") arc. The opening (greeting + first breath) is
// spoken client-side as the instant-start arrival, so the written body begins at
// `settle` and runs through `close`. Shares are over the written body only.
const CUSTOM_SCENES: Scene[] = [
  {
    key: "settle",
    title: "Settle",
    objective:
      "Continue seamlessly from the arrival already spoken. A couple of grounding breaths, landing attention in the body and the present. Do not greet again.",
    breath: "slow, even breaths",
    share: 0.16,
  },
  {
    key: "body",
    title: "Body",
    objective:
      "The heart of the session, shaped to what the person named. Plain breath-and-body mindfulness that meets their situation directly, without advice or analysis.",
    breath: "natural, unforced",
    share: 0.34,
  },
  {
    key: "visualization",
    title: "Visualization",
    objective:
      "One concrete, grounded image that fits their situation, a place or a physical sensation of ease, lightly held. No fantasy or metaphysics; something a skeptic could picture.",
    breath: "soft, lengthening exhales",
    share: 0.2,
  },
  {
    key: "reflection",
    title: "Reflection",
    objective:
      "A gentle noticing: how the body feels now, and one kind, grounded thought that speaks back to what they named. Reassure plainly, never clinically; promise nothing.",
    breath: "easy",
    share: 0.16,
  },
  {
    key: "close",
    title: "Close",
    objective:
      "A soft, unhurried return. The very last line addresses them warmly by name once, and lets the words trail into quiet.",
    breath: "quiet",
    share: 0.14,
  },
];

// Sleep is the other shape we plan explicitly (used if the engine ever drives a
// sleep session): no bright reflection, and the words are meant to thin out.
const SLEEP_SCENES: Scene[] = [
  {
    key: "settle",
    title: "Settle",
    objective:
      "A wind-down. Quiet permission to let the day be finished; a slow, low welcome into rest.",
    breath: "long, slow exhales",
    share: 0.2,
  },
  {
    key: "body",
    title: "Softening",
    objective:
      "A gentle head-to-toe softening, letting each part grow heavy and give its weight to the bed, paired with long exhales.",
    breath: "long exhales, nothing effortful",
    share: 0.34,
  },
  {
    key: "visualization",
    title: "Drift",
    objective:
      "A calm, heavy, sinking image (resting deeper into the bed, warm and still). Reassure there is nothing to do and nowhere to be.",
    breath: "barely noticed",
    share: 0.28,
  },
  {
    key: "close",
    title: "Trail off",
    objective:
      "Let the words thin out and trail into quiet. It is completely fine to drift off before the end. No instruction, only a little warmth, then silence.",
    breath: "let it go",
    share: 0.18,
  },
];

function scenesFor(context: ContextId): Scene[] {
  if (context === "sleep") return SLEEP_SCENES;
  return CUSTOM_SCENES;
}

// Turn a context + duration into concrete per-scene second targets. `leadSeconds`
// is the spoken arrival already played client-side (instant start), reserved out
// of the total so the written body plus the arrival land on the chosen length.
export function blueprintFor(
  context: ContextId,
  durationMin: number,
  opts?: { leadSeconds?: number }
): Blueprint {
  const total = Math.max(3, Math.min(60, durationMin)) * 60;
  const lead = Math.max(0, Math.min(opts?.leadSeconds ?? 0, total * 0.34));
  const bodyTargetSeconds = Math.max(total - lead, 60);
  const base = scenesFor(context);
  const sum = base.reduce((a, s) => a + s.share, 0) || 1;
  const scenes: PlannedScene[] = base.map((s) => {
    const targetSeconds = Math.round((s.share / sum) * bodyTargetSeconds);
    const wordBudget = Math.max(
      10,
      Math.round(targetSeconds * SPEAK_RATIO * WORDS_PER_SEC)
    );
    return { ...s, targetSeconds, wordBudget };
  });
  return { context, scenes, bodyTargetSeconds };
}

// ---------------------------------------------------------------------------
// Scene-based audio: how the bed and the voice move over the session's progress.
// Multipliers, applied on top of the normalized levels the mixer already sets.
// ---------------------------------------------------------------------------
export interface AudioProfile {
  // Bed level multiplier over progress p (0..1). ~1 is the normal bed.
  bed: (p: number) => number;
  // Voice level multiplier over progress p (0..1). 1 is full presence.
  voice: (p: number) => number;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);

// Default: steady presence, with a small softening in the last stretch so a
// session settles out rather than stopping flat.
const DEFAULT_PROFILE: AudioProfile = {
  bed: (p) => (p < 0.85 ? 1 : lerp(1, 0.9, (p - 0.85) / 0.15)),
  voice: (p) => (p < 0.9 ? 1 : lerp(1, 0.9, (p - 0.9) / 0.1)),
};

// Sleep: the voice thins out over the second half while the bed stays present
// and gentle, so a sleeper is carried by the sound as the guidance recedes.
const SLEEP_PROFILE: AudioProfile = {
  bed: (p) => lerp(0.95, 0.85, p),
  voice: (p) => (p < 0.4 ? 1 : lerp(1, 0.35, (p - 0.4) / 0.6)),
};

// Relax and Breathe (stress-relief) ease out a little sooner and softer than the
// default, but keep the voice mostly present.
const EASE_PROFILE: AudioProfile = {
  bed: (p) => (p < 0.75 ? 1 : lerp(1, 0.88, (p - 0.75) / 0.25)),
  voice: (p) => (p < 0.8 ? 1 : lerp(1, 0.8, (p - 0.8) / 0.2)),
};

export function audioProfile(context: ContextId): AudioProfile {
  switch (context) {
    case "sleep":
      return SLEEP_PROFILE;
    case "relax":
    case "stress-relief":
      return EASE_PROFILE;
    default:
      return DEFAULT_PROFILE;
  }
}
