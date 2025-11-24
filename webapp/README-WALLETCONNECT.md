WalletConnect and legacy wallet UI (archived)

Summary
- The project previously included several in-UI wallet components (in `src/components`) and optional WalletConnect v2 support via Web3Modal/wagmi.
- To keep the core browsing and project flows lightweight and avoid shipping unnecessary UI, the on-page wallet UI and the global `WalletProvider` have been removed from the active frontend.
- The legacy wallet components and helper code have been archived under `src/legacy-wallets/` so they can be restored later if you decide to re-enable wallet onboarding.

What was archived
- `webapp/src/legacy-wallets/WalletSelector.jsx` — injected wallet chooser (MetaMask, Coinbase, etc.)
- `webapp/src/legacy-wallets/WalletConnectButton.jsx` — legacy WalletConnect v1 QR flow
- `webapp/src/legacy-wallets/WalletModal.jsx` — legacy modal that used the above helpers
- `webapp/src/legacy-wallets/providerDetect.js` — helper to detect injected providers
 - `webapp/src/legacy-wallets/WalletContext.jsx` — archived wallet React context/provider

Why
- The app's current product objective does not require a global connected account or signups; keeping wallet UI out of the main header reduces complexity and potential user confusion.

Re-enable wallet support (how-to)
1) Restore the archived components into the active components folder (or import them from `src/legacy-wallets/`):

	- Move files back to `webapp/src/components/` or update imports that reference `legacy-wallets`.

2) Re-mount the wallet context provider in `webapp/src/main.jsx` by wrapping the app in the `WalletProvider` again (restore the original wrapper):

	- import { WalletProvider } from './context/WalletContext';
	- Wrap the app children where the comment currently notes the provider was removed.

3) (Optional) Install WalletConnect v2 + Web3Modal + wagmi if you want modern mobile flows:

```bash
cd webapp
npm install --no-audit --no-fund wagmi @web3modal/react
```

If you have flaky network or timeouts, try increasing npm retries and timeouts before install:

```bash
npm set fetch-retries 5
npm set fetch-retry-factor 10
npm set fetch-retry-mintimeout 20000
npm set fetch-retry-maxtimeout 120000
npm set timeout 600000
npm install --no-audit --no-fund
```

4) After installing, update or replace the modal implementation in `src/components/WalletModal.jsx` (or create a new modal) to initialize wagmi and Web3Modal with your WalletConnect project id:

```
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

Notes and troubleshooting
- A production build and quick smoke tests were performed after removing the active wallet UI; the app builds successfully.
- If you re-enable wallets, run the full frontend build and smoke test these flows:
  - Injected wallets (MetaMask): connect, sign, switch network flows
  - WalletConnect (mobile): open QR modal, complete mobile pairing
- If you want, I can prepare a small script to automate install retries and to scaffold a Web3Modal-enabled `WalletModal.jsx` implementation.

If you'd like me to proceed with re-enabling a specific flow (lightweight injected-only chooser, or full wagmi/Web3Modal integration), tell me which and I'll implement it and run the build/tests.
