Runtime configuration and how frontends pick it up

Overview

The frontends (webapp and webapp-admin) support two sources for configuration:

1. Build-time Vite envs (VITE_*). These are embedded during the Vite build.
2. Server-provided runtime values from the backend endpoint `/api/frontend-config`.

Behavior

- If `VITE_API_BASE` (or other VITE_* values) is supplied at build time, the frontend will use that value at runtime.
- If `VITE_API_BASE` is not set or the app loads same-origin to the API, the frontend will call `/api/frontend-config` on boot and merge values returned by the server into the runtime configuration. The server can therefore provide an authoritative API base, auth methods, admin UI URL, and feature flags without rebuilding the frontend.

Why this exists

Embedding the API base at build-time makes static hosting trivial, but in many deploy scenarios you want a single build artifact to work across staging/production. The runtime-config endpoint lets the server supply environment-specific values at runtime.

How to run the API locally for development

1. Install Python dependencies for the API:

   cd api
   python -m pip install --upgrade pip
   pip install -r requirements.txt

2. Set the minimal required env vars (example):

   export SECRET_KEY="dev-secret"
   export ADMIN_PASSWORD="dev-pass"
   export NFT_STORAGE_API_KEY="replace-with-some-key"
   # Optional dev/testing flags
   export DISABLE_PASSWORD_LOGIN=true

3. Start the API for local development:

   python app.py

Notes

- The server may abort at startup if certain required production envs are missing (this is intentional to avoid insecure production starts). For local development, use the minimal envs above or consult the code that enforces required envs.
- If you see the frontend unable to reach the API in your browser, verify `VITE_API_BASE` used at build time, or if loading same-origin, that your API is serving `/api/frontend-config` and `/api/health` successfully.

Troubleshooting

- "python app.py exits immediately" — check the terminal output for which required env was missing. Set the env, then retry.
- Tests failing due to missing web3/eth-account — install the missing dependencies from `api/requirements.txt`.

CI notes

- The CI workflow uses `secrets.CI_VITE_API_BASE` and `secrets.CI_VITE_ADMIN_HOST` when building frontends in CI. Configure those repository secrets to point to a reachable API host for build-time tasks that need it.
- If you use Sentry, set the required Sentry secrets (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`) to enable sourcemap upload during CI builds.
