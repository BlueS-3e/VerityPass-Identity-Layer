// Modern EIP-6963 + EIP-1193 compatible wallet detection
import { initWeb3Modal, connectWithWalletConnect, disconnectWalletConnect, getWalletConnectProvider, getWalletConnectAccount } from './walletConnectV2';
export { initWeb3Modal } from './walletConnectV2';
// Cleaned and optimized version

// Note: we avoid a top-level WalletConnect import to prevent build/runtime issues.
// The provider will be dynamically imported at runtime when needed and a small
// `global` shim is applied for libraries that expect Node-style globals in the browser.

// EIP-6963 Provider Detection
export function detectEIP6963Providers() {
  if (typeof window === 'undefined') return [];
  
  const providers = [];
  
  const handleProviderAnnouncement = (event) => {
    providers.push(event.detail);
  };

  if (window.addEventListener) {
    window.addEventListener('eip6963:announceProvider', handleProviderAnnouncement);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }
  
  return providers;
}

// Enhanced provider detection with EIP-6963 support
export function listAvailableProviders() {
  if (typeof window === 'undefined') return [];
  
  const providers = [];
  
  // 1. Detect EIP-6963 providers (modern standard)
  const eip6963Providers = detectEIP6963Providers();
  eip6963Providers.forEach(detail => {
    providers.push({
      id: detail.info.rdns || `eip6963-${detail.info.uuid}`,
      provider: detail.provider,
      name: detail.info.name,
      icon: detail.info.icon,
      rdns: detail.info.rdns,
      type: 'eip6963'
    });
  });
  
  // 2. Detect legacy injected providers
  const legacyProviders = detectLegacyProviders();
  providers.push(...legacyProviders);
  
  // 3. Detect SDK-based providers
  const sdkProviders = detectSDKProviders();
  providers.push(...sdkProviders);

  // Deduplicate providers
  return deduplicateProviders(providers);
}

// Backwards-compatible alias
export const listInjectedProviders = listAvailableProviders;

// Normalize provider entry to get raw EIP-1193 provider
export function normalizeProviderEntry(entry) {
  if (!entry) return null;
  if (typeof entry.request === 'function') return entry;
  if (entry.provider && typeof entry.provider.request === 'function') return entry.provider;
  return null;
}

// Legacy provider chooser (backwards compatibility)
export function chooseInjectedProvider(userPreference = null) {
  const chosen = selectBestProvider(userPreference);
  if (!chosen) return null;
  
  const provider = normalizeProviderEntry(chosen);
  return provider && typeof provider.request === 'function' ? provider : null;
}

// Legacy provider detection
function detectLegacyProviders() {
  const providers = [];
  const { ethereum } = window;
  
  if (!ethereum) return providers;
  
  if (Array.isArray(ethereum.providers)) {
    ethereum.providers.forEach((provider, index) => {
      providers.push(createProviderEntry(provider, `legacy-${index}`));
    });
  } else {
    providers.push(createProviderEntry(ethereum, 'legacy-0'));
  }
  
  return providers;
}

// SDK-based providers detection
function detectSDKProviders() {
  const providers = [];
  
  // WalletConnect
  // Always offer WalletConnect as an SDK option; connect flow will instantiate
  // Note: No installLink - Web3Modal handles the entire connection flow
  providers.push({
    id: 'walletconnect',
    name: 'WalletConnect',
    icon: 'https://avatars.githubusercontent.com/u/37784886',
    type: 'sdk'
    // No provider or installLink - Web3Modal v2 will create the provider on demand
  });
  
  // Phantom
  if (window.phantom?.ethereum) {
    providers.push(createProviderEntry(window.phantom.ethereum, 'phantom', 'Phantom'));
  }
  
  // Add more SDK providers here as needed
  
  return providers;
}

// Helper to create standardized provider entries
function createProviderEntry(provider, id, customName = null) {
  return {
    id,
    provider,
    name: customName || detectProviderName(provider),
    icon: getProviderIcon(provider),
    type: 'injected'
  };
}

// Deduplicate providers
function deduplicateProviders(providers) {
  const seenRefs = new Set();
  const seenKeys = new Set();
  const uniqueProviders = [];

  providers.forEach(provider => {
    const ref = provider?.provider || provider;
    const key = `${provider.id}|${provider.name}|${provider.rdns}`;
    
    const isDuplicateRef = ref && (typeof ref === 'object' || typeof ref === 'function') && seenRefs.has(ref);
    const isDuplicateKey = seenKeys.has(key);
    
    if (!isDuplicateRef && !isDuplicateKey) {
      if (ref && (typeof ref === 'object' || typeof ref === 'function')) {
        seenRefs.add(ref);
      }
      seenKeys.add(key);
      uniqueProviders.push(provider);
    }
  });

  return uniqueProviders;
}

// Enhanced provider name detection
export function detectProviderName(provider) {
  if (!provider) return 'Injected Wallet';
  
  const providerFlags = [
    { flag: 'isMetaMask', name: 'MetaMask' },
    { flag: 'isCoinbaseWallet', name: 'Coinbase Wallet' },
    { flag: 'isTrust', name: 'Trust Wallet' },
    { flag: 'isBraveWallet', name: 'Brave Wallet' },
    { flag: 'isOpera', name: 'Opera Wallet' },
    { flag: 'isRabby', name: 'Rabby Wallet' },
    { flag: 'isOKXWallet', name: 'OKX Wallet' },
    { flag: 'isZerion', name: 'Zerion' },
    { flag: 'isFrame', name: 'Frame' },
    { flag: 'isTorus', name: 'Torus' }
  ];
  
  for (const { flag, name } of providerFlags) {
    if (provider[flag]) return name;
  }
  
  // Fallback detection
  try {
    const host = provider.host || provider.connection?.url || '';
    const userAgent = provider.userAgent || '';
    const combined = `${host} ${userAgent}`.toLowerCase();
    
    const patterns = [
      { pattern: 'metamask', name: 'MetaMask' },
      { pattern: 'coinbase', name: 'Coinbase Wallet' },
      { pattern: 'trust', name: 'Trust Wallet' },
      { pattern: 'brave', name: 'Brave Wallet' },
      { pattern: 'rabby', name: 'Rabby Wallet' },
      { pattern: 'okx', name: 'OKX Wallet' }
    ];
    
    for (const { pattern, name } of patterns) {
      if (combined.includes(pattern)) return name;
    }
    
    // Check constructor name
    if (provider.constructor?.name?.toLowerCase().includes('metamask')) {
      return 'MetaMask';
    }
  } catch (error) {
    console.debug('Provider name detection error:', error);
  }
  
  return 'Injected Wallet';
}

// Get provider icon
export function getProviderIcon(provider) {
  const name = detectProviderName(provider);
  const iconMap = {
    'MetaMask': 'https://metamask.io/images/favicon-32x32.png',
    'Coinbase Wallet': 'https://cdn.iconscout.com/icon/free/png-256/coinbase-4-1174880.png',
    'Trust Wallet': 'https://trustwallet.com/assets/images/favicon.png',
    'Brave Wallet': 'https://brave.com/static-assets/images/brave-favicon.png',
    'Rabby Wallet': 'https://rabby.io/images/logo-128.png',
    'OKX Wallet': 'https://www.okx.com/cdn/assets/files/logo/favicon.ico',
    'Phantom': 'https://phantom.app/img/phantom-logo.svg',
    'WalletConnect': 'https://avatars.githubusercontent.com/u/37784886'
  };
  
  return iconMap[name] || null;
}

// Modern provider selection with user preference
export async function selectBestProvider(userPreference = null) {
  const providers = listAvailableProviders();
  
  if (providers.length === 0) {
    return await createFallbackProvider();
  }
  
  // User preference
  if (userPreference) {
    const preferred = providers.find(p => 
      p.id === userPreference || p.name === userPreference
    );
    if (preferred) return preferred;
  }
  
  // Priority-based auto-selection
  const priorityList = [
    'MetaMask',
    'Coinbase Wallet', 
    'Rabby Wallet',
    'Brave Wallet',
    'OKX Wallet',
    'Phantom'
  ];
  
  for (const name of priorityList) {
    const provider = providers.find(p => p.name === name);
    if (provider) return provider;
  }
  
  // Fallback to first available
  return providers[0];
}

// Persistence helpers: remember user's chosen wallet (only store small serializable bits)
const PREFERRED_KEY = 'realmint:preferred_wallet';

export function persistPreferredProvider(entry) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!entry) {
      window.localStorage.removeItem(PREFERRED_KEY);
      return;
    }
    const data = { id: entry.id, name: entry.name, type: entry.type };
    window.localStorage.setItem(PREFERRED_KEY, JSON.stringify(data));
  } catch (e) {
    // swallow localStorage errors (private mode, quotas)
    // console.debug('persistPreferredProvider error', e);
  }
}

export function loadPreferredProvider() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const s = window.localStorage.getItem(PREFERRED_KEY);
    if (!s) return null;
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

// Network switching utility
export async function switchNetwork(provider, chainId) {
  if (!provider?.request) {
    throw new Error('Provider does not support network switching');
  }
  
  // Detect if this is Phantom wallet
  const isPhantom = provider.isPhantom === true;
  
  // Handle both numeric and hex chain IDs
  let hexChainId;
  if (typeof chainId === 'string' && chainId.startsWith('0x')) {
    hexChainId = chainId;
  } else {
    const numId = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
    hexChainId = `0x${numId.toString(16)}`;
  }
  
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }],
    });
  } catch (switchError) {
    // 4902 = Chain not added to wallet
    if (switchError.code === 4902) {
      // Convert back to numeric for addNetwork if needed
      const numId = typeof chainId === 'string' ? (chainId.startsWith('0x') ? parseInt(chainId, 16) : parseInt(chainId, 10)) : chainId;
      await addNetwork(provider, numId);
    } 
    // -32002 = Request already pending (ignore)
    else if (switchError.code === -32002) {
      // Request already pending, ignore
      return;
    }
    // Phantom returns "unsupported network" - it has very limited EVM support
    else if (isPhantom && (switchError.message?.includes('unsupported') || switchError.message?.includes('Unsupported'))) {
      throw new Error(`Phantom Wallet has limited EVM support and does not support this network. Please use MetaMask, Coinbase Wallet, or another EVM-compatible wallet.`);
    }
    // Some wallets don't support switching at all
    else if (switchError.message?.includes('not supported')) {
      throw new Error(`This wallet does not support automatic network switching. Please switch to ${hexChainId} manually.`);
    }
    else if (switchError.message?.includes('not connected') || switchError.message?.includes('requested chain')) {
      throw new Error(`Wallet is not connected to the requested chain. Please switch to chain ${hexChainId} manually.`);
    }
    else {
      throw switchError;
    }
  }
}

// Add network configuration
export async function addNetwork(provider, chainId) {
  const networkConfig = getNetworkConfig(chainId);
  
  if (!networkConfig) {
    throw new Error(`Unsupported network: ${chainId}`);
  }
  
  await provider.request({
    method: 'wallet_addEthereumChain',
    params: [networkConfig],
  });
}

// Common network configurations
export function getNetworkConfig(chainId) {
  const networks = {
    1: {
      chainId: '0x1',
      chainName: 'Ethereum Mainnet',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://mainnet.infura.io/v3/'],
      blockExplorerUrls: ['https://etherscan.io']
    },
    56: {
      chainId: '0x38',
      chainName: 'BNB Smart Chain',
      nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
      rpcUrls: ['https://bsc-dataseed.binance.org/'],
      blockExplorerUrls: ['https://bscscan.com']
    },
    97: {
      chainId: '0x61',
      chainName: 'BNB Smart Chain Testnet',
      nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
      rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
      blockExplorerUrls: ['https://testnet.bscscan.com']
    },
    137: {
      chainId: '0x89',
      chainName: 'Polygon Mainnet',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      rpcUrls: ['https://polygon-rpc.com/'],
      blockExplorerUrls: ['https://polygonscan.com']
    },
    80001: {
      chainId: '0x13881',
      chainName: 'Polygon Mumbai Testnet',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      rpcUrls: ['https://rpc-mumbai.maticvigil.com/'],
      blockExplorerUrls: ['https://mumbai.polygonscan.com']
    },
    11155111: {
      chainId: '0xaa36a7',
      chainName: 'Ethereum Sepolia Testnet',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://sepolia.infura.io/v3/'],
      blockExplorerUrls: ['https://sepolia.etherscan.io']
    },
    42161: {
      chainId: '0xA4B1',
      chainName: 'Arbitrum One',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://arb1.arbitrum.io/rpc'],
      blockExplorerUrls: ['https://arbiscan.io']
    }
  };
  
  return networks[chainId];
}

// Fallback provider
export async function createFallbackProvider() {
  // Offer WalletConnect via Web3Modal instead of an install link
  return {
    id: 'walletconnect',
    name: 'WalletConnect',
    type: 'sdk',
    icon: 'https://avatars.githubusercontent.com/u/37784886'
  };
}

// WalletConnect module cache for preloading
let _wcModule = null;

// Preload Web3Modal (v2)
export async function preloadWalletConnect() {
  if (_wcModule) return _wcModule;
  if (typeof window === 'undefined') return null;
  
  // Get project ID from environment variables
  const projectId = import.meta.env?.VITE_WALLETCONNECT_PROJECT_ID;
  
  console.log('[providerDetect] Preloading WalletConnect with project ID:', 
    projectId ? `${projectId.substring(0, 10)}...` : 'NOT SET');
  
  if (projectId) {
    try {
      _wcModule = await initWeb3Modal(projectId);
      console.log('[providerDetect] Web3Modal initialized successfully');
    } catch (error) {
      console.error('[providerDetect] Failed to initialize Web3Modal:', error);
      _wcModule = null;
    }
  } else {
    console.warn('[providerDetect] WalletConnect project ID not set. Please set REACT_APP_WALLETCONNECT_PROJECT_ID or VITE_WALLETCONNECT_PROJECT_ID');
  }
  return _wcModule;
}

// Create a WalletConnect provider instance using Web3Modal v2 (Reown AppKit)
export async function createWalletConnectInstance(chainId = 1) {
  if (typeof window === 'undefined') throw new Error('No window');
  
  const projectId = import.meta.env?.VITE_WALLETCONNECT_PROJECT_ID;
  
  console.log('[providerDetect] Creating WalletConnect instance. Project ID:', 
    projectId ? `${projectId.substring(0, 10)}...` : 'NOT SET');
  
  if (!projectId) {
    throw new Error('WalletConnect Project ID not set. Please set VITE_WALLETCONNECT_PROJECT_ID (Vite). Get one at https://cloud.walletconnect.com');
  }

  // Initialize Web3Modal if not already initialized
  if (!_wcModule) {
    try {
      console.log('[providerDetect] Initializing Web3Modal...');
      await initWeb3Modal(projectId);
      _wcModule = true; // Mark as initialized
      console.log('[providerDetect] Web3Modal initialized');
    } catch (err) {
      console.error('[providerDetect] Failed to initialize Web3Modal:', err);
      throw new Error(`Web3Modal initialization failed: ${err.message}`);
    }
  }

  // Connect via Web3Modal and return the result
  console.log('[providerDetect] Connecting with WalletConnect...');
  try {
    const result = await connectWithWalletConnect();
    console.log('[providerDetect] WalletConnect connection successful:', {
      address: result.address ? `${result.address.substring(0, 10)}...` : 'none',
      chainId: result.chainId
    });
    return result;
  } catch (error) {
    console.error('[providerDetect] WalletConnect connection failed:', error);
    throw error;
  }
}

// Legacy session creation (replaced by Web3Modal)
// Returns the provider from Web3Modal connection
export async function createWalletConnectSession(chainId = 1) {
  return createWalletConnectInstance(chainId);
}

// Connection helper with error handling
// Accepts either a raw EIP-1193 provider object, or a provider entry from listAvailableProviders
export async function connectWallet(providerOrEntry, options = {}) {
  let provider = providerOrEntry;

  // If a provider entry object was passed
  if (providerOrEntry && providerOrEntry.id && !providerOrEntry.request) {
    // SDK-based WalletConnect using Web3Modal v2
    if (providerOrEntry.id === 'walletconnect' || providerOrEntry.type === 'sdk') {
      try {
        console.log('[providerDetect] Connecting with WalletConnect...');
        const wcResult = await createWalletConnectInstance(options.chainId || 1);
        
        if (!wcResult || !wcResult.provider) {
          throw new Error('WalletConnect provider not available after session creation');
        }
        
        provider = wcResult.provider;
        
        // Return formatted result including address and chainId from WalletConnect
        return {
          accounts: wcResult.address ? [wcResult.address] : [],
          chainId: wcResult.chainId || 1,
          provider: wcResult.provider,
          address: wcResult.address // Additional field for convenience
        };
      } catch (e) {
        console.error('[providerDetect] Failed to create WalletConnect instance:', e);
        throw e;
      }
    } else if (providerOrEntry.provider) {
      provider = providerOrEntry.provider;
    }
  }

  if (!provider || typeof provider.request !== 'function') {
    throw new Error('Provider not available or does not support EIP-1193');
  }

  try {
    const [accounts, chainId] = await Promise.all([
      provider.request({ method: 'eth_requestAccounts', params: [] }),
      provider.request({ method: 'eth_chainId', params: [] })
    ]);

    // Normalize chainId to numeric format for consistency
    const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId;

    return { 
      accounts, 
      chainId: numericChainId, 
      provider,
      address: accounts[0] // Additional field for convenience
    };
  } catch (error) {
    console.error('[providerDetect] Wallet connection failed:', error);
    throw error;
  }
}

// Event listeners for provider changes
export function setupProviderListeners(provider, callbacks) {
  if (!provider?.on) return null;
  
  const { onAccountsChanged, onChainChanged, onDisconnect } = callbacks;
  
  if (onAccountsChanged) provider.on('accountsChanged', onAccountsChanged);
  if (onChainChanged) provider.on('chainChanged', onChainChanged);
  if (onDisconnect) provider.on('disconnect', onDisconnect);
  
  // Cleanup function
  return () => {
    if (provider.removeListener) {
      if (typeof onAccountsChanged === 'function') {
        provider.removeListener('accountsChanged', onAccountsChanged);
      }
      if (typeof onChainChanged === 'function') {
        provider.removeListener('chainChanged', onChainChanged);
      }
      if (typeof onDisconnect === 'function') {
        provider.removeListener('disconnect', onDisconnect);
      }
    }
  };
}

// WalletConnect specific event setup
export function setupWalletConnectListeners(callbacks) {
  if (typeof window === 'undefined') return null;
  
  // Note: Web3Modal v2 handles its own listeners internally
  // This is a placeholder for any custom WalletConnect event handling needed
  const { onAccountsChanged, onChainChanged, onDisconnect } = callbacks;
  
  // Return a dummy cleanup function
  return () => {
    // Web3Modal v2 handles cleanup internally
  };
}