import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NETWORK_CONFIG, DEFAULT_CHAIN_ID } from './config';
import { getSelectedFlow, setSelectedFlow } from './flowGate';
import HeroGraphic from './components/HeroGraphic';
import NetworkBanner from './components/NetworkBanner';
import { useToast } from './components/Toast';
import { buildAttestationTypedData, signAttestationTypedData } from './utils/eip712';
import { 
  listAvailableProviders,
  connectWallet as modernConnectWallet,
  switchNetwork,
  setupProviderListeners 
} from './utils/providerDetect';
import { isValidCID, normalizeCid } from './utils/ipfs';
// API_BASE not used in this component; resolved via apiClient when needed
import apiClient from './utils/apiClient';
import { generateLendingTerms } from './utils/creditEngine';
import {
  pinAndPublish,
  pinAttestationToApi,
  publishAttestationOnChain,
  getAuthoritativeFeeRecipient,
  CONTRACT_ADDRESS,
  getBalance,
} from './utils/web3';
import assessCredit from './utils/creditApi';
import {
  TX_STATE,
  saveTxState,
  getTxState,
  clearTxState,
  savePendingTx,
  getPendingTx,
  clearPendingTx,
  saveSigningState,
  getSigningState,
  clearSigningState,
  hasOngoingTransaction,
  getSigningRecoveryContext,
  getPublishingRecoveryContext
} from './utils/txStateManager';
import {
  getWalletSession,
  extendWalletSession,
  clearWalletSession,
  hasActiveWalletSession
} from './utils/walletSessionManager';

function FeatureCard({ icon, title, description, gradient }) {
  return (
    <div className={`p-4 rounded-xl bg-gradient-to-br ${gradient} border border-white/10 backdrop-blur-sm`}>
      <div className="text-2xl mb-2">{icon}</div>
      <h4 className="font-semibold text-white text-sm mb-1">{title}</h4>
      <p className="text-gray-300 text-xs leading-relaxed">{description}</p>
    </div>
  );
}

function LoanCard({ loan, onBorrow }) {
  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
      <div className="flex items-center justify-between mb-2">
        <div className="text-white font-semibold">${loan.amount}</div>
        <div className="text-green-300 text-sm">{loan.interestRate}% APR</div>
      </div>
      <div className="text-xs text-gray-300 space-y-1">
        <div>Term: {loan.term} days</div>
        <div>Collateral: {loan.collateralPct}% required</div>
        <div>Max LTV: {loan.maxLTV || '80'}%</div>
      </div>
      <button 
        onClick={() => onBorrow(loan)}
        className="w-full mt-3 px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
      >
        🚀 Borrow Now
      </button>
    </div>
  );
}

export default function Attestation() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const walletWarningShown = useRef(false);
  
  const [account, setAccount] = useState(null);
  const [schema, setSchema] = useState('income-proof-v1');
  const [dataCID, setDataCID] = useState('');
  const [expiresAt, setExpiresAt] = useState(Math.floor(Date.now() / 1000) + 3600);
  const [status, setStatus] = useState('');
  const [pin, setPin] = useState(null);
  const [callPayload, setCallPayload] = useState(null);
  const [contractAddress, setContractAddress] = useState('');
  const [network, setNetwork] = useState(null);
  const [busy, setBusy] = useState(false);
  const [availableWallets, setAvailableWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [cidValid, setCidValid] = useState(false);
  const [cidError, setCidError] = useState('');
  const [authRecipient, setAuthRecipient] = useState(null);
  const [draftInfo, setDraftInfo] = useState(null);
  const [creditScore, setCreditScore] = useState(null);
  const [eligibleLoans, setEligibleLoans] = useState([]);
  const [analyzingCredit, setAnalyzingCredit] = useState(false);
  const [bankDataSource, setBankDataSource] = useState('unknown');
  const [identityBound, setIdentityBound] = useState(false);

  // Detect available wallets
  useEffect(() => {
    const wallets = listAvailableProviders() || [];
    setAvailableWallets(wallets);
  }, []);

  // Restore wallet session if available (from ConnectPlaid)
  // If no session exists, redirect to ConnectPlaid
  useEffect(() => {
    const session = getWalletSession();
    
    // No session = user hasn't connected wallet on ConnectPlaid
    if (!session || !session.account) {
      console.debug('[Session] No wallet session found, redirecting to ConnectPlaid...');
      if (!walletWarningShown.current) {
        addToast('⚠️ Please connect your wallet first', { type: 'warning' });
        walletWarningShown.current = true;
      }
      setTimeout(() => navigate('/connect'), 1500);
      return;
    }
    
    // Session exists - restore wallet automatically
    const sessionWallet = availableWallets.find(w => 
      w.id === session.walletId || w.name === session.walletName
    );
    
    if (sessionWallet && !selectedWallet) {
      console.debug('[Session] Auto-restoring wallet from ConnectPlaid:', sessionWallet.name);
      sessionStorage.setItem('realmint:auto_connect', 'true');
      setSelectedWallet(sessionWallet);
      extendWalletSession();
    }
  }, [availableWallets, navigate, addToast, selectedWallet]);

  // Network and contract detection
  useEffect(() => {
    let mounted = true;
    
    const detectNetwork = async () => {
      if (!selectedWallet?.provider) return;
      
      try {
        const connection = await modernConnectWallet(selectedWallet.provider);
        if (!mounted) return;
        
        setAccount(connection.accounts[0]);
        setNetwork(connection.chainId);
        
        const cfg = NETWORK_CONFIG[connection.chainId] || NETWORK_CONFIG[DEFAULT_CHAIN_ID];
        if (cfg?.attestationRegistry) {
          setContractAddress(cfg.attestationRegistry);
        }
      } catch (error) {
        console.debug('Network detection failed:', error);
      }
    };

    detectNetwork();

    // Setup event listeners
    const cleanup = selectedWallet?.provider ? setupProviderListeners(selectedWallet.provider, {
      onAccountsChanged: (accounts) => {
        setAccount(accounts[0] || null);
        if (!accounts[0]) addToast('Wallet disconnected', { type: 'warning' });
      },
      onChainChanged: (chainId) => {
        const newChainId = parseInt(chainId, 16);
        setNetwork(newChainId);
        const cfg = NETWORK_CONFIG[newChainId] || NETWORK_CONFIG[DEFAULT_CHAIN_ID];
        if (cfg?.attestationRegistry) {
          setContractAddress(cfg.attestationRegistry);
        }
      },
      onDisconnect: () => {
        setAccount(null);
        addToast('Wallet disconnected', { type: 'warning' });
      }
    }) : null;

    // Fetch authoritative recipient
    (async () => {
      try {
        const recipient = await getAuthoritativeFeeRecipient();
        if (mounted) setAuthRecipient(recipient);
      } catch (e) {
        console.debug('Failed to fetch fee recipient:', e);
      }
    })();

    return () => {
      mounted = false;
      if (cleanup) cleanup();
    };
  }, [selectedWallet, addToast]);

  // Flow management
  useEffect(() => {
    try {
      const sel = getSelectedFlow();
      if (sel === 'launchpad') navigate('/');
      setSelectedFlow('attestation');
    } catch (e) {}
  }, [navigate]);

  // Recovery from refresh during signing or publishing
  useEffect(() => {
    const signingRecovery = getSigningRecoveryContext();
    const publishingRecovery = getPublishingRecoveryContext();

    if (signingRecovery) {
      console.debug('[Recovery] Resuming from signing state', signingRecovery);
      addToast('📋 Resuming from previous signing session...', { type: 'info' });
      setStatus('⏳ Resuming signature request...');
      setBusy(true);
    }

    if (publishingRecovery) {
      console.debug('[Recovery] Resuming from publishing state', publishingRecovery);
      addToast('⏳ Checking publication status...', { type: 'info' });
      setStatus(`Checking transaction ${publishingRecovery.txHash.slice(0, 8)}...`);
      setBusy(true);
      
      // Poll for transaction receipt
      (async () => {
        try {
          const receipt = await apiClient.apiGet(
            `/api/transactions/${publishingRecovery.txHash}/receipt`
          ).catch(() => null);
          
          if (receipt && receipt.blockNumber) {
            clearPendingTx();
            setStatus(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
            addToast('🎉 Publication confirmed!', { type: 'success' });
            setBusy(false);
            setTimeout(() => setStatus(''), 3000);
          } else {
            setStatus('⏳ Still waiting for confirmation...');
            addToast('Still mining transaction. Watching for confirmation...', { type: 'info' });
          }
        } catch (e) {
          console.debug('Receipt check failed:', e);
          setStatus('⚠️ Could not verify transaction status. Check etherscan.');
        }
      })();
    }
  }, [addToast]);

  // Draft autostart/prefill
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const draftId = params.get('draft_id');
    const autostart = params.get('autostart');
    const networkParam = params.get('network');
    
    // Enforce network from ConnectPlaid if provided
    if (networkParam) {
      const numericNetworkId = typeof networkParam === 'string' ? parseInt(networkParam, 16) : networkParam;
      // Will use this when connecting wallet
      setNetwork(numericNetworkId);
    }
    
    if (!draftId) return;

    const fetchDraft = async (retryCount = 0, maxRetries = 3) => {
      try {
        const draft = await apiClient.apiGet(`/api/attestations/${draftId}`).catch(() => null);
        
        // Retry if draft not found (race condition from claimDraft)
        if (!draft) {
          if (retryCount < maxRetries) {
            console.debug(`Draft not found, retrying (${retryCount + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1)));
            return fetchDraft(retryCount + 1, maxRetries);
          }
          console.warn('Draft not found after retries');
          return;
        }
        
        setDraftInfo(draft);
        
        if (draft.schema_hash) setSchema(draft.schema_hash);
        if (draft.data_cid) {
          setDataCID(draft.data_cid);
          try { setCidValid(isValidCID(draft.data_cid)); } catch (e) { setCidValid(false); }
        }
        
        if (autostart === '1' && selectedWallet) {
          try {
            if (draft.issuer && (String(draft.issuer).toLowerCase() === 'anon')) {
              const jb = await apiClient.apiGet('/api/identity/bound').catch(() => ({ bound: false }));
              if (!jb.bound) {
                console.warn('Autostart suppressed: draft is anonymous and session not bound');
              } else {
                await connectWallet();
                setTimeout(() => handleSignAndPin(), 400);
              }
            } else {
              await connectWallet();
              setTimeout(() => handleSignAndPin(), 400);
            }
          } catch (e) {
            console.warn('Autostart aborted', e);
          }
        }
      } catch (e) {
        console.warn('Failed to fetch draft info', e);
      }
    };

    fetchDraft();
  }, [selectedWallet]);

  const connectWallet = async () => {
    if (!selectedWallet) {
      console.warn('connectWallet called without selectedWallet');
      return null;
    }

    // If the wallet has no provider instance, try WalletConnect fallback
    if (!selectedWallet.provider) {
      try {
        if (selectedWallet.id === 'walletconnect') {
          // Lazy-init Web3Modal then fetch provider
          await preloadWalletConnect();
          const { getWalletConnectProvider } = await import('./utils/walletConnectV2.js');
          const wcProvider = getWalletConnectProvider();
          if (wcProvider) {
            selectedWallet.provider = wcProvider;
          }
        }
      } catch (e) {}
      
      if (!selectedWallet.provider) {
        addToast('Selected wallet has no provider. Please reconnect on the Connect page.', { type: 'error' });
        return null;
      }
    }

    try {
      const connection = await modernConnectWallet(selectedWallet.provider);

      // Use network from URL param (set by ConnectPlaid) or fall back to DEFAULT_CHAIN_ID
      const targetChainId = network || DEFAULT_CHAIN_ID;
      const expectedChain = NETWORK_CONFIG[targetChainId];
      let networkSwitched = false;
      
      if (expectedChain && connection.chainId !== expectedChain.chainId) {
        try {
          await switchNetwork(selectedWallet.provider, expectedChain.chainId);
          networkSwitched = true;
          addToast(`✅ Switched to ${expectedChain.name}`, { type: 'success' });
        } catch (switchError) {
          console.warn('Network switch failed:', switchError);
          const errorMsg = switchError?.message || String(switchError);
          
          // Check if it's a Phantom limitation
          if (errorMsg.includes('Phantom') || errorMsg.includes('limited EVM')) {
            addToast(
              `❌ ${selectedWallet.name} doesn't support this network. Please use MetaMask, Coinbase Wallet, or another EVM wallet.`,
              { type: 'error' }
            );
            return null;
          }
          
          const wrongNetwork = NETWORK_CONFIG[connection.chainId];
          const wrongNetworkName = wrongNetwork?.name || `Chain ${connection.chainId}`;
          
          // Provide helpful error message based on wallet capabilities
          if (errorMsg.includes('does not support') || errorMsg.includes('not connected')) {
            addToast(
              `⚠️ ${selectedWallet.name} is connected to ${wrongNetworkName}. Please switch to ${expectedChain.name} manually in your wallet.`,
              { type: 'warning' }
            );
          } else {
            addToast(
              `⚠️ Please switch to ${expectedChain.name} in your wallet to continue.`,
              { type: 'warning' }
            );
          }
          
          // Still set account/network so user can manually switch
          setAccount(connection.accounts[0]);
          setNetwork(connection.chainId);
          return connection.accounts[0];
        }
      }

      setAccount(connection.accounts[0]);
      setNetwork(networkSwitched ? expectedChain.chainId : connection.chainId);
      
      // Extend wallet session to keep user logged in across pages
      extendWalletSession();
      
      // Only show success if on correct network or successfully switched
      if (!expectedChain || connection.chainId === expectedChain.chainId || networkSwitched) {
        addToast('🎉 Wallet connected successfully', { type: 'success' });
      }

      return connection.accounts[0];
    } catch (error) {
      console.error('Wallet connection failed:', error);
      const errorMsg = error?.message || String(error);
      if (/user rejected/i.test(errorMsg) || /user denied/i.test(errorMsg)) {
        addToast('❌ Connection cancelled by user', { type: 'info' });
      } else {
        addToast(`❌ ${errorMsg}`, { type: 'error' });
      }
      return null;
    }
  };

  // Auto-connect wallet if session valid and flag set
  useEffect(() => {
    if (!selectedWallet) return;
    
    const shouldAutoConnect = sessionStorage.getItem('realmint:auto_connect');
    if (!shouldAutoConnect) return;
    
    // Clear flag so we don't auto-connect again
    sessionStorage.removeItem('realmint:auto_connect');
    
    console.debug('[Session] Auto-connecting wallet from session...');
    connectWallet();
  }, [selectedWallet]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const j = await apiClient.apiGet('/api/identity/bound').catch(() => ({ bound: false }));
        if (!mounted) return;
        setIdentityBound(Boolean(j.bound));
      } catch (e) {
        setIdentityBound(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const bindIdentity = async () => {
    if (!selectedWallet?.provider) {
      addToast('Please connect a wallet to bind identity', { type: 'error' });
      return;
    }
    try {
  const nj = await apiClient.apiGet('/api/identity/nonce');
  const nonce = nj && nj.nonce;
      if (!nonce) throw new Error('Nonce not returned');
      
      const signature = await selectedWallet.provider.request({ 
        method: 'personal_sign', 
        params: [nonce, account || ''] 
      });
      
      await apiClient.apiPost('/api/identity/bind', { owner_addr: account, nonce, signature });
      setIdentityBound(true);
      addToast('Identity bound to session', { type: 'success' });
    } catch (e) {
      console.error('Bind identity failed', e);
      addToast('Failed to bind identity', { type: 'error' });
    }
  };

  const handleSignAndPin = async () => {
    if (!cidValid) {
      addToast('Invalid IPFS CID — please correct it before signing', { type: 'error' });
      return;
    }

    if (!selectedWallet?.provider) {
      addToast('Please connect a wallet first', { type: 'error' });
      return;
    }

    setBusy(true);
    setStatus('Preparing attestation...');
    
    // Save signing state for recovery if refresh happens
    saveSigningState('awaiting_user', { draftId: draftInfo?.id });

    try {
      const acct = account || await connectWallet();
      if (!acct) {
        addToast('Please connect a wallet before signing', { type: 'error' });
        clearSigningState();
        setBusy(false);
        return;
      }

      const chosenChainId = network || DEFAULT_CHAIN_ID;
      const cfg = NETWORK_CONFIG[chosenChainId] || {};
      const verifyingContract = cfg.attestationRegistry || CONTRACT_ADDRESS;

      const typedData = buildAttestationTypedData({
        chainId: chosenChainId,
        verifyingContract,
        subject: acct,
        schemaHash: schema,
        dataCID: dataCID,
        expiresAt: expiresAt,
      });

      setStatus('Requesting signature...');
      saveSigningState('signing_in_progress', { draftId: draftInfo?.id });
      
      const signature = await signAttestationTypedData(typedData, selectedWallet.provider);

      setStatus('Pinning to IPFS...');
      const normalizedCID = normalizeCid(dataCID);
      const payload = {
        issuer: acct,
        subject: typedData.value.subject,
        schemaHash: typedData.value.schemaHash,
        dataCID: normalizedCID,
        expiresAt: typedData.value.expiresAt,
        signature,
        chainId: typedData.domain.chainId,
        contractAddress: typedData.domain.verifyingContract,
      };

      const required = ['issuer', 'subject', 'schemaHash', 'dataCID', 'signature'];
      const missing = required.filter(k => {
        const v = payload[k];
        return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
      });
      if (missing.length) {
        console.error('Attestation payload missing fields before pin:', missing, payload);
        throw new Error(`Missing required attestation fields: ${missing.join(', ')}`);
      }

      const result = await pinAttestationToApi(payload);
      if (!result) throw new Error('Pin API returned empty response');
      
      setStatus('Pinned successfully');
      setPin(result.pin);
      setCallPayload(result.call_payload);
      addToast(`📌 Attestation pinned: ${result.pin}`, { type: 'success' });
      
      // Clear signing state on success
      clearSigningState();
    } catch (error) {
      const errorMsg = error?.message || String(error);
      setStatus(`Error: ${errorMsg}`);
      console.error('Sign and pin failed:', error);
      addToast(`❌ Error: ${errorMsg}`, { type: 'error' });
      saveSigningState('failed', { error: errorMsg });
    } finally {
      setBusy(false);
    }
  };

  const handleSignPinAndPublish = async () => {
    if (!cidValid) {
      addToast('Invalid IPFS CID — please correct it before signing', { type: 'error' });
      return;
    }

    setBusy(true);
    setStatus('Preparing for pin + publish...');
    
    // Save transaction state for recovery if refresh happens
    saveTxState(TX_STATE.AWAITING_SIGNATURE, { draftId: draftInfo?.id });

    try {
      const acct = account || await connectWallet();
      if (!acct) {
        addToast('Please connect a wallet before signing/publishing', { type: 'error' });
        clearTxState();
        setBusy(false);
        return;
      }

      const chosenChainId = network || DEFAULT_CHAIN_ID;
      const cfg = NETWORK_CONFIG[chosenChainId] || {};
      const verifyingContract = cfg.attestationRegistry || CONTRACT_ADDRESS;

      const typedData = buildAttestationTypedData({
        chainId: chosenChainId,
        verifyingContract,
        subject: acct,
        schemaHash: schema,
        dataCID: dataCID,
        expiresAt: expiresAt,
      });

      setStatus('Requesting signature...');
      saveTxState(TX_STATE.SIGNING, { draftId: draftInfo?.id });
      
      const signature = await signAttestationTypedData(typedData, selectedWallet.provider);

      setStatus('Publishing on-chain...');
      saveTxState(TX_STATE.PUBLISHING, { draftId: draftInfo?.id, account: acct });
      
      const normalizedCID = normalizeCid(dataCID);
      const payload = {
        issuer: acct,
        subject: typedData.value.subject,
        schemaHash: typedData.value.schemaHash,
        dataCID: normalizedCID,
        expiresAt: typedData.value.expiresAt,
        signature,
        chainId: typedData.domain.chainId,
        contractAddress: typedData.domain.verifyingContract,
      };

      const contractAddr = contractAddress || cfg.attestationRegistry;
      const { pinResp, tx } = await pinAndPublish(contractAddr, payload);
      
      setPin(pinResp.pin);
      setCallPayload(pinResp.call_payload);

      if (tx) {
        // Save pending transaction for recovery tracking
        savePendingTx(tx.hash, { draftId: draftInfo?.id, account: acct, chainId: chosenChainId });
        
        setStatus(`Transaction sent: ${tx.hash}`);
        addToast('📡 Transaction sent', { type: 'info' });
        await tx.wait?.();
        
        // Clear pending tx on confirmation
        clearPendingTx();
        setStatus(`Transaction confirmed: ${tx.hash}`);
        addToast('✅ Transaction confirmed', { type: 'success' });
        clearTxState();
      } else {
        setStatus('Pinned successfully (no on-chain publish)');
        clearTxState();
      }
    } catch (error) {
      const errorMsg = error?.message || String(error);
      setStatus(`Error: ${errorMsg}`);
      console.error('Sign, pin and publish failed:', error);
      addToast(`❌ Error: ${errorMsg}`, { type: 'error' });
      saveTxState(TX_STATE.FAILED, { error: errorMsg, draftId: draftInfo?.id });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitOnChain = async () => {
    if (!callPayload) {
      addToast('No call payload available. Create/pin first.', { type: 'error' });
      return;
    }
    if (!contractAddress) {
      addToast('Please enter an AttestationRegistry address', { type: 'error' });
      return;
    }

    setBusy(true);
    setStatus('Submitting on-chain...');

    try {
      await publishAttestationOnChain(contractAddress, callPayload);
      setStatus('Submitted on-chain');
      addToast('✅ Submitted on-chain', { type: 'success' });
    } catch (error) {
      const errorMsg = error?.message || String(error);
      setStatus(`On-chain error: ${errorMsg}`);
      addToast(`❌ On-chain error: ${errorMsg}`, { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const analyzeCreditworthiness = async () => {
    if (!draftInfo && !account) {
      addToast('No attestation or account data available to analyze', { type: 'error' });
      return;
    }

    setAnalyzingCredit(true);
    setStatus('Analyzing credit...');
    try {
      // Build a payload for the backend credit assessor. Use available attestation draft,
      // bank metadata (if present on the draft) and a small on-chain summary when possible.
      const bank_meta = draftInfo?.plaid_meta || draftInfo?.bank_meta || {};
      const onchain = {};
      try {
        if (account) {
          const bal = await getBalance(account);
          onchain.balance = bal;
        }
      } catch (e) {
        // non-fatal: proceed without on-chain details if provider not available
      }

      const payload = { draft: draftInfo || {}, bank_meta: bank_meta || {}, onchain };

      // Call the server-side assessor for a consistent score and offers
      const result = await assessCredit(payload);
      const score = result?.score ?? null;
      const offers = result?.offers ?? null;

      if (score !== null) setCreditScore(score);
      if (offers && Array.isArray(offers)) setEligibleLoans(offers);
      else if (score !== null) {
        // Fallback: generate client-side offers from the score
        const clientOffers = await generateLendingTerms(score);
        setEligibleLoans(clientOffers);
      }

      addToast('📊 Credit analysis complete', { type: 'success' });
      setStatus('Credit analysis complete');
    } catch (error) {
      console.error('Credit analysis failed', error);
      addToast('❌ Credit analysis failed', { type: 'error' });
      setStatus(`Credit analysis error: ${error?.message || String(error)}`);
    } finally {
      setAnalyzingCredit(false);
    }
  };

  const takeLoan = async (loan) => {
    addToast(`🚀 Borrow flow for $${loan.amount} is not implemented in this demo.`, { type: 'info' });
  };

  const expectedCfg = NETWORK_CONFIG[DEFAULT_CHAIN_ID] || {};
  const expectedChainHex = expectedCfg.chainIdHex;
  const expectedName = expectedCfg.name || `Chain ${DEFAULT_CHAIN_ID}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-8 px-4">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-r from-teal-400/10 to-blue-500/10 rounded-full blur-3xl" />

      <div className="relative max-w-6xl mx-auto">
        <NetworkBanner 
          expectedChainHex={expectedChainHex} 
          expectedName={expectedName} 
          addToast={addToast} 
          provider={selectedWallet?.provider} 
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Header */}
            <div className="bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold text-white mb-2">
                    📝 Create Attestation
                  </h1>
                  <p className="text-gray-300 text-lg">
                    Sign verifiable claims, pin to IPFS, and optionally publish on-chain
                  </p>
                </div>
                <div className="hidden lg:block">
                  <HeroGraphic />
                </div>
              </div>
            </div>

            {/* Wallet Status (Read-only) */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span>🔗</span>
                Connected Wallet
              </h2>
              
              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                {selectedWallet?.icon && (
                  <img src={selectedWallet.icon} alt="" className="w-10 h-10 rounded" />
                )}
                <div className="flex-1">
                  <div className="text-white font-semibold mb-1">
                    {selectedWallet?.name || 'Loading...'}
                  </div>
                  <div className="font-mono text-gray-300 text-sm">
                    {account ? `${account.slice(0, 10)}...${account.slice(-8)}` : 'Connecting...'}
                  </div>
                </div>
                <a
                  href="/connect"
                  className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20 transition-colors"
                >
                  Change Wallet
                </a>
              </div>
              
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-blue-200 text-sm">
                  <span>💡</span>
                  <span>Wallet connected from previous step. Ready to sign!</span>
                </div>
              </div>
            </div>

            {/* Attestation Form */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <span>📄</span>
                Attestation Details
              </h2>

              {/* Guidance for users without draft */}
              {!draftInfo && (
                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-1">💡</span>
                    <div>
                      <div className="font-semibold text-blue-200 mb-2">No bank data linked yet?</div>
                      <div className="text-blue-100 text-sm mb-3">
                        Go back to ConnectPlaid to link your bank account. Your data will automatically appear here.
                      </div>
                      <a 
                        href="/connect"
                        className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors text-sm"
                      >
                        ← Back to ConnectPlaid
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Only show schema if it's NOT from a draft, or if user wants to override */}
                {!draftInfo?.schema_hash && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                      <span>🏷️</span>
                      Schema Type
                      <span className="text-gray-500 text-xs">(optional)</span>
                    </label>
                    <input 
                      value={schema} 
                      onChange={e => setSchema(e.target.value)} 
                      className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:border-indigo-400 transition-colors"
                      placeholder="income-proof-v1"
                    />
                    <div className="text-gray-400 text-xs mt-2">
                      Describes the type of data being attested (e.g., income verification, credit score)
                    </div>
                  </div>
                )}

                {/* Show schema from draft if available */}
                {draftInfo?.schema_hash && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                      <span>🏷️</span>
                      Schema Type
                      <span className="text-green-400 text-xs">✓ From bank data</span>
                    </label>
                    <div className="p-4 bg-white/5 border border-green-500/30 rounded-xl text-gray-300 text-sm font-mono">
                      {draftInfo.schema_hash.slice(0, 20)}...
                    </div>
                    <div className="text-gray-400 text-xs mt-2">
                      Automatically set from your connected bank account
                    </div>
                  </div>
                )}

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                    <span>⏰</span>
                    Valid Until
                  </label>
                  <input 
                    type="datetime-local" 
                    value={new Date(expiresAt * 1000).toISOString().slice(0, 16)} 
                    onChange={e => setExpiresAt(Math.floor(new Date(e.target.value).getTime() / 1000))} 
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white focus:border-indigo-400 transition-colors"
                  />
                  <div className="text-gray-400 text-xs mt-2">
                    When this attestation expires (default: 1 hour from now)
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                    <span>🌐</span>
                    Data Storage (IPFS)
                    {draftInfo?.data_cid && <span className="text-green-400 text-xs">✓ Ready</span>}
                  </label>
                  
                  {draftInfo?.data_cid ? (
                    <div className="p-4 bg-white/5 border border-green-500/30 rounded-xl">
                      <div className="text-gray-300 text-sm font-mono break-all mb-2">
                        {draftInfo.data_cid}
                      </div>
                      <div className="text-gray-400 text-xs">
                        Your verified bank data is securely stored and ready to be signed
                      </div>
                      <button
                        onClick={() => window.open(`https://ipfs.io/ipfs/${draftInfo.data_cid.replace('ipfs://', '')}`, '_blank')}
                        className="mt-3 text-blue-400 hover:text-blue-300 text-xs font-medium"
                      >
                        View data on IPFS →
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input 
                        value={dataCID} 
                        onChange={e => { 
                          const value = e.target.value;
                          setDataCID(value);
                          const isValid = isValidCID(value);
                          setCidValid(isValid);
                          setCidError(isValid ? '' : 'Invalid IPFS CID format');
                        }} 
                        className={`w-full p-4 border rounded-xl text-white placeholder-gray-400 focus:border-indigo-400 transition-colors ${
                          cidValid 
                            ? 'bg-white/5 border-white/10' 
                            : dataCID ? 'bg-red-500/10 border-red-500/50' : 'bg-white/5 border-white/10'
                        }`}
                        placeholder="ipfs://Qm... or bafy..."
                      />
                      {!cidValid && dataCID && (
                        <div className="text-red-400 text-sm mt-2 flex items-center gap-2">
                          <span>⚠️</span>
                          Invalid IPFS CID format
                        </div>
                      )}
                      <div className="text-gray-400 text-xs mt-2">
                        Paste the IPFS hash of your data. <button onClick={() => setShowProviderPicker(true)} className="text-blue-400 hover:text-blue-300">Connect your bank →</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                <button 
                  onClick={handleSignAndPin}
                  disabled={busy || !dataCID || !cidValid || !selectedWallet}
                  className="p-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold disabled:opacity-50 hover:shadow-lg transition-all flex items-center justify-center gap-3"
                  title={!dataCID ? 'Enter or auto-populate data CID first' : ''}
                >
                  {busy ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>📌</span>
                  )}
                  Sign & Pin to IPFS
                </button>
                
                <button 
                  onClick={handleSignPinAndPublish}
                  disabled={busy || !dataCID || !cidValid || !selectedWallet}
                  className="p-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-semibold disabled:opacity-50 hover:shadow-lg transition-all flex items-center justify-center gap-3"
                  title={!dataCID ? 'Enter or auto-populate data CID first' : ''}
                >
                  {busy ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>⛓️</span>
                  )}
                  Sign, Pin & Publish
                </button>
              </div>

              {draftInfo && String(draftInfo.issuer).toLowerCase() === 'anon' && !identityBound && (
                <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🔐</span>
                    <div className="flex-1">
                      <div className="font-semibold text-yellow-200">Anonymous Draft</div>
                      <div className="text-yellow-100 text-sm mt-1">
                        Bind your wallet to claim and complete this attestation
                      </div>
                    </div>
                    <button 
                      onClick={bindIdentity}
                      className="px-4 py-2 bg-yellow-500 text-black rounded-lg font-medium hover:bg-yellow-400 transition-colors"
                    >
                      Bind Wallet
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Credit Assessment */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <span>💳</span>
                Credit Assessment
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="flex items-center gap-4 mb-6">
                    <button
                      onClick={analyzeCreditworthiness}
                      disabled={analyzingCredit}
                      className="px-6 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold disabled:opacity-50 hover:shadow-lg transition-all flex items-center gap-3"
                    >
                      {analyzingCredit ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>📊</span>
                      )}
                      Analyze Credit Score
                    </button>
                    
                    {creditScore && (
                      <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                        <span className="text-2xl">⭐</span>
                        <div>
                          <div className="text-white font-semibold">{creditScore}/850</div>
                          <div className="text-gray-400 text-sm">Credit Score</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {eligibleLoans.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">🚀 Eligible Loan Offers</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {eligibleLoans.map(loan => (
                          <LoanCard key={loan.id} loan={loan} onBorrow={takeLoan} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <FeatureCard
                    icon="🔍"
                    title="Instant Analysis"
                    description="Get your credit score and loan eligibility in seconds"
                    gradient="from-blue-500/10 to-cyan-500/10"
                  />
                  <FeatureCard
                    icon="🛡️"
                    title="Secure & Private"
                    description="Your data remains encrypted and private"
                    gradient="from-green-500/10 to-emerald-500/10"
                  />
                  <FeatureCard
                    icon="⚡"
                    title="Fast Funding"
                    description="Get approved and funded within 24 hours"
                    gradient="from-purple-500/10 to-pink-500/10"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Panel */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>📈</span>
                Status
              </h3>
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="text-sm text-gray-400 mb-1">Current Status</div>
                <div className="text-white font-medium">{status || 'Ready to start'}</div>
              </div>

              {pin && (
                <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <div className="text-sm text-green-400 mb-2">📌 IPFS Pin Created</div>
                  <div className="text-xs text-green-300 break-all font-mono">{pin}</div>
                  <div className="flex gap-2 mt-3">
                    <button 
                      onClick={() => navigator.clipboard?.writeText(pin)}
                      className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors"
                    >
                      Copy
                    </button>
                    <a 
                      href={pin} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-2 bg-white/10 text-white rounded-lg text-sm text-center hover:bg-white/20 transition-colors"
                    >
                      Open
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* On-chain Actions */}
            {callPayload && (
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span>⛓️</span>
                  On-chain Actions
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Contract Address</label>
                    <input 
                      value={contractAddress || ''} 
                      onChange={e => setContractAddress(e.target.value)} 
                      placeholder="0x..." 
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    />
                  </div>
                  
                  <button 
                    onClick={handleSubmitOnChain}
                    disabled={!contractAddress}
                    className="w-full p-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-medium disabled:opacity-50 hover:shadow-lg transition-all"
                  >
                    🚀 Submit On-chain
                  </button>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>⚡</span>
                Quick Actions
              </h3>
              <div className="space-y-3">
                <a 
                  href="/connect"
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
                >
                  <span className="text-xl">🏦</span>
                  <div>
                    <div className="text-white font-medium">Connect Bank</div>
                    <div className="text-gray-400 text-sm">Link accounts for credit analysis</div>
                  </div>
                </a>
                <a 
                  href="/guide"
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
                >
                  <span className="text-xl">📚</span>
                  <div>
                    <div className="text-white font-medium">View Guide</div>
                    <div className="text-gray-400 text-sm">Learn how to use RealMint</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}