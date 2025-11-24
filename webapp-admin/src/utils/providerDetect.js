// Provider detection utilities copied from webapp's utils/providerDetect.js
// to avoid cross-package import issues in the admin bundle.

// Modern EIP-6963 + EIP-1193 compatible wallet detection
// Supports multiple wallets, networks, and better error handling

// EIP-6963 Provider Detection
export function detectEIP6963Providers() {
	if (typeof window === 'undefined') return [];
  
	const providers = [];
  
	// Listen for EIP-6963 provider announcements
	if (window.addEventListener) {
		window.addEventListener('eip6963:announceProvider', (event) => {
			providers.push(event.detail);
		});
    
		// Request existing providers to announce themselves
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

	return uniq;
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
	const providers = [];
  
	// Detect WalletConnect
	if (window.WalletConnectProvider || window.walletConnect) {
		providers.push({
			id: 'walletconnect',
			name: 'WalletConnect',
			icon: 'https://avatars.githubusercontent.com/u/37784886',
			type: 'sdk',
			installLink: 'https://walletconnect.com/'
		});
	}
  
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
		{ flag: 'isMetaMask', name: 'MetaMask' },
		{ flag: 'isCoinbaseWallet', name: 'Coinbase Wallet' },
		{ flag: 'isTrust', name: 'Trust Wallet' },
		{ flag: 'isBraveWallet', name: 'Brave Wallet' },
		{ flag: 'isOpera', name: 'Opera Wallet' },
		{ flag: 'isFrame', name: 'Frame' },
		{ flag: 'isTorus', name: 'Torus' },
		{ flag: 'isImToken', name: 'imToken' },
		{ flag: 'isTokenPocket', name: 'TokenPocket' },
		{ flag: 'isMathWallet', name: 'MathWallet' },
		{ flag: 'isKuCoinWallet', name: 'KuCoin Wallet' },
		{ flag: 'isBitKeep', name: 'BitKeep' },
		{ flag: 'isRabby', name: 'Rabby Wallet' },
		{ flag: 'isOKXWallet', name: 'OKX Wallet' },
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
			{ pattern: 'okx', name: 'OKX Wallet' }
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
  
	if (providers.length === 0) {
		return await createFallbackProvider();
	}
  
	// Use user preference if specified
	if (userPreference) {
		const preferred = providers.find(p => 
			p.id === userPreference || p.name === userPreference
		);
		if (preferred) return preferred;
	}
  
	// Auto-select logic with modern priorities
	const priorityList = [
		'MetaMask',
		'Coinbase Wallet', 
		'Rabby Wallet',
		'Brave Wallet',
		'OKX Wallet'
	];
  
	for (const name of priorityList) {
		const provider = providers.find(p => p.name === name);
		if (provider) return provider;
	}
  
	// Return first available provider
	return providers[0];
}

// Network switching utility
export async function switchNetwork(provider, chainId) {
	if (!provider || !provider.request) {
		throw new Error('Provider does not support network switching');
	}
  
	const hexChainId = `0x${chainId.toString(16)}`;
  
	try {
		await provider.request({
			method: 'wallet_switchEthereumChain',
			params: [{ chainId: hexChainId }],
		});
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

// Fallback provider (WalletConnect, etc.)
export async function createFallbackProvider() {
	// Implement WalletConnect or other fallback providers
	return {
		id: 'fallback',
		name: 'WalletConnect',
		type: 'sdk',
		installLink: 'https://walletconnect.com/'
	};
}

// Connection helper with error handling
export async function connectWallet(provider, options = {}) {
	if (!provider || !provider.request) {
		throw new Error('Provider not available or does not support EIP-1193');
	}
  
	try {
		const accounts = await provider.request({
			method: 'eth_requestAccounts',
			params: []
		});
    
		// Optional: Get chain ID
		const chainId = await provider.request({
			method: 'eth_chainId',
			params: []
		});
    
		return {
			accounts,
			chainId,
			provider
		};
	} catch (error) {
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
