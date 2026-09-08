// Small pure formatters shared by the player and history screens. No React or
// browser dependencies (they only read the clock), so they are unit-testable.

// Compact "time ago" for history rows: "now", "5m", "3h", "2d", "1w", "4mo".
export function timeAgo(at: number): string {
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 45) return "now";
  const m = s / 60;
  if (m < 60) return `${Math.round(m)}m`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h`;
  const d = h / 24;
  if (d < 7) return `${Math.round(d)}d`;
  const w = d / 7;
  if (w < 5) return `${Math.round(w)}w`;
  return `${Math.round(d / 30)}mo`;
}

// Time-of-day greeting for the home header.
export function greetingFor(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// Seconds to m:ss for the player timer.
export function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Split a script into transcript lines, converting em dashes to commas so the
// on-screen read-along honors the brand's no-em-dash rule.
export function transcriptLines(s: string): string[] {
  if (!s) return [];
  return s.split("\n").map((l) => l.replace(/\s*—\s*/g, ", ").trim());
}
