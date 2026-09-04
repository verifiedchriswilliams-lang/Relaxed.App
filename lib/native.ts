// Platform bridges. Everything here is guarded so it's a safe no-op in a plain
// browser and only lights up where support exists: haptics inside the Capacitor
// iOS app; MediaSession lock-screen / Control Center controls in any browser that
// supports it (which the iOS WKWebView does). Nothing here is required for the app
// to work — it's premium polish that degrades silently.

function capacitor(): any {
  return typeof window !== "undefined" ? (window as any).Capacitor : undefined;
}

export type Haptic = "light" | "medium" | "heavy" | "success";

// A subtle taptic on the moments that matter (session begin, play/pause, close).
export function haptic(kind: Haptic = "light"): void {
  try {
    const H = capacitor()?.Plugins?.Haptics;
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
  duration: number;
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
      album: "relaxed",
      artwork: [
        { src: `${origin}/apple-icon`, sizes: "180x180", type: "image/png" },
        { src: `${origin}/icon`, sizes: "512x512", type: "image/png" },
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

export function setPlaybackState(playing: boolean, position: number, duration: number): void {
  const s = mediaSession();
  if (!s) return;
  try {
    s.playbackState = playing ? "playing" : "paused";
    if (typeof s.setPositionState === "function" && duration > 0) {
      s.setPositionState({
        duration,
        position: Math.min(Math.max(position, 0), duration),
        playbackRate: 1,
      });
    }
  } catch {
    /* position state is best-effort */
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
