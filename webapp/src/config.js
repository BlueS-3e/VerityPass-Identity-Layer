// Network and contract config. Update with deployed addresses when available.
export const NETWORK_CONFIG = {
  // BNB Chain Mainnet (56) - primary production network
  56: {
    name: 'BNB Chain Mainnet',
    chainId: 56,
    chainIdHex: '0x38',
    rpcUrl: 'https://bsc-dataseed.binance.org/',
    blockExplorer: 'https://bscscan.com',
    attestationRegistry: '' // set to deployed address when available
  },
  // BNB Chain Testnet (97) - primary staging network
  97: {
    name: 'BNB Chain Testnet',
    chainId: 97,
    chainIdHex: '0x61',
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    blockExplorer: 'https://testnet.bscscan.com',
    attestationRegistry: '0x2B5a1c4749b95b48F5Faf53cEd0130b21725e4a0' // deployed 2026-03-25
  },
  // Optional secondary networks
  1: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    chainIdHex: '0x1',
    rpcUrl: 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    attestationRegistry: '' // set to deployed address when available
  },
  137: {
    name: 'Polygon Mainnet',
    chainId: 137,
    chainIdHex: '0x89',
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    attestationRegistry: '' // set to deployed address when available
  },
  // Optional legacy testnets
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

// Allow build-time override with Vite env var VITE_DEFAULT_CHAIN_ID.
export const DEFAULT_CHAIN_ID = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_DEFAULT_CHAIN_ID)
  ? Number(import.meta.env.VITE_DEFAULT_CHAIN_ID)
  : 56; // default to BNB Chain mainnet

// Base URL for backend API. When building with Vite you can set VITE_API_BASE.
// API_BASE is exposed as a function so the runtime can be overridden by a
// server-provided `/api/frontend-config` (set on window.__RUNTIME_API_BASE).
export function API_BASE() {
  if (typeof window !== 'undefined' && window.__RUNTIME_API_BASE) return window.__RUNTIME_API_BASE;
  const buildTimeBase = import.meta.env.VITE_API_BASE;
  // On production (Vercel), if no VITE_API_BASE, default to Render backend
  // On localhost, default to localhost:5000
  if (buildTimeBase) return buildTimeBase;
  const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  return isDev ? 'http://localhost:5000' : 'https://realmint-api.onrender.com';
}
