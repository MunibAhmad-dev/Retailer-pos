import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Monitor, Clock, ShieldX, ShieldCheck,
  Activity, TrendingUp, Key, Loader2,
  ArrowRight, Wifi, Users, Package,
  RefreshCw, Store, AlertTriangle, AlertCircle, CalendarX,
  BarChart2, Download, Banknote, TrendingDown, UserPlus, Wallet,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
  Legend, ComposedChart, Line,
} from 'recharts';
import { statsApi, instancesApi, analyticsApi, DashboardStats, Instance, AnalyticsData, ExpiringInstance } from '../api';
import clsx from 'clsx';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return Math.round(n ?? 0).toLocaleString('en-PK');
}
function fmtRs(n: number) { return 'PKR ' + Math.round(n ?? 0).toLocaleString('en-PK'); }
function timeAgo(dateStr?: string) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days  > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins  > 0) return `${mins}m ago`;
  return 'Just now';
}
function fmtDay(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
}
function fmtMonth(m: string) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-PK', { month: 'short', year: '2-digit' });
}

// ─── JSON download helper ────────────────────────────────────────────────────

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Date filter helpers ──────────────────────────────────────────────────────

type DashPreset = 'week' | 'month' | '3months' | 'custom';

function toYMD(d: Date) { return d.toISOString().split('T')[0]; }

function getPresetRange(preset: DashPreset): { from: string; to: string } | null {
  const now = new Date();
  const today = toYMD(now);
  if (preset === 'week')    return { from: toYMD(new Date(now.getTime() - 6   * 86400000)), to: today };
  if (preset === 'month')   return { from: toYMD(new Date(now.getTime() - 29  * 86400000)), to: today };
  if (preset === '3months') return { from: toYMD(new Date(now.getTime() - 89  * 86400000)), to: today };
  return null; // custom
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const PALETTE = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16'];

const PIE_COLORS: Record<string, string> = {
  approved: '#10b981',
  pending:  '#f59e0b',
  blocked:  '#ef4444',
};
const PLAN_COLORS: Record<string, string> = {
  monthly:   '#3b82f6',
  quarterly: '#8b5cf6',
  yearly:    '#f59e0b',
  lifetime:  '#10b981',
  none:      '#6b7280',
};
const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  cash:   '#10b981',
  bank:   '#3b82f6',
  credit: '#f59e0b',
  other:  '#8b5cf6',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className="stat-card">
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mb-3', color)}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
      <p className="text-sm text-slate-500 dark:text-gray-500">{label}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-5 py-4 border-b border-slate-200 dark:border-gray-800">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      {sub && <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

const customTooltipStyle = {
  backgroundColor: '#111827',
  border: '1px solid #1f2937',
  borderRadius: '8px',
  color: '#e5e7eb',
  fontSize: 12,
};

// ─── License Expiry Group ─────────────────────────────────────────────────────

type ExpiryTone = 'expired' | 'critical' | 'warning';

const EXPIRY_STYLES: Record<ExpiryTone, { border: string; bg: string; badge: string; badgeBg: string; icon: string; label: string }> = {
  expired:  { border: 'border-rose-500/30',  bg: 'bg-rose-500/5',   badge: 'text-rose-500 dark:text-rose-400',   badgeBg: 'bg-rose-500/10 border-rose-500/25',   icon: 'text-rose-500 dark:text-rose-400',   label: 'EXPIRED' },
  critical: { border: 'border-orange-500/30', bg: 'bg-orange-500/5', badge: 'text-orange-500 dark:text-orange-400', badgeBg: 'bg-orange-500/10 border-orange-500/25', icon: 'text-orange-500 dark:text-orange-400', label: 'CRITICAL' },
  warning:  { border: 'border-amber-500/30',  bg: 'bg-amber-500/5',  badge: 'text-amber-500 dark:text-amber-400',  badgeBg: 'bg-amber-500/10 border-amber-500/25',  icon: 'text-amber-500 dark:text-amber-400',  label: 'WARNING' },
};

function ExpiryGroup({ title, subtitle, items, tone }: {
  title: string; subtitle: string; items: ExpiringInstance[]; tone: ExpiryTone;
}) {
  const s = EXPIRY_STYLES[tone];
  const IconComp = tone === 'expired' ? CalendarX : AlertTriangle;
  return (
    <div className={clsx('rounded-2xl border overflow-hidden', s.border, s.bg)}>
      <div className={clsx('px-5 py-3 border-b flex items-center gap-2.5', s.border)}>
        <IconComp size={15} className={s.icon} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
          <span className="ml-2 text-xs text-slate-500 dark:text-gray-500">{subtitle}</span>
        </div>
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full border', s.badgeBg, s.badge)}>
          {s.label} · {items.length}
        </span>
      </div>
      <div className="divide-y divide-slate-200/60 dark:divide-white/5">
        {items.map((inst) => (
          <Link
            key={inst.instance_id}
            to={`/instances/${inst.instance_id}`}
            className="flex items-center gap-4 px-5 py-3 hover:bg-white/40 dark:hover:bg-white/5 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-gray-100 truncate">{inst.store_name || inst.owner_mobile}</p>
              <p className="text-xs text-slate-500 dark:text-gray-500 font-mono mt-0.5">{inst.owner_mobile}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-slate-500 dark:text-gray-400 capitalize">
                <span className="font-medium text-slate-700 dark:text-gray-300">{inst.license_plan || '—'}</span>
              </p>
              <p className={clsx('text-xs font-semibold mt-0.5', s.badge)}>
                {tone === 'expired'
                  ? `${inst.days_overdue ?? 0}d overdue`
                  : `${inst.days_left ?? 0}d left`}
              </p>
            </div>
            <ArrowRight size={14} className="text-slate-400 dark:text-gray-600 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [stats,     setStats]     = useState<DashboardStats | null>(null);
  const [recent,    setRecent]    = useState<Instance[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [seeding,   setSeeding]     = useState(false);
  const [datePreset, setDatePreset] = useState<DashPreset>('month');
  const [dateFrom, setDateFrom]     = useState(() => toYMD(new Date(Date.now() - 29 * 86400000)));
  const [dateTo, setDateTo]         = useState(() => toYMD(new Date()));

  const load = useCallback(async (showSpinner = true, from?: string, to?: string) => {
    if (showSpinner) setLoading(true); else setRefreshing(true);
    setLoadError(null);
    try {
      const dateParams = from && to ? { date_from: from, date_to: to } : undefined;

      // Run independently so a partial failure still populates what it can
      const [statsResult, instResult, anResult] = await Promise.allSettled([
        statsApi.get(),
        // Show all statuses so pending/blocked instances appear immediately
        instancesApi.list({ limit: 10 }),
        analyticsApi.get(dateParams),
      ]);

      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      else setLoadError(`Stats failed: ${(statsResult.reason as any)?.message ?? 'Network error'}`);

      if (instResult.status === 'fulfilled') setRecent(instResult.value.data);

      if (anResult.status === 'fulfilled') setAnalytics(anResult.value);
    } catch (err: any) {
      setLoadError(err?.message ?? 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleSeedDemo = async () => {
    if (!window.confirm('Seed the database with demo instances and sales data for testing? This cannot be undone.')) return;
    setSeeding(true);
    try {
      const { data } = await (await import('../api/client')).default.post('/admin/seed-demo');
      if (data.success) {
        alert(`✅ Seeded: ${data.data?.instances ?? 0} instances, ${data.data?.sales ?? 0} sales, ${data.data?.products ?? 0} products. Refreshing…`);
        load(true);
      } else {
        alert('Seed failed: ' + (data.error ?? 'Unknown error'));
      }
    } catch (err: any) {
      alert('Seed request failed: ' + (err?.response?.data?.error ?? err?.message ?? 'Check backend logs'));
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    const range = getPresetRange(datePreset);
    const from  = range ? range.from : dateFrom;
    const to    = range ? range.to   : dateTo;
    load(true, from, to);
  }, [load, datePreset, dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Chart data prep ───────────────────────────────────────────────────────

  const revenueData = (analytics?.revenueByInstance ?? []).map(r => ({
    name:       (r.store_name || r.owner_mobile || r.instance_id).slice(0, 16),
    revenue:    r.total_revenue,
    sales:      r.total_sales,
    fullName:   r.store_name || r.owner_mobile,
    instanceId: r.instance_id,
  }));

  const salesTrend = (analytics?.salesByDay ?? []).map(d => ({
    day:     fmtDay(d.day),
    revenue: d.revenue,
    sales:   d.sales_count,
    stores:  d.active_stores,
  }));

  const statusPie = (analytics?.statusDistribution ?? []).map(d => ({
    name:  d.status.charAt(0).toUpperCase() + d.status.slice(1),
    value: d.count,
    color: PIE_COLORS[d.status] ?? '#6b7280',
  }));

  const planPie = (analytics?.planDistribution ?? []).filter(d => d.count > 0).map(d => ({
    name:  d.plan.charAt(0).toUpperCase() + d.plan.slice(1),
    value: d.count,
    color: PLAN_COLORS[d.plan] ?? '#6b7280',
  }));

  const activityData = (analytics?.activityDistribution ?? []).map(d => ({
    period: d.period,
    count:  d.count,
  }));

  const topProducts = analytics?.topProducts ?? [];
  const totals      = analytics?.totals;

  // Max qty for bar scaling
  const maxQty = topProducts.length > 0 ? topProducts[0].qty : 1;

  // ── New chart data ────────────────────────────────────────────────────────
  const plData = (analytics?.profitLossData ?? []).map(d => ({
    ...d,
    monthLabel: fmtMonth(d.month),
  }));

  const regData = (analytics?.registrationsTrend ?? []).map(d => ({
    ...d,
    label: fmtMonth(d.month),
  }));

  const acctTypePie = (analytics?.accountStats?.typeDist ?? []).map(d => ({
    name:  d.account_type.charAt(0).toUpperCase() + d.account_type.slice(1),
    value: Math.round(d.total_balance),
    count: d.count,
    color: ACCOUNT_TYPE_COLORS[d.account_type.toLowerCase()] ?? '#6b7280',
  }));

  const acctTxnData = (analytics?.accountStats?.txnVolume ?? []).map(d => ({
    type:   d.txn_type.charAt(0).toUpperCase() + d.txn_type.slice(1),
    amount: Math.round(d.total_amount),
    count:  d.count,
    color:  d.txn_type.toLowerCase() === 'credit' ? '#10b981' : '#ef4444',
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-gray-500 mt-0.5">OsaTech POS Cloud — live store analytics</p>
        </div>
        <div className="flex gap-2">
          {stats && analytics && (
            <button
              onClick={() => downloadJson(
                { exportedAt: new Date().toISOString(), stats, analytics },
                `dashboard_export_${new Date().toISOString().slice(0,10)}.json`
              )}
              className="btn-ghost"
              title="Export dashboard data as JSON"
            >
              <Download size={16} />
              Export JSON
            </button>
          )}
          <button
            onClick={() => {
              const range = getPresetRange(datePreset);
              const from  = range ? range.from : dateFrom;
              const to    = range ? range.to   : dateTo;
              load(false, from, to);
            }}
            disabled={refreshing}
            className="btn-ghost"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {loadError && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/8 border border-rose-500/25 text-sm">
          <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-rose-600 dark:text-rose-400">Failed to load dashboard data</p>
            <p className="text-rose-500/80 dark:text-rose-400/70 mt-0.5 text-xs font-mono">{loadError}</p>
            <p className="text-slate-500 dark:text-gray-500 text-xs mt-1">Make sure the backend server is running and you are logged in.</p>
          </div>
          <button onClick={() => load(false)} className="text-xs text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 font-semibold underline underline-offset-2 shrink-0">Retry</button>
        </div>
      )}

      {/* ── Empty state with seed option (shown only when everything is 0 and no errors) ── */}
      {!loadError && stats && stats.totalInstances === 0 && recent.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 rounded-2xl border-2 border-dashed border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/30">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
            <Store size={26} className="text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="font-semibold text-slate-700 dark:text-gray-200 mb-1">No instances registered yet</h3>
          <p className="text-sm text-slate-500 dark:text-gray-500 text-center max-w-sm mb-5">
            No POS clients have registered with this backend yet. Connect a POS app or seed demo data to preview the dashboard.
          </p>
          <button
            onClick={handleSeedDemo}
            disabled={seeding}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {seeding ? <RefreshCw size={14} className="animate-spin" /> : <Package size={14} />}
            {seeding ? 'Seeding…' : 'Seed Demo Data'}
          </button>
        </div>
      )}

      {/* ── Top stat row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Instances"   value={stats?.totalInstances ?? 0}  icon={Monitor}     color="bg-blue-500/15 text-blue-500 dark:text-blue-400" />
        <StatCard label="Active Today"      value={stats?.activeToday ?? 0}     icon={Wifi}        color="bg-emerald-500/15 text-emerald-500 dark:text-emerald-400" sub={`${stats?.activeWeek ?? 0} this week`} />
        <StatCard label="Pending Approval"  value={stats?.pending ?? 0}         icon={Clock}       color="bg-amber-500/15 text-amber-500 dark:text-amber-400" />
        <StatCard label="Blocked"           value={stats?.blocked ?? 0}         icon={ShieldX}     color="bg-rose-500/15 text-rose-500 dark:text-rose-400" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Approved"        value={stats?.approved ?? 0}                                                   icon={ShieldCheck} color="bg-emerald-500/15 text-emerald-500 dark:text-emerald-400" />
        <StatCard label="Licenses Issued" value={stats?.licensesIssued ?? 0}                                             icon={Key}         color="bg-sky-500/15 text-sky-500 dark:text-sky-400"    sub={`${stats?.licensesAssigned ?? 0} assigned`} />
        <StatCard label="Online Rate"     value={stats && stats.totalInstances > 0 ? Math.round((stats.activeWeek / stats.totalInstances) * 100) + '%' : '0%'} icon={Activity} color="bg-teal-500/15 text-teal-500 dark:text-teal-400" sub="weekly" />
        <StatCard label="Sync Events"     value={fmt(analytics?.topEntityTypes?.reduce((a, b) => a + b.event_count, 0) ?? 0)} icon={Package}  color="bg-violet-500/15 text-violet-500 dark:text-violet-400" sub="total" />
      </div>

      {/* ── License Expiry Alerts ── */}
      {stats && (
        (stats.expired?.length > 0 || stats.expiringCritical?.length > 0 || stats.expiringWarning?.length > 0)
      ) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-500 dark:text-rose-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">License Alerts</h2>
            <span className="text-xs text-slate-500 dark:text-gray-500">
              {(stats!.expired?.length ?? 0) + (stats!.expiringCritical?.length ?? 0) + (stats!.expiringWarning?.length ?? 0)} instance(s) need attention
            </span>
          </div>

          {stats!.expired && stats!.expired.length > 0 && (
            <ExpiryGroup
              title="Expired Licenses"
              subtitle="These stores are using expired licenses"
              items={stats!.expired}
              tone="expired"
            />
          )}

          {stats!.expiringCritical && stats!.expiringCritical.length > 0 && (
            <ExpiryGroup
              title="Expiring in 7 Days"
              subtitle="Action required — contact these stores now"
              items={stats!.expiringCritical}
              tone="critical"
            />
          )}

          {stats!.expiringWarning && stats!.expiringWarning.length > 0 && (
            <ExpiryGroup
              title="Expiring in 30 Days"
              subtitle="Upcoming renewals — heads up"
              items={stats!.expiringWarning}
              tone="warning"
            />
          )}
        </div>
      )}

      {/* ── Date filter bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-500 dark:text-gray-500 font-medium">Period:</span>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-gray-800 rounded-xl p-0.5">
          {([
            { key: 'week'    as DashPreset, label: '1 Week'  },
            { key: 'month'   as DashPreset, label: '1 Month' },
            { key: '3months' as DashPreset, label: '3 Months'},
            { key: 'custom'  as DashPreset, label: 'Custom'  },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDatePreset(key)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                datePreset === key
                  ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {datePreset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="input py-1.5 text-xs h-8 w-36"
            />
            <span className="text-xs text-slate-400 dark:text-gray-600">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="input py-1.5 text-xs h-8 w-36"
            />
          </div>
        )}

        <span className="text-xs text-slate-400 dark:text-gray-600 ml-1">
          {(() => {
            const range = getPresetRange(datePreset);
            const from = range ? range.from : dateFrom;
            const to   = range ? range.to   : dateTo;
            return from === to ? from : `${from} → ${to}`;
          })()}
        </span>
      </div>

      {/* ── Revenue by Store (bar) + Status pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Revenue by store — horizontal bars */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <SectionHeader title="Revenue by Store" sub={`Top ${revenueData.length} earners · ${(() => { const r = getPresetRange(datePreset); return r ? `${r.from} → ${r.to}` : `${dateFrom} → ${dateTo}`; })()}`} />
          {revenueData.length === 0 ? (
            <div className="py-14 text-center">
              <TrendingUp className="w-8 h-8 text-slate-300 dark:text-gray-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-gray-500">No revenue data yet</p>
            </div>
          ) : (
            <div className="p-4">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueData} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:[stroke:#1f2937]" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => fmtRs(v)} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip
                    contentStyle={customTooltipStyle}
                    formatter={(v: number, name: string) => [
                      name === 'revenue' ? fmtRs(v) : fmt(v),
                      name === 'revenue' ? 'Revenue' : 'Sales',
                    ]}
                    labelFormatter={(_: string, payload: any[]) => payload?.[0]?.payload?.fullName || ''}
                  />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {revenueData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Status + Plan distribution pies */}
        <div className="flex flex-col gap-5">
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden flex-1">
            <SectionHeader title="Instance Status" />
            <div className="p-4 flex items-center gap-4">
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie data={statusPie} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" paddingAngle={3}>
                    {statusPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {statusPie.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white tabular-nums">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden flex-1">
            <SectionHeader title="License Plans" />
            <div className="p-4 flex items-center gap-4">
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie data={planPie} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" paddingAngle={3}>
                    {planPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {planPie.length === 0
                  ? <p className="text-xs text-slate-400 dark:text-gray-600">No plans yet</p>
                  : planPie.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                        {p.name}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">{p.value}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Top Selling Products (network-wide) ── */}
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top Selling Products</h3>
            <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">Last 30 days — synced across all stores</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <BarChart2 size={15} className="text-rose-500 dark:text-rose-400" />
          </div>
        </div>
        {topProducts.length === 0 ? (
          <div className="py-14 text-center">
            <Package className="w-8 h-8 text-slate-300 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-gray-500">No sales synced yet</p>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className={clsx(
                  'w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0',
                  i === 0 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                  i === 1 ? 'bg-slate-200/80 dark:bg-gray-700 text-slate-600 dark:text-gray-400' :
                  i === 2 ? 'bg-orange-500/15 text-orange-600 dark:text-orange-500' :
                            'bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-600'
                )}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-200 truncate pr-2">{p.name}</span>
                    <span className="text-xs font-bold text-slate-500 dark:text-gray-400 tabular-nums flex-shrink-0">{fmt(p.qty)} sold</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.round((p.qty / maxQty) * 100)}%`, background: PALETTE[i % PALETTE.length] }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 30-day Sales Trend ── */}
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <SectionHeader title="Sales Trend — Last 30 Days" sub={`Revenue and sales synced from all stores · selected period`} />
        {salesTrend.length === 0 ? (
          <div className="py-14 text-center">
            <Activity className="w-8 h-8 text-slate-300 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-gray-500">No sales synced yet</p>
          </div>
        ) : (
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={salesTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis yAxisId="rev" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmtRs(v)} width={70} />
                <YAxis yAxisId="cnt" orientation="right" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip contentStyle={customTooltipStyle} formatter={(v: number, name: string) =>
                  [name === 'revenue' ? fmtRs(v) : v, name === 'revenue' ? 'Revenue' : name === 'sales' ? 'Sales' : 'Stores']} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#6b7280' }} />
                <Area yAxisId="rev" type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2} dot={false} name="revenue" />
                <Bar yAxisId="cnt" dataKey="sales" fill="#8b5cf650" name="sales" radius={[2,2,0,0]} maxBarSize={12} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Activity + Top Earners row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* User activity distribution */}
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <SectionHeader title="User Activity" sub="When stores were last seen online" />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={activityData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={customTooltipStyle} formatter={(v: number) => [v, 'Stores']} />
                <Bar dataKey="count" radius={[4,4,0,0]} maxBarSize={48} name="Stores">
                  {activityData.map((d, i) => {
                    const c = d.period === 'Today' ? '#10b981' : d.period === 'This Week' ? '#3b82f6' : d.period === 'This Month' ? '#8b5cf6' : d.period === 'Older' ? '#f59e0b' : '#6b7280';
                    return <Cell key={i} fill={c} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top earners leaderboard */}
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <SectionHeader title="Top Earners" sub="Approved stores ranked by revenue" />
          {revenueData.length === 0 ? (
            <div className="py-10 text-center"><p className="text-sm text-slate-500 dark:text-gray-500">No data</p></div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-gray-800/60">
              {revenueData.slice(0, 6).map((r, i) => (
                <Link
                  key={r.instanceId}
                  to={`/instances/${r.instanceId}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors"
                >
                  <span className={clsx(
                    'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0',
                    i === 0 ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400' :
                    i === 1 ? 'bg-gray-500/20 text-slate-500 dark:text-gray-400' :
                    i === 2 ? 'bg-orange-700/20 text-orange-600 dark:text-orange-500' : 'bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-600'
                  )}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-gray-200 truncate">{r.fullName || r.name}</p>
                    <p className="text-xs text-slate-400 dark:text-gray-600">{fmt(r.sales)} sales</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-600 dark:text-gray-300 tabular-nums shrink-0">{fmtRs(r.revenue)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Profit & Loss ── */}
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Profit &amp; Loss</h3>
            <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">Monthly revenue vs expenses — profit shown as line</p>
          </div>
          <div className="flex items-center gap-3">
            {plData.length > 0 && (
              <>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400 dark:text-gray-600">Total Revenue</p>
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">{fmtRs(plData.reduce((s, d) => s + d.revenue, 0))}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400 dark:text-gray-600">Total Expenses</p>
                  <p className="text-sm font-bold text-rose-500 dark:text-rose-400 tabular-nums">{fmtRs(plData.reduce((s, d) => s + d.expenses, 0))}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400 dark:text-gray-600">Net Profit</p>
                  {(() => {
                    const net = plData.reduce((s, d) => s + d.profit, 0);
                    return <p className={clsx('text-sm font-bold tabular-nums', net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400')}>{fmtRs(net)}</p>;
                  })()}
                </div>
              </>
            )}
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <TrendingUp size={15} className="text-emerald-500 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        {plData.length === 0 ? (
          <div className="py-14 text-center">
            <TrendingDown className="w-8 h-8 text-slate-300 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-gray-500">No revenue or expense data for this period</p>
          </div>
        ) : (
          <div className="p-4">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={plData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#3b82f6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="expBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#ef4444" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="amt" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => 'PKR ' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)} width={65} />
                <YAxis yAxisId="profit" orientation="right" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => 'PKR ' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)} width={65} />
                <Tooltip
                  contentStyle={customTooltipStyle}
                  formatter={(v: number, name: string) => [fmtRs(v), name === 'revenue' ? 'Revenue' : name === 'expenses' ? 'Expenses' : 'Net Profit']}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} formatter={(v) => v === 'revenue' ? 'Revenue' : v === 'expenses' ? 'Expenses' : 'Net Profit'} />
                <Bar yAxisId="amt" dataKey="revenue"  fill="url(#revBarGrad)" radius={[3,3,0,0]} maxBarSize={32} name="revenue" />
                <Bar yAxisId="amt" dataKey="expenses" fill="url(#expBarGrad)" radius={[3,3,0,0]} maxBarSize={32} name="expenses" />
                <Line yAxisId="profit" type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} name="profit" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Account Overview + Store Growth ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Account overview */}
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Account Overview</h3>
              <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">Balances by type &amp; transaction volume across all stores</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Wallet size={15} className="text-blue-500 dark:text-blue-400" />
            </div>
          </div>

          {acctTypePie.length === 0 && acctTxnData.length === 0 ? (
            <div className="py-14 text-center">
              <Banknote className="w-8 h-8 text-slate-300 dark:text-gray-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-gray-500">No account data synced yet</p>
            </div>
          ) : (
            <div className="p-4 space-y-5">

              {/* Account type balance pie */}
              {acctTypePie.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-gray-500 mb-3">Balance by Account Type</p>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie data={acctTypePie} cx="50%" cy="50%" innerRadius={32} outerRadius={54} dataKey="value" paddingAngle={3}>
                          {acctTypePie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip
                          contentStyle={customTooltipStyle}
                          formatter={(v: number) => [fmtRs(v), 'Balance']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {acctTypePie.map(a => (
                        <div key={a.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
                            {a.name}
                            <span className="text-slate-400 dark:text-gray-600">({a.count})</span>
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-gray-300 tabular-nums">{fmtRs(a.value)}</span>
                        </div>
                      ))}
                      {analytics?.accountStats?.totalBalance !== undefined && (
                        <div className="pt-2 mt-1 border-t border-slate-200 dark:border-gray-800 flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-gray-400 font-medium">Total Balance</span>
                          <span className="font-bold text-slate-900 dark:text-white tabular-nums">{fmtRs(analytics.accountStats.totalBalance)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Debit vs Credit bar */}
              {acctTxnData.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-gray-500 mb-2">Transaction Volume by Type</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={acctTxnData} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={v => 'PKR ' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)} />
                      <YAxis type="category" dataKey="type" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                      <Tooltip contentStyle={customTooltipStyle} formatter={(v: number) => [fmtRs(v), 'Amount']} />
                      <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={22}>
                        {acctTxnData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-slate-400 dark:text-gray-600 mt-1 text-right">
                    {analytics?.accountStats?.totalTxns ?? 0} total transactions
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Store Registration Growth */}
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Store Growth</h3>
              <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">New registrations vs total — last 12 months</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <UserPlus size={15} className="text-violet-500 dark:text-violet-400" />
            </div>
          </div>

          {regData.length === 0 ? (
            <div className="py-14 text-center">
              <Store className="w-8 h-8 text-slate-300 dark:text-gray-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-gray-500">No registration data yet</p>
            </div>
          ) : (
            <div className="p-4">
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={regData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="new"   tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                  <YAxis yAxisId="total" orientation="right" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                  <Tooltip
                    contentStyle={customTooltipStyle}
                    formatter={(v: number, name: string) => [v, name === 'newStores' ? 'New Stores' : 'Cumulative Total']}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} formatter={(v) => v === 'newStores' ? 'New Stores' : 'Total'} />
                  <Bar yAxisId="new" dataKey="newStores" fill="#a78bfa" radius={[3,3,0,0]} maxBarSize={28} name="newStores" opacity={0.85} />
                  <Area yAxisId="total" type="monotone" dataKey="total" stroke="#8b5cf6" fill="url(#totalGrad)" strokeWidth={2} dot={false} name="total" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent instances table ── */}
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Stores</h3>
            <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">All instances — newest first</p>
          </div>
          <Link to="/instances" className="btn-ghost text-xs py-1.5 px-3">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="py-16 text-center">
            <Store className="w-10 h-10 text-slate-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-gray-500">No instances registered yet</p>
            <p className="text-xs text-slate-400 dark:text-gray-600 mt-1">POS clients will appear here once they register</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-gray-800">
                  {['Store / Owner', 'Status', 'Mobile', 'Plan', 'Revenue', 'Sales', 'Products', 'Customers', 'Last Seen'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-slate-500 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-gray-800/60">
                {recent.map((inst) => (
                  <tr key={inst.instance_id} className="table-row-hover">
                    <td className="px-5 py-3.5">
                      <Link to={`/instances/${inst.instance_id}`} className="hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                        <p className="font-medium text-slate-800 dark:text-gray-100 truncate max-w-[140px]">{inst.store_name || '—'}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">{inst.owner_name || inst.instance_id}</p>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={clsx(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize',
                        inst.approval_status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                        inst.approval_status === 'blocked'  ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400' :
                                                              'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                      )}>{inst.approval_status}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-gray-400 font-mono text-xs">{inst.owner_mobile}</td>
                    <td className="px-5 py-3.5">
                      {inst.license_plan && inst.license_plan !== 'none' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 capitalize">{inst.license_plan}</span>
                      ) : <span className="text-xs text-slate-400 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 dark:text-gray-300 tabular-nums font-medium">{fmtRs(inst.total_revenue ?? 0)}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-gray-400 tabular-nums">{fmt(inst.total_sales ?? 0)}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 bg-violet-500/8 px-2 py-0.5 rounded-full border border-violet-500/15">
                        <Package size={10} /> {fmt(inst.total_products ?? 0)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 px-2 py-0.5 rounded-full border border-emerald-500/15">
                        <Users size={10} /> {fmt(inst.total_customers ?? 0)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 dark:text-gray-500 text-xs whitespace-nowrap">{timeAgo(inst.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
