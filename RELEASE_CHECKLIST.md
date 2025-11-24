Release checklist — RealMint Launchpad

Quick release checklist

- Prepare infra: TLS-enabled proxy, Redis (recommended), persistent storage for uploads
- Build: backend (venv or container) and `webapp`, `webapp-admin` frontends
- Env: set `SECRET_KEY`, `PUBLIC_API_BASE`, `ALLOWED_ORIGINS`, `REDIS_URL`, `SESSION_COOKIE_SECURE`
- Run: deploy using the `deploy/realmint-api.service.template` or container orchestration and verify `/api/health`
- Monitor: enable Prometheus scraping `/metrics` and optional Sentry

See `api/DEPLOYMENT.md` for concise notes and `deploy/realmint-api.service.template` for a systemd example.
