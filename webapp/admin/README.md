Admin UI (separate)

This folder contains starter notes and an entrypoint for separating the admin UI from the public webapp.

Recommended deployment:
- Build a dedicated admin frontend app that imports `webapp/src/admin/AdminEntry.jsx` as its root.
- Serve on a separate subdomain (e.g. admin.example.com) with strict CORS/ALLOWED_ORIGINS and require SSO.

Dev notes:
- The backend exposes OIDC endpoints at `/api/admin/oidc/login` and `/api/admin/oidc/callback`.
- For local testing without an IdP, set `OIDC_DEV_ALLOW=true` and use `/api/admin/oidc/dev-login?email=you@dev.local`.
