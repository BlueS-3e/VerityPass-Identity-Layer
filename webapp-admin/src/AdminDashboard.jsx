import React, { useState, useEffect, useMemo } from "react";
import { Link } from 'react-router-dom';
import { API_BASE } from './config';
import RoleManager from './RoleManager';
import RoleAuditViewer from './RoleAudit';
import LenderDashboard from './LenderDashboard';
import { useToast } from './components/Toast';
import { 
  listAvailableProviders, 
  selectBestProvider, 
  connectWallet as modernConnectWallet,
  getDisplayWallets,
  switchNetwork
} from './utils/providerDetect';

function StatCard({ title, value, color, icon }) {
  const colorClasses = {
    blue: 'from-cyan-300 to-blue-400',
    green: 'from-emerald-300 to-emerald-500',
    yellow: 'from-amber-200 to-orange-300',
    purple: 'from-rose-200 to-amber-300'
  };

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-lg shadow-black/10 hover:border-cyan-200/40 transition-all">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider uppercase text-gray-400">{title}</p>
          <p className={`text-2xl font-bold bg-gradient-to-r ${colorClasses[color]} bg-clip-text text-transparent mt-1`}>
            {value}
          </p>
        </div>
        <div className="text-2xl opacity-80">
          {icon}
        </div>
      </div>
    </div>
  );
}

function AdminLoginCard({ authMethods, onWalletLogin, onOidcLogin, onPasswordLogin }) {
  const [adminPassword, setAdminPassword] = useState("");
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [availableWallets, setAvailableWallets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const wallets = listAvailableProviders();
    setAvailableWallets(wallets);

    // Prefer an immediately connectable injected wallet on desktop.
    const injected = wallets.find((w) => Boolean(w?.provider && typeof w.provider.request === 'function'));
    if (injected) {
      setSelectedWallet(injected);
      return;
    }

    selectBestProvider().then((wallet) => {
      if (!wallet) return;
      setSelectedWallet(wallet);
    });
  }, []);

  const displayWallets = useMemo(() => getDisplayWallets(availableWallets), [availableWallets]);

  const isConnectable = (wallet) => Boolean(wallet?.provider && typeof wallet.provider.request === 'function');
  const fallbackWallet = useMemo(
    () => displayWallets.find((wallet) => isConnectable(wallet)) || availableWallets.find((wallet) => isConnectable(wallet)),
    [displayWallets, availableWallets]
  );

  const handleWalletLogin = async () => {
    const activeWallet = selectedWallet || fallbackWallet;
    if (!activeWallet) return;

    // Keep UI in sync when selected wallet is non-connectable (e.g. SDK placeholder)
    if (activeWallet && selectedWallet?.id !== activeWallet.id) {
      setSelectedWallet(activeWallet);
    }

    setLoading(true);
    try {
      await onWalletLogin(activeWallet);
    } finally {
      setLoading(false);
    }
  };

  const selectedWalletLabel = selectedWallet?.name || fallbackWallet?.name || 'Wallet';
  const canConnectWallet = Boolean(selectedWallet || fallbackWallet);

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-cyan-200/20 shadow-2xl shadow-cyan-500/10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-cyan-300 to-amber-300 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-900">
            <span className="text-2xl">⚡</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">BNB Ops Access</h2>
          <p className="text-gray-300">Authenticate to manage BNB Chain risk operations securely</p>
        </div>

        <div className="space-y-4">
          {/* Wallet Login */}
          {authMethods.siwe && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Connect Wallet
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {displayWallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => setSelectedWallet(wallet)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                      selectedWallet?.id === wallet.id
                        ? 'bg-cyan-500/20 border-cyan-300 text-cyan-200'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:border-cyan-200/40'
                    }`}
                  >
                    {wallet.icon && (
                      <img src={wallet.icon} alt="" className="w-5 h-5 rounded" />
                    )}
                    <span className="text-sm font-medium">{wallet.name}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400">Network is auto-managed for admin login.</p>
              <button
                onClick={handleWalletLogin}
                disabled={!canConnectWallet || loading}
                className="w-full bg-gradient-to-r from-amber-200 to-cyan-200 text-slate-900 rounded-xl py-4 font-semibold hover:from-amber-100 hover:to-cyan-100 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>🔐</span>
                )}
                Sign in with {selectedWalletLabel}
              </button>
            </div>
          )}

          {/* OIDC Login */}
          {authMethods.oidc && (
            <button
              onClick={onOidcLogin}
              className="w-full bg-gradient-to-r from-green-400 to-teal-400 text-gray-900 rounded-xl py-4 font-semibold hover:from-green-300 hover:to-teal-300 transition-all flex items-center justify-center gap-2"
            >
              <span>🌐</span>
              Sign in with SSO
            </button>
          )}

          {/* Password Login */}
          {authMethods.password && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">
                Admin Password
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Enter admin password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
                />
                <button
                  onClick={() => onPasswordLogin(adminPassword)}
                  className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium"
                >
                  Login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project, onApprove, onReject, onDelete, apiBase }) {
  const [expanded, setExpanded] = useState(false);

  const statusColors = {
    pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    approved: 'bg-green-500/20 text-green-300 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-300 border-red-500/30'
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-lg font-semibold text-white">{project.project_name}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[project.status] || statusColors.pending}`}>
              {project.status || "pending"}
            </span>
          </div>
          
          <p className="text-gray-300 text-sm line-clamp-2 mb-3">
            {project.description || 'No description provided'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-400">
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

          {expanded && (
            <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="text-sm text-gray-300 space-y-2">
                <div><strong>Contract:</strong> {project.contract_link || 'Not provided'}</div>
                <div><strong>Submitted:</strong> {new Date(project.created_at).toLocaleDateString()}</div>
                <div><strong>Wallet:</strong> <span className="font-mono text-xs">{project.wallet_address}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 sm:flex-none px-4 py-2 bg-white/10 text-gray-300 rounded-xl hover:bg-white/20 transition-colors text-sm"
        >
          {expanded ? 'Show Less' : 'View Details'}
        </button>
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            className="flex-1 px-4 py-2 bg-green-500/20 text-green-300 border border-green-500/30 rounded-xl hover:bg-green-500/30 transition-colors text-sm font-medium"
          >
            Approve
          </button>
          <button
            onClick={onReject}
            className="flex-1 px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition-colors text-sm font-medium"
          >
            Reject
          </button>
          <button
            onClick={onDelete}
            className="flex-1 px-4 py-2 bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-xl hover:bg-gray-500/30 transition-colors text-sm font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function OwnerVerification({ ownerAudit, onVerify, onRefresh, verifying }) {
  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🛡️</span>
          BNB Contract Owner Verification
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onVerify}
            disabled={verifying}
            className="px-4 py-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-50 transition-colors text-sm font-medium flex items-center gap-2"
          >
            {verifying ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>🔍</span>
            )}
            Verify Owner
          </button>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-white/10 text-gray-300 rounded-xl hover:bg-white/20 transition-colors text-sm font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      <p className="text-gray-300 text-sm mb-4">
        Verify the BNB Chain contract owner and track verification history
      </p>

      <div className="space-y-3">
        <div className="text-sm font-medium text-gray-300">Recent Verification Checks</div>
        {ownerAudit.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <div className="text-2xl mb-2">📊</div>
            No verification checks yet
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {ownerAudit.map((audit, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10"
              >
                <div className="flex-1">
                  <div className="text-xs text-gray-400">
                    {new Date(audit.checked_at * 1000).toLocaleString()}
                  </div>
                  <div className="text-sm text-white font-mono mt-1">
                    {audit.owner_address}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  audit.match 
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                    : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                }`}>
                  {audit.match ? '✅ Match' : '⚠️ Mismatch'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  // REMOVED: Dead toggle - all sections now always visible
  const [isAdmin, setIsAdmin] = useState(false);
  const [csrfToken, setCsrfToken] = useState(null);
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [authMethods, setAuthMethods] = useState({ password: false, siwe: true, oidc: false });
  const [ownerAudit, setOwnerAudit] = useState([]);
  const [verifying, setVerifying] = useState(false);
  const { addToast } = useToast();

  // Auth methods
  const handleAdminLogin = async (password) => {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      credentials: "include",
    });
    if (res.ok) {
      setIsAdmin(true);
      await fetchCsrfToken();
      fetchProjects();
      addToast('Admin login successful', { type: 'success' });
    } else {
      addToast('Admin login failed', { type: 'error' });
    }
  };

  const mapWalletError = (error) => {
    const nested = error?.data?.originalError || error?.error || null;
    const code = Number(nested?.code ?? error?.code);
    const combinedMessage = `${nested?.message || ''} ${error?.message || ''}`.trim();
    const msg = combinedMessage.toLowerCase();
    const walletName = String(error?._walletName || '').toLowerCase();

    if (!msg) return 'Could not connect wallet. Please try again.';

    // Wallet/user-driven cancellations
    if (
      code === 4001 ||
      msg.includes('user rejected') ||
      msg.includes('user denied') ||
      msg.includes('denied transaction signature') ||
      msg.includes('denied message signature') ||
      msg.includes('modal was closed') ||
      msg.includes('closed without connecting') ||
      msg.includes('walletconnect modal was closed')
    ) {
      if (walletName.includes('metamask') || walletName.includes('browser')) {
        return 'MetaMask request was cancelled. Please approve the connection/sign request to continue.';
      }
      if (walletName.includes('walletconnect')) {
        return 'WalletConnect connection was interrupted. Please retry and keep the wallet approval flow open until completion.';
      }
      return 'Wallet request was cancelled.';
    }

    if (code === -32002 || msg.includes('already pending')) {
      return 'A wallet request is already pending. Please open MetaMask and complete it.';
    }

    if (msg.includes('project id')) {
      return 'WalletConnect is not configured. Please contact support.';
    }

    if (msg.includes('timeout')) {
      return 'Wallet connection timed out. Please open your wallet app and retry.';
    }

    if (msg.includes('unsupported network') || msg.includes('does not support')) {
      return 'Connected wallet cannot switch networks automatically. Please switch network in your wallet and retry.';
    }

    if (msg.includes('nonce')) {
      return 'Could not start secure sign-in. Please refresh and try again.';
    }

    if (msg.includes('not authorized') || msg.includes('unauthorized') || msg.includes('forbidden')) {
      return 'Wallet connected, but this address is not authorized for admin access.';
    }

    if (msg.includes('chain') && msg.includes('switch')) {
      return 'Network switch did not complete. Please switch network in MetaMask and retry.';
    }

    if (msg.includes('signature')) {
      return 'Could not sign the login message. Please retry in MetaMask.';
    }

    return 'Wallet sign-in failed. Please retry.';
  };

  const handleSiweLogin = async (walletOrProvider) => {
    try {
      const preferredAdminChainId = 56;
      const connection = await modernConnectWallet(walletOrProvider, { chainId: preferredAdminChainId });
      const provider = connection?.provider;
      if (!provider || (typeof provider.request !== 'function' && typeof provider.send !== 'function')) {
        throw new Error('No connected wallet provider available');
      }

      const rpcRequest = async (method, params = []) => {
        if (typeof provider.request === 'function') {
          return provider.request({ method, params });
        }
        if (typeof provider.send === 'function') {
          return provider.send(method, params);
        }
        throw new Error('Provider does not support JSON-RPC requests');
      };

      const address = connection.accounts[0];
      let activeChainId = typeof connection.chainId === 'string'
        ? parseInt(connection.chainId, 16)
        : Number(connection.chainId);

      if (activeChainId !== preferredAdminChainId) {
        try {
          await switchNetwork(provider, preferredAdminChainId);
          const chainAfterSwitch = await rpcRequest('eth_chainId', []);
          activeChainId = typeof chainAfterSwitch === 'string' ? parseInt(chainAfterSwitch, 16) : Number(chainAfterSwitch);
        } catch (networkError) {
          // Continue sign-in on the currently connected network rather than hard-failing.
          addToast('Connected on a different network. Continuing sign-in on current chain.', { type: 'warning' });
        }
      }
      
      const nonceRes = await fetch(`${API_BASE}/api/admin/nonce`);
      if (!nonceRes.ok) throw new Error('Could not get nonce');
      
      const nonceData = await nonceRes.json();
      const nonce = nonceData?.nonce;
      if (!nonce) throw new Error('Invalid nonce received');

      const domain = window.location.hostname;
      const origin = window.location.origin;
      const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nURI: ${origin}\nVersion: 1\nChain ID: ${activeChainId}\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;

      let signature;
      try {
        signature = await rpcRequest('personal_sign', [message, address]);
      } catch (primarySignError) {
        // Some wallets expect personal_sign params in reverse order.
        signature = await rpcRequest('personal_sign', [address, message]);
      }

      const res = await fetch(`${API_BASE}/api/admin/siwe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message, signature })
      });

      if (res.ok) {
        setIsAdmin(true);
        await fetchCsrfToken();
        fetchProjects();
        addToast('Wallet login successful', { type: 'success' });
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.status || res.statusText);
      }
    } catch (error) {
      console.error('SIWE login failed:', error);
      addToast(mapWalletError({ ...error, _walletName: walletOrProvider?.name || walletOrProvider?.id || '' }), { type: 'error' });
    }
  };

  const handleOidcLogin = async () => {
    try {
      window.location.href = `${API_BASE}/api/admin/oidc/login`;
    } catch (error) {
      console.error('OIDC login failed:', error);
      addToast('SSO login failed to start', { type: 'error' });
    }
  };

  // Data fetching
  useEffect(() => {
    let mounted = true;
    
    fetch(`${API_BASE}/api/admin/auth_methods`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (mounted && data && typeof data === 'object') {
          setAuthMethods(data);
        }
      })
      .catch(console.error);
    
    return () => { mounted = false };
  }, []);

  useEffect(() => {
    let mounted = true;
    
    const checkAdminStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/check`, { credentials: 'include' });
        if (!mounted) return;
        
        if (res.ok) {
          const data = await res.json();
          if (data?.admin) {
            setIsAdmin(true);
            await fetchCsrfToken();
            fetchProjects();
            fetchOwnerAudit();
          }
        }
      } catch (error) {
        console.error('Admin check failed:', error);
      }
    };

    checkAdminStatus();
    return () => { mounted = false };
  }, []);

  const fetchCsrfToken = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/csrf`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCsrfToken(data?.csrf_token);
      }
    } catch (error) {
      console.error('CSRF token fetch failed:', error);
    }
  };

  const ensureCsrf = async () => {
    if (!csrfToken) await fetchCsrfToken();
  };

  const fetchProjects = () => {
    fetch(`${API_BASE}/api/admin/projects`, { credentials: "include" })
      .then((res) => res.json())
      .then((list) => {
        setProjects(list || []);
      })
      .catch(console.error);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      const query = search.trim().toLowerCase();
      if (!query) {
        setFilteredProjects(projects);
        return;
      }

      setFilteredProjects(
        projects.filter((p) =>
          (p.project_name || '').toLowerCase().includes(query) ||
          (p.description || '').toLowerCase().includes(query)
        )
      );
    }, 180);

    return () => clearTimeout(timer);
  }, [search, projects]);

  const fetchOwnerAudit = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/owner-audit`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOwnerAudit(data || []);
      }
    } catch (error) {
      console.error('Owner audit fetch failed:', error);
    }
  };

  // Project actions
  const handleAdminAction = async (index, action) => {
    const project = projects[index];
    await ensureCsrf();
    
    try {
      const res = await fetch(`${API_BASE}/api/admin/projects/${project.id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json", 
          "X-CSRF-Token": csrfToken || '' 
        },
        body: JSON.stringify({ status: action }),
        credentials: "include",
      });

      if (res.ok) {
        fetchProjects();
        addToast(`Project ${action} successfully`, { type: 'success' });
      } else {
        throw new Error('Action failed');
      }
    } catch (error) {
      console.error('Project action failed:', error);
      addToast('Action failed', { type: 'error' });
    }
  };

  const handleAdminDelete = async (index) => {
    const project = projects[index];
    await ensureCsrf();
    
    try {
      const res = await fetch(`${API_BASE}/api/admin/projects/${project.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "X-CSRF-Token": csrfToken || '' },
      });

      if (res.ok) {
        fetchProjects();
        addToast('Project deleted successfully', { type: 'success' });
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      console.error('Project deletion failed:', error);
      addToast('Delete failed', { type: 'error' });
    }
  };

  const handleVerifyOwner = async () => {
    setVerifying(true);
    try {
      await ensureCsrf();
      const res = await fetch(`${API_BASE}/api/admin/verify-owner`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify({})
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || res.statusText);
      }

      const data = await res.json();
      addToast(`Owner: ${data.owner} - ${data.match ? 'Match' : 'Mismatch'}`, { type: 'info' });
      await fetchOwnerAudit();
    } catch (error) {
      console.error('Owner verification failed:', error);
      addToast(`Verification failed: ${error.message}`, { type: 'error' });
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = async () => {
    await ensureCsrf();
    try {
      await fetch(`${API_BASE}/api/admin/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": csrfToken || '' },
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsAdmin(false);
      setProjects([]);
      setCsrfToken(null);
      addToast('Logged out successfully', { type: 'success' });
    }
  };

  // Stats calculation
  const pendingCount = projects.filter(p => p.status === 'pending').length;
  const approvedCount = projects.filter(p => p.status === 'approved').length;
  const rejectedCount = projects.filter(p => p.status === 'rejected').length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.22),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(251,191,36,0.18),transparent_35%),linear-gradient(135deg,#0b1220_0%,#101827_55%,#172033_100%)]">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/70 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold text-cyan-200">BNB Risk Ops</div>
            </div>
            {isAdmin && (
              <button 
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition-colors text-sm font-medium"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      <div className={`pt-16 lg:pt-8 max-w-7xl mx-auto px-4 py-8 ${isAdmin ? 'pb-20 lg:pb-8' : ''}`}>
        {/* Header */}
        <div className="text-center mb-8 lg:mb-12">
          <div className="w-20 h-20 bg-gradient-to-r from-cyan-300 to-amber-300 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-900 shadow-xl shadow-cyan-500/20">
            <span className="text-3xl">⚡</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            BNB Chain Risk Ops Console
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Moderate submissions, verify BNB ownership, and operate protocol controls
          </p>
        </div>

        {!isAdmin ? (
          <AdminLoginCard
            authMethods={authMethods}
            onWalletLogin={handleSiweLogin}
            onOidcLogin={handleOidcLogin}
            onPasswordLogin={handleAdminLogin}
          />
        ) : (
          <>
            {/* Admin Header Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="text-xl font-bold text-white">VerityPass BNB Ops</div>
                <div className="hidden lg:block text-sm text-gray-400">• Governance and risk controls</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-emerald-500/15 text-emerald-200 border border-emerald-400/30 rounded-xl text-sm font-medium">
                  Live Controls Enabled
                </div>
                <button
                  onClick={handleLogout}
                  className="px-6 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors font-medium"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Stats Overview */}
            {/* Stats Overview - Compact */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <StatCard title="Total" value={projects.length} color="blue" icon="📊" />
              <StatCard title="Pending" value={pendingCount} color="yellow" icon="⏳" />
              <StatCard title="Approved" value={approvedCount} color="green" icon="✅" />
              <StatCard title="Rejected" value={rejectedCount} color="purple" icon="❌" />
            </div>

            {/* Search Bar */}
            <div className="mb-8">
              <div className="relative">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects by name or description..."
                  className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-300 transition-colors"
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                  🔍
                </div>
              </div>
            </div>

            {/* Owner Verification */}
            <div className="mb-8">
              <OwnerVerification
                ownerAudit={ownerAudit}
                onVerify={handleVerifyOwner}
                onRefresh={fetchOwnerAudit}
                verifying={verifying}
              />
            </div>

            {/* Management Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <RoleManager />
              <RoleAuditViewer />
            </div>

            {/* Lender Dashboard (full width) */}
            <div className="mb-8">
              <LenderDashboard />
            </div>

            {/* Projects List */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span>🚀</span>
                Project Submissions ({filteredProjects.length})
              </h3>

              {filteredProjects.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4 opacity-50">📭</div>
                  <div className="text-gray-400 text-lg">No projects found</div>
                  {search && (
                    <button
                      onClick={() => {
                        setSearch('');
                      }}
                      className="mt-4 px-4 py-2 bg-white/10 text-gray-300 rounded-xl hover:bg-white/20 transition-colors"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredProjects.map((project, index) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onApprove={() => handleAdminAction(index, "approved")}
                      onReject={() => handleAdminAction(index, "rejected")}
                      onDelete={() => handleAdminDelete(index)}
                      apiBase={API_BASE}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}