Production deployment notes (concise)

Required/important envs:
- SECRET_KEY: secure secret for Flask sessions (required in production)
- NFT_STORAGE_API_KEY: key for attestation pinning
- ALLOWED_ORIGINS: comma-separated frontend origins (do not use '*')
- REDIS_URL: redis://... (recommended for sessions and rate-limiter)
- PUBLIC_API_BASE or ENABLE_PROXY_FIX: ensure frontend receives correct public API base
- DISABLE_PASSWORD_LOGIN and OIDC_* envs: when disabling password login, configure OIDC

Run behind nginx + Gunicorn. Example systemd template is available at `deploy/veritypass-api.service.template`.

Security checklist (quick):
- Set `SECRET_KEY` to a secure value
- Ensure TLS terminates at the proxy and `SESSION_COOKIE_SECURE=true`
- Configure `ALLOWED_ORIGINS` and `PUBLIC_API_BASE`
- Provide `REDIS_URL` and install `Flask-Session` if using server-side sessions
- Disable dev fallbacks (e.g., OIDC_DEV_ALLOW)

Secrets & recommended management
--------------------------------
- Do not store secrets in the repository. Use a secrets manager (HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager) or inject secrets via your CI/CD pipeline as protected variables.
- Required secrets for production: `SECRET_KEY`, `NFT_STORAGE_API_KEY` (if you use pinning), `ADMIN_PASSWORD` (or configure OIDC), `CHECK_OWNER_CONTRACT_ADDR` (if used), `REDIS_URL` credentials, `DEPLOYER_PRIVATE_KEY` (only for deployment pipelines, keep offline otherwise), and `SENTRY_DSN` (optional).
- Recommended: create a read-only service account for Redis access, and avoid embedding private keys on long-lived hosts. Use ephemeral keys where possible.

Local development vs production
--------------------------------
- Use `.env` files for local development convenience only. Add `.env` to `.gitignore` and keep an example file committed as `api/.env.example`.
- In production, prefer one of the secure options below rather than environment files stored in the repo.

Systemd / service deployment example
-----------------------------------
When using systemd, prefer an environment file stored with restricted permissions and referenced from the unit file. Example `EnvironmentFile` usage (in `deploy/veritypass-api.service.template`):

EnvironmentFile=/etc/veritypass/veritypass-api.env

Where `/etc/veritypass/veritypass-api.env` contains lines like:

SECRET_KEY=changeme
REDIS_URL=redis://:password@redis.example:6379/0
NFT_STORAGE_API_KEY=replace-with-key

Make sure the environment file is owned by root and permissioned so only the deploy user can read it (e.g., 0600), and that it is injected via your deployment tooling or secrets manager.

Helper scripts
--------------
The repository includes a helper template and a permission-check script to assist operators:

- `deploy/veritypass-api.env.template` — example environment file with keys and placeholders.
- `deploy/check-env-perms.sh` — quick script to validate that your `/etc/veritypass/veritypass-api.env` file is present, owned by `root`, and has `0600` permissions. Run it during deploy to assert safe defaults.

Example usage (on the host):

```bash
sudo cp deploy/veritypass-api.env.template /etc/veritypass/veritypass-api.env
# Edit /etc/veritypass/veritypass-api.env to fill real values, then:
sudo chown root:root /etc/veritypass/veritypass-api.env
sudo chmod 600 /etc/veritypass/veritypass-api.env
sudo deploy/check-env-perms.sh /etc/veritypass/veritypass-api.env
```

Docker & Swarm
--------------
- For Docker Compose / Swarm, use Docker Secrets (not plain env) for any sensitive values. Create secrets with `docker secret create` and reference them in your compose file. Inside the container secrets are available at `/run/secrets/<name>`.

Kubernetes
----------
- On Kubernetes, use `Secrets` combined with SOPS/SealedSecrets for safe storage in Git, or pull secrets from an external provider (Vault, cloud KMS) at runtime. Mount secrets as files where possible.

Vault / Managed Secret Stores
----------------------------
- For high security needs, use HashiCorp Vault or cloud provider secret managers. Use short-lived credentials and agents to inject secrets into the filesystem, or use the provider's integration to issue tokens dynamically.

Troubleshooting pointers:
- If frontend shows "Backend unreachable", verify `/api/health` and `/api/frontend-config` expose correct values.
- If rate-limiter falls back to memory, ensure `REDIS_URL` is reachable.

For full examples and notes see this repo's `RELEASE_CHECKLIST.md` and `deploy/veritypass-api.service.template`.