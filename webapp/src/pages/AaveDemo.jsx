import React, { useState, useEffect } from 'react';
import * as ethers from 'ethers';
import apiClient from '../utils/apiClient';
import { selectBestProvider, connectWallet, preloadWalletConnect, setupProviderListeners } from '../utils/providerDetect';
import { getEthersProvider } from '../utils/ethersProvider';
import LendingWidget from '../components/LendingWidget';
import './AaveDemo.css'; // Optional CSS file for additional styling

export default function AaveDemo() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Check if user has previously interacted with the demo
  useEffect(() => {
    const hasSeenDemo = localStorage.getItem('aave-demo-seen');
    // If the user navigated directly to the demo route, open immediately.
    const atDemoRoute = typeof window !== 'undefined' && window.location && window.location.pathname && window.location.pathname.endsWith('/aave-demo');
    if (!hasSeenDemo || atDemoRoute) {
      // Small timeout ensures route navigation/focus has settled before opening the modal
      setTimeout(() => setIsOpen(true), 10);
    }
  }, []);

  async function connect() {
    setConnecting(true);
    try {
      // If WalletConnect module might be needed, preload it to speed up UX
      try { if (!window.ethereum) await preloadWalletConnect(); } catch (e) {}

      // Choose provider: prefer injected `window.ethereum`, otherwise use best SDK entry
      let preferred = null;
      if (typeof window !== 'undefined' && window.ethereum) {
        preferred = window.ethereum;
      } else {
        preferred = await selectBestProvider().catch(() => null);
      }

      if (!preferred) {
        console.error('No wallet providers available (no injected provider and no SDK providers)');
        throw new Error('No wallet providers available');
      }

      // Use connectWallet which handles either an EIP-1193 provider or a provider entry (e.g., walletconnect)
      let result;
      try {
        result = await connectWallet(preferred);
      } catch (err) {
        // If preferred was an injected provider and failed, try SDK fallback
        console.warn('connectWallet(preferred) failed, trying selectBestProvider fallback', err);
        const fallback = await selectBestProvider().catch(() => null);
        if (fallback && fallback !== preferred) {
          result = await connectWallet(fallback).catch((e2) => { throw e2; });
        } else {
          throw err;
        }
      }

      const { accounts, provider: rawProvider } = result || {};

      const finalProvider = getEthersProvider(rawProvider) || getEthersProvider(window.ethereum);
      if (!finalProvider) {
        console.warn('Could not construct ethers provider from raw provider; wallet will be available as raw provider for signing but some features may not work.');
      }
      setProvider(finalProvider);
      setAccount(accounts && accounts[0] ? accounts[0] : null);

      // Setup listeners to keep UI in sync (accounts/chain/disconnect)
      try {
        const cleanup = setupProviderListeners(rawProvider || window.ethereum, {
          onAccountsChanged: (accs) => setAccount(accs && accs[0] ? accs[0] : null),
          onChainChanged: () => window.location.reload(),
          onDisconnect: () => { setAccount(null); setProvider(null); }
        });
        // Optionally keep cleanup if we later want to remove listeners
      } catch (e) {
        // non-fatal
        console.debug('setupProviderListeners failed', e);
      }
    } catch (e) {
      console.error('Wallet connect failed', e);
      alert('Failed to connect wallet. See console for details.');
    } finally {
      setConnecting(false);
    }
  }

  const handleOpenDemo = () => {
    setIsOpen(true);
    setIsMinimized(false);
    localStorage.setItem('aave-demo-seen', 'true');
  };

  const handleCloseDemo = () => {
    setIsOpen(false);
    setAccount(null);
    setProvider(null);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleExpand = () => {
    setIsMinimized(false);
  };

  // Demo notification badge for minimized state
  if (isMinimized) {
    return (
      <div className="demo-minimized">
        <button 
          onClick={handleExpand}
          className="demo-minimized-btn"
        >
          <div className="demo-badge">Demo</div>
          <span>Aave Lending Demo</span>
          <div className="demo-status">{account ? 'Connected' : 'Ready'}</div>
        </button>
      </div>
    );
  }

  // Main demo popup
  if (isOpen) {
    // fetch runtime config for display (non-blocking)
    const [runtimeCfg, setRuntimeCfg] = React.useState(null);
    React.useEffect(() => {
      let mounted = true;
      apiClient.apiGet('/api/frontend-config').then(c => { if (mounted) setRuntimeCfg(c); }).catch(() => {});
      return () => { mounted = false; };
    }, []);
    return (
      <div className="demo-overlay">
        <div className="demo-container">
          {/* Header */}
          <div className="demo-header">
            <div className="demo-header-content">
              <h2>Aave Lending Demo</h2>
              <p>Try the lending protocol with test assets</p>
            </div>
            <div className="demo-header-actions">
              <button 
                onClick={handleMinimize}
                className="demo-btn demo-btn-secondary demo-btn-sm"
                title="Minimize"
              >
                −
              </button>
              <button 
                onClick={handleCloseDemo}
                className="demo-btn demo-btn-secondary demo-btn-sm"
                title="Close"
              >
                ×
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="demo-content">
            <div className="demo-connection">
              {!account ? (
                <button 
                  type="button"
                  onClick={connect}
                  className="demo-btn demo-btn-primary"
                  aria-label="Connect wallet to start Aave demo"
                  disabled={connecting}
                >
                  {connecting ? (
                    <span className="demo-spinner" aria-hidden="true" />
                  ) : null}
                  <span>{connecting ? 'Connecting…' : 'Connect Wallet to Start Demo'}</span>
                </button>
              ) : (
                <div className="demo-account">
                  <div className="demo-account-badge">
                    <div className="demo-account-dot"></div>
                    Connected: {account.slice(0, 6)}...{account.slice(-4)}
                  </div>
                </div>
              )}
            </div>

            <div className="demo-widget-container">
              <LendingWidget provider={provider} />
            </div>

            <div className="demo-info">
              <h4>Demo Information</h4>
              <ul>
                <li>This is a <strong>demo environment</strong> using test assets</li>
                <li>Configure with <code>VITE_AAVE_POOL_ADDRESS</code> for testnet/local fork</li>
                <li>Set <code>VITE_AAVE_PRICE_ORACLE</code> for safety checks</li>
                <li>For local testing, run a fork and use test tokens</li>
              </ul>
              {runtimeCfg && (
                <div className="mt-3 text-sm text-gray-300">
                  <div className="font-medium">Runtime config (from /api/frontend-config)</div>
                  <div className="mt-1">
                    <div>Aave pool: <code className="text-xs">{runtimeCfg.aave_pool_address || '(unset)'}</code></div>
                    <div>Aave price oracle: <code className="text-xs">{runtimeCfg.aave_price_oracle || '(unset)'}</code></div>
                    <div>API base: <code className="text-xs">{runtimeCfg.api_base || '(unset)'}</code></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Closed state - show demo trigger
  return (
    // Hide the page-level trigger on small screens; mobile users should open
    // the demo from the slide-out menu instead (NavBar provides that entry).
    <div className="demo-trigger hidden md:block">
      <button
        type="button"
        onClick={handleOpenDemo}
        className="demo-trigger-btn"
        aria-expanded={isOpen}
        aria-controls="aave-demo"
      >
        <div className="demo-trigger-icon" aria-hidden>🚀</div>
        <span className="demo-trigger-label">Try Aave Demo</span>
      </button>
    </div>
  );
}