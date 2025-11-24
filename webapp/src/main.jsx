import React from "react";
import ReactDOM from "react-dom/client";
import { assertEnv } from './env-assert';
import { checkBackend } from './boot-checks';
import apiClient from './utils/apiClient';
import { API_BASE } from './config';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import Launchpad from "./Launchpad";
import Home from "./Home";
// Admin UI moved to a separate app (`webapp-admin`). The public dApp hides
// admin controls entirely to keep the UI simple for end users.
import Attestation from "./Attestation";
import Guide from "./Guide";
import NavBar from "./components/NavBar";
import ConnectPlaid from './ConnectPlaid';
import AaveDemo from './pages/AaveDemo';
import AaveDemoTrigger from './components/AaveDemoTrigger';
import ModalProvider from './components/ModalProvider';
import { ToastProvider } from "./components/Toast";
import NotFound from './components/NotFound';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorPage from './components/ErrorPage';
// WalletProvider removed from root to avoid mounting wallet context for a browsing-only app.

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
  // Prefer server-provided runtime config when the frontend was built without
  // a VITE_API_BASE, or when the frontend is being served same-origin.
  const buildTimeApiBase = import.meta.env.VITE_API_BASE || '';
  if (!buildTimeApiBase || (typeof window !== 'undefined' && buildTimeApiBase && buildTimeApiBase.startsWith(window.location.origin))) {
    try {
      const cfg = await apiClient.apiGet('/api/frontend-config').catch(() => null);
      if (cfg && cfg.api_base) {
        // expose runtime API base for API_BASE() to pick up
        if (typeof window !== 'undefined') {
          window.__RUNTIME_API_BASE = cfg.api_base;
          window.__RUNTIME_FRONTEND_CONFIG = cfg;
        }
      } else {
        // If same-origin attempt failed (common in local dev when the API runs on
        // a different port), try a sensible localhost fallback so `npm run dev`
        // works without setting VITE_API_BASE explicitly.
        try {
          const fallback = 'http://localhost:5000';
          // try a direct request to the fallback host if same-origin didn't yield a config
          const fallbackCfg = await fetch(fallback + '/api/frontend-config', { credentials: 'include' }).then(r => r.ok ? r.json().catch(() => null) : null).catch(() => null);
          if (fallbackCfg && fallbackCfg.api_base && typeof window !== 'undefined') {
            window.__RUNTIME_API_BASE = fallbackCfg.api_base;
            window.__RUNTIME_FRONTEND_CONFIG = fallbackCfg;
          }
        } catch (e) {
          // ignore fallback failures
        }
      }
    } catch (e) {
      // ignore: fallback to apiBase below
    }
  }
  // Use the runtime-aware API_BASE() helper so the health check targets the
  // same endpoint that the app will use for API calls.
  const apiBase = API_BASE();
  const backendOk = await checkBackend().catch(() => false);

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
              </main>
            </ModalProvider>
          </ToastProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </React.StrictMode>
  );
}

bootstrap();
