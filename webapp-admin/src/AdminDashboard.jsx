import React, { useState, useEffect } from "react";
import { Link } from 'react-router-dom';
import { API_BASE } from './config';
import RoleManager from './RoleManager';
import RoleAuditViewer from './RoleAudit';
import LenderDashboard from './LenderDashboard';
import { useToast } from './components/Toast';
import { 
  listAvailableProviders, 
  selectBestProvider, 
  connectWallet as modernConnectWallet 
} from './utils/providerDetect';

function StatCard({ title, value, color, icon }) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-yellow-600',
    purple: 'from-purple-500 to-purple-600'
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-300">{title}</p>
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
    
    if (wallets.length > 0) {
      selectBestProvider().then(wallet => {
        setSelectedWallet(wallet);
      });
    }
  }, []);

  const handleWalletLogin = async () => {
    if (!selectedWallet) return;
    setLoading(true);
    await onWalletLogin(selectedWallet.provider);
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚡</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Admin Access</h2>
          <p className="text-gray-300">Choose your authentication method</p>
        </div>

        <div className="space-y-4">
          {/* Wallet Login */}
          {authMethods.siwe && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Connect Wallet
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {availableWallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => setSelectedWallet(wallet)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                      selectedWallet?.id === wallet.id
                        ? 'bg-blue-500/20 border-blue-400 text-blue-300'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20'
                    }`}
                  >
                    {wallet.icon && (
                      <img src={wallet.icon} alt="" className="w-5 h-5 rounded" />
                    )}
                    <span className="text-sm font-medium">{wallet.name}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={handleWalletLogin}
                disabled={!selectedWallet || loading}
                className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 rounded-xl py-4 font-semibold hover:from-yellow-300 hover:to-orange-300 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>🔐</span>
                )}
                Sign in with Wallet
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
          Contract Owner Verification
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
        Verify the on-chain contract owner and track verification history
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
  const [showPanels, setShowPanels] = useState(true);
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

  const handleSiweLogin = async (provider) => {
    try {
      const connection = await modernConnectWallet(provider);
      const address = connection.accounts[0];
      
      const nonceRes = await fetch(`${API_BASE}/api/admin/nonce`);
      if (!nonceRes.ok) throw new Error('Could not get nonce');
      
      const nonceData = await nonceRes.json();
      const nonce = nonceData?.nonce;
      if (!nonce) throw new Error('Invalid nonce received');

      const domain = window.location.hostname;
      const origin = window.location.origin;
      const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\nURI: ${origin}\nVersion: 1\nChain ID: ${connection.chainId}\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;

      const signature = await provider.request({ 
        method: 'personal_sign', 
        params: [message, address] 
      });

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
      if (error?.message?.includes('rejected')) {
        addToast('Signature request was rejected', { type: 'error' });
      } else {
        addToast(`Login failed: ${error.message}`, { type: 'error' });
      }
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
        setFilteredProjects(list || []);
      })
      .catch(console.error);
  };

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowPanels(s => !s)}
                className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="text-sm font-semibold text-blue-300">Admin Dashboard</div>
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
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">⚡</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Admin Dashboard
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Manage projects, verify contracts, and oversee platform operations
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
                <div className="text-xl font-bold text-white">RealMint Admin</div>
                <div className="hidden lg:block text-sm text-gray-400">• Platform Management</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPanels(s => !s)}
                  className="px-4 py-2 bg-white/10 text-gray-300 rounded-xl hover:bg-white/20 transition-colors text-sm font-medium"
                >
                  {showPanels ? 'Hide Panels' : 'Show Panels'}
                </button>
                <button
                  onClick={handleLogout}
                  className="px-6 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors font-medium"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                title="Total Projects"
                value={projects.length}
                color="blue"
                icon="📊"
              />
              <StatCard
                title="Pending"
                value={pendingCount}
                color="yellow"
                icon="⏳"
              />
              <StatCard
                title="Approved"
                value={approvedCount}
                color="green"
                icon="✅"
              />
              <StatCard
                title="Rejected"
                value={rejectedCount}
                color="purple"
                icon="❌"
              />
            </div>

            {/* Search Bar */}
            <div className="mb-8">
              <div className="relative">
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setFilteredProjects(
                      projects.filter(p => 
                        (p.project_name || '').toLowerCase().includes(e.target.value.toLowerCase()) ||
                        (p.description || '').toLowerCase().includes(e.target.value.toLowerCase())
                      )
                    );
                  }}
                  placeholder="Search projects by name or description..."
                  className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
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
            {showPanels && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <RoleManager />
                <RoleAuditViewer />
              </div>
            )}

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
                        setFilteredProjects(projects);
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