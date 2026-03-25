import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { assertEnv } from './env-assert';
import { checkBackend } from './boot-checks';
import apiClient from './utils/apiClient';
import { API_BASE } from './config';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import Home from "./Home";
// Admin UI moved to a separate app (`webapp-admin`). The public dApp hides
// admin controls entirely to keep the UI simple for end users.
import NavBar from "./components/NavBar";
import AaveDemoTrigger from './components/AaveDemoTrigger';
import ModalProvider from './components/ModalProvider';
import { ToastProvider } from "./components/Toast";
import NotFound from './components/NotFound';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorPage from './components/ErrorPage';
// WalletProvider removed from root to avoid mounting wallet context for a browsing-only app.

const ConnectPlaid = lazy(() => import('./ConnectPlaid'));
const Launchpad = lazy(() => import('./Launchpad'));
const Attestation = lazy(() => import('./Attestation'));
const Guide = lazy(() => import('./Guide'));
const AaveDemo = lazy(() => import('./pages/AaveDemo'));

function RouteSkeleton() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-gray-300 backdrop-blur-sm">
        Loading workspace...
      </div>
    </div>
  );
}

// Assert required build-time envs (will throw in production builds)
try { assertEnv(); } catch (e) {
  // eslint-disable-next-line no-console
  console.error('Env assertion failed:', e);
  // rethrow to fail the build in production
  throw e;
}

// Render bootstrap: check backend health before mounting full app. If the
// backend is unreachable, show a clear overlay so users/CI know why the app
// would otherwise start with broken API calls.
async function bootstrap() {
  try {
    // Initialize Web3Modal v2 with WalletConnect Project ID
    // This is non-blocking - if it fails, the app still renders
    const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';
    if (projectId) {
      // Don't initialize Web3Modal at startup - it can cause issues
      // Initialize only when user actually clicks WalletConnect
      // Web3Modal will be lazy-loaded in providerDetect.js
      console.log('[Bootstrap] Web3Modal will be initialized on demand');
    } else {
      console.warn('[Bootstrap] VITE_WALLETCONNECT_PROJECT_ID not set — WalletConnect will not be available');
    }

    // Prefer server-provided runtime config when the frontend was built without
    // a VITE_API_BASE, or when the frontend is being served same-origin.
    const buildTimeApiBase = import.meta.env.VITE_API_BASE || '';
    console.log('[Bootstrap] Build-time API base:', buildTimeApiBase ? `${buildTimeApiBase.substring(0, 20)}...` : 'NOT SET');
    
    // On Vercel, always try to fetch runtime config from /api/frontend-config
    // This ensures the frontend can discover the backend URL even if env vars weren't injected
    if (!buildTimeApiBase || (typeof window !== 'undefined' && buildTimeApiBase && buildTimeApiBase.startsWith(window.location.origin))) {
      try {
        // First: try same-origin fetch (works for Vercel when API is served from same domain)
        const cfg = await apiClient.apiGet('/api/frontend-config').catch(() => null);
        if (cfg && cfg.api_base) {
          if (typeof window !== 'undefined') {
            window.__RUNTIME_API_BASE = cfg.api_base;
            window.__RUNTIME_FRONTEND_CONFIG = cfg;
          }
          console.log('[Bootstrap] Frontend config from /api/frontend-config:', cfg.api_base);
        } else {
          // Second: try localhost fallback for dev mode
          try {
            const fallback = 'http://localhost:5000';
            const fallbackCfg = await fetch(fallback + '/api/frontend-config', { credentials: 'include' }).then(r => r.ok ? r.json().catch(() => null) : null).catch(() => null);
            if (fallbackCfg && fallbackCfg.api_base && typeof window !== 'undefined') {
              window.__RUNTIME_API_BASE = fallbackCfg.api_base;
              window.__RUNTIME_FRONTEND_CONFIG = fallbackCfg;
              console.log('[Bootstrap] Frontend config from localhost fallback:', fallbackCfg.api_base);
            }
          } catch (e) {
            console.debug('[Bootstrap] Localhost fallback failed:', e.message);
          }
        }
      } catch (e) {
        console.debug('[Bootstrap] Frontend config fetch failed:', e.message);
      }
    }
    // Use the runtime-aware API_BASE() helper so the health check targets the
    // same endpoint that the app will use for API calls.
    const apiBase = API_BASE();
    console.log('[Bootstrap] Resolved API base:', apiBase ? `${apiBase.substring(0, 30)}...` : 'NOT SET');
    
    // In dev, allow app to render even if backend is unreachable
    const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
    
    // Skip health check on Vercel (production) if API_BASE is not fully configured
    // This prevents the app from blocking on an unreachable backend URL
    let backendOk = isDev;
    if (!isDev) {
      if (!apiBase || apiBase === 'http://localhost:5000') {
        console.warn('[Bootstrap] Production build with unconfigured API_BASE — skipping health check. Set VITE_API_BASE in Vercel env.');
        backendOk = true; // Allow UI to render; API calls will fail gracefully
      } else {
        // Try health check but don't block UI if it fails
        // The app will show errors for individual API calls that fail
        backendOk = await checkBackend().catch(() => false);
        if (!backendOk) {
          console.warn('[Bootstrap] Backend health check failed — app will render but API calls may fail. Check VITE_API_BASE and backend status.');
          backendOk = true; // Still render UI; let individual API calls fail gracefully
        }
      }
    }
    console.log('[Bootstrap] Backend health check:', backendOk ? 'OK' : 'SKIPPED');

    const root = ReactDOM.createRoot(document.getElementById("root"));

    if (!backendOk) {
      root.render(
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
          <div className="max-w-2xl p-6 bg-gray-900 rounded border border-gray-700 text-center">
            <h2 className="text-2xl font-semibold text-white mb-3">Backend unreachable</h2>
            <p className="text-sm text-gray-400 mb-4">The configured backend at <code className="bg-gray-800 px-1 rounded">{apiBase || '<unset>'}</code> did not respond to health checks.</p>
            <p className="text-sm text-gray-400 mb-4">Check your environment configuration and ensure the API is reachable. See <code className="bg-gray-800 px-1 rounded">VITE_API_BASE</code> in your build environment.</p>
            <div className="flex justify-center gap-3">
              <button className="px-4 py-2 bg-indigo-600 text-white rounded" onClick={() => location.reload()}>Retry</button>
            </div>
          </div>
        </div>
      );
      return;
    }

    // Normal app render
    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <ErrorBoundary>
            <ToastProvider>
              <ModalProvider>
                <NavBar />
                {/* Show a floating trigger in dev or when explicitly enabled */}
                {((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ENABLE_AAVE_DEMO) === 'true' || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV)) && (
                  <AaveDemoTrigger />
                )}
                {/* Main app routes */}
                <main className="pt-4">
                  <Suspense fallback={<RouteSkeleton />}>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/connect" element={<ConnectPlaid />} />
                      <Route path="/launch" element={<Launchpad />} />
                      {/* Admin functionality intentionally removed from the public app */}
                      {/* Route compatibility: keep '/attest' redirecting to canonical '/attestation' */}
                      <Route path="/attest" element={<Navigate to="/attestation" replace />} />
                      <Route path="/attestation" element={<Attestation />} />
                      <Route path="/guide" element={<Guide />} />
                      <Route path="/aave-demo" element={<AaveDemo />} />
                      {/* Unauthorized/admin routes removed from public app */}
                      <Route path="/error" element={<ErrorPage title="Server error" message="We had trouble reaching the server — try again later." ctaLabel="Go to Homepage" ctaTo="/" />} />
                      {/* Catch-all: show 404 for unknown routes */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </main>
              </ModalProvider>
            </ToastProvider>
          </ErrorBoundary>
        </BrowserRouter>
      </React.StrictMode>
    );
  } catch (error) {
    console.error('[Bootstrap] Unhandled error in bootstrap:', error);
    throw error; // Re-throw for the promise catch handler
  }
}

bootstrap().catch((error) => {
  console.error('[Bootstrap] Fatal error during app initialization:', error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(to br, #1e293b, #3f0f5c); font-family: system-ui, sans-serif; color: white; padding: 20px;">
        <div style="max-width: 600px; background: #111827; padding: 40px; border: 1px solid #374151; border-radius: 12px; text-align: center;">
          <h1 style="font-size: 24px; margin: 0 0 16px 0;">Initialization Failed</h1>
          <p style="color: #9ca3af; margin: 0 0 16px 0;">The application failed to start.</p>
          <pre style="text-align: left; background: #000; padding: 12px; border-radius: 6px; overflow: auto; font-size: 12px; color: #fbbf24; margin: 0 0 16px 0; max-height: 200px;">
${error?.message || 'Unknown error'}
${error?.stack ? '\n' + error.stack.split('\n').slice(0, 10).join('\n') : ''}
          </pre>
          <button onclick="location.reload()" style="padding: 12px 24px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">Reload Page</button>
        </div>
      </div>
    `;
  }
});
