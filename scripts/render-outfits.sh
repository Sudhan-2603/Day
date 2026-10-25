#!/bin/bash
# render-outfits.sh — compile and run the Day outfit planche renderer
# NOT in CI. Run manually: bash scripts/render-outfits.sh
# Output: /tmp/day-outfits.png

set -e
cd "$(dirname "$0")/.."

SDK=$(xcrun --sdk macosx --show-sdk-path)

echo "Compiling renderer..."
swiftc \
  -parse-as-library \
  -sdk "$SDK" \
  -target arm64-apple-macosx15.0 \
  NotchBuddy/Sources/DayKit/IslandScreenGeometry.swift \
  NotchBuddy/Sources/DayKit/IslandTypes.swift \
  NotchBuddy/Sources/DayKit/DayWardrobe.swift \
  NotchBuddy/Sources/DayKit/BotEngine.swift \
  NotchBuddy/Sources/DayKit/DayOutfitDrawing.swift \
  scripts/RenderOutfits.swift \
  -framework AppKit \
  -framework SwiftUI \
  -o /tmp/day-render-outfits \
  2>&1

echo "Running renderer..."
/tmp/day-render-outfits
echo "Opening..."
open /tmp/day-outfits.png
