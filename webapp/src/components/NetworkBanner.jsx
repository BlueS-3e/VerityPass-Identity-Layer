import React, { useEffect, useState } from 'react';
import { ensureBscChain } from '../utils/web3';
import { chooseInjectedProvider, listInjectedProviders, normalizeProviderEntry } from '../utils/providerDetect';

// Minimal RPC map for common dev/test chains. Extend as needed.
const RPC_MAP = {
  '0x61': 'https://data-seed-prebsc-1-s1.binance.org:8545/', // BSC testnet
  '0x38': 'https://bsc-dataseed.binance.org/', // BSC mainnet
  '0x5': 'https://rpc.ankr.com/eth_goerli' // example
};

export default function NetworkBanner({ expectedChainHex, expectedName, addToast, provider: injectedProvider }) {
  const [currentChain, setCurrentChain] = useState(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // explicit selection UI removed; we rely on auto-detection heuristics instead
  const [selectedProvider] = useState(null);

  // Provider normalization delegated to providerDetect.normalizeProviderEntry

  useEffect(() => {
    let mounted = true;
    async function detect() {
      try {
        const providers = listInjectedProviders();
        const chosenEntry = injectedProvider || selectedProvider || chooseInjectedProvider();
        const chosen = normalizeProviderEntry(chosenEntry) || (chosenEntry && chosenEntry.provider) || chooseInjectedProvider();
        if (!chosen) { if (mounted) setHasWallet(false); return; }
        if (mounted) setHasWallet(true);
        const chain = await (chosen && chosen.request ? chosen.request({ method: 'eth_chainId' }).catch(() => null) : null);
        if (mounted) setCurrentChain(chain);
        if (chosen && chosen.on) {
          const handler = (chainId) => {
            setCurrentChain(chainId);
            setDismissed(false);
          };
          try { chosen.on('chainChanged', handler); chosen.on('accountsChanged', () => {}); } catch (e) {}
          const cleanup = () => { try { if (chosen && chosen.removeListener) chosen.removeListener('chainChanged', handler); } catch (e) {} };
          return cleanup;
        }
      } catch (e) {
        if (mounted) setCurrentChain(null);
      }
    }
    const cleanupPromise = detect();
    return () => {
      mounted = false;
      if (cleanupPromise && typeof cleanupPromise === 'function') {
        try { cleanupPromise(); } catch (e) {}
      }
    };
  }, []);

  // Do not show banner if we have no EVM provider or no expected chain to compare
  if (!hasWallet) return null;
  if (!expectedChainHex) return null;
  if (!currentChain) return null;

  // Normalize chain ids; allow numeric or hex comparison
  const normalize = (v) => {
    if (v == null) return null;
    try {
      if (typeof v === 'number') return '0x' + v.toString(16);
      const s = String(v).toLowerCase();
      if (s.startsWith('0x')) return s;
      // parse numeric string
      const n = Number(s);
      if (!Number.isNaN(n)) return '0x' + n.toString(16);
      return s;
    } catch (e) { return String(v); }
  };

  const curNorm = normalize(currentChain);
  const expNorm = normalize(expectedChainHex);
  if (curNorm && expNorm && curNorm === expNorm) return null;
  if (dismissed) return null;

  const rpc = RPC_MAP[expectedChainHex] || ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_RPC_URL) ? import.meta.env.VITE_RPC_URL : '');

  async function handleSwitch() {
    try {
  // pick provider as above (prefer injected prop, else auto-detect)
  const chosenEntry = injectedProvider || chooseInjectedProvider();
  const chosen = normalizeProviderEntry(chosenEntry) || chosenEntry;
  const res = await ensureBscChain({ useTestnet: expectedChainHex === '0x61' }, chosen);
      if (res && res.already) {
        addToast?.('Already on expected network', 'info');
      } else if (res && res.switched) {
        addToast?.('Switched network in wallet', 'success');
      } else if (res && res.added) {
        addToast?.('Added network to wallet (please accept)', 'info');
      } else {
        addToast?.('Network switch requested', 'info');
      }
    } catch (e) {
      console.error('switch error', e);
      addToast?.(e?.message || 'Unable to switch network automatically', 'error');
    }
  }

  function handleCopyRpc() {
    if (!rpc) { addToast?.('No RPC URL available for this network', 'error'); return; }
    try {
      navigator.clipboard?.writeText(rpc);
      addToast?.('RPC URL copied to clipboard', 'success');
    } catch (e) {
      addToast?.('Could not copy RPC URL', 'error');
    }
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 bg-yellow-900 text-yellow-100 border border-yellow-800 rounded-lg shadow-lg">
      {/* If multiple injected providers exist, offer a selector so users can pick which wallet to act with */}
      {/* Provider selection UI removed per user request */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex-1 text-sm">
          <strong className="mr-2">Wrong network:</strong>
          Connected to <span className="font-mono">{currentChain}</span> — expected <span className="font-semibold">{expectedName || expectedChainHex}</span>.
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSwitch} className="px-3 py-1 bg-yellow-700 hover:bg-yellow-600 rounded text-sm">Switch</button>
          <button onClick={handleCopyRpc} className="px-3 py-1 bg-yellow-800 hover:bg-yellow-700 rounded text-sm">Copy RPC</button>
          <button aria-label="Close network banner" onClick={() => { setDismissed(true); addToast?.('Banner dismissed', 'info'); }} className="px-2 py-1 ml-2 bg-transparent hover:bg-yellow-800 rounded text-sm">✕</button>
        </div>
      </div>
    </div>
  );
}
