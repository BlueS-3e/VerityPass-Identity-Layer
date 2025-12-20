/**
 * Device detection utilities for mobile-friendly wallet connection
 */

export function isMobileDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent || navigator.vendor || window.opera || '';
  
  // Check for mobile patterns in user agent
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  const isMobileUA = mobileRegex.test(userAgent.toLowerCase());
  
  // Check for touch support
  const hasTouchPoints = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  
  // Check screen size (typically mobile if width <= 768px)
  const isSmallScreen = window.innerWidth <= 768;
  
  // Device is considered mobile if UA matches OR (has touch + small screen)
  return isMobileUA || (hasTouchPoints && isSmallScreen);
}

export function isIOS() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  const userAgent = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
}

export function isAndroid() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  const userAgent = navigator.userAgent || '';
  return /android/i.test(userAgent);
}

/**
 * Generate deep link to open a mobile wallet app
 * @param {string} walletName - Name of the wallet (e.g., 'MetaMask', 'Trust Wallet')
 * @param {string} dappUrl - Your dApp URL to connect to
 * @returns {string|null} Deep link URL or null if not supported
 */
export function getMobileWalletDeepLink(walletName, dappUrl = window.location.href) {
  const encodedUrl = encodeURIComponent(dappUrl);
  
  const deepLinks = {
    'MetaMask': `https://metamask.app.link/dapp/${encodedUrl}`,
    'Trust Wallet': `trust://open_url?url=${encodedUrl}`,
    'Rainbow': `https://rnbwapp.com/wc?uri=${encodedUrl}`,
    'Coinbase Wallet': `https://go.cb-w.com/dapp?url=${encodedUrl}`,
    'imToken': `imtokenv2://navigate/DappView?url=${encodedUrl}`,
    '1inch Wallet': `https://wallet.1inch.io/wc?uri=${encodedUrl}`,
    'Argent': `https://argent.link/app/wc?uri=${encodedUrl}`,
  };
  
  return deepLinks[walletName] || null;
}

/**
 * Attempt to open a mobile wallet via deep link
 * @param {string} walletName 
 * @returns {boolean} True if deep link was attempted
 */
export function openMobileWallet(walletName) {
  if (!isMobileDevice()) return false;
  
  const deepLink = getMobileWalletDeepLink(walletName);
  if (!deepLink) return false;
  
  try {
    window.location.href = deepLink;
    return true;
  } catch (e) {
    console.error('Failed to open mobile wallet:', e);
    return false;
  }
}

/**
 * Check if a wallet is likely installed on mobile
 * (heuristic: check for injected provider or known mobile wallets)
 */
export function isMobileWalletInstalled(walletName) {
  if (!isMobileDevice()) return false;
  
  // Check for injected providers
  if (typeof window !== 'undefined' && window.ethereum) {
    const provider = window.ethereum;
    
    // MetaMask mobile injects ethereum with isMetaMask flag
    if (walletName === 'MetaMask' && provider.isMetaMask) return true;
    
    // Trust Wallet injects ethereum with isTrust flag
    if (walletName === 'Trust Wallet' && provider.isTrust) return true;
    
    // Coinbase Wallet injects ethereum with isCoinbaseWallet flag
    if (walletName === 'Coinbase Wallet' && provider.isCoinbaseWallet) return true;
  }
  
  return false;
}
