// On-device session history and post-session feedback. Everything here lives in
// localStorage on the one device — no accounts, no network, nothing personal
// leaves the phone. Fields are kept as plain strings so this stays decoupled
// from the player's own union types; the caller casts back on use. Every read
// and write is guarded so a private window or cleared storage is a safe no-op.

export interface RecentSession {
  context: string; // ContextId
  label: string; // display line, e.g. "Sleep" or the custom phrase
  sub: string; // secondary line, e.g. "10 min · Ocean Waves"
  duration: number;
  voice: string; // VoiceChoice
  accent: string; // "us" | "uk"
  soundscape: string; // Soundscape id
  customText?: string;
  at: number; // epoch ms of the most recent run
}

const RECENT_KEY = "relaxed.recent.v1";
const MOOD_KEY = "relaxed.moods.v1";
const RECENT_MAX = 3;

// Two sessions are "the same" if every choice that shapes them matches, so
// replaying keeps one entry that floats to the top rather than piling up.
function sig(r: RecentSession): string {
  return [r.context, r.duration, r.voice, r.accent, r.soundscape, r.customText ?? ""].join("|");
}

export function loadRecent(): RecentSession[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as RecentSession[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Record a session as it begins, most recent first, de-duplicated. Returns the
// new list so the caller can update state without a re-read.
export function pushRecent(s: RecentSession): RecentSession[] {
  const list = loadRecent().filter((r) => sig(r) !== sig(s));
  list.unshift(s);
  const capped = list.slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(capped));
  } catch {
    /* storage unavailable; the in-memory list is still returned */
  }
  return capped;
}

export interface MoodEntry {
  mood: string; // e.g. "calmer"
  context: string;
  custom: boolean;
  at: number;
}

// A one-tap reflection after a session. Kept as a short rolling log on-device;
// useful later for a gentle "you tend to feel calmer after Sleep" without ever
// needing an account. Analytics (anonymous, separate) can also observe it.
export function recordMood(m: Omit<MoodEntry, "at">): void {
  try {
    const raw = localStorage.getItem(MOOD_KEY);
    const list = raw ? (JSON.parse(raw) as MoodEntry[]) : [];
    list.push({ ...m, at: Date.now() });
    localStorage.setItem(MOOD_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    /* best-effort */
  }
}
