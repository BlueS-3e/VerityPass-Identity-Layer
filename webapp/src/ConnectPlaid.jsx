import React, { useEffect, useMemo, useState, useRef } from 'react';
import PlaidLink from './components/PlaidLink';
import WalletPicker from './components/WalletPicker';
import { getSignerAddress } from './utils/web3';
import PrimaryCTA from './components/PrimaryCTA';
import { useToast } from './components/Toast';
import { useWalletConnection } from './hooks/useWalletConnection';
import { NETWORK_CONFIG, DEFAULT_CHAIN_ID } from './config';
import { setupProviderListeners } from './utils/providerDetect';
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
  clearWalletSession,
  extendWalletSession
} from './utils/walletSessionManager';
import { isMobileDevice } from './utils/deviceDetect';

function StepIndicator({ currentStep, steps }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => (
        <React.Fragment key={step}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
            index <= currentStep 
              ? 'bg-amber-500 border-amber-500 text-black' 
              : 'bg-white/5 border-white/20 text-gray-400'
          }`}>
            {index < currentStep ? '✓' : index + 1}
          </div>
          {index < steps.length - 1 && (
            <div className={`w-12 h-0.5 mx-2 ${
              index < currentStep ? 'bg-amber-500' : 'bg-white/20'
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
  const [loadingAddr, setLoadingAddr] = useState(true);
  const [identityBound, setIdentityBound] = useState(false);
  const [attestationStatus, setAttestationStatus] = useState(null);
  const [allowAnonFlow, setAllowAnonFlow] = useState(false);
  const [signing, setSigning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const { addToast } = useToast();
  
  // Use modern wallet connection hook
  const {
    wallets,
    selectedWallet,
    address: owner,
    connecting,
    error: walletError,
    initializeWallets,
    selectWallet,
    connect: doConnectWallet,
    disconnect: disconnectWallet,
    clearError: clearWalletError
  } = useWalletConnection();

  const steps = ['Connect Wallet', 'Verify Identity', 'Link Bank'];

  // Format and display wallets with priority
  const displayWallets = useMemo(() => {
    if (!wallets || !Array.isArray(wallets)) return [];
    const priority = ['MetaMask', 'Coinbase Wallet', 'Rabby Wallet', 'Brave Wallet', 'OKX Wallet'];
    const wc = wallets.find(w => w?.id === 'walletconnect');
    const injectedWallets = wallets.filter(w => w?.id !== 'walletconnect' && w?.provider);
    const prioritized = priority
      .map(name => injectedWallets.find(w => w?.name === name))
      .filter(Boolean);
    const result = [];
    if (wc) result.push(wc);
    result.push(...prioritized.slice(0, 3));
    return result.length ? result : wallets;
  }, [wallets]);

  // Handle wallet selection
  const handleSelectWallet = (wallet) => {
    selectWallet(wallet);
  };

  // Initialize wallets on mount
  useEffect(() => {
    initializeWallets();
  }, [initializeWallets]);

  // Load signer address and setup wallet listeners
  useEffect(() => {
    let mounted = true;
    let cleanup = null;

    const loadAddress = async () => {
      try {
        // Address comes from the hook now, not from getSignerAddress
        // Just mark address as loaded
        setLoadingAddr(false);
      } catch (e) {
        setLoadingAddr(false);
      }
    };

    loadAddress();

    // Only setup listeners for non-WalletConnect providers
    // WalletConnect handles its own listeners through Web3Modal
    if (selectedWallet?.provider && selectedWallet.id !== 'walletconnect') {
      cleanup = setupProviderListeners(selectedWallet.provider, {
        onAccountsChanged: (accounts) => {
          if (!accounts[0]) {
            disconnectWallet();
            addToast('🔌 Wallet disconnected', { type: 'warning' });
            setIdentityBound(false);
            setCurrentStep(0);
          }
        },
        onDisconnect: () => {
          disconnectWallet();
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
  }, [selectedWallet, disconnectWallet, addToast]);

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
    if (!selectedWallet) {
      addToast('👛 Please select a wallet first', { type: 'error' });
      return;
    }

    clearWalletError();
    const result = await doConnectWallet(selectedWallet, { 
      fetchBalance: false,
      autoSwitchNetwork: true 
    });

    if (result?.address) {
      addToast('🎉 Wallet connected successfully', { type: 'success' });
      setCurrentStep(1);
      extendWalletSession();
    } else {
      // If connection failed, show the error from the hook
      const errorMsg = walletError || 'Failed to connect wallet';
      addToast(`❌ ${errorMsg}`, { type: 'error' });
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

      // Use the selected wallet's provider to sign
      const signature = await selectedWallet.provider.request({
        method: 'personal_sign',
        params: [nonce, owner]
      });

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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-zinc-900 to-amber-950 page-shell sm:py-8 lg:py-10">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-gradient-to-r from-yellow-500/20 to-amber-600/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-l from-cyan-500/10 to-emerald-500/10 rounded-full blur-3xl" />

      <div className="relative max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 reveal">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-3xl mb-6 shadow-2xl">
            <img src="/bnb-chain-logo.svg" alt="BNB Chain" className="w-9 h-9" />
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Connect Banking Identity
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Link bank-grade data to power realistic credit evaluation and lending decisions on BNB Chain.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="reveal reveal-delay-1">
          <StepIndicator currentStep={currentStep} steps={steps} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 reveal reveal-delay-2">
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
                {displayWallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => handleSelectWallet(wallet)}
                    className={`p-4 rounded-xl border transition-all ${
                      selectedWallet?.id === wallet.id
                        ? 'bg-amber-500/20 border-amber-400 text-white shadow-lg'
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
              

              {walletError && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">⚠️</span>
                    <div>
                      <div className="text-white font-semibold mb-1">Wallet Not Supported</div>
                      <div className="text-red-300 text-sm">{walletError}</div>
                    </div>
                  </div>
                </div>
              )}

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
                  className="px-6 py-3 bg-gradient-to-r from-amber-400 to-yellow-500 text-black rounded-xl font-medium disabled:opacity-50 hover:shadow-lg transition-all flex items-center gap-2"
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
                  <div className="bg-gradient-to-br from-amber-500/10 to-cyan-500/10 rounded-xl border border-amber-500/20 p-6">
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
                            className="px-6 py-3 bg-gradient-to-r from-amber-400 to-yellow-500 text-black rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
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
                  <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
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

                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div className="text-sm font-semibold text-white mb-3">Credit Signal Preview</div>
                    <div className="space-y-2">
                      <div className="h-2 rounded bg-white/10 overflow-hidden"><div className="h-full w-3/4 bg-gradient-to-r from-emerald-400 to-cyan-400" /></div>
                      <div className="h-2 rounded bg-white/10 overflow-hidden"><div className="h-full w-2/3 bg-gradient-to-r from-amber-400 to-yellow-300" /></div>
                      <div className="h-2 rounded bg-white/10 overflow-hidden"><div className="h-full w-4/5 bg-gradient-to-r from-sky-400 to-indigo-400" /></div>
                    </div>
                    <div className="text-xs text-gray-400 mt-3">Income stability, account age, and repayment signals feed your lending profile.</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6 reveal reveal-delay-3">
            {/* Benefits */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>✨</span>
                Benefits
              </h3>
              <div className="space-y-3">
                <FeatureCard
                  icon="📊"
                  title="Credit Analysis"
                  description="Model repayment capacity from bank and wallet history"
                />
                <FeatureCard
                  icon="💸"
                  title="Better Rates"
                  description="Unlock lower collateral requirements with stronger signals"
                />
                <FeatureCard
                  icon="🛡️"
                  title="Secure & Private"
                  description="Your data is encrypted and never stored"
                />
                <FeatureCard
                  icon="🏦"
                  title="Instant Verification"
                  description="Bridge traditional account data into BNB lending workflows"
                />
              </div>
            </div>

            {/* Support */}
            <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 rounded-2xl border border-amber-500/20 p-6">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span>💬</span>
                Need Help?
              </h3>
              <div className="space-y-2 text-sm text-gray-300">
                <div className="flex items-center gap-2">
                  <span>📖</span>
                  <span>Lending setup checklist</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🔧</span>
                  <span>Risk operations support</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💡</span>
                  <span>Underwriting FAQs</span>
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