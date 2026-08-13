// The five core session types. Each one just reshapes the tone + arc of the
// meditation script — the generation pipeline underneath is identical.

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
  // Guidance handed to the script writer for this context.
  intent: string;
}

export const CONTEXTS: SessionContext[] = [
  {
    id: "meditation",
    label: "Meditation",
    tagline: "Presence and awareness",
    intent:
      "A classic mindfulness sit. Anchor attention on the breath and body, " +
      "gently returning whenever the mind wanders. Cultivate open, non-judgmental awareness.",
  },
  {
    id: "sleep",
    label: "Sleep",
    tagline: "Drift off gently",
    intent:
      "A wind-down for bedtime. Slow, low, unhurried. Progressive relaxation and " +
      "long exhales that let the body grow heavy. It is fine — encouraged — to trail " +
      "off into sleep before the end. Never energize or instruct anything effortful.",
  },
  {
    id: "flow",
    label: "Flow",
    tagline: "Focus and deep work",
    intent:
      "A short primer before focused work or study. Clear mental clutter, set a single " +
      "intention, and prime a calm, alert, one-pointed state. End by opening the eyes, ready.",
  },
  {
    id: "relax",
    label: "Relax",
    tagline: "Unwind and soften",
    intent:
      "A gentle decompression. Release tension held in the body, soften the jaw and " +
      "shoulders, and let the nervous system down-shift into ease. Warm and spacious.",
  },
  {
    id: "stress-relief",
    label: "Stress Relief",
    tagline: "Reset and steady",
    intent:
      "A steadying reset for an activated, anxious, or overwhelmed moment. Longer exhales " +
      "to calm the nervous system, grounding through the senses, and a reminder that this " +
      "feeling is temporary and survivable. Reassuring, never clinical.",
  },
];

export function getContext(id: string): SessionContext | undefined {
  return CONTEXTS.find((c) => c.id === id);
}

export const DURATIONS = [3, 5, 10, 20] as const;
export type Duration = (typeof DURATIONS)[number];

export type VoiceChoice = "female" | "male";

// System prompt for the script writer (Claude). The script is voiced by
// ElevenLabs, so it must be plain spoken words plus <break/> pause tags.
export const SCRIPT_SYSTEM_PROMPT = `You are the writer behind a personalized mindfulness app. You write guided meditation scripts that will be read aloud by a calm, warm text-to-speech voice.

Hard rules for the output:
- Output ONLY the words to be spoken. No headings, no stage directions in brackets, no markdown, no titles, no quotation marks around the whole thing.
- Insert pauses using ElevenLabs break tags exactly like this: <break time="2.5s" /> — a real guided meditation lives in its silences, so use them generously between phrases and especially between instructions. Maximum single break is 3 seconds; place several in a row for longer stillness.
- Write in second person, present tense, unhurried. Short sentences. Plenty of breath.
- Open by warmly greeting the person by their name, once, near the beginning. Do not overuse their name after that — once or twice more at most.
- Do NOT make medical, diagnostic, or therapeutic claims. This is a wellness experience, not treatment. Avoid promising outcomes ("this will cure...").
- Match the spoken length to the requested duration. A rough guide: about 110-130 spoken words per minute INCLUDING that most of the time is silence, so a longer session is mostly breaks, not more words.
- End softly and appropriately for the context (for sleep, trail off; for flow, invite the eyes open and readiness).

You will be given the person's name, the session type and its intent, and the duration. Return the script and nothing else.`;

export function buildUserPrompt(opts: {
  name: string;
  context: SessionContext;
  durationMin: number;
}): string {
  const name = opts.name.trim() || "friend";
  return [
    `Name: ${name}`,
    `Session type: ${opts.context.label}`,
    `Intent: ${opts.context.intent}`,
    `Duration: ${opts.durationMin} minutes`,
    ``,
    `Write the spoken meditation script now.`,
  ].join("\n");
}
