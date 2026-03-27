# VerityPass Mainnet Deployment Guide

## Current Status
✅ dApp live on Vercel: https://veritypass.app
✅ Backend live on Render: https://veritypass-api.onrender.com
✅ BNB-compatible contracts and wallet flow ready
✅ Ready for mainnet deployment

---

## Phase 1: Smart Contracts - Mainnet Deployment

### Prerequisites
- [ ] Deployed contracts on BSC testnet (reference addresses noted)
- [ ] Sufficient BNB for mainnet gas fees
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
  bsc: {
    url: 'https://bsc-dataseed.binance.org',
    accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    chainId: 56
  }
}
```

#### 2. Deploy Contracts
```bash
# BNB Chain Mainnet
npx hardhat run scripts/deploy.js --network bsc

# BNB Chain Testnet
npx hardhat run scripts/deploy.js --network bscTestnet
```

#### 3. Note Contract Addresses
Save these addresses for the backend configuration:
- AttestationRegistry
- IdentityRegistry
- CreditScoreManager
- VerityPassLaunchpad

---

## Phase 2: Backend - Environment Configuration

### 1. Update `api/app.py` Mainnet Settings
```python
# Set in Render environment variables:
ENVIRONMENT=production
ATTESTATION_REGISTRY_ADDRESS=0x...  # Mainnet address
IDENTITY_REGISTRY_ADDRESS=0x...
CREDIT_SCORE_MANAGER_ADDRESS=0x...
VERITYPASS_LAUNCHPAD_ADDRESS=0x...
WEB3_PROVIDER_URL=https://eth.llamarpc.com  # or Infura/Alchemy
```

### 2. Update Render Environment Variables
Go to **Render Dashboard** → `veritypass-api` → **Environment**:

```
ENVIRONMENT=production
CHAIN_ID=56  # 56 for BNB Chain, 97 for BNB testnet
ATTESTATION_REGISTRY_ADDRESS=<mainnet-address>
IDENTITY_REGISTRY_ADDRESS=<mainnet-address>
CREDIT_SCORE_MANAGER_ADDRESS=<mainnet-address>
VERITYPASS_LAUNCHPAD_ADDRESS=<mainnet-address>
WEB3_PROVIDER_URL=https://bsc-dataseed.binance.org
ALLOWED_ORIGINS=https://veritypass.app,http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173
```

### 3. Redeploy Backend
```bash
# Render will auto-redeploy when env vars change, or manually:
# Go to Render → veritypass-api → Manual Deploy
```

---

## Phase 3: Frontend - Mainnet Configuration

### 1. Update `webapp/.env.production`
```bash
VITE_API_BASE=https://veritypass-api.onrender.com
VITE_WALLETCONNECT_PROJECT_ID=<your-project-id>
VITE_DEFAULT_CHAIN_ID=56  # 56 for BNB Chain mainnet, 97 for testnet
```

### 2. Update `webapp/src/config.js` if Needed
Verify mainnet RPC endpoints are correct:
```javascript
const NETWORK_CONFIG = {
  56: {
    name: 'BNB Chain Mainnet',
    chainId: 56,
    attestationRegistry: '0x...',  // BNB Chain mainnet address
  },
  97: {
    name: 'BNB Chain Testnet',
    chainId: 97,
    attestationRegistry: '0x...',  // BNB Chain testnet address
  }
}
```

### 3. Set Vercel Environment Variables
**Vercel Dashboard** → Project Settings → **Environment Variables**:

```
VITE_API_BASE=https://veritypass-api.onrender.com
VITE_WALLETCONNECT_PROJECT_ID=<your-project-id>
VITE_DEFAULT_CHAIN_ID=56
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
# Check BscScan (BNB Chain)
https://bscscan.com/address/<contract-address>

# Verify source code on blockchain explorer
```

### 2. Test Frontend
```bash
# Visit production dApp
https://veritypass.app

# Test in DevTools Console:
console.log(window.__RUNTIME_API_BASE)  # Should show https://veritypass-api.onrender.com

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
curl https://veritypass-api.onrender.com/api/version

# Check frontend config
curl https://veritypass-api.onrender.com/api/frontend-config

# Verify correct chain ID and contract addresses
```

### 4. Monitor Production
- Check Render logs: `Render Dashboard` → `veritypass-api` → **Logs**
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
- Keep BNB testnet version accessible for staging verification

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
- [ ] Default chain ID set to mainnet (56, with 97 for staging)
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

- **BscScan API**: https://docs.bscscan.com
- **BSC Explorer**: https://bscscan.com
- **Vercel Docs**: https://vercel.com/docs
- **Render Docs**: https://render.com/docs
- **Web3.js Docs**: https://docs.web3js.org
- **Ethers.js Docs**: https://docs.ethers.org

---

## Next Steps

1. **Deploy contracts** to BNB Chain mainnet (and BNB testnet for staging)
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
