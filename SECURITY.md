# SECURITY.md

This document describes recommended security practices for deploying and operating RealMint.

## Secrets

- Never commit secrets into the repository (no private keys, API keys, or passwords).
- Use a secret manager (HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager) or protected CI/CD secrets.
- For systemd deployments, use an `EnvironmentFile` with restricted permissions (0600) and owned by root.

Required production secrets:
- `SECRET_KEY` — Flask secret used to sign sessions and cookies. Generate with `openssl rand -hex 32`.
- `NFT_STORAGE_API_KEY` — if you use nft.storage for pinning attestations.
- `ADMIN_PASSWORD` — only if password admin login is used (recommended: disable and use OIDC).
- `CHECK_OWNER_CONTRACT_ADDR` and `CHECK_OWNER_RPC_URL` — if you rely on on-chain owner checks.
- `REDIS_URL` — if using Redis for sessions and rate limiting.
- `DEPLOYER_PRIVATE_KEY` — use only in CI for deployments; keep offline in hardware wallets when possible.

## Sessions & Cookies

- Set `SESSION_COOKIE_SECURE=true` in production (TLS termination at proxy required).
- `SESSION_COOKIE_HTTPONLY=true` is enabled by default.
- `SESSION_COOKIE_SAMESITE` default is `Lax`.
- Prefer server-side sessions (Redis + Flask-Session) for production deployments.
- Rotate session ids on admin login / privilege elevation (the app clears sessions on admin auth by default).

## Admin Access

- Prefer OpenID Connect (OIDC) for human admin logins.
- If using SIWE, configure `ADMIN_ADDRESS` or `ADMIN_ADDRESSES` to known admin addresses.
- If relying on on-chain owner checks, configure `CHECK_OWNER_CONTRACT_ADDR` and `CHECK_OWNER_RPC_URL`.
- Ensure `ADMIN_DEV_ALLOW_ANY` and `OIDC_DEV_ALLOW` are disabled in production.

## Monitoring & Incident Management

- Configure `SENTRY_DSN` for error reporting in production.
- Expose `/health` and `/ready` endpoints for orchestration.
- Add Prometheus metrics collection for critical endpoints.
- Create a runbook for Redis or RPC outages.

## CI/CD

- Add a production startup check job in CI that runs with `ENV=production` and fails if required env vars are missing.
- Cache node_modules or use a registry proxy for reliable npm installs in CI.

## Solidity

- Run Slither or other static analysis tools on `contracts/` as part of CI.
- Perform a security audit before mainnet deployment.

If you need, I can generate example systemd unit snippets, CI jobs, or secret store templates (Vault policy, AWS KMS examples).