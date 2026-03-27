// Wallet Session Manager
// Enhanced with better security, TypeScript support, and extended functionality
// Preserves wallet connection state across page navigations with session persistence

const WALLET_SESSION_KEY = 'veritypass:wallet_session';
const SESSION_EXTENSION_INTERVAL = 5 * 60 * 1000; // Extend session every 5 minutes during active use
const WALLET_PREFERENCE_KEY = 'veritypass:wallet_preference';

// Session data structure
/**
 * @typedef {Object} WalletSession
 * @property {WalletInfo} wallet - Wallet information
 * @property {string} account - Connected account address (checksummed)
 * @property {number} chainId - Current network chain ID
 * @property {number} timestamp - Session creation timestamp
 * @property {number} expiresAt - Session expiration timestamp
 * @property {string} sessionId - Unique session identifier
 * @property {boolean} isDelegated - Whether session was delegated (e.g., via WalletConnect)
 */

/**
 * @typedef {Object} WalletInfo
 * @property {string} id - Wallet identifier
 * @property {string} name - Wallet display name
 * @property {'injected'|'sdk'|'eip6963'} type - Wallet type
 * @property {string} [icon] - Wallet icon URL
 * @property {string} [rdns] - Reverse DNS identifier for EIP-6963
 */

/**
 * Saves wallet session with enhanced security and validation
 * @param {WalletInfo|Object} wallet - Wallet information
 * @param {string} account - Connected account address
 * @param {number} chainId - Current network chain ID
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.isDelegated] - Whether session is delegated (WalletConnect)
 * @param {number} [options.customExpiry] - Custom expiry time in milliseconds
 * @returns {WalletSession|null} The saved session or null if failed
 */
export function saveWalletSession(wallet, account, chainId, options = {}) {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    
    // Validate required parameters
    if (!wallet?.id || !account || !chainId) {
      console.warn('[WalletSession] Invalid parameters for save:', { wallet, account, chainId });
      return null;
    }
    
    // Normalize account address (checksum)
    const normalizedAccount = normalizeAddress(account);
    
    // Create unique session ID
    const sessionId = generateSessionId();
    
    // Calculate expiry
    const expiresAt = Date.now() + (options.customExpiry || (30 * 60 * 1000)); // Default 30 minutes
    
    const session = {
      wallet: {
        id: wallet.id,
        name: wallet.name || 'Unknown Wallet',
        type: wallet.type || 'injected',
        icon: wallet.icon || null,
        rdns: wallet.rdns || null
      },
      account: normalizedAccount,
      chainId: Number(chainId),
      timestamp: Date.now(),
      expiresAt,
      sessionId,
      isDelegated: options.isDelegated || false,
      version: '2.0' // Version tracking for future migrations
    };
    
    // Save to sessionStorage (cleared on browser close)
    sessionStorage.setItem(WALLET_SESSION_KEY, JSON.stringify(session));
    
    // Also save to localStorage for preference persistence (without sensitive data)
    saveWalletPreference(wallet);
    
    console.debug('[WalletSession] Saved:', { 
      wallet: wallet.name, 
      account: `${normalizedAccount.slice(0, 6)}...${normalizedAccount.slice(-4)}`,
      chainId,
      sessionId: sessionId.slice(0, 8)
    });
    
    // Start session extension interval for active sessions
    if (options.isDelegated) {
      startSessionExtensionInterval(sessionId);
    }
    
    return session;
  } catch (error) {
    console.error('[WalletSession] Save error:', error);
    return null;
  }
}

/**
 * Retrieves and validates wallet session
 * @returns {WalletSession|null} Valid session or null
 */
export function getWalletSession() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    
    const rawSession = sessionStorage.getItem(WALLET_SESSION_KEY);
    if (!rawSession) return null;
    
    const session = JSON.parse(rawSession);
    
    // Validate session structure
    if (!isValidSession(session)) {
      console.warn('[WalletSession] Invalid session structure');
      clearWalletSession();
      return null;
    }
    
    // Check expiry
    if (Date.now() > session.expiresAt) {
      console.debug('[WalletSession] Session expired');
      clearWalletSession();
      return null;
    }
    
    // Update last accessed timestamp for active sessions
    if (session.isDelegated) {
      extendSessionLifetime(session.sessionId);
    }
    
    return session;
  } catch (error) {
    console.error('[WalletSession] Get error:', error);
    clearWalletSession(); // Clear corrupted session
    return null;
  }
}

/**
 * Clears wallet session with cleanup
 * @param {Object} [options] - Cleanup options
 * @param {boolean} [options.clearPreference] - Whether to clear wallet preference
 * @param {string} [options.reason] - Reason for clearing session
 */
export function clearWalletSession(options = {}) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    
    const session = getWalletSession();
    if (session) {
      console.debug('[WalletSession] Clearing session:', { 
        wallet: session.wallet.name,
        reason: options.reason || 'manual'
      });
      
      // Stop session extension interval if running
      stopSessionExtensionInterval();
    }
    
    // Clear session storage
    sessionStorage.removeItem(WALLET_SESSION_KEY);
    
    // Optionally clear preference
    if (options.clearPreference) {
      localStorage.removeItem(WALLET_PREFERENCE_KEY);
    }
    
    // Dispatch event for other components to react
    dispatchSessionChangeEvent('disconnected');
    
  } catch (error) {
    console.error('[WalletSession] Clear error:', error);
  }
}

/**
 * Checks if user has an active, valid wallet session
 * @returns {boolean}
 */
export function hasActiveWalletSession() {
  return getWalletSession() !== null;
}

/**
 * Gets last connected wallet info (even if session expired)
 * Useful for pre-selecting wallet on return visits
 * @returns {WalletInfo|null}
 */
export function getLastConnectedWallet() {
  try {
    const session = getWalletSession();
    if (session) {
      return session.wallet;
    }
    
    // Fallback to localStorage preference
    return getWalletPreference();
  } catch (error) {
    return null;
  }
}

/**
 * Extends wallet session lifetime
 * Called automatically for delegated sessions, can be called manually for others
 * @param {string} [sessionId] - Specific session ID to extend
 * @returns {boolean} Whether extension was successful
 */
export function extendWalletSession(sessionId) {
  try {
    if (typeof sessionStorage === 'undefined') return false;
    
    const session = getWalletSession();
    if (!session) return false;
    
    // Verify session ID if provided
    if (sessionId && session.sessionId !== sessionId) {
      console.warn('[WalletSession] Session ID mismatch during extension');
      return false;
    }
    
    // Extend by 30 minutes
    session.expiresAt = Date.now() + (30 * 60 * 1000);
    sessionStorage.setItem(WALLET_SESSION_KEY, JSON.stringify(session));
    
    console.debug('[WalletSession] Extended:', { 
      sessionId: session.sessionId.slice(0, 8),
      newExpiry: new Date(session.expiresAt).toISOString()
    });
    
    return true;
  } catch (error) {
    console.error('[WalletSession] Extend error:', error);
    return false;
  }
}

/**
 * Validates that a session object has the correct structure
 * @param {any} session - Session object to validate
 * @returns {boolean}
 */
function isValidSession(session) {
  return (
    session &&
    typeof session === 'object' &&
    session.wallet &&
    typeof session.wallet.id === 'string' &&
    typeof session.account === 'string' &&
    session.account.match(/^0x[a-fA-F0-9]{40}$/) &&
    typeof session.chainId === 'number' &&
    typeof session.timestamp === 'number' &&
    typeof session.expiresAt === 'number' &&
    typeof session.sessionId === 'string' &&
    typeof session.isDelegated === 'boolean'
  );
}

/**
 * Normalizes Ethereum address to checksum format
 * @param {string} address - Ethereum address
 * @returns {string} Checksummed address
 */
function normalizeAddress(address) {
  if (!address || typeof address !== 'string') return '';
  
  // Remove any whitespace and convert to lowercase
  const cleanAddr = address.trim().toLowerCase();
  
  // Basic validation
  if (!cleanAddr.match(/^0x[a-f0-9]{40}$/)) {
    console.warn('[WalletSession] Invalid address format:', address);
    return cleanAddr;
  }
  
  // Simple checksum implementation (basic version)
  // In production, consider using ethers.js or web3.js for proper checksum
  try {
    // For now, return lowercase for safety
    // TODO: Implement proper checksum when ethers.js is available
    return cleanAddr;
  } catch {
    return cleanAddr;
  }
}

/**
 * Generates a unique session ID
 * @returns {string} Session ID
 */
function generateSessionId() {
  return 'ses_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Saves wallet preference to localStorage for future sessions
 * @param {WalletInfo} wallet - Wallet information
 */
function saveWalletPreference(wallet) {
  try {
    if (typeof localStorage === 'undefined') return;
    
    const preference = {
      id: wallet.id,
      name: wallet.name,
      type: wallet.type,
      icon: wallet.icon,
      rdns: wallet.rdns,
      lastUsed: Date.now()
    };
    
    localStorage.setItem(WALLET_PREFERENCE_KEY, JSON.stringify(preference));
  } catch (error) {
    // Silently fail for localStorage errors (private browsing, etc.)
  }
}

/**
 * Gets saved wallet preference from localStorage
 * @returns {WalletInfo|null}
 */
function getWalletPreference() {
  try {
    if (typeof localStorage === 'undefined') return null;
    
    const raw = localStorage.getItem(WALLET_PREFERENCE_KEY);
    if (!raw) return null;
    
    const preference = JSON.parse(raw);
    
    // Validate preference structure
    if (!preference.id || !preference.name) {
      return null;
    }
    
    return {
      id: preference.id,
      name: preference.name,
      type: preference.type || 'injected',
      icon: preference.icon || null,
      rdns: preference.rdns || null
    };
  } catch (error) {
    return null;
  }
}

/**
 * Dispatches a custom event when session changes
 * @param {'connected'|'disconnected'|'extended'} type - Event type
 */
function dispatchSessionChangeEvent(type) {
  try {
    if (typeof window === 'undefined') return;
    
    const event = new CustomEvent('walletsessionchange', {
      detail: { type, timestamp: Date.now() }
    });
    
    window.dispatchEvent(event);
  } catch (error) {
    console.debug('[WalletSession] Event dispatch error:', error);
  }
}

// Active session extension management
let extensionInterval = null;

/**
 * Starts automatic session extension interval
 * @param {string} sessionId - Session ID to extend
 */
function startSessionExtensionInterval(sessionId) {
  stopSessionExtensionInterval(); // Clear any existing interval
  
  extensionInterval = setInterval(() => {
    if (hasActiveWalletSession()) {
      extendWalletSession(sessionId);
    } else {
      stopSessionExtensionInterval();
    }
  }, SESSION_EXTENSION_INTERVAL);
}

/**
 * Stops the session extension interval
 */
function stopSessionExtensionInterval() {
  if (extensionInterval) {
    clearInterval(extensionInterval);
    extensionInterval = null;
  }
}

/**
 * Gets session statistics and metadata
 * @returns {Object} Session metadata
 */
export function getSessionMetadata() {
  const session = getWalletSession();
  if (!session) return null;
  
  const now = Date.now();
  const timeRemaining = Math.max(0, session.expiresAt - now);
  const sessionAge = now - session.timestamp;
  
  return {
    sessionId: session.sessionId,
    walletName: session.wallet.name,
    accountShort: `${session.account.slice(0, 6)}...${session.account.slice(-4)}`,
    chainId: session.chainId,
    isDelegated: session.isDelegated,
    timeRemainingMs: timeRemaining,
    timeRemainingMinutes: Math.floor(timeRemaining / 60000),
    sessionAgeMs: sessionAge,
    sessionAgeMinutes: Math.floor(sessionAge / 60000),
    expiresAt: session.expiresAt,
    expiresAtFormatted: new Date(session.expiresAt).toLocaleTimeString(),
    version: session.version || '1.0'
  };
}

/**
 * Migrates old session format to new format
 * @returns {boolean} Whether migration occurred
 */
export function migrateOldSession() {
  try {
    if (typeof sessionStorage === 'undefined') return false;
    
    const rawSession = sessionStorage.getItem(WALLET_SESSION_KEY);
    if (!rawSession) return false;
    
    const session = JSON.parse(rawSession);
    
    // Check if migration is needed (old version or missing fields)
    if (session.version === '2.0' && session.sessionId) {
      return false; // Already migrated
    }
    
    // Migrate old session to new format
    const newSession = {
      ...session,
      sessionId: session.sessionId || generateSessionId(),
      isDelegated: session.isDelegated || false,
      version: '2.0'
    };
    
    // Normalize account if needed
    if (session.account && !session.account.startsWith('0x')) {
      newSession.account = '0x' + session.account;
    }
    
    sessionStorage.setItem(WALLET_SESSION_KEY, JSON.stringify(newSession));
    console.debug('[WalletSession] Migrated old session');
    return true;
    
  } catch (error) {
    console.error('[WalletSession] Migration error:', error);
    return false;
  }
}

// Auto-migrate on module load
if (typeof window !== 'undefined') {
  setTimeout(migrateOldSession, 100);
}