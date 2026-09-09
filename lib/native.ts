// Platform bridges. Everything here is guarded so it's a safe no-op in a plain
// browser and only lights up where support exists: haptics inside the Capacitor
// iOS app; MediaSession lock-screen / Control Center controls in any browser that
// supports it (which the iOS WKWebView does). Nothing here is required for the app
// to work — it's premium polish that degrades silently.

function capacitor(): any {
  return typeof window !== "undefined" ? (window as any).Capacitor : undefined;
}

// Resolve the native Haptics plugin. Because this web bundle deliberately does
// NOT import @capacitor/haptics (it's shared with the non-native ElevenMind
// build), the plugin proxy isn't auto-registered on the JS side. On the remote
// page loaded by the iOS shell we therefore ask the injected bridge for it:
// Capacitor.Plugins.Haptics if the bridge already exposes it, otherwise
// registerPlugin("Haptics") which returns a proxy that forwards to the natively
// registered plugin. Returns undefined in a plain browser (no bridge).
function hapticsPlugin(): any {
  const cap = capacitor();
  if (!cap) return undefined;
  if (cap.Plugins && cap.Plugins.Haptics) return cap.Plugins.Haptics;
  if (typeof cap.registerPlugin === "function") {
    try {
      return cap.registerPlugin("Haptics");
    } catch {
      /* bridge present but registration unsupported */
    }
  }
  return undefined;
}

export type Haptic = "light" | "medium" | "heavy" | "success";

// A subtle taptic on the moments that matter (session begin, play/pause, close).
export function haptic(kind: Haptic = "light"): void {
  try {
    const H = hapticsPlugin();
    if (H) {
      if (kind === "success") H.notification({ type: "SUCCESS" });
      else H.impact({ style: kind.toUpperCase() });
      return;
    }
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(kind === "heavy" ? 16 : kind === "medium" ? 11 : 7);
    }
  } catch {
    /* haptics are best-effort */
  }
}

function mediaSession(): any {
  return typeof navigator !== "undefined" ? (navigator as any).mediaSession : undefined;
}

interface NowPlaying {
  title: string;
  artist: string;
  album?: string;
  category?: string; // soundscape category → picks the lock-screen artwork emblem
  onPlay: () => void;
  onPause: () => void;
  onStop?: () => void;
}

// Populate the lock-screen / Control Center card: title, the "r" artwork, and
// working play/pause/stop. A meditation isn't scrubbable, so seek/track controls
// are cleared so the OS doesn't offer them.
export function setNowPlaying(np: NowPlaying): void {
  const s = mediaSession();
  if (!s || typeof window === "undefined" || !(window as any).MediaMetadata) return;
  try {
    const origin = typeof location !== "undefined" ? location.origin : "";
    s.metadata = new (window as any).MediaMetadata({
      title: np.title,
      artist: np.artist,
      album: np.album ?? np.artist,
      artwork: [
        // Full-bleed square (no rounded/transparent corners) so iOS's own
        // rounded frame reads clean and the blurred card background stays dark.
        // ?c=<category> picks a soundscape-specific emblem.
        {
          src: `${origin}/artwork${np.category ? `?c=${encodeURIComponent(np.category)}` : ""}`,
          sizes: "512x512",
          type: "image/png",
        },
      ],
    });
    s.setActionHandler("play", () => np.onPlay());
    s.setActionHandler("pause", () => np.onPause());
    s.setActionHandler("stop", () => np.onStop?.());
    for (const a of ["seekbackward", "seekforward", "seekto", "previoustrack", "nexttrack"]) {
      try {
        s.setActionHandler(a, null);
      } catch {
        /* not all actions exist everywhere */
      }
    }
  } catch {
    /* MediaSession is best-effort */
  }
}

export function setPlaybackState(playing: boolean): void {
  const s = mediaSession();
  if (!s) return;
  try {
    s.playbackState = playing ? "playing" : "paused";
    // No progress bar: the in-app timer is a per-second counter that iOS freezes
    // while the phone is locked, so a MediaSession scrubber fed from it desyncs
    // and snaps back on resume. A meditation isn't scrubbable anyway, so we show a
    // clean play/pause card with no (misleading) progress bar. Clear any prior one.
    if (typeof s.setPositionState === "function") s.setPositionState();
  } catch {
    /* playback state is best-effort */
  }
}

export function clearNowPlaying(): void {
  const s = mediaSession();
  if (!s) return;
  try {
    s.metadata = null;
    s.playbackState = "none";
    for (const a of ["play", "pause", "stop"]) {
      try {
        s.setActionHandler(a, null);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Local notifications: the daily practice reminder. The reminder is scheduled
// on-device (no server, no accounts) via @capacitor/local-notifications, which
// is compiled into the native app. As with haptics, the web bundle does not
// import the plugin (it's shared with the non-native build); we resolve it at
// runtime through the injected bridge, so everything here is a safe no-op in a
// plain browser or in a native build that predates the plugin.
// ---------------------------------------------------------------------------

// Whether the native Capacitor bridge is present (i.e. we're inside the app).
export function isNativeApp(): boolean {
  const cap = capacitor();
  return !!(cap && (typeof cap.isNativePlatform === "function" ? cap.isNativePlatform() : cap.isNative));
}

function localNotifications(): any {
  const cap = capacitor();
  if (!cap) return undefined;
  if (cap.Plugins && cap.Plugins.LocalNotifications) return cap.Plugins.LocalNotifications;
  if (typeof cap.registerPlugin === "function") {
    try {
      return cap.registerPlugin("LocalNotifications");
    } catch {
      /* bridge present but registration unsupported */
    }
  }
  return undefined;
}

// Stable id for the single daily reminder, so scheduling replaces (not stacks)
// and cancel is unambiguous.
const REMINDER_ID = 4242;

// Ask for notification permission. Returns true only if granted. No-op → false
// where the plugin isn't present (web, or a native build without it yet).
export async function requestNotificationPermission(): Promise<boolean> {
  const LN = localNotifications();
  if (!LN) return false;
  try {
    const res = await LN.requestPermissions();
    return res?.display === "granted";
  } catch {
    return false;
  }
}

// Schedule (or reschedule) the daily reminder at the given local time. Returns
// whether it was actually scheduled. Safe no-op without the plugin.
export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  body: string,
  title = "relaxed"
): Promise<boolean> {
  const LN = localNotifications();
  if (!LN) return false;
  try {
    await LN.cancel({ notifications: [{ id: REMINDER_ID }] }).catch(() => {});
    await LN.schedule({
      notifications: [
        {
          id: REMINDER_ID,
          title,
          body,
          // Fire every day at the chosen local hour:minute. allowWhileIdle lets
          // it deliver even under low-power conditions.
          schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

// Cancel the daily reminder. Safe no-op without the plugin.
export async function cancelDailyReminder(): Promise<void> {
  const LN = localNotifications();
  if (!LN) return;
  try {
    await LN.cancel({ notifications: [{ id: REMINDER_ID }] });
  } catch {
    /* best-effort */
  }
}
