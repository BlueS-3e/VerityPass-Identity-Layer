/**
 * WalletConnect v2 integration using Web3Modal (Reown AppKit)
 * Replaces the old @walletconnect/web3-provider v1.x
 */

import { createWeb3Modal, defaultConfig } from '@web3modal/ethers';

let web3Modal = null;
let modalProvider = null;
let currentAccount = null;

function parseChainId(chainId) {
  if (chainId === undefined || chainId === null) return null;
  if (typeof chainId === 'number') return chainId;
  if (typeof chainId === 'string') {
    return chainId.startsWith('0x') ? parseInt(chainId, 16) : parseInt(chainId, 10);
  }
  return null;
}

/**
 * Initialize Web3Modal (call once on app load)
 * @param {string} projectId - WalletConnect Cloud project ID
 * @param {Object} options - Configuration options
 */
export async function initWeb3Modal(projectId, options = {}) {
  if (web3Modal) {
    console.log('[AppKit] Already initialized');
    return web3Modal;
  }

  if (!projectId) {
    throw new Error('WalletConnect projectId is required. Set VITE_WALLETCONNECT_PROJECT_ID.');
  }
  
  console.log('[AppKit] Initializing with Project ID:', projectId?.substring(0, 10) + '...');
  
  const {
    chains = [
      { chainId: 1, name: 'Ethereum', currency: 'ETH', explorerUrl: 'https://etherscan.io', rpcUrl: 'https://eth.llamarpc.com' },
      { chainId: 56, name: 'BSC', currency: 'BNB', explorerUrl: 'https://bscscan.com', rpcUrl: 'https://bsc-dataseed.binance.org' },
      { chainId: 97, name: 'BSC Testnet', currency: 'tBNB', explorerUrl: 'https://testnet.bscscan.com', rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545' },
      { chainId: 137, name: 'Polygon', currency: 'MATIC', explorerUrl: 'https://polygonscan.com', rpcUrl: 'https://polygon-rpc.com' },
      { chainId: 42161, name: 'Arbitrum', currency: 'ETH', explorerUrl: 'https://arbiscan.io', rpcUrl: 'https://arb1.arbitrum.io/rpc' },
      { chainId: 11155111, name: 'Sepolia', currency: 'ETH', explorerUrl: 'https://sepolia.etherscan.io', rpcUrl: 'https://sepolia.infura.io/v3/' }
    ],
    metadata = {
      name: 'VerityPass',
      description: 'On-chain identity and credit attestations',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://veritypass.app',
      icons: ['https://veritypass.app/favicon.ico']
    }
  } = options;

  const ethersConfig = defaultConfig({ metadata });

  // Create AppKit with full configuration
  web3Modal = createWeb3Modal({
    ethersConfig,
    chains,
    projectId,
    enableAnalytics: true,
    themeMode: 'dark',
    allWallets: 'SHOW',
    allowUnsupportedChain: true,
    standaloneMode: false,
    themeVariables: {
      '--w3m-accent': '#6366f1',
      '--w3m-border-radius-master': '12px',
      '--w3m-z-index': '9999'
    }
  });

  console.log('[AppKit] Initialized successfully');
  return web3Modal;
}

/**
 * Open WalletConnect modal and connect
 * @returns {Promise<{provider: BrowserProvider, address: string, chainId: number}>}
 */
export async function connectWithWalletConnect() {
  if (!web3Modal) {
    throw new Error('AppKit not initialized. Call initWeb3Modal() first.');
  }

  console.log('[AppKit] Opening connect modal...');

  return new Promise((resolve, reject) => {
    let resolved = false;
    let unsubscribe = null;
    let modalSeenOpen = false;
    let sawFreshConnectionSignal = false;
    let closeGraceTimer = null;

    const initialProvider = (() => {
      try {
        return web3Modal.getWalletProvider();
      } catch (e) {
        return null;
      }
    })();

    let initialAddress = null;

    const cleanup = () => {
      unsubscribe?.();
      if (closeGraceTimer) {
        clearTimeout(closeGraceTimer);
        closeGraceTimer = null;
      }
    };

    const isPageBackgrounded = () => (
      typeof document !== 'undefined' && document.visibilityState === 'hidden'
    );

    const isLikelyMobile = () => {
      if (typeof navigator === 'undefined') return false;
      const ua = String(navigator.userAgent || '').toLowerCase();
      return /android|iphone|ipad|ipod|iemobile|opera mini|mobile/.test(ua);
    };

    const tryResolveFromProvider = async () => {
      if (resolved) return false;

      // Do not resolve before the user has actually entered the modal flow.
      if (!modalSeenOpen) return false;

      let provider = null;
      try {
        provider = web3Modal.getWalletProvider();
      } catch (e) {
        provider = null;
      }

      if (!provider || typeof provider.request !== 'function') {
        return false;
      }

      let accounts = [];
      let chainIdRaw = null;
      try {
        accounts = await provider.request({ method: 'eth_accounts', params: [] });
      } catch (e) {
        accounts = [];
      }

      if (!Array.isArray(accounts) || accounts.length === 0) {
        return false;
      }

      try {
        chainIdRaw = await provider.request({ method: 'eth_chainId', params: [] });
      } catch (e) {
        chainIdRaw = null;
      }

      const chainId = parseChainId(chainIdRaw) || 1;

      const address = accounts[0];

      const providerChanged = provider !== initialProvider;
      const accountChanged = !initialAddress || String(initialAddress).toLowerCase() !== String(address).toLowerCase();

      // Prevent stale pre-existing provider/account state from resolving immediately.
      if (!sawFreshConnectionSignal && !providerChanged && !accountChanged) {
        return false;
      }

      resolved = true;
      clearTimeout(timeout);
      cleanup();

      currentAccount = address;
      modalProvider = provider;

      console.log('[AppKit] Connected successfully (provider probe):', {
        address,
        chainId
      });

      resolve({ provider, address, chainId });
      return true;
    };

    const timeout = setTimeout(() => {
      if (!resolved) {
        console.error('[AppKit] Connection timeout after 2 minutes');
        cleanup();
        resolved = true;
        reject(new Error('Connection timeout - wallet selection took too long'));
      }
    }, 120000);

    // Listen for state changes to know when connection succeeds
    const handleStateChange = async (newState) => {
      console.log('[AppKit] State changed:', {
        address: newState.address?.substring(0, 10) + '...' || 'none',
        chainId: newState.chainId,
        isConnected: newState.isConnected,
        open: newState.open,
        selectedNetworkId: newState.selectedNetworkId
      });

      if (resolved) return;

      if (newState.open) {
        modalSeenOpen = true;
      }

      if (modalSeenOpen && newState.isConnected && newState.address) {
        sawFreshConnectionSignal = true;
      }

      // Primary path: resolve from provider/accounts probe (works across state-shape variants)
      if (await tryResolveFromProvider()) {
        return;
      }

      // If modal was opened and then closed without any accounts available, treat as cancellation.
      if (modalSeenOpen && newState.open === false) {
        if (!closeGraceTimer) {
          const closeGraceMs = isPageBackgrounded() || isLikelyMobile() ? 25000 : 8000;
          closeGraceTimer = setTimeout(async () => {
            if (resolved) return;
            if (await tryResolveFromProvider()) return;

            // On mobile deep-link flows the page can be backgrounded while approval
            // is still in progress. Do not force-cancel in that state.
            if (isPageBackgrounded()) {
              closeGraceTimer = null;
              return;
            }

            // If modal closed and no account emerged after the grace period,
            // treat as cancellation/failure but with a generic user-facing error.
            resolved = true;
            clearTimeout(timeout);
            cleanup();
            reject(new Error('WalletConnect connection was cancelled or not completed'));
          }, closeGraceMs);
        }
      } else if (closeGraceTimer) {
        clearTimeout(closeGraceTimer);
        closeGraceTimer = null;
      }
    };

    // Subscribe to state changes first
    unsubscribe = web3Modal.subscribeState(handleStateChange);

    // Capture any pre-existing account to avoid treating stale state as a fresh approval.
    (async () => {
      if (!initialProvider || typeof initialProvider.request !== 'function') return;
      try {
        const accounts = await initialProvider.request({ method: 'eth_accounts', params: [] });
        if (Array.isArray(accounts) && accounts[0]) {
          initialAddress = accounts[0];
        }
      } catch (e) {
        initialAddress = null;
      }
    })();

    // Initial call to open the modal
    console.log('[AppKit] Opening modal...');
    web3Modal.open({ view: 'Connect' });

    // Secondary safety net: provider probe polling, independent of modal state payload shape.
    (async () => {
      for (let i = 0; i < 240 && !resolved; i += 1) {
        // 240 * 500ms = 120s max
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 500));
        // eslint-disable-next-line no-await-in-loop
        if (await tryResolveFromProvider()) break;
      }
    })();
  });
}

/**
 * Alternative simplified connection method - more reliable for QR code display
 * @returns {Promise<{provider: BrowserProvider, address: string, chainId: number}>}
 */
export async function connectWithWalletConnectSimple() {
  if (!web3Modal) {
    throw new Error('AppKit not initialized. Call initWeb3Modal() first.');
  }

  console.log('[AppKit] Opening modal (simplified method)...');
  
  // Directly open the modal to ensure QR code shows
  web3Modal.open({ view: 'Connect' });
  
  return new Promise((resolve, reject) => {
    const unsubscribe = web3Modal.subscribeState(async (state) => {
      if (state.isConnected && state.address) {
        try {
          unsubscribe();

          let provider = web3Modal.getWalletProvider();
          if (!provider) {
            for (let i = 0; i < 8 && !provider; i += 1) {
              await new Promise((r) => setTimeout(r, 250));
              provider = web3Modal.getWalletProvider();
            }
          }
          if (!provider) {
            throw new Error('Wallet provider unavailable after connection');
          }

          currentAccount = state.address;
          const address = state.address;
          const chainId = parseChainId(state.chainId) || 1;
          modalProvider = provider;

          console.log('[AppKit] Connected successfully:', {
            address,
            chainId
          });

          resolve({
            provider,
            address,
            chainId
          });
        } catch (err) {
          unsubscribe();
          reject(err);
        }
      }
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      unsubscribe();
      reject(new Error('Connection timeout'));
    }, 120000);
  });
}

/**
 * Disconnect from WalletConnect
 */
export async function disconnectWalletConnect() {
  if (web3Modal) {
    try {
      await web3Modal.disconnect();
      modalProvider = null;
      currentAccount = null;
      console.log('[AppKit] Disconnected');
    } catch (err) {
      console.error('[AppKit] Disconnect error:', err);
    }
  }
}

// getWalletConnectProvider defined below to return current modalProvider

/**
 * Get current connected provider (if any)
 */
export function getWalletConnectProvider() {
  try {
    return web3Modal?.getWalletProvider?.() || null;
  } catch (e) {
    return null;
  }
}

/**
 * Get the current account address
 * @returns {string|null}
 */
export function getWalletConnectAccount() {
  return currentAccount || null;
}

/**
 * Subscribe to wallet state changes
 * @param {Function} callback - { address, chainId, isConnected }
 * @returns {Function} unsubscribe
 */
export function subscribeToWalletState(callback) {
  if (!web3Modal) return () => {};
  return web3Modal.subscribeState((state) => {
    callback({
      address: state.address,
      chainId: state.chainId,
      isConnected: state.isConnected
    });
  });
}

/**
 * Subscribe to account/chain changes
 */
export function subscribeToWalletConnectEvents(callbacks = {}) {
  if (!web3Modal) return null;

  const { onAccountsChanged, onChainChanged, onDisconnect } = callbacks;

  const unsubscribeAccount = onAccountsChanged 
    ? web3Modal.subscribeAccount(onAccountsChanged)
    : () => {};

  const unsubscribeChain = onChainChanged
    ? web3Modal.subscribeChainId(onChainChanged)
    : () => {};

  const unsubscribeState = onDisconnect
    ? web3Modal.subscribeState((state) => {
        if (!state.open && !state.selectedNetworkId) {
          onDisconnect();
        }
      })
    : () => {};

  // Return cleanup function
  return () => {
    unsubscribeAccount();
    unsubscribeChain();
    unsubscribeState();
  };
}