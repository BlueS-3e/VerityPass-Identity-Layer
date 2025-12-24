// Network and contract config. Update with deployed addresses when available.
export const NETWORK_CONFIG = {
  // Ethereum Mainnet (1) - Phantom supports this
  1: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    chainIdHex: '0x1',
    attestationRegistry: '' // set to deployed address when available
  },
  // Polygon Mainnet (137) - Phantom supports this
  137: {
    name: 'Polygon Mainnet',
    chainId: 137,
    chainIdHex: '0x89',
    attestationRegistry: '' // set to deployed address when available
  },
  // BSC Mainnet (56) - aka BNB Chain (Phantom may have limited support)
  56: {
    name: 'BNB Chain Mainnet',
    chainId: 56,
    chainIdHex: '0x38',
    attestationRegistry: '' // set to deployed address when available
  },
  // BSC Testnet (97) - for testing
  97: {
    name: 'BSC Testnet',
    chainId: 97,
    chainIdHex: '0x61',
    attestationRegistry: '' // set to deployed address when available
  },
  // Ethereum Sepolia (11155111) - for testing
  11155111: {
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    chainIdHex: '0xaa36a7',
    attestationRegistry: '' // set to deployed address when available
  },
  // Polygon Mumbai (80001) - for testing
  80001: {
    name: 'Polygon Mumbai',
    chainId: 80001,
    chainIdHex: '0x13881',
    attestationRegistry: '' // set to deployed address when available
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
  const buildTimeBase = import.meta.env.VITE_API_BASE;
  // If VITE_API_BASE is not set, use /api (works when Vercel proxies /api to backend)
  return buildTimeBase || '/api';
}
