// Shared ElevenLabs voice helpers (server-only). Used by the per-line TTS
// endpoint that powers the Custom session's streaming playback. Kept in step
// with app/api/generate/route.ts and the build scripts.

export type Gender = "female" | "male";
export type Accent = "us" | "uk";

// Keys pasted into a dashboard can pick up invisible characters that break HTTP
// header encoding. Real keys/ids are printable ASCII only.
export function cleanKey(raw: string | undefined): string | undefined {
  const cleaned = raw?.replace(/[^\x21-\x7E]/g, "");
  return cleaned || undefined;
}

const VOICE_TABLE: Record<string, { envs: string[]; def: string }> = {
  "female-uk": {
    envs: ["ELEVENLABS_VOICE_FEMALE_UK", "ELEVENLABS_VOICE_FEMALE"],
    def: "bgU7lBMo69PNEOWHFqxM",
  },
  "male-uk": {
    envs: ["ELEVENLABS_VOICE_MALE_UK", "ELEVENLABS_VOICE_MALE"],
    def: "UmQN7jS1Ee8B1czsUtQh",
  },
  "female-us": { envs: ["ELEVENLABS_VOICE_FEMALE_US"], def: "7AvtJrjTNyBhBxEvNPIZ" },
  "male-us": { envs: ["ELEVENLABS_VOICE_MALE_US"], def: "6bPfTtSpgxgD0GeBVfqu" },
};

function isVoiceId(v: string | undefined): v is string {
  return !!v && !v.startsWith("sk_") && v.length <= 40;
}

export function resolveVoiceId(gender: Gender, accent: Accent): string {
  const row = VOICE_TABLE[`${gender}-${accent}`] ?? VOICE_TABLE[`${gender}-uk`];
  for (const name of row.envs) {
    const v = cleanKey(process.env[name]);
    if (isVoiceId(v)) return v;
  }
  return row.def;
}

export interface VoiceConfig {
  key: string;
  voiceId: string;
  speed: number;
  stability: number;
}

export function voiceConfig(voice: Gender, accent: Accent): VoiceConfig | null {
  const key = cleanKey(process.env.ELEVENLABS_API_KEY);
  if (!key) return null;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    key,
    voiceId: resolveVoiceId(voice, accent),
    speed: clamp(Number(process.env.ELEVENLABS_SPEED ?? 1.0) || 1.0, 0.7, 1.2),
    stability: clamp(Number(process.env.ELEVENLABS_STABILITY ?? 0.85) || 0.85, 0, 1),
  };
}

// Synthesize one line and return the raw MP3 bytes.
export async function synthesizeBytes(
  text: string,
  cfg: VoiceConfig,
  format = "mp3_44100_128"
): Promise<Buffer> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${cfg.voiceId}?output_format=${format}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": cfg.key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: cfg.stability,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
          speed: cfg.speed,
        },
      }),
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs error ${res.status}: ${detail.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
