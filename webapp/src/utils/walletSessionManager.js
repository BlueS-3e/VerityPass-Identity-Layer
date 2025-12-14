// Wallet Session Manager
// Preserves wallet connection state across page navigations
// Allows seamless flow from ConnectPlaid → Attestation without re-connecting

const WALLET_SESSION_KEY = 'realmint:wallet_session';
const WALLET_SESSION_EXPIRY = 30 * 60 * 1000; // 30 minutes

/**
 * Save wallet session data when user connects
 * @param {object} wallet - Selected wallet info { id, name, type, icon }
 * @param {string} account - Connected account address
 * @param {number} chainId - Current network chain ID
 */
export function saveWalletSession(wallet, account, chainId) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    
    const session = {
      wallet: {
        id: wallet?.id,
        name: wallet?.name,
        type: wallet?.type,
        icon: wallet?.icon
      },
      account: account,
      chainId: chainId,
      timestamp: Date.now(),
      expiresAt: Date.now() + WALLET_SESSION_EXPIRY
    };
    
    sessionStorage.setItem(WALLET_SESSION_KEY, JSON.stringify(session));
    console.debug('[WalletSession] Saved:', { account: account?.slice(0, 6), chainId });
  } catch (e) {
    console.debug('[WalletSession] Save error:', e);
  }
}

/**
 * Get wallet session data if valid (not expired)
 * @returns {object|null} { wallet, account, chainId, timestamp } or null
 */
export function getWalletSession() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    
    const s = sessionStorage.getItem(WALLET_SESSION_KEY);
    if (!s) return null;
    
    const session = JSON.parse(s);
    
    // Check if expired
    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(WALLET_SESSION_KEY);
      console.debug('[WalletSession] Expired');
      return null;
    }
    
    return session;
  } catch (e) {
    console.debug('[WalletSession] Get error:', e);
    return null;
  }
}

/**
 * Clear wallet session (on logout/disconnect)
 */
export function clearWalletSession() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(WALLET_SESSION_KEY);
    console.debug('[WalletSession] Cleared');
  } catch (e) {
    console.debug('[WalletSession] Clear error:', e);
  }
}

/**
 * Check if user has an active wallet session
 * Useful for showing "Resume session" prompts
 */
export function hasActiveWalletSession() {
  const session = getWalletSession();
  return session && session.account ? true : false;
}

/**
 * Get last connected wallet info (even if session expired)
 * Useful for pre-selecting wallet on return visits
 */
export function getLastConnectedWallet() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const s = sessionStorage.getItem(WALLET_SESSION_KEY);
    if (!s) return null;
    const session = JSON.parse(s);
    return session.wallet; // Return even if expired
  } catch (e) {
    return null;
  }
}

/**
 * Extend wallet session expiry (called when user interacts)
 * Keeps session alive during active use
 */
export function extendWalletSession() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const s = sessionStorage.getItem(WALLET_SESSION_KEY);
    if (!s) return;
    
    const session = JSON.parse(s);
    session.expiresAt = Date.now() + WALLET_SESSION_EXPIRY;
    sessionStorage.setItem(WALLET_SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.debug('[WalletSession] Extend error:', e);
  }
}
