#!/usr/bin/env bash
set -euo pipefail
# Copy relevant contract ABIs/artifacts into the webapp build area so the frontend can import them
# Usage: ./scripts/sync-artifacts.sh

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
CONTRACTS_DIR="$ROOT_DIR/contracts"
WEBAPP_BUILD_DIR="$ROOT_DIR/webapp/build/contracts"

mkdir -p "$WEBAPP_BUILD_DIR"

echo "Syncing contract artifacts from $CONTRACTS_DIR/artifacts to $WEBAPP_BUILD_DIR"

# Example: look for VerityPassLaunchpad artifact under artifacts/contracts/<Contract>.sol/<Contract>.json
find "$CONTRACTS_DIR/artifacts" -type f -name "VerityPassLaunchpad.json" -print0 | while IFS= read -r -d '' f; do
  echo "Copying $f -> $WEBAPP_BUILD_DIR/VerityPassLaunchpad.json"
  cp "$f" "$WEBAPP_BUILD_DIR/VerityPassLaunchpad.json"
done

echo "Sync complete."
