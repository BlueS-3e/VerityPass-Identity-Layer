import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from './config';

function Stat({ title, value }) {
  return (
    <div className="bg-white/5 p-4 rounded-xl border border-cyan-200/20 backdrop-blur-md shadow-lg shadow-black/10">
      <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold">{title}</div>
      <div className="text-2xl font-bold text-cyan-100 mt-1">{value?.toLocaleString() || 0}</div>
    </div>
  );
}

function FilterBar({ filters, onFilterChange, onReset }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-6 p-4 bg-white/5 rounded-xl border border-cyan-200/20 backdrop-blur-md">
      <div className="flex flex-1 flex-col sm:flex-row gap-3">
        <input
          placeholder="Filter by issuer..."
          value={filters.issuer}
          onChange={(e) => onFilterChange('issuer', e.target.value)}
          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-transparent"
        />
        <input
          placeholder="Filter by subject..."
          value={filters.subject}
          onChange={(e) => onFilterChange('subject', e.target.value)}
          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-transparent"
        />
        <select
          value={filters.verified}
          onChange={(e) => onFilterChange('verified', e.target.value)}
          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-transparent"
        >
          <option value="">All Status</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </select>
      </div>
      <button
        onClick={onReset}
        className="px-4 py-2 bg-white/10 hover:bg-cyan-500/20 border border-white/20 rounded-lg text-sm text-white transition-colors duration-200"
      >
        Reset Filters
      </button>
    </div>
  );
}

function AttestationTable({ 
  items, 
  selectedIds, 
  onSelectAll, 
  onSelectItem, 
  onItemClick, 
  loading 
}) {
  if (loading) {
    return (
      <div className="space-y-2 py-2" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="grid grid-cols-7 gap-3 p-3 rounded-lg border border-cyan-200/15 bg-white/5">
            <div className="skeleton h-4 rounded" />
            <div className="skeleton h-4 rounded" />
            <div className="skeleton h-4 rounded" />
            <div className="skeleton h-4 rounded" />
            <div className="skeleton h-4 rounded" />
            <div className="skeleton h-4 rounded" />
            <div className="skeleton h-4 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="text-center py-12 text-gray-400">
        No attestations found
      </div>
    );
  }

  const allSelected = items.length > 0 && selectedIds.length === items.length;

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="min-w-full divide-y divide-white/10">
        <thead className="bg-white/5">
          <tr className="text-left text-gray-300 text-sm">
            <th className="px-4 py-3 font-medium">
              <input
                type="checkbox"
                onChange={(e) => onSelectAll(e.target.checked)}
                checked={allSelected}
                className="rounded border-white/20 bg-white/10 text-blue-600 focus:ring-blue-500"
              />
            </th>
            <th className="px-4 py-3 font-medium">ID</th>
            <th className="px-4 py-3 font-medium">Issuer</th>
            <th className="px-4 py-3 font-medium">Subject</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 font-medium">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 bg-white/2">
          {items.map((item, idx) => (
            <tr
              key={item.id}
              className="hover:bg-white/5 transition-colors duration-150 cursor-pointer stagger-item"
              style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
              onClick={() => onItemClick(item.id)}
            >
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => onSelectItem(item.id)}
                  className="rounded border-white/20 bg-white/10 text-blue-600 focus:ring-blue-500"
                />
              </td>
              <td className="px-4 py-3 text-white font-mono text-sm">{item.id}</td>
              <td className="px-4 py-3 text-gray-300 truncate max-w-[200px]">{item.issuer}</td>
              <td className="px-4 py-3 text-gray-300 truncate max-w-[200px]">{item.subject}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    item.verified
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-yellow-500/20 text-yellow-300'
                  }`}
                >
                  {item.verified ? 'Verified' : 'Unverified'}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-300 text-sm">
                {item.created_at
                  ? new Date(item.created_at * 1000).toLocaleDateString()
                  : '-'}
              </td>
              <td className="px-4 py-3">
                {item.last_assessment ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300">
                    {item.last_assessment.score}
                  </span>
                ) : (
                  <span className="text-gray-400 text-sm">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailModal({ selected, loading, onClose, onExport }) {
  if (!selected) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />
      <div className="relative bg-gray-900 rounded-xl border border-cyan-200/20 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-fade-in-up">
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <h4 className="text-xl font-semibold text-white">Attestation Details</h4>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200 text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-300"></div>
            </div>
          ) : selected.error ? (
            <div className="max-w-md mx-auto">
              <div className="bg-red-500/15 border border-red-500/40 rounded-xl p-6 backdrop-blur-sm text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 mb-4">
                  <span className="text-2xl">❌</span>
                </div>
                <p className="text-red-300 font-medium text-sm">{selected.error}</p>
                <p className="text-red-400/70 text-xs mt-2">Please try again or contact support</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-lg border border-cyan-200/15">
                  <div className="text-sm text-gray-400">ID</div>
                  <div className="text-white font-mono text-sm">{selected.id}</div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-cyan-200/15">
                  <div className="text-sm text-gray-400">Status</div>
                  <div className={selected.verified ? 'text-green-400' : 'text-yellow-400'}>
                    {selected.verified ? 'Verified' : 'Unverified'}
                  </div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-cyan-200/15">
                  <div className="text-sm text-gray-400">Issuer</div>
                  <div className="text-white truncate">{selected.issuer}</div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-cyan-200/15">
                  <div className="text-sm text-gray-400">Subject</div>
                  <div className="text-white truncate">{selected.subject}</div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-cyan-200/15">
                  <div className="text-sm text-gray-400">Created</div>
                  <div className="text-white">
                    {selected.created_at
                      ? new Date(selected.created_at * 1000).toLocaleString()
                      : '-'}
                  </div>
                </div>
              </div>

              {/* Payload */}
              <div>
                <div className="text-sm font-medium text-gray-300 mb-2">Payload</div>
                <pre className="bg-black/30 p-4 rounded-lg overflow-auto text-sm text-gray-200 max-h-60">
                  {JSON.stringify(selected.payload || selected, null, 2)}
                </pre>
              </div>

              {/* Assessments */}
              {(selected.assessments?.length > 0 || selected.last_assessment) && (
                <div>
                  <div className="text-sm font-medium text-gray-300 mb-3">Assessment History</div>
                  <div className="space-y-3">
                    {(selected.assessments || [selected.last_assessment]).map((assessment, idx) => (
                      assessment && (
                        <div key={idx} className="bg-white/5 p-4 rounded-lg border border-cyan-200/15">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-semibold text-white">
                                Score: {assessment.score}
                              </span>
                              {assessment.created_at && (
                                <span className="text-sm text-gray-400">
                                  {new Date(assessment.created_at * 1000).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                          {assessment.offers && (
                            <div>
                              <div className="text-sm text-gray-400 mb-1">Offers:</div>
                              <pre className="text-xs text-gray-300 overflow-auto bg-black/20 p-2 rounded">
                                {JSON.stringify(assessment.offers, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}

              {/* Export Button */}
              <div className="flex justify-end pt-4 border-t border-white/10">
                <button
                  onClick={onExport}
                  className="px-6 py-2 bg-gradient-to-r from-amber-200 to-cyan-200 text-slate-900 rounded-lg transition-colors duration-200 font-semibold hover:from-amber-100 hover:to-cyan-100"
                >
                  Export Attestation CSV
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LenderDashboard() {
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [filters, setFilters] = useState({
    issuer: '',
    subject: '',
    verified: ''
  });

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ issuer: '', subject: '', verified: '' });
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/attestations/summary`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (error) {
      console.debug('Summary fetch failed:', error);
    }
  }, []);

  const fetchPage = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        per_page: perPage.toString(),
        ...(filters.issuer && { issuer: filters.issuer }),
        ...(filters.subject && { subject: filters.subject }),
        ...(filters.verified && { verified: filters.verified })
      });

      const res = await fetch(
        `${API_BASE}/api/admin/attestations?${params.toString()}`,
        { credentials: 'include' }
      );

      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
        setPage(data.page || pageNum);
      }
    } catch (error) {
      console.debug('Attestations fetch failed:', error);
    } finally {
      setLoading(false);
    }
  }, [perPage, filters]);

  const exportData = useCallback(async (endpoint, filename, params = {}) => {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
        ...(filters.issuer && { issuer: filters.issuer }),
        ...(filters.subject && { subject: filters.subject }),
        ...(filters.verified && { verified: filters.verified }),
        ...params
      });

      const url = `${API_BASE}${endpoint}?${queryParams.toString()}`;
      const response = await fetch(url, { credentials: 'include' });

      if (!response.ok) throw new Error('Export failed');

      const text = await response.text();
      const blob = new Blob([text], { type: 'text/csv' });
      const urlObject = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = urlObject;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(urlObject);
    } catch (error) {
      console.debug('Export failed:', error);
      // addToast?.({ type: 'error', message: 'Export failed' });
    }
  }, [page, perPage, filters]);

  const exportSelected = useCallback(async () => {
    if (selectedIds.length === 0) return;

    try {
      const promises = selectedIds.map(id =>
        fetch(`${API_BASE}/api/admin/attestations/${id}/detail`, {
          credentials: 'include'
        })
          .then(res => res.ok ? res.json() : null)
          .catch(() => null)
      );

      const results = await Promise.all(promises);
      const validResults = results.filter(Boolean);

      const headers = [
        'id', 'issuer', 'subject', 'data_cid', 'pin_cid', 
        'verified', 'created_at', 'last_score', 'assessments'
      ];

      const rows = validResults.map(result => [
        result.id,
        result.issuer || '',
        result.subject || '',
        result.data_cid || '',
        result.pin_cid || '',
        result.verified ? 1 : 0,
        result.created_at || '',
        result.assessments?.[0]?.score || '',
        JSON.stringify(result.assessments || [])
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => 
          typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell
        ).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attestations-selected-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.debug('Export selected failed:', error);
    }
  }, [selectedIds]);

  const fetchDetails = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/attestations/${id}/detail`,
        { credentials: 'include' }
      );

      if (res.ok) {
        const data = await res.json();
        setSelected(data);
      } else {
        // Fallback to non-admin endpoint
        const fallback = await fetch(
          `${API_BASE}/api/attestations/${id}`,
          { credentials: 'include' }
        );
        if (fallback.ok) {
          const data = await fallback.json();
          setSelected(data);
        } else {
          setSelected({ error: 'Failed to load attestation details' });
        }
      }
    } catch (error) {
      setSelected({ error: 'Exception loading details' });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const toggleSelectItem = useCallback((id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    );
  }, []);

  const selectAllItems = useCallback((checked) => {
    setSelectedIds(checked ? items.map(item => item.id) : []);
  }, [items]);

  // Effects
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-cyan-200/20 p-3 sm:p-6 shadow-xl shadow-cyan-500/5 animate-fade-in-up">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Lender Dashboard</h1>
          <p className="text-gray-400">Manage and monitor attestations</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Stat title="Total Attestations" value={summary?.total} />
          <Stat title="Verified" value={summary?.verified} />
          <Stat title="Unverified" value={summary?.unverified} />
        </div>

        {/* Recent Attestations */}
        {summary?.recent && summary.recent.length > 0 && (
          <div className="mb-6 sm:mb-8 bg-white/5 rounded-xl border border-cyan-200/20 p-4 sm:p-6 animate-fade-in-up">
            <h3 className="text-lg font-semibold text-white mb-4">Recent Attestations</h3>
            <div className="space-y-3">
              {summary.recent.map((recent, idx) => (
                <div
                  key={recent.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/5 rounded-lg border border-cyan-200/20 hover:bg-cyan-500/10 transition-colors duration-200 stagger-item"
                  style={{ animationDelay: `${Math.min(idx * 55, 300)}ms` }}
                >
                  <div className="flex-1">
                    <div className="text-white font-medium mb-1">
                      ID: {recent.id} — {recent.subject}
                    </div>
                    <div className="text-sm text-gray-400">
                      Issuer: {recent.issuer}
                    </div>
                  </div>
                  <div className="text-sm text-gray-400 mt-2 sm:mt-0">
                    {recent.created_at
                      ? new Date(recent.created_at * 1000).toLocaleString()
                      : 'Unknown date'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white/5 rounded-xl border border-cyan-200/20 p-4 sm:p-6 animate-fade-in-up">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <h3 className="text-xl font-semibold text-white mb-4 lg:mb-0">
              All Attestations {total > 0 && `(${total.toLocaleString()})`}
            </h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={exportSelected}
                disabled={selectedIds.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 font-medium"
              >
                Export Selected ({selectedIds.length})
              </button>
              <button
                onClick={() => exportData('/api/admin/attestations/export', 'attestations.csv')}
                className="px-4 py-2 bg-gradient-to-r from-amber-200 to-cyan-200 text-slate-900 rounded-lg transition-colors duration-200 font-semibold hover:from-amber-100 hover:to-cyan-100"
              >
                Export All CSV
              </button>
            </div>
          </div>

          {/* Filters */}
          <FilterBar
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={resetFilters}
          />

          {/* Table */}
          <AttestationTable
            items={items}
            selectedIds={selectedIds}
            onSelectAll={selectAllItems}
            onSelectItem={toggleSelectItem}
            onItemClick={fetchDetails}
            loading={loading}
          />

          {/* Pagination */}
          {total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-6 border-t border-white/10">
              <div className="text-sm text-gray-400 mb-4 sm:mb-0">
                Page {page} of {totalPages} • {total.toLocaleString()} total items
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 bg-white/10 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchPage(page + 1)}
                  disabled={page >= totalPages}
                  className="px-4 py-2 bg-white/10 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <DetailModal
        selected={selected}
        loading={detailLoading}
        onClose={() => setSelected(null)}
        onExport={() => selected && exportData(
          '/api/admin/attestations/export',
          `attestation-${selected.id}.csv`,
          { id: selected.id }
        )}
      />
    </div>
  );
}