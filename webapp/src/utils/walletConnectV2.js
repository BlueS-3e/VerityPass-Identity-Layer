/**
 * WalletConnect v2 integration using Web3Modal (Reown AppKit)
 * Replaces the old @walletconnect/web3-provider v1.x
 */

import { createWeb3Modal, defaultConfig } from '@web3modal/ethers';
import { BrowserProvider } from 'ethers';

let web3Modal = null;
let modalProvider = null;

/**
 * Initialize Web3Modal (call once on app load)
 * @param {string} projectId - WalletConnect Cloud project ID
 * @param {Object} options - Configuration options
 */
export async function initWeb3Modal(projectId, options = {}) {
  if (web3Modal) return web3Modal;
  
  const {
    chains = [
      { chainId: 1, name: 'Ethereum', currency: 'ETH', explorerUrl: 'https://etherscan.io', rpcUrl: 'https://eth.llamarpc.com' },
      { chainId: 56, name: 'BSC', currency: 'BNB', explorerUrl: 'https://bscscan.com', rpcUrl: 'https://bsc-dataseed.binance.org' },
      { chainId: 137, name: 'Polygon', currency: 'MATIC', explorerUrl: 'https://polygonscan.com', rpcUrl: 'https://polygon-rpc.com' },
    ],
    metadata = {
      name: 'RealMint',
      description: 'On-chain identity and credit attestations',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://realmint.app',
      icons: ['https://realmint.app/favicon.ico']
    }
  } = options;

  const ethersConfig = defaultConfig({ metadata });

  web3Modal = createWeb3Modal({
    ethersConfig,
    chains,
    projectId,
    enableAnalytics: false,
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#6366f1', // indigo-500
      '--w3m-border-radius-master': '12px'
    }
  });

  return web3Modal;
}

/**
 * Open WalletConnect modal and connect
 * @returns {Promise<{provider: BrowserProvider, address: string, chainId: number}>}
 */
export async function connectWithWalletConnect() {
  if (!web3Modal) {
    throw new Error('Web3Modal not initialized. Call initWeb3Modal() first.');
  }

  try {
    // Open the Web3Modal modal - this shows the wallet selection UI
    // The modal will be displayed in-app, not as an external page
    web3Modal.open();
    
    // Wait for the user to connect a wallet
    // web3Modal emits events when wallet is connected
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout - wallet selection took too long'));
      }, 120000); // 2 minute timeout

      // Get current provider state
      const checkConnection = async () => {
        try {
          const provider = web3Modal.getWalletProvider();
          
          if (!provider) {
            // Wallet not connected yet, check again after short delay
            setTimeout(checkConnection, 500);
            return;
          }

          // Wallet is connected, clear timeout and process
          clearTimeout(timeout);
          
          const ethersProvider = new BrowserProvider(provider);
          const signer = await ethersProvider.getSigner();
          const address = await signer.getAddress();
          const network = await ethersProvider.getNetwork();
          
          modalProvider = ethersProvider;
          
          // Close modal after successful connection
          web3Modal.close?.();

          resolve({
            provider: ethersProvider,
            address,
            chainId: Number(network.chainId)
          });
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
        }
      };

      // Start checking for connection
      checkConnection();
    });
  } catch (error) {
    console.error('WalletConnect connection failed:', error);
    throw error;
  }
}

/**
 * Disconnect from WalletConnect
 */
export async function disconnectWalletConnect() {
  if (web3Modal) {
    await web3Modal.disconnect();
  }
  modalProvider = null;
}

/**
 * Get current connected provider (if any)
 */
export function getWalletConnectProvider() {
  return modalProvider;
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
