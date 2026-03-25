// Modern EIP-6963 + EIP-1193 compatible wallet detection
import { initWeb3Modal, connectWithWalletConnect, disconnectWalletConnect, getWalletConnectProvider, getWalletConnectAccount } from './walletConnectV2';
export { initWeb3Modal } from './walletConnectV2';
// Cleaned and optimized version

// Note: we avoid a top-level WalletConnect import to prevent build/runtime issues.
// The provider will be dynamically imported at runtime when needed and a small
// `global` shim is applied for libraries that expect Node-style globals in the browser.

let eip6963Initialized = false;
const eip6963ProviderMap = new Map();

// Wallets that are considered reliable for this dApp's core operations
// (connect, chain check/switch, personal_sign, and tx submission).
const OPERATIONAL_INJECTED_WALLETS = new Set([
  'MetaMask',
  'Coinbase Wallet',
  'Rabby Wallet',
  'Brave Wallet',
  'OKX Wallet'
]);

const NON_OPERATIONAL_WALLET_REASON = {
  'Phantom': 'Phantom has limited/inconsistent EVM behavior for this dApp. Please use WalletConnect or an EVM-first wallet (MetaMask, Coinbase, Rabby, Brave, OKX).',
  'Trust Wallet': 'Trust Wallet injected provider is not fully reliable for this dApp flow. Please use WalletConnect or an EVM-first wallet (MetaMask, Coinbase, Rabby, Brave, OKX).'
};

function eip6963Key(detail = {}) {
  const info = detail.info || {};
  return info.uuid || info.rdns || info.name || `provider-${Math.random().toString(36).slice(2, 8)}`;
}

function registerEIP6963(detail) {
  if (!detail?.provider || !detail?.info) return;
  eip6963ProviderMap.set(eip6963Key(detail), detail);
}

function walletPriority(entry) {
  const id = String(entry?.id || '').toLowerCase();
  const name = String(entry?.name || '').toLowerCase();
  const rdns = String(entry?.rdns || '').toLowerCase();
  const combined = `${id} ${name} ${rdns}`;

  if (combined.includes('walletconnect')) return 0;
  if (combined.includes('metamask')) return 10;
  if (combined.includes('coinbase')) return 20;
  if (combined.includes('rabby')) return 30;
  if (combined.includes('brave')) return 40;
  if (combined.includes('okx')) return 50;
  if (combined.includes('trust')) return 60;
  if (combined.includes('phantom')) return 90;
  return 70;
}

function sortProvidersStable(providers = []) {
  return [...providers].sort((a, b) => {
    const prioDiff = walletPriority(a) - walletPriority(b);
    if (prioDiff !== 0) return prioDiff;
    return String(a?.name || a?.id || '').localeCompare(String(b?.name || b?.id || ''));
  });
}

function walletKeyFromEntry(entry) {
  const id = String(entry?.id || '').toLowerCase();
  const name = String(entry?.name || '').toLowerCase();
  const rdns = String(entry?.rdns || '').toLowerCase();
  return `${id} ${name} ${rdns}`;
}

function isMetaMaskLike(provider) {
  if (!provider) return false;
  return Boolean(
    provider.isMetaMask &&
    !provider.isCoinbaseWallet &&
    !provider.isTrust &&
    !provider.isRabby &&
    !provider.isBraveWallet &&
    !provider.isPhantom
  );
}

function providerMatchesWalletKey(provider, key) {
  if (!provider || !key) return false;

  if (key.includes('metamask')) return isMetaMaskLike(provider);
  if (key.includes('trust')) return Boolean(provider.isTrust);
  if (key.includes('phantom')) return Boolean(provider.isPhantom);
  if (key.includes('coinbase')) return Boolean(provider.isCoinbaseWallet);
  if (key.includes('rabby')) return Boolean(provider.isRabby);
  if (key.includes('brave')) return Boolean(provider.isBraveWallet);
  if (key.includes('okx')) return Boolean(provider.isOKXWallet);

  return false;
}

function resolveInjectedProviderForEntry(entry) {
  if (typeof window === 'undefined' || !entry || entry.id === 'walletconnect') return entry;

  const key = walletKeyFromEntry(entry);
  const eth = window.ethereum;
  const candidates = Array.isArray(eth?.providers)
    ? eth.providers
    : (eth ? [eth] : []);

  let matched = candidates.find((p) => providerMatchesWalletKey(p, key));

  // Phantom commonly exposes its EVM provider on window.phantom.ethereum.
  if (!matched && key.includes('phantom') && window.phantom?.ethereum) {
    matched = window.phantom.ethereum;
  }

  if (!matched) return entry;

  if (entry.provider === matched) return entry;

  return {
    ...entry,
    provider: matched,
    name: detectProviderName(matched) || entry.name,
    icon: getProviderIcon(matched) || entry.icon
  };
}

function getWalletConnectProjectId() {
  if (typeof import.meta === 'undefined' || !import.meta?.env) return '';
  return import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';
}

function createRpcRequester(provider) {
  return async (method, params = []) => {
    if (!provider) throw new Error('Provider unavailable');

    if (typeof provider.request === 'function') {
      try {
        return await provider.request({ method, params });
      } catch (firstError) {
        // Some legacy providers expose request(method, params)
        return provider.request(method, params);
      }
    }

    if (typeof provider.sendAsync === 'function') {
      return new Promise((resolve, reject) => {
        provider.sendAsync(
          { jsonrpc: '2.0', id: Date.now(), method, params },
          (err, res) => {
            if (err) return reject(err);
            if (res?.error) return reject(res.error);
            resolve(res?.result ?? res);
          }
        );
      });
    }

    if (typeof provider.send === 'function') {
      const response = await provider.send({ jsonrpc: '2.0', id: Date.now(), method, params });
      if (response && typeof response === 'object' && 'result' in response) {
        return response.result;
      }
      return response;
    }

    throw new Error('Provider does not support JSON-RPC requests');
  };
}

// EIP-6963 Provider Detection
export function detectEIP6963Providers() {
  if (typeof window === 'undefined') return [];

  if (!eip6963Initialized && window.addEventListener) {
    window.addEventListener('eip6963:announceProvider', (event) => {
      registerEIP6963(event?.detail);
    });
    eip6963Initialized = true;
  }

  if (window.dispatchEvent) {
    // Request late announcers each time. Registration is cached and deduped.
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }

  return Array.from(eip6963ProviderMap.values());
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

  // Deduplicate providers and keep deterministic ordering across wallets.
  return sortProvidersStable(deduplicateProviders(providers));
}

// Backwards-compatible alias
export const listInjectedProviders = listAvailableProviders;

// Normalize provider entry to get raw EIP-1193 provider
export function normalizeProviderEntry(entry) {
  if (!entry) return null;
  if (typeof entry.request === 'function') return entry;
  if (entry.provider && typeof entry.provider.request === 'function') return entry.provider;

  const provider = entry.provider || entry;
  if (provider && (typeof provider.send === 'function' || typeof provider.sendAsync === 'function')) {
    const rpcRequest = createRpcRequester(provider);
    return {
      ...provider,
      request: (input, legacyParams = []) => {
        // Support both request({ method, params }) and request(method, params)
        // because some wallet SDKs and adapters still use the legacy signature.
        if (typeof input === 'string') {
          return rpcRequest(input, legacyParams);
        }

        const method = input?.method;
        const params = Array.isArray(input?.params) ? input.params : legacyParams;
        return rpcRequest(method, params);
      },
      __rawProvider: provider
    };
  }

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
  if (typeof window === 'undefined') return [];
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
  if (typeof window === 'undefined') return [];
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
    { flag: 'isCoinbaseWallet', name: 'Coinbase Wallet' },
    { flag: 'isTrust', name: 'Trust Wallet' },
    { flag: 'isRabby', name: 'Rabby Wallet' },
    { flag: 'isBraveWallet', name: 'Brave Wallet' },
    { flag: 'isOKXWallet', name: 'OKX Wallet' },
    { flag: 'isPhantom', name: 'Phantom' },
    { flag: 'isMetaMask', name: 'MetaMask' },
    { flag: 'isOpera', name: 'Opera Wallet' },
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
      { pattern: 'okx', name: 'OKX Wallet' },
      { pattern: 'phantom', name: 'Phantom' }
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

export function getUnsupportedWalletReason(entry) {
  if (!entry) return null;
  const provider = entry.provider || entry;
  const name = entry.name || detectProviderName(provider);
  return NON_OPERATIONAL_WALLET_REASON[name] || null;
}

function isOperationalWalletEntry(entry) {
  if (!entry) return false;
  if (entry.id === 'walletconnect' || entry.type === 'sdk') return true;
  if (!entry.provider) return false;

  const name = entry.name || detectProviderName(entry.provider);
  if (NON_OPERATIONAL_WALLET_REASON[name]) return false;
  return OPERATIONAL_INJECTED_WALLETS.has(name);
}

export function getOperationalWallets(entries = []) {
  const list = Array.isArray(entries) ? entries : [];
  const filtered = list.filter(isOperationalWalletEntry);
  if (filtered.length > 0) return filtered;

  // Always keep WalletConnect as universal fallback.
  return list.filter((entry) => entry?.id === 'walletconnect' || entry?.type === 'sdk');
}

// Modern provider selection with user preference
export async function selectBestProvider(userPreference = null) {
  const allProviders = listAvailableProviders();
  const providers = getOperationalWallets(allProviders);
  
  if (providers.length === 0) {
    return await createFallbackProvider();
  }
  
  // User preference
  if (userPreference) {
    const preferred = providers.find(p => 
      p.id === userPreference || p.name === userPreference
    );
    if (preferred) return resolveInjectedProviderForEntry(preferred);

    // If the user's preferred wallet exists but is non-operational, gracefully
    // fall back to WalletConnect.
    const preferredAny = allProviders.find(p =>
      p.id === userPreference || p.name === userPreference
    );
    if (preferredAny && getUnsupportedWalletReason(preferredAny)) {
      const walletConnect = providers.find((p) => p.id === 'walletconnect' || p.type === 'sdk');
      if (walletConnect) return walletConnect;
    }
  }
  
  // Priority-based auto-selection
  const priorityList = [
    'MetaMask',
    'Coinbase Wallet', 
    'Rabby Wallet',
    'Brave Wallet',
    'OKX Wallet',
    'walletconnect'
  ];
  
  for (const name of priorityList) {
    const provider = providers.find(p => p.name === name);
    if (provider) return resolveInjectedProviderForEntry(provider);
  }
  
  // Fallback to first available
  return resolveInjectedProviderForEntry(providers[0]);
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
  const normalizedProvider = normalizeProviderEntry(provider);
  const activeProvider = normalizedProvider || provider;

  if (!activeProvider) {
    throw new Error('Provider does not support network switching');
  }

  const rpcRequest = createRpcRequester(activeProvider);
  
  // Detect if this is Phantom wallet
  const isPhantom = activeProvider.isPhantom === true;
  
  // Handle both numeric and hex chain IDs
  let hexChainId;
  if (typeof chainId === 'string' && chainId.startsWith('0x')) {
    hexChainId = chainId;
  } else {
    const numId = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
    hexChainId = `0x${numId.toString(16)}`;
  }
  
  try {
    await rpcRequest('wallet_switchEthereumChain', [{ chainId: hexChainId }]);
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
  const normalizedProvider = normalizeProviderEntry(provider);
  const activeProvider = normalizedProvider || provider;

  if (!activeProvider) {
    throw new Error('Provider does not support network configuration');
  }

  const rpcRequest = createRpcRequester(activeProvider);
  const networkConfig = getNetworkConfig(chainId);
  
  if (!networkConfig) {
    throw new Error(`Unsupported network: ${chainId}`);
  }
  
  await rpcRequest('wallet_addEthereumChain', [networkConfig]);
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
  const projectId = getWalletConnectProjectId();
  
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
  
  const projectId = getWalletConnectProjectId();
  
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
    const resolvedEntry = resolveInjectedProviderForEntry(providerOrEntry);

    const unsupportedReason = getUnsupportedWalletReason(resolvedEntry);
    if (unsupportedReason && resolvedEntry.id !== 'walletconnect') {
      throw new Error(unsupportedReason);
    }

    // SDK-based WalletConnect using Web3Modal v2
    if (resolvedEntry.id === 'walletconnect' || resolvedEntry.type === 'sdk') {
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
    } else if (resolvedEntry.provider) {
      provider = resolvedEntry.provider;
    }
  }

  const normalizedProvider = normalizeProviderEntry(provider);
  const rawProvider = provider?.provider || provider;
  provider = normalizedProvider || provider;

  if (!provider || typeof provider.request !== 'function') {
    throw new Error('Provider not available or does not support EIP-1193');
  }

  const rpcRequest = createRpcRequester(provider);

  try {
    const [accounts, chainId] = await Promise.all([
      rpcRequest('eth_requestAccounts', []),
      rpcRequest('eth_chainId', [])
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
    const msg = String(error?.message || '').toLowerCase();
    const nestedMethod = String(error?.data?.method || '').toLowerCase();
    const code = Number(error?.code);
    const walletName = detectProviderName(rawProvider).toLowerCase();

    if (walletName.includes('phantom') && (msg.includes('unsupported') || msg.includes('origin not allowed') || msg.includes('public_requestaccounts'))) {
      throw new Error('Phantom EVM provider rejected this request. Please use MetaMask/Trust Wallet or connect via WalletConnect for this site.');
    }

    // Some injected non-EVM extensions throw this pattern when asked for EVM accounts.
    if (code === -32603 && (nestedMethod.includes('public_requestaccounts') || msg.includes('origin not allowed'))) {
      throw new Error('Wallet origin is not allowed by the selected extension. Please use MetaMask/WalletConnect or disable non-EVM wallet extensions for this site.');
    }

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