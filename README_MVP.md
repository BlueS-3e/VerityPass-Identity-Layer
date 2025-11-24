# RealMint Launchpad — MVP runbook

Quick steps to run the dApp for MVP testing (frontend + API + contracts)

Prerequisites
- Node.js (16+), npm/yarn
- Python 3.10+ and pip
- Hardhat (installed via npm)

1) Install frontend deps

```bash
cd webapp
npm install
npm run dev
```

2) Install backend deps and run API

```bash
cd api
python3 -m pip install -r requirements.txt
# set secrets
export NFT_STORAGE_API_KEY=your_key_here
export ADMIN_PASSWORD=some_secure_pw
FLASK_APP=app.py python3 -m flask run
```

3) Contracts (optional local node)

```bash
cd contracts
npx hardhat node
# in another terminal, deploy to local node or use pre-deployed addresses
npx hardhat test
```

4) E2E helper (sign → pin → publish)

```bash
# Start local hardhat node and API server, then run:
node contracts/scripts/e2e_sign_pin_publish.js
```

Notes
- Ensure `VITE_API_BASE` and `VITE_CONTRACT_ADDRESS` are set in your webapp environment if not using defaults.
- The API will print a warning if `NFT_STORAGE_API_KEY` is missing.

Run the full dApp locally (backend + frontend)

1. Start the backend API (recommended helper)

	The repository includes a helper script to create a venv, install dependencies and run the API with reasonable defaults for local development:

	```bash
	cd api
	chmod +x run_dev.sh
	./run_dev.sh
	```

	If you prefer manual steps, see `api/.env.example` for environment variables you should set. The app exposes `/api/frontend-config` and `/api/health` which the frontend uses at boot.

2. Start the frontend (webapp)

	By default Vite's dev server runs on `http://localhost:5173` and the backend helper runs on `http://localhost:5000`.

	- If you built the frontend with `VITE_API_BASE` embedded, it will use that value at runtime.
	- If you did not set `VITE_API_BASE`, the frontend will attempt to fetch `/api/frontend-config` from the same origin and use the `api_base` returned by the server.

	Start the dev server:

	```bash
	cd webapp
	# Optional: when running the frontend dev server on a different port than the API,
	# set VITE_API_BASE so the app targets the backend without relying on runtime fetches.
	# This is useful when running Vite (5173) and the API on 5000.
	export VITE_API_BASE=http://localhost:5000
	npm ci
	npm run dev
	```

	Open `http://localhost:5173` in your browser. If you see a "Backend unreachable" overlay, ensure the API is running and reachable at the configured API base (see `VITE_API_BASE` or the returned `api_base` from `/api/frontend-config`).

3. Start the admin UI (optional)

	The admin UI is a separate app in `webapp-admin` and can be started likewise:

	```bash
	cd webapp-admin
	npm ci
	npm run dev
	```

	The main webapp will redirect `/admin` to the `VITE_ADMIN_HOST` you specify at build time or to the `admin_ui_url` provided by `/api/frontend-config` at runtime.
