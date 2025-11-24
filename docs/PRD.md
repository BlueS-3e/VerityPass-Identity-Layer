# PRD: Sovereign Identity & Under-Collateralized Lending (MVP)

Date: 2025-10-26
Author: Engineering Team

## Purpose
Provide a compact product requirements document for the MVP: a Sovereign Identity system that enables verifiable attestations and a simple credit score mechanism enabling under-collateralized lending experiments.

## Target users
- Builders and researchers experimenting with decentralized identity and lending (DevOps, Protocol engineers).
- Early adopters: small lending pools and DAOs wanting simple KYC-lite attestations.
- Credential issuers (KYC providers, employers, exchanges) for PoC attestations.

## Value proposition
- Users control identity attestations off-chain (IPFS) and publish on-chain when desired.
- Attestations use EIP-712 for robust cross-wallet signing compatibility.
- CreditScoreManager stores oracle-validated scores enabling simple under-collateralized lending experiments.

## MVP Scope (must-haves)
1. Identity & Attestation primitives
   - Smart contracts: `IdentityRegistry`, `AttestationRegistry` with EIP-712 typed verification and `publishAttestationTyped`.
   - Off-chain attestation object format (JSON Schema) and canonical hashing.
2. Backend attestation service
   - Accept signed attestations, validate signatures (legacy and EIP-712), pin attestation JSON to IPFS via nft.storage, return calldata for `publishAttestationTyped` for client submission.
3. Frontend flows
   - Wallet-based attestation signing (ethers v6), pin endpoint integration, display returned `call_payload` and let user submit transaction from their wallet.
   - Basic onboarding UI for creating an identity and requesting attestations.
4. Tests & dev tooling
   - Unit tests for contracts (Hardhat/ethers), backend pytest for signature variants, and a small end-to-end (local) flow to sign -> pin -> publish.

## Non‑goals for MVP
- Production relayer that signs/pays gas to publish attestations (optional follow-up).
- Full KYC integrations (Plaid/etc.) — will be mocked for PoC.
- Sophisticated privacy or ZK proofs (research phase).

## Success metrics (initial)
- Functional: a developer can run the local flow to sign an attestation, pin to IPFS, and successfully call `publishAttestationTyped` on a local testnet.
- Tests: contract unit tests and backend tests pass in CI; EIP-712 compatibility coverage across 2 wallets (MetaMask desktop + WalletConnect mobile emulator).
- Usability: a new user can complete the attestation flow within 5 minutes after running the dev setup instructions.

## Constraints & assumptions
- Wallets used support EIP-712 and legacy `personal_sign` (we will normalise both server-side).
- MVP will rely on a third‑party pinning service (`nft.storage`) — trust and availability assumptions apply.
- Gas costs are paid by the user wallet for on-chain publication (no relayer by default).

## Data shapes (brief)
- Attestation JSON (canonical):
  - issuer (address), subject (address), schemaHash (bytes32), data (JSON object), validFrom, validTo, metadata (optional)
- Backend persists: attestation JSON, pinned CID, recovered signer, timestamp

## Security considerations
- Validate signatures robustly (support v=27/28 vs 0/1, hex/no-hex). Add unit tests for variants.
- Do not accept attestations unless signature recovers expected issuer.
- Rate-limit pin endpoint in staging/CI and add basic auth for production.

## Milestones & timeline (proposed short plan)
1. (1 day) Finalize PRD and EIP-712 typed schema definitions.
2. (2–3 days) Harden `AttestationRegistry` EIP-712 verification and add unit tests.
3. (1–2 days) Backend endpoint: signature recovery & pinning, unit tests for signature variants.
4. (1–2 days) Frontend attestation UI and _signTypedData flow, integrate pin endpoint and client-side publish helper.
5. (1 day) Local end‑to‑end test and documentation for running locally.

## Next immediate actions (this sprint)
- Create definitive EIP-712 domain & types document for attestations and align contract and frontend builders.
- Implement on-chain EIP-712 verification tests to ensure parity with client-signed typed data.

## Appendix: contacts & owner
- Product owner: (TBD)
- Engineering lead: (TBD)

---

(Keep this PRD short; expand into a fuller product spec and roadmap once core EIP-712 flow is verified end-to-end.)