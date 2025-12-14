# RealMint: Decentralized Identity & Under-Collateralized Lending

## Summary
RealMint provides a privacy-preserving identity and attestation layer that enables under-collateralized lending on Ethereum. It combines sovereign identity, issuer attestations, and credit score oracles with a production-ready dApp stack (Solidity contracts, Flask API, React webapps). The MVP is deployed to Sepolia and prepared for mainnet and production hosting (Vercel + Render).

## Problem
- Access to credit is limited for users without collateral or centralized credit history.
- Identity verification is costly, siloed, and privacy-invasive.
- DeFi lending is mostly over-collateralized, limiting real-world utility.

## Solution
- On-chain identity registry with issuer-verified attestations.
- Credit score manager integrating oracle data (e.g., Plaid-backed signals).
- RealMint Launchpad contract enabling lending flows based on attestations and scores.
- Privacy-first design: PII kept off-chain, on-chain references (hashes), with a roadmap to ZK proofs.

## Why Ethereum
- Neutral, globally accessible settlement layer.
- Rich tooling (OpenZeppelin, Hardhat, Chainlink) and established verification ecosystem.
- Strong public goods culture aligned with identity and financial inclusion.

## Architecture Overview
- Smart Contracts (Solidity 0.8.20): IdentityRegistry, AttestationRegistry, CreditScoreManager, RealMintLaunchpad
- Backend (Flask API): RBAC, Plaid integration, session & rate limiting, Web3 RPC aggregation
- Frontend (React + Vite): Wallet connection, attestation UI, credit score visualization, launchpad flows
- Infra: Vercel (webapp), Render (API, PostgreSQL, Redis), CI/CD via GitHub Actions

## Public Good Impact
- Open, composable identity/attestation primitives reusable by other dApps.
- Expands DeFi utility via under-collateralized lending with privacy safeguards.
- Promotes financial inclusion with transparent, auditable mechanisms.

## Roadmap (6 months)
- Month 1–2: Mainnet deployment + Etherscan verification; initial issuer onboarding
- Month 3: End-to-end flows with pilot users; expand data sources
- Month 4: ZK proof prototypes for attestations (no PII exposure)
- Month 5: Security audit + production hardening; monitoring & incident runbooks
- Month 6: Governance + community integrations; grant reporting

## Milestones
- M1: Mainnet contracts deployed and verified (Launchpad, Registries)
- M2: Attestation issuers integrated; Plaid data pipeline stabilized
- M3: dApp live on Vercel; API live on Render with metrics & alerts
- M4: ZK attestation demo (proof of membership/credentials)
- M5: Third-party security audit completed; remediation shipped

## Success Metrics
- 3+ attestation issuers integrated
- 100+ verified identities with on-chain attestations
- 50+ lending interactions in pilot phase
- <1% critical incident rate post-audit; MTTR < 2 hours

## Budget (Summary)
- Security audit: $15,000
- Infrastructure (Render, Vercel, RPC, monitoring): $8,000
- Development (part-time engineering, 6 months): $28,000
- Legal/compliance review: $6,000
- Community & documentation: $3,000
- Total: $60,000

## Team
- Core contributor(s): Engineering, smart contracts, backend, frontend
- Links: GitHub profiles, prior open-source contributions (to be listed in GRANT_TEAM.md)

## Open Source & Licensing
- Repository: `realmint-platform` (to be made public upon grant acceptance or earlier)
- License: MIT or Apache-2.0 (finalize in repo root)

## Reporting & Stewardship
- Quarterly progress reports
- Public dashboards for usage metrics
- Post-audit artifacts and security disclosures per SECURITY.md

## Request
We request ecosystem support to fund audit, infra, and development to deliver a privacy-preserving, identity-based lending infrastructure as a reusable public good on Ethereum.