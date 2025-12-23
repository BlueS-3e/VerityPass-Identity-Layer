import React, { useEffect, useState, useRef } from 'react';
import PlaidLink from './components/PlaidLink';
import { getSignerAddress } from './utils/web3';
import PrimaryCTA from './components/PrimaryCTA';
import { createWalletConnectSession, initWeb3Modal } from './utils/providerDetect'; // Added initWeb3Modal
import { useToast } from './components/Toast';
import { NETWORK_CONFIG, DEFAULT_CHAIN_ID } from './config';
import { 
  listAvailableProviders, 
  selectBestProvider, 
  connectWallet as modernConnectWallet,
  switchNetwork,
  setupProviderListeners,
  preloadWalletConnect,
  // Ensure these are imported:
  persistPreferredProvider, 
  loadPreferredProvider
} from './utils/providerDetect';
import apiClient from './utils/apiClient';
import {
  TX_STATE,
  saveTxState,
  getTxState,
  clearTxState,
  saveSigningState,
  getSigningState,
  clearSigningState
} from './utils/txStateManager';
import {
  saveWalletSession,
  getWalletSession,
  clearWalletSession,
  extendWalletSession
} from './utils/walletSessionManager';

function StepIndicator({ currentStep, steps }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => (
        <React.Fragment key={step}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
            index <= currentStep 
              ? 'bg-indigo-500 border-indigo-500 text-white' 
              : 'bg-white/5 border-white/20 text-gray-400'
          }`}>
            {index < currentStep ? '✓' : index + 1}
          </div>
          {index < steps.length - 1 && (
            <div className={`w-12 h-0.5 mx-2 ${
              index < currentStep ? 'bg-indigo-500' : 'bg-white/20'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
      <div className="text-2xl flex-shrink-0">{icon}</div>
      <div>
        <div className="text-white font-semibold mb-1">{title}</div>
        <div className="text-gray-300 text-sm">{description}</div>
      </div>
    </div>
  );
}

export default function ConnectPlaid() {
  const [owner, setOwner] = useState(null);
  const [loadingAddr, setLoadingAddr] = useState(true);
  const [identityBound, setIdentityBound] = useState(false);
  const [attestationStatus, setAttestationStatus] = useState(null);
  const [allowAnonFlow, setAllowAnonFlow] = useState(false);
  const [availableWallets, setAvailableWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [signing, setSigning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const { addToast } = useToast();

  const steps = ['Connect Wallet', 'Verify Identity', 'Link Bank'];
  const walletConnectRef = useRef(false); // Track if WalletConnect is being used

  // Initialize Web3Modal on component mount
  useEffect(() => {
    // WalletConnect Project ID from Vite env
    const walletConnectProjectId = (import.meta?.env?.VITE_WALLETCONNECT_PROJECT_ID) || 'YOUR_PROJECT_ID_HERE';
    
    if (walletConnectProjectId && walletConnectProjectId !== 'YOUR_PROJECT_ID_HERE') {
      initWeb3Modal(walletConnectProjectId).catch(console.error);
    }
  }, []);

  // Modern wallet detection
  useEffect(() => {
    const wallets = listAvailableProviders();
    setAvailableWallets(wallets);
    
    // Try to restore previously persisted selection
    try {
      const persisted = loadPreferredProvider();
      if (persisted) {
        const found = wallets.find(w => w.id === persisted.id || w.name === persisted.name);
        if (found) {
          setSelectedWallet(found);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load preferred provider:', e);
    }

    if (wallets.length > 0) {
      selectBestProvider().then(wallet => {
        setSelectedWallet(wallet);
      });
    }
  }, []);

  const handleSelectWallet = (wallet) => {
    setSelectedWallet(wallet);
    try { 
      persistPreferredProvider(wallet); 
    } catch (e) {
      console.warn('Failed to persist provider:', e);
    }
    
    // Pre-load WalletConnect code when user selects it to improve latency
    if (wallet?.id === 'walletconnect') {
      try { 
        preloadWalletConnect(); 
        walletConnectRef.current = true;
      } catch (e) {
        console.warn('Failed to preload WalletConnect:', e);
      }
    } else {
      walletConnectRef.current = false;
    }
  };

  // Load signer address and setup wallet listeners
  useEffect(() => {
    let mounted = true;
    let cleanup = null;

    const loadAddress = async () => {
      try {
        const address = await getSignerAddress();
        if (mounted) setOwner(address);
        if (address) setCurrentStep(1);
      } catch (e) {
        if (mounted) setOwner(null);
      } finally {
        if (mounted) setLoadingAddr(false);
      }
    };

    loadAddress();

    // Only setup listeners for non-WalletConnect providers
    // WalletConnect handles its own listeners through Web3Modal
    if (selectedWallet?.provider && selectedWallet.id !== 'walletconnect') {
      cleanup = setupProviderListeners(selectedWallet.provider, {
        onAccountsChanged: (accounts) => {
          setOwner(accounts[0] || null);
          if (!accounts[0]) {
            addToast('🔌 Wallet disconnected', { type: 'warning' });
            setIdentityBound(false);
            setCurrentStep(0);
          }
        },
        onDisconnect: () => {
          setOwner(null);
          setIdentityBound(false);
          setCurrentStep(0);
          addToast('🔌 Wallet disconnected', { type: 'warning' });
        }
      });
    }

    return () => {
      mounted = false;
      if (cleanup) cleanup();
    };
  }, [selectedWallet, addToast]);

  // Check identity binding status
  useEffect(() => {
    let mounted = true;
    
    const checkBound = async () => {
      if (!owner) {
        setIdentityBound(false);
        return;
      }
      
      try {
        const data = await apiClient.apiGet('/api/identity/bound').catch(() => ({ bound: false }));
        if (!mounted) return;
        const bound = Boolean(data?.bound);
        setIdentityBound(bound);
        if (bound) setCurrentStep(2);
      } catch (e) {
        if (mounted) setIdentityBound(false);
      }
    };

    checkBound();
    return () => { mounted = false; };
  }, [owner]);

  const connectWallet = async () => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      setConnecting(true);
      walletConnectRef.current = true;
      try {
        const result = await createWalletConnectSession(DEFAULT_CHAIN_ID);
        if (!result) throw new Error('WalletConnect session returned no result');
        const { provider, address, chainId } = result;
        setOwner(address);
        setSelectedWallet(prev => ({ ...(prev || {}), provider, id: 'walletconnect', name: 'WalletConnect' }));
        setCurrentStep(1);
        saveWalletSession({ id: 'walletconnect', name: 'WalletConnect', provider }, address, chainId || DEFAULT_CHAIN_ID);
        addToast('🎉 Wallet connected successfully', { type: 'success' });
      } catch (e) {
        console.error('WalletConnect session failed:', e);
        addToast(e.message?.includes('timeout') ? '⏰ Connection timeout - please try again' : `❌ ${e.message || 'WalletConnect connection failed'}`, { type: 'error' });
        walletConnectRef.current = false;
      } finally {
        setConnecting(false);
      }
      return;
    }

    if (!selectedWallet) {
      addToast('👛 Please select a wallet first', { type: 'error' });
      return;
    }
    
    // WalletConnect: handle first regardless of provider presence
    if (selectedWallet.id === 'walletconnect') {
      setConnecting(true);
      walletConnectRef.current = true;
      
      try {
        // Web3Modal v2 opens its own modal and handles the connection flow
        console.log('Starting WalletConnect session...');
        const result = await createWalletConnectSession(DEFAULT_CHAIN_ID); // Pass the chain ID
        
        if (!result) {
          throw new Error('WalletConnect session returned no result');
        }
        
        // result from Web3Modal v2 is { provider, address, chainId }
        const { provider, address, chainId } = result;
        
        console.log('WalletConnect connected:', { address, chainId });
        
        setOwner(address);
        setSelectedWallet(prev => ({ 
          ...(prev || {}), 
          provider,
          id: 'walletconnect',
          name: 'WalletConnect'
        }));
        setCurrentStep(1);
        
        // Save wallet session for Attestation page
        saveWalletSession({
          id: 'walletconnect',
          name: 'WalletConnect',
          provider
        }, address, chainId || DEFAULT_CHAIN_ID);
        
        addToast('🎉 Wallet connected successfully', { type: 'success' });
        
      } catch (e) {
        console.error('WalletConnect session failed:', e);
        addToast(
          e.message.includes('timeout') 
            ? '⏰ Connection timeout - please try again' 
            : `❌ ${e.message || 'WalletConnect connection failed'}`,
          { type: 'error' }
        );
        walletConnectRef.current = false;
      } finally {
        setConnecting(false);
      }
      return;
    }

    // If selected wallet doesn't expose a provider (e.g., SDK/install-only), handle gracefully
    if (!selectedWallet.provider) {
      addToast('🔍 Selected wallet has no direct provider. Please choose a different wallet or use WalletConnect.', { type: 'error' });
      return;
    }

    setConnecting(true);
    walletConnectRef.current = false;
    
    try {
      const connection = await modernConnectWallet(selectedWallet.provider);
      
      if (!connection || !connection.accounts || connection.accounts.length === 0) {
        throw new Error('Connection failed: no accounts returned');
      }
      
      const expectedChain = NETWORK_CONFIG[DEFAULT_CHAIN_ID];
      let networkSwitched = false;
      
      if (expectedChain && connection.chainId !== expectedChain.chainId) {
        try {
          await switchNetwork(selectedWallet.provider, expectedChain.chainId);
          networkSwitched = true;
          addToast(`✅ Switched to ${expectedChain.name}`, { type: 'success' });
        } catch (switchError) {
          console.warn('Network switch failed:', switchError);
          const wrongNetwork = NETWORK_CONFIG[connection.chainId];
          const wrongNetworkName = wrongNetwork?.name || `Chain ${connection.chainId}`;
          addToast(
            `⚠️ Connected to ${wrongNetworkName}. Please switch to ${expectedChain.name} manually in your wallet.`,
            { type: 'warning' }
          );
          setOwner(connection.accounts[0]);
          
          // Save wallet session even if network switch failed
          saveWalletSession(selectedWallet, connection.accounts[0], connection.chainId);
          
          setCurrentStep(1);
          return;
        }
      }
      
      setOwner(connection.accounts[0]);
      setCurrentStep(1);
      
      // Save wallet session for Attestation page
      saveWalletSession(selectedWallet, connection.accounts[0], expectedChain?.chainId || connection.chainId);
      
      // Only show success if on correct network or successfully switched
      if (!expectedChain || connection.chainId === expectedChain.chainId || networkSwitched) {
        addToast('🎉 Wallet connected successfully', { type: 'success' });
      }
    } catch (error) {
      console.error('Wallet connection failed:', error);
      addToast(
        error.message?.includes('rejected') 
          ? '❌ Connection rejected by user' 
          : `❌ ${error?.message || 'Wallet connection failed'}`,
        { type: 'error' }
      );
    } finally {
      setConnecting(false);
    }
  };

  const copyAddress = async () => {
    if (!owner) return;
    try {
      await navigator.clipboard.writeText(owner);
      addToast('📋 Address copied to clipboard', { type: 'success' });
    } catch (e) {
      console.warn('Copy failed', e);
      addToast('❌ Failed to copy address', { type: 'error' });
    }
  };

  const signToBind = async () => {
    if (!owner || !selectedWallet?.provider) {
      addToast('👛 Please connect a wallet first', { type: 'error' });
      return;
    }

    setSigning(true);
    try {
      const nonceData = await apiClient.apiGet('/api/identity/nonce');
      const nonce = nonceData?.nonce;
      if (!nonce) throw new Error('Invalid nonce received');

      // For WalletConnect, we need to get the signer differently
      let signature;
      
      if (selectedWallet.id === 'walletconnect' && walletConnectRef.current) {
        // WalletConnect specific signing
        const result = await createWalletConnectSession(DEFAULT_CHAIN_ID);
        if (result.provider) {
          signature = await result.provider.request({
            method: 'personal_sign',
            params: [nonce, owner]
          });
        }
      } else {
        // Standard provider signing
        signature = await selectedWallet.provider.request({
          method: 'personal_sign',
          params: [nonce, owner]
        });
      }

      if (!signature) {
        throw new Error('Failed to get signature');
      }

      const bindData = await apiClient.apiPost('/api/identity/bind', { 
        owner_addr: owner, 
        nonce, 
        signature 
      });

      setIdentityBound(true);
      setCurrentStep(2);
      addToast('🔐 Identity successfully bound to session', { type: 'success' });
    } catch (error) {
      console.error('Bind error:', error);
      addToast(
        error.message?.includes('rejected') 
          ? '❌ Signature rejected by user' 
          : `❌ ${error?.message || 'Signature or binding failed'}`,
        { type: 'error' }
      );
    } finally {
      setSigning(false);
    }
  };

  const onPlaidSuccess = async (payload) => {
    try {
      const ownerForDraft = owner || 'anon';
      const data = await apiClient.apiPost('/api/attestations/draft', { 
        owner_addr: ownerForDraft, 
        plaid: payload 
      });

      setAttestationStatus({ 
        ok: true, 
        id: data.attestation_id, 
        anon: !owner 
      });
      
      addToast(
        !owner ? '📄 Draft created (anonymous)' : '📄 Draft attestation created', 
        { type: 'success' }
      );
    } catch (error) {
      console.error('Draft creation error:', error);
      addToast(`❌ ${error?.message || 'Failed to create draft attestation'}`, { type: 'error' });
      setAttestationStatus({ 
        ok: false, 
        msg: error.message 
      });
    }
  };

  const claimDraft = async () => {
    if (!attestationStatus?.id) return;

    try {
      // Show loading state
      addToast('⏳ Processing draft claim...', { type: 'info' });
      setSigning(true);
      
      // Save transaction state for recovery on refresh
      // Fixed: Use actual account and network variables
      const account = owner;
      const network = DEFAULT_CHAIN_ID;
      
      saveTxState(TX_STATE.PUBLISHING, {
        draftId: attestationStatus.id,
        account: account,
        chainId: network
      });
      
      // Call claim endpoint
      const data = await apiClient.apiPost(`/api/attestations/${attestationStatus.id}/claim`, {});

      // Give backend time to process before redirecting
      await new Promise(resolve => setTimeout(resolve, 800));
      
      addToast('🎉 Draft claimed — opening attestation', { type: 'success' });
      
      // Clear transaction state on success
      clearTxState();
      
      // Redirect with both draft_id and network context
      const networkParam = network ? `&network=${network}` : '';
      window.location.href = `/attestation?draft_id=${attestationStatus.id}&autostart=1${networkParam}`;
    } catch (error) {
      console.error('Claim error:', error);
      setSigning(false);
      saveTxState(TX_STATE.FAILED, { 
        error: error?.message, 
        draftId: attestationStatus?.id 
      });
      addToast(`❌ ${error?.message || 'Claim request failed'}`, { type: 'error' });
    }
  };

  const shortAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-8 px-4">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-l from-green-500/10 to-teal-500/10 rounded-full blur-3xl" />

      <div className="relative max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl mb-6 shadow-2xl">
            <span className="text-3xl">🔗</span>
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Connect Bank Account
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Securely link your bank to verify income and unlock financial opportunities
          </p>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} steps={steps} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Wallet Connection */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2 m-0">
                  <span>👛</span>
                  Step 1: Connect Wallet
                </h2>
              </div>

              <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {availableWallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => handleSelectWallet(wallet)}
                    className={`p-4 rounded-xl border transition-all ${
                      selectedWallet?.id === wallet.id
                        ? 'bg-indigo-500/20 border-indigo-400 text-white shadow-lg'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20'
                    }`}
                    disabled={connecting && selectedWallet?.id === wallet.id}
                  >
                    <div className="flex items-center gap-3">
                      {wallet.icon && (
                        <img src={wallet.icon} alt="" className="w-6 h-6 rounded" />
                      )}
                      <span className="font-medium text-sm">{wallet.name}</span>
                      {connecting && selectedWallet?.id === wallet.id && (
                        <div className="ml-auto w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Mobile compact summary (selection via Connect modal) */}
              <div className="md:hidden mb-4">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                      {selectedWallet?.icon ? (
                        <img src={selectedWallet.icon} alt="" className="w-6 h-6" />
                      ) : (
                        <span>🔗</span>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-gray-300">{selectedWallet?.name || 'Wallet not selected'}</div>
                      <div className="text-xs text-gray-400">Use Connect to choose</div>
                    </div>
                  </div>
                </div>
              </div>
              

              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex-1">
                  <div className="text-sm text-gray-400 mb-1">Connected Address</div>
                  <div className="font-mono text-white text-sm flex items-center gap-2">
                    {owner ? shortAddress(owner) : 'Not connected'}
                    {owner && (
                      <button
                        onClick={copyAddress}
                        className="text-gray-400 hover:text-white transition-colors"
                        title="Copy address"
                      >
                        📋
                      </button>
                    )}
                  </div>
                </div>
                <button
                  onClick={connectWallet}
                  disabled={!selectedWallet || connecting}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium disabled:opacity-50 hover:shadow-lg transition-all flex items-center gap-2"
                >
                  {connecting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>🔗</span>
                  )}
                  {owner ? 'Reconnect' : 'Connect'}
                </button>
              </div>
            </div>

            {/* Identity Verification */}
            {owner && (
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span>🔐</span>
                  Step 2: Verify Identity
                </h2>

                {!identityBound && !allowAnonFlow ? (
                  <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20 p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2">
                          Secure Your Bank Data
                        </h3>
                        <p className="text-gray-300 mb-4">
                          Sign a message to cryptographically bind your wallet to this session. 
                          This ensures only you can access your bank data.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            onClick={signToBind}
                            disabled={signing}
                            className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                          >
                            {signing ? (
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span>✍️</span>
                            )}
                            Sign to Verify
                          </button>
                          <button
                            onClick={() => {
                              setAllowAnonFlow(true);
                              setCurrentStep(2);
                            }}
                            className="px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
                          >
                            Continue Anonymously
                          </button>
                        </div>
                      </div>
                      <div className="text-3xl">🛡️</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">✅</div>
                      <div>
                        <div className="text-white font-semibold">
                          {identityBound ? 'Identity Verified' : 'Anonymous Session'}
                        </div>
                        <div className="text-green-300 text-sm">
                          {identityBound 
                            ? 'Your wallet is securely bound to this session' 
                            : 'You can link accounts without verification'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bank Connection */}
            {(identityBound || allowAnonFlow) && (
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span>🏦</span>
                  Step 3: Link Bank Account
                </h2>

                <div className="space-y-4">
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">🔒</span>
                      <div>
                        <div className="text-white font-semibold">Bank-Level Security</div>
                        <div className="text-blue-300 text-sm">Powered by Plaid</div>
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm">
                      Your banking credentials are never stored. Plaid handles authentication securely 
                      and we only receive tokens to access account information.
                    </p>
                  </div>

                  <PlaidLink 
                    ownerAddr={allowAnonFlow ? null : owner} 
                    onSuccess={onPlaidSuccess} 
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Benefits */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>✨</span>
                Benefits
              </h3>
              <div className="space-y-3">
                <FeatureCard
                  icon="💳"
                  title="Credit Analysis"
                  description="Get instant credit scores and loan eligibility"
                />
                <FeatureCard
                  icon="🚀"
                  title="Better Rates"
                  description="Access preferential lending rates with verified income"
                />
                <FeatureCard
                  icon="🛡️"
                  title="Secure & Private"
                  description="Your data is encrypted and never stored"
                />
                <FeatureCard
                  icon="⚡"
                  title="Instant Verification"
                  description="Quick approval process with real-time analysis"
                />
              </div>
            </div>

            {/* Support */}
            <div className="bg-gradient-to-br from-green-500/10 to-teal-500/10 rounded-2xl border border-green-500/20 p-6">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span>💬</span>
                Need Help?
              </h3>
              <div className="space-y-2 text-sm text-gray-300">
                <div className="flex items-center gap-2">
                  <span>📖</span>
                  <span>Check our documentation</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🔧</span>
                  <span>Contact support</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💡</span>
                  <span>View FAQs</span>
                </div>
              </div>
            </div>

            {/* Success Actions */}
            {attestationStatus?.ok && (
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl border border-purple-500/20 p-6">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span>🎉</span>
                  Ready to Continue!
                </h3>
                <div className="space-y-3">
                  <a
                    href={`/attestation?draft_id=${attestationStatus.id}${identityBound ? '&autostart=1' : ''}`}
                    className="block w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold text-center hover:shadow-lg transition-all"
                  >
                    Complete Attestation
                  </a>
                  {attestationStatus.anon && identityBound && (
                    <button
                      onClick={claimDraft}
                      disabled={signing}
                      className="w-full px-4 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {signing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Claiming...
                        </>
                      ) : 'Claim Draft'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-gray-400 text-sm">
            🔒 Your privacy and security are our top priority
          </div>
          <div className="flex gap-3">
            <PrimaryCTA 
              to="/attestation"
              asButton={true}
              className="px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
            >
              📝 Create Attestation
            </PrimaryCTA>
            <PrimaryCTA 
              to="/" 
              asButton={true} 
              className="px-6 py-3 bg-white/5 text-white rounded-xl font-medium hover:bg-white/10 transition-colors"
            >
              🏠 Return Home
            </PrimaryCTA>
          </div>
        </div>
      </div>
    </div>
  );
}