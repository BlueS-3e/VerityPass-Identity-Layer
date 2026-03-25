# Production Deployment Checklist

Last Updated: March 24, 2026  
Status: ⚠️ NOT READY - Multiple critical issues

---

## 🔴 CRITICAL FIXES (Must Complete)

### Code Changes Required

- [ ] **Fix creditApi endpoint path**
  - [ ] File: `webapp/src/utils/creditApi.js`
  - [ ] Line 8: Change `/credit/assess` → `/api/credit/assess`
  - [ ] Test: Verify credit assessment endpoint works
  - [ ] Deploy: Rebuild webapp with `npm run build`
  - **Blocking Until:** Fixed
  - **Effort:** 1 line, <5 minutes

- [ ] **Populate AttestaationRegistry addresses**
  - [ ] Deploy contracts: `cd contracts && npm run deploy:bsc`
  - [ ] Copy deployment addresses
  - [ ] Update `webapp/src/config.js` for all networks
  - [ ] Verify addresses are valid Ethereum addresses (0x...)
  - [ ] Test on-chain publishing works
  - **Blocking Until:** Deployed & updated
  - **Effort:** 20-30 minutes per network

### Configuration Required

- [ ] **Set NFT_STORAGE_API_KEY**
  - [ ] Create account at https://nft.storage
  - [ ] Generate API key
  - [ ] Set environment variable in production
  - [ ] Test: `curl -H "Authorization: Bearer $KEY" https://api.nft.storage/upload` (should return 422)
  - **Blocking Until:** Set in all envs
  - **Effort:** 5 minutes

- [ ] **Generate strong SECRET_KEY**
  - [ ] Run: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`
  - [ ] Set environment variable
  - [ ] Do NOT use default 'dev-insecure-secret'
  - **Blocking Until:** Production deploy
  - **Effort:** 2 minutes

- [ ] **Configure ALLOWED_ORIGINS**
  - [ ] List all frontend domains:
    - [ ] Production frontend URL
    - [ ] Staging frontend URL (if any)
    - [ ] Admin UI URL (if any)
  - [ ] Set: `ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com`
  - [ ] Test: CORS headers present in API responses
  - **Blocking Until:** Production deploy
  - **Effort:** 5 minutes

---

## 🟡 HIGH PRIORITY (Do Before Going Live)

### Configuration

- [ ] **Set PUBLIC_API_BASE or ENABLE_PROXY_FIX**
  - [ ] If behind load balancer/nginx: Enable ProxyFix
    - [ ] `ENABLE_PROXY_FIX=true`
    - [ ] `PROXY_FIX_X_FOR=1`
    - [ ] `PROXY_FIX_X_PROTO=1`
    - [ ] `PROXY_FIX_X_HOST=1`
  - [ ] If not behind proxy: Set explicit URL
    - [ ] `PUBLIC_API_BASE=https://api.your-domain.com`
  - [ ] Test: Call `/api/frontend-config`, verify `api_base` is correct
  - **Blocking Until:** Before launch
  - **Effort:** 10 minutes

- [ ] **Configure Admin Authentication**
  - [ ] **Option A: Password-based**
    - [ ] `ADMIN_PASSWORD=<strong-password>`  (not 'admin123')
    - [ ] Test: Admin login with password works
  - [ ] **Option B: OIDC (Google, Auth0, Okta)**
    - [ ] Create OAuth app in IdP
    - [ ] Set `OIDC_CLIENT_ID=<id>`
    - [ ] Set `OIDC_CLIENT_SECRET=<secret>`
    - [ ] Set `OIDC_ISSUER=<issuer-url>`
    - [ ] Test: Admin login with OIDC works
    - [ ] Set `OIDC_ADMIN_ALLOWLIST=admin@company.com` (optional)
  - **Blocking Until:** Before launch
  - **Effort:** 15-20 minutes

- [ ] **Set WalletConnect Project ID**
  - [ ] Create project at https://cloud.walletconnect.com
  - [ ] Get Project ID
  - [ ] Set `VITE_WALLETCONNECT_PROJECT_ID=<id>` in build/docker env
  - [ ] Test: WalletConnect modal appears in UI
  - [ ] Note: Can fall back to MetaMask if not set (not critical)
  - **Blocking Until:** For mobile support
  - **Effort:** 10 minutes

- [ ] **Set Frontend Environment Variables**
  - [ ] `VITE_API_BASE=https://api.your-domain.com` (or via docker)
  - [ ] `VITE_DEFAULT_CHAIN_ID=56` (or 97 for testnet)
  - [ ] `VITE_WALLETCONNECT_PROJECT_ID=<project-id>`
  - [ ] Rebuild frontend: `npm run build`
  - [ ] Test: Frontend connects to correct API
  - **Blocking Until:** Before launch
  - **Effort:** 5-10 minutes

### Code Enhancements

- [ ] **Implement wallet address checksum validation**
  - [ ] File: `webapp/src/utils/walletSessionManager.js`
  - [ ] Line 282: Replace TODO with checksum validation
  - [ ] Test: Invalid addresses rejected, valid addresses work
  - **Priority:** High, prevents on-chain errors
  - **Effort:** 10 minutes

---

## 🟢 IMPORTANT (Should Complete Before Launch)

### Configuration

- [ ] **Enable Redis for session persistence** (Recommended)
  - [ ] Set up Redis instance (Redis Cloud or self-hosted)
  - [ ] Set `REDIS_URL=redis://redis:6379/0`
  - [ ] Test: Sessions persist across restarts
  - **Note:** Without Redis, sessions only survive in-memory (fine for single process)
  - **Effort:** 15 minutes

- [ ] **Reduce SESSION_LIFETIME_SECONDS** (Optional but recommended)
  - [ ] Default: 604800 (7 days)
  - [ ] Recommended: 86400 (1 day) or 43200 (12 hours)
  - [ ] Set: `SESSION_LIFETIME_SECONDS=86400`
  - **Effort:** 2 minutes

- [ ] **Configure Sentry error tracking** (Optional but recommended)
  - [ ] Create Sentry project
  - [ ] Get DSN
  - [ ] Set `SENTRY_DSN=https://key@sentry.io/id`
  - [ ] Test: Errors appear in Sentry dashboard
  - **Note:** Without Sentry, errors logged to stdout only
  - **Effort:** 10 minutes

- [ ] **Set up monitoring for /metrics endpoint**
  - [ ] Prometheus metrics available at `/metrics`
  - [ ] Configure Prometheus/Grafana to scrape this endpoint
  - [ ] Key metrics: `realmint_requests_total`, `realmint_attestation_pin_*`, etc.
  - **Effort:** 20 minutes

### Testing

- [ ] **Test full attestation workflow**
  ```bash
  1. User authenticates (SIWE or OIDC)
  2. User creates attestation draft (/api/attestations/draft)
  3. User signs with wallet (EIP-712)
  4. Backend pins to IPFS (/api/attestations/pin)
  5. User publishes on-chain (manual contract call)
  6. Retrieve attestation (/api/attestations/<id>)
  ```
  - [ ] Create test attestation
  - [ ] Verify all steps succeed
  - [ ] Check nft.storage for pinned data
  - [ ] Verify on-chain transaction

- [ ] **Test credit assessment**
  - [ ] Call POST /api/credit/assess with mock data
  - [ ] Verify score returned (0-1000)
  - [ ] Verify loan offers generated
  - **Note:** This is mock algorithm, suitable for demo/MVP

- [ ] **Test admin functionality**
  - [ ] Admin login works (password or OIDC)
  - [ ] Admin can view projects
  - [ ] Admin can view attestations
  - [ ] Role-based access control works

- [ ] **Test error scenarios**
  - [ ] Invalid POST data → 400 error
  - [ ] Unauthorized access → 401 error
  - [ ] Forbidden access → 403 error
  - [ ] Missing endpoint → 404 error
  - [ ] Server error → 500 error (check Sentry)

---

## 🟡 OPTIONAL (Can Defer Post-Launch)

- [ ] **Implement real credit assessment model**
  - [ ] Current: Heuristic mock algorithm
  - [ ] Needed: Credit bureau integration or ML model
  - [ ] Timeline: Can be added post-launch
  - [ ] Effort:** 1-2 weeks

- [ ] **Enable Plaid integration** (If needed)
  - [ ] Create Plaid account
  - [ ] Set `PLAID_CLIENT_ID=<id>`
  - [ ] Set `PLAID_SECRET=<secret>`
  - [ ] Set `PLAID_ENV=production` (or 'sandbox')
  - [ ] Set `PLAID_ENCRYPTION_KEY=<key>` (optional, or derive from SECRET_KEY)
  - [ ] Test: Bank connection flow works
  - **Timeline:** Optional for MVP, can add later
  - **Effort:** 20 minutes

- [ ] **Additional rate limiting configuration**
  - [ ] Current: `/api/connect/plaid/accounts` has 10/minute limit
  - [ ] Add limits to: `/api/admin/*`, `/api/credit/assess`
  - [ ] Use Flask-Limiter decorators
  - **Timeline:** Recommended for production hardening
  - **Effort:** 15 minutes

- [ ] **Complete admin UI**
  - [ ] Current: API only, admin UI in separate repo
  - [ ] Needed: RBAC UI, analytics, reporting
  - **Timeline:** Can be added post-launch
  - **Effort:** 2-3 weeks

---

## Pre-Launch Verification Checklist

### Health Checks
- [ ] `GET /api/ready` returns 200 (database + Redis if configured)
- [ ] `GET /api/health` returns 200
- [ ] `GET /api/version` returns version info
- [ ] `GET /metrics` returns Prometheus metrics

### Configuration Verification
- [ ] `GET /api/frontend-config` returns correct `api_base`
- [ ] `GET /api/admin/auth_methods` returns enabled auth methods
- [ ] All attestationRegistry addresses populated in config
- [ ] No error logs about missing environment variables

### Feature Verification
- [ ] Attestation creation works (POST /api/attestations/draft)
- [ ] Identity binding works (POST /api/identity/bind)
- [ ] Admin login works (SIWE or OIDC)
- [ ] Credit assessment works (POST /api/credit/assess)
- [ ] Plaid endpoints gracefully handle missing credentials
- [ ] IPFS pinning works (with nft.storage key)

### Security Verification
- [ ] SESSION_COOKIE_SECURE=true in production
- [ ] SESSION_COOKIE_HTTPONLY=true
- [ ] CSRF tokens being sent and validated
- [ ] Rate limiting active on sensitive endpoints
- [ ] Error messages don't leak internals
- [ ] Admin allowlist enforced (if using OIDC)

### Monitoring & Logging
- [ ] Error tracking working (test with Sentry)
- [ ] Metrics endpoint accessible
- [ ] Logs being collected
- [ ] Health checks configured in deployment

---

## Deployment Steps

### Step 1: Prepare Backend (Staging)
```bash
# Set all critical environment variables
export NFT_STORAGE_API_KEY=<key>
export SECRET_KEY=<strong-key>
export ALLOWED_ORIGINS=https://staging-app.example.com
export PUBLIC_API_BASE=https://staging-api.example.com
export ADMIN_PASSWORD=<password>

# Deploy to staging
# Run tests
# Verify all endpoints work
```

### Step 2: Prepare Frontend (Staging)
```bash
# Build with environment variables
export VITE_API_BASE=https://staging-api.example.com
export VITE_DEFAULT_CHAIN_ID=97  # testnet
export VITE_WALLETCONNECT_PROJECT_ID=<id>
npm run build

# Deploy to staging
# Verify frontend connects to backend
# Test UI workflows
```

### Step 3: Deploy to Production
```bash
# Verify all staging tests passed
# Set production environment variables
# For backend (Render/Docker): Set via environment panel
# For frontend (Vercel): Rebuild with PROD environment variables

# Deploy backend
# Deploy frontend
# Run smoke tests
# Monitor for errors
```

### Step 4: Post-Launch Monitoring
```bash
# Monitor for 24-48 hours
- Check /api/ready every 5 minutes
- Check error rates in Sentry
- Monitor /metrics for anomalies
- Review user feedback
```

---

## Rollback Plan

If issues occur after production deployment:

1. **Frontend Rollback** (Vercel)
   - Navigate to previous deployment
   - Click "Redeploy"
   - Takes ~2 minutes

2. **Backend Rollback** (Render)
   - Go to Deployments tab
   - Select previous deployment
   - Click "Redeploy"
   - Takes ~3-5 minutes

3. **Database/State**
   - Attestations are immutable (stored on IPFS)
   - No data loss during rollback
   - Session cookies may be invalidated

---

## Quick Status Tracker

### Critical Blockers
- [ ] creditApi path fixed
- [ ] Contract addresses deployed & populated
- [ ] NFT_STORAGE_API_KEY obtained & set
- [ ] SECRET_KEY generated & set
- [ ] ALLOWED_ORIGINS configured

### High Priority
- [ ] ADMIN_PASSWORD or OIDC configured
- [ ] PUBLIC_API_BASE or ProxyFix configured
- [ ] VITE_WALLETCONNECT_PROJECT_ID set (if needed)
- [ ] Address checksum validation implemented

### Launch Readiness
- [ ] All critical blockers ✅
- [ ] All high priority ✅
- [ ] Testing completed ✅
- [ ] Monitoring configured ✅
- [ ] Team trained ✅
- [ ] Rollback plan ready ✅

**GO/NO-GO Decision:** 
- [ ] GO - All items complete, ready to launch
- [ ] NO-GO - Outstanding issues, need more time

---

## Support & Documentation

- Full Report: [PRODUCTION_READINESS_REPORT.md](PRODUCTION_READINESS_REPORT.md)
- Executive Summary: [PRODUCTION_READINESS_SUMMARY.md](PRODUCTION_READINESS_SUMMARY.md)
- API docs: See app.py docstrings for each endpoint
- Frontend config: See webapp/src/config.js
- Deployment guide: See DEPLOYMENT.md

---

**Last Status Update:** Not ready for production  
**Target Launch Date:** [Fill in your date]  
**Owner:** [Fill in responsible person]  
**Updated:** [Fill in update date]
