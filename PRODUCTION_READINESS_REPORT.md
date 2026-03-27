# VerityPass Production Readiness Review
**Date:** March 24, 2026  
**Status:** Multiple critical issues identified - NOT PRODUCTION READY

---

## Executive Summary

The VerityPass platform consists of a React/Vite frontend and Flask backend with blockchain integration. While the core architecture is sound with good error handling, **8 critical issues must be fixed before production deployment**. The system currently has empty smart contract addresses, a misconfigured API endpoint path, and incomplete third-party integrations.

---

## 1. API ENDPOINTS INVENTORY & IMPLEMENTATION STATUS

### ✅ Core Attestation Endpoints (Implemented)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/attestations` | POST | ✅ Implemented | Receives signed attestations, verifies issuer signature |
| `/api/attestations/<id>` | GET | ✅ Implemented | Retrieves attestation by ID (includes draft status) |
| `/api/attestations/<id>/claim` | POST | ✅ Implemented | Allows bound identity to claim anonymous drafts |
| `/api/attestations/draft` | POST | ✅ Implemented | Creates draft attestation from Plaid metadata |
| `/api/attestations/pin` | POST | ✅ Implemented | Signs & pins attestation to nft.storage IPFS |

### ✅ Project Launchpad Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/projects` | GET | ✅ Implemented | Lists all projects (public) |
| `/api/projects` | POST | ✅ Implemented | Submit project for launchpad |
| `/api/uploads/exists/<filename>` | GET | ✅ Implemented | Check if uploaded file exists |

### ✅ Authentication & Admin Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/admin/check` | GET | ✅ Implemented | Verify admin session status |
| `/api/admin/nonce` | GET | ✅ Implemented | Get nonce for SIWE login |
| `/api/admin/csrf` | GET | ✅ Implemented | Get CSRF token |
| `/api/admin/auth_methods` | GET | ✅ Implemented | Return enabled auth methods |
| `/api/admin/siwe` | POST | ✅ Implemented | SIWE (Sign-In with Ethereum) login |
| `/api/admin/oidc/login` | GET | ✅ Implemented | OIDC login redirect |
| `/api/admin/oidc/callback` | GET | ✅ Implemented | OIDC callback handler |
| `/api/admin/oidc/dev-login` | GET | ✅ Implemented | Dev-only OIDC login (if enabled) |
| `/api/admin/projects` | GET | ✅ Implemented | Requires `operator` role |
| `/api/admin/projects/<id>` | PATCH | ✅ Implemented | Update project status |
| `/api/admin/projects/<id>` | DELETE | ✅ Implemented | Delete project |
| `/api/admin/attestations` | GET | ✅ Implemented | List attestations (filtered) |
| `/api/admin/attestations/export` | GET | ✅ Implemented | Export attestations as CSV |
| `/api/admin/attestations/<id>/detail` | GET | ✅ Implemented | Detailed attestation view |
| `/api/admin/roles` | GET/POST | ✅ Implemented | RBAC role management |
| `/api/admin/verify-owner` | POST | ✅ Implemented | Verify on-chain owner (contract lookup) |

### ✅ Identity Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/identity/bound` | GET | ✅ Implemented | Check if identity is bound to session |
| `/api/identity/bind` | POST | ✅ Implemented | Bind wallet identity via signature |
| `/api/identity/nonce` | GET | ✅ Implemented | Get nonce for identity binding |

### ⚠️ Plaid Integration Endpoints (Conditional)

| Endpoint | Method | Status | Details |
|----------|--------|--------|---------|
| `/api/connect/plaid/create_link_token` | POST | ⚠️ Conditional | Returns 400 if `PLAID_CLIENT_ID/SECRET` not set |
| `/api/connect/plaid/exchange_public_token` | POST | ⚠️ Conditional | Encrypts & stores access token |
| `/api/connect/plaid/accounts` | POST | ⚠️ Conditional | Fetches accounts & transactions (90 days) |
| `/api/connect/credentials` | GET | ✅ Implemented | List user's OAuth credentials |
| `/api/connect/credentials/<id>` | DELETE | ✅ Implemented | Delete stored credential |

### ❌ **CRITICAL: Credit Assessment Endpoint**

```
❌ FRONTEND BUG: src/utils/creditApi.js:8
   apiClient.apiPost('/credit/assess', payload)  // WRONG!
   
✅ CORRECT PATH: 
   apiClient.apiPost('/api/credit/assess', payload)
   
IMPACT: Credit assessment will FAIL in production
```

| Endpoint | Method | Status | Implementation |
|----------|--------|--------|-----------------|
| `/api/credit/assess` | POST | ⚠️ Mock Algorithm | Uses heuristic scoring, not real underwriting |

### ✅ Utility Endpoints

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/frontend-config` | GET | ✅ Implemented | Runtime config for frontend |
| `/api/version` | GET | ✅ Implemented | Version/git commit info |
| `/api/ready` | GET | ✅ Implemented | Health check (DB + Redis) |
| `/api/health` | GET | ✅ Implemented | Basic health status |
| `/metrics` | GET | ✅ Implemented | Prometheus metrics |

---

## 2. CRITICAL MISSING IMPLEMENTATIONS

### 🔴 **Issue #1: Empty Attestation Registry Addresses**

**File:** [src/config.js](src/config.js#L1-L50)

All smart contract addresses are empty strings:

```javascript
// BNB Chain Mainnet (56)
attestationRegistry: ''  // ← EMPTY!

// BNB Chain Testnet (97)
attestationRegistry: ''  // ← EMPTY!

// Ethereum Mainnet (1)
attestationRegistry: ''  // ← EMPTY!

// Polygon Mainnet (137)
attestationRegistry: ''  // ← EMPTY!

// Plus 3 more testnets...
```

**Consequence:**
- Users cannot publish attestations on-chain without manually entering contract address
- No validation that entered address is a valid AttestationRegistry
- UI shows empty input field in production

**Fix Required:**
```javascript
// After contract deployment on each chain, update:
56: {
  name: 'BNB Chain Mainnet',
  attestationRegistry: '0x<deployed-address>'
},
97: {
  name: 'BNB Chain Testnet',
  attestationRegistry: '0x<deployed-address>'
},
// ... etc for all networks
```

---

### 🔴 **Issue #2: Credit Assessment Endpoint Path Bug**

**File:** [src/utils/creditApi.js](src/utils/creditApi.js#L1-L10)

```javascript
// WRONG - Missing /api prefix
export default async function assessCredit(payload) {
  return apiClient.apiPost('/credit/assess', payload || {});
}

// CORRECT - Should be:
export default async function assessCredit(payload) {
  return apiClient.apiPost('/api/credit/assess', payload || {});
}
```

**Impact:** Credit scoring in the lending analysis flow will fail with 404 errors

**Fix:** [Change line 8 in creditApi.js](src/utils/creditApi.js#L8)

---

### 🔴 **Issue #3: Missing NFT_STORAGE_API_KEY**

**Files:** [app.py:1 onwards](api/app.py#L265-L275)

```python
NFT_KEY = os.getenv('NFT_STORAGE_API_KEY')
if not NFT_KEY:
    print("WARNING: NFT_STORAGE_API_KEY is not set...")
```

The backend explicitly warns but allows startup. When attestations are pinned:

```python
def pin_to_nft_storage(json_data: dict) -> str:
    api_key = getenv("NFT_STORAGE_API_KEY")
    if not api_key:
        raise RuntimeError("NFT_STORAGE_API_KEY not set in environment")
```

**Consequence:** All attestation pinning operations will throw 500 errors

**Required Actions:**
1. Obtain API key from [nft.storage](https://nft.storage)
2. Set environment variable in production: `NFT_STORAGE_API_KEY=<your-key>`
3. Test pinning in staging before production

---

### 🟡 **Issue #4: Wallet Address Checksum Not Validated**

**File:** [src/utils/walletSessionManager.js:282](src/utils/walletSessionManager.js#L282)

```javascript
// TODO: Implement proper checksum when ethers.js is available
```

**Problem:**
- Frontend accepts wallet addresses without checksum validation
- Can lead to mismatched addresses on-chain
- Contract calls with invalid checksums may fail

**Fix:**
```javascript
// Use ethers.js getAddress() for checksum
import { getAddress } from 'ethers';
const validatedAddress = getAddress(walletAddress);
```

---

### 🟡 **Issue #5: Mock Credit Assessment Algorithm**

**File:** [app.py:1593-1688](api/app.py#L1593-L1688)

The `/api/credit/assess` endpoint uses a heuristic algorithm, NOT real credit modeling:

```python
# Simple heuristic scoring (NOT PRODUCTION):
score = 300  # base
score += min(300, log10(income) * 50)           # income factor
score += min(250, log10(balance) * 60)          # balance factor  
score += min(150, transaction_count * 3)        # on-chain activity
# ... more simple math ...
score = max(0, min(1000, int(score)))

# Generates fake loan offers based on score
for i, tier in enumerate(tiers):
    offers.append({
        'amount': calculated_amount,
        'interestRate': calculated_rate,
        'term': calculated_term
    })
```

**This is for MVP/demo only.** Production needs:
- Real credit model or ML scoring
- Integration with credit bureaus (if needed)
- Proper loan origination system

**Current Status:** Acceptable for MVP, replace before real lending

---

## 3. CONFIGURATION ISSUES

### 🔴 **Critical - Must Set in Production Environment**

#### A. NFT_STORAGE_API_KEY (Attestation Pinning)
```bash
# Get from: https://nft.storage
# Set in Render/production:
NFT_STORAGE_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- **Impact:** Attestations cannot be persisted without this
- **Failure Mode:** 500 error on all pinning operations

#### B. SECRET_KEY (Session Security)
```bash
# Generate strong key:
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# Set in production:
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
```
- **Impact:** Session tokens can be forged if weak
- **Current Default:** 'dev-insecure-secret'
- **Production:** Automatically rejects insecure defaults

#### C. ALLOWED_ORIGINS (CORS)
```bash
# Set explicitly (not dev defaults):
ALLOWED_ORIGINS=https://veritypass.app,https://app.example.com
```
- **Current:** Defaults to `http://localhost:5173, http://localhost:5174, http://localhost:3000`
- **Warning:** Dev defaults printed to logs
- **Impact:** Open CORS if not configured

#### D. PUBLIC_API_BASE or ENABLE_PROXY_FIX (URL Reconstruction)
```bash
# Option 1: Explicit API base
PUBLIC_API_BASE=https://api.veritypass.io

# Option 2: Enable proxy fix (for nginx/load-balancer)
ENABLE_PROXY_FIX=true
PROXY_FIX_X_FOR=1
PROXY_FIX_X_PROTO=1
PROXY_FIX_X_HOST=1
```
- **Impact:** Frontend-config endpoint returns wrong API URL
- **Affects:** Runtime API base discovery

---

### 🟡 **High Priority - Strongly Recommended**

#### A. ADMIN Authentication
```bash
# Option 1: Password-based (if not using OIDC)
ADMIN_PASSWORD=<set-your-strong-password>

# Option 2: OIDC-based (Google, Auth0, etc.)
OIDC_CLIENT_ID=<your-client-id>
OIDC_CLIENT_SECRET=<your-secret>
OIDC_ISSUER=https://accounts.google.com  # or your IdP

# Admin allowlist (if using OIDC)
OIDC_ADMIN_ALLOWLIST=admin@company.com,ops@company.com

# Disable password login if using OIDC
DISABLE_PASSWORD_LOGIN=true
```

**Current Status:** 
- Password login disabled in production by default when using default password
- OIDC optional but recommended

#### B. REDIS_URL (Session Persistence & Rate Limiting)
```bash
REDIS_URL=redis://redis.internal:6379/0
```
- **Without Redis:** Sessions stored in-memory cookies (fine for dev)
- **With Redis:** Server-side sessions, survives restarts
- **Recommended:** Enable for production

#### C. VITE_WALLETCONNECT_PROJECT_ID (WalletConnect)
```bash
# Get from: https://cloud.walletconnect.com
VITE_WALLETCONNECT_PROJECT_ID=abc123def456
```
- **Impact:** WalletConnect modal will fail without this
- **Affects:** Mobile wallet users
- **Set at:** Build time or via docker env

#### D. VITE_API_BASE & VITE_DEFAULT_CHAIN_ID (Frontend Build)
```bash
# Frontend environment variables
VITE_API_BASE=https://api.veritypass.io           # Backend URL
VITE_DEFAULT_CHAIN_ID=56                        # 56=BNB mainnet, 97=testnet
VITE_WALLETCONNECT_PROJECT_ID=<project-id>
```

#### E. Plaid Integration (Optional)
```bash
PLAID_CLIENT_ID=<from-plaid>
PLAID_SECRET=<from-plaid>
PLAID_ENV=production  # or 'sandbox'
PLAID_ENCRYPTION_KEY=<32-byte-key>  # or derives from SECRET_KEY
```
- **Impact:** Bank connection flow won't work without this
- **Status:** Optional (graceful degradation if not set)

---

### 🟢 **Optional / Nice-to-Have**

#### A. Sentry Error Tracking
```bash
SENTRY_DSN=https://key@sentry.io/12345
```

#### B. Session Configuration
```bash
SESSION_LIFETIME_SECONDS=604800  # 7 days
SESSION_COOKIE_SECURE=true       # Auto-enabled in production
SESSION_COOKIE_HTTPONLY=true     # Auto-enabled
SESSION_COOKIE_SAMESITE=Lax      # Configurable
```

#### C. Rate Limiting
```bash
MAX_CONTENT_LENGTH=10485760  # 10MB file upload limit
# Flask-Limiter installed but configured per-endpoint
```

#### D. Admin UI URL
```bash
ADMIN_UI_URL=https://admin.veritypass.io
```

---

## 4. FRONTEND CHANGES NEEDED

### 🔴 **Critical: creditApi.js Endpoint Path**
```javascript
// FILE: src/utils/creditApi.js
// LINE 8: CHANGE FROM:
export default async function assessCredit(payload) {
  return apiClient.apiPost('/credit/assess', payload || {});
}

// TO:
export default async function assessCredit(payload) {
  return apiClient.apiPost('/api/credit/assess', payload || {});
}
```

### 🔴 **Critical: Populate Contract Addresses**
```javascript
// FILE: src/config.js
// Update all empty attestationRegistry fields with deployed addresses
// After running: contracts/scripts/deploy.js
```

**Deployment Flow:**
1. Deploy AttestationRegistry contract on target chain
2. Copy deployed address
3. Update src/config.js for that chain
4. Rebuild webapp with: `npm run build`
5. Deploy to Vercel or hosting

### 🟡 **High Priority: Wallet Address Checksum**
```javascript
// FILE: src/utils/walletSessionManager.js
// IMPLEMENT: Line 282 TODO for proper checksum validation
```

### 🟡 **Recommended: Error Boundary Enhancement**
- Users see better error messages when API fails
- Currently good, but could log to Sentry

---

## 5. API IMPLEMENTATION COMPLETENESS

### Implemented & Production-Ready ✅

**Attestation Flow:**
- [x] Draft creation from Plaid metadata
- [x] Signature verification (EIP-712 and legacy formats)
- [x] IPFS pinning to nft.storage
- [x] Draft claiming for bound identities
- [x] Attestation retrieval

**Authentication:**
- [x] SIWE (Sign-In with Ethereum) with nonce verification
- [x] OIDC integration (optional)
- [x] Session management (cookie or Redis)
- [x] CSRF protection (X-CSRF-Token)
- [x] Rate limiting (Flask-Limiter)

**Admin/RBAC:**
- [x] Role assignment system
- [x] Per-endpoint role checking
- [x] Audit logging
- [x] Owner verification via on-chain lookup

**Monitoring:**
- [x] Prometheus metrics pipeline
- [x] Health check endpoints
- [x] Error handling with Sentry integration

### Partially Implemented ⚠️

**Plaid Integration (Conditional):**
- [x] Link token creation
- [x] Public token exchange
- [x] Account/transaction fetching
- ❌ Does NOT validate Plaid's own signatures
- ❌ Token encryption uses derived key (not ideal for production)

⚠️ **Recommendation:** Set explicit `PLAID_ENCRYPTION_KEY` instead of deriving from SECRET_KEY

**Credit Assessment (Demo/MVP Only):**
- [x] Heuristic scoring algorithm
- [x] Mock loan offer generation
- ❌ NOT real credit underwriting
- ❌ No ML model or credit bureau integration

### Missing ❌

**On-Chain Integration:**
- ❌ Automatic smart contract calls (user must call directly)
- ❌ Contract state verification
- ❌ Transaction monitoring

**Admin UI Features (in separate webapp-admin repo):**
- ❌ Dashboard
- ❌ Attestation management UI
- ❌ Role management UI
- ❌ Analytics/reporting

---

## 6. THIRD-PARTY SERVICE DEPENDENCIES

### 🟢 **nft.storage** (IPFS Pinning)
- **Status:** Required, will fail gracefully
- **Setup:** Get API key from [nft.storage](https://nft.storage)
- **Integration Points:** 
  - Attestation pinning
  - Plaid credential anchoring (optional)
- **Failure Mode:** 500 error on `/api/attestations/pin`
- **Dependency:** Critical for attestation workflow

### 🟡 **Plaid** (Bank Connections)
- **Status:** Optional, graceful degradation
- **Setup:** Get credentials from [Plaid Dashboard](https://dashboard.plaid.com)
- **Integration Points:**
  - `/api/connect/plaid/create_link_token`
  - `/api/connect/plaid/exchange_public_token`
  - `/api/connect/plaid/accounts`
- **Failure Mode:** Returns `plaid_not_configured` (400)
- **Note:** Multiple SDK version compatibility handled

### 🟡 **WalletConnect** (Multi-Wallet Support)
- **Status:** Optional, graceful degradation
- **Setup:** Get project ID from [WalletConnect Cloud](https://cloud.walletconnect.com)
- **Integration Points:**
  - Frontend wallet selection modal
  - Mobile wallet connections
- **Failure Mode:** MetaMask/direct injection still works; WC unavailable
- **Dependency:** Not critical if `window.ethereum` available

### 🟡 **OIDC Provider** (Admin Login)
- **Status:** Optional, alternatives available
- **Setup:** Configure with Google, Auth0, Okta, etc.
- **Integration Points:**
  - `/api/admin/oidc/login`
  - `/api/admin/oidc/callback`
- **Alternatives:** SIWE (Sign-In with Ethereum) or password login
- **Dependency:** Not critical; other auth methods work

### 🟢 **Redis** (Optional)
- **Status:** Optional enhancement
- **Used For:**
  - Server-side sessions (instead of cookies)
  - Rate limiting backend storage
  - Nonce persistence
- **Failure Mode:** Falls back to in-memory storage
- **Dependency:** Nice-to-have, not critical

---

## 7. SESSION & AUTHENTICATION ISSUES

### ✅ Good Practices Implemented

1. **Secure Cookie Configuration**
   ```python
   SESSION_COOKIE_HTTPONLY = True      # Prevent XSS access
   SESSION_COOKIE_SECURE = True        # HTTPS only in production
   SESSION_COOKIE_SAMESITE = 'Lax'     # CSRF defense (configurable)
   ```

2. **Nonce Verification for SIWE**
   ```python
   # One-time nonce prevents replay attacks
   # Stored in Redis or in-memory with TTL
   ```

3. **Message Signature Verification**
   ```python
   # Multiple recovery strategies for EIP-712 and legacy formats
   # Handles different wallet implementations
   ```

4. **CSRF Protection**
   ```
   X-CSRF-Token header required for state-changing operations
   ```

### ⚠️ Known Limitations

#### 1. **In-Memory Nonce Store (Without Redis)**
```python
_nonce_store = {}
_nonce_lock = threading.Lock()

# Problem: Nonces only valid while process running
# Fix: Set REDIS_URL for production
```

**Impact:** If backend restarts, all nonces become invalid
- Users might need to restart SIWE flow
- Acceptable for demo, needs Redis for production reliability

#### 2. **Session Timeout**
```python
PERMANENT_SESSION_LIFETIME = timedelta(seconds=604800)  # 7 days default
```

**Recommendation:** Reduce for sensitive operations
```bash
SESSION_LIFETIME_SECONDS=86400  # 1 day
```

#### 3. **OIDC Configuration Not Validated**
```python
if _oidc_available and OIDC_ISSUER and OIDC_CLIENT_ID and OIDC_CLIENT_SECRET:
    # Assumes OIDC provider exists and is reachable
    # No connection test before startup
```

**Risk:** Misconfigured OIDC won't fail until login attempted

#### 4. **Admin Allowlist Enforcement**
```python
OIDC_ADMIN_ALLOWLIST = os.getenv('OIDC_ADMIN_ALLOWLIST')
# Checked at runtime in require_admin decorator
# But only if OIDC_ADMIN_ALLOWLIST is set
```

**Recommendation:** Test with allowlist empty, then populated

---

## 8. ERROR HANDLING ASSESSMENT

### ✅ Good Error Handling

**API Errors:**
- Return JSON (not HTML) for API routes
- Include status codes (400, 401, 403, 404, 500)
- Avoid leaking exception details in production
- Log errors to stdout and Sentry (if configured)

**Frontend Errors:**
- Try/catch blocks on async operations
- Toast notifications for user-facing errors
- Console logging for debugging
- Error boundaries for React errors

### ⚠️ Potential Issues

**Silent Failures:**
```javascript
// In multiple places:
try { ... } catch (e) { }  // Silently fails
```

**Unvalidated API Responses:**
- Some endpoints don't validate response structure
- Could crash if API changes shape

**Rate Limiting:**
- Only applied to `/api/connect/plaid/accounts` (10/minute)
- Other endpoints not rate limited
- Consider adding to `/api/admin/*` endpoints

---

## 9. MISSING CRITICAL IMPLEMENTATIONS SUMMARY

| Item | File | Issue | Severity | Fix Effort |
|------|------|-------|----------|-----------|
| creditApi endpoint path | src/utils/creditApi.js:8 | `/credit/assess` → `/api/credit/assess` | 🔴 Critical | 1 line |
| Attestation addresses empty | src/config.js | All `attestationRegistry: ''` | 🔴 Critical | After deploy |
| NFT_STORAGE_API_KEY | api/app.py | Required but not set | 🔴 Critical | 1 env var |
| Address checksum validation | src/utils/walletSessionManager.js:282 | TODO not implemented | 🟡 High | 2-3 lines |
| Credit model is mock | api/app.py:1593+ | Heuristic, not real | 🟡 High | Build real model |
| ADMIN auth not configured | api/app.py | Password/OIDC optional | 🟡 High | 1+ env vars |
| In-memory nonce store | api/app.py | Falls back without Redis | 🟡 Medium | Set REDIS_URL |
| OIDC not validated | api/app.py | Assumes provider exists | 🟡 Medium | Test before deploy |

---

## 10. PRODUCTION CHECKLIST

### Phase 1: Critical Fixes (Before Any Deployment)

- [ ] **Fix creditApi endpoint path** 
  - Change `/credit/assess` to `/api/credit/assess`
  - Test credit assessment flow

- [ ] **Deploy smart contracts**
  - Run: `cd contracts && npm run deploy:bsc`
  - Save contract addresses

- [ ] **Update attestation registry addresses**
  - Update `src/config.js` with deployed addresses
  - Verify all chains have valid addresses

- [ ] **Obtain nft.storage API key**
  - Get from https://nft.storage
  - Set `NFT_STORAGE_API_KEY` environment variable

- [ ] **Generate strong SECRET_KEY**
  - Don't use default 'dev-insecure-secret'
  - Use: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`

### Phase 2: Configuration (Before Production Deployment)

- [ ] **ALLOWED_ORIGINS** - Explicitly set CORS origins
- [ ] **PUBLIC_API_BASE** - Set correct API URL or enable ProxyFix
- [ ] **ADMIN authentication** - Configure password or OIDC
- [ ] **VITE_WALLETCONNECT_PROJECT_ID** - Get from WalletConnect Cloud or remove
- [ ] **VITE_DEFAULT_CHAIN_ID** - Set to 56 (BNB Mainnet) or target chain
- [ ] **VITE_API_BASE** - Set in build or via docker env

### Phase 3: Optional But Recommended

- [ ] **REDIS_URL** - For session persistence
- [ ] **Sentry integration** - Error tracking
- [ ] **Rate limiting tuning** - Adjust limits as needed
- [ ] **OIDC admin allowlist** - Restrict admin access

### Phase 4: Pre-Launch Testing

- [ ] **Health check** - `GET /api/ready` returns 200
- [ ] **Attestation flow** - Create draft → pin → retrieve
- [ ] **Credit assessment** - POST to `/api/credit/assess`
- [ ] **Admin login** - Test SIWE or OIDC
- [ ] **Frontend config** - Verify `/api/frontend-config` returns correct values
- [ ] **Error scenarios** - Test 400/401/403/404/500 responses

### Phase 5: Security Review

- [ ] **SESSION_COOKIE_SECURE** - Enabled in production
- [ ] **CSRF tokens** - Being set and validated
- [ ] **Rate limiting** - Configured for sensitive endpoints
- [ ] **Admin allowlist** - Set if using OIDC
- [ ] **Sentry** - Capturing exceptions
- [ ] **Monitoring** - `/metrics` endpoint accessible to ops

---

## 11. RECOMMENDATIONS

### Immediate Actions (Do Before Production)

1. **Fix the credit API endpoint** - 1 line change, critical bug
2. **Populate contract addresses** - Required for on-chain publishing
3. **Set NFT_STORAGE_API_KEY** - Blocks all attestation pinning
4. **Configure ALLOWED_ORIGINS** - Essential for security
5. **Set up strong SECRET_KEY** - Session security depends on it

### Before Going Live

1. **Test full attestation workflow**
   - Create draft
   - Bind identity
   - Sign with wallet
   - Pin to IPFS
   - Retrieve from API

2. **Verify admin authentication works**
   - Configure ADMIN_PASSWORD or OIDC
   - Test login flow
   - Verify role-based access

3. **Enable Redis for production**
   - Ensures session persistence
   - Improves rate limiting
   - Required for clustering

4. **Configure error tracking**
   - Set up Sentry
   - Monitor error rates
   - Test error forwarding

### Long-Term Improvements

1. **Replace mock credit model**
   - Integrate real credit bureau data
   - Apply ML scoring model
   - Implement proper loan underwriting

2. **Implement on-chain automation**
   - Auto-publish attestations to smart contracts
   - Monitor on-chain state
   - Handle transaction failures

3. **Complete admin UI**
   - Dashboard for operation monitoring
   - Attestation management interface
   - Analytics and reporting

4. **Production hardening**
   - DDoS protection (via Cloudflare, etc.)
   - WAF rules
   - Database backups
   - Monitoring/alerting

---

## Appendix: Environment Variables Summary

### Critical (Must Set in Production)

```bash
# IPFS Pinning
NFT_STORAGE_API_KEY=<from-nft.storage>

# Security
SECRET_KEY=<strong-random-key>
ALLOWED_ORIGINS=https://your-frontend.com

# API Configuration
PUBLIC_API_BASE=https://api.your-domain.com
# OR
ENABLE_PROXY_FIX=true

# Admin Access (pick one)
ADMIN_PASSWORD=<strong-password>
# OR
OIDC_CLIENT_ID=<client-id>
OIDC_CLIENT_SECRET=<client-secret>
OIDC_ISSUER=<idp-url>
```

### Recommended for Production

```bash
REDIS_URL=redis://redis:6379/0
SENTRY_DSN=https://key@sentry.io/id
SESSION_LIFETIME_SECONDS=86400
VITE_WALLETCONNECT_PROJECT_ID=<project-id>
VITE_DEFAULT_CHAIN_ID=56
VITE_API_BASE=https://api.your-domain.com
```

### Optional

```bash
PLAID_CLIENT_ID=<client-id>
PLAID_SECRET=<secret>
PLAID_ENV=production
ADMIN_UI_URL=https://admin.your-domain.com
OIDC_ADMIN_ALLOWLIST=admin@company.com
```

---

## Document Metadata

- **Version:** 1.0
- **Date:** March 24, 2026
- **Reviewed:** Comprehensive code audit
- **Scope:** Frontend (React), Backend (Flask), Configuration, Third-party integrations
- **Status:** NOT PRODUCTION READY - 8 critical issues identified
