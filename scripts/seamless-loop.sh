#!/usr/bin/env bash
# Make a tonal/drone bed loop seamlessly by crossfading its end into its start.
# Fixes the faint click at the loop point on beds with sustained pitched content
# (drones, tones, music) that a hard, sample-accurate loop exposes. Pure-noise and
# broadband nature beds don't need this.
#
# Usage:  bash scripts/seamless-loop.sh <input> [crossfade_seconds] [output]
#   crossfade_seconds defaults to 2 (try 1-4). Output defaults to <input>-loop.wav.
#   The output is <crossfade_seconds> shorter than the input. Requires ffmpeg.
set -euo pipefail
IN="${1:?usage: seamless-loop.sh <input> [crossfade_seconds] [output]}"
D="${2:-2}"
OUT="${3:-${IN%.*}-loop.wav}"
ffmpeg -y -loglevel error -i "$IN" -filter_complex \
  "[0:a]asplit=2[a][b];[a]atrim=end=${D},asetpts=PTS-STARTPTS[a];[b]atrim=start=${D},asetpts=PTS-STARTPTS[b];[b][a]acrossfade=d=${D}:c1=qsin:c2=qsin" \
  "$OUT"
echo "Wrote $OUT (crossfade ${D}s). Re-test it in the loop tester."
