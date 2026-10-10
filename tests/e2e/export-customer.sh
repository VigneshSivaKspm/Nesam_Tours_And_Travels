#!/usr/bin/env bash
# Exports the customer app for the browser preview, wired to the local emulators.
#   bash tests/e2e/export-customer.sh <out-dir>
set -euo pipefail
cd "$(dirname "$0")/../../user/app"
EXPO_PUBLIC_USE_FIREBASE_EMULATORS=true EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-nesam EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-nesam.appspot.com EXPO_PUBLIC_STORAGE_EMULATOR_PORT=9299 \
  npx expo export --platform web --output-dir "$1"
