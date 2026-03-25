# RealMint: BNB Chain Identity & Under-Collateralized Lending

## Summary
RealMint provides a privacy-preserving identity and attestation layer that enables under-collateralized lending on **BNB Chain**. It combines sovereign identity, issuer attestations, and credit score oracles with a production-ready dApp stack (Solidity contracts, Flask API, React webapps). The MVP is deployed to **BNB Chain Testnet (chain 97)** and prepared for **BNB Chain Mainnet (chain 56)** production hosting (Vercel + Render).

## Problem
- 1.7B unbanked people can't access credit due to lack of collateral or centralized credit history
- Identity verification is costly, siloed, and privacy-invasive
- DeFi lending is mostly over-collateralized (150%+), limiting real-world utility and financial inclusion
- BNB Chain is fast & affordable, but lacks identity primitives for credit scoring

## Solution
- **On-chain identity registry** with issuer-verified attestations
- **Privacy-first credit scoring oracle** integrating data sources (e.g., Plaid-backed financial signals)
- **RealMint Launchpad contract** enabling under-collateralized lending (25-50% collateral ratios) based on attestations
- **BNB Chain first** design to maximize finality speed and minimize transaction costs for end users
- Roadmap to **ZK proofs** for privacy-preserving credential verification without exposing PII

## Why BNB Chain
- **Fast & Low-Cost:** 1-second finality, $0.01 transaction costs enable mass adoption
- **Ecosystem Ready:** 500K+ daily active users with strong fintech integration
- **Strategic Alignment:** BNB Builders Fund prioritizes financial inclusion, DeFi 2.0, and identity infrastructure
- **Production Proven:** RealMint's dApp stack is battle-tested; BNB Chain is the ideal scaling layer
- **Global Accessibility:** BSC's global liquidity and exchange partnerships support emerging markets

## Architecture Overview
- **Smart Contracts (Solidity 0.8.20):** IdentityRegistry, AttestationRegistry, CreditScoreManager, RealMintLaunchpad
- **Backend (Flask API):** RBAC, Plaid integration, session & rate limiting, Web3 RPC aggregation for BNB Chain
- **Frontend (React + Vite):** Wallet connection, attestation UI, credit score visualization, lending flows
- **Infrastructure:** Vercel (webapp), Render (API, PostgreSQL, Redis), BSC Testnet & Mainnet RPC nodes, GitHub Actions CI/CD

## Public Good Impact
- **Open, composable identity/attestation primitives** reusable by other BNB dApps
- **Expands BNB DeFi utility** via under-collateralized lending with privacy safeguards
- **Promotes financial inclusion** with transparent, auditable governance mechanisms
- **Reference implementation** for identity-based lending infrastructure on BSC

## Deployment Status
- ✅ **RealMint Launchpad:** `0xF5Cb13Cf46174B81bf9860E502d698Fe76B5F12a` (Testnet)
- ✅ **AttestationRegistry:** `0x2B5a1c4749b95b48F5Faf53cEd0130b21725e4a0` (Testnet)
- ✅ **Wallet integration:** Modern EIP-6963 detection + Web3Modal
- ✅ **Frontend:** Production build passing; ready for testnet UI testing
- 🔄 **Mainnet deployment:** Ready after testnet validation & community feedback

## Roadmap (6 months)
- **Month 1–2:** Testnet operations & admin workflows; issuer onboarding (BNB Builders, institutional partners)
- **Month 2–3:** Mainnet deployment + Etherscan verification; first lending flows with pilot users
- **Month 3–4:** Data source expansion (Plaid + partner APIs); attestation issuers launched
- **Month 4–5:** ZK proof prototypes for privacy-preserving attestations
- **Month 5–6:** Security audit + production hardening; governance framework + community vote

## Milestones
- **M1:** Testnet contracts live with admin governance workflows; role-based access control verified
- **M2:** Mainnet contracts deployed and verified; operations console (webapp-admin) live
- **M3:** 3+ attestation issuers integrated; 50+ identities verified on Testnet
- **M4:** End-to-end lending demo on Testnet; ZK attestation proof-of-concept
- **M5:** Third-party security audit completed; critical remediation shipped

## Success Metrics
- 3+ attestation issuers integrated by Month 3
- 100+ verified identities with on-chain attestations by Month 4
- 50+ lending interactions in pilot phase by Month 5
- <1% critical incident rate post-audit; MTTR < 2 hours
- 500+ active monthly users on Testnet within 6 months

## Budget (Summary)
- **Security audit (Tier-1):** $15,000
- **Infrastructure (Render, Vercel, RPC, monitoring):** $8,000
- **Development (part-time engineering, 6 months):** $28,000
- **Legal/compliance review:** $6,000
- **Community & documentation:** $3,000
- **Total:** $60,000

### Budget Justification
- **Audit is critical:** Lending + identity touching user funds require professional security review
- **Infrastructure:** BSC Testnet + Mainnet RPCs, PostgreSQL, Redis, monitoring—necessary for production operations
- **Development:** Full-stack (contracts, API, frontend, admin console) requires experienced engineers
- **Community:** Public dashboards, grant reporting, contributor guides attract ecosystem participation

## Team
- **Core Contributors:** Smart contract engineering, backend API development, React frontend, DevOps/infrastructure
- **Advisors:** Identity experts, DeFi protocol experience, BNB Chain ecosystem veterans
- **Details:** GitHub profiles, prior contributions (see GRANT_TEAM.md)

## Open Source & Licensing
- **Repository:** `realmint-platform` (public on GitHub)
- **License:** MIT (permissive, enables ecosystem integration)
- **Governance:** Community-driven; grant reports published quarterly

## Reporting & Stewardship
- **Quarterly progress reports** published on GitHub + community forums
- **Public dashboards** for usage metrics (attestations, lending volume, active users)
- **Post-audit artifacts** and security disclosures per SECURITY.md
- **Role-audit logs** showing governance actions for transparency

## Competitive Advantage on BNB Chain
1. **First-to-market** identity + lending primitive on BSC
2. **Privacy-first design** differentiates from centralized credit scoring
3. **Proven stack** battle-tested on Ethereum; optimized for BNB Chain performance
4. **Enterprise-ready** admin console for operations & governance
5. **Multi-issuer model** enables ecosystem participation (vs. single-vendor solutions)

## Alignment with BNB Builders Fund Priorities
- ✅ **Yield Discovery & Risk Analytics:** Credit scoring oracle enables risk-aware yields
- ✅ **DeFi 2.0 + AI:** Attestation-based lending is next-gen DeFi; roadmap includes ML-powered risk models
- ✅ **Financial Inclusion:** Identity + under-collateralized lending for 1B+ unbanked users
- ✅ **New Frontiers (Neobanking):** Lending flows + issuer integrations = Web3 neobank building blocks

## Request
We request **$60,000 USD equivalent in BNB** from the BNB Chain Builders Fund to:
1. Execute security audit + production deployment to Mainnet
2. Fund development team through 6-month milestones
3. Build identity + lending infrastructure as a reusable public good on BSC
4. Support emerging markets financial inclusion via low-cost, non-custodial identity

---

## Next Steps for Reviewers
1. Review testnet demo: [AttestationRegistry on BSCScan](https://testnet.bscscan.com/address/0x2B5a1c4749b95b48F5Faf53cEd0130b21725e4a0)
2. Test dApp on BNB Chain Testnet faucet-funded wallet
3. Review open-source code on GitHub: [realmint-platform](https://github.com/rhiper/realmint-platform)
4. Schedule engineering call to discuss roadmap & integration opportunities
