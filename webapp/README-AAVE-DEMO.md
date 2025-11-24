Aave Demo — Minimal Setup

This file describes a minimal way to run the Aave demo page locally for testing approve → supply → borrow flows.

Prerequisites
- Node.js and npm
- A local Hardhat/Anvil or an RPC endpoint you control for a testnet
- A wallet (MetaMask) connected to the same RPC

Quick steps (local fork with Hardhat)

1. Start a Hardhat node fork (example uses INFURA/ALCHEMY env var pointing to mainnet or testnet RPC if you want specific blocks):

```bash
# from project root
npx hardhat node --fork <RPC_URL> --port 8545
```

2. Deploy test ERC20s and a simple mock Pool or use existing deployed Aave addresses on a supported network. For quick testing you can deploy MockERC20 from `contracts/MockERC20.sol` (already present in the repo) using a small Hardhat script.

3. In your frontend, set environment variables (Vite):

```
VITE_AAVE_POOL_ADDRESS=0xYOUR_POOL_ADDRESS
VITE_AAVE_PRICE_ORACLE=0xYOUR_PRICE_ORACLE_ADDRESS
```

You can also configure these values at runtime from the backend without rebuilding the frontend. The API endpoint `/api/frontend-config` exposes two optional keys that the frontend will read (and prefers when present):

- `aave_pool_address`
- `aave_price_oracle`

To provide them from the server, set the corresponding environment variables (for example in your deployment):

```
VITE_AAVE_POOL_ADDRESS=0xYOUR_POOL_ADDRESS
VITE_AAVE_PRICE_ORACLE=0xYOUR_PRICE_ORACLE_ADDRESS
```

When the backend is running, these values will appear in the JSON returned by `/api/frontend-config` and the demo UI will show them in the "Demo Information" panel. Changing those server env vars and reloading the page is sufficient — no frontend rebuild is necessary.

The demo also exposes a **Refresh Config** button in the Demo Information panel which re-reads `/api/frontend-config` and updates the displayed values (and a small "Last fetched" timestamp) without requiring a full page reload.

4. Start the frontend dev server and open the demo page:

```bash
cd webapp
npm run dev
# open http://localhost:5173/aave-demo
```

Running the demo helper and tests (Hardhat)

For an automated local demo and tests, use the Hardhat project in `contracts/`.

Start a Hardhat node (in one terminal):

```bash
cd contracts
npx hardhat node
```

Deploy the demo contracts to the running node:

```bash
cd contracts
npx hardhat run scripts/demo-aave.js --network localhost
```

Run the automated approve→supply→borrow test (runs locally against Hardhat network):

```bash
cd contracts
npx hardhat test test/aave-flow.test.js
```

Notes
- This demo is intentionally minimal to stay focused on the core flow. For CI-level testing, create a small Hardhat script that deploys a simple mock Pool (supply/borrow emulation) and uses a deterministic account to run approve→supply→borrow.
- Do NOT use mainnet accounts/funds with this demo unless you fully understand the implications.

If you want, I can add a Hardhat script and a small test that runs the flow on a local fork automatically. Say "add fork test script" and I'll add it next.