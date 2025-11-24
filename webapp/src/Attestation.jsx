import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NETWORK_CONFIG, DEFAULT_CHAIN_ID } from './config';
import { getSelectedFlow, setSelectedFlow } from './flowGate';
import HeroGraphic from './components/HeroGraphic';
import NetworkBanner from './components/NetworkBanner';
// ConfigWarning removed: not used in this component
import ProviderPicker from './components/ProviderPicker';
import WalletConnectModal from './components/WalletConnectModal';
import { createWalletConnectSession } from './utils/providerDetect';
import { useToast } from './components/Toast';
import { buildAttestationTypedData, signAttestationTypedData } from './utils/eip712';
import { 
  listAvailableProviders, 
  selectBestProvider, 
  connectWallet as modernConnectWallet,
  switchNetwork,
  setupProviderListeners 
} from './utils/providerDetect';
import { persistPreferredProvider, loadPreferredProvider, preloadWalletConnect } from './utils/providerDetect';
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
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [wcModalOpen, setWcModalOpen] = useState(false);
  const [wcUri, setWcUri] = useState(null);
  const [wcProvider, setWcProvider] = useState(null);
  const [wcStatus, setWcStatus] = useState('pending');
  const wcTimeoutRef = useRef(null);

  const clearWcTimeout = () => { if (wcTimeoutRef.current) { clearTimeout(wcTimeoutRef.current); wcTimeoutRef.current = null; } };

  // Modern wallet detection
  useEffect(() => {
    const wallets = listAvailableProviders() || [];
    setAvailableWallets(wallets);

    if (wallets.length > 1 && !selectedWallet) {
      setTimeout(() => setShowProviderPicker(true), 250);
    }

    // restore persisted selection if present
    try {
      const persisted = loadPreferredProvider();
      if (persisted) {
        const found = wallets.find(w => w.id === persisted.id || w.name === persisted.name);
        if (found) {
          setSelectedWallet(found);
          return;
        }
      }
    } catch (e) {}

    if (wallets.length > 0) {
      selectBestProvider().then(wallet => {
        if (!wallet) return setSelectedWallet(wallets[0]);
        const found = wallets.find(w => w.id === wallet.id || w.name === wallet.name);
        setSelectedWallet(found || wallets[0]);
      }).catch(() => { 
        if (wallets.length) setSelectedWallet(wallets[0]); 
      });
    }
  }, []);

  const handleSelectWallet = (wallet) => {
    setSelectedWallet(wallet);
    try { persistPreferredProvider(wallet); } catch (e) {}
    try { if (wallet?.id === 'walletconnect') preloadWalletConnect(); } catch (e) {}
  };

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

  // Draft autostart/prefill
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const draftId = params.get('draft_id');
    const autostart = params.get('autostart');
    
    if (!draftId) return;

    const fetchDraft = async () => {
      try {
        const draft = await apiClient.apiGet(`/api/attestations/${draftId}`).catch(() => null);
        if (!draft) return;
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
      const wallets = listAvailableProviders() || [];
      if (wallets.length === 0) {
        addToast('No wallets detected. Please install an EVM wallet (MetaMask, Coinbase Wallet, etc.)', { type: 'error' });
        return null;
      }
      const best = await selectBestProvider().catch(() => null);
      const chosen = best ? (wallets.find(w => w.id === best.id || w.name === best.name) || wallets[0]) : wallets[0];
      setSelectedWallet(chosen);
    }

    // If the chosen wallet is SDK-only (no provider instance), guide the user
    if (!selectedWallet.provider) {
      if (selectedWallet.installLink) {
        try { window.open(selectedWallet.installLink, '_blank'); } catch (e) {}
        addToast('🔗 Opening wallet install page', { type: 'info' });
      } else {
        addToast('🔍 Selected wallet has no direct provider. Please select an injected wallet or use WalletConnect.', { type: 'error' });
        setShowProviderPicker(true);
      }
      return null;
    }

    // Special handling for WalletConnect: create a session and show an in-app QR modal
    if (selectedWallet.id === 'walletconnect') {
      try {
        setWcStatus('pending');
        const { provider, uri } = await createWalletConnectSession(DEFAULT_CHAIN_ID || 1);
        setWcProvider(provider);
        setWcUri(uri);
        setWcModalOpen(true);

        const connector = provider.connector;
        const onConnect = async (error, payload) => {
          if (error) {
            console.error('WalletConnect connect error', error);
            setWcStatus('failed');
            return;
          }
          try {
            const enabled = await provider.enable();
            const acct = enabled && enabled[0];
            setAccount(acct || null);
            // attach provider so later signing uses selectedWallet.provider
            setSelectedWallet(prev => ({ ...(prev || {}), provider }));
            setWcProvider(provider);
            const chain = provider.chainId || DEFAULT_CHAIN_ID;
            setNetwork(chain);
            setWcStatus('connected');
            addToast('Wallet connected successfully', { type: 'success' });
          } catch (err) {
            console.error('enable after connect failed', err);
            setWcStatus('failed');
            addToast('Failed to enable wallet after connect', { type: 'error' });
          } finally {
            if (connector && connector.off) connector.off('connect', onConnect);
            setTimeout(() => setWcModalOpen(false), 600);
          }
        };

        const onDisconnect = (err) => { console.debug('wc disconnect', err); setWcStatus('failed'); setWcModalOpen(false); };
        if (connector && connector.on) {
          connector.on('connect', onConnect);
          connector.on('disconnect', onDisconnect);
          connector.on('error', (err) => { console.debug('wc error', err); setWcStatus('failed'); });
        }

        // safety timeout
        wcTimeoutRef.current = setTimeout(() => {
          if (wcStatus === 'pending') {
            try { if (connector && typeof connector.killSession === 'function') connector.killSession(); } catch (e) {}
            setWcStatus('failed');
            setWcModalOpen(false);
            addToast('❌ WalletConnect timeout, please try again', { type: 'error' });
          }
        }, 2 * 60 * 1000);

        return null;
      } catch (e) {
        console.error('WalletConnect session creation failed', e);
        setWcStatus('failed');
        addToast('WalletConnect session failed', { type: 'error' });
        return null;
      }
    }

    try {
      const connection = await modernConnectWallet(selectedWallet.provider);

      const expectedChain = NETWORK_CONFIG[DEFAULT_CHAIN_ID];
      if (expectedChain && connection.chainId !== expectedChain.chainId) {
        try {
          await switchNetwork(selectedWallet.provider, expectedChain.chainId);
        } catch (e) {
          addToast('Unable to auto-switch network. Please switch your wallet network manually.', { type: 'warning' });
        }
      }

      setAccount(connection.accounts[0]);
      setNetwork(connection.chainId);
      addToast('Wallet connected successfully', { type: 'success' });

      return connection.accounts[0];
    } catch (error) {
      console.error('Wallet connection failed:', error);
      addToast(error?.message || 'Wallet connection failed', { type: 'error' });
      return null;
    }
  };

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

    try {
      const acct = account || await connectWallet();
      if (!acct) {
        addToast('Please connect a wallet before signing', { type: 'error' });
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
    } catch (error) {
      const errorMsg = error?.message || String(error);
      setStatus(`Error: ${errorMsg}`);
      console.error('Sign and pin failed:', error);
      addToast(`❌ Error: ${errorMsg}`, { type: 'error' });
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

    try {
      const acct = account || await connectWallet();
      if (!acct) {
        addToast('Please connect a wallet before signing/publishing', { type: 'error' });
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
      const signature = await signAttestationTypedData(typedData, selectedWallet.provider);

      setStatus('Publishing on-chain...');
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
        setStatus(`Transaction sent: ${tx.hash}`);
        addToast('📡 Transaction sent', { type: 'info' });
        await tx.wait?.();
        setStatus(`Transaction confirmed: ${tx.hash}`);
        addToast('✅ Transaction confirmed', { type: 'success' });
      } else {
        setStatus('Pinned successfully (no on-chain publish)');
      }
    } catch (error) {
      const errorMsg = error?.message || String(error);
      setStatus(`Error: ${errorMsg}`);
      console.error('Sign, pin and publish failed:', error);
      addToast(`❌ Error: ${errorMsg}`, { type: 'error' });
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

            {/* Wallet Selection */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span>🔗</span>
                Wallet Connection
              </h2>
              
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
                  >
                    <div className="flex items-center gap-3">
                      {wallet.icon && (
                        <img src={wallet.icon} alt="" className="w-6 h-6 rounded" />
                      )}
                      <span className="font-medium text-sm">{wallet.name}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Mobile compact summary + chooser */}
              <div className="md:hidden mb-4">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                      {selectedWallet?.icon ? (
                        <img src={selectedWallet.icon} alt="" className="w-6 h-6" />
                      ) : (
                        <span>🔗</span>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-gray-300">{selectedWallet?.name || 'No wallet selected'}</div>
                      <div className="text-xs text-gray-400">{selectedWallet?.type || ''}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowProviderPicker(true)}
                    className="px-3 py-2 bg-white/10 text-white rounded-lg text-sm"
                  >
                    Choose wallet…
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex-1">
                  <div className="text-sm text-gray-400 mb-1">Connected Address</div>
                  <div className="font-mono text-white text-sm">
                    {account ? `${account.slice(0, 8)}...${account.slice(-6)}` : 'Not connected'}
                  </div>
                </div>
                <button
                  onClick={connectWallet}
                  disabled={!selectedWallet}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium disabled:opacity-50 hover:shadow-lg transition-all"
                >
                  {account ? '🔄 Reconnect' : '🔗 Connect'}
                </button>
              </div>
            </div>

            {/* Attestation Form */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <span>📄</span>
                Attestation Details
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    🏷️ Schema
                  </label>
                  <input 
                    value={schema} 
                    onChange={e => setSchema(e.target.value)} 
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:border-indigo-400 transition-colors"
                    placeholder="income-proof-v1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    ⏰ Expires At
                  </label>
                  <input 
                    type="datetime-local" 
                    value={new Date(expiresAt * 1000).toISOString().slice(0, 16)} 
                    onChange={e => setExpiresAt(Math.floor(new Date(e.target.value).getTime() / 1000))} 
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white focus:border-indigo-400 transition-colors"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    🌐 Data CID (IPFS)
                  </label>
                  <input 
                    value={dataCID} 
                    onChange={e => { 
                      const value = e.target.value;
                      setDataCID(value);
                      const isValid = isValidCID(value);
                      setCidValid(isValid);
                      setCidError(isValid ? '' : 'Invalid IPFS CID');
                    }} 
                    className={`w-full p-4 border rounded-xl text-white placeholder-gray-400 focus:border-indigo-400 transition-colors ${
                      cidValid 
                        ? 'bg-white/5 border-white/10' 
                        : 'bg-red-500/10 border-red-500/50'
                    }`}
                    placeholder="ipfs://bafy..."
                  />
                  {!cidValid && dataCID && (
                    <div className="text-red-400 text-sm mt-2 flex items-center gap-2">
                      <span>⚠️</span>
                      {cidError || 'Invalid IPFS CID format'}
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

      <ProviderPicker
        visible={showProviderPicker}
        wallets={availableWallets}
        onSelect={(w) => { setSelectedWallet(w); setShowProviderPicker(false); }}
        onClose={() => setShowProviderPicker(false)}
      />
      <WalletConnectModal
        open={wcModalOpen}
        uri={wcUri}
        provider={wcProvider}
        onClose={() => {
          try { clearWcTimeout(); } catch (e) {}
          // attempt to cleanup unconnected session
          try {
            if (wcProvider) {
              const conn = wcProvider.connector;
              if (conn && typeof conn.killSession === 'function') conn.killSession();
              else if (typeof wcProvider.disconnect === 'function') wcProvider.disconnect();
            }
          } catch (e) { console.debug('wc cleanup failed', e); }
          setWcModalOpen(false);
          setWcUri(null);
          setWcProvider(null);
        }}
        onCancel={() => {
          try { clearWcTimeout(); } catch (e) {}
          try {
            if (wcProvider) {
              const conn = wcProvider.connector;
              if (conn && typeof conn.killSession === 'function') conn.killSession();
              else if (typeof wcProvider.disconnect === 'function') wcProvider.disconnect();
            }
          } catch (e) { console.debug('wc cleanup failed', e); }
          setWcModalOpen(false);
          setWcUri(null);
          setWcProvider(null);
        }}
        status={wcStatus}
      />
    </div>
  );
}