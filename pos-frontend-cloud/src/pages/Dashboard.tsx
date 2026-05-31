import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Monitor,
  Wifi,
  Key,
  DollarSign,
  ShieldCheck,
  Clock,
  ShieldX,
  AlertTriangle,
  CalendarX,
  CheckCircle2,
  RefreshCw,
  Store,
  ArrowRight,
  TrendingUp,
  Users,
  BarChart2,
  UserPlus,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  CartesianGrid,
  Legend,
  ComposedChart,
} from 'recharts';

import { cn, fmt, fmtRs } from '../lib/utils';
import {
  Spinner,
  StatCard,
  EmptyState,
  ActionButton,
} from '../components/ui';
import * as api from '../api';
import type { DashboardStats, AnalyticsData, ExpiringInstance } from '../api';

// ─── Types ────────────────────────────────────────────────────────────────────

type DashPreset = 'today' | 'week' | 'month' | '3months' | 'custom';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getPresetRange(preset: DashPreset): { from: string; to: string } | null {
  const now = new Date();
  const today = toYMD(now);
  if (preset === 'today')   return { from: today, to: today };
  if (preset === 'week')    return { from: toYMD(new Date(now.getTime() - 6  * 86_400_000)), to: today };
  if (preset === 'month')   return { from: toYMD(new Date(now.getTime() - 29 * 86_400_000)), to: today };
  if (preset === '3months') return { from: toYMD(new Date(now.getTime() - 89 * 86_400_000)), to: today };
  return null;
}

function fmtDay(d: string): string {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
}

function fmtMonth(m: string): string {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-PK', {
    month: 'short',
    year: '2-digit',
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  color: '#e2e8f0',
  fontSize: 12,
  padding: '8px 12px',
};

const PALETTE = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
];

const PLAN_COLORS: Record<string, string> = {
  monthly: '#3b82f6', quarterly: '#8b5cf6', yearly: '#f59e0b',
  lifetime: '#10b981', trial: '#06b6d4', none: '#6b7280',
};

const ACTIVITY_COLORS: Record<string, string> = {
  'Today': '#10b981', 'This Week': '#3b82f6',
  'This Month': '#8b5cf6', 'Older': '#f59e0b', 'Never': '#6b7280',
};

const PRESET_BUTTONS: { key: DashPreset; label: string }[] = [
  { key: 'today',    label: 'Today' },
  { key: 'week',     label: 'This Week' },
  { key: 'month',    label: 'Last Month' },
  { key: '3months',  label: 'Last 3 Months' },
  { key: 'custom',   label: 'Custom' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-white/10">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

type ExpiryTone = 'critical' | 'warning' | 'expired';

const EXPIRY_CONFIG: Record<
  ExpiryTone,
  { border: string; bg: string; badge: string; label: string; icon: typeof AlertTriangle }
> = {
  critical: {
    border: 'border-rose-500/30',
    bg: 'bg-rose-500/5',
    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    label: '7 days',
    icon: AlertTriangle,
  },
  warning: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    label: '30 days',
    icon: AlertTriangle,
  },
  expired: {
    border: 'border-slate-500/30',
    bg: 'bg-slate-500/5',
    badge: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    label: 'Expired',
    icon: CalendarX,
  },
};

function ExpiryList({
  title,
  items,
  tone,
  onRenew,
}: {
  title: string;
  items: ExpiringInstance[];
  tone: ExpiryTone;
  onRenew: () => void;
}) {
  const cfg = EXPIRY_CONFIG[tone];
  const Icon = cfg.icon;

  return (
    <div className={cn('rounded-xl border overflow-hidden', cfg.border, cfg.bg)}>
      {/* Column header */}
      <div className={cn('flex items-center gap-2 px-4 py-2.5 border-b', cfg.border)}>
        <Icon size={13} className={cn('shrink-0', tone === 'critical' ? 'text-rose-400' : tone === 'warning' ? 'text-amber-400' : 'text-slate-400')} />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex-1">{title}</span>
        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold', cfg.badge)}>
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="py-6 px-4 text-center">
          <CheckCircle2 size={18} className="text-emerald-400 mx-auto mb-1.5" />
          <p className="text-xs text-slate-500 dark:text-slate-400">None</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200/50 dark:divide-white/5 max-h-56 overflow-y-auto">
          {items.map((inst) => (
            <div
              key={inst.instance_id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/40 dark:hover:bg-white/5 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                  {inst.store_name || inst.owner_mobile}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-500 font-mono">
                  {inst.owner_mobile}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border', cfg.badge)}>
                  {tone === 'expired'
                    ? `${inst.days_overdue ?? 0}d over`
                    : `${inst.days_left ?? 0}d`}
                </span>
                <button
                  onClick={onRenew}
                  className="text-[10px] font-semibold text-blue-500 dark:text-blue-400 hover:underline underline-offset-2"
                >
                  Renew
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();

  const [stats, setStats]       = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Date filter state
  const [preset, setPreset]     = useState<DashPreset>('month');
  const [dateFrom, setDateFrom] = useState(() => toYMD(new Date(Date.now() - 29 * 86_400_000)));
  const [dateTo, setDateTo]     = useState(() => toYMD(new Date()));

  // Derived date range used for API calls
  const effectiveRange = (() => {
    const r = getPresetRange(preset);
    return r ?? { from: dateFrom, to: dateTo };
  })();

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);

    const range = getPresetRange(preset);
    const from = range ? range.from : dateFrom;
    const to   = range ? range.to   : dateTo;

    const [statsRes, anRes] = await Promise.allSettled([
      api.getStats(),
      api.getAnalytics({ date_from: from, date_to: to }),
    ]);

    if (statsRes.status === 'fulfilled') setStats(statsRes.value);
    else setError(`Stats: ${(statsRes.reason as Error)?.message ?? 'Failed'}`);

    if (anRes.status === 'fulfilled') setAnalytics(anRes.value);
    else if (!error) setError(`Analytics: ${(anRes.reason as Error)?.message ?? 'Failed'}`);

    setLoading(false);
    setRefreshing(false);
  }, [preset, dateFrom, dateTo]); // eslint-disable-line

  // Re-fetch whenever date filter changes
  useEffect(() => {
    load(true);
  }, [load]);

  // ── Loading screen ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
        <Spinner className="h-8 w-8" />
        <p className="text-sm">Loading dashboard…</p>
      </div>
    );
  }

  // ── Chart data prep ───────────────────────────────────────────────────────

  const activityData = (analytics?.activityDistribution ?? []).map((d) => ({
    period: d.period,
    count: d.count,
    color: ACTIVITY_COLORS[d.period] ?? '#6b7280',
  }));

  const planPieData = (analytics?.planDistribution ?? [])
    .filter((d) => d.count > 0)
    .map((d) => ({
      name: d.plan.charAt(0).toUpperCase() + d.plan.slice(1),
      value: d.count,
      color: PLAN_COLORS[d.plan.toLowerCase()] ?? '#6b7280',
    }));

  const revenueByInstance = (analytics?.revenueByInstance ?? []).slice(0, 10).map((r) => ({
    instance_id: r.instance_id,
    store_name: r.store_name,
    owner_mobile: r.owner_mobile,
    total_revenue: r.total_revenue,
    total_sales: r.total_sales,
  }));

  const salesTrendData = (analytics?.salesByDay ?? []).map((d) => ({
    day: fmtDay(d.day),
    revenue: d.revenue,
    sales: d.sales_count,
    stores: d.active_stores,
  }));

  const regTrendData = (analytics?.registrationsTrend ?? []).map((d) => ({
    label: fmtMonth(d.month),
    newStores: d.newStores,
    total: d.total,
  }));

  const totals = analytics?.totals;
  const totalRevenue = totals?.total_revenue ?? 0;

  // Compute approval status data for stat cards (from stats)
  const approved = stats?.approved ?? 0;
  const pending  = stats?.pending  ?? 0;
  const blocked  = stats?.blocked  ?? 0;

  // Active today trend vs yesterday — approximated from activityData
  const activeTodayCount = stats?.activeToday ?? 0;
  const activeWeekCount  = stats?.activeWeek  ?? 0;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Platform Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            OsaTech POS Cloud — super admin overview
          </p>
        </div>
        <ActionButton
          label={refreshing ? 'Refreshing…' : 'Refresh'}
          icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
          variant="secondary"
          onClick={() => load(false)}
          disabled={refreshing}
        />
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/8 p-4 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-400" />
          <div className="flex-1">
            <p className="font-semibold text-rose-500 dark:text-rose-400">Failed to load data</p>
            <p className="mt-0.5 font-mono text-xs text-rose-400/70">{error}</p>
          </div>
          <button
            onClick={() => load(false)}
            className="shrink-0 text-xs font-semibold text-rose-400 underline underline-offset-2 hover:text-rose-300"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Date filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Period:</span>

        <div className="flex items-center gap-0.5 rounded-xl bg-slate-100 dark:bg-white/5 p-1">
          {PRESET_BUTTONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreset(key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                preset === key
                  ? 'bg-white dark:bg-blue-600/20 text-slate-900 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
        )}

        <span className="text-xs text-slate-400 dark:text-slate-600">
          {effectiveRange.from === effectiveRange.to
            ? effectiveRange.from
            : `${effectiveRange.from} → ${effectiveRange.to}`}
        </span>
      </div>

      {/* ── Row 1: 4 platform stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Instances"
          value={fmt(stats?.totalInstances ?? 0)}
          sub={pending > 0 ? `${pending} pending approval` : undefined}
          icon={<Monitor size={18} />}
          color="blue"
        />
        <StatCard
          title="Active Today"
          value={fmt(activeTodayCount)}
          sub={`${fmt(activeWeekCount)} active this week`}
          icon={<Wifi size={18} />}
          color="emerald"
          trend={
            activeWeekCount > 0
              ? { value: Math.round((activeTodayCount / activeWeekCount) * 100 - 14), label: 'vs avg/day' }
              : undefined
          }
        />
        <StatCard
          title="Licenses Expiring"
          value={fmt(
            (stats?.expiringCritical?.length ?? 0) + (stats?.expiringWarning?.length ?? 0)
          )}
          sub="within 30 days"
          icon={<Key size={18} />}
          color="amber"
        />
        <StatCard
          title="Platform Revenue"
          value={fmtRs(totalRevenue)}
          sub="from synced stores"
          icon={<DollarSign size={18} />}
          color="violet"
        />
      </div>

      {/* ── Row 2: 3 status cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Approved Stores"
          value={fmt(approved)}
          sub="active licenses"
          icon={<ShieldCheck size={18} />}
          color="emerald"
        />
        <StatCard
          title="Pending Approval"
          value={fmt(pending)}
          sub={pending > 0 ? 'needs review' : 'no pending stores'}
          icon={<Clock size={18} />}
          color="amber"
        />
        <StatCard
          title="Suspended / Blocked"
          value={fmt(blocked)}
          sub={blocked > 0 ? 'access revoked' : 'none blocked'}
          icon={<ShieldX size={18} />}
          color="rose"
        />
      </div>

      {/* ── License Health Monitor ── */}
      <SectionCard
        title="License Health Monitor"
        subtitle="Stores with expiring or expired licenses that need attention"
        action={
          (stats?.expiringCritical?.length ?? 0) +
            (stats?.expiringWarning?.length ?? 0) +
            (stats?.expired?.length ?? 0) >
          0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-400">
              <AlertTriangle size={11} />
              {(stats?.expiringCritical?.length ?? 0) +
                (stats?.expiringWarning?.length ?? 0) +
                (stats?.expired?.length ?? 0)}{' '}
              need attention
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
              <CheckCircle2 size={11} />
              All healthy
            </span>
          )
        }
      >
        {(stats?.expiringCritical?.length ?? 0) === 0 &&
        (stats?.expiringWarning?.length ?? 0) === 0 &&
        (stats?.expired?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={24} className="text-emerald-400" />}
            title="All licenses healthy"
            description="No licenses are expiring within 30 days. Good to go."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
            <ExpiryList
              title="Expiring in 7 days"
              items={stats?.expiringCritical ?? []}
              tone="critical"
              onRenew={() => navigate('/licenses')}
            />
            <ExpiryList
              title="Expiring in 30 days"
              items={stats?.expiringWarning ?? []}
              tone="warning"
              onRenew={() => navigate('/licenses')}
            />
            <ExpiryList
              title="Expired"
              items={stats?.expired ?? []}
              tone="expired"
              onRenew={() => navigate('/licenses')}
            />
          </div>
        )}
      </SectionCard>

      {/* ── Charts Row: Activity bar + Plan pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Store Activity bar chart */}
        <SectionCard
          title="Store Activity"
          subtitle="When stores were last seen online"
          action={<BarChart2 size={16} className="text-blue-400" />}
        >
          {activityData.length === 0 ? (
            <EmptyState
              icon={<Wifi size={20} />}
              title="No activity data"
              description="Activity distribution will appear once stores connect."
            />
          ) : (
            <div className="p-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={activityData}
                  margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.15)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(v: number) => [v, 'Stores']}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {activityData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        {/* License Plans pie chart */}
        <SectionCard
          title="License Plans"
          subtitle="Distribution of license plans across all stores"
          action={<Key size={16} className="text-violet-400" />}
        >
          {planPieData.length === 0 ? (
            <EmptyState
              icon={<Key size={20} />}
              title="No plan data"
              description="License plan distribution will appear once licenses are assigned."
            />
          ) : (
            <div className="flex items-center gap-6 p-5">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={planPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={70}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {planPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(v: number, name: string) => [v, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5">
                {planPieData.map((p) => {
                  const total = planPieData.reduce((s, x) => s + x.value, 0);
                  const pct = total > 0 ? Math.round((p.value / total) * 100) : 0;
                  return (
                    <div key={p.name} className="flex items-center gap-2.5 text-xs">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: p.color }}
                      />
                      <span className="flex-1 text-slate-500 dark:text-slate-400 capitalize">
                        {p.name}
                      </span>
                      <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                        {p.value}
                      </span>
                      <span className="w-8 text-right tabular-nums text-slate-400 dark:text-slate-600">
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Instance Health Table ── */}
      <SectionCard
        title="Instance Status Overview"
        subtitle="Top 10 stores by synced revenue"
        action={
          <button
            onClick={() => navigate('/instances')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-500 dark:text-blue-400 hover:underline underline-offset-2"
          >
            View all <ArrowRight size={13} />
          </button>
        }
      >
        {revenueByInstance.length === 0 ? (
          <EmptyState
            icon={<Store size={22} />}
            title="No instance data"
            description="Stores will appear here once they sync data with the platform."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
                  {['Store', 'Owner', 'Status', 'Last Seen', 'Total Sales', 'Revenue'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {revenueByInstance.map((row) => {
                  // Find matching instance from analytics for status/last_seen etc.
                  return (
                    <tr
                      key={row.instance_id}
                      onClick={() => navigate(`/instances/${row.instance_id}`)}
                      className="cursor-pointer border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                          {row.store_name || '—'}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-600 font-mono">
                          {row.instance_id.slice(0, 12)}…
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs whitespace-nowrap">
                        {row.owner_mobile}
                      </td>
                      <td className="px-4 py-3">
                        {/* Status not available in revenueByInstance, show neutral */}
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                          active
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        —
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                        {fmt(row.total_sales)}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                        {fmtRs(row.total_revenue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Sales Trend Area Chart ── */}
      <SectionCard
        title="Platform Sales Trend (30 days)"
        subtitle="Revenue and order count synced from all connected stores"
        action={<TrendingUp size={16} className="text-blue-400" />}
      >
        {salesTrendData.length === 0 ? (
          <EmptyState
            icon={<TrendingUp size={22} />}
            title="No sales data"
            description="Sales trend will appear here once stores start syncing transactions."
          />
        ) : (
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart
                data={salesTrendData}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.15)"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="rev"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmtRs(v)}
                  width={80}
                />
                <YAxis
                  yAxisId="cnt"
                  orientation="right"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(v: number, name: string) =>
                    name === 'revenue'
                      ? [fmtRs(v), 'Revenue']
                      : [fmt(v), 'Orders']
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
                <Area
                  yAxisId="rev"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  fill="url(#revenueGrad)"
                  strokeWidth={2}
                  dot={false}
                  name="revenue"
                />
                <Bar
                  yAxisId="cnt"
                  dataKey="sales"
                  fill="rgba(139,92,246,0.45)"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={10}
                  name="sales"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* ── Store Growth Composed Chart ── */}
      <SectionCard
        title="Store Registrations"
        subtitle="New registrations (bars) vs cumulative total (line) — last 12 months"
        action={<UserPlus size={16} className="text-violet-400" />}
      >
        {regTrendData.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title="No registration data"
            description="Store registration trends will appear here as new stores join the platform."
          />
        ) : (
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart
                data={regTrendData}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="totalStoresGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.15)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="new"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={30}
                />
                <YAxis
                  yAxisId="total"
                  orientation="right"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(v: number, name: string) => [
                    v,
                    name === 'newStores' ? 'New Stores' : 'Cumulative Total',
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: '#64748b' }}
                  formatter={(v) => (v === 'newStores' ? 'New Stores' : 'Total')}
                />
                <Bar
                  yAxisId="new"
                  dataKey="newStores"
                  fill="#a78bfa"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                  name="newStores"
                  opacity={0.85}
                />
                <Area
                  yAxisId="total"
                  type="monotone"
                  dataKey="total"
                  stroke="#8b5cf6"
                  fill="url(#totalStoresGrad)"
                  strokeWidth={2}
                  dot={false}
                  name="total"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

    </div>
  );
}
