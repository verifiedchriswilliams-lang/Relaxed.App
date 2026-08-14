// The five core session types. Each one reshapes the tone + technique of the
// mindfulness script; the generation pipeline underneath is identical. The
// per-context "intent" is where the craft of the great mindfulness teachers is
// translated into plain, secular guidance the script writer can follow.
//
// `art` is the session disc for this context: a six-stop radial gradient
// (light, mid, light, deep, light, mid) that carries all of the app's colour.
// The interface itself stays neutral gray; the disc does the mood.

export type ContextId =
  | "meditation"
  | "sleep"
  | "flow"
  | "relax"
  | "stress-relief";

export interface SessionContext {
  id: ContextId;
  label: string;
  tagline: string;
  // The session disc gradient (CSS radial-gradient value).
  art: string;
  // Guidance handed to the script writer for this context.
  intent: string;
}

// Session disc palettes, one per context. Six stops, centred.
const DISC = {
  meditation:
    "radial-gradient(circle at 50% 50%, #efe7dd 0%, #b9b6d8 20%, #efeaf2 36%, #6f6fa8 62%, #d9d3e4 82%, #a9a6cc 100%)",
  sleep:
    "radial-gradient(circle at 50% 50%, #e6e4ee 0%, #7d7cb4 20%, #ddd9ea 36%, #2f2e5c 62%, #b6b2d2 82%, #55538c 100%)",
  flow:
    "radial-gradient(circle at 50% 50%, #e8eee6 0%, #8fbfa6 20%, #eaf1ea 36%, #3f7a68 62%, #cfe0d6 82%, #79ab97 100%)",
  relax:
    "radial-gradient(circle at 50% 50%, #f3ece2 0%, #f0b98a 20%, #f7ece0 36%, #d97d4a 62%, #f2ddc9 82%, #e79f6c 100%)",
  stress:
    "radial-gradient(circle at 50% 50%, #f2e6e4 0%, #dc9a94 20%, #f5e9e7 36%, #a94f48 62%, #e8cbc7 82%, #c9756d 100%)",
} as const;

export const CONTEXTS: SessionContext[] = [
  {
    id: "meditation",
    label: "Meditation",
    tagline: "Presence and awareness",
    art: DISC.meditation,
    intent:
      "A classic mindfulness sit, in the plainspoken spirit of MBSR. Anchor attention on the " +
      "physical feeling of the breath and the body: the rise and fall, the weight of the body in " +
      "the seat, the contact of the hands. When the mind wanders, and it will, that is completely " +
      "normal, not a failure. Gently notice where it went and, without any criticism, begin again. " +
      "Cultivate a steady, friendly, open attention: nothing to achieve, nothing to fix, just this " +
      "breath, and then the next.",
  },
  {
    id: "sleep",
    label: "Sleep",
    tagline: "Drift off gently",
    art: DISC.sleep,
    intent:
      "A wind-down for bed. Slow, low, and unhurried, with quiet permission to let the day be " +
      "finished. Guide a gentle head-to-toe softening of the face, the jaw, the shoulders, the hands, " +
      "and the legs, letting each part grow heavy and give its weight to the bed, paired with long, " +
      "slow exhales. Reassure that there is nothing left to do and nowhere to be. It is completely " +
      "fine, even encouraged, to drift off before the end. Never energize, never instruct anything " +
      "effortful; let the words thin out and trail into quiet.",
  },
  {
    id: "flow",
    label: "Flow",
    tagline: "Focus and deep work",
    art: DISC.flow,
    intent:
      "A short primer before focused work or study. Briefly settle the body, then let the mental " +
      "clutter settle too, the swirl of to-dos sinking like sediment until the water is clear. Take a " +
      "couple of grounding breaths, name one clear intention for the work ahead, and prime a state " +
      "that is calm but alert, relaxed but sharp, with attention gathered to a single point. Close by " +
      "inviting the eyes to open, steady and ready to begin.",
  },
  {
    id: "relax",
    label: "Relax",
    tagline: "Unwind and soften",
    art: DISC.relax,
    intent:
      "A gentle decompression for a wound-up body and mind. In the simple spirit of 'breathing in, I " +
      "settle; breathing out, I ease,' guide slow breaths that loosen the jaw, drop the shoulders, and " +
      "unclench the hands. Invite an unhurried sense of arriving fully in the present, so that this " +
      "moment, right now, is enough, with nothing to chase. Warm, spacious, and kind; let the nervous " +
      "system down-shift into ease.",
  },
  {
    id: "stress-relief",
    label: "Stress Relief",
    tagline: "Reset and steady",
    art: DISC.stress,
    intent:
      "A steadying reset for an anxious, activated, or overwhelmed moment. Begin by grounding through " +
      "the senses, the feet on the floor, the seat beneath, a few sounds that can be heard, to come " +
      "out of the spinning head and back into the body. Lengthen the exhales to help the nervous " +
      "system settle. Then, gently, meet whatever is here instead of fighting it: quietly name the " +
      "feeling, allow it to be present, and turn toward it with a little curiosity and kindness rather " +
      "than resistance. Reassure, plainly and never clinically, that this feeling is temporary and " +
      "survivable, and that they have moved through hard moments before. End steadier than it began.",
  },
];

export function getContext(id: string): SessionContext | undefined {
  return CONTEXTS.find((c) => c.id === id);
}

// Duration presets offered in the UI. The generator itself handles any value in
// the 3 to 30 range via duration bands (below), so these are just convenient doses.
export const DURATIONS = [3, 5, 10, 20, 30] as const;
export type Duration = (typeof DURATIONS)[number];

export type VoiceChoice = "female" | "male";

// ---------------------------------------------------------------------------
// Expand / contract engine.
//
// We do NOT keep a separate script for every possible length. Instead every
// session shares one arc, and a small set of duration BANDS tells the writer how
// spacious to be. A script written for the low end of a band opens out naturally
// to the high end by lengthening silences and revisiting the same anchor more
// times, never by adding more words or new ideas.
// ---------------------------------------------------------------------------
export interface DurationBand {
  id: string;
  minMinutes: number;
  maxMinutes: number;
  // Pacing guidance handed to the writer for any duration inside this band.
  guidance: string;
}

export const DURATION_BANDS: DurationBand[] = [
  {
    id: "short",
    minMinutes: 3,
    maxMinutes: 4,
    guidance:
      "One clean pass through the arc. A brief welcome, settle onto a single anchor (the breath), " +
      "a small handful of returns to it, and a short close. Stillness in 2 to 3 second beats, " +
      "occasionally two in a row. Compact but never rushed.",
  },
  {
    id: "brief",
    minMinutes: 5,
    maxMinutes: 9,
    guidance:
      "The full arc, efficiently. Settle the body, establish the anchor, then return to it three or " +
      "four times with real silence between. Rest stretches of roughly 5 to 10 seconds (stack two or " +
      "three break tags). Unhurried.",
  },
  {
    id: "medium",
    minMinutes: 10,
    maxMinutes: 14,
    guidance:
      "Spacious and unhurried. Same few instructions, revisited five or six times, with generous " +
      "stillness. Rests equivalent to 10 to 20 seconds (several stacked break tags) are welcome. Let " +
      "each cue land fully before the next.",
  },
  {
    id: "long",
    minMinutes: 15,
    maxMinutes: 20,
    guidance:
      "Very spacious. Long stretches of silence, the equivalent of 20 to 40 seconds (many stacked " +
      "break tags) between cues. Return to the same simple anchor again and again; introduce no new " +
      "concepts to fill the time. The silence is the practice.",
  },
  {
    id: "deep",
    minMinutes: 21,
    maxMinutes: 30,
    guidance:
      "The most spacious of all. Extended, restful silences and the same handful of gentle cues " +
      "spread across the whole session, with nowhere to rush and nothing to add. Long, quiet gaps are " +
      "expected; the words are sparse islands in a lot of stillness.",
  },
];

export function getDurationBand(durationMin: number): DurationBand {
  const m = Math.round(durationMin);
  return (
    DURATION_BANDS.find((b) => m >= b.minMinutes && m <= b.maxMinutes) ??
    (m < DURATION_BANDS[0].minMinutes
      ? DURATION_BANDS[0]
      : DURATION_BANDS[DURATION_BANDS.length - 1])
  );
}

// System prompt for the script writer (Claude). The script is voiced by
// ElevenLabs, so it must be plain spoken words plus <break/> pause tags.
export const SCRIPT_SYSTEM_PROMPT = `You are the writer behind ElevenMind, a personalized mindfulness app for a broad, modern, largely secular US and Western audience. You write original guided mindfulness scripts that a warm, calm text-to-speech voice will read aloud. Each script is generated fresh for one specific person.

VOICE & LINEAGE
Draw on the best of the most trusted teachers in modern mindfulness: the plainspoken body-and-breath awareness of Jon Kabat-Zinn (MBSR), the warmth and self-compassion of Tara Brach, the steady friendliness of Sharon Salzberg, the grounded practicality of Jack Kornfield, and the gentle present-moment simplicity of Thich Nhat Hanh. Take their skill and humanity, NOT their vocabulary. This is their craft translated for someone who may be quietly skeptical of anything that sounds "spiritual."

STAY GROUNDED (secular guardrails, important)
- Plain, everyday language. Warm, human, unpretentious. Speak like a calm, trusted person, never a guru.
- NO metaphysical or new-age content: no chakras, third eye, energy, auras, vibrations, "the universe," manifesting, past lives, or cosmic anything. No religious framing.
- No Sanskrit or Pali or insider jargon (no "prana," "chi," "metta," "namaste," "om"). If you mean friendliness, or letting go, say it in ordinary words.
- Keep it concrete and physical: the breath, the weight of the body, contact with the chair or floor, sounds in the room, actual sensation. Concreteness is what makes this credible to this audience.
- Wellness, not treatment. No medical, diagnostic, or therapeutic claims, and never promise outcomes ("this will cure/fix..."). It is fine to reassure gently ("this feeling will pass").

THE ARC (the same shape at every length)
Every session moves through the same five movements; only the spaciousness changes with duration:
1. Arrive. Settle the body, a word of welcome, permission to be exactly as they are.
2. Anchor. A few grounding breaths; land attention in the body and the present moment.
3. Practice. The core of THIS session type (you are given its intent).
4. Deepen. Rest in it; widen the silences; let it work without more instruction.
5. Close. A soft return, appropriate to the session type.

LENGTH: EXPAND AND CONTRACT WITH SILENCE, NOT WITH WORDS
A real guided sit is mostly silence. You will be given a target length in minutes and pacing guidance for that length. Do NOT pad by talking more. Scale the session by:
- lengthening and multiplying the pauses (stack several break tags in a row for longer stillness),
- letting each instruction breathe fully before the next,
- returning to the SAME simple anchor more times as the session grows longer.
A shorter session is this arc compressed: fewer returns, briefer stillness. A longer session is the SAME arc opened out: the same few instructions, with much longer silence between them. As time grows, word count grows only a little; silence grows a lot. A longer session must never mean more concepts, only more space.

PACING TAGS & DELIVERY
- Insert pauses with ElevenLabs break tags exactly like this: <break time="2.5s" /> (maximum 3s per tag; place several in a row for longer stillness).
- Second person, present tense, unhurried. Short sentences. Plenty of breath.
- Greet the person warmly by name once, near the beginning. Use their name only once or twice more after that, at most.

OUTPUT
Output ONLY the spoken words plus <break> tags. No titles, headings, stage directions in brackets, markdown, or quotation marks around the whole thing. Do NOT use em dashes anywhere; use commas, periods, or the word "and" instead. Return the script and nothing else.`;

export function buildUserPrompt(opts: {
  name: string;
  context: SessionContext;
  durationMin: number;
}): string {
  const name = opts.name.trim() || "friend";
  const band = getDurationBand(opts.durationMin);
  return [
    `Name: ${name}`,
    `Session type: ${opts.context.label}`,
    `Intent: ${opts.context.intent}`,
    `Target length: ${opts.durationMin} minutes`,
    `Pacing for this length: ${band.guidance}`,
    ``,
    `Write the spoken mindfulness script now. Remember: fill the time mainly with silence and returns to the anchor, not with extra words.`,
  ].join("\n");
}
