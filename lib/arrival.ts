// The instant-start "arrival": the short spoken open played immediately for a
// custom session while Claude writes the body. It must not contradict the
// person's stated activity — telling someone on a walk or a drive to "sit down
// and close your eyes" breaks the whole promise of a session made for exactly
// what they asked for. So the arrival, AND a directive handed to the body writer
// (the custom-script route), adapt to a coarse posture read of the typed phrase.
//
// Pure logic + data, shared by the client (the spoken arrival) and the API route
// (the body prompt) so they always agree; unit-tested directly.

export type Posture = "still" | "moving" | "driving";

// Eyes must stay on the road: the strictest mode, checked first.
const DRIVING =
  /\b(driv(?:e|es|ing)|drove|commut(?:e|es|ing)|behind the wheel|in the car|on the (?:road|highway|freeway|motorway)|road ?trip)\b/i;
// Moving on foot or working the body: eyes open, body in motion.
const MOVING =
  /\b(walk(?:ing|s)?|stroll(?:ing)?|hik(?:e|es|ing)|run(?:ning|s)?|jog(?:ging|s)?|pac(?:e|ing)|treadmill|elliptical|cycl(?:e|es|ing)|bik(?:e|es|ing)|row(?:ing)?|exercis(?:e|es|ing)|work(?:ing)? ?out|workout|gym|lift(?:ing|s)?|weights|stretch(?:ing|es)?|yoga|danc(?:e|es|ing)|cardio)\b/i;

// A coarse posture read of the typed phrase. Driving wins over moving (it is the
// strictest for safety); anything else is the seated default.
export function detectPosture(phrase: string | null | undefined): Posture {
  const p = (phrase || "").toLowerCase();
  if (!p.trim()) return "still";
  if (DRIVING.test(p)) return "driving";
  if (MOVING.test(p)) return "moving";
  return "still";
}

// The three spoken arrival lines. The greeting and the first breath are
// posture-neutral; only the middle "settle" line adapts, so a walker or a driver
// is never told to sit and close their eyes.
export function arrivalLines(
  name: string,
  posture: Posture
): { text: string; pauseAfter: number }[] {
  const who = name.trim();
  const settle =
    posture === "driving"
      ? "Keep your eyes on the road and your hands easy on the wheel, and let your shoulders drop."
      : posture === "moving"
        ? "Let your body keep its own easy pace, and let your gaze soften a little."
        : "Settle into a position you can rest in, and when you feel ready, let your eyes close.";
  return [
    { text: who ? `Let's begin, ${who}.` : "Let's begin.", pauseAfter: 2.4 },
    { text: settle, pauseAfter: 3.2 },
    { text: "Take a slow breath in. And gently let it go.", pauseAfter: 4 },
  ];
}

// A directive handed to the body writer so the rest of the session honors the
// activity too, not just the arrival. Empty for the seated default (the system
// prompt already assumes a still, eyes-closed sit).
export function postureDirective(posture: Posture): string {
  if (posture === "driving") {
    return "POSTURE: the person is driving. Their eyes MUST stay on the road and their attention safe. Do NOT ask them to close their eyes, sit still, lie down, or anything that reduces awareness of driving. Ground it in what is safe while driving: the breath, the hands resting on the wheel, the shoulders softening, the road ahead. Keep them alert and calm, never drowsy. Do not mention a chair or the floor.";
  }
  if (posture === "moving") {
    return "POSTURE: the person is walking or moving as they listen. Do NOT ask them to sit, lie down, close their eyes, or be still. Ground the session in the movement itself: the rhythm of their steps, the breath, the body in motion, the ground underfoot and the air around them. Keep their eyes open. Do not mention a chair or the floor as a place to settle.";
  }
  return "";
}
