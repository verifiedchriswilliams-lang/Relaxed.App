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
}

export const PREMIUM_VOICES: PremiumVoice[] = [
  // Women
  { id: "willow", name: "Willow", gender: "female", accent: "English", voiceId: "82LXuLkvkwPWqokoMRFf", blurb: "airy & light" },
  { id: "natasha", name: "Natasha", gender: "female", accent: "American", voiceId: "Atp5cNFg1Wj5gyKD7HWV", blurb: "bright & clear" },
  { id: "mira", name: "Mira", gender: "female", accent: "German", voiceId: "thNHFcPYszCz6ZPG6mUp", blurb: "cool & precise" },
  { id: "almee", name: "Almee", gender: "female", accent: "English", voiceId: "zA6D7RyKdc2EClouEMkP", blurb: "soft & close" },
  { id: "alisa", name: "Alisa", gender: "female", accent: "Indian", voiceId: "J8Jo6V3F3HsRR4u13XbM", blurb: "warm & lilting" },
  // Men
  { id: "kai", name: "Kai", gender: "male", accent: "Australian", voiceId: "3FP8zog6uhdEdir09I9N", blurb: "easy & open" },
  { id: "drew", name: "Drew", gender: "male", accent: "American", voiceId: "wgHvco1wiREKN0BdyVx5", blurb: "mellow & sure" },
  { id: "brad", name: "Brad", gender: "male", accent: "Australian", voiceId: "HZTk7bUIkiI7yT7FKH4h", blurb: "relaxed & sunny" },
  { id: "solomon", name: "Solomon", gender: "male", accent: "American", voiceId: "PTX7PgQRJRPEzGT9exN9", blurb: "deep & resonant" },
  { id: "gavin", name: "Gavin", gender: "male", accent: "South African", voiceId: "zUbTLhK65qJM6Ic7eQj1", blurb: "smooth & grounded" },
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
