// Provider detection utilities copied from webapp's utils/providerDetect.js
// to avoid cross-package import issues in the admin bundle.
import { initWeb3Modal, connectWithWalletConnect } from './walletConnectV2';

let eip6963Initialized = false;
const eip6963ProviderMap = new Map();

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

// Modern EIP-6963 + EIP-1193 compatible wallet detection
// Supports multiple wallets, networks, and better error handling

// EIP-6963 Provider Detection
export function detectEIP6963Providers() {
	if (typeof window === 'undefined' || typeof window.addEventListener === 'undefined') return [];

	if (!eip6963Initialized && window.addEventListener) {
		window.addEventListener('eip6963:announceProvider', (event) => {
			registerEIP6963(event?.detail);
		});
		eip6963Initialized = true;
	}

	if (window.dispatchEvent) {
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
			rdns: detail.info.rdns
		});
	});
  
	// 2. Detect legacy injected providers
	const legacyProviders = detectLegacyProviders();
	providers.push(...legacyProviders);
  
	// 3. Detect WalletConnect or other SDK-based providers
	const sdkProviders = detectSDKProviders();
	providers.push(...sdkProviders);

	// Deduplicate providers: prefer identical provider object references first,
	// then fall back to deduping by id/name/rdns to avoid rendering duplicate
	// buttons for the same underlying wallet (some wallets announce via
	// multiple mechanisms).
	const seenRefs = new Set();
	const seenKeys = new Set();
	const uniq = [];
	for (const p of providers) {
		const ref = p && p.provider ? p.provider : p;
		let skipped = false;
		if (ref && (typeof ref === 'object' || typeof ref === 'function')) {
			if (seenRefs.has(ref)) { skipped = true; }
			else seenRefs.add(ref);
		}

		const key = `${p.id||''}|${p.name||''}|${p.rdns||''}`;
		if (seenKeys.has(key)) { skipped = true; }
		else seenKeys.add(key);

		if (!skipped) uniq.push(p);
	}

	return sortProvidersStable(uniq);
}

function isWalletConnectProvider(providerEntry) {
	if (!providerEntry) return false;
	const id = String(providerEntry.id || '').toLowerCase();
	const name = String(providerEntry.name || '').toLowerCase();
	const rdns = String(providerEntry.rdns || '').toLowerCase();
	return Boolean(providerEntry.isWalletConnect) ||
		id.includes('walletconnect') ||
		name.includes('walletconnect') ||
		rdns.includes('walletconnect');
}

function isConnectableProvider(providerEntry) {
	const provider = normalizeProviderEntry(providerEntry);
	return Boolean(provider && typeof provider.request === 'function');
}

// Compact wallet list for UI: WalletConnect + one generic browser wallet.
export function getDisplayWallets(providerEntries = []) {
	const entries = Array.isArray(providerEntries) ? providerEntries : [];
	const walletConnect = entries.find((p) => isWalletConnectProvider(p));
	const firstInjected = entries.find((p) => !isWalletConnectProvider(p) && isConnectableProvider(p));

	const compact = [];
	if (walletConnect) {
		compact.push({
			...walletConnect,
			name: 'WalletConnect'
		});
	}
	if (firstInjected) {
		compact.push({
			...firstInjected,
			name: 'Browser Wallet'
		});
	}

	return compact.length > 0 ? compact : entries;
}

// Backwards-compatible alias: older code expected `listInjectedProviders`
// Keep this wrapper so existing imports continue to work.
export function listInjectedProviders() {
	return listAvailableProviders();
}

// Normalize a provider entry (legacy wrapper or raw EIP-1193 provider)
// Returns the raw provider object implementing `.request()` or null.
export function normalizeProviderEntry(entry) {
	if (!entry) return null;
	if (typeof entry.request === 'function') return entry;
	if (entry.provider && typeof entry.provider.request === 'function') return entry.provider;

	const provider = entry.provider || entry;
	if (provider && (typeof provider.send === 'function' || typeof provider.sendAsync === 'function')) {
		const rpcRequest = createRpcRequester(provider);
		return {
			...provider,
			request: ({ method, params = [] }) => rpcRequest(method, params),
			__rawProvider: provider
		};
	}

	return null;
}

// Backwards-compatible helper for older code that expected a direct provider
// chooser. Returns the raw provider (EIP-1193) if available, otherwise null.
export function chooseInjectedProvider(userPreference = null) {
	const chosen = selectBestProvider(userPreference);
	if (!chosen) return null;
	// If the chosen entry wraps the provider object under `.provider`, return it.
	const maybe = chosen.provider || chosen;
	// Only return objects that implement EIP-1193 `.request` — otherwise
	// treat as no-injected-provider so callers fall back to SDK flows or
	// requestAccounts enumeration.
	if (maybe && typeof maybe.request === 'function') return maybe;
	return null;
}

// Legacy provider detection (backward compatibility)
export function detectLegacyProviders() {
	if (typeof window === 'undefined') return [];
	const providers = [];
	const eth = window.ethereum;
  
	if (!eth) return providers;
  
	// Handle multiple providers array
	if (Array.isArray(eth.providers)) {
		eth.providers.forEach((provider, index) => {
			providers.push({
				id: `legacy-${index}`,
				provider,
				name: detectProviderName(provider),
				icon: getProviderIcon(provider),
				type: 'injected'
			});
		});
	} else if (eth) {
		// Single provider
		providers.push({
			id: 'legacy-0',
			provider: eth,
			name: detectProviderName(eth),
			icon: getProviderIcon(eth),
			type: 'injected'
		});
	}
  
	return providers;
}

// SDK-based providers (WalletConnect, etc.)
export function detectSDKProviders() {
	if (typeof window === 'undefined') return [];
	const providers = [];

	// Always offer WalletConnect; Web3Modal provides the wallet chooser menu.
	providers.push({
		id: 'walletconnect',
		name: 'WalletConnect',
		icon: 'https://avatars.githubusercontent.com/u/37784886',
		type: 'sdk',
		isWalletConnect: true
	});
  
	// Add more SDK providers as needed
	if (window.phantom && window.phantom.ethereum) {
		providers.push({
			id: 'phantom',
			name: 'Phantom',
			provider: window.phantom.ethereum,
			icon: 'https://phantom.app/img/phantom-logo.svg',
			type: 'injected'
		});
	}
  
	return providers;
}

// Enhanced provider name detection
export function detectProviderName(provider) {
	if (!provider) return 'Injected Wallet';
  
	// Standard provider flags
	const providerFlags = [
		{ flag: 'isCoinbaseWallet', name: 'Coinbase Wallet' },
		{ flag: 'isTrust', name: 'Trust Wallet' },
		{ flag: 'isRabby', name: 'Rabby Wallet' },
		{ flag: 'isBraveWallet', name: 'Brave Wallet' },
		{ flag: 'isOKXWallet', name: 'OKX Wallet' },
		{ flag: 'isPhantom', name: 'Phantom' },
		{ flag: 'isMetaMask', name: 'MetaMask' },
		{ flag: 'isOpera', name: 'Opera Wallet' },
		{ flag: 'isFrame', name: 'Frame' },
		{ flag: 'isTorus', name: 'Torus' },
		{ flag: 'isImToken', name: 'imToken' },
		{ flag: 'isTokenPocket', name: 'TokenPocket' },
		{ flag: 'isMathWallet', name: 'MathWallet' },
		{ flag: 'isKuCoinWallet', name: 'KuCoin Wallet' },
		{ flag: 'isBitKeep', name: 'BitKeep' },
		{ flag: 'isZerion', name: 'Zerion' }
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
		if (provider.constructor?.name) {
			const cn = provider.constructor.name.toLowerCase();
			if (cn.includes('metamask')) return 'MetaMask';
		}
	} catch (e) {
		console.debug('Provider name detection error:', e);
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
		'OKX Wallet': 'https://www.okx.com/cdn/assets/files/logo/favicon.ico'
	};
  
	return iconMap[name] || null;
}

// Modern provider selection with user preference
export async function selectBestProvider(userPreference = null) {
	const providers = listAvailableProviders();
	const connectableProviders = providers.filter((p) => isConnectableProvider(p) || isWalletConnectProvider(p));
  
	if (providers.length === 0) {
		return await createFallbackProvider();
	}
  
	// Use user preference if specified
	if (userPreference) {
		const preferred = connectableProviders.find(p => 
			p.id === userPreference || p.name === userPreference
		);
		if (preferred) return preferred;
	}
  
	// Auto-select logic with WalletConnect first for mobile compatibility
	const priorityList = [
		'walletconnect',
		'metamask',
		'coinbase wallet',
		'rabby wallet',
		'brave wallet',
		'okx wallet'
	];

	for (const name of priorityList) {
		const provider = connectableProviders.find((p) => String(p.name || p.id || '').toLowerCase() === name);
		if (provider) return provider;
	}

	for (const name of priorityList) {
		const provider = connectableProviders.find((p) => String(p.name || p.id || '').toLowerCase().includes(name));
		if (provider) return provider;
	}

	if (connectableProviders.length > 0) {
		return connectableProviders[0];
	}

	// Fall back to non-connectable entries only when nothing connectable exists.
	return providers[0];
}

// Network switching utility
export async function switchNetwork(provider, chainId) {
	const normalizedProvider = normalizeProviderEntry(provider);
	const activeProvider = normalizedProvider || provider;

	if (!activeProvider) {
		throw new Error('Provider does not support network switching');
	}

	const rpcRequest = createRpcRequester(activeProvider);
  
	const hexChainId = `0x${chainId.toString(16)}`;
  
	try {
		await rpcRequest('wallet_switchEthereumChain', [{ chainId: hexChainId }]);
	} catch (switchError) {
		// This error code indicates that the chain has not been added to MetaMask
		if (switchError.code === 4902) {
			await addNetwork(provider, chainId);
		} else {
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
		}
	};
  
	return networks[chainId];
}

// Fallback provider (WalletConnect for cross-wallet compatibility)
export async function createFallbackProvider() {
	// Return WalletConnect as universal fallback provider
	return {
		id: 'walletconnect',
		name: 'WalletConnect',
		type: 'sdk',
		icon: 'https://avatars.githubusercontent.com/u/37784886',
		isWalletConnect: true,
		installLink: 'https://walletconnect.com/'
	};
}

let _wcReady = false;

export async function preloadWalletConnect() {
	if (_wcReady) return true;
	const projectId = getWalletConnectProjectId();
	if (!projectId) {
		console.warn('[admin/providerDetect] Missing VITE_WALLETCONNECT_PROJECT_ID');
		return false;
	}
	await initWeb3Modal(projectId);
	_wcReady = true;
	return true;
}

export async function createWalletConnectInstance(chainId = 1) {
	const ready = await preloadWalletConnect();
	if (!ready) {
		throw new Error('WalletConnect Project ID is not configured');
	}

	let result;
	try {
		result = await connectWithWalletConnect();
	} catch (firstError) {
		const msg = String(firstError?.message || '').toLowerCase();
		const isTransientClose = msg.includes('closed') || msg.includes('without connecting');
		if (!isTransientClose) {
			throw firstError;
		}

		// Retry once because WalletConnect modal state can briefly emit close events
		// during handoff before provider/account become available.
		result = await connectWithWalletConnect();
	}
	if (!result?.provider) {
		throw new Error('WalletConnect provider not available');
	}

	return {
		provider: result.provider,
		address: result.address,
		chainId: result.chainId || chainId
	};
}

// Connection helper with error handling
export async function connectWallet(providerOrEntry, options = {}) {
	let provider = providerOrEntry;

	if (providerOrEntry && providerOrEntry.id && !providerOrEntry.request) {
		if (providerOrEntry.id === 'walletconnect' || providerOrEntry.type === 'sdk' || providerOrEntry.isWalletConnect) {
			const wcResult = await createWalletConnectInstance(options.chainId || 1);
			return {
				accounts: wcResult.address ? [wcResult.address] : [],
				chainId: wcResult.chainId,
				provider: wcResult.provider,
				address: wcResult.address
			};
		}

		if (providerOrEntry.provider) {
			provider = providerOrEntry.provider;
		}
	}

	if (!provider || !provider.request) {
		provider = normalizeProviderEntry(provider);
	}

	if (!provider || typeof provider.request !== 'function') {
		throw new Error('Provider not available or does not support EIP-1193');
	}

	const rpcRequest = createRpcRequester(provider);
	const rawProvider = providerOrEntry?.provider || providerOrEntry;
  
	try {
		const [accounts, chainIdHex] = await Promise.all([
			rpcRequest('eth_requestAccounts', []),
			rpcRequest('eth_chainId', [])
		]);
		const chainId = typeof chainIdHex === 'string' ? parseInt(chainIdHex, 16) : chainIdHex;
    
		return {
			accounts,
			chainId,
			provider,
			address: accounts?.[0]
		};
	} catch (error) {
		const msg = String(error?.message || '').toLowerCase();
		const walletName = detectProviderName(rawProvider).toLowerCase();
		if (walletName.includes('phantom') && (msg.includes('unsupported') || msg.includes('origin not allowed') || msg.includes('public_requestaccounts'))) {
			throw new Error('Phantom EVM provider rejected this request. Please use MetaMask/Trust Wallet or WalletConnect for this site.');
		}
		console.error('Wallet connection failed:', error);
		throw error;
	}
}

// Event listeners for provider changes
export function setupProviderListeners(provider, callbacks) {
	if (!provider || !provider.on) return;
  
	const { onAccountsChanged, onChainChanged, onDisconnect } = callbacks;
  
	if (onAccountsChanged) {
		provider.on('accountsChanged', onAccountsChanged);
	}
  
	if (onChainChanged) {
		provider.on('chainChanged', onChainChanged);
	}
  
	if (onDisconnect) {
		provider.on('disconnect', onDisconnect);
	}
  
	// Return cleanup function
	return () => {
		if (provider.removeListener) {
			// Only remove listeners that were actually registered (functions).
			if (typeof onAccountsChanged === 'function') {
				try { provider.removeListener('accountsChanged', onAccountsChanged); } catch (e) { /* ignore */ }
			}
			if (typeof onChainChanged === 'function') {
				try { provider.removeListener('chainChanged', onChainChanged); } catch (e) { /* ignore */ }
			}
			if (typeof onDisconnect === 'function') {
				try { provider.removeListener('disconnect', onDisconnect); } catch (e) { /* ignore */ }
			}
		}
	};
}
