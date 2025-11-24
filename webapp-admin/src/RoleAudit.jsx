import React, { useEffect, useState } from 'react';
import { API_BASE } from './config';

function AuditEntry({ entry }) {
  const getActionColor = (action) => {
    switch (action?.toLowerCase()) {
      case 'grant': return 'text-green-400';
      case 'revoke': return 'text-red-400';
      case 'assign': return 'text-blue-400';
      case 'remove': return 'text-orange-400';
      default: return 'text-gray-300';
    }
  };

  const getActionIcon = (action) => {
    switch (action?.toLowerCase()) {
      case 'grant': return '🟢';
      case 'revoke': return '🔴';
      case 'assign': return '🔵';
      case 'remove': return '🟠';
      default: return '⚪';
    }
  };

  return (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{getActionIcon(entry.action)}</span>
          <span className={`font-semibold text-sm ${getActionColor(entry.action)}`}>
            {entry.action || 'Unknown'}
          </span>
          <span className="text-white font-medium text-sm">• {entry.role}</span>
        </div>
        <div className="text-xs text-gray-400 text-right">
          {new Date((entry.changed_at || 0) * 1000).toLocaleDateString()}
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-400">Principal:</span>
          <span className="text-white ml-1 font-mono">{entry.principal}</span>
        </div>
        <div>
          <span className="text-gray-400">Type:</span>
          <span className="text-white ml-1 capitalize">{entry.principal_type}</span>
        </div>
        <div className="sm:col-span-2">
          <span className="text-gray-400">By:</span>
          <span className="text-white ml-1 font-mono">
            {entry.changed_by || 'system'}
          </span>
          <span className="text-gray-400 ml-2">•</span>
          <span className="text-gray-400 ml-2">
            {new Date((entry.changed_at || 0) * 1000).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function RoleAuditViewer() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAudit = async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const res = await fetch(`${API_BASE}/api/admin/role-audit`, { 
        credentials: 'include' 
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch role audit:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { 
    fetchAudit(); 
  }, []);

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
            <span className="text-lg">📋</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Role Audit Trail</h3>
            <p className="text-gray-300 text-sm">Recent role assignment and removal events</p>
          </div>
        </div>
        
        <button
          onClick={() => fetchAudit(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 text-gray-300 rounded-xl hover:bg-white/20 hover:text-white transition-all disabled:opacity-50"
        >
          {refreshing ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>🔄</span>
          )}
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-white/5 rounded-xl border border-white/10">
          <div className="text-2xl font-bold text-white">{entries.length}</div>
          <div className="text-gray-400 text-sm">Total Events</div>
        </div>
        <div className="text-center p-3 bg-white/5 rounded-xl border border-white/10">
          <div className="text-2xl font-bold text-green-400">
            {entries.filter(e => e.action?.toLowerCase() === 'grant').length}
          </div>
          <div className="text-gray-400 text-sm">Grants</div>
        </div>
        <div className="text-center p-3 bg-white/5 rounded-xl border border-white/10">
          <div className="text-2xl font-bold text-red-400">
            {entries.filter(e => e.action?.toLowerCase() === 'revoke').length}
          </div>
          <div className="text-gray-400 text-sm">Revokes</div>
        </div>
        <div className="text-center p-3 bg-white/5 rounded-xl border border-white/10">
          <div className="text-2xl font-bold text-blue-400">
            {entries.filter(e => !['grant', 'revoke'].includes(e.action?.toLowerCase())).length}
          </div>
          <div className="text-gray-400 text-sm">Other</div>
        </div>
      </div>

      {/* Audit List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <div className="text-gray-400">Loading audit trail...</div>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 bg-white/5 rounded-xl border border-white/10">
            <div className="text-4xl mb-3 opacity-50">📝</div>
            <div className="text-gray-400 text-lg mb-2">No audit entries yet</div>
            <div className="text-gray-500 text-sm">Role changes will appear here</div>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {entries.map((entry) => (
              <AuditEntry key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="text-xs text-gray-400 text-center">
          🔍 Monitoring all role management activities
        </div>
      </div>
    </div>
  );
}