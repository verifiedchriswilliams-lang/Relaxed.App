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
// A simple soundscape emblem in the stem line language (monochrome Bone, flat
// line work), keyed by category so the lock-screen art feels specific to what is
// playing. Undefined category falls back to the stem "r" mark.
function relaxedEmblem(category?: string): string {
  const S = `stroke="#EFEBE3" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
  if (category === "music") {
    return `<g transform="translate(28,39)"><rect x="0" y="0" width="44" height="23" rx="2" ${S}/><line x1="11" y1="0" x2="11" y2="23" ${S}/><line x1="22" y1="0" x2="22" y2="23" ${S}/><line x1="33" y1="0" x2="33" y2="23" ${S}/><rect x="7.5" y="0" width="7" height="13.5" rx="1" fill="#EFEBE3"/><rect x="18.5" y="0" width="7" height="13.5" rx="1" fill="#EFEBE3"/><rect x="29.5" y="0" width="7" height="13.5" rx="1" fill="#EFEBE3"/></g>`;
  }
  if (category === "frequencies") {
    return `<g transform="translate(50,50)"><circle r="10" ${S}/><circle r="19" ${S} opacity="0.65"/><circle r="28" ${S} opacity="0.4"/><circle r="2.6" fill="#EFEBE3"/></g>`;
  }
  if (category === "nature") {
    const wave = (y: number) => `M16 ${y} Q28 ${y - 6} 40 ${y} T64 ${y} T88 ${y}`;
    return `<g ${S}><path d="${wave(41)}" opacity="0.6"/><path d="${wave(51)}"/><path d="${wave(61)}" opacity="0.6"/></g>`;
  }
  // Default: the stem "r".
  return `<path d="M40 68 V40 C40 32 47 29 56 29" fill="none" stroke="#EFEBE3" stroke-width="11" stroke-linecap="butt" transform="translate(2 1)"/>`;
}

export function artworkSvg(px: number, category?: string): string {
  if (BRAND.id === "relaxed") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}"><defs><radialGradient id="b" cx="50%" cy="45%" r="58%"><stop offset="0%" stop-color="#efebe3" stop-opacity="0.12"/><stop offset="70%" stop-color="#efebe3" stop-opacity="0"/></radialGradient></defs><rect width="100" height="100" fill="#121110"/><rect width="100" height="100" fill="url(#b)"/>${relaxedEmblem(category)}</svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}"><rect width="100" height="100" fill="#0a0e18"/><g fill="#5ff0cd"><rect x="35" y="29" width="10.5" height="42" rx="2"/><rect x="54.5" y="29" width="10.5" height="42" rx="2"/></g></svg>`;
}

export function artworkDataUri(px: number, category?: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(artworkSvg(px, category))}`;
}
