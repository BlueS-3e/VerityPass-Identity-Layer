// Network and contract config. Update with deployed addresses when available.
export const NETWORK_CONFIG = {
  // BSC Testnet (97)
  97: {
    name: 'BSC Testnet',
    chainIdHex: '0x61',
    attestationRegistry: '' // set to deployed address when available
  },
  // BSC Mainnet (56) - aka BNB Chain
  56: {
    name: 'BSC Mainnet',
    chainIdHex: '0x38',
    attestationRegistry: '' // set to deployed address when available
  },
  // Ethereum Goerli / Sepolia (example)
  5: {
    name: 'Goerli',
    chainIdHex: '0x5',
    attestationRegistry: ''
  }
};

// Allow build-time override with Vite env var VITE_DEFAULT_CHAIN_ID (e.g. 56 for BSC mainnet)
export const DEFAULT_CHAIN_ID = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_DEFAULT_CHAIN_ID)
  ? Number(import.meta.env.VITE_DEFAULT_CHAIN_ID)
  : 97; // default to BSC testnet for demo

// Base URL for backend API. When building with Vite you can set VITE_API_BASE.
// API_BASE is exposed as a function so the runtime can be overridden by a
// server-provided `/api/frontend-config` (set on window.__RUNTIME_API_BASE).
export function API_BASE() {
  if (typeof window !== 'undefined' && window.__RUNTIME_API_BASE) return window.__RUNTIME_API_BASE;
  return import.meta.env.VITE_API_BASE || 'http://localhost:5000';
}
