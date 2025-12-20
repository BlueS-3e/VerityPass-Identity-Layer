# WalletConnect v2 Deployment Checklist

## ✅ Completed
- [x] Removed @walletconnect/web3-provider v1.8.0
- [x] Installed @web3modal/ethers v5.1.11 (Reown AppKit)
- [x] Created walletConnectV2.js wrapper with Web3Modal v2 API
- [x] Updated providerDetect.js to use v2 integration
- [x] Build tested successfully (no v1 imports)
- [x] Committed and pushed to GitHub (feature/publish-all)
- [x] Documentation created (WALLETCONNECT_SETUP.md)

## 🔄 Next Steps (Required for Production)

### 1. Get WalletConnect Project ID (5 minutes)
1. Visit https://cloud.walletconnect.com
2. Sign up/login (free account)
3. Create new project: "RealMint Platform"
4. Copy your Project ID (format: `8410ea8a863dec66369c41ba392b3044`)

### 2. Configure Vercel Environment Variable
1. Go to Vercel dashboard: https://vercel.com/dashboard
2. Select your project (realmint-platform)
3. Navigate to **Settings** → **Environment Variables**
4. Add new variable:
   - **Key**: `VITE_WALLETCONNECT_PROJECT_ID`
   - **Value**: `[paste your Project ID]`
   - **Environment**: Production (or All)
5. Click **Save**

### 3. Redeploy to Apply Changes
Option A (Automatic):
- Push any new commit to main/feature branch (triggers auto-deploy)

Option B (Manual):
1. Vercel dashboard → **Deployments**
2. Click "..." menu on latest deployment
3. Select **Redeploy**

### 4. Test WalletConnect Integration

#### Desktop Test
1. Open deployed app: https://realmint-platform.vercel.app
2. Click "Connect Wallet"
3. Select "WalletConnect"
4. **Expected**: QR code modal appears in-app (NOT redirect to walletconnect.org)
5. Scan with MetaMask mobile → Approve connection
6. **Expected**: Wallet connected, address displayed

#### Mobile Test
1. Open app on mobile browser (Safari/Chrome)
2. Click "Connect Wallet"
3. **Expected**: WalletConnect auto-selected as "Recommended"
4. Tap wallet option (MetaMask, Trust, etc.)
5. **Expected**: Deep link opens wallet app
6. Approve connection in wallet
7. **Expected**: Browser shows "Connected" status

## 🐛 Troubleshooting

### Issue: "Project ID not set" error
**Fix**: Add `VITE_WALLETCONNECT_PROJECT_ID` to Vercel env vars (step 2)

### Issue: Still redirects to walletconnect.org
**Fix**: 
1. Verify env var is set in Vercel
2. Redeploy app (builds with new env)
3. Hard refresh browser (Ctrl+Shift+R)

### Issue: Modal doesn't appear on mobile
**Fix**:
1. Check browser console for errors
2. Ensure mobile wallet is installed
3. Try opening link in wallet's built-in browser

### Issue: "Cannot connect" after QR scan
**Fix**:
1. Check wallet network matches dApp network
2. Verify RPC endpoint is accessible
3. Try different wallet (MetaMask, Trust, Rainbow)

## 📊 Success Criteria

✅ Desktop users see QR modal without redirect  
✅ Mobile users can connect via deep links  
✅ WalletConnect session persists across page reloads  
✅ Multiple wallets supported (MetaMask, Trust, Rainbow, etc.)  
✅ No console errors related to WalletConnect  

## 🔗 Quick Links

- WalletConnect Cloud: https://cloud.walletconnect.com
- Vercel Dashboard: https://vercel.com/dashboard
- Deployed App: https://realmint-platform.vercel.app
- Documentation: WALLETCONNECT_SETUP.md
- GitHub Repo: https://github.com/BlueS-3e/realmint-platform

## 📝 Notes

- Project ID is **free** and has no usage limits for basic features
- Migration from v1 to v2 is complete in codebase
- Old @walletconnect/web3-provider package removed
- New @web3modal/ethers package installed and integrated
- Mobile deep linking configured for major wallets

## ⏭️ After WalletConnect Works

1. Test full user flow: Connect → Attest → Mint NFT → Verify
2. Deploy smart contracts to mainnet
3. Update Vercel env with mainnet contract addresses
4. Configure production RPC endpoints (Alchemy/Infura)
5. Set up monitoring/analytics (Sentry, etc.)

---

**Timeline**: ~15 minutes total  
**Status**: Ready to deploy - just need Project ID from WalletConnect  
**Risk**: Low - backwards compatible, v1 fully removed  
