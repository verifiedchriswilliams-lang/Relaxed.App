#!/usr/bin/env bash
# Convert the producer's finished soundscape masters (WAV/FLAC, any names) into the
# web beds the catalog expects: FLAC, 48 kHz, 16-bit, stereo, named to match the
# `src` values in lib/audio/soundscapes.ts, written to public/sounds/.
#
# Requires a real ffmpeg (Homebrew/apt build). Usage:
#   bash scripts/convert-masters.sh ~/relaxed-masters
#
# It maps common delivered names to the catalog filenames. If a file is skipped as
# "no mapping", either rename it to match one of the keys below or add a mapping.
set -euo pipefail
SRC="${1:?usage: convert-masters.sh <masters-folder>}"
OUT="public/sounds"
mkdir -p "$OUT"

declare -A MAP=(
  ["rain"]="Rain" ["ocean waves"]="Ocean" ["ocean"]="Ocean" ["birdsong"]="Birdsong"
  ["wind"]="Wind" ["thunderstorm"]="Thunderstorm" ["wind chimes"]="Windchimes" ["windchimes"]="Windchimes"
  ["babbling brook"]="BabblingBrook" ["brook"]="BabblingBrook" ["campfire"]="Campfire"
  ["ambient"]="Ambient" ["piano"]="Piano" ["lo-fi"]="LoFi" ["lofi"]="LoFi"
  ["singing bowls"]="SingingBowls" ["singing bowl"]="SingingBowls" ["harp"]="Harp"
  ["strings"]="WarmStrings" ["warm strings"]="WarmStrings" ["kalimba"]="Kalimba" ["flute"]="Flute"
  ["brown noise"]="BrownNoise" ["432hz"]="432Hz" ["432 hz"]="432Hz" ["white noise"]="WhiteNoise"
  ["binaural"]="Binaural" ["delta"]="Delta" ["theta"]="Theta" ["green noise"]="GreenNoise" ["alpha"]="Alpha"
)

shopt -s nullglob
count=0
for f in "$SRC"/*.{wav,WAV,flac,FLAC,aif,aiff,AIF,AIFF}; do
  base="$(basename "${f%.*}")"
  key="$(echo "$base" | tr '[:upper:]' '[:lower:]' | sed 's/  */ /g; s/^ *//; s/ *$//')"
  out="${MAP[$key]:-}"
  if [ -z "$out" ]; then echo "SKIP (no mapping): $(basename "$f")"; continue; fi
  ffmpeg -y -loglevel error -i "$f" -ar 48000 -ac 2 -sample_fmt s16 -c:a flac "$OUT/$out.flac" </dev/null
  echo "OK: $base -> $out.flac"
  count=$((count+1))
done
echo "Converted $count file(s) into $OUT/ (expected 24)."
