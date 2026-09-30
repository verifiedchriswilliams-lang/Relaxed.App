// Phone <-> Apple Watch remote bridge (1.4.1).
//
// Lets the watch mirror and control a session that's playing on the phone: the
// phone pushes a small state snapshot (what's playing, time left, playing/paused)
// and receives play/pause/stop commands back from the wrist. Both directions ride
// a native Capacitor plugin, "WatchBridge", that speaks WatchConnectivity.
//
// Like haptics and local notifications (see lib/native.ts), the web bundle does
// NOT import the plugin, so everything here is a guarded no-op unless the injected
// native bridge exposes WatchBridge. On the web, on the ElevenMind build, and on
// any app build that predates the plugin, these functions do nothing and never
// throw. The feature simply lights up once an app build compiles the plugin in.

function capacitor(): any {
  return typeof window !== "undefined" ? (window as any).Capacitor : undefined;
}

// Resolve the native WatchBridge plugin through the injected bridge, mirroring the
// resolution used for Haptics/LocalNotifications. Returns undefined without it.
function watchBridge(): any {
  const cap = capacitor();
  if (!cap) return undefined;
  if (cap.Plugins && cap.Plugins.WatchBridge) return cap.Plugins.WatchBridge;
  if (typeof cap.registerPlugin === "function") {
    try {
      return cap.registerPlugin("WatchBridge");
    } catch {
      /* bridge present but registration unsupported */
    }
  }
  return undefined;
}

// Whether the watch bridge is available at all (i.e. a native build compiled the
// plugin in). False on the web and on older native builds.
export function watchAvailable(): boolean {
  return !!watchBridge();
}

// The snapshot the phone sends to the watch. Kept intentionally tiny: the watch
// runs its own breath clock locally while `playing` is true, so we never stream
// per-frame breathing over the link, just the facts that change about once a
// second at most.
export interface WatchState {
  active: boolean; // is a phone session on the player right now
  playing: boolean; // playing vs paused
  title: string; // session label ("Your session" or the preset name)
  soundscape: string; // soundscape label
  remaining: number; // whole seconds left
  total: number; // whole seconds in the session
}

// Dedupe identical snapshots so we don't spend WatchConnectivity bandwidth (and
// wake the watch) on no-ops. `remaining` changes ~once a second, which is the
// natural cadence for the mirrored countdown.
let lastSent = "";

function keyOf(s: WatchState): string {
  return `${s.active ? 1 : 0}|${s.playing ? 1 : 0}|${s.title}|${s.soundscape}|${s.remaining}|${s.total}`;
}

// Push the current playback state to the watch. Safe no-op without the plugin.
export function pushWatchState(state: WatchState): void {
  const wb = watchBridge();
  if (!wb) return;
  try {
    const key = keyOf(state);
    if (key === lastSent) return;
    lastSent = key;
    wb.updateState(state);
  } catch {
    /* best-effort */
  }
}

// Tell the watch no session is active (leaving the player, or it ended), so it
// drops back to its standalone breathing pacer. Safe no-op without the plugin.
export function clearWatchState(): void {
  const wb = watchBridge();
  if (!wb) return;
  try {
    lastSent = "";
    wb.updateState({
      active: false,
      playing: false,
      title: "",
      soundscape: "",
      remaining: 0,
      total: 0,
    });
  } catch {
    /* best-effort */
  }
}

export type WatchCommand = "play" | "pause" | "stop";

// Subscribe to commands the watch sends (the wrist's play/pause/stop). Returns an
// unsubscribe function. Safe no-op (returns a no-op unsubscriber) without the
// plugin. The handler should route to the same play/pause/stop the lock-screen
// controls use, so the wrist and the lock screen stay in lockstep.
export function onWatchCommand(handler: (cmd: WatchCommand) => void): () => void {
  const wb = watchBridge();
  if (!wb || typeof wb.addListener !== "function") return () => {};
  let handle: any;
  try {
    handle = wb.addListener("command", (data: any) => {
      const a = data?.action;
      if (a === "play" || a === "pause" || a === "stop") handler(a);
    });
  } catch {
    return () => {};
  }
  // Capacitor's addListener may return a handle object with remove(), or a
  // promise resolving to one; support both.
  return () => {
    try {
      if (handle && typeof handle.remove === "function") handle.remove();
      else if (handle && typeof handle.then === "function") handle.then((h: any) => h?.remove?.());
    } catch {
      /* best-effort */
    }
  };
}

// Test seam: reset the dedupe cache between cases.
export function _resetForTests(): void {
  lastSent = "";
}
