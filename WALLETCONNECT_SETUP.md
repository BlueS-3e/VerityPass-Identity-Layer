# WalletConnect v2 Setup Guide

## Overview

This dApp now uses **WalletConnect v2** (via Web3Modal/Reown AppKit) instead of the legacy v1 API. This enables:
- ✅ In-app QR code modal (no more redirects to walletconnect.org)
- ✅ Better mobile wallet support (MetaMask, Trust Wallet, Rainbow, etc.)
- ✅ Modern Web3Modal UI with wallet selection
- ✅ Improved security and reliability

## Prerequisites

You need a **free WalletConnect Project ID** to use WalletConnect v2.

## Step 1: Get Your Project ID

1. Visit https://cloud.walletconnect.com
2. Click **"Sign In"** (create account if needed - it's free)
3. Click **"Create New Project"**
4. Enter project details:
   - **Name**: VerityPass Platform (or your dApp name)
   - **Homepage URL**: https://veritypass.vercel.app (your deployed URL)
5. Copy the **Project ID** (format: `8410ea8a863dec66369c41ba392b3044`)

## Step 2: Configure Environment Variables

### Local Development

Add to `webapp/.env`:
```bash
VITE_WALLETCONNECT_PROJECT_ID="your_project_id_here"
```

### Production (Vercel)

1. Go to Vercel dashboard → Your project → **Settings** → **Environment Variables**
2. Add new variable:
   - **Key**: `VITE_WALLETCONNECT_PROJECT_ID`
   - **Value**: `your_project_id_here` (paste from WalletConnect dashboard)
   - **Environment**: Production (or all environments)
3. Click **Save**
4. Redeploy your app (Vercel → Deployments → Redeploy latest)

### Production (Other Hosting)

Add to your build environment or `.env.production`:
```bash
VITE_WALLETCONNECT_PROJECT_ID="your_project_id_here"
```

## Step 3: Test WalletConnect

### Desktop Testing
1. Open your dApp in a browser
2. Click **"Connect Wallet"**
3. Select **"WalletConnect"** from the provider picker
4. QR code modal should appear **in-app** (not redirect)
5. Open MetaMask mobile → Scan QR → Approve connection

### Mobile Testing
1. Open dApp on mobile browser (Chrome/Safari)
2. Click **"Connect Wallet"**
3. WalletConnect should be auto-selected (marked "Recommended")
4. Modal appears with wallet options (MetaMask, Trust, Rainbow, etc.)
5. Tap your wallet → deep link opens wallet app → Approve

## Architecture Changes

### What Changed?
- **Old**: `@walletconnect/web3-provider` v1.8.0 (legacy, no Project ID support)
- **New**: `@web3modal/ethers` v5.1.11 (Reown AppKit, modern API)

### Files Modified
- `webapp/src/utils/walletConnectV2.js` - New Web3Modal wrapper
- `webapp/src/utils/providerDetect.js` - Updated to use v2 API
- `webapp/package.json` - Replaced v1 package with @web3modal/ethers

### Key Functions
```javascript
import { initWeb3Modal, connectWithWalletConnect } from './utils/walletConnectV2.js';

// Initialize (call once on app load)
await initWeb3Modal(projectId);

// Connect (opens modal)
const provider = await connectWithWalletConnect();
```

## Troubleshooting

### Issue: "Project ID not set" error
**Solution**: Add `VITE_WALLETCONNECT_PROJECT_ID` to environment variables

### Issue: Modal still redirects to walletconnect.org
**Solution**: Clear browser cache, rebuild app (`npm run build`), redeploy

### Issue: "Cannot read properties of undefined" on mobile
**Solution**: Ensure Web3Modal is initialized before connecting (check `initWeb3Modal` call)

### Issue: Connection works on desktop but not mobile
**Solution**: 
1. Check mobile wallet is installed
2. Deep links may be blocked by browser - try opening in wallet's built-in browser
3. Test WalletConnect QR scan from wallet app

## Migration Notes (For Developers)

If upgrading from v1:
1. Uninstall old package: `npm uninstall @walletconnect/web3-provider`
2. Install new package: `npm install @web3modal/ethers`
3. Replace v1 imports with v2 wrapper: `import { connectWithWalletConnect } from './walletConnectV2.js'`
4. Update provider creation logic (no more `new WalletConnectProvider()`)
5. Test build: `npm run build`

## Resources

- WalletConnect Cloud: https://cloud.walletconnect.com
- Reown AppKit Docs: https://docs.reown.com/appkit
- Web3Modal Migration Guide: https://docs.reown.com/appkit/upgrade
- Issue Tracker: https://github.com/BlueS-3e/VerityPass-Identity-Layer/issues

## Support

If WalletConnect isn't working after setup:
1. Check browser console for errors
2. Verify Project ID is set in environment variables
3. Ensure app is rebuilt after env changes
4. Test with multiple wallets (MetaMask, Trust, Rainbow)
5. Open GitHub issue with console logs if problem persists
