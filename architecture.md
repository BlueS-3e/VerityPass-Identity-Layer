# Architecture and Tech Decisions — Sovereign Identity & Under-Collateralized Lending (MVP)

This document captures the recommended architecture, component responsibilities, key design decisions, privacy options and an initial milestone roadmap for converting the existing VerityPass Launchpad starter into the Sovereign Identity + Under-Collateralized Lending dApp described in the PRD.

---

## Goals (MVP)
- Provide a non-custodial identity registry where users can create a sovereign identity (on-chain pointer to user metadata).
- Enable trusted attestations from issuers (off-chain issuance, on-chain attestation record) that can be used to compute a verifiable credit score.
- Demonstrate under-collateralized lending in a controlled simulation: allow lender pools to accept loans with reduced collateral requirements based on on-chain attestations / scores.
- Keep personally-identifying data off-chain and privacy-preserving by default.

## Constraints & Non-Goals (MVP)
- Not a production lending engine at MVP. We'll build a proof-of-concept lending flow (simulation + limited capital pools) and focus on identity / attestations.
- No full regulatory compliance baked into the MVP. Legal analysis will follow before any real-money launch.

## High-level Components

1.  Smart Contracts (Solidity)
    - IdentityRegistry (ERC-725-style minimal registry)
      - Register identityOwner -> metadataCID (IPFS) record
      - Emit events when identity updated
    - AttestationRegistry
      - Stores attestations (issuer, subject, schemaHash, attestationCID or compact attestation data)
      - Performs simple validation on attestation submission (signed issuer, optional expiry)
      - Allows attestations to be submitted by trusted issuers or via an on-chain merkle root published by the backend
      - Emits events for off-chain indexers
    - CreditScoreManager (MVP)
      - Maps identity -> hashed score pointer or on-chain score record
      - Supports oracle/authorized submitters to publish aggregated scores (admin role at first)
    - LendingSimulation (MVP)
      - Create lender pools and simulate loan issuance with configurable collateral ratios based on creditScore tiers

2.  Off-chain Backend & Aggregator (Flask initially)
    - Receives signed attestations from third-party issuers (or from user via adapter)
    - Aggregates and computes credit score proofs (initially centralized/transparent algorithm)
    - Publishes attestations or Merkle roots to `AttestationRegistry` as needed
    - Stores encrypted PII and raw proofs in DB (only when user consents)

3.  Connectors & Issuers (PoC)
    - Mock connectors for Plaid, Exchange proof, Gig-platform (initially mocked data to validate UX)
    - Production connectors must use signed issuance by trusted issuers or Oauth flows that result in signed attestations

4.  Frontend (React + Vite)
    - Wallet onboarding and chain switch UI (reuse `frontend/web3.js`) — support MetaMask, WalletConnect
    - Identity creation flow (write metadata to IPFS, store pointer on-chain)
    - Attestation request flow: request issuer -> receive signed attestation -> submit to backend/or directly on-chain
    - Credit score viewer and lending simulation UI

5.  Storage & Indexing
    - IPFS / Web3 Storage for user metadata and attestations (CID pointers stored on-chain)
    - Off-chain DB (SQLite / Postgres depending on scale) for aggregator and audit logs
    - Indexer (simple service) to respond to UI queries for attestations and events

## Data Model (high level)
- Identity: { owner: address, metadataCID: string, createdAt }
- Attestation: { issuer: address, subject: identityId/address, schemaHash, dataCID, issuedAt, expiresAt, signature }
- CreditScoreRecord: { subject, scoreHash, scoreBucket, attestationPointers[] }

Keep raw PII encrypted and off-chain; on-chain only references (CIDs / hashes) and signatures.

## Privacy & ZK Roadmap

Short-term (MVP)
- Use hashed attestations and CIDs stored on-chain (no raw PII on-chain)
- Data stays off-chain; users explicitly approve publishing of attestations
- Use selective disclosure via encrypted off-chain storage: user shares decryption keys with verifiers when required

Medium-term
- Integrate ZK patterns for privacy-preserving verification:
  - Use Circom / SnarkJS or a hosted zk toolchain to produce proofs of "income >= $X" without revealing raw bank data.
  - Explore Semaphore (anonymous reputation), zkSync / Polygon ZK toolchains for production-grade proving systems.

Long-term
- Move core scoring logic into on-chain-verifiable zk-proofs so lenders can verify score assertions without peer access to raw data.

## Testnet & Deployment Recommendations
- Development / unit testing: Foundry or Hardhat (both supported); unit tests in Solidity are required.
- Recommended testnets for initial integration:
  - Ethereum Sepolia (or the currently supported canonical Ethereum testnet) for broad tooling compatibility.
  - Polygon Mumbai for faster, cheaper testing and for potential Polygon grants.
  - Optional: BSC Testnet (if you want to keep BSC compatibility from the starter project).

Notes: For dev convenience, keep truffle artifacts around if needed; but prefer Hardhat or Foundry for modern dev experience and testing.

## Tooling & Libraries
- Contracts: Solidity ^0.8.x
- Dev & Tests: Hardhat (TypeScript) or Foundry (Rust-based tooling). Start with Hardhat for JS-friendly workflow.
- Frontend: React + Vite (already present) + ethers.js
- Backend: Flask (existing) for attestation aggregator; consider adding a Node microservice later for connector adapters
- Storage: IPFS (web3.storage or nft.storage) for metadata
- ZK: Circom + SnarkJS / Halo2 / zkSync depending on path chosen

## Security & Access Control (MVP)
- Use OpenZeppelin libraries for RBAC, Ownable, Roles and safe math
- Keep an `ADMIN` role for oracles and attestation publication during MVP; plan to decentralize role later
- Enforce signature verification for attestations: verify issuer signature against registered issuer addresses

## Milestones (First 6 weeks)
1.  Week 1: Create `smart-contract-spec.md` and scaffold Hardhat project. (Deliverable: spec + empty project)
2.  Week 2–3: Implement IdentityRegistry + AttestationRegistry + unit tests. Deploy to Sepolia / Mumbai. (Deliverable: contracts + tests)
3.  Week 4: Backend aggregator endpoints to accept signed attestations (Flask). Mock connectors for Plaid/exchange. (Deliverable: API + DB schema)
4.  Week 5: Frontend identity onboarding and attestation submission flows (React). Wire wallet connect + basic UI. (Deliverable: demo UI)
5.  Week 6: CreditScoreManager (oracle) + lending simulation contract + end-to-end demo on testnet.

## Developer Workflow
- Branch from `main` ⇒ `feature/identity-mvp`
- Work in small PRs: contract + tests, backend API, frontend flow
- CI: run Solidity unit tests + lint on PRs; run frontend build

## Next Steps (immediate)
1. Create `smart-contract-spec.md` (detailed fields, events, roles). — I will create this next after you review this architecture.
2. Decide toolchain (Hardhat vs Foundry). I recommend Hardhat for JS familiarity.
3. Scaffold Hardhat folder and example contract (IdentityRegistry) and unit tests.

---

If this architecture looks good, I will: (A) add `smart-contract-spec.md` next and scaffold a Hardhat project, or (B) scaffold the contract + minimal tests immediately. Tell me which to do next.
