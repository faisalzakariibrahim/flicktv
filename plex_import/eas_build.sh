#!/bin/bash
export EXPO_TOKEN="WAhF...ld"
export EAS_NO_AUTO_UPDATE=1
cd ~/projects/flicktv/mobile
echo "=== Building Android ==="
npx eas-cli build --platform android --profile production --non-interactive 2>&1
echo "=== Building iOS ==="
npx eas-cli build --platform ios --profile production --non-interactive 2>&1
echo "=== DONE ==="
