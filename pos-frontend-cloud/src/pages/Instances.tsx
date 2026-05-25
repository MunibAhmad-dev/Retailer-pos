import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Filter, Monitor, Loader2,
  RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { instancesApi, Instance } from '../api';
import clsx from 'clsx';

const STATUS_OPTS = [
  { value: '',         label: 'All' },
  { value: 'pending',  label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'blocked',  label: 'Blocked' },
];

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtRs(n: number) { return 'Rs ' + fmt(n); }

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

export default function Instances() {
  const [instances, setInstances]  = useState<Instance[]>([]);
  const [total, setTotal]          = useState(0);
  const [loading, setLoading]      = useState(true);
  const [search, setSearch]        = useState('');
  const [statusFilter, setStatus]  = useState('');
  const [page, setPage]            = useState(0);

  const load = useCallback(async (q: string, st: string, pg: number) => {
    setLoading(true);
    try {
      const res = await instancesApi.list({
        search: q || undefined,
        status: st || undefined,
        limit: PAGE_SIZE,
        offset: pg * PAGE_SIZE,
      });
      setInstances(res.data);
      setTotal(res.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(search, statusFilter, page); }, [load, search, statusFilter, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = (v: string) => { setSearch(v); setPage(0); };
  const handleStatus = (v: string) => { setStatus(v); setPage(0); };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">POS Instances</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} registered shops</p>
        </div>
        <button
          onClick={() => load(search, statusFilter, page)}
          className="btn-ghost"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search store, owner, mobile…"
            className="input pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 rounded-lg p-1">
          <Filter size={14} className="text-gray-500 ml-2" />
          {STATUS_OPTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleStatus(opt.value)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                statusFilter === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          </div>
        ) : instances.length === 0 ? (
          <div className="py-20 text-center">
            <Monitor className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No instances found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['Store / Owner', 'Mobile', 'License', 'Status', 'Revenue', 'Sales', 'Last Seen', ''].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {instances.map((inst) => (
                    <tr key={inst.instance_id} className="table-row-hover">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-gray-100 truncate max-w-[160px]">
                          {inst.store_name || '—'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[160px]">
                          {inst.owner_name || inst.instance_id}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-400">{inst.owner_mobile}</td>
                      <td className="px-5 py-3.5">
                        {inst.license_plan ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-500/10 border border-violet-500/20 text-violet-400">
                            {inst.license_plan}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={inst.approval_status} /></td>
                      <td className="px-5 py-3.5 text-gray-300 tabular-nums">{fmtRs(inst.total_revenue ?? 0)}</td>
                      <td className="px-5 py-3.5 text-gray-400 tabular-nums">{fmt(inst.total_sales ?? 0)}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{timeAgo(inst.last_seen)}</td>
                      <td className="px-5 py-3.5">
                        <Link
                          to={`/instances/${inst.instance_id}`}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800">
                <p className="text-xs text-gray-500">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs text-gray-400">{page + 1} / {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
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
