import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Monitor, RefreshCw, Download, ChevronLeft, ChevronRight,
  Eye, ShieldBan, ChevronDown, Clock, ShieldCheck,
} from 'lucide-react';
import * as api from '../api';
import type { Instance } from '../api';
import {
  cn, fmt, fmtRs, fmtDate, timeAgo, daysUntil, downloadJson,
} from '../lib/utils';
import {
  Spinner, Badge, StatCard, SearchInput, DateRangePicker,
  ActionButton, EmptyState, Tabs, PlanBadge,
} from '../components/ui';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const PLANS = [
  { label: 'Monthly',    value: 'monthly',    days: 30 },
  { label: 'Quarterly',  value: 'quarterly',  days: 90 },
  { label: 'Yearly',     value: 'yearly',     days: 365 },
  { label: 'Lifetime',   value: 'lifetime',   days: 36500 },
];

const STATUS_TABS = [
  { key: 'all',       label: 'All' },
  { key: 'approved',  label: 'Active' },
  { key: 'pending',   label: 'Pending' },
  { key: 'blocked',   label: 'Suspended' },
  { key: 'expired',   label: 'Expired' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isExpired(inst: Instance): boolean {
  if (!inst.license_expiry) return false;
  return daysUntil(inst.license_expiry) < 0;
}

function isExpiringSoon(inst: Instance): boolean {
  const d = daysUntil(inst.license_expiry);
  return d >= 0 && d <= 14;
}

function toYMD(d: Date) {
  return d.toISOString().split('T')[0];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Approval status badge — auto-maps to correct color */
function StatusBadge({ inst }: { inst: Instance }) {
  const expired = isExpired(inst);
  if (expired) return <Badge status="expired">Expired</Badge>;
  if (inst.approval_status === 'approved') return <Badge status="approved">Active</Badge>;
  if (inst.approval_status === 'pending')  return <Badge status="pending">Pending</Badge>;
  return <Badge status="blocked">Suspended</Badge>;
}

/** License column showing plan badge + expiry */
function LicenseCell({ inst }: { inst: Instance }) {
  const days = daysUntil(inst.license_expiry);
  const expired = days < 0;
  const soon = days >= 0 && days <= 14;

  return (
    <div className="flex flex-col gap-1">
      {inst.license_plan ? (
        <PlanBadge plan={inst.license_plan} />
      ) : (
        <span className="text-xs text-slate-400 dark:text-slate-600">No plan</span>
      )}
      {inst.license_expiry && (
        <span
          className={cn(
            'text-[11px] font-medium',
            expired
              ? 'text-rose-400'
              : soon
              ? 'text-amber-400'
              : 'text-slate-400 dark:text-slate-500'
          )}
        >
          {expired
            ? `Expired ${fmtDate(inst.license_expiry)}`
            : soon
            ? `Expires in ${days}d`
            : fmtDate(inst.license_expiry)}
        </span>
      )}
    </div>
  );
}

/** Approve dropdown for a single row */
function ApproveDropdown({
  inst,
  onApproved,
}: {
  inst: Instance;
  onApproved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleApprove = async (plan: string, days: number) => {
    setOpen(false);
    setLoading(true);
    try {
      await api.approveInstance(inst.instance_id, { plan, duration_days: days });
      onApproved();
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        disabled={loading}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all',
          'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          'hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {loading ? (
          <Spinner className="h-3 w-3" />
        ) : (
          <>
            Approve
            <ChevronDown size={11} />
          </>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-36 rounded-xl border border-white/10 bg-[#0f172a] shadow-xl py-1">
          {PLANS.map((p) => (
            <button
              key={p.value}
              onClick={() => handleApprove(p.value, p.days)}
              className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              {p.label}
              <span className="ml-1 text-slate-600">({p.days === 36500 ? '∞' : `${p.days}d`})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Instances() {
  const navigate = useNavigate();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch]           = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const [statusTab, setStatusTab]     = useState('all');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');

  // ── Data state ────────────────────────────────────────────────────────────
  const [instances, setInstances]     = useState<Instance[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [page, setPage]               = useState(0);

  // ── Action state ──────────────────────────────────────────────────────────
  const [blockingId, setBlockingId]   = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // ── Debounce search ───────────────────────────────────────────────────────
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setPage(0);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebounced(val), 300);
  }, []);

  // ── API call ──────────────────────────────────────────────────────────────
  const loadInstances = useCallback(async (
    q: string,
    status: string,
    pg: number,
    df: string,
    dt: string,
  ) => {
    setLoading(true);
    try {
      // "expired" is a client-side filter — fetch approved + all and filter
      const apiStatus = status === 'expired' ? 'approved' : status === 'all' ? '' : status;

      const res = await api.getInstances({
        search: q || undefined,
        status: apiStatus || undefined,
        limit: PAGE_SIZE,
        offset: pg * PAGE_SIZE,
        date_from: df || undefined,
        date_to: dt || undefined,
      });

      // Client-side filter for "expired" tab
      if (status === 'expired') {
        const expired = res.data.filter(isExpired);
        setInstances(expired);
        setTotal(expired.length);
      } else {
        setInstances(res.data);
        setTotal(res.total);
      }
    } catch (err) {
      console.error('Failed to load instances:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstances(debouncedSearch, statusTab, page, dateFrom, dateTo);
  }, [loadInstances, debouncedSearch, statusTab, page, dateFrom, dateTo]);

  const refresh = useCallback(() => {
    loadInstances(debouncedSearch, statusTab, page, dateFrom, dateTo);
  }, [loadInstances, debouncedSearch, statusTab, page, dateFrom, dateTo]);

  // ── Tab counts from current data ──────────────────────────────────────────
  // We always show count from the currently-loaded slice for stat chips
  const counts = useMemo(() => {
    const approved = instances.filter((i) => i.approval_status === 'approved' && !isExpired(i)).length;
    const pending  = instances.filter((i) => i.approval_status === 'pending').length;
    const blocked  = instances.filter((i) => i.approval_status === 'blocked').length;
    return { total: instances.length, approved, pending, blocked };
  }, [instances]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Block action ──────────────────────────────────────────────────────────
  const handleBlock = useCallback(async (inst: Instance) => {
    if (!window.confirm(`Block "${inst.store_name}"? This will prevent the POS from syncing.`)) return;
    setBlockingId(inst.instance_id);
    try {
      await api.blockInstance(inst.instance_id, 'Blocked by admin');
      refresh();
    } catch (err) {
      console.error('Block failed:', err);
    } finally {
      setBlockingId(null);
    }
  }, [refresh]);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExportAll = useCallback(async () => {
    setExportingAll(true);
    try {
      const data = await api.exportAll(statusTab !== 'all' ? statusTab : undefined);
      downloadJson(data, `pos_instances_${toYMD(new Date())}.json`);
    } catch (err) {
      console.error('Export all failed:', err);
    } finally {
      setExportingAll(false);
    }
  }, [statusTab]);

  const handleExportRow = useCallback(async (inst: Instance) => {
    setExportingId(inst.instance_id);
    try {
      const data = await api.exportInstance(inst.instance_id);
      const safeName = (inst.store_name || inst.instance_id).replace(/[^a-z0-9]/gi, '_').toLowerCase();
      downloadJson(data, `pos_${safeName}_${toYMD(new Date())}.json`);
    } catch (err) {
      console.error('Export instance failed:', err);
    } finally {
      setExportingId(null);
    }
  }, []);

  // ── Tab change ────────────────────────────────────────────────────────────
  const handleTabChange = useCallback((key: string) => {
    setStatusTab(key);
    setPage(0);
  }, []);

  // ── Date presets ──────────────────────────────────────────────────────────
  const DATE_PRESETS = useMemo(() => {
    const now = new Date();
    const today = toYMD(now);
    const d7 = toYMD(new Date(now.getTime() - 6 * 86400000));
    const d30 = toYMD(new Date(now.getTime() - 29 * 86400000));
    return [
      { label: 'Today',    from: today, to: today },
      { label: 'Last 7d',  from: d7,    to: today },
      { label: 'Last 30d', from: d30,   to: today },
    ];
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">POS Instances</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Loading…' : `${fmt(total)} total instance${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ActionButton
            label={exportingAll ? 'Exporting…' : 'Export All JSON'}
            icon={<Download size={14} />}
            variant="secondary"
            loading={exportingAll}
            onClick={handleExportAll}
          />
          <ActionButton
            label="Refresh"
            icon={<RefreshCw size={14} />}
            variant="secondary"
            onClick={refresh}
            disabled={loading}
          />
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Row 1: search + status tabs */}
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={handleSearch}
            placeholder="Search store name, owner, mobile…"
            className="w-72 shrink-0"
          />
          <Tabs
            tabs={STATUS_TABS}
            active={statusTab}
            onChange={handleTabChange}
          />
        </div>

        {/* Row 2: date range */}
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onFromChange={(v) => { setDateFrom(v); setPage(0); }}
          onToChange={(v) => { setDateTo(v); setPage(0); }}
          presets={DATE_PRESETS}
        />
      </div>

      {/* ── Summary Stat Chips ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          title="Total"
          value={fmt(counts.total)}
          icon={<Monitor size={18} />}
          color="blue"
        />
        <StatCard
          title="Active"
          value={fmt(counts.approved)}
          icon={<ShieldCheck size={18} />}
          color="emerald"
        />
        <StatCard
          title="Pending"
          value={fmt(counts.pending)}
          icon={<Clock size={18} />}
          color="amber"
        />
        <StatCard
          title="Blocked"
          value={fmt(counts.blocked)}
          icon={<ShieldBan size={18} />}
          color="rose"
        />
      </div>

      {/* ── Instance Table ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
                {[
                  { label: 'Store',     width: '200px' },
                  { label: 'Owner',     width: '160px' },
                  { label: 'Status',    width: '100px' },
                  { label: 'License',   width: '160px' },
                  { label: 'Last Seen', width: '110px' },
                  { label: 'Revenue',   width: '120px', align: 'right' as const },
                  { label: 'Actions',   width: '220px', align: 'right' as const },
                ].map((col) => (
                  <th
                    key={col.label}
                    style={{ width: col.width }}
                    className={cn(
                      'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap',
                      col.align === 'right' ? 'text-right' : 'text-left'
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex justify-center">
                      <Spinner />
                    </div>
                  </td>
                </tr>
              ) : instances.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={<Monitor size={26} />}
                      title="No instances found"
                      description={
                        debouncedSearch || statusTab !== 'all' || dateFrom
                          ? 'Try adjusting your filters or search term.'
                          : 'No POS instances have registered yet.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                instances.map((inst) => (
                  <InstanceRow
                    key={inst.instance_id}
                    inst={inst}
                    blockingId={blockingId}
                    exportingId={exportingId}
                    onView={() => navigate(`/instances/${inst.instance_id}`)}
                    onApproved={refresh}
                    onBlock={() => handleBlock(inst)}
                    onExport={() => handleExportRow(inst)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ──────────────────────────────────────────────────── */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-white/10">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing{' '}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {fmt(page * PAGE_SIZE + 1)}–{fmt(Math.min((page + 1) * PAGE_SIZE, total))}
              </span>{' '}
              of <span className="font-medium text-slate-700 dark:text-slate-300">{fmt(total)}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="px-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
                aria-label="Next page"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Instance Row ─────────────────────────────────────────────────────────────

interface RowProps {
  inst: Instance;
  blockingId: string | null;
  exportingId: string | null;
  onView: () => void;
  onApproved: () => void;
  onBlock: () => void;
  onExport: () => void;
}

function InstanceRow({
  inst, blockingId, exportingId, onView, onApproved, onBlock, onExport,
}: RowProps) {
  const isBlocking  = blockingId  === inst.instance_id;
  const isExporting = exportingId === inst.instance_id;
  const expiringSoon = isExpiringSoon(inst);
  const expired     = isExpired(inst);

  return (
    <tr className={cn(
      'border-b border-slate-100 dark:border-white/5 last:border-0 transition-colors',
      'hover:bg-slate-50 dark:hover:bg-white/[0.02]',
      (expired || inst.approval_status === 'blocked') && 'opacity-75'
    )}>
      {/* Store */}
      <td className="px-4 py-3.5">
        <button
          onClick={onView}
          className="text-left group"
        >
          <p className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors truncate max-w-[180px]">
            {inst.store_name || '—'}
          </p>
          {inst.business_name && inst.business_name !== inst.store_name && (
            <p className="text-xs text-slate-500 dark:text-slate-500 truncate max-w-[180px] mt-0.5">
              {inst.business_name}
            </p>
          )}
        </button>
      </td>

      {/* Owner */}
      <td className="px-4 py-3.5">
        <p className="text-sm text-slate-700 dark:text-slate-300 font-medium truncate max-w-[150px]">
          {inst.owner_name || '—'}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">
          {inst.owner_mobile}
        </p>
      </td>

      {/* Status */}
      <td className="px-4 py-3.5">
        <StatusBadge inst={inst} />
      </td>

      {/* License */}
      <td className="px-4 py-3.5">
        <LicenseCell inst={inst} />
      </td>

      {/* Last Seen */}
      <td className="px-4 py-3.5">
        <span className={cn(
          'text-xs',
          inst.last_seen
            ? 'text-slate-500 dark:text-slate-400'
            : 'text-slate-400 dark:text-slate-600'
        )}>
          {timeAgo(inst.last_seen)}
        </span>
      </td>

      {/* Revenue */}
      <td className="px-4 py-3.5 text-right">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 tabular-nums">
          {fmtRs(inst.total_revenue ?? 0)}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-1.5">
          {/* View */}
          <button
            onClick={onView}
            title="View details"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-all"
          >
            <Eye size={12} />
            View
          </button>

          {/* Approve dropdown (only when not already approved + not blocked) */}
          {inst.approval_status !== 'blocked' && (
            <ApproveDropdown inst={inst} onApproved={onApproved} />
          )}

          {/* Block (only when not already blocked) */}
          {inst.approval_status !== 'blocked' && (
            <button
              onClick={onBlock}
              disabled={isBlocking}
              title="Block this instance"
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all',
                'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isBlocking ? (
                <Spinner className="h-3 w-3" />
              ) : (
                <ShieldBan size={12} />
              )}
              Block
            </button>
          )}

          {/* Export */}
          <button
            onClick={onExport}
            disabled={isExporting}
            title="Export instance data as JSON"
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 px-2.5 py-1.5 text-xs font-medium transition-all',
              'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isExporting ? (
              <Spinner className="h-3 w-3" />
            ) : (
              <Download size={12} />
            )}
            Export
          </button>
        </div>
      </td>
    </tr>
  );
}
