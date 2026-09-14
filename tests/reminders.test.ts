import { describe, it, expect, beforeEach } from "vitest";
import { loadReminder, saveReminder } from "@/lib/reminders";

// In the node test env there is no Capacitor bridge, so notifications are
// "unavailable" — the same situation as the web. The regression this guards:
// enabling a reminder must keep the user's intent (enabled:true) and persist it,
// never silently flip back to false (which read as a dead toggle in the UI).
beforeEach(() => localStorage.clear());

describe("saveReminder", () => {
  it("keeps enabled=true and persists it even when nothing can be scheduled", async () => {
    const res = await saveReminder({ enabled: true, hour: 7, minute: 30 });
    expect(res.pref.enabled).toBe(true); // intent kept — the toggle isn't dead
    expect(res.scheduled).toBe(false); // nothing is scheduled without the plugin
    expect(res.blocked).toBe(false); // web/no-plugin is "deferred", not blocked
    // persisted, so it activates on the next in-app sync
    expect(loadReminder()).toEqual({ enabled: true, hour: 7, minute: 30 });
  });

  it("persists a disabled reminder", async () => {
    await saveReminder({ enabled: true, hour: 7, minute: 30 });
    const res = await saveReminder({ enabled: false, hour: 7, minute: 30 });
    expect(res.pref.enabled).toBe(false);
    expect(loadReminder().enabled).toBe(false);
  });

  it("round-trips and clamps the time", async () => {
    await saveReminder({ enabled: true, hour: 9, minute: 5 });
    expect(loadReminder()).toEqual({ enabled: true, hour: 9, minute: 5 });
    // out-of-range values clamp back to a sane default on load
    await saveReminder({ enabled: true, hour: 99, minute: -1 });
    const r = loadReminder();
    expect(r.hour).toBeGreaterThanOrEqual(0);
    expect(r.hour).toBeLessThanOrEqual(23);
    expect(r.minute).toBeGreaterThanOrEqual(0);
    expect(r.minute).toBeLessThanOrEqual(59);
  });
});
