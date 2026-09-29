// The premium voice roster: named ElevenLabs voices unlocked by the same $4.99
// entitlement as the premium beds and infinite sessions (see docs/monetization.md).
//
// Unlike the free voices (female/male x us/uk), each premium voice is a single
// named persona with its own ElevenLabs voice ID and a baked accent. They are NOT
// pre-cached: sessions using them stream live via the per-line TTS path, so they
// cost per-play at runtime and add ~0 Blob storage.
//
// Dependency-free so it's safe to import on the client (the voice IDs are public,
// not secrets; the API key stays server-side).

export type PremiumVoiceId =
  | "willow"
  | "natasha"
  | "mira"
  | "almee"
  | "alisa"
  | "kai"
  | "drew"
  | "brad"
  | "solomon"
  | "gavin";

export interface PremiumVoice {
  id: PremiumVoiceId;
  name: string;
  gender: "female" | "male";
  accent: string; // display label, e.g. "English", "American"
  voiceId: string; // ElevenLabs voice ID (the slug at the end of the voice URL)
  blurb: string; // short persona descriptor, like the free voices
  // The voice's OWN audition line, spoken in the tray preview clip. Each persona
  // gets a distinct line (not a shared "I'm {name}" template) so auditioning feels
  // like meeting different guides, not clones. Regenerate the clips after editing:
  // `node scripts/build-premium-voice-previews.mjs` (see the script header).
  preview: string;
}

export const PREMIUM_VOICES: PremiumVoice[] = [
  // Women
  { id: "willow", name: "Willow", gender: "female", accent: "English", voiceId: "82LXuLkvkwPWqokoMRFf", blurb: "airy & light", preview: "I'm Willow. Let's let the noise fall away, and begin as lightly as a breath." },
  { id: "natasha", name: "Natasha", gender: "female", accent: "American", voiceId: "Atp5cNFg1Wj5gyKD7HWV", blurb: "bright & clear", preview: "Hi, I'm Natasha. Nothing to figure out here. Take an easy breath, and let's start." },
  { id: "mira", name: "Mira", gender: "female", accent: "German", voiceId: "thNHFcPYszCz6ZPG6mUp", blurb: "cool & precise", preview: "I'm Mira. We'll take this one clear step at a time. Settle in." },
  { id: "almee", name: "Almee", gender: "female", accent: "English", voiceId: "zA6D7RyKdc2EClouEMkP", blurb: "soft & close", preview: "It's Almee. Come a little closer, soften your shoulders, and we'll ease in together." },
  { id: "alisa", name: "Alisa", gender: "female", accent: "Indian", voiceId: "J8Jo6V3F3HsRR4u13XbM", blurb: "warm & lilting", preview: "Hello, I'm Alisa. Wherever you are, let yourself arrive, and we'll begin, gently." },
  // Men
  { id: "kai", name: "Kai", gender: "male", accent: "Australian", voiceId: "3FP8zog6uhdEdir09I9N", blurb: "easy & open", preview: "Hey, I'm Kai. No rush at all. Whenever you're ready, we'll begin." },
  { id: "drew", name: "Drew", gender: "male", accent: "American", voiceId: "wgHvco1wiREKN0BdyVx5", blurb: "mellow & sure", preview: "I'm Drew. Let's take this slow and steady, and just settle in." },
  { id: "brad", name: "Brad", gender: "male", accent: "Australian", voiceId: "HZTk7bUIkiI7yT7FKH4h", blurb: "relaxed & sunny", preview: "I'm Brad. Let the day go for a bit. One easy breath, and we're on our way." },
  { id: "solomon", name: "Solomon", gender: "male", accent: "American", voiceId: "PTX7PgQRJRPEzGT9exN9", blurb: "deep & resonant", preview: "I'm Solomon. Let my voice carry you down into something calmer." },
  { id: "gavin", name: "Gavin", gender: "male", accent: "South African", voiceId: "zUbTLhK65qJM6Ic7eQj1", blurb: "smooth & grounded", preview: "I'm Gavin. Let's find a little stillness together, and start whenever you like." },
];

const BY_ID = new Map(PREMIUM_VOICES.map((v) => [v.id, v]));

export function isPremiumVoice(v: string | null | undefined): v is PremiumVoiceId {
  return !!v && BY_ID.has(v as PremiumVoiceId);
}

export function premiumVoice(id: string | null | undefined): PremiumVoice | undefined {
  return id ? BY_ID.get(id as PremiumVoiceId) : undefined;
}

export const PREMIUM_VOICES_FEMALE = PREMIUM_VOICES.filter((v) => v.gender === "female");
export const PREMIUM_VOICES_MALE = PREMIUM_VOICES.filter((v) => v.gender === "male");
