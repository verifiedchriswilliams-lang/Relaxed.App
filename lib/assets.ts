// Resolve a public asset path to its hosting origin.
//
// Large media — the soundscape beds (public/sounds) and the pre-voiced voice
// cache (public/voice-cache) — are hosted on Vercel Blob in production rather
// than committed to git. Set NEXT_PUBLIC_BLOB_BASE_URL to the store's public
// base (e.g. https://xxxxxxxx.public.blob.vercel-storage.com) and a path like
// "/sounds/Rain.mp3" resolves to "<base>/sounds/Rain.mp3".
//
// When the var is unset (local dev, or before the migration), paths stay
// relative and are served from /public exactly as before — so this is a safe,
// no-op change until the base URL is provided.

const BASE = (process.env.NEXT_PUBLIC_BLOB_BASE_URL || "").replace(/\/+$/, "");

export function asset<T extends string | undefined>(path: T): T {
  // Leave data: URLs and already-absolute URLs untouched; only root-relative
  // public paths are hosted on Blob.
  if (!path || !path.startsWith("/")) return path;
  return (BASE ? BASE + path : path) as T;
}
