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

// Full-bleed square artwork for the lock-screen / Control Center "Now Playing"
// card. Unlike the app-icon tile, this has NO rounded corners and NO transparency
// — iOS applies its own rounded frame, so a square Ink fill avoids the white
// corners a rounded/transparent icon leaves behind. A soft central bloom gives it
// a touch of depth, and the blurred version iOS shows behind the card reads as a
// calm dark ground rather than a washed-out white.
export function artworkSvg(px: number): string {
  if (BRAND.id === "relaxed") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}"><defs><radialGradient id="b" cx="50%" cy="45%" r="58%"><stop offset="0%" stop-color="#efebe3" stop-opacity="0.12"/><stop offset="70%" stop-color="#efebe3" stop-opacity="0"/></radialGradient></defs><rect width="100" height="100" fill="#121110"/><rect width="100" height="100" fill="url(#b)"/><path d="M40 68 V40 C40 32 47 29 56 29" fill="none" stroke="#EFEBE3" stroke-width="11" stroke-linecap="butt" transform="translate(2 1)"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}"><rect width="100" height="100" fill="#0a0e18"/><g fill="#5ff0cd"><rect x="35" y="29" width="10.5" height="42" rx="2"/><rect x="54.5" y="29" width="10.5" height="42" rx="2"/></g></svg>`;
}

export function artworkDataUri(px: number): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(artworkSvg(px))}`;
}
