import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import { 
  getBalance, 
  payListingFee, 
  DEFAULT_LISTING_FEE, 
  fetchProjects as fetchProjectsApi, 
  submitProjectForm, 
  getAuthoritativeFeeRecipient, 
  PAYMENT_ADDRESS, 
  CONTRACT_ADDRESS 
} from "./utils/web3";
import ConfigWarning from './components/ConfigWarning';
import { 
  listAvailableProviders, 
  selectBestProvider, 
  connectWallet as modernConnectWallet,
  switchNetwork,
  preloadWalletConnect
} from './utils/providerDetect';
import { persistPreferredProvider, loadPreferredProvider } from './utils/providerDetect';
import { API_BASE, NETWORK_CONFIG, DEFAULT_CHAIN_ID } from './config';
import NetworkBanner from './components/NetworkBanner';
import HeroGraphic from './components/HeroGraphic';
import Footer from './components/Footer';
import ProviderPicker from './components/ProviderPicker';
// WalletConnect is handled by Web3Modal v2
import { createWalletConnectSession } from './utils/providerDetect';
import { getSelectedFlow, setSelectedFlow } from './flowGate';
import {
  TX_STATE,
  saveTxState,
  getTxState,
  clearTxState,
  savePendingTx,
  getPendingTx,
  clearPendingTx,
  getPublishingRecoveryContext
} from './utils/txStateManager';

function StatCard({ icon, title, value, description, color }) {
  const colorClasses = {
    blue: 'from-blue-500/10 to-blue-600/10 border-blue-500/20',
    green: 'from-green-500/10 to-green-600/10 border-green-500/20', 
    purple: 'from-purple-500/10 to-purple-600/10 border-purple-500/20',
    orange: 'from-orange-500/10 to-orange-600/10 border-orange-500/20'
  };

  return (
    <div className={`p-6 rounded-2xl bg-gradient-to-br ${colorClasses[color]} border backdrop-blur-sm`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-2xl">{icon}</div>
        <div className="text-2xl font-bold text-white">{value}</div>
      </div>
      <div className="text-white font-semibold mb-1">{title}</div>
      <div className="text-gray-300 text-sm">{description}</div>
    </div>
  );
}

function ProjectCard({ project, apiBase }) {
  const statusColors = {
    pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    approved: 'bg-green-500/20 text-green-300 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-300 border-red-500/30'
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-2">{project.project_name}</h3>
          <p className="text-gray-300 text-sm line-clamp-2 mb-3">{project.description}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[project.status] || statusColors.pending}`}>
          {project.status || "pending"}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm text-gray-400 mb-4">
        <div className="flex items-center gap-2">
          <span>📅</span>
          <span>{project.launch_date || 'TBD'}</span>
        </div>
        {project.whitepaper_filename && (
          <div className="flex items-center gap-2">
            <span>📄</span>
            <a
              href={`${apiBase}/uploads/${project.whitepaper_filename}`}
              className="text-blue-300 hover:text-blue-200 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Whitepaper
            </a>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button className="flex-1 px-3 py-2 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors">
          ✅ Approve
        </button>
        <button className="flex-1 px-3 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors">
          ❌ Reject
        </button>
      </div>
    </div>
  );
}

export default function Launchpad() {
  const navigate = useNavigate();
  const ENABLE_LAUNCHPAD = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ENABLE_LAUNCHPAD) !== 'false';

  // State
  const [projectName, setProjectName] = useState('');
  const [contractLink, setContractLink] = useState('');
  const [launchDate, setLaunchDate] = useState('2025-12-01T00:00:00');
  const [description, setDescription] = useState('');
  const [whitepaper, setWhitepaper] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);
  const [paymentMade, setPaymentMade] = useState(false);
  const [balance, setBalance] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyFeatured, setOnlyFeatured] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [authRecipient, setAuthRecipient] = useState(null);
  const [availableWallets, setAvailableWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [showProviderPicker, setShowProviderPicker] = useState(false);

  // Redirect if launchpad disabled
  useEffect(() => {
    if (!ENABLE_LAUNCHPAD) {
      navigate('/');
    }
  }, [ENABLE_LAUNCHPAD, navigate]);

  // Set flow and detect wallets
  useEffect(() => {
    setSelectedFlow('launchpad');
    
    const wallets = listAvailableProviders() || [];
    setAvailableWallets(wallets);
    if (wallets.length > 1 && !selectedWallet) {
      setTimeout(() => setShowProviderPicker(true), 250);
    }

    // try to restore persisted selection
    try {
      const persisted = loadPreferredProvider();
      if (persisted) {
        const found = wallets.find(w => w.id === persisted.id || w.name === persisted.name);
        if (found) {
          setSelectedWallet(found);
        }
      }
    } catch (e) {}

    if (wallets.length > 0) {
      selectBestProvider().then(wallet => {
        if (!wallet) return setSelectedWallet(wallets[0]);
        const found = wallets.find(w => w.id === wallet.id || w.name === wallet.name);
        setSelectedWallet(found || wallets[0]);
      }).catch(() => { if (wallets.length) setSelectedWallet(wallets[0]); });
    }
  }, []);

  const handleSelectWallet = (wallet) => {
    setSelectedWallet(wallet);
    try { persistPreferredProvider(wallet); } catch (e) {}
    try { if (wallet?.id === 'walletconnect') preloadWalletConnect(); } catch (e) {}
  };

  // Check flow selection
  useEffect(() => {
    try {
      const sel = getSelectedFlow();
      if (sel === 'attestation') {
        navigate('/');
      }
    } catch (e) {}
  }, [navigate]);

  // Recovery from refresh during payment
  useEffect(() => {
    const publishingRecovery = getPublishingRecoveryContext();
    
    if (publishingRecovery) {
      console.debug('[Recovery] Resuming from payment state', publishingRecovery);
      addToast('⏳ Checking payment status...', 'info');
      
      // Poll for transaction receipt
      (async () => {
        try {
          const receipt = await fetch(
            `https://etherscan.io/api?module=transaction&action=gettxreceiptstatus&txhash=${publishingRecovery.txHash}&apikey=YourApiKeyToken`,
            { method: 'GET' }
          ).then(r => r.json()).catch(() => null);
          
          if (receipt && receipt.result && receipt.result.status === '1') {
            clearPendingTx();
            addToast('✅ Payment confirmed!', 'success');
            setPaymentMade(true);
          } else {
            addToast('⏳ Still waiting for payment confirmation...', 'info');
          }
        } catch (e) {
          console.debug('Receipt check failed:', e);
          addToast('⚠️ Could not verify payment status. Check etherscan.', 'warning');
        }
      })();
    }
  }, []);

  // Load projects and auth recipient
  useEffect(() => {
    let mounted = true;
    
    setLoadingProjects(true);
    fetchProjectsApi()
      .then(list => {
        if (mounted) setProjects(list || []);
      })
      .catch(err => {
        console.error('Failed to fetch projects:', err);
        addToast('Could not load projects', 'error');
      })
      .finally(() => {
        if (mounted) setLoadingProjects(false);
      });

    (async () => {
      try {
        const recipient = await getAuthoritativeFeeRecipient();
        if (mounted) setAuthRecipient(recipient);
      } catch (e) {
        console.warn('Failed to fetch fee recipient:', e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const connectWallet = async () => {
    if (!selectedWallet) {
      const wallets = listAvailableProviders() || [];
      if (wallets.length === 0) {
        addToast('No wallets detected. Please install an EVM wallet (MetaMask, Coinbase Wallet, etc.)', 'error');
        return;
      }
      const best = await selectBestProvider().catch(() => null);
      const chosen = best ? (wallets.find(w => w.id === best.id || w.name === best.name) || wallets[0]) : wallets[0];
      setSelectedWallet(chosen);
    }

    // If the chosen wallet has no injected provider (SDK/install link only), handle gracefully
    if (!selectedWallet.provider) {
      if (selectedWallet.installLink) {
        try { window.open(selectedWallet.installLink, '_blank'); } catch (e) {}
        addToast('🔗 Opening wallet install page', 'info');
      } else {
        addToast('🔍 Selected wallet has no direct provider. Please select a different wallet or use WalletConnect.', 'error');
        setShowProviderPicker(true);
      }
      return;
    }
    // WalletConnect: create session + show modal
    if (selectedWallet.id === 'walletconnect') {
      try {
        // Web3Modal v2 handles connection internally
        
        // Web3Modal v2 opens its own modal and handles the connection flow
        try {
          const result = await createWalletConnectSession(DEFAULT_CHAIN_ID || 1);
          
          // result from Web3Modal v2 is { provider, address, chainId }
          const { provider, address, chainId } = result;
          
          setWalletAddress(address || '');
          setWalletConnected(Boolean(address));
          setSelectedWallet(prev => ({ ...(prev || {}), provider }));
          
          try { 
            const bal = await getBalance(address); 
            setBalance(bal); 
          } catch (e) { /* ignore */ }
          addToast('🎉 Wallet connected successfully', 'success');
        } catch (err) {
          addToast('❌ WalletConnect connection failed', 'error');
        }
        
        return;
      } catch (e) {
        console.error('WalletConnect session failed', e);
        addToast('❌ WalletConnect session failed', 'error');
        return;
      }
    }

    try {
      const connection = await modernConnectWallet(selectedWallet.provider);

      const expectedChain = NETWORK_CONFIG[DEFAULT_CHAIN_ID];
      let networkSwitched = false;
      
      if (expectedChain && connection.chainId !== expectedChain.chainId) {
        try {
          await switchNetwork(selectedWallet.provider, expectedChain.chainId);
          networkSwitched = true;
          addToast(`✅ Switched to ${expectedChain.name}`, 'success');
        } catch (switchError) {
          console.warn('Network switch failed:', switchError);
          const wrongNetwork = NETWORK_CONFIG[connection.chainId];
          const wrongNetworkName = wrongNetwork?.name || `Chain ${connection.chainId}`;
          addToast(
            `⚠️ Connected to ${wrongNetworkName}. Please switch to ${expectedChain.name} manually in your wallet.`,
            'warning'
          );
          // Still set wallet so user can manually switch
          setWalletAddress(connection.accounts[0]);
          setWalletConnected(true);
          
          try {
            const bal = await getBalance(connection.accounts[0]);
            setBalance(bal);
          } catch (e) {
            console.debug('Balance check failed:', e);
          }
          return connection.accounts[0];
        }
      }

      setWalletAddress(connection.accounts[0]);
      setWalletConnected(true);

      try {
        const bal = await getBalance(connection.accounts[0]);
        setBalance(bal);
      } catch (e) {
        console.debug('Balance check failed:', e);
      }

      // Only show success if on correct network or successfully switched
      if (!expectedChain || connection.chainId === expectedChain.chainId || networkSwitched) {
        addToast('🎉 Wallet connected successfully', 'success');
      }
    } catch (error) {
      console.error('Wallet connection failed:', error);
      const message = error?.message || String(error);

      if (/user rejected/i.test(message) || /user denied/i.test(message)) {
        addToast('❌ Connection canceled by user', 'info');
      } else if (/Failed to fetch/i.test(message)) {
        addToast('🌐 Network error - check your connection', 'error');
      } else {
        addToast(`❌ ${message || 'Wallet connection failed'}`, 'error');
      }
    }
  };

  const handlePayment = async () => {
    try {
      if (!walletAddress) await connectWallet();
      
      addToast(`💳 Processing payment of ${DEFAULT_LISTING_FEE}...`, 'info');
      
      // Save transaction state for recovery on refresh
      saveTxState(TX_STATE.PUBLISHING, {
        operation: 'payment',
        amount: DEFAULT_LISTING_FEE,
        account: walletAddress
      });
      
      const tx = await payListingFee(DEFAULT_LISTING_FEE);
      addToast(`📡 Transaction sent: ${tx.hash}`, 'info');
      
      // Save pending transaction for monitoring
      savePendingTx(tx.hash, { operation: 'payment', amount: DEFAULT_LISTING_FEE });
      
      await tx.wait();
      
      // Clear pending tx on confirmation
      clearPendingTx();
      setPaymentMade(true);
      clearTxState();
      addToast('✅ Payment confirmed', 'success');
    } catch (error) {
      console.error('Payment failed:', error);
      saveTxState(TX_STATE.FAILED, { error: error?.message, operation: 'payment' });
      addToast('❌ Payment failed', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!walletConnected || !paymentMade) {
      addToast('🔗 Please connect wallet and complete payment first', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('projectName', projectName);
    formData.append('contractLink', contractLink);
    formData.append('launchDate', launchDate);
    formData.append('description', description);
    formData.append('walletAddress', walletAddress);
    if (whitepaper) formData.append('whitepaper', whitepaper);

    try {
      // Save transaction state for recovery on refresh
      saveTxState(TX_STATE.PUBLISHING, {
        operation: 'form_submission',
        projectName: projectName,
        account: walletAddress
      });
      
      await submitProjectForm(formData);
      addToast('🚀 Project submitted successfully', 'success');
      
      // Clear transaction state on success
      clearTxState();
      
      // Reset form
      setProjectName('');
      setContractLink('');
      setDescription('');
      setWhitepaper(null);
      setPaymentMade(false);
      
      // Refresh projects list
      setLoadingProjects(true);
      const updated = await fetchProjectsApi();
      setProjects(updated || []);
      setLoadingProjects(false);
    } catch (error) {
      console.error('Submission failed:', error);
      saveTxState(TX_STATE.FAILED, { error: error?.message, operation: 'form_submission' });
      addToast('❌ Project submission failed', 'error');
    }
  };

  const handleWhitepaperUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) setWhitepaper(file);
  };

  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(toasts => [...toasts, { id, message, type }]);
    setTimeout(() => setToasts(toasts => toasts.filter(t => t.id !== id)), 4000);
  };

  const shortAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Config values
  const defaultNetwork = NETWORK_CONFIG[DEFAULT_CHAIN_ID] || {};
  const expectedChainHex = defaultNetwork.chainIdHex;
  const expectedName = defaultNetwork.name || `Chain ${DEFAULT_CHAIN_ID}`;
  const apiBaseStr = typeof API_BASE === 'function' ? API_BASE() : (API_BASE || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE));
  
  const missingEnvs = [];
  if (!apiBaseStr) missingEnvs.push('VITE_API_BASE');
  if (!CONTRACT_ADDRESS) missingEnvs.push('VITE_CONTRACT_ADDRESS');
  if (!PAYMENT_ADDRESS) missingEnvs.push('VITE_PAYMENT_ADDRESS');

  const pendingCount = projects.filter(p => p.status === 'pending').length;
  const approvedCount = projects.filter(p => p.status === 'approved').length;
  const totalCount = projects.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-8 px-4">
      {/* Background Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-l from-blue-500/10 to-purple-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-r from-teal-400/10 to-cyan-500/10 rounded-full blur-3xl" />
      
      <HeroGraphic />
      <NetworkBanner expectedChainHex={expectedChainHex} expectedName={expectedName} addToast={addToast} />

      <div className="relative max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-sm mb-6">
            <span className="text-2xl">🚀</span>
            <span className="text-white font-semibold">Project Launchpad</span>
          </div>
          
          <h1 className="text-5xl lg:text-6xl font-bold text-white mb-4">
            Launch Your
            <span className="bg-gradient-to-r from-teal-300 to-blue-400 bg-clip-text text-transparent"> Project</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Launch curated projects with built-in fee mechanics, referral systems, and trust verification.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard
            icon="📊"
            title="Total Projects"
            value={totalCount}
            description="All submitted projects"
            color="blue"
          />
          <StatCard
            icon="⏳"
            title="Pending"
            value={pendingCount}
            description="Awaiting review"
            color="orange"
          />
          <StatCard
            icon="✅"
            title="Approved"
            value={approvedCount}
            description="Live projects"
            color="green"
          />
          <StatCard
            icon="⚡"
            title="Success Rate"
            value="92%"
            description="Project approval rate"
            color="purple"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Wallet Connection */}
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

              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex-1">
                  <div className="text-sm text-gray-400 mb-1">Connected Address</div>
                  <div className="font-mono text-white text-sm">
                    {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` : 'Not connected'}
                  </div>
                  {walletConnected && balance && (
                    <div className="text-xs text-gray-400 mt-1">Balance: {balance}</div>
                  )}
                </div>
                <button
                  onClick={connectWallet}
                  disabled={!selectedWallet}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium disabled:opacity-50 hover:shadow-lg transition-all"
                >
                  {walletConnected ? '🔄 Reconnect' : '🔗 Connect'}
                </button>
              </div>
            </div>

            {/* Project Submission */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <span>📝</span>
                Project Details
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      🏷️ Project Name
                    </label>
                    <input 
                      value={projectName} 
                      onChange={e => setProjectName(e.target.value)} 
                      required 
                      className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:border-indigo-400 transition-colors"
                      placeholder="Enter project name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      🌐 Contract Link
                    </label>
                    <input 
                      type="url" 
                      value={contractLink} 
                      onChange={e => setContractLink(e.target.value)} 
                      required 
                      className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:border-indigo-400 transition-colors"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      📅 Launch Date
                    </label>
                    <input 
                      type="datetime-local" 
                      value={launchDate} 
                      onChange={e => setLaunchDate(e.target.value)} 
                      className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white focus:border-indigo-400 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      📄 Whitepaper (Optional)
                    </label>
                    <input 
                      type="file" 
                      onChange={handleWhitepaperUpload} 
                      className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-500 file:text-white hover:file:bg-indigo-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    📋 Description
                  </label>
                  <textarea 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    rows={4} 
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:border-indigo-400 transition-colors"
                    required 
                    placeholder="Describe your project..."
                  />
                </div>

                {/* Payment Section */}
                <div className="p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-white font-semibold">💳 Listing Fee</div>
                      <div className="text-gray-300 text-sm">One-time payment for project submission</div>
                    </div>
                    <div className="text-2xl font-bold text-white">{DEFAULT_LISTING_FEE}</div>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={handlePayment}
                      disabled={!walletConnected || paymentMade}
                      className={`flex-1 py-4 rounded-xl font-semibold transition-all ${
                        paymentMade 
                          ? 'bg-green-500 text-white' 
                          : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-lg'
                      } disabled:opacity-50`}
                    >
                      {paymentMade ? '✅ Paid' : `💳 Pay ${DEFAULT_LISTING_FEE}`}
                    </button>
                    
                    <button 
                      type="submit"
                      disabled={!walletConnected || !paymentMade}
                      className="flex-1 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      🚀 Submit Project
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Project Stats */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>📈</span>
                Project Stats
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div className="text-gray-300">Total Submitted</div>
                  <div className="text-white font-semibold">{totalCount}</div>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div className="text-gray-300">Approval Rate</div>
                  <div className="text-green-400 font-semibold">92%</div>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div className="text-gray-300">Avg. Review Time</div>
                  <div className="text-white font-semibold">24h</div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>⚡</span>
                Quick Actions
              </h3>
              <div className="space-y-3">
                <a 
                  href="/attestation"
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
                >
                  <span className="text-xl">📝</span>
                  <div>
                    <div className="text-white font-medium">Create Attestation</div>
                    <div className="text-gray-400 text-sm">Sign verifiable claims</div>
                  </div>
                </a>
                <a 
                  href="/connect"
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
                >
                  <span className="text-xl">🏦</span>
                  <div>
                    <div className="text-white font-medium">Connect Bank</div>
                    <div className="text-gray-400 text-sm">Link accounts</div>
                  </div>
                </a>
                <a 
                  href="/guide"
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
                >
                  <span className="text-xl">📚</span>
                  <div>
                    <div className="text-white font-medium">View Guide</div>
                    <div className="text-gray-400 text-sm">Learn best practices</div>
                  </div>
                </a>
              </div>
            </div>

            {/* Featured Projects */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>⭐</span>
                Featured Projects
              </h3>
              <div className="space-y-3">
                {projects.slice(0, 3).map((project, index) => (
                  <div key={index} className="p-3 bg-white/5 rounded-xl border border-white/10">
                    <div className="text-white font-medium text-sm mb-1">{project.project_name}</div>
                    <div className="text-gray-400 text-xs line-clamp-2">{project.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`pointer-events-auto px-6 py-4 rounded-2xl shadow-2xl text-white font-medium backdrop-blur-sm border ${
              toast.type === 'success' ? 'bg-green-500/20 border-green-400/30' :
              toast.type === 'error' ? 'bg-red-500/20 border-red-400/30' : 
              'bg-blue-500/20 border-blue-400/30'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <ProviderPicker
        visible={showProviderPicker}
        wallets={availableWallets}
        onSelect={(w) => { handleSelectWallet(w); setShowProviderPicker(false); }}
        onClose={() => setShowProviderPicker(false)}
      />

      <Footer />
    </div>
  );
}