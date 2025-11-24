Ethers v6 migration notes

This project migrated the frontend dApp to ethers v6 and adopted BigInt-based arithmetic in places that previously used ethers v5 BigNumber.

Summary
- Frontend (`webapp/src`) now uses ethers v6 top-level helpers (e.g., `ethers.parseUnits`, `ethers.formatUnits`, `ethers.getAddress`, `ethers.keccak256`, `ethers.toUtf8Bytes`).
- BigNumber -> BigInt: on-chain numeric values returned by ethers v6 are handled as JS `bigint` (e.g., `BigInt(value.toString())`) and arithmetic uses native `BigInt`.
- Provider helpers: `ethers.BrowserProvider` and `ethers.JsonRpcProvider` are used in the webapp to obtain signers/providers.
- Contracts and node scripts: updated to use ethers v6 where applicable; tests were updated to use BigInt arithmetic.

Key migration guidance
1. Numeric values
   - When interacting with contract-returned numeric values in tests or Node scripts, treat them as `bigint`:
     const amountBn = BigInt(value.toString());
   - Avoid `ethers.BigNumber` APIs; prefer native `BigInt` for arithmetic.

2. Parsing/formatting
   - Use v6 top-level helpers:
     - Parse user-entered amounts: `ethers.parseUnits("1.23", decimals)` -> returns `bigint`.
     - Format on-chain bigints: `ethers.formatUnits(bigintValue, decimals)` -> string.

3. Signing / hashing
   - Use `ethers.keccak256` and `ethers.toUtf8Bytes` for keccak operations.
   - For solidity-style packed hashing: `ethers.keccak256(ethers.solidityPacked(types, values))`.
   - Use `ethers.getBytes()` when you need a Uint8Array for signing.

4. Providers and signers
   - Prefer `ethers.BrowserProvider` (v6) in the browser.
   - For Node scripts, `ethers.JsonRpcProvider` is the v6 top-level class.

5. Tests & scripts
   - Update tests that previously used `BigNumber` `.add()`/`.sub()` to use `BigInt` math.
   - Ensure `package.json` devDependencies for contract tests (Hardhat) are consistent with ethers v6.

Files changed in this migration (high level)
- Frontend: `webapp/src/utils/web3.js`, `webapp/src/utils/aaveHelpers.js`, `webapp/src/utils/eip712.js`, `webapp/src/utils/ethersProvider.js`, `webapp/src/components/LendingWidget.jsx`, and additional component cleanups.
- Scripts/tests: `contracts/scripts/e2e_sign_pin_publish.js`, `scripts/check-owner.js`, `contracts/test/aave-flow.test.js` and other contract tests adjusted.

Build & test notes
- Frontend: `cd webapp && npm run build` should produce a successful vite build into `webapp/dist/`.
- Contracts/tests: `cd contracts && npm ci && npm test` runs the Hardhat test suite (requires Node and dev dependencies installed).

Common pitfalls
- Mixing `BigInt` and `Number` in arithmetic (throws). Use `BigInt()` conversions and avoid mixing types.
- Some third-party packages or prebuilt bundles may still reference named exports — we resolved these by standardizing imports and adjusting a few call sites; prefer code-level migrations over forcing Vite aliasing.

If you want, I can:
- Finish a short PR-style changelog summarizing the exact patches.
- Add fast unit tests covering the most critical BigInt-based helpers.
- Remove any remaining build-time shims or aliases from `webapp/vite.config.js` if you want a final tidy.

