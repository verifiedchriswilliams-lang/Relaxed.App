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
  checkNotificationPermission,
  scheduleDailyReminder,
  cancelDailyReminder,
  notificationsAvailable,
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

// The outcome of applying a reminder preference. `pref` is what to persist and
// show — its `enabled` follows the user's intent and is never silently flipped
// off — and the flags describe what actually happened so the UI can be honest.
export interface ReminderApply {
  pref: ReminderPref;
  scheduled: boolean; // an OS notification is actually scheduled
  blocked: boolean; // plugin present but permission not granted (fix in Settings)
}

// Persist the preference AND try to apply it to the OS schedule. `prompt` shows
// the system permission dialog (true when the user toggles it on; false for the
// silent on-open re-sync). Enabling always persists the intent, so a reminder set
// on the web — or before permission is granted — is not lost and activates on the
// next sync.
export async function saveReminder(
  pref: ReminderPref,
  prompt = true
): Promise<ReminderApply> {
  const res = await applyReminder(pref, prompt);
  saveRaw(res.pref);
  return res;
}

// Push the preference to the OS: schedule when enabled, cancel when off. Does not
// persist (saveReminder does). Keeps the user's intent even when it can't schedule
// yet (web, or notifications not allowed), so nothing is silently dropped.
export async function applyReminder(
  pref: ReminderPref,
  prompt = false
): Promise<ReminderApply> {
  if (!pref.enabled) {
    await cancelDailyReminder();
    return { pref: { ...pref, enabled: false }, scheduled: false, blocked: false };
  }
  // Enabling — keep the intent regardless of whether we can schedule right now.
  const intent: ReminderPref = { ...pref, enabled: true };
  if (!notificationsAvailable()) {
    // Web, or a native build without the plugin: store the intent; it schedules
    // on the next sync once notifications exist in the app.
    return { pref: intent, scheduled: false, blocked: false };
  }
  const granted = prompt
    ? await requestNotificationPermission()
    : await checkNotificationPermission();
  if (!granted) {
    // Plugin present but not allowed — keep the intent, flag it for the UI.
    return { pref: intent, scheduled: false, blocked: true };
  }
  const body = BODIES[Math.floor(Math.random() * BODIES.length)];
  const ok = await scheduleDailyReminder(pref.hour, pref.minute, body);
  return { pref: intent, scheduled: ok, blocked: !ok };
}

// Re-sync the stored reminder to the OS schedule (call once on app open), so a
// reminder set where it couldn't schedule yet (the web, or before the native
// build shipped the plugin) starts firing once it can. Silent: never prompts for
// permission on launch.
export async function syncReminder(): Promise<void> {
  const pref = loadReminder();
  if (!pref.enabled) return;
  await applyReminder(pref, false);
}
