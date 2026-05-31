import { useEffect, useState, useCallback } from 'react';
import {
  Store, ShoppingCart, DollarSign, Users, TrendingUp,
  BarChart2, RefreshCw, Download,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, AreaChart, Area, Legend,
} from 'recharts';
import { cn, fmt, fmtRs, downloadJson } from '../lib/utils';
import { StatCard, DateRangePicker, ActionButton, Spinner, EmptyState } from '../components/ui';
import * as api from '../api';
import type { AnalyticsData } from '../api';

// ─── helpers ─────────────────────────────────────────────────────────────────

function toYMD(d: Date) {
  return d.toISOString().split('T')[0];
}

function fmtMonth(m: string) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-PK', {
    month: 'short',
    year: '2-digit',
  });
}

const TOOLTIP_STYLE = {
  backgroundColor: '#111827',
  border: '1px solid #1f2937',
  borderRadius: '8px',
  color: '#e5e7eb',
  fontSize: 12,
};

const PALETTE = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
  '#f97316', '#a78bfa', '#34d399', '#fbbf24',
];

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  sub,
  children,
  action,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
          {sub && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Revenue by store table ───────────────────────────────────────────────────

function RevenueTable({ data }: { data: AnalyticsData['revenueByInstance'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
            {['#', 'Store', 'Owner', 'Revenue', 'Sales', 'Customers'].map((h) => (
              <th
                key={h}
                className={cn(
                  'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap',
                  h === '#' || h === 'Revenue' || h === 'Sales' || h === 'Customers'
                    ? 'text-right'
                    : 'text-left'
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((row, i) => (
            <tr
              key={row.instance_id}
              className="border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
            >
              <td className="px-4 py-3 text-right">
                <span
                  className={cn(
                    'w-6 h-6 inline-flex items-center justify-center rounded-full text-[11px] font-bold',
                    i === 0
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                      : i === 1
                      ? 'bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                      : i === 2
                      ? 'bg-orange-500/15 text-orange-600 dark:text-orange-500'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-600'
                  )}
                >
                  {i + 1}
                </span>
              </td>
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white truncate max-w-[160px]">
                {row.store_name || row.instance_id}
              </td>
              <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">
                {row.owner_mobile}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                {fmtRs(row.total_revenue)}
              </td>
              <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                {fmt(row.total_sales)}
              </td>
              <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                {fmt(row.total_customers)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Reports() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading]     = useState(true);

  const today   = toYMD(new Date());
  const ago90   = toYMD(new Date(Date.now() - 89 * 86400000));

  const [dateFrom, setDateFrom] = useState(ago90);
  const [dateTo,   setDateTo]   = useState(today);

  const load = useCallback(
    async (from: string, to: string) => {
      setLoading(true);
      try {
        const data = await api.getAnalytics({ date_from: from, date_to: to });
        setAnalytics(data);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => { load(dateFrom, dateTo); }, [load, dateFrom, dateTo]);

  const handleExport = () => {
    if (!analytics) return;
    downloadJson(
      { exportedAt: new Date().toISOString(), dateFrom, dateTo, analytics },
      `reports_${dateFrom}_to_${dateTo}.json`
    );
  };

  // Chart data
  const topStores = (analytics?.revenueByInstance ?? []).slice(0, 10).map((r, i) => ({
    name: (r.store_name || r.owner_mobile || r.instance_id).slice(0, 18),
    revenue: r.total_revenue,
    color: PALETTE[i % PALETTE.length],
  }));

  const plData = (analytics?.profitLossData ?? []).map((d) => ({
    ...d,
    label: fmtMonth(d.month),
  }));

  const regData = (analytics?.registrationsTrend ?? []).map((d) => ({
    ...d,
    label: fmtMonth(d.month),
  }));

  const topProducts = (analytics?.topProducts ?? []).slice(0, 12);
  const maxQty      = topProducts.length > 0 ? topProducts[0].qty : 1;

  const totals = analytics?.totals;

  // Date range presets
  const presets = [
    {
      label: '1 Month',
      from: toYMD(new Date(Date.now() - 29 * 86400000)),
      to: today,
    },
    {
      label: '3 Months',
      from: ago90,
      to: today,
    },
    {
      label: '6 Months',
      from: toYMD(new Date(Date.now() - 179 * 86400000)),
      to: today,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Reports &amp; Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Platform-wide performance and revenue insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ActionButton
            label="Refresh"
            icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
            variant="secondary"
            onClick={() => load(dateFrom, dateTo)}
            loading={loading}
          />
          <ActionButton
            label="Export Report JSON"
            icon={<Download size={14} />}
            variant="secondary"
            onClick={handleExport}
            disabled={!analytics}
          />
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Period:
        </span>
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
          presets={presets}
        />
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {!loading && analytics && (
        <>
          {/* Section 1: Platform Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Stores"
              value={fmt(totals?.total_customers != null ? (analytics.revenueByInstance?.length ?? 0) : 0)}
              icon={<Store size={18} />}
              color="blue"
            />
            <StatCard
              title="Total Transactions"
              value={fmt(totals?.total_sales ?? 0)}
              icon={<ShoppingCart size={18} />}
              color="emerald"
            />
            <StatCard
              title="Platform Revenue"
              value={fmtRs(analytics.revenueByInstance?.reduce((s, r) => s + r.total_revenue, 0) ?? 0)}
              icon={<DollarSign size={18} />}
              color="amber"
            />
            <StatCard
              title="Total Customers"
              value={fmt(totals?.total_customers ?? 0)}
              icon={<Users size={18} />}
              color="violet"
            />
          </div>

          {/* Section 2: Revenue by Store */}
          <Section
            title="Revenue by Store"
            sub={`Top ${topStores.length} stores by revenue · ${dateFrom} to ${dateTo}`}
          >
            {topStores.length === 0 ? (
              <EmptyState
                icon={<BarChart2 size={22} />}
                title="No revenue data"
                description="No revenue has been synced from any store in this period."
              />
            ) : (
              <>
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={topStores}
                      layout="vertical"
                      margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:[stroke:#1f2937]" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => fmtRs(v)}
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={110}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(v: number) => [fmtRs(v), 'Revenue']}
                      />
                      <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={24}>
                        {topStores.map((s, i) => (
                          <rect key={i} fill={s.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <RevenueTable data={analytics.revenueByInstance} />
              </>
            )}
          </Section>

          {/* Section 3: Profit & Loss */}
          <Section
            title="Profit & Loss"
            sub="Monthly revenue vs expenses — profit shown as line"
            action={
              plData.length > 0 ? (
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-600">Total Revenue</p>
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                      {fmtRs(plData.reduce((s, d) => s + d.revenue, 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-600">Total Expenses</p>
                    <p className="text-sm font-bold text-rose-500 dark:text-rose-400 tabular-nums">
                      {fmtRs(plData.reduce((s, d) => s + d.expenses, 0))}
                    </p>
                  </div>
                  {(() => {
                    const net = plData.reduce((s, d) => s + d.profit, 0);
                    return (
                      <div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-600">Net Profit</p>
                        <p
                          className={cn(
                            'text-sm font-bold tabular-nums',
                            net >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-500 dark:text-rose-400'
                          )}
                        >
                          {fmtRs(net)}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              ) : undefined
            }
          >
            {plData.length === 0 ? (
              <EmptyState
                icon={<TrendingUp size={22} />}
                title="No P&L data"
                description="No revenue or expense data has been synced in this period."
              />
            ) : (
              <div className="p-5">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={plData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"  stopColor="#3b82f6" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.5} />
                      </linearGradient>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"  stopColor="#ef4444" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      yAxisId="amt"
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => 'Rs. ' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)}
                      width={70}
                    />
                    <YAxis
                      yAxisId="profit"
                      orientation="right"
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => 'Rs. ' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)}
                      width={70}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number, name: string) => [
                        fmtRs(v),
                        name === 'revenue' ? 'Revenue' : name === 'expenses' ? 'Expenses' : 'Net Profit',
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: '#9ca3af' }}
                      formatter={(v) =>
                        v === 'revenue' ? 'Revenue' : v === 'expenses' ? 'Expenses' : 'Net Profit'
                      }
                    />
                    <Bar yAxisId="amt" dataKey="revenue"  fill="url(#revGrad)" radius={[3, 3, 0, 0]} maxBarSize={32} name="revenue" />
                    <Bar yAxisId="amt" dataKey="expenses" fill="url(#expGrad)" radius={[3, 3, 0, 0]} maxBarSize={32} name="expenses" />
                    <Line
                      yAxisId="profit"
                      type="monotone"
                      dataKey="profit"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                      name="profit"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          {/* Section 4: Store Growth */}
          <Section
            title="Store Growth"
            sub="New registrations per month — cumulative total shown as area"
          >
            {regData.length === 0 ? (
              <EmptyState
                icon={<Store size={22} />}
                title="No registration data"
                description="No store registration trends are available yet."
              />
            ) : (
              <div className="p-5">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={regData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="totalRegGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="newRegGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number, name: string) => [
                        v,
                        name === 'newStores' ? 'New Stores' : 'Cumulative Total',
                      ]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: '#9ca3af' }}
                      formatter={(v) => (v === 'newStores' ? 'New Stores' : 'Cumulative Total')}
                    />
                    <Area
                      type="monotone"
                      dataKey="newStores"
                      stroke="#3b82f6"
                      fill="url(#newRegGrad)"
                      strokeWidth={2}
                      dot={false}
                      name="newStores"
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#8b5cf6"
                      fill="url(#totalRegGrad)"
                      strokeWidth={2}
                      dot={false}
                      name="total"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Section>

          {/* Section 5: Top Selling Products */}
          <Section
            title="Top Selling Products"
            sub={`Top 12 products by quantity sold across all stores`}
          >
            {topProducts.length === 0 ? (
              <EmptyState
                icon={<BarChart2 size={22} />}
                title="No product data"
                description="No product sales have been synced in this period."
              />
            ) : (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5">
                {topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    {/* Rank */}
                    <span
                      className={cn(
                        'w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0',
                        i === 0
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : i === 1
                          ? 'bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                          : i === 2
                          ? 'bg-orange-500/15 text-orange-600 dark:text-orange-500'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-600'
                      )}
                    >
                      {i + 1}
                    </span>
                    {/* Bar + label */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate pr-2">
                          {p.name}
                        </span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                          {fmt(p.qty)} sold
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.round((p.qty / maxQty) * 100)}%`,
                            background: PALETTE[i % PALETTE.length],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
