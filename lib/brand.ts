// Brand identity, chosen at build time by NEXT_PUBLIC_BRAND, so one codebase can
// serve two independent sites: ElevenMind (elevenmind.io, the ElevenLabs demo)
// and relaxed.app. Product attribution to ElevenLabs / ElevenMusic is unchanged
// in both — only the app's own name and domain differ.
//
// Unset (or anything but "relaxed") => ElevenMind, so the existing deployment is
// untouched. The relaxed.app project sets NEXT_PUBLIC_BRAND=relaxed.

export type BrandId = "elevenmind" | "relaxed";

export interface Brand {
  id: BrandId;
  name: string; // full display name, for titles and metadata
  strong: string; // the bold half of the wordmark
  light: string; // the light half of the wordmark
  domain: string;
  url: string;
  support: string; // support/contact email surfaced in-app
}

const BRANDS: Record<BrandId, Brand> = {
  elevenmind: {
    id: "elevenmind",
    name: "ElevenMind",
    strong: "Eleven",
    light: "Mind",
    domain: "elevenmind.io",
    url: "https://elevenmind.io",
    support: "hello@elevenmind.io",
  },
  relaxed: {
    id: "relaxed",
    name: "relaxed.app",
    strong: "relaxed",
    light: ".app",
    domain: "relaxed.app",
    url: "https://relaxed.app",
    support: "support@relaxed.app",
  },
};

export const BRAND: Brand =
  process.env.NEXT_PUBLIC_BRAND === "relaxed" ? BRANDS.relaxed : BRANDS.elevenmind;
