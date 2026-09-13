// On-device session history and post-session feedback. Everything here lives in
// localStorage on the one device — no accounts, no network, nothing personal
// leaves the phone. Fields are kept as plain strings so this stays decoupled
// from the player's own union types; the caller casts back on use. Every read
// and write is guarded so a private window or cleared storage is a safe no-op.

// One spoken line of a saved session: the exact words and the stillness after
// it. Persisted so a replay reproduces the same script (revoiced), never a
// freshly written one, this matters most for the bespoke path, where the words
// are generated live and would otherwise differ every time.
export interface SavedLine {
  text: string;
  pauseAfter: number;
}

export interface RecentSession {
  context: string; // ContextId
  label: string; // display line, e.g. "Sleep" or the custom phrase
  sub: string; // secondary line, e.g. "10 min · Ocean Waves"
  duration: number;
  voice: string; // VoiceChoice
  accent: string; // "us" | "uk"
  soundscape: string; // Soundscape id
  customText?: string;
  // The exact resolved script (words + pauses), captured once the session is
  // composed. Absent on sessions saved before this was recorded; the player
  // falls back to regenerating for those.
  script?: SavedLine[];
  at: number; // epoch ms of the most recent run
}

const RECENT_KEY = "relaxed.recent.v1";
const FAV_KEY = "relaxed.favs.v1";
const MOOD_KEY = "relaxed.moods.v1";
// One-time flag: whether the "recent/history" entry point has been introduced
// (it pulses with a tooltip the first time it appears, then never again).
const HINT_KEY = "relaxed.recentHint.v1";
// Recent is a rolling window — the last ten sessions, reverse-chronological.
// Anything older rolls off. Favorites are the escape hatch: a starred session
// is kept indefinitely and never rolls off, however long ago it ran.
const RECENT_MAX = 10;
const FAV_MAX = 100;

// Two sessions are "the same" if every choice that shapes them matches, so
// replaying keeps one entry that floats to the top rather than piling up, and a
// favorite can be matched back to the recent it was starred from.
export function sessionSig(r: RecentSession): string {
  return [r.context, r.duration, r.voice, r.accent, r.soundscape, r.customText ?? ""].join("|");
}

function readList(key: string): RecentSession[] {
  try {
    const raw = localStorage.getItem(key);
    const list = raw ? (JSON.parse(raw) as RecentSession[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function loadRecent(): RecentSession[] {
  return readList(RECENT_KEY);
}

export function loadFavs(): RecentSession[] {
  return readList(FAV_KEY);
}

// Record a session as it begins, most recent first, de-duplicated. Returns the
// new list so the caller can update state without a re-read.
export function pushRecent(s: RecentSession): RecentSession[] {
  const list = loadRecent().filter((r) => sessionSig(r) !== sessionSig(s));
  list.unshift(s);
  const capped = list.slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(capped));
  } catch {
    /* storage unavailable; the in-memory list is still returned */
  }
  return capped;
}

// Attach the resolved script to a session once it's composed. Matches by
// signature and updates the entry in both recent and favorites (a session may
// already be starred), so a later replay finds the exact words. Returns the new
// recent list so the caller can update state without a re-read.
export function updateRecentScript(
  s: RecentSession,
  script: SavedLine[]
): RecentSession[] {
  const k = sessionSig(s);
  const apply = (list: RecentSession[]) =>
    list.map((r) => (sessionSig(r) === k ? { ...r, script } : r));

  const recent = apply(loadRecent());
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch {
    /* best-effort */
  }
  // Mirror into favorites if this session is starred, so a saved replay is exact.
  const favs = loadFavs();
  if (favs.some((r) => sessionSig(r) === k)) {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(apply(favs)));
    } catch {
      /* best-effort */
    }
  }
  return recent;
}

// Whether a session is currently saved (present in the favorites list).
export function isFav(favs: RecentSession[], s: RecentSession): boolean {
  const k = sessionSig(s);
  return favs.some((f) => sessionSig(f) === k);
}

// Star / unstar a session. If it's already saved it's removed; otherwise it's
// added to the front (most-recently-saved first) and kept indefinitely. Returns
// the new favorites list so the caller can update state without a re-read.
export function toggleFav(s: RecentSession): RecentSession[] {
  const k = sessionSig(s);
  const existing = loadFavs();
  const without = existing.filter((f) => sessionSig(f) !== k);
  const next = without.length === existing.length ? [s, ...without].slice(0, FAV_MAX) : without;
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  } catch {
    /* best-effort */
  }
  return next;
}

// Delete a single session from recent or from saved (swipe-to-delete). Returns
// the new list so the caller can update state without a re-read.
export function removeRecent(s: RecentSession): RecentSession[] {
  const k = sessionSig(s);
  const next = loadRecent().filter((r) => sessionSig(r) !== k);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* best-effort */
  }
  return next;
}

export function removeFav(s: RecentSession): RecentSession[] {
  const k = sessionSig(s);
  const next = loadFavs().filter((r) => sessionSig(r) !== k);
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  } catch {
    /* best-effort */
  }
  return next;
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

// Whether the recent/history entry point has already been introduced to this
// device. Used to pulse it (with a tooltip) exactly once, the first time it
// appears after a session.
export function recentHintSeen(): boolean {
  try {
    return !!localStorage.getItem(HINT_KEY);
  } catch {
    return true; // if storage is unavailable, don't nag
  }
}

export function markRecentHintSeen(): void {
  try {
    localStorage.setItem(HINT_KEY, "1");
  } catch {
    /* best-effort */
  }
}
