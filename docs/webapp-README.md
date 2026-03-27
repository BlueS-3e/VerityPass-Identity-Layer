# VerityPass Launchpad (frontend)

This folder contains the React + Vite frontend for the VerityPass Launchpad / Sovereign Identity project.

Quick start

1. Install dependencies

```bash
cd webapp
npm install
```

2. Run dev server

```bash
npm run dev
```

3. Open the app (Vite will print the local URL) and visit `/attest` to try the attestation flow.

Notes

- The `src/utils/eip712.js` provides helpers to build EIP-712 typed data and request signatures from an injected wallet (ethers v6).
- The `src/utils/web3.js` and `src/utils/legacyWeb3.js` include helpers for on-chain interactions. `legacyWeb3` mirrors older top-level helpers and can be removed after migration.
- `src/config.js` contains network and contract address configuration used by the frontend.

Cleaning

- The `build/` and `dist/` folders are removed from the working tree — they are generated artifacts and should not be checked into source control.

Next steps

- Deploy `AttestationRegistry` on your target testnet/mainnet and update `src/config.js` with the deployed address so the UI auto-fills it.
- Add explorer links and UX polish as needed.
