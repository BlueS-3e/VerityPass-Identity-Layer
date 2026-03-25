import { useState, useCallback } from 'react';
import { 
  listAvailableProviders, 
  getOperationalWallets,
  connectWallet as modernConnectWallet,
  createWalletConnectSession,
  persistPreferredProvider,
  loadPreferredProvider,
  switchNetwork,
  getUnsupportedWalletReason
} from '../utils/providerDetect';
import { saveWalletSession } from '../utils/walletSessionManager';
import { NETWORK_CONFIG, DEFAULT_CHAIN_ID } from '../config';
import { getBalance } from '../utils/web3';

/**
 * Modern web3 wallet connection hook
 * Handles: selection, connection, network switching, loading states, error handling
 * 
 * @returns {Object} { 
 *   wallets, selectedWallet, address, connecting, error,
 *   selectWallet, connect, disconnect, clearError
 * }
 */
export function useWalletConnection() {
  const [wallets, setWallets] = useState([]);
  const [selectedWallet, setSelectedWalletState] = useState(null);
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(DEFAULT_CHAIN_ID);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  // Initialize available wallets on first render
  const initializeWallets = useCallback(() => {
    try {
      const available = getOperationalWallets(listAvailableProviders() || []);
      setWallets(available);

      // Try to restore previously selected wallet
      try {
        const persisted = loadPreferredProvider();
        if (persisted) {
          const found = available.find(w => w.id === persisted.id || w.name === persisted.name);
          if (found) {
            setSelectedWalletState(found);
            return;
          }
        }
      } catch (e) {
        console.warn('[useWalletConnection] Failed to load persisted wallet:', e);
      }

      // Default to first wallet if available
      if (available.length > 0) {
        setSelectedWalletState(available[0]);
      }
    } catch (err) {
      console.error('[useWalletConnection] Failed to initialize wallets:', err);
      setError('Failed to detect wallets');
    }
  }, []);

  const selectWallet = useCallback((wallet) => {
    if (!wallet) return;
    
    // Validate wallet is operational (not Phantom, Trust, etc)
    const unsupportedReason = getUnsupportedWalletReason(wallet);
    if (unsupportedReason && wallet.id !== 'walletconnect') {
      setError(unsupportedReason);
      return;
    }
    
    setSelectedWalletState(wallet);
    setError(null);
    try {
      persistPreferredProvider(wallet);
    } catch (e) {
      console.warn('[useWalletConnection] Failed to persist wallet selection:', e);
    }
  }, []);

  const connect = useCallback(async (walletOverride = null, options = {}) => {
    const walletToConnect = walletOverride || selectedWallet;
    
    if (!walletToConnect) {
      setError('Please select a wallet first');
      return null;
    }

    setConnecting(true);
    setError(null);

    try {
      let result = null;

      // WalletConnect flow (SDK-based)
      if (walletToConnect.id === 'walletconnect') {
        result = await createWalletConnectSession(options.chainId || DEFAULT_CHAIN_ID);
      } else {
        // Injected provider flow
        if (!walletToConnect.provider) {
          throw new Error(`${walletToConnect.name} has no provider available`);
        }
        
        result = await modernConnectWallet(walletToConnect.provider);
      }

      if (!result?.provider || !result?.address) {
        throw new Error('Wallet connection did not return provider/address');
      }

      const connectedAddress = result.address;
      const connectedChainId = result.chainId || DEFAULT_CHAIN_ID;
      const provider = result.provider;

      // Auto-switch network if needed
      if (options.autoSwitchNetwork !== false) {
        const expectedChain = NETWORK_CONFIG[options.chainId || DEFAULT_CHAIN_ID];
        if (expectedChain && connectedChainId !== expectedChain.chainId) {
          try {
            await switchNetwork(provider, expectedChain.chainId);
          } catch (switchErr) {
            console.warn('[useWalletConnection] Network switch failed, continuing anyway:', switchErr);
          }
        }
      }

      // Save session and update state
      saveWalletSession(walletToConnect, connectedAddress, connectedChainId);
      setAddress(connectedAddress);
      setChainId(connectedChainId);
      setSelectedWalletState(walletToConnect);

      // Fetch balance if requested
      if (options.fetchBalance) {
        try {
          const bal = await getBalance(connectedAddress);
          if (bal) options.onBalance?.(bal);
        } catch (e) {
          console.debug('[useWalletConnection] Balance fetch failed:', e);
        }
      }

      return {
        provider,
        address: connectedAddress,
        chainId: connectedChainId,
        wallet: walletToConnect
      };
    } catch (err) {
      const message = err?.message || String(err);
      console.error('[useWalletConnection] Connection failed:', message);
      
      // Normalize error messages
      if (/cancelled|canceled|not completed|user rejected/i.test(message)) {
        setError('Connection cancelled');
      } else if (/no provider/i.test(message)) {
        setError(`${walletToConnect?.name || 'Wallet'} not found. Please install or enable it.`);
      } else if (/timeout/i.test(message)) {
        setError('Connection timeout - please try again');
      } else {
        setError(message || 'Failed to connect wallet');
      }
      
      return null;
    } finally {
      setConnecting(false);
    }
  }, [selectedWallet]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(DEFAULT_CHAIN_ID);
    setSelectedWalletState(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    wallets,
    selectedWallet,
    address,
    chainId,
    connecting,
    error,
    
    // Actions
    initializeWallets,
    selectWallet,
    connect,
    disconnect,
    clearError
  };
}
