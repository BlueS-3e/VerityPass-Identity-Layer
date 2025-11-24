#!/usr/bin/env bash
# Lightweight helper to create a venv, install requirements, and run the API for local development.
# Usage: ./run_dev.sh
# This script is safe to re-run. It does not overwrite an existing venv.

set -euo pipefail
ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT_DIR"

# Create venv if missing
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi
# Activate
# shellcheck source=/dev/null
. venv/bin/activate

# Upgrade pip and install requirements
pip install --upgrade pip
pip install -r requirements.txt

# If a .env file exists, load it (optional). Otherwise we export minimal defaults for dev.
if [ -f .env ]; then
  # Load .env into the environment (simple parser; ignore lines starting with #)
  set -a
  # shellcheck disable=SC1091
  . .env
  set +a
else
  export SECRET_KEY=${SECRET_KEY:-dev-secret}
  export ADMIN_PASSWORD=${ADMIN_PASSWORD:-dev-admin-password}
  # Provide a non-empty placeholder NFT_STORAGE_API_KEY so the server does not abort on startup
  export NFT_STORAGE_API_KEY=${NFT_STORAGE_API_KEY:-dev-nft-storage-key}
  # Include Vite's default dev origin (5173) so the frontend can call the API in dev
  export ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000}
  export DISABLE_PASSWORD_LOGIN=${DISABLE_PASSWORD_LOGIN:-true}
  export ALLOW_OWNER_ACTIONS_NO_SIG=${ALLOW_OWNER_ACTIONS_NO_SIG:-false}
  # Development convenience: allow any recovered SIWE address to create an admin session
  # when no ADMIN_ADDRESS / CHECK_OWNER_CONTRACT_ADDR is configured. This MUST NOT be
  # enabled in production. Operators can override by setting ADMIN_DEV_ALLOW_ANY=false.
  # Ensure this flag is only true in local dev environments. If ENV=production is set
  # we explicitly force it to false to avoid accidental exposure.
  # Use safe parameter expansion to avoid failures when ENV or FLASK_ENV are unset
  if [ "${ENV:-}" = "production" ] || [ "${FLASK_ENV:-}" = "production" ]; then
    export ADMIN_DEV_ALLOW_ANY=false
  else
    export ADMIN_DEV_ALLOW_ANY=${ADMIN_DEV_ALLOW_ANY:-true}
  fi
fi

# Run the app
python app.py
