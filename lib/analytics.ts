import { track } from "@vercel/analytics";
import { BRAND } from "./brand";

// Anonymous, privacy-friendly product events on top of Vercel Web Analytics
// (which is already mounted in layout.tsx). No accounts, no identifiers, and
// deliberately NO free text: we never send the user's name or their custom
// phrase, only the shape of what they did (which intention, how long, which
// voice/soundscape, how they felt). Every call is guarded so a blocked or
// dev-mode analytics runtime is a silent no-op.
type Props = Record<string, string | number | boolean>;

// Which runtime the event fired from. The iOS/Mac apps load the same hosted page
// in a WKWebView, so their events land in the same Vercel analytics as the web;
// tagging the platform lets them be told apart (app vs web) after the fact.
function platform(): string {
  try {
    const cap = (globalThis as { Capacitor?: { getPlatform?: () => string } })
      .Capacitor;
    const p = cap?.getPlatform?.();
    return p === "ios" || p === "android" ? p : "web";
  } catch {
    return "web";
  }
}

export function ev(name: string, props?: Props): void {
  try {
    track(name, { brand: BRAND.id, platform: platform(), ...(props ?? {}) });
  } catch {
    /* analytics is best-effort; never let it affect the session */
  }
}
