import React, { useState } from 'react';
import * as ethers from 'ethers';
import { selectBestProvider, connectWallet, preloadWalletConnect, setupProviderListeners } from '../utils/providerDetect';
import { getEthersProvider } from '../utils/ethersProvider';
import LendingWidget from '../components/LendingWidget';
import '../pages/AaveDemo.css';

export default function AaveDemoModal({ onClose }) {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);
  const [connecting, setConnecting] = useState(false);

  async function connect() {
  setConnecting(true);
    try {
      try { if (!window.ethereum) await preloadWalletConnect(); } catch (e) {}

      let preferred = null;
      if (typeof window !== 'undefined' && window.ethereum) preferred = window.ethereum;
      else preferred = await selectBestProvider().catch(() => null);

      if (!preferred) {
        alert('No wallet providers available. Install a wallet or enable WalletConnect.');
        throw new Error('No wallet providers available');
      }

      const result = await connectWallet(preferred).catch(async (err) => {
        const fallback = await selectBestProvider().catch(() => null);
        if (fallback && fallback !== preferred) return await connectWallet(fallback);
        throw err;
      });

      const { accounts, provider: rawProvider } = result || {};
      const finalProvider = getEthersProvider(rawProvider) || getEthersProvider(window.ethereum);
      setProvider(finalProvider);
      setAccount(accounts && accounts[0] ? accounts[0] : null);

      try {
        setupProviderListeners(rawProvider || window.ethereum, {
          onAccountsChanged: (accs) => setAccount(accs && accs[0] ? accs[0] : null),
          onChainChanged: () => window.location.reload(),
          onDisconnect: () => { setAccount(null); setProvider(null); }
        });
      } catch (e) {
        console.debug('setupProviderListeners failed', e);
      }
    } catch (e) {
      console.error('Wallet connect failed', e);
      alert('Failed to connect wallet. See console for details.');
    } finally {
      setConnecting(false);
    }
  }

  const handleMinimize = () => {
    // For modal version, minimizing will just close the modal to keep UX simple.
    onClose?.();
  };

  return (
    <div className="demo-overlay" role="dialog" aria-modal="true">
      <div className="demo-container">
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
              type="button"
            >
              −
            </button>
            <button
              onClick={() => onClose?.()}
              className="demo-btn demo-btn-secondary demo-btn-sm"
              title="Close"
              type="button"
            >
              ×
            </button>
          </div>
        </div>

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
                {connecting ? <span className="demo-spinner" aria-hidden="true" /> : null}
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
          </div>
        </div>
      </div>
    </div>
  );
}
