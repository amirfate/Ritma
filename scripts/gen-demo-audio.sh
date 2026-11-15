#!/usr/bin/env bash
# Generates demo audio files for the seeded tracks into MEDIA_DIR/audio.
# Requires ffmpeg. Usage: ./scripts/gen-demo-audio.sh [MEDIA_DIR]
set -euo pipefail
MEDIA="${1:-$(dirname "$0")/../media}"
mkdir -p "$MEDIA/audio"
for i in 1 2 3; do
  FREQ=$((220 + i * 110))
  ffmpeg -y -hide_banner -loglevel error \
    -f lavfi -i "sine=frequency=${FREQ}:duration=30" \
    -af "afade=t=in:d=1,afade=t=out:st=28:d=2" \
    -c:a aac -b:a 128k "$MEDIA/audio/demo-${i}.m4a"
done
echo "demo audio written to $MEDIA/audio/"
