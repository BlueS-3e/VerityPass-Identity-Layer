# 📖 Production Deployment Documentation Index

## 🚀 Start Here

**New to deployment?** Start with these in order:

1. **[PRODUCTION_READY.md](PRODUCTION_READY.md)** ← Start here! (5-minute overview)
   - What's been set up
   - Quick start (5 steps)
   - Pre-launch checklist
   - Troubleshooting quick links

2. **[PRODUCTION.md](PRODUCTION.md)** (30-minute comprehensive guide)
   - Complete reference documentation
   - Environment variables explained
   - Architecture overview
   - Monitoring & security checklist

3. **[DEPLOYMENT.md](DEPLOYMENT.md)** (Step-by-step walkthrough)
   - Render API deployment (detailed)
   - Vercel webapp deployment (detailed)
   - Post-deployment verification
   - Rollback procedures

---

## 🛠️ Automation Scripts

Run these to set up production:

```bash
# 1. Generate production environment files
bash scripts/setup-production.sh 0x<mainnet-contract-address>

# 2. Interactive deployment checklist
bash scripts/deployment-checklist.sh

# 3. Build & push Docker images (optional)
bash scripts/docker-build-api.sh
```

---

## 📁 Configuration Files

### For Vercel (Frontend)
- **`vercel.json`** - Webapp routing & caching
- **`webapp-admin/vercel.json`** - Admin dashboard routing
- **`webapp/.env.production`** - Webapp environment (to be generated)
- **`webapp-admin/.env.production`** - Admin environment (to be generated)

### For Render (Backend)
- **`render.yaml`** - Complete service definition
- **`api/requirements-prod.txt`** - Production dependencies
- **`api/Dockerfile.prod`** - Production Docker image
- **`api/.env.production`** - API environment (to be generated)

### CI/CD
- **`.github/workflows/deploy.yml`** - GitHub Actions pipeline

### Reference
- **`.env.production.example`** - All possible environment variables

---

## 📊 Deployment Targets

| Component | Platform | Build | Deploy | URL |
|-----------|----------|-------|--------|-----|
| webapp | Vercel | `npm run build` | auto | `https://yourdomain.com` |
| webapp-admin | Vercel | `npm run build` | auto | `https://admin.yourdomain.com` |
| api | Render | `pip install -r requirements-prod.txt` | auto | `https://api.yourdomain.com` |

---

## 🔄 Deployment Workflow

```
Push to main branch
    ↓
GitHub Actions runs tests
    ↓
    ├─ Hardhat tests (contracts/)
    ├─ pytest (api/)
    ├─ Vitest (webapp/)
    └─ Security scan
    ↓
All tests pass?
    ├─ YES → Render auto-deploys API
    │     → Vercel auto-deploys webapps
    └─ NO → Block deployment, show errors
```

---

## ✅ Pre-Deployment Checklist

- [ ] Mainnet contract deployed: `etherscan.io`
- [ ] Mainnet contract verified on Etherscan
- [ ] Generated env files: `bash scripts/setup-production.sh <address>`
- [ ] Updated `.env.production` files with real values
- [ ] Render account created + GitHub connected
- [ ] Vercel account created + GitHub connected
- [ ] Environment variables configured in both platforms
- [ ] API health check tested: `curl https://your-api/health`
- [ ] Webapps load without errors
- [ ] Full attestation flow tested on mainnet

---

## 🆘 Troubleshooting

**API connection refused?**
→ See: [PRODUCTION.md - Troubleshooting](PRODUCTION.md#-incident-response)

**Database connection failed?**
→ See: [PRODUCTION.md - Database Issues](PRODUCTION.md#-incident-response)

**Build fails on Vercel?**
→ See: [PRODUCTION.md - Build Failures](PRODUCTION.md#-incident-response)

**Deployment takes too long?**
→ See: [PRODUCTION.md - Performance](PRODUCTION.md#-incident-response)

**Contract address not found?**
→ See: [PRODUCTION.md - Contract Issues](PRODUCTION.md#-incident-response)

---

## 📞 Support Resources

- **Render**: https://render.com/docs
- **Vercel**: https://vercel.com/docs
- **Flask**: https://flask.palletsprojects.com/
- **React**: https://react.dev/
- **Web3.py**: https://web3py.readthedocs.io/
- **Ethers.js**: https://docs.ethers.org/

---

## 📚 Related Documentation

- **[architecture.md](architecture.md)** - System architecture & design
- **[contracts/README.md](contracts/README.md)** - Smart contract details
- **[DEVELOPER.md](DEVELOPER.md)** - Local development guide
- **[SECURITY.md](SECURITY.md)** - Security best practices

---

## 🎯 Quick Navigation

### I want to...

**Deploy the API**
→ [DEPLOYMENT.md - API Deployment](DEPLOYMENT.md#1-api-deployment-render)

**Deploy the webapps**
→ [DEPLOYMENT.md - Webapp Deployment](DEPLOYMENT.md#2-webapp-deployment-vercel)

**Set up monitoring**
→ [PRODUCTION.md - Monitoring & Alerts](PRODUCTION.md#📊-monitoring-&-alerts)

**Configure security**
→ [PRODUCTION.md - Security Best Practices](PRODUCTION.md#🛡️-security-best-practices)

**Rollback a deployment**
→ [DEPLOYMENT.md - Rollback Plan](DEPLOYMENT.md#7-rollback-plan)

**Debug an issue**
→ [PRODUCTION.md - Troubleshooting](PRODUCTION.md#-incident-response)

**Monitor production**
→ [PRODUCTION.md - Monitoring](PRODUCTION.md#📊-monitoring-&-alerts)

**Enable CI/CD**
→ [.github/workflows/deploy.yml](.github/workflows/deploy.yml)

---

## 📋 File Overview

| File | Purpose | Last Updated |
|------|---------|--------------|
| PRODUCTION_READY.md | Quick start guide | Dec 14, 2025 |
| PRODUCTION.md | Complete reference | Dec 14, 2025 |
| DEPLOYMENT.md | Step-by-step guide | Dec 14, 2025 |
| vercel.json | Webapp config | Dec 14, 2025 |
| webapp-admin/vercel.json | Admin config | Dec 14, 2025 |
| render.yaml | API infrastructure | Dec 14, 2025 |
| .github/workflows/deploy.yml | CI/CD pipeline | Dec 14, 2025 |

---

## 🚀 Status

✅ **Ready for Production Deployment**

All infrastructure, configuration, and documentation is in place. Follow the guides above to deploy your dApp to Vercel and Render.

---

**Last Updated**: December 14, 2025  
**Next Step**: Read [PRODUCTION_READY.md](PRODUCTION_READY.md) and follow the 5-step quick start!
