# Production Deployment Guide

## Overview
This dApp is deployed across two platforms:
- **Vercel**: Hosts the frontend (webapp + webapp-admin)
- **Render**: Hosts the backend API

## Prerequisites
- GitHub account with this repository connected
- Vercel account (vercel.com)
- Render account (render.com)
- Mainnet RPC URL (Infura/Alchemy)
- Deployed contracts on mainnet
- Plaid integration credentials (if using bank linking)

---

## 1. API Deployment (Render)

### 1.1 Connect Repository to Render
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Web Service"
3. Select your GitHub repository
4. Configure:
   - **Name**: `realmint-api`
   - **Environment**: `Python 3.11`
   - **Build Command**: `pip install -r api/requirements-prod.txt && python api/migrate_projects_db.py`
   - **Start Command**: `gunicorn --workers 4 --bind 0.0.0.0:$PORT api.app:app`
   - **Region**: Choose closest to your users

### 1.2 Add Environment Variables
In Render dashboard → Environment, add all variables from `.env.production.example`:

**Critical variables** (must be set):
```
SECRET_KEY=<generate-random-32-char-string>
FLASK_ENV=production
RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
LAUNCHPAD_ADDRESS=<your-deployed-contract-address>
PLAID_CLIENT_ID=<your-plaid-id>
PLAID_SECRET=<your-plaid-secret>
CORS_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
DATABASE_URL=<auto-connected-postgres>
REDIS_URL=<auto-connected-redis>
```

### 1.3 Add Databases (Optional but Recommended)
Click "Create Database":
- **PostgreSQL 15**: For user/session data
- **Redis**: For caching and sessions

Note the connection strings Render provides; they auto-populate as `DATABASE_URL` and `REDIS_URL`.

### 1.4 Deploy
- Push to your GitHub branch
- Render auto-deploys on every push to the connected branch
- Monitor logs in Render dashboard

### 1.5 Verify API
```bash
curl https://your-render-url.onrender.com/health
# Should return: {"status": "ok"}
```

---

## 2. Webapp Deployment (Vercel)

### 2.1 Connect Webapp to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure:
   - **Framework**: Vite
   - **Root Directory**: `webapp`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 2.2 Set Environment Variables
In Vercel dashboard → Settings → Environment Variables:

```
VITE_NETWORK=mainnet
VITE_RPC_URL_MAINNET=https://mainnet.infura.io/v3/YOUR_KEY
VITE_LAUNCHPAD_ADDRESS=<your-deployed-contract-address>
VITE_CHAIN_ID=1
VITE_API_BASE=https://your-render-url.onrender.com
VITE_SENTRY_DSN=<your-sentry-dsn-if-using>
VITE_FEATURE_WALLETLESS=false
```

### 2.3 Custom Domain
1. Go to Settings → Domains
2. Add your domain (e.g., `app.yourdomain.com`)
3. Update DNS CNAME to point to Vercel

### 2.4 Deploy
- Push to GitHub
- Vercel auto-deploys
- View deployment at your domain

---

## 3. Webapp-Admin Deployment (Vercel)

### 3.1 Connect Webapp-Admin to Vercel
1. In Vercel, click "Add New" → "Project"
2. Import your GitHub repository again
3. Configure:
   - **Framework**: Vite
   - **Root Directory**: `webapp-admin`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 3.2 Set Environment Variables
Similar to webapp:
```
VITE_NETWORK=mainnet
VITE_RPC_URL_MAINNET=https://mainnet.infura.io/v3/YOUR_KEY
VITE_LAUNCHPAD_ADDRESS=<your-deployed-contract-address>
VITE_CHAIN_ID=1
VITE_API_BASE=https://your-render-url.onrender.com
VITE_SENTRY_DSN=<your-sentry-dsn-if-using>
```

### 3.3 Domain
Add subdomain (e.g., `admin.yourdomain.com`)

---

## 4. Verification Checklist

### Pre-Deployment
- [ ] Deployed RealMintLaunchpad contract on mainnet
- [ ] Verified contract on Etherscan (or via explorer UI)
- [ ] Mainnet RPC URL working
- [ ] Plaid integration live
- [ ] All environment variables ready

### Post-Deployment
- [ ] API health check passes: `GET /health` → 200
- [ ] Webapp loads without console errors
- [ ] Wallet connection works (MetaMask, WalletConnect)
- [ ] Network selector shows mainnet
- [ ] API calls flow properly (check network tab in browser)
- [ ] Attestation flow end-to-end works
- [ ] Admin dashboard accessible

### Monitoring
- [ ] Sentry receiving errors
- [ ] Prometheus metrics exposed at `/metrics`
- [ ] Redis cache working (check Render logs)
- [ ] Database queries slow-log monitored

---

## 5. Troubleshooting

### Webapp Can't Connect to API
- Check `VITE_API_BASE` in Vercel env vars
- Verify `CORS_ORIGINS` in Render API env vars
- Check API health: `curl https://your-render-url.onrender.com/health`

### Contract Address Not Found
- Verify mainnet contract is deployed: `etherscan.io`
- Check `VITE_LAUNCHPAD_ADDRESS` is correct checksum address
- Try switching to testnet (Sepolia) for debugging

### Sessions Not Persisting
- Ensure Redis is connected: check Render logs for Redis errors
- If Redis fails, Flask falls back to in-memory (sessions lost on restart)
- Add `REDIS_URL` environment variable in Render

### Slow API Responses
- Check database query performance (enable slow query log)
- Monitor Render CPU/memory usage
- Scale workers up: `gunicorn --workers 8 ...` (in start command)

---

## 6. Mainnet Contract Registration

After deploy, register token price feeds on the contract:

```bash
# For each supported token:
npx hardhat run scripts/register-token.js --network mainnet
```

Or via Etherscan UI → "Contract" → "Write as Proxy":
- Function: `setTokenPriceFeed`
- Args:
  - `token`: Token contract address
  - `feed`: Chainlink price feed address
  - `decimals`: Token decimals (e.g., 18 for USDC)

---

## 7. Rollback Plan

If issues occur:

**Vercel**: Click "Deployments" → previous version → "Promote to Production"

**Render**: 
1. Disconnect from GitHub (temporarily)
2. Manually deploy previous stable Docker image (if you have one)
3. Or: revert git commit and push

---

## 8. Security Checklist

- [ ] All secrets in env vars (not in code)
- [ ] CORS_ORIGINS whitelist only your domains
- [ ] SESSION_COOKIE_SECURE=true on production
- [ ] Enable Sentry for error tracking
- [ ] Rate limiting enabled on API (`Flask-Limiter`)
- [ ] Prometheus metrics only accessible internally (not public)
- [ ] Database backups enabled (Render auto-backs up Postgres daily)

---

## Support

For issues:
1. Check Vercel/Render deployment logs
2. Check browser console for frontend errors
3. Review API logs: Render dashboard → "Logs"
4. Use Sentry dashboard for production errors

