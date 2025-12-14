# RealMint dApp - Production Deployment Guide

## Quick Links
- **Vercel Docs**: https://vercel.com/docs
- **Render Docs**: https://render.com/docs
- **Deployment Guide**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Checklist**: Run `bash scripts/deployment-checklist.sh`

---

## 📦 What Gets Deployed

### Frontend (Vercel)
- **webapp/** - Main user application (React + Vite)
- **webapp-admin/** - Admin dashboard (React + Vite)

### Backend (Render)
- **api/** - Flask REST API with blockchain integration (Python 3.11)

### Smart Contracts (Already Deployed)
- **RealMintLaunchpad** on Ethereum mainnet
- Address: (to be updated after mainnet deployment)

---

## 🚀 Quick Start

### 1. Prepare Mainnet Contract
If not already deployed:
```bash
cd contracts
export DEPLOYER_PRIVATE_KEY="<your-mainnet-wallet-pk>"
export MAINNET_RPC_URL="https://mainnet.infura.io/v3/<your-key>"
npx hardhat run --network mainnet scripts/deploy.js
# Note the contract address
```

### 2. Generate Production Environment Files
```bash
bash scripts/setup-production.sh 0x<mainnet-contract-address>
```

This creates `.env.production` files for each service with placeholder values.

### 3. Fill in Configuration
Edit each `.env.production` file:

**api/.env.production:**
```bash
# Update these
SECRET_KEY=<generate-random-32-char-string>
RPC_URL=https://mainnet.infura.io/v3/<infura-key>
LAUNCHPAD_ADDRESS=0x<your-mainnet-contract>
DATABASE_URL=<from-render-postgres>
REDIS_URL=<from-render-redis>
PLAID_CLIENT_ID=<your-plaid-id>
PLAID_SECRET=<your-plaid-secret>
CORS_ORIGINS=https://your-domain.com,https://admin.your-domain.com
```

**webapp/.env.production:**
```bash
VITE_RPC_URL_MAINNET=https://mainnet.infura.io/v3/<infura-key>
VITE_LAUNCHPAD_ADDRESS=0x<your-mainnet-contract>
VITE_API_BASE=https://api.your-domain.com
```

**webapp-admin/.env.production:**
```bash
VITE_RPC_URL_MAINNET=https://mainnet.infura.io/v3/<infura-key>
VITE_LAUNCHPAD_ADDRESS=0x<your-mainnet-contract>
VITE_API_BASE=https://api.your-domain.com
```

### 4. Deploy via Render & Vercel

#### Deploy API (Render)
```bash
# Push to GitHub
git add api/.env.production
git commit -m "chore: add production config"
git push origin main

# In Render dashboard:
# 1. Connect GitHub repo
# 2. Create Web Service → Python 3.11
# 3. Add environment variables from api/.env.production
# 4. Add PostgreSQL and Redis databases
# 5. Deploy
```

#### Deploy Webapps (Vercel)
```bash
# In Vercel dashboard:
# 1. New Project → Import Git repo
# 2. Root Directory: webapp
# 3. Add environment variables from webapp/.env.production
# 4. Deploy

# Repeat for webapp-admin with Root Directory: webapp-admin
```

### 5. Verify Deployment
```bash
# Check API health
curl https://your-render-url.onrender.com/health

# Check webapp loads
curl https://your-domain.com

# Check admin loads
curl https://admin.your-domain.com
```

---

## 🔒 Environment Variables Reference

### Critical (Must Set)
| Variable | Service | Value |
|----------|---------|-------|
| `SECRET_KEY` | API | Random 32+ char string |
| `RPC_URL` | API | Mainnet RPC endpoint |
| `LAUNCHPAD_ADDRESS` | API + Webapp | Deployed contract address |
| `VITE_API_BASE` | Webapp | API domain (e.g., https://api.example.com) |
| `DATABASE_URL` | API | PostgreSQL connection string |
| `REDIS_URL` | API | Redis connection string |

### Important (Should Set)
| Variable | Service | Value |
|----------|---------|-------|
| `PLAID_CLIENT_ID` | API | Plaid API credentials |
| `PLAID_SECRET` | API | Plaid API credentials |
| `CORS_ORIGINS` | API | Comma-separated domains |
| `SESSION_COOKIE_SECURE` | API | `true` for production |
| `SENTRY_DSN` | API + Webapp | Error tracking (optional) |

### Optional
| Variable | Service | Value |
|----------|---------|-------|
| `VITE_ANALYTICS_KEY` | Webapp | Analytics service key |
| `ETHERSCAN_API_KEY` | API | For contract verification |
| `LOG_LEVEL` | API | `INFO` or `DEBUG` |

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   User's Browser                     │
└────────────────┬──────────────────────────────────────┘
                 │
        ┌────────┴────────────┐
        │                     │
┌───────▼────────┐   ┌────────▼────────┐
│ Webapp (React) │   │ Webapp-Admin    │
│  on Vercel     │   │  on Vercel      │
└────────┬───────┘   └────────┬────────┘
         │ HTTPS               │ HTTPS
         └────────┬────────────┘
                  │
            ┌─────▼──────┐
            │ API (Flask)│
            │ on Render  │
            └─────┬──────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
   ┌────▼──┐ ┌───▼──┐ ┌───▼──┐
   │ Postgres│ Redis│ Web3  │
   │Render  │Render│Mainnet│
   └────────┘ └─────┘ └──────┘
```

---

## 🔄 Deployment Workflow

### Automatic (GitHub Push)
1. Push to `main` branch
2. GitHub Actions runs tests
3. Render auto-deploys API
4. Vercel auto-deploys Webapps

### Manual (if needed)
```bash
# Render - redeploy specific version
# Dashboard → Deployments → Click deployment → "Redeploy"

# Vercel - rollback
# Dashboard → Deployments → Previous version → "Promote to Production"
```

---

## 📈 Monitoring & Troubleshooting

### Check API Health
```bash
curl -s https://your-render-url.onrender.com/health | jq .
# Should return: {"status": "ok"}
```

### View Logs
**Render (API):**
- Dashboard → Logs (live tail)

**Vercel (Webapp):**
- Deployments → Logs
- Browser console (F12)

### Common Issues

**"API connection refused"**
- Check `VITE_API_BASE` in webapp env vars
- Verify API is running: `curl https://your-render-url.onrender.com/health`
- Check `CORS_ORIGINS` in API env vars

**"Contract address not found"**
- Verify mainnet contract is deployed: etherscan.io
- Check `VITE_LAUNCHPAD_ADDRESS` is correct checksum address
- Ensure it's on mainnet (chain ID = 1)

**"Database connection failed"**
- Check `DATABASE_URL` is correct
- Verify Postgres is running (Render dashboard)
- Check PostgreSQL credentials

**"Redis not connecting"**
- Check `REDIS_URL` in env vars
- Verify Redis is running (Render dashboard)
- Try removing Redis (sessions will be in-memory only)

---

## 🛡️ Security Best Practices

✅ **DO:**
- Store all secrets in environment variables
- Use HTTPS everywhere
- Enable `SESSION_COOKIE_SECURE=true`
- Whitelist CORS origins
- Use strong `SECRET_KEY` (32+ random characters)
- Enable database backups
- Monitor Sentry for errors
- Keep dependencies updated

❌ **DON'T:**
- Commit `.env.production` files
- Use same secret for dev/staging/prod
- Expose API keys in frontend code
- Disable CORS validation
- Skip contract verification
- Leave debug mode on

---

## 🚨 Incident Response

### If API is down:
1. Check Render dashboard for errors
2. Review recent deployments
3. Check database/Redis status
4. If recent deploy caused it: rollback via Render UI
5. Or redeploy from last working commit

### If webapp is broken:
1. Check Vercel deployment logs
2. Open browser console (F12) for errors
3. Check API connectivity
4. Rollback via Vercel Deployments

### If contract is compromised:
1. Pause contract: `npx hardhat run scripts/pause.js --network mainnet`
2. Transfer admin ownership to multisig
3. Plan upgrade or migration

---

## 📞 Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Render Docs**: https://render.com/docs
- **Flask Docs**: https://flask.palletsprojects.com/
- **React Docs**: https://react.dev/
- **Web3.py Docs**: https://web3py.readthedocs.io/
- **Ethers.js Docs**: https://docs.ethers.org/

---

## ✅ Pre-Launch Checklist

- [ ] Contract deployed to mainnet
- [ ] Contract verified on Etherscan
- [ ] API deployed to Render
- [ ] API health check passes
- [ ] Webapp deployed to Vercel
- [ ] Webapp loads without errors
- [ ] Webapp-Admin deployed to Vercel
- [ ] All env vars set correctly
- [ ] Database backups enabled
- [ ] Sentry error tracking enabled
- [ ] Monitoring/alerts configured
- [ ] DNS records pointing to correct services
- [ ] SSL certificates auto-renewing
- [ ] Rate limiting enabled
- [ ] CORS configured correctly

---

**Last Updated**: December 2025  
**Status**: Ready for Production Deployment
