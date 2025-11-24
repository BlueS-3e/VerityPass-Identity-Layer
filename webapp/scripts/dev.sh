#!/usr/bin/env bash
# Dev launcher that forces X11 backend variables for Wayland environments
set -euo pipefail
# Prevent Vite from attempting to open a browser on Wayland/X environments
export BROWSER=none
# Execute the raw dev script from package.json
exec npm run dev:raw
