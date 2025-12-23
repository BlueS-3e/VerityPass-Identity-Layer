/**
 * WalletConnect v2 integration using Web3Modal (Reown AppKit)
 * Replaces the old @walletconnect/web3-provider v1.x
 */

import { createWeb3Modal, defaultConfig } from '@web3modal/ethers';
import { BrowserProvider } from 'ethers';

let web3Modal = null;
let modalProvider = null;
let currentAccount = null;

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
  
  console.log('[AppKit] Initializing with Project ID:', projectId?.substring(0, 10) + '...');
  
  const {
    chains = [
      { chainId: 1, name: 'Ethereum', currency: 'ETH', explorerUrl: 'https://etherscan.io', rpcUrl: 'https://eth.llamarpc.com' },
      { chainId: 56, name: 'BSC', currency: 'BNB', explorerUrl: 'https://bscscan.com', rpcUrl: 'https://bsc-dataseed.binance.org' },
      { chainId: 137, name: 'Polygon', currency: 'MATIC', explorerUrl: 'https://polygonscan.com', rpcUrl: 'https://polygon-rpc.com' },
      { chainId: 42161, name: 'Arbitrum', currency: 'ETH', explorerUrl: 'https://arbiscan.io', rpcUrl: 'https://arb1.arbitrum.io/rpc' },
      { chainId: 11155111, name: 'Sepolia', currency: 'ETH', explorerUrl: 'https://sepolia.etherscan.io', rpcUrl: 'https://sepolia.infura.io/v3/' }
    ],
    metadata = {
      name: 'RealMint',
      description: 'On-chain identity and credit attestations',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://realmint.app',
      icons: ['https://realmint.app/favicon.ico']
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
    let modalOpened = false;

    const cleanup = () => {
      unsubscribe?.();
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

      // When a wallet is connected (address is set), create and return provider
      if (newState.isConnected && newState.address && !resolved) {
        try {
          console.log('[AppKit] Wallet connected, creating provider...');
          clearTimeout(timeout);
          resolved = true;
          cleanup();

          currentAccount = newState.address;
          const provider = web3Modal.getWalletProvider();

          if (!provider) {
            throw new Error('AppKit provider not available');
          }

          const ethersProvider = new BrowserProvider(provider);
          const signer = await ethersProvider.getSigner();
          const address = await signer.getAddress();
          const network = await ethersProvider.getNetwork();

          modalProvider = ethersProvider;

          console.log('[AppKit] Connected successfully:', {
            address,
            chainId: Number(network.chainId)
          });

          resolve({
            provider: ethersProvider,
            address,
            chainId: Number(network.chainId)
          });
        } catch (err) {
          console.error('[AppKit] Error after connection:', err);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            cleanup();
            reject(err);
          }
        }
      }

      // If modal was opened and is now closed without connection, treat as cancel
      if (modalOpened && !newState.open && !newState.isConnected && !resolved) {
        console.warn('[AppKit] Modal closed without connection');
        resolved = true;
        clearTimeout(timeout);
        cleanup();
        reject(new Error('User closed WalletConnect modal without connecting'));
      }
    };

    // Subscribe to state changes first
    unsubscribe = web3Modal.subscribeState(handleStateChange);

    // Initial call to open the modal
    console.log('[AppKit] Opening modal...');
    web3Modal.open({ view: 'Connect' });
    modalOpened = true;
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
          
          currentAccount = state.address;
          const provider = web3Modal.getWalletProvider();
          
          if (!provider) {
            throw new Error('AppKit provider not available');
          }

          const ethersProvider = new BrowserProvider(provider);
          const signer = await ethersProvider.getSigner();
          const address = await signer.getAddress();
          const network = await ethersProvider.getNetwork();

          modalProvider = ethersProvider;

          console.log('[AppKit] Connected successfully:', {
            address,
            chainId: Number(network.chainId)
          });

          resolve({
            provider: ethersProvider,
            address,
            chainId: Number(network.chainId)
          });
        } catch (err) {
          unsubscribe();
          reject(err);
        }
      } else if (!state.open && !state.isConnected) {
        unsubscribe();
        reject(new Error('User closed WalletConnect modal without connecting'));
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