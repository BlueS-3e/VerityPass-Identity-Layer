import React, { useEffect, useState } from 'react';
import { NETWORK_CONFIG, DEFAULT_CHAIN_ID } from '../config.js';
import { ensureBscChain } from '../utils/web3';
import { chooseInjectedProvider } from '../utils/providerDetect';

const STORAGE_KEY = 'selected_chain';

function chainsArray() {
  return Object.keys(NETWORK_CONFIG).map(k => ({ id: Number(k), ...NETWORK_CONFIG[k] })).sort((a,b)=>a.id-b.id);
}

export default function NetworkSelector() {
  const [selected, setSelected] = useState(() => {
    try { const v = localStorage.getItem(STORAGE_KEY); return v ? Number(v) : DEFAULT_CHAIN_ID; } catch (e) { return DEFAULT_CHAIN_ID; }
  });
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(selected)); } catch (e) {}
  }, [selected]);

  async function onChange(e) {
    const val = Number(e.target.value);
    setSelected(val);
    // Try to ask an injected wallet to switch to the chosen chain when possible
    // Prefer using the injected provider detected by providerDetect; fall back to window.ethereum
    const injectedAvailable = (() => {
      try { return Boolean(chooseInjectedProvider && chooseInjectedProvider()); } catch (e) { return Boolean(typeof window !== 'undefined' && window.ethereum); }
    })();
    if (injectedAvailable) {
      setChanging(true);
      try {
        const cfg = NETWORK_CONFIG[val];
        if (!cfg) return;
        await ensureBscChain({ useTestnet: cfg.chainIdHex === NETWORK_CONFIG[97].chainIdHex });
      } catch (err) {
      } finally {
        setChanging(false);
      }
    }
  }

  return (
    <label className="inline-flex items-center space-x-2 text-sm text-gray-200">
      <select aria-label="Network" value={selected} onChange={onChange} className="bg-gray-800 text-sm text-white rounded px-2 py-1">
        {chainsArray().map(c => (
          <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
        ))}
      </select>
      {changing && <span className="text-xs text-gray-400">switching…</span>}
    </label>
  );
}
