#!/usr/bin/env bash
# Finalize the 24 soundscape masters into web beds in ONE pass: apply each bed's
# ear-confirmed seamless-loop crossfade (see docs/soundscape-loop-fixes.md) AND
# transcode to the catalog format (FLAC, 48 kHz, 16-bit, stereo), written to
# public/sounds/ with the exact names the catalog's `src` values expect.
#
# Why a single pass (not the -loop.wav test files): during QA each bed was A/B'd
# and the last-written <name>-loop.wav may hold an intermediate/reject value. This
# rebuilds every bed fresh from the raw master with the LOCKED crossfade baked in.
#
# The crossfade is the self-acrossfade recipe: rotate the file so its end blends
# into its start, moving the loop seam to a continuous interior point. d=0 = raw
# (no crossfade), just a format transcode.
#
# Requires a real ffmpeg (Homebrew/apt). Usage:
#   bash scripts/finalize-beds.sh [masters-folder]     # default: ~/Downloads
# Output goes to <repo>/public/sounds. Confirm "24 ok" before uploading.
set -uo pipefail

MASTERS="${1:-$HOME/Downloads}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/sounds"
mkdir -p "$OUT"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found. Install it (brew install ffmpeg) and retry." >&2
  exit 1
fi

# input filename (in MASTERS) | output catalog name | crossfade seconds (0 = raw)
rows=(
  "rain.wav|Rain|2"
  "ocean.wav|Ocean|1"
  "birdsong.wav|Birdsong|2"
  "wind.wav|Wind|2"
  "thunderstorm.wav|Thunderstorm|2"
  "windchimes.wav|Windchimes|0"
  "brook.wav|BabblingBrook|3"
  "campfire.wav|Campfire|2"
  "AMBIENT.wav|Ambient|2"
  "piano.wav|Piano|0.3"
  "lofi.wav|LoFi|0.2"
  "bowls.wav|SingingBowls|3"
  "harp.wav|Harp|0.2"
  "strings.wav|WarmStrings|0.2"
  "kalimba.wav|Kalimba|0.5"
  "flute.wav|Flute|0.2"
  "brown.wav|BrownNoise|2"
  "tone.wav|432Hz|2"
  "WHITE NOISE.wav|WhiteNoise|0"
  "binaural.wav|Binaural|0.2"
  "delta.wav|Delta|3"
  "theta.wav|Theta|1"
  "green.wav|GreenNoise|2"
  "alpha.wav|Alpha|3"
)

ok=0; fail=0
for r in "${rows[@]}"; do
  IFS='|' read -r inp out d <<<"$r"
  src="$MASTERS/$inp"
  dst="$OUT/$out.flac"
  if [ ! -f "$src" ]; then echo "MISSING master: $inp"; fail=$((fail+1)); continue; fi
  if [ "$d" = "0" ]; then
    ffmpeg -y -loglevel error -i "$src" \
      -ar 48000 -ac 2 -sample_fmt s16 -c:a flac "$dst" </dev/null
  else
    ffmpeg -y -loglevel error -i "$src" -filter_complex \
      "[0:a]asplit=2[a][b];[a]atrim=end=$d,asetpts=PTS-STARTPTS[a];[b]atrim=start=$d,asetpts=PTS-STARTPTS[b];[b][a]acrossfade=d=$d:c1=qsin:c2=qsin" \
      -ar 48000 -ac 2 -sample_fmt s16 -c:a flac "$dst" </dev/null
  fi
  if [ -f "$dst" ]; then
    echo "OK: $inp -> $out.flac (d=$d)"; ok=$((ok+1))
  else
    echo "FAILED: $inp"; fail=$((fail+1))
  fi
done

echo "---"
echo "done: $ok ok, $fail failed (expected 24 ok, 0 failed)"
[ "$ok" -eq 24 ] && [ "$fail" -eq 0 ] && echo "All 24 beds finalized into $OUT"
