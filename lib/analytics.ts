import { track } from "@vercel/analytics";
import { BRAND } from "./brand";

// Anonymous, privacy-friendly product events on top of Vercel Web Analytics
// (which is already mounted in layout.tsx). No accounts, no identifiers, and
// deliberately NO free text: we never send the user's name or their custom
// phrase, only the shape of what they did (which intention, how long, which
// voice/soundscape, how they felt). Every call is guarded so a blocked or
// dev-mode analytics runtime is a silent no-op.
type Props = Record<string, string | number | boolean>;

export function ev(name: string, props?: Props): void {
  try {
    track(name, { brand: BRAND.id, ...(props ?? {}) });
  } catch {
    /* analytics is best-effort; never let it affect the session */
  }
}
