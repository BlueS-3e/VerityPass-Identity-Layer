# RealMint Launchpad - Decentralized dApp

Welcome to **RealMint Launchpad**, a decentralized application built on blockchain that enables secure identity attestation and on-chain verification for emerging market participants. This dApp bridges traditional KYC/AML workflows with blockchain-based sovereignty, empowering users to maintain control of their identity data.

## 🎯 What is RealMint Launchpad?

RealMint Launchpad is a web3 application that allows users to:

- **Register Attestations**: Submit identity attestations (approved by verified issuers)
- **Verify Identity**: Access on-chain verification of your identity and credentials
- **Publish Signatures**: Sign data with EIP-712 typed signatures for maximum security
- **Access DeFi**: Use verified identity to participate in yield farming and other DeFi protocols with confidence

The platform is designed for **emerging market participants** who need decentralized, self-sovereign identity while maintaining the security guarantees of blockchain verification.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- A Web3 wallet (MetaMask, WalletConnect, or compatible provider)
- Connection to **BSC Testnet** (Chain ID: 97)

### Installation

```bash
# Clone the repository
git clone https://github.com/BlueS-3e/realmint-platform.git
cd realmint-platform/webapp

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:5173` (or the URL printed by Vite).

## 📱 Using the dApp

### 1. Connect Your Wallet
- Click **"Connect Wallet"** at the top of the page
- Select your wallet provider (MetaMask, WalletConnect, etc.)
- Approve the connection request

### 2. Navigate to Attestation Flow
- Go to the **`/attest`** route or click "Attest" in the sidebar
- This page lets you:
  - Submit a new attestation record
  - Sign with EIP-712 typed signatures (recommended for security)
  - Verify the signature on-chain

### 3. Verify Your Identity
- View your published attestations
- Check on-chain verification status
- Use your verified identity in other DeFi applications

## ✨ Key Features

### Security-First Design
- **EIP-712 Typed Signatures**: Cryptographically secure, human-readable signing (not raw hex)
- **Smart Contract Audits**: Core contracts audited for reentrancy, overflow/underflow protection
- **Verified Issuers**: Only trusted issuers (KYC providers, identity services) can publish attestations

### Decentralized Architecture
- **Self-Sovereign**: Users own their private keys and identity data
- **On-Chain Verification**: All attestations stored immutably on blockchain
- **No Custodial Risk**: No central authority holds your credentials

### Developer-Friendly
- **EthersJS v6 Integration**: Modern Web3 library with TypeScript support
- **Modular Utilities**: Reusable helpers for signatures, contract interactions, and config
- **Clear Examples**: Reference implementations in `/src` for common flows

## 🌐 Supported Networks

| Network | Chain ID | Status | Contract Address |
|---------|----------|--------|------------------|
| BSC Testnet | 97 | ✅ Active | See `.env` |
| BSC Mainnet | 56 | 📋 Q2 2026 | Post-audit |

Current deployment addresses are configured in `src/config.js`. Update this file when deploying to different networks.

## 📚 Documentation

- **[Development Setup](../docs/webapp-README.md)** - Build, development environment, architecture
- **[Smart Contract Specifications](../smart-contract-spec.md)** - Contract ABIs, gas estimates, security model
- **[Architecture Overview](../architecture.md)** - System design and data flows
- **[Deployment Guide](../docs/SESSION_DEPLOYMENT.md)** - Production deployment instructions
- **[Security Model](../SECURITY.md)** - Threat model and security considerations

## 🛠️ Project Structure

```
webapp/
├── src/
│   ├── components/          # React UI components
│   ├── pages/               # Page routes (Attest, Verify, etc.)
│   ├── utils/
│   │   ├── eip712.js       # EIP-712 signature helpers
│   │   ├── web3.js         # Contract interactions (ethers.js v6)
│   │   └── legacyWeb3.js   # Deprecated helpers (for migration)
│   ├── config.js           # Network & contract address config
│   ├── App.jsx             # Main app component
│   └── index.css           # Global styles
├── public/                  # Static assets
├── tests/                   # Test suite
├── Dockerfile              # Production container image
├── vite.config.js          # Vite build configuration
└── package.json            # Dependencies & scripts
```

## 📦 Environment Configuration

Create a `.env.local` file (or `.env`) with:

```env
VITE_NETWORK_ID=97
VITE_ATTESTATION_REGISTRY=0x2B5a1c4749b95b48F5Faf53cEd0130b21725e4a0
VITE_REALMINT_LAUNCHPAD=0xF5Cb13Cf46174B81bf9860E502d698Fe76B5F12a
VITE_RPC_URL=https://data-seed-prebsc-1-a.binance.org:8545
```

See `.env.production.example` for production configuration.

## 🧪 Testing

```bash
# Run test suite
npm run test

# Run tests in watch mode
npm run test:watch

# Build for production
npm run build
```

## 🐳 Docker Deployment

```bash
# Build image
docker build -f Dockerfile.build -t realmint-webapp:latest .

# Run container
docker run -p 3000:80 realmint-webapp:latest
```

## 🔒 Security Best Practices

1. **Always verify contract addresses** before connecting with your wallet
2. **Use hardware wallets** for mainnet interactions
3. **Test on testnet first** before mainnet transactions
4. **Enable MetaMask Flask Warnings** for phishing protection
5. **Review transaction details** before signing (especially with unknown contracts)

## 🐛 Troubleshooting

### "Wallet not detected"
- Ensure MetaMask or WalletConnect is installed and enabled
- Try refreshing the page
- Check browser console for errors (F12)

### "Wrong network"
- Click the network selector in your wallet
- Switch to **BSC Testnet (Chain ID: 97)**
- Refresh the dApp

### "Contract not found"
- Verify contract addresses in `src/config.js` match deployed addresses
- Confirm you're on the correct network
- Check [BSC Scan](https://testnet.bscscan.com/) for contract verification

### Build issues
- Delete `node_modules/` and `package-lock.json`, then `npm install`
- Clear browser cache and restart dev server

## 📧 Support & Community

- **Report Bugs**: [GitHub Issues](https://github.com/BlueS-3e/realmint-platform/issues)
- **Security Concerns**: team@realmint.io
- **Join Discord**: [RealMint Community](#) (link coming soon)

## 📄 License

This project is licensed under the MIT License — see [LICENSE](../LICENSE) for details.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on:
- Code style and conventions
- Pull request process
- Development workflow
- Community standards

## 🚧 Roadmap

- **Q1 2026**: Testnet launch (current ✅)
- **Q2 2026**: Security audit completion
- **Q2 2026**: Mainnet deployment
- **Q3 2026**: Advanced features (batch attestations, recovery flows)
- **Q4 2026**: Mobile-first interface

## 📞 Contact

- **Email**: team@realmint.io
- **GitHub**: https://github.com/BlueS-3e/realmint-platform
- **Twitter**: [@realmint_io](https://twitter.com/realmint_io)

---

**Built with ❤️ by the RealMint Labs team**  
*Bringing sovereign identity to emerging markets*
