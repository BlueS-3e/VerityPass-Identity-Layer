Production deployment checklist

This document collects minimal actions and commands to prepare a production deployment of the RealMint platform.

1) Build & produce artifacts

- Compile contracts and tests:

  cd contracts
  npm ci
  npx hardhat compile --force
  npx hardhat test

- Sync ABI/artifacts into the frontend build folder:

  ./scripts/sync-artifacts.sh

- Build frontend:
  Build locally (if your environment supports it):

  cd webapp
  npm ci
  npm run build

  If local builds fail due to native binary/npm optional-dependency issues, use the CI workflow:

  - Push your branch to GitHub.
  - Open the repository Actions tab and run the "Build Webapp (build and artifact)" workflow or let it run on push to `main`.
  - Download the `webapp-dist` artifact and extract it to `webapp/dist` for deployment or testing.

  If local builds fail due to native binary / optional npm dependency issues (this repo has experienced Rollup native-binary errors on some hosts), prefer the CI-first reproducible build approach:

  CI-first (recommended)

  - Trigger the webapp build workflow on GitHub Actions (manual or on push to `main`). In the Actions tab choose the workflow named "Build Webapp (build and artifact)" (file: `.github/workflows/build-webapp.yml`) and click "Run workflow". You can also trigger it from the CLI:

    ```bash
    # trigger the workflow on the default branch (replace name/ref as needed)
    gh workflow run build-webapp.yml --ref main
    ```

  - After the workflow completes, download the artifact named `webapp-dist` (via browser Actions UI or `gh`):

    ```bash
    # list recent runs for the workflow
    gh run list --workflow build-webapp.yml

    # pick the run-id from the list and download the artifact (replace <run-id>)
    gh run download <run-id> --name webapp-dist -D ./webapp-dist
    ```

  - Extract the artifact into your deployment `dist` folder (example):

    ```bash
    mkdir -p webapp/dist
    tar -xzf webapp-dist/webapp-dist.tgz -C webapp/dist
    # or if gh produced a zip: unzip webapp-dist/webapp-dist.zip -d webapp/dist
    ```

  - Validate the built output with the CSP scanner before deploying:

    ```bash
    python3 scripts/check_csp.py webapp/dist
    ```

  Local build troubleshooting (if you must build locally)

  - Use a clean Node 18+ environment and prefer `npm ci` where possible. Omitting optional native-only packages can help for Linux hosts:

    ```bash
    cd webapp
    npm ci --omit=optional --no-audit --no-fund
    npm run build
    ```

  - If you hit Rollup/Vite native-binary errors, a reliable workaround is to build inside a GitHub Actions runner (CI) or an isolated Linux container that has unrestricted network access. If Docker builds fail on your machine due to network timeouts, try one of these:

    - Use the GitHub Actions workflow (above). This is the recommended reproducible path.
    - Use `act` to run the workflow locally with a GitHub Actions runner image (requires setup): https://github.com/nektos/act
    - Ensure Docker build has network access (e.g., `--network=host`) and enough memory; some package installs time out on constrained or proxied networks.

  - If you prefer `pnpm`/`yarn` in your environment, they may produce different dependency resolution results; CI uses the repository workflow and is the supported route for production artifacts.

2) Container images (example)

- Build API image:

  docker build -t realmint-api -f api/Dockerfile .

- Build webapp image:

  docker build -t realmint-web -f webapp/Dockerfile .

- Example docker-compose (not provided): run `realmint-api` as `api` host and webapp image with `nginx` config above.

Publishing a release (CI automated)

This repository includes a release workflow (`.github/workflows/release.yml`) that runs when you push a semver tag (for example `v1.0.0`). The workflow will:

- Build the frontend and run the CSP safety check.
- Package `webapp/dist` into a zip and attach it to a GitHub Release.
- Build Docker images for `api` and `web` and push them to GitHub Container Registry (GHCR) under your organization.

To publish a release and artifacts:

```bash
# create a tag and push it
git tag v1.0.0
git push origin v1.0.0
```

After the workflow completes, the Release will appear under GitHub → Releases and the release assets (webapp zip) will be attached. The Docker images will be available at:

```
ghcr.io/<OWNER>/realmint-api:v1.0.0
ghcr.io/<OWNER>/realmint-web:v1.0.0
```

Notes:
- The release workflow requires a repository secret `CR_PAT` (a personal access token with `write:packages` and `repo` scopes) to push images to GHCR. Set it under repo Settings → Secrets.
- You can also trigger the release workflow manually using the Actions tab and then attach the proper tag.

3) TLS and reverse proxy

- Use a fronting reverse proxy (nginx, Traefik) with TLS provided by Let's Encrypt. Ensure HSTS is enabled and CSP is applied through HTTP headers rather than meta tags.

4) Environment variables and secrets

- Do not commit secrets. Use your cloud provider secret manager, GitHub Secrets for Actions, or an encrypted vault.
- Example required values: DATABASE_URL, SECRET_KEY (Flask), NFT_STORAGE_KEY, WEB3_RPC_URL(s), CONTRACT_ADDRESSES for production.
Local Redis for testing
-----------------------
To run a local Redis instance for session and rate-limiter testing, use the provided compose file:

```bash
docker compose -f deploy/docker-compose.redis.yml up -d
# then run tests pointing REDIS_URL to redis://localhost:6379/0
REDIS_URL=redis://localhost:6379/0 pytest -q
```

5) Monitoring & logs

- Ship logs to a central logging system (e.g. Papertrail, LogDNA, ELK). Use structured JSON logs in API.
- Add error monitoring (Sentry) and basic metrics (Prometheus exporter + Grafana).
  - Sentry: set SENTRY_DSN in your environment or secrets to enable error capture from the API.
  - The CI performs a CSP safety check on the built frontend and will fail if inline scripts/styles are present; this prevents deploying a policy that requires nonces/hashes without proper build-time support.

6) Security

- Run a security audit for contracts (professional auditor) and fix high/critical issues.
- Lock dependency versions and keep software up-to-date. Use Dependabot or similar.
- Set strict CSP via HTTP header and enable only required origins/hosts. Prefer nonces or hashes for inline scripts.
- Rate-limit admin endpoints. Use authentication and strong session management.

7) CI

- The included GitHub Actions workflow (/.github/workflows/ci.yml) compiles contracts, syncs ABIs, builds the frontend, runs backend tests, and uploads the `dist/` artifact.

8) Next steps

- Add a `docker-compose.prod.yml` to orchestrate `realmint-api`, `realmint-web` (nginx), and optionally a database.
- Add a release process for creating images, tagging, and pushing to your container registry.

Quick local deploy using Docker Compose (production-like)

1) Place the built frontend into `webapp/dist` (CI artifact or local build). If you used the CI artifact, extract it into `webapp/dist`.

2) Start the services:

```bash
# from repo root
docker-compose -f docker-compose.prod.yml up --build -d
```

3) Verify:

```bash
# check logs
docker-compose -f docker-compose.prod.yml logs -f web
docker-compose -f docker-compose.prod.yml logs -f api

# open http://localhost in your browser
```

Notes:
- The included `nginx/nginx.conf` enforces a strict CSP header (no 'unsafe-inline') once the CI check passes. If you add trusted inline scripts, prefer nonces or precomputed hashes and update CI accordingly.
- For real deployments, configure TLS (reverse-proxy/letsencrypt) in front of this stack and store secrets in a secure store.

