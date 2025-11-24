Production checklist for RealMint Launchpad

Backend (API)
- Set environment variables:
  - SECRET_KEY (required)
  - ADMIN_PASSWORD (or replace with stronger auth)
  - ALLOWED_ORIGINS (comma-separated list of frontend origin(s))
  - NFT_STORAGE_API_KEY (if pinning to nft.storage)
  - SESSION_COOKIE_SECURE=true
  - SESSION_COOKIE_SAMESITE=Strict (or Lax if needed)
  - MAX_CONTENT_LENGTH (bytes; default 10MiB)
- Ensure the app is served behind TLS (nginx/load balancer) — HSTS is applied when secure cookies enabled.
- Install optional hardening packages in production: Flask-Limiter (rate limiting), a proper WSGI server (gunicorn/uvicorn), Sentry DSN for errors.
- Consider using object storage for uploaded whitepapers and serve via pre-signed URLs rather than storing on local disk.
- Configure monitoring & alerting (Prometheus + alerting for owner mismatch and high failure rates).

Frontend
- Build with `npm run build` and serve static assets from a CDN or a secure static hosting.
- Set `VITE_API_BASE` at build time to the API origin (e.g., https://api.realmint.example).
- Set `VITE_ENABLE_LAUNCHPAD` to `true` or `false` depending on whether launchpad should be enabled.
- Enforce Content Security Policy at the CDN/reverse proxy layer and review `CUSTOM_CSP_HEADER` if set in backend.

Operations
- Add CI checks: unit tests (backend/frontend), admin CSRF integration test, and an owner() check before release.
- Add a GitHub Action to run `scripts/check-owner.js` as part of release gating.
- Use a secrets manager to inject `SECRET_KEY`, `ADMIN_PASSWORD`, and `NFT_STORAGE_API_KEY`.

Security notes
- The current admin auth is a single password; migrate to SSO/OIDC or at least hashed passwords and per-user accounts.
- Rate-limit the admin login endpoint (we added an optional limiter). Install `Flask-Limiter` in production to enable it.
- Validate and offload uploads to object storage; currently the app saves to `uploads/` on local disk.
- CSRF protection for admin endpoints is implemented; ensure session cookies are allowed and secure in production.
