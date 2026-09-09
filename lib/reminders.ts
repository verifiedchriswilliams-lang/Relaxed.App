// The daily practice reminder preference, stored on-device. The reminder itself
// is a local notification scheduled by the native app (see lib/native.ts). This
// module owns the small stored preference and the "apply it" orchestration, so
// the UI just reads/writes the preference and calls sync.
//
// No accounts, no server: the time lives in localStorage on the one device and
// the OS fires the notification. Everything degrades to a stored-but-inactive
// preference where notifications aren't available (the web, or a native build
// that predates the plugin), and activates on the next sync once they are.

import {
  requestNotificationPermission,
  scheduleDailyReminder,
  cancelDailyReminder,
} from "./native";

const REMINDER_KEY = "relaxed.reminder.v1";

export interface ReminderPref {
  enabled: boolean;
  hour: number; // 0..23 local
  minute: number; // 0..59
}

const DEFAULT: ReminderPref = { enabled: false, hour: 20, minute: 0 };

// A few gentle, on-brand notification bodies; one is chosen per schedule so the
// reminder doesn't read identically forever. No em dashes (user-facing copy).
const BODIES = [
  "A few quiet minutes for yourself. Ready when you are.",
  "Time to pause and breathe. Your session is a tap away.",
  "A little calm is waiting. Take a few minutes for you.",
];

export function loadReminder(): ReminderPref {
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    if (!raw) return { ...DEFAULT };
    const p = JSON.parse(raw) as Partial<ReminderPref>;
    return {
      enabled: !!p.enabled,
      hour: clampInt(p.hour, 0, 23, DEFAULT.hour),
      minute: clampInt(p.minute, 0, 59, DEFAULT.minute),
    };
  } catch {
    return { ...DEFAULT };
  }
}

function saveRaw(pref: ReminderPref): void {
  try {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(pref));
  } catch {
    /* best-effort */
  }
}

function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
}

// Persist the preference AND apply it to the OS schedule. Returns the effective
// preference: if the user asked to enable it but permission was denied (or
// notifications aren't available), `enabled` comes back false so the UI reflects
// reality rather than a reminder that will never fire.
export async function saveReminder(pref: ReminderPref): Promise<ReminderPref> {
  const effective = await applyReminder(pref);
  saveRaw(effective);
  return effective;
}

// Push the preference to the OS: schedule when enabled (requesting permission
// first), cancel when off. Does not persist (saveReminder does). Used on app
// open to re-sync the stored preference to the schedule.
export async function applyReminder(pref: ReminderPref): Promise<ReminderPref> {
  if (!pref.enabled) {
    await cancelDailyReminder();
    return { ...pref, enabled: false };
  }
  const granted = await requestNotificationPermission();
  if (!granted) return { ...pref, enabled: false };
  const body = BODIES[Math.floor(Math.random() * BODIES.length)];
  const ok = await scheduleDailyReminder(pref.hour, pref.minute, body);
  return { ...pref, enabled: ok };
}

// Re-sync the stored reminder to the OS schedule (call once on app open), so a
// reminder set on a device that couldn't schedule yet (e.g. before the native
// build shipped the plugin) starts firing once it can.
export async function syncReminder(): Promise<void> {
  const pref = loadReminder();
  if (!pref.enabled) return;
  await applyReminder(pref);
}
