# RealMint Mainnet Deployment Guide

## Current Status
✅ dApp live on Vercel: https://realmint-platform.vercel.app
✅ Backend live on Render: https://realmint-api.onrender.com
✅ All features functional on Sepolia testnet
✅ Ready for mainnet deployment

---

## Phase 1: Smart Contracts - Mainnet Deployment

### Prerequisites
- [ ] Deployed contracts on Sepolia (reference addresses noted)
- [ ] Sufficient ETH/BNB for mainnet gas fees
- [ ] Private key for deployment (NOT in version control)

### Deployment Steps

#### 1. Update `contracts/hardhat.config.js`
Set mainnet RPC endpoint and private key:
```javascript
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

networks: {
  mainnet: {
    url: process.env.MAINNET_RPC_URL || 'https://eth.llamarpc.com',
    accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    chainId: 1
  },
  bscMainnet: {
    url: 'https://bsc-dataseed.binance.org',
    accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    chainId: 56
  }
}
```

#### 2. Deploy Contracts
```bash
# Ethereum Mainnet
npx hardhat run scripts/deploy.js --network mainnet

# BSC Mainnet
npx hardhat run scripts/deploy.js --network bscMainnet
```

#### 3. Note Contract Addresses
Save these addresses for the backend configuration:
- AttestationRegistry
- IdentityRegistry
- CreditScoreManager
- RealMintLaunchpad

---

## Phase 2: Backend - Environment Configuration

### 1. Update `api/app.py` Mainnet Settings
```python
# Set in Render environment variables:
ENVIRONMENT=production
ATTESTATION_REGISTRY_ADDRESS=0x...  # Mainnet address
IDENTITY_REGISTRY_ADDRESS=0x...
CREDIT_SCORE_MANAGER_ADDRESS=0x...
REALMINT_LAUNCHPAD_ADDRESS=0x...
WEB3_PROVIDER_URL=https://eth.llamarpc.com  # or Infura/Alchemy
```

### 2. Update Render Environment Variables
Go to **Render Dashboard** → `realmint-api` → **Environment**:

```
ENVIRONMENT=production
CHAIN_ID=1  # 1 for Ethereum, 56 for BSC
ATTESTATION_REGISTRY_ADDRESS=<mainnet-address>
IDENTITY_REGISTRY_ADDRESS=<mainnet-address>
CREDIT_SCORE_MANAGER_ADDRESS=<mainnet-address>
REALMINT_LAUNCHPAD_ADDRESS=<mainnet-address>
WEB3_PROVIDER_URL=https://eth.llamarpc.com
AAVE_POOL_ADDRESS=0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9  # Ethereum mainnet
AAVE_PRICE_ORACLE_ADDRESS=0xA50ba011c48153De246E5882039264E3F0e0867f  # Mainnet
ALLOWED_ORIGINS=https://realmint-platform.vercel.app,http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173
```

### 3. Redeploy Backend
```bash
# Render will auto-redeploy when env vars change, or manually:
# Go to Render → realmint-api → Manual Deploy
```

---

## Phase 3: Frontend - Mainnet Configuration

### 1. Update `webapp/.env.production`
```bash
VITE_API_BASE=https://realmint-api.onrender.com
VITE_WALLETCONNECT_PROJECT_ID=<your-project-id>
VITE_DEFAULT_CHAIN_ID=1  # 1 for Ethereum mainnet, 56 for BSC
VITE_ENABLE_AAVE_DEMO=true
```

### 2. Update `webapp/src/config.js` if Needed
Verify mainnet RPC endpoints are correct:
```javascript
const NETWORK_CONFIG = {
  1: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    // Contract addresses
    attestationRegistry: '0x...',  // Mainnet address
  },
  56: {
    name: 'BNB Chain Mainnet',
    chainId: 56,
    attestationRegistry: '0x...',  // BSC mainnet address
  }
}
```

### 3. Set Vercel Environment Variables
**Vercel Dashboard** → Project Settings → **Environment Variables**:

```
VITE_API_BASE=https://realmint-api.onrender.com
VITE_WALLETCONNECT_PROJECT_ID=<your-project-id>
VITE_DEFAULT_CHAIN_ID=1
```

### 4. Redeploy Frontend
```bash
# Option 1: Push code change to trigger auto-deploy
git commit --allow-empty -m "deploy(webapp): mainnet configuration"
git push origin main  # Or your production branch

# Option 2: Manual redeploy from Vercel dashboard
# Go to Vercel → Project → Deployments → Redeploy
```

---

## Phase 4: Verification & Testing

### 1. Verify Smart Contracts
```bash
# Check Etherscan (Ethereum)
https://etherscan.io/address/<contract-address>

# Check BscScan (BSC)
https://bscscan.com/address/<contract-address>

# Verify source code on blockchain explorer
```

### 2. Test Frontend
```bash
# Visit production dApp
https://realmint-platform.vercel.app

# Test in DevTools Console:
console.log(window.__RUNTIME_API_BASE)  # Should show https://realmint-api.onrender.com

# Test wallet connection (use mainnet wallet)
# Test key features:
# ✓ Connect wallet (should show mainnet networks)
# ✓ Identity attestation
# ✓ Credit score queries
# ✓ Launchpad interactions
```

### 3. Test Backend API
```bash
# Check health endpoint
curl https://realmint-api.onrender.com/api/version

# Check frontend config
curl https://realmint-api.onrender.com/api/frontend-config

# Verify correct chain ID and contract addresses
```

### 4. Monitor Production
- Check Render logs: `Render Dashboard` → `realmint-api` → **Logs**
- Check Vercel logs: `Vercel Dashboard` → Project → **Deployments**
- Monitor contract interactions on blockchain explorers
- Check for user reports of issues

---

## Phase 5: Post-Deployment Tasks

### 1. Update Documentation
- [ ] Update README.md with mainnet URLs
- [ ] Update API documentation with mainnet contract addresses
- [ ] Document gas estimates for transactions
- [ ] Create user guide for mainnet usage

### 2. Security Audit (Optional)
- [ ] Consider security audit for smart contracts
- [ ] Review API security headers
- [ ] Test rate limiting
- [ ] Verify CORS configuration

### 3. Monitoring & Maintenance
- [ ] Set up alerting for API/contract failures
- [ ] Monitor transaction costs
- [ ] Plan for contract upgrades (if using proxy pattern)
- [ ] Establish incident response procedures

### 4. Marketing & Launch
- [ ] Announce mainnet deployment
- [ ] Update website/social media
- [ ] Create tutorial content
- [ ] Engage with community

---

## Rollback Plan (If Issues Found)

### Quick Rollback Steps
1. **Frontend**: Redeploy previous version from Vercel dashboard
2. **Backend**: Restore previous env vars and redeploy
3. **Contracts**: Deploy fallback contracts or pause interactions

### Gradual Rollout Alternative
- Deploy with feature flags to enable mainnet gradually
- Monitor metrics before full launch
- Keep Sepolia version accessible for testing

---

## Critical Configuration Checklist

### Smart Contracts ✓
- [ ] All contracts deployed on target chains
- [ ] Verified on blockchain explorer
- [ ] Addresses stored securely
- [ ] Gas optimization verified

### Backend ✓
- [ ] All environment variables set correctly
- [ ] Contract addresses updated
- [ ] RPC endpoints functioning
- [ ] ALLOWED_ORIGINS includes Vercel domain
- [ ] Rate limiting configured
- [ ] Logging enabled for troubleshooting

### Frontend ✓
- [ ] Environment variables set in Vercel
- [ ] Default chain ID set to mainnet (1 or 56)
- [ ] Contract addresses in config updated
- [ ] API base URL correct
- [ ] Build succeeds without errors

### Deployment ✓
- [ ] Vercel app redeployed with new env vars
- [ ] Render backend redeployed with new env vars
- [ ] DNS/domain pointing correctly
- [ ] SSL certificates valid

---

## Support Resources

- **Etherscan API**: https://etherscan.io/apis
- **BSC Explorer**: https://bscscan.com
- **Vercel Docs**: https://vercel.com/docs
- **Render Docs**: https://render.com/docs
- **Web3.js Docs**: https://docs.web3js.org
- **Ethers.js Docs**: https://docs.ethers.org

---

## Next Steps

1. **Deploy contracts** to Ethereum mainnet and/or BSC
2. **Update backend** environment variables on Render
3. **Update frontend** environment variables on Vercel
4. **Test thoroughly** with real mainnet wallets
5. **Monitor** logs and transactions for issues
6. **Document** any custom configurations
7. **Plan** ongoing maintenance and updates

---

## Need Help?

- Check Render logs: `Render Dashboard` → Logs
- Check Vercel logs: `Vercel Dashboard` → Deployments
- Review contract deployment scripts: `contracts/scripts/`
- Check environment variable format in Render/Vercel

Good luck with mainnet launch! 🚀
