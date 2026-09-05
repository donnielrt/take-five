#!/usr/bin/env bash
# Render the finished Take Five piece to an MP4 (video + synthesized audio).
set -euo pipefail
cd "$(dirname "$0")"

W="${W:-1280}"
H="${H:-720}"
FPS="${FPS:-30}"

echo "==> synthesizing audio"
node tools/render-audio.js out_audio.wav --sr 44100

echo "==> rendering video + muxing"
node tools/render-video.js --w "$W" --h "$H" --fps "$FPS" --out take-five.mp4 --audio out_audio.wav

echo "==> done: $(pwd)/take-five.mp4"
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 take-five.mp4 2>/dev/null || true
