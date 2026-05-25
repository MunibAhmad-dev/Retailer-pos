import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Filter, Monitor, Loader2,
  RefreshCw, ChevronLeft, ChevronRight, Download, Calendar,
  GitBranch, Building2, LayoutList, LayoutGrid,
} from 'lucide-react';
import { instancesApi, Instance } from '../api';
import clsx from 'clsx';

// ── helpers ───────────────────────────────────────────────────────────────────

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_OPTS = [
  { value: '',         label: 'All' },
  { value: 'pending',  label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'blocked',  label: 'Blocked' },
];

type DatePreset = 'today' | 'week' | 'month' | 'custom';

function toYMD(d: Date) {
  return d.toISOString().split('T')[0];
}

function getPresetDates(preset: DatePreset): { from: string; to: string } | null {
  const now = new Date();
  const to  = toYMD(now);
  if (preset === 'today')  return { from: to, to };
  if (preset === 'week')   { const d = new Date(now); d.setDate(d.getDate() - 6); return { from: toYMD(d), to }; }
  if (preset === 'month')  { const d = new Date(now); d.setDate(d.getDate() - 29); return { from: toYMD(d), to }; }
  return null; // custom — caller provides dates
}

function presetLabel(preset: DatePreset) {
  if (preset === 'today') return 'Today';
  if (preset === 'week')  return 'Last 7 Days';
  if (preset === 'month') return 'Last 30 Days';
  return 'Custom';
}

function fmt(n: number) {
  return Math.round(n ?? 0).toLocaleString('en-PK');
}

function fmtRs(n: number) { return 'PKR ' + Math.round(n ?? 0).toLocaleString('en-PK'); }

function timeAgo(dateStr?: string) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days  > 0)  return `${days}d ago`;
  if (hours > 0)  return `${hours}h ago`;
  if (mins  > 0)  return `${mins}m ago`;
  return 'Just now';
}

function StatusBadge({ status }: { status: Instance['approval_status'] }) {
  return (
    <span className={clsx(
      status === 'approved' ? 'badge-approved' :
      status === 'pending'  ? 'badge-pending'  : 'badge-blocked'
    )}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

const PAGE_SIZE = 20;

interface BusinessGroup {
  owner_mobile: string;
  owner_name: string;
  business_name: string;
  branches: Instance[];
  total_revenue: number;
  total_sales: number;
}

function groupByBusiness(instances: Instance[]): BusinessGroup[] {
  const map = new Map<string, BusinessGroup>();
  for (const inst of instances) {
    const key = inst.owner_mobile;
    if (!map.has(key)) {
      map.set(key, {
        owner_mobile:  inst.owner_mobile,
        owner_name:    inst.owner_name || '',
        business_name: inst.business_name || inst.store_name || '',
        branches:      [],
        total_revenue: 0,
        total_sales:   0,
      });
    }
    const g = map.get(key)!;
    g.branches.push(inst);
    g.total_revenue += inst.total_revenue ?? 0;
    g.total_sales   += inst.total_sales   ?? 0;
  }
  return Array.from(map.values()).sort((a, b) => b.total_revenue - a.total_revenue);
}

export default function Instances() {
  const [instances, setInstances]       = useState<Instance[]>([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatus]       = useState('');
  const [page, setPage]                 = useState(0);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingId, setExportingId]   = useState<string | null>(null);
  const [viewMode, setViewMode]         = useState<'list' | 'business'>('list');

  // Date filter — default to Custom with today as both from/to
  const todayStr = toYMD(new Date());
  const [datePreset, setDatePreset] = useState<DatePreset>('custom');
  const [dateFrom, setDateFrom]     = useState(todayStr);
  const [dateTo, setDateTo]         = useState(todayStr);

  // Resolved date range sent to API
  function resolvedRange(): { date_from?: string; date_to?: string } {
    if (datePreset === 'custom') {
      if (dateFrom && dateTo) return { date_from: dateFrom, date_to: dateTo };
      return {};
    }
    const r = getPresetDates(datePreset);
    return r ? { date_from: r.from, date_to: r.to } : {};
  }

  const load = useCallback(async (q: string, st: string, pg: number, df: string, dt: string, preset: DatePreset) => {
    setLoading(true);
    try {
      let dateParams: { date_from?: string; date_to?: string } = {};
      if (preset !== 'custom') {
        const r = getPresetDates(preset);
        if (r) dateParams = { date_from: r.from, date_to: r.to };
      } else if (df && dt) {
        dateParams = { date_from: df, date_to: dt };
      }
      const res = await instancesApi.list({
        search: q || undefined,
        status: st || undefined,
        limit: PAGE_SIZE,
        offset: pg * PAGE_SIZE,
        ...dateParams,
      });
      setInstances(res.data);
      setTotal(res.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(search, statusFilter, page, dateFrom, dateTo, datePreset); }, [load, search, statusFilter, page, dateFrom, dateTo, datePreset]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = (v: string) => { setSearch(v); setPage(0); };
  const handleStatus = (v: string) => { setStatus(v); setPage(0); };
  const handlePreset = (p: DatePreset) => {
    setDatePreset(p);
    setPage(0);
    if (p !== 'custom') {
      const r = getPresetDates(p);
      if (r) { setDateFrom(r.from); setDateTo(r.to); }
    }
  };

  // Label shown above Revenue/Sales columns
  const periodLabel = (() => {
    const r = resolvedRange();
    if (!r.date_from) return '(All Time)';
    if (r.date_from === r.date_to) return `(${r.date_from})`;
    return `(${r.date_from} → ${r.date_to})`;
  })();

  const handleExportAll = async () => {
    setExportingAll(true);
    try {
      const data = await instancesApi.exportAll(statusFilter ? { status: statusFilter } : undefined);
      const date = new Date().toISOString().split('T')[0];
      downloadJson(data, `pos_all_instances_${date}.json`);
    } catch (e) {
      console.error('Export all failed:', e);
    } finally {
      setExportingAll(false);
    }
  };

  const handleExportInstance = async (instanceId: string, storeName: string) => {
    setExportingId(instanceId);
    try {
      const data = await instancesApi.export(instanceId);
      const date = new Date().toISOString().split('T')[0];
      const safeName = (storeName || instanceId).replace(/[^a-z0-9]/gi, '_').toLowerCase();
      downloadJson(data, `pos_export_${safeName}_${date}.json`);
    } catch (e) {
      console.error('Export instance failed:', e);
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">POS Instances</h1>
          <p className="text-sm text-slate-500 dark:text-gray-500 mt-0.5">{total} registered shops</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-1 gap-0.5">
            <button onClick={() => setViewMode('list')} title="List view"
              className={clsx('p-1.5 rounded-md transition-all', viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800')}>
              <LayoutList size={15} />
            </button>
            <button onClick={() => setViewMode('business')} title="Business view — grouped by owner"
              className={clsx('p-1.5 rounded-md transition-all', viewMode === 'business' ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800')}>
              <Building2 size={15} />
            </button>
          </div>
          <button onClick={handleExportAll} disabled={exportingAll} className="btn-ghost"
            title="Export all instances to a single JSON file (POS-importable)">
            {exportingAll ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Export All
          </button>
          <button onClick={() => load(search, statusFilter, page, dateFrom, dateTo, datePreset)} className="btn-ghost">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-5">
        {/* Row 1: search + status */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search store, owner, mobile…"
              className="input pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-1">
            <Filter size={14} className="text-slate-400 dark:text-gray-500 ml-2" />
            {STATUS_OPTS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleStatus(opt.value)}
                className={clsx(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  statusFilter === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: date range filter */}
        <div className="flex flex-wrap items-center gap-2">
          <Calendar size={14} className="text-slate-400 dark:text-gray-500 flex-shrink-0" />

          {/* Quick presets */}
          {(['today', 'week', 'month', 'custom'] as DatePreset[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePreset(p)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                datePreset === p
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 hover:border-slate-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900'
              )}
            >
              {presetLabel(p)}
            </button>
          ))}

          {/* Custom date pickers — always visible but styled as active when preset=custom */}
          <div className={clsx(
            'flex items-center gap-1.5 border rounded-lg px-3 py-1.5 transition-all',
            datePreset === 'custom'
              ? 'border-blue-500/50 bg-blue-500/5'
              : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 opacity-50 pointer-events-none'
          )}>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || todayStr}
              onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
              className="text-xs bg-transparent text-slate-700 dark:text-gray-300 outline-none cursor-pointer"
            />
            <span className="text-slate-400 dark:text-gray-600 text-xs">→</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={todayStr}
              onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
              className="text-xs bg-transparent text-slate-700 dark:text-gray-300 outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Business View */}
      {viewMode === 'business' && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-20 flex items-center justify-center bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl">
              <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
            </div>
          ) : instances.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl">
              <Monitor className="w-10 h-10 text-slate-300 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-gray-500">No instances found</p>
            </div>
          ) : (
            groupByBusiness(instances).map((group) => (
              <div key={group.owner_mobile} className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden">
                {/* Business header */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-gray-800/60 border-b border-slate-200 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} className="text-blue-500 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{group.business_name || group.owner_name || group.owner_mobile}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5 font-mono">{group.owner_mobile} · {group.branches.length} branch{group.branches.length !== 1 ? 'es' : ''}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{fmtRs(group.total_revenue)}</p>
                    <p className="text-xs text-slate-500 dark:text-gray-500">{fmt(group.total_sales)} sales total</p>
                  </div>
                </div>
                {/* Branch cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                  {group.branches.map((inst) => (
                    <div key={inst.instance_id} className="border border-slate-200 dark:border-gray-700 rounded-xl p-3.5 hover:border-blue-400/50 dark:hover:border-blue-500/40 transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-gray-200 bg-slate-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                          <GitBranch size={10} />
                          {inst.branch_name || 'Main Branch'}
                        </span>
                        <StatusBadge status={inst.approval_status} />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-gray-500 mb-2">{inst.store_name}</p>
                      <div className="grid grid-cols-2 gap-1.5 mb-3">
                        <div className="bg-slate-50 dark:bg-gray-800/60 rounded-lg p-2">
                          <p className="text-[10px] text-slate-500 dark:text-gray-500 uppercase tracking-wide">Revenue</p>
                          <p className="text-xs font-bold text-slate-800 dark:text-gray-100 tabular-nums mt-0.5">{fmtRs(inst.total_revenue ?? 0)}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-gray-800/60 rounded-lg p-2">
                          <p className="text-[10px] text-slate-500 dark:text-gray-500 uppercase tracking-wide">Sales</p>
                          <p className="text-xs font-bold text-slate-800 dark:text-gray-100 tabular-nums mt-0.5">{fmt(inst.total_sales ?? 0)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 dark:text-gray-600">{timeAgo(inst.last_seen)}</span>
                        <Link to={`/instances/${inst.instance_id}`}
                          className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 font-semibold transition-colors">
                          View →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* List Table */}
      <div className={clsx('bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden', viewMode === 'business' && 'hidden')}>
        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          </div>
        ) : instances.length === 0 ? (
          <div className="py-20 text-center">
            <Monitor className="w-10 h-10 text-slate-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-gray-500">No instances found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-gray-800">
                    {[
                      'Store / Owner', 'Branch', 'Mobile', 'Plan', 'Status',
                      `Revenue ${periodLabel}`,
                      `Sales ${periodLabel}`,
                      'Last Seen', 'Actions',
                    ].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-medium text-slate-500 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-gray-800/60">
                  {instances.map((inst) => (
                    <tr key={inst.instance_id} className="table-row-hover">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800 dark:text-gray-100 truncate max-w-[160px]">
                          {inst.store_name || '—'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5 truncate max-w-[160px]">
                          {inst.owner_name || inst.instance_id}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 px-2 py-0.5 rounded-full max-w-[120px] truncate">
                          <GitBranch size={10} className="flex-shrink-0" />
                          {inst.branch_name || 'Main Branch'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500 dark:text-gray-400">{inst.owner_mobile}</td>
                      <td className="px-5 py-3.5">
                        {inst.license_plan ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 capitalize">
                            {inst.license_plan}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={inst.approval_status} /></td>
                      <td className="px-5 py-3.5 text-slate-700 dark:text-gray-300 tabular-nums">{fmtRs(inst.total_revenue ?? 0)}</td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-gray-400 tabular-nums">{fmt(inst.total_sales ?? 0)}</td>
                      <td className="px-5 py-3.5 text-slate-400 dark:text-gray-500 text-xs whitespace-nowrap">{timeAgo(inst.last_seen)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/instances/${inst.instance_id}`}
                            className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors whitespace-nowrap"
                          >
                            View →
                          </Link>
                          <button
                            onClick={() => handleExportInstance(inst.instance_id, inst.store_name)}
                            disabled={exportingId === inst.instance_id}
                            className="text-xs text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 transition-colors flex items-center gap-1 whitespace-nowrap disabled:opacity-40"
                            title="Export this instance's data as POS-importable JSON"
                          >
                            {exportingId === inst.instance_id
                              ? <Loader2 size={12} className="animate-spin" />
                              : <Download size={12} />}
                            Export
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-gray-800">
                <p className="text-xs text-slate-500 dark:text-gray-500">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1.5 rounded-lg text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs text-slate-500 dark:text-gray-400">{page + 1} / {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-1.5 rounded-lg text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
