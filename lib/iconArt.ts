import { BRAND } from "./brand";

// The app-icon tile artwork per brand, as an inline SVG string. Used by the
// favicon (app/icon.tsx) and the apple touch icon (app/apple-icon.tsx), both of
// which rasterise it through next/og. relaxed uses the identity's default dark
// tile (Ink ground, Bone stem); ElevenMind keeps its teal "11".
export function tileSvg(px: number): string {
  if (BRAND.id === "relaxed") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}"><rect width="100" height="100" rx="23" fill="#121110"/><path d="M40 74 V40 C40 30 49 26 60 26" fill="none" stroke="#EFEBE3" stroke-width="13" stroke-linecap="butt"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}"><defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0c1120"/><stop offset="100%" stop-color="#0a0e18"/></linearGradient></defs><rect width="100" height="100" rx="23" fill="url(#t)"/><g fill="#5ff0cd"><rect x="35" y="29" width="10.5" height="42" rx="2"/><rect x="54.5" y="29" width="10.5" height="42" rx="2"/></g></svg>`;
}

export function tileDataUri(px: number): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(tileSvg(px))}`;
}
