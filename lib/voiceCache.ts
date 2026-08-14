// Pre-voiced common lines live as static files under public/voice-cache, named
// by a hash of (voiceId, line text). The build-voice-cache script generates them
// and writes the manifest below (the list of hashes that exist). At request time
// the route checks the manifest: a cached line is served by URL (fast, free, off
// the CDN); anything not yet cached is synthesized live as a fallback.
//
// The hashing here MUST match scripts/build-voice-cache.mjs exactly.

import crypto from "node:crypto";
import manifest from "./voiceCacheManifest.json";

const KEYS = new Set<string>(
  ((manifest as { keys?: string[] }).keys ?? [])
);

export function cacheKey(voiceId: string, text: string): string {
  return crypto
    .createHash("sha1")
    .update(`${voiceId}\n${text}`)
    .digest("hex")
    .slice(0, 20);
}

export function cacheUrl(key: string): string {
  return `/voice-cache/${key}.mp3`;
}

export function isCached(key: string): boolean {
  return KEYS.has(key);
}
