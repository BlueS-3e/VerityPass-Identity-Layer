// Transaction & Signing State Manager
// Persists transaction state in sessionStorage to survive page refreshes
// Allows resuming in-progress signing/publishing operations

const TX_STATE_KEY = 'veritypass:tx_state';
const SIGNING_STATE_KEY = 'veritypass:signing_state';
const PENDING_TX_KEY = 'veritypass:pending_tx';

export const TX_STATE = {
  IDLE: 'idle',
  FETCHING_DRAFT: 'fetching_draft',
  AWAITING_SIGNATURE: 'awaiting_signature',
  SIGNING: 'signing',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  FAILED: 'failed'
};

/**
 * Save current transaction state to sessionStorage
 * @param {string} state - Current TX_STATE value
 * @param {object} context - Additional context data (draftId, attestation, etc.)
 */
export function saveTxState(state, context = {}) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const data = {
      state,
      context,
      timestamp: Date.now(),
      account: context.account,
      chainId: context.chainId,
      draftId: context.draftId
    };
    sessionStorage.setItem(TX_STATE_KEY, JSON.stringify(data));
    console.debug('[TxState] Saved:', state, context);
  } catch (e) {
    console.debug('[TxState] Save error:', e);
  }
}

/**
 * Retrieve current transaction state from sessionStorage
 * @returns {object|null} { state, context, timestamp, account, chainId, draftId } or null if none
 */
export function getTxState() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const s = sessionStorage.getItem(TX_STATE_KEY);
    if (!s) return null;
    return JSON.parse(s);
  } catch (e) {
    console.debug('[TxState] Get error:', e);
    return null;
  }
}

/**
 * Clear transaction state (call after successful completion or on user action)
 */
export function clearTxState() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(TX_STATE_KEY);
    sessionStorage.removeItem(SIGNING_STATE_KEY);
    sessionStorage.removeItem(PENDING_TX_KEY);
    console.debug('[TxState] Cleared');
  } catch (e) {
    console.debug('[TxState] Clear error:', e);
  }
}

/**
 * Save pending transaction hash for monitoring
 * @param {string} txHash - Transaction hash from blockchain
 * @param {object} metadata - { draftId, account, chainId }
 */
export function savePendingTx(txHash, metadata = {}) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const data = {
      txHash,
      metadata,
      timestamp: Date.now()
    };
    sessionStorage.setItem(PENDING_TX_KEY, JSON.stringify(data));
    console.debug('[PendingTx] Saved:', txHash);
  } catch (e) {
    console.debug('[PendingTx] Save error:', e);
  }
}

/**
 * Get pending transaction hash (to poll for receipt on refresh)
 * @returns {object|null} { txHash, metadata, timestamp } or null
 */
export function getPendingTx() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const s = sessionStorage.getItem(PENDING_TX_KEY);
    if (!s) return null;
    const data = JSON.parse(s);
    // Don't return if older than 24 hours
    if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem(PENDING_TX_KEY);
      return null;
    }
    return data;
  } catch (e) {
    console.debug('[PendingTx] Get error:', e);
    return null;
  }
}

/**
 * Clear pending transaction (call after receipt confirmed or abandoned)
 */
export function clearPendingTx() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(PENDING_TX_KEY);
    console.debug('[PendingTx] Cleared');
  } catch (e) {
    console.debug('[PendingTx] Clear error:', e);
  }
}

/**
 * Save signing state for UI rendering on refresh
 * @param {string} state - 'awaiting_user' | 'signing_in_progress' | 'signed' | 'failed'
 * @param {object} context - Additional info to display to user
 */
export function saveSigningState(state, context = {}) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const data = {
      state,
      context,
      timestamp: Date.now()
    };
    sessionStorage.setItem(SIGNING_STATE_KEY, JSON.stringify(data));
    console.debug('[SigningState] Saved:', state);
  } catch (e) {
    console.debug('[SigningState] Save error:', e);
  }
}

/**
 * Get signing state (for displaying appropriate UI after refresh)
 * @returns {object|null} { state, context, timestamp }
 */
export function getSigningState() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const s = sessionStorage.getItem(SIGNING_STATE_KEY);
    if (!s) return null;
    return JSON.parse(s);
  } catch (e) {
    console.debug('[SigningState] Get error:', e);
    return null;
  }
}

/**
 * Clear signing state
 */
export function clearSigningState() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(SIGNING_STATE_KEY);
    console.debug('[SigningState] Cleared');
  } catch (e) {
    console.debug('[SigningState] Clear error:', e);
  }
}

/**
 * Check if there's an ongoing transaction that might need recovery
 * Returns true if state is awaiting_signature, signing, publishing, or has pending tx
 */
export function hasOngoingTransaction() {
  const txState = getTxState();
  const pendingTx = getPendingTx();
  
  if (pendingTx) return true;
  if (txState) {
    const { state } = txState;
    return [
      TX_STATE.AWAITING_SIGNATURE,
      TX_STATE.SIGNING,
      TX_STATE.PUBLISHING
    ].includes(state);
  }
  
  return false;
}

/**
 * Recovery helper: Check if refresh happened during signing
 * Returns signing context if user was in the middle of signing
 */
export function getSigningRecoveryContext() {
  const txState = getTxState();
  if (txState && txState.state === TX_STATE.AWAITING_SIGNATURE) {
    return {
      wasSigningWhenRefreshed: true,
      draftId: txState.draftId,
      account: txState.account,
      chainId: txState.chainId,
      context: txState.context
    };
  }
  return null;
}

/**
 * Recovery helper: Check if refresh happened during publishing
 * Returns transaction context if user was publishing
 */
export function getPublishingRecoveryContext() {
  const pendingTx = getPendingTx();
  if (pendingTx) {
    return {
      wasPublishingWhenRefreshed: true,
      txHash: pendingTx.txHash,
      metadata: pendingTx.metadata,
      timestamp: pendingTx.timestamp
    };
  }
  return null;
}
