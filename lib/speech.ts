// Voice input for the voiced onboarding (Phase 2): one spoken utterance -> a transcript.
//
// Prefers the on-device native plugin (the iOS Speech framework, "SpeechInput") so
// nothing leaves the device in the native app, matching relaxed's no-backend stance.
// Falls back to the browser's Web Speech API where available (e.g. desktop Chrome) so
// the flow is testable on the web. On iOS Safari, a native build without the plugin, or
// anywhere with neither, it reports unavailable and the UI keeps the typed path.
//
// Everything here is guarded: detection and listening never throw, and a failure just
// yields "" so the caller falls back to typing.

interface SpeechPlugin {
  listen: (opts: { locale?: string }) => Promise<{ transcript?: string; value?: string }>;
}

function capacitor(): any {
  return typeof window !== "undefined" ? (window as any).Capacitor : undefined;
}

// Reliable presence check for the native plugin (mirrors the Premium detection): only
// true when the plugin is actually registered, so the mic never shows as a dead button
// on a build that doesn't include it.
function nativeSpeechAvailable(): boolean {
  const cap = capacitor();
  if (!cap) return false;
  try {
    if (typeof cap.isPluginAvailable === "function") return cap.isPluginAvailable("SpeechInput");
  } catch {
    /* fall through */
  }
  if (cap.Plugins && "SpeechInput" in cap.Plugins) return true;
  return !!cap.PluginHeaders?.some((h: { name?: string }) => h.name === "SpeechInput");
}

function nativeSpeech(): SpeechPlugin | undefined {
  const cap = capacitor();
  if (!cap) return undefined;
  const direct = cap.Plugins?.SpeechInput as SpeechPlugin | undefined;
  if (direct && typeof direct.listen === "function") return direct;
  if (typeof cap.registerPlugin === "function" && nativeSpeechAvailable()) {
    try {
      return cap.registerPlugin("SpeechInput") as SpeechPlugin;
    } catch {
      /* bridge present but registration unsupported */
    }
  }
  return undefined;
}

function webSpeechCtor(): any {
  if (typeof window === "undefined") return undefined;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
}

// Whether voice input is available at all here. On a native build, only when the
// on-device plugin is present (the web-view speech API is unreliable there, so no web
// fallback). Off-native (web), when the browser exposes the Web Speech API.
export function speechAvailable(): boolean {
  if (nativeSpeechAvailable()) return true;
  const cap = capacitor();
  try {
    if (cap?.isNativePlatform?.()) return false;
  } catch {
    /* treat as web */
  }
  return !!webSpeechCtor();
}

// Listen for one short utterance and resolve its transcript ("" if nothing was heard,
// permission was denied, or it isn't available). Never throws.
export async function listenOnce(opts?: { locale?: string }): Promise<string> {
  const locale = opts?.locale || "en-US";
  const native = nativeSpeech();
  if (native) {
    try {
      const r = await native.listen({ locale });
      return (r?.transcript || r?.value || "").toString().trim();
    } catch {
      return "";
    }
  }
  const Ctor = webSpeechCtor();
  if (!Ctor) return "";
  return new Promise<string>((resolve) => {
    let done = false;
    const finish = (v: string) => {
      if (done) return;
      done = true;
      resolve(v.trim());
    };
    try {
      const rec = new Ctor();
      rec.lang = locale;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      rec.onresult = (e: any) => finish(e?.results?.[0]?.[0]?.transcript || "");
      rec.onerror = () => finish("");
      rec.onend = () => finish("");
      rec.start();
      // Safety net: never hang if the recognizer stalls.
      window.setTimeout(() => {
        try {
          rec.stop();
        } catch {
          /* already stopped */
        }
        finish("");
      }, 12000);
    } catch {
      finish("");
    }
  });
}

// Best-effort extraction of a name from a spoken phrase ("I'm Chris" -> "Chris"). The
// result is always editable by the person afterward (the name chip), so this only needs
// to be a sensible first guess, not perfect.
export function parseSpokenName(raw: string): string {
  let s = (raw || "").trim();
  if (!s) return "";
  // Drop a leading filler/greeting.
  s = s.replace(/^(?:hi|hey|hello|yeah|yes|um|uh|well|so)[,\s]+/i, "");
  // Drop a leading carrier phrase ("my name is", "I'm", "call me", ...).
  s = s.replace(
    /^(?:my name is|my name's|i am|i'm|it is|it's|its|this is|they call me|you can call me|call me|name is|name's)\s+/i,
    ""
  );
  // Trim trailing punctuation, keep the first word or two (first + last), cap length.
  s = s.replace(/[.,!?;:]+$/g, "").trim();
  const words = s.split(/\s+/).filter(Boolean).slice(0, 2);
  const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);
  return words.map(cap).join(" ").slice(0, 40);
}
