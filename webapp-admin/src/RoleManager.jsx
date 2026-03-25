import React, { useState, useEffect } from 'react';
import { API_BASE } from './config';
import { useToast } from './components/Toast';

function RoleCard({ role, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(role.id);
    } finally {
      setDeleting(false);
    }
  };

  const getPrincipalIcon = (type) => {
    return type === 'email' ? '📧' : '👤';
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 hover:border-cyan-200/40 transition-all group stagger-item">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-300/20 to-amber-300/20 border border-cyan-200/30 flex items-center justify-center">
          <span className="text-lg">🔑</span>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-semibold bg-cyan-500/20 px-2 py-1 rounded-lg text-sm border border-cyan-300/30">
              {role.role}
            </span>
            <span className="text-gray-400 text-sm">
              {getPrincipalIcon(role.principal_type)}
            </span>
          </div>
          <div className="text-gray-300 text-sm font-mono">
            {role.principal}
          </div>
        </div>
      </div>
      
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="px-4 py-2 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl hover:bg-rose-500/30 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2 group-hover:border-rose-300/50"
      >
        {deleting ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <span>🗑️</span>
        )}
        Remove
      </button>
    </div>
  );
}

export default function RoleManager() {
  const [roles, setRoles] = useState([]);
  const [principalType, setPrincipalType] = useState('email');
  const [principal, setPrincipal] = useState('');
  const [roleName, setRoleName] = useState('');
  const [csrf, setCsrf] = useState(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false); // ADDED: Progressive disclosure
  const { addToast } = useToast();

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/roles`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setRoles(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      addToast('Failed to load roles', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCsrf = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/csrf`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCsrf(data.csrf_token);
      }
    } catch (error) {
      console.error('Failed to fetch CSRF token:', error);
    }
  };

  const handleAdd = async () => {
    if (!principal.trim() || !roleName.trim()) {
      addToast('Please fill in all fields', { type: 'error' });
      return;
    }

    setAdding(true);
    try {
      if (!csrf) await fetchCsrf();
      
      const response = await fetch(`${API_BASE}/api/admin/roles`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf || ''
        },
        body: JSON.stringify({
          principal_type: principalType,
          principal: principal.trim(),
          role: roleName.trim()
        })
      });

      if (response.ok) {
        await fetchRoles();
        setPrincipal('');
        setRoleName('');
        addToast('✅ Role assigned successfully', { type: 'success' });
      } else {
        throw new Error('Add failed');
      }
    } catch (error) {
      console.error('Failed to add role:', error);
      addToast('❌ Failed to assign role', { type: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      if (!csrf) await fetchCsrf();
      
      const response = await fetch(`${API_BASE}/api/admin/roles/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrf || ''
        }
      });

      if (response.ok) {
        await fetchRoles();
        addToast('✅ Role removed successfully', { type: 'success' });
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      console.error('Failed to delete role:', error);
      addToast('❌ Failed to remove role', { type: 'error' });
    }
  };

  const getPlaceholder = () => {
    return principalType === 'email' 
      ? "user@example.com" 
      : "0x742d35Cc6634C0532925a3b8D...";
  };

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-cyan-200/20 p-4 sm:p-6 shadow-xl shadow-cyan-500/5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 sm:mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-300/20 to-amber-300/20 border border-cyan-200/30 flex items-center justify-center">
            <span className="text-lg">👥</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Role Management</h3>
            <p className="text-gray-300 text-sm">Assign and manage user roles and permissions</p>
          </div>
        </div>
        
        <button
          onClick={fetchRoles}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 text-gray-300 rounded-xl hover:bg-cyan-500/20 hover:text-cyan-100 transition-all disabled:opacity-50 border border-white/10 hover:border-cyan-200/40"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>🔄</span>
          )}
          Refresh
        </button>
      </div>

      {/* Add Role Form - Progressive Disclosure */}
      <div className="bg-gradient-to-br from-cyan-400/10 to-amber-300/10 rounded-xl border border-cyan-200/30 p-4 sm:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>➕</span>
            Assign New Role
          </h4>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm px-3 py-1 bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 rounded border border-cyan-300/30 transition-all"
          >
            {showForm ? '✕ Hide' : '+ Show'}
          </button>
        </div>
        
        {showForm && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Principal Type
            </label>
            <select 
              value={principalType} 
              onChange={(e) => setPrincipalType(e.target.value)}
              className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-cyan-300 transition-colors"
            >
              <option value="email">📧 Email</option>
              <option value="address">👤 Address</option>
            </select>
          </div>
          
          <div className="lg:col-span-5">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Principal
            </label>
            <input 
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              placeholder={getPlaceholder()}
              className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:border-cyan-300 transition-colors"
            />
          </div>
          
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Role
            </label>
            <input 
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="admin"
              className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:border-cyan-300 transition-colors"
            />
          </div>
          
          <div className="lg:col-span-2 flex items-end">
            <button
              onClick={handleAdd}
              disabled={adding || !principal.trim() || !roleName.trim()}
              className="w-full px-6 py-3 bg-gradient-to-r from-amber-200 to-cyan-200 text-slate-900 rounded-xl font-semibold hover:shadow-lg hover:shadow-cyan-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {adding ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>➕</span>
              )}
              Add
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Roles List */}
      <div>
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>📊</span>
          Current Role Assignments ({roles.length})
        </h4>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <div className="text-gray-400">Loading roles...</div>
          </div>
        ) : roles.length === 0 ? (
          <div className="text-center py-8 bg-white/5 rounded-xl border border-cyan-200/20">
            <div className="text-4xl mb-3 opacity-50">🔑</div>
            <div className="text-gray-400 text-lg mb-2">No role assignments</div>
            <div className="text-gray-500 text-sm">Use the form above to assign roles</div>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {roles.map((role, idx) => (
              <div key={role.id} style={{ animationDelay: `${Math.min(idx * 55, 320)}ms` }}>
                <RoleCard role={role} onDelete={handleDelete} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-cyan-200/20">
        <div className="text-xs text-cyan-100/70 text-center">
          🔒 Secure role management with audit trail
        </div>
      </div>
    </div>
  );
}