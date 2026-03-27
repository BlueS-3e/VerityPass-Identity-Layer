Production session & CORS deployment recommendations

This file lists recommended environment variables and deployment guidance for running the API server in production. Follow these to harden session cookies, CORS and CSRF behavior.

Required (set these in your deployment environment / secret manager):

- SECRET_KEY — a long random string used by Flask to sign sessions. Example: `openssl rand -hex 32`.
- ADMIN_PASSWORD — the admin web UI password (consider replacing with stronger auth in future).
- NFT_STORAGE_API_KEY — API key used to pin attestations to nft.storage (optional if you don't use pinning).

Recommended session & cookie settings (env):

- FLASK_ENV=production
- SESSION_COOKIE_SECURE=true
  - Ensures cookies are only sent over HTTPS. MUST be true when serving over TLS.
- SESSION_COOKIE_SAMESITE=Strict
  - Recommended: `Strict` for maximal CSRF protection. Use `Lax` if you need cross-site GET navigation.
- SESSION_LIFETIME_SECONDS=604800
  - Default is 7 days (604800s). Shorten for stricter session expiration.

CORS / front-end origins:

- ALLOWED_ORIGINS — comma-separated list of origins allowed to call the API (e.g. `https://app.veritypass.example`).
  - Example: `ALLOWED_ORIGINS=https://app.veritypass.example`
  - DO NOT leave this unset in production; if unset the server defaults to localhost dev origins.

Optional environment toggles:

- SESSION_COOKIE_HTTPONLY=true (set by default in the app)
- FORCE_PROD=true — use to force production-mode behaviour when other env vars are not present.

Deployment checklist (minimal):

1. Configure env variables in your platform (Docker secrets, systemd unit, or cloud secret manager).
2. Serve the app behind TLS (nginx, load balancer) and set SESSION_COOKIE_SECURE=true.
3. Set ALLOWED_ORIGINS to the exact frontend origins and verify API requests use credentials (`fetch(..., credentials: 'include')`).
4. Consider moving admin auth to SSO/OAuth and add rate limiting on `/api/admin/login`.
5. Add monitoring/alerts for `owner()` changes and admin activity.

Example systemd drop-in for environment (do NOT store secrets in plain files in production):

[Service]
Environment="FLASK_ENV=production"
Environment="SECRET_KEY=<redacted>"
Environment="ADMIN_PASSWORD=<redacted>"
Environment="SESSION_COOKIE_SECURE=true"
Environment="ALLOWED_ORIGINS=https://app.veritypass.example"

