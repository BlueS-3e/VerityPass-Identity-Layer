# Vercel Deployment Troubleshooting

## Symptoms
- App shows blank page on Vercel deployment
- No errors visible in browser console
- Works fine locally

## Root Causes & Fixes

### Issue 1: Environment Variables Not Being Used in Build
**Problem**: You set env vars in Vercel dashboard, but they're not appearing in the built app.

**Why**: Vite only picks up environment variables that:
1. Start with `VITE_` prefix
2. Are set BEFORE the build command runs
3. Are explicitly exposed via `import.meta.env.VITE_*`

**Fix**:
1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add these variables (NOT under "Secrets", under "Environment Variables"):
   ```
   VITE_API_BASE = https://realmint-api.onrender.com
   VITE_WALLETCONNECT_PROJECT_ID = YOUR_WALLETCONNECT_ID
   VITE_DEFAULT_CHAIN_ID = 97
   ```
3. Click "Add" for each variable
4. Make sure they're set for **Production**, **Preview**, and **Development**
5. Redeploy (or trigger a manual redeploy from the dashboard)

### Issue 2: Blank Page / No JavaScript Errors
**Problem**: App loads but page is blank; no errors in console.

**Why**: The bootstrap code initializes successfully but the page stays blank.

**Fix**: 
1. Open **DevTools** (F12)
2. Go to **Console** tab
3. Look for `[Bootstrap]` messages
4. If you see: `[Bootstrap] Production build with unconfigured API_BASE — skipping health check`
   → This means `VITE_API_BASE` is not set; see Issue 1
5. If no `[Bootstrap]` messages at all:
   → Likely build failed; check **Vercel Deployment Logs**

### Issue 3: CORS Errors (403/Options Request Failed)
**Problem**: App loads, but DevTools shows CORS errors on API calls.

**Why**: Render's `ALLOWED_ORIGINS` environment variable doesn't include Vercel domain.

**Fix**:
1. Go to **Render Dashboard** → `realmint-api` service → **Environment**
2. Set `ALLOWED_ORIGINS` to include your Vercel domain:
   ```
   https://your-project-xyz.vercel.app,http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173
   ```
3. Redeploy Render service
4. Wait 30 seconds, then refresh Vercel app

### Issue 4: "Cannot access 'F1' before initialization"
**Problem**: React Router or wallet library fails with TDZ (Temporal Dead Zone) error.

**Why**: ESM module initialization order is broken.

**Fix**: Already fixed in code (vercel.json rewrite + vite.config.js removal of aliases)

---

## Verification Checklist

- [ ] `VITE_API_BASE` is set in Vercel **Environment Variables** (not Secrets)
- [ ] `VITE_WALLETCONNECT_PROJECT_ID` is set (can be test ID for now)
- [ ] Vercel rebuild triggered (manual redeploy if needed)
- [ ] Render's `ALLOWED_ORIGINS` includes your Vercel domain
- [ ] Render service redeployed after CORS config change
- [ ] Checked DevTools Console for `[Bootstrap]` or error messages
- [ ] Checked Vercel Deployment Logs for build errors

## Debug Steps

1. **Local verification**:
   ```bash
   cd webapp
   VITE_API_BASE=https://realmint-api.onrender.com npm run build
   npm run preview
   ```
   Visit http://localhost:4173 and check console logs

2. **View Vercel logs**:
   - Go to Vercel Dashboard
   - Click on the failed deployment
   - Scroll to "Build Logs" section
   - Look for any errors during npm run build

3. **Check if assets are loading**:
   - In DevTools Network tab
   - Look for `index.html`, `vendor-react.js`, `vendor-ethers.js`
   - If they're 404 → deployment didn't upload files correctly
   - If they're 200 but blank page → runtime JS error

4. **Enable detailed logs**:
   - In DevTools Console, paste:
     ```javascript
     console.log('Window location:', window.location);
     console.log('Runtime API base:', window.__RUNTIME_API_BASE);
     console.log('Root element:', document.getElementById('root'));
     ```

---

## Common Mistakes

❌ Setting env vars in `vercel.json` without using them
✅ Use Vercel Dashboard → Environment Variables instead

❌ Using `process.env.VITE_API_BASE` instead of `import.meta.env.VITE_API_BASE`
✅ Vite is build-time, not Node.js runtime

❌ Forgetting `VITE_` prefix in env var name
✅ Vercel/Vite only exposes `VITE_*` to frontend

❌ Setting env vars but not redeploying
✅ Always redeploy after env changes

---

## Still Blank?

Try the diagnostic endpoint:
- Visit `https://your-vercel-url/api.html`
- This shows which env vars are available in the build
- Should show whether `VITE_API_BASE` was injected

Or check the Vercel function logs:
```bash
vercel logs --follow
```

This will show real-time build and runtime logs from Vercel.
