# RealMint Platform

> Bringing self-sovereign identity to emerging markets through blockchain-powered attestation and verification

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/BlueS-3e/realmint-platform)](https://github.com/BlueS-3e/realmint-platform/issues)
[![Node.js 22](https://img.shields.io/badge/Node.js-22%20LTS-green)](https://nodejs.org/)
[![Solidity 0.8.20](https://img.shields.io/badge/Solidity-0.8.20-blue)](https://docs.soliditylang.org/)

## 🎯 Overview

**RealMint** is a decentralized platform enabling secure, self-sovereign identity management for emerging market participants. Users can register identity attestations on-chain, access DeFi services with verified credentials, and maintain full control of their data without intermediaries.

The platform combines:
- **Smart Contracts** (Solidity) for immutable attestation registry and launchpad logic
- **React Webapp** (Vite) for intuitive identity verification UX
- **Python API** (Flask) for backend services and integrations
- **Blockchain Network** (BSC Testnet, mainnet Q2 2026)

## 🌟 Key Features

### Identity & Attestation
- **Self-Sovereign Identity**: Users control their private keys and identity data
- **Verified Issuers**: Only trusted KYC/AML providers can publish attestations
- **Immutable Records**: All attestations stored permanently on-chain
- **EIP-712 Signatures**: Cryptographically secure, human-readable signing standard

### DeFi Integration
- **Yield Discovery**: Verified users access exclusive yield farming opportunities
- **Risk Analytics**: On-chain reputation scoring for emerging markets
- **Dynamic Pricing**: Oracle-based fee calculation with real-time updates
- **Raffle Mechanics**: Incentivized participation through referral rebates

### Security & Privacy
- **Smart Contract Audits**: Core contracts checked for security vulnerabilities
- **Reentrancy Guards**: Protection against malicious contract interactions
- **Overflow/Underflow Prevention**: Safe math operations via Solidity 0.8.20+
- **Minimal Data Exposure**: Only necessary fields stored on-chain

## 📦 What's Included

```
realmint-platform/
├── contracts/              # Smart contracts (Solidity 0.8.20)
│   ├── AttestationRegistry.sol      # Identity attestation storage
│   ├── RealMintLaunchpad.sol        # Dynamic fee launchpad
│   └── test/                        # 11 passing contract tests
├── api/                    # Backend services (Python/Flask)
│   ├── app.py             # Main Flask application
│   ├── requirements.txt    # Python dependencies
│   └── tests/             # API test suite
├── webapp/                 # Frontend React application (Vite)
│   ├── src/               # React components & utilities
│   ├── public/            # Static assets
│   └── README.md          # dApp user guide
├── webapp-admin/          # Admin dashboard for issuers
│   └── src/               # Admin UI components
├── docs/                  # Comprehensive documentation
│   ├── OPERATIONS.md      # Operational runbooks
│   ├── PRD.md            # Product requirements
│   ├── SESSION_DEPLOYMENT.md  # Deployment guide
│   └── EIP712/           # EIP-712 integration examples
├── WHITEPAPER.md          # Project whitepaper (Markdown)
├── WHITEPAPER.pdf         # Project whitepaper (PDF, 8 pages)
├── smart-contract-spec.md # Contract specifications
├── architecture.md        # System architecture & data flows
└── SECURITY.md           # Security model & threat analysis
```

## 🚀 Quick Start

### Prerequisites
- **Node.js 22+** and npm/yarn
- **Python 3.11+** (for API)
- **Docker** (optional, for production)

### 1. Smart Contracts (Hardhat)

```bash
cd contracts
npm install

# Deploy to BSC Testnet
npx hardhat run scripts/deploy.js --network bscTestnet

# Run contract tests
npm test
```

**Current Testnet Deployment:**
- **AttestationRegistry**: `0x2B5a1c4749b95b48F5Faf53cEd0130b21725e4a0`
- **RealMintLaunchpad**: `0xF5Cb13Cf46174B81bf9860E502d698Fe76B5F12a`
- **Chain ID**: 97 (BSC Testnet)

### 2. Frontend dApp (React + Vite)

```bash
cd webapp
npm install
npm run dev
```

Opens at `http://localhost:5173` → Navigate to `/attest` for attestation flow

[Full dApp Setup →](webapp/README.md)

### 3. Backend API (Python/Flask)

```bash
cd api
pip install -r requirements.txt
python app.py
```

Runs at `http://localhost:5000` with REST endpoints for identity verification

## 📊 Project Status

| Component | Status | Details |
|-----------|--------|---------|
| Smart Contracts | ✅ Testnet Live | All 11 tests passing, gas optimized |
| Frontend dApp | ✅ Testnet Live | React + Vite, responsive UI |
| Backend API | ✅ Testnet Live | Flask, PostgreSQL ready |
| Security Audit | 📋 Q2 2026 | Professional audit pre-mainnet |
| Mainnet Launch | 📅 Q2 2026 | Post-audit deployment |

## 🔗 Key Documentation

- **[Smart Contract Specifications](smart-contract-spec.md)** - ABI details, gas estimates, security model
- **[Architecture Overview](architecture.md)** - System design, data flows, integration points
- **[dApp User Guide](webapp/README.md)** - How to use the frontend application
- **[Security Analysis](SECURITY.md)** - Threat model, vulnerability assessment
- **[Deployment Guide](docs/SESSION_DEPLOYMENT.md)** - Production deployment steps
- **[Whitepaper](WHITEPAPER.pdf)** - Complete project vision and roadmap (8 pages)

## 🧪 Testing

### Contract Tests
```bash
cd contracts
npm test
# Output: 11/11 tests passing ✅
```

### API Tests
```bash
cd api
pytest tests/
```

### Frontend Tests
```bash
cd webapp
npm run test
```

## 🔧 Technologies

**Blockchain**
- Solidity 0.8.20
- Hardhat (development & testing)
- ethers.js v6 (client interactions)
- EIP-712 (typed signatures)

**Frontend**
- React 18+
- Vite (build tool)
- Tailwind CSS (styling)
- ethers.js v6 (Web3)

**Backend**
- Python 3.11+
- Flask (REST API)
- PostgreSQL (database)
- Docker (containerization)

**Infrastructure**
- BSC Chain (Testnet 97, Mainnet 56)
- Chainlink Oracles (price feeds)
- GitHub Actions (CI/CD)

## 📈 Roadmap

### Q1 2026 ✅
- [x] Smart contract development
- [x] Testnet deployment
- [x] dApp frontend
- [x] API backend

### Q2 2026 📅
- [ ] Professional security audit
- [ ] Mainnet deployment
- [ ] Public beta launch

### Q3 2026 🎯
- [ ] Batch attestation processing
- [ ] Recovery key mechanisms
- [ ] Additional DeFi partnerships

### Q4 2026 🚀
- [ ] Mobile-first interface
- [ ] Cross-chain support
- [ ] Advanced analytics dashboard

## 🤝 Contributing

We welcome contributors! See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Code style guidelines
- Development workflow
- Pull request process
- Community standards

**Dev Setup:**
```bash
git clone https://github.com/BlueS-3e/realmint-platform.git
cd realmint-platform
# See respective folders (contracts/, api/, webapp/) for setup
```

## 🔒 Security

⚠️ **Notice**: This project is under active development. Before mainnet deployment:
- Complete professional security audit
- Full test coverage validation
- Production deployment checklist

For security concerns, email: **team@realmint.io**

See [SECURITY.md](SECURITY.md) for detailed threat model and security considerations.

## 📞 Contact & Community

- **Email**: team@realmint.io
- **GitHub**: [BlueS-3e/realmint-platform](https://github.com/BlueS-3e/realmint-platform)
- **Twitter**: [@realmint_io](https://twitter.com/realmint_io)

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Chainlink** - Price feed oracles
- **BNB Chain** - Blockchain infrastructure
- **ethers.js** - Web3 library
- **Hardhat** - Smart contract development

---

<div align="center">

**Built with ❤️ by the RealMint Labs team**

*Bringing self-sovereign identity to emerging markets through blockchain innovation*

[View Whitepaper](WHITEPAPER.pdf) | [Smart Contract Spec](smart-contract-spec.md) | [Get Started →](webapp/README.md)

</div>
