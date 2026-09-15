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
import { BRAND } from "./brand";

const REMINDER_KEY = "relaxed.reminder.v1";

// Mirrors PREFS_KEY in app/page.tsx — the on-device prefs blob that holds the
// saved name. Read here (best-effort) so the reminder body can greet by name.
const PREFS_KEY = "elevenmind.prefs.v1";

function savedName(): string {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return "";
    const p = JSON.parse(raw) as { name?: string };
    return (p?.name || "").trim();
  } catch {
    return "";
  }
}

// Brand-aware notification title: "relaxed" for relaxed, "ElevenMind" for
// ElevenMind. Never hardcode one brand's name into the other's notification.
const NOTIFY_TITLE = BRAND.id === "relaxed" ? BRAND.strong : BRAND.name;

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
  "Your daily calm is here. A few minutes is all it takes.",
  "Pause for a moment. A little stillness goes a long way.",
  "Come back to your breath. A short session is waiting.",
  "This is your window to slow down. Breathe, and begin.",
];

// Warmer variants that open with the user's name, used when one is saved. Kept
// short so they still read well on a lock screen. No em dashes.
const NAMED_BODIES = [
  (n: string) => `${n}, a little calm is waiting. Take a few minutes for you.`,
  (n: string) => `A few quiet minutes for you, ${n}. Ready when you are.`,
  (n: string) => `Time to pause and breathe, ${n}. Your session is a tap away.`,
  (n: string) => `${n}, your daily calm is here. A few minutes is all it takes.`,
];

// Pick a reminder body for this schedule: a name-aware line when a name is saved
// on-device, otherwise a name-free one. Chosen at schedule time, so it stays put
// until the reminder is next re-applied.
export function reminderBody(): string {
  const name = savedName();
  if (name) {
    const f = NAMED_BODIES[Math.floor(Math.random() * NAMED_BODIES.length)];
    return f(name);
  }
  return BODIES[Math.floor(Math.random() * BODIES.length)];
}

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
  const body = reminderBody();
  const ok = await scheduleDailyReminder(pref.hour, pref.minute, body, NOTIFY_TITLE);
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
