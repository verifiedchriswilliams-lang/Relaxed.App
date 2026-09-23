#!/usr/bin/env bash
# Cut a small tray-audition clip for every soundscape bed. The full beds are long
# lossless FLACs (tens of MB), so fetching + decoding one just to preview it in
# the tray is slow; the app instead auditions these tiny MP3s (near-instant fetch
# + decode) and only falls back to the full bed if a clip is missing.
#
# Each clip is a ~6s taste from a few seconds into the bed (past any onset). No
# baked fades: the engine applies its own quick fade-in / gentle fade-out.
#
# Requires a real ffmpeg (with libmp3lame). Usage:
#   bash scripts/build-sound-previews.sh
# Then upload:  node scripts/upload-blob.mjs public/sound-previews
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/public/sounds"
OUT="$ROOT/public/sound-previews"
mkdir -p "$OUT"
command -v ffmpeg >/dev/null || { echo "ffmpeg not found (brew install ffmpeg)"; exit 1; }

ok=0; fail=0
for f in "$SRC"/*.flac; do
  [ -f "$f" ] || continue
  base="$(basename "${f%.flac}")"
  if ffmpeg -y -loglevel error -ss 6 -t 6 -i "$f" \
      -ar 44100 -ac 2 -c:a libmp3lame -b:a 128k "$OUT/$base.mp3" </dev/null; then
    echo "OK: $base.mp3"; ok=$((ok+1))
  else
    echo "FAILED: $base"; fail=$((fail+1))
  fi
done
echo "---"
echo "previews: $ok ok, $fail failed (expected 24)"
