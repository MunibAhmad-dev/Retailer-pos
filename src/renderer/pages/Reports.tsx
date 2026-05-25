 import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, DollarSign, ShoppingBag, TrendingUp, RefreshCw, Award,
  Calendar, ChevronRight, Activity, Percent, Search, X, Layers,
  TrendingDown, Wallet, LayoutDashboard, Clock, ArrowUpRight, CreditCard
} from 'lucide-react';
import dayjs from 'dayjs';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  ComposedChart, Line
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { cn, formatInvoiceId } from '../lib/utils';
import { useNotifications } from '../components/NotificationProvider';
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton } from '../components/Pagination';

interface ReportData {
  sales: Array<{ id: number; total: number; date_created: string; payment_method: string }>;
  revenue: number;
  topProducts: Array<{ name: string; qty_sold: number; revenue: number }>;
}

const fmtPKR = (n: number) => 'PKR ' + Math.round(n || 0).toLocaleString('en-PK');
const fmtK = (n: number) => n >= 1000 ? `PKR ${(n / 1000).toFixed(1)}k` : `PKR ${Math.round(n)}`;

const getDates = (period: string) => {
  const endDate = dayjs().endOf('day').toISOString();
  let startDate = '';
  if (period === 'today') startDate = dayjs().startOf('day').toISOString();
  else if (period === 'week') startDate = dayjs().subtract(7, 'day').startOf('day').toISOString();
  else if (period === 'month') startDate = dayjs().startOf('month').toISOString();
  return { startDate, endDate };
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.4, delay: i * 0.055, ease: [0.23, 1, 0.32, 1] }
  }),
};

// ── Shared chart tooltip ────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label, pkr = true }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl px-3.5 py-3 shadow-2xl min-w-[150px]">
      {label && <p className="text-[11px] text-muted-foreground mb-2 font-medium">{label}</p>}
      {payload.map((item: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color || item.fill }} />
          <span className="text-[11px] text-muted-foreground">{item.name}:</span>
          <span className="text-[11px] font-bold" style={{ color: item.color || item.fill }}>
            {pkr && (item.name !== 'Orders' && item.name !== 'orders')
              ? fmtK(item.value)
              : item.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function Reports() {
  const [report, setReport] = useState<ReportData>({ sales: [], revenue: 0, topProducts: [] });
  const [profitData, setProfitData] = useState<{ revenue: number; cogs: number; expenses: number; profit: number } | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [customStart, setCustomStart] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [customEnd, setCustomEnd] = useState(dayjs().format('YYYY-MM-DD'));
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const { addNotification } = useNotifications();

  useEffect(() => { loadReport(); }, [period]);

  const loadReport = async () => {
    setLoading(true);
    try {
      let sd = '', ed = '';
      if (period === 'custom') {
        sd = dayjs(customStart).startOf('day').toISOString();
        ed = dayjs(customEnd).endOf('day').toISOString();
      } else {
        const d = getDates(period);
        sd = d.startDate;
        ed = d.endDate;
      }
      const args = period === 'custom' ? { startDate: sd, endDate: ed } : period;
      const [res, profitRes] = await Promise.all([
        window.api.getReport(args),
        window.api.getProfitLossReport({ startDate: sd, endDate: ed })
      ]);
      setReport((res?.success && res.data) ? res.data as any : { sales: [], revenue: 0, topProducts: [] });
      setProfitData(profitRes?.success ? profitRes.data : null);
    } catch (_) {
      addNotification('Error', 'Could not load report data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Derived data ────────────────────────────────────────────────────────
  const cashSales = useMemo(() => report.sales.filter(s => s.payment_method === 'cash'), [report.sales]);
  const onlineSales = useMemo(() => report.sales.filter(s => s.payment_method !== 'cash'), [report.sales]);
  const avgOrder = report.sales.length > 0 ? report.revenue / report.sales.length : 0;
  const profitMargin = profitData?.revenue > 0
    ? ((profitData.profit / profitData.revenue) * 100).toFixed(1) : '0';
  const periodLabel = period === 'today' ? 'Today' : period === 'week' ? 'Last 7 Days'
    : period === 'month' ? 'This Month' : 'Custom Range';

  // Revenue trend (grouped by date or hour)
  const trendData = useMemo(() => {
    if (!report.sales.length) return [];
    const fmt = period === 'today' ? 'HH' : 'YYYY-MM-DD';
    const lbl = period === 'today' ? 'h A' : period === 'week' ? 'ddd DD' : 'MMM DD';
    const map: Record<string, { label: string; Revenue: number; Orders: number }> = {};
    report.sales.forEach(s => {
      const key = dayjs(s.date_created).format(fmt);
      if (!map[key]) map[key] = { label: dayjs(s.date_created).format(lbl), Revenue: 0, Orders: 0 };
      map[key].Revenue += s.total;
      map[key].Orders += 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [report.sales, period]);

  // Hourly for modal
  const hourlyData = useMemo(() => {
    const hrs = Array.from({ length: 24 }, (_, i) => ({
      hour: dayjs().startOf('day').add(i, 'hour').format('hA'),
      Revenue: 0, Orders: 0,
    }));
    report.sales.forEach(s => {
      const h = dayjs(s.date_created).hour();
      hrs[h].Revenue += s.total;
      hrs[h].Orders += 1;
    });
    return hrs;
  }, [report.sales]);

  // Payment breakdown
  const paymentData = useMemo(() => [
    { name: 'Cash', value: cashSales.length, revenue: cashSales.reduce((s, t) => s + t.total, 0), color: '#10b981' },
    { name: 'Online/Card', value: onlineSales.length, revenue: onlineSales.reduce((s, t) => s + t.total, 0), color: '#3b82f6' },
  ].filter(d => d.value > 0), [cashSales, onlineSales]);

  // P&L bars
  const plData = useMemo(() => profitData ? [
    { name: 'Revenue', value: profitData.revenue, fill: '#10b981' },
    { name: 'COGS', value: profitData.cogs, fill: '#f59e0b' },
    { name: 'Expenses', value: profitData.expenses, fill: '#ef4444' },
    { name: 'Net Profit', value: Math.max(0, profitData.profit), fill: '#8b5cf6' },
  ] : [], [profitData]);

  // Top products for horizontal bar
  const topProductsChart = useMemo(() =>
    report.topProducts.slice(0, 8)
      .map(p => ({
        name: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name,
        Revenue: p.revenue, Qty: p.qty_sold,
      }))
      .reverse(),
    [report.topProducts]);

  const filteredProducts = useMemo(() =>
    report.topProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())),
    [report.topProducts, productSearch]);

  const { visible: visibleProds, hasMore: hasMoreProds, loadMore: loadMoreProds, total: prodsTotal, showing: prodsShowing } = usePagination(filteredProducts, 10, 1);
  const { visible: visibleSales, hasMore: hasMoreSales, loadMore: loadMoreSales, total: salesTotal, showing: salesShowing } = usePagination(report.sales, 10, 1);

  // ── KPI card config ─────────────────────────────────────────────────────
  const kpis = [
    { label: 'Total Revenue', value: fmtPKR(profitData?.revenue || report.revenue), icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', sub: period !== 'today' ? `Avg ${fmtPKR(avgOrder)}/order` : undefined },
    { label: 'COGS', value: fmtPKR(profitData?.cogs || 0), icon: Activity, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', sub: profitData?.revenue ? `${((profitData.cogs / profitData.revenue) * 100).toFixed(1)}% of revenue` : undefined },
    { label: 'Expenses', value: fmtPKR(profitData?.expenses || 0), icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    { label: 'Net Profit', value: fmtPKR(profitData?.profit || 0), icon: TrendingUp, color: (profitData?.profit ?? 0) >= 0 ? 'text-primary' : 'text-destructive', bg: 'bg-primary/10', border: 'border-primary/20', sub: `${profitMargin}% margin` },
    { label: 'Profit Margin', value: `${profitMargin}%`, icon: Percent, color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
    { label: 'Total Orders', value: report.sales.length.toString(), icon: ShoppingBag, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', sub: `Avg ${fmtPKR(avgOrder)}` },
    { label: 'Cash / Online', value: `${cashSales.length} / ${onlineSales.length}`, icon: CreditCard, color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  ];

  return (
    <div className="flex flex-col gap-6 w-full mb-8">

      {/* ── Hero Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #312e81 65%, #0f172a 100%)' }}
      >
        <div className="pointer-events-none absolute -top-14 -right-14 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-1/4 w-48 h-48 rounded-full bg-violet-500/15 blur-2xl" />
        <div className="pointer-events-none absolute top-1/2 right-1/3 w-72 h-20 bg-purple-600/5 rounded-full blur-3xl" />

        <div className="relative z-10 p-7">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-indigo-500/20 border border-indigo-400/30 rounded-2xl w-14 h-14 flex items-center justify-center shadow-lg backdrop-blur-sm flex-shrink-0">
                  <BarChart3 size={26} className="text-indigo-300" />
                </div>
                <div>
                  <p className="text-indigo-300/80 text-xs font-semibold uppercase tracking-widest mb-0.5">Financial Intelligence</p>
                  <h1 className="text-white text-2xl sm:text-3xl font-bold tracking-tight">Sales Analytics & P&L</h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-white/80 text-sm font-medium backdrop-blur-sm">
                  <Calendar size={13} className="text-indigo-300" />
                  {periodLabel}
                </div>
                {report.sales.length > 0 && (
                  <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-white/80 text-sm font-medium backdrop-blur-sm">
                    <ShoppingBag size={13} className="text-violet-300" />
                    {report.sales.length} Orders
                  </div>
                )}
                {profitData && (
                  <div className={cn(
                    'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium backdrop-blur-sm border',
                    profitData.profit >= 0
                      ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300'
                      : 'bg-red-500/20 border-red-400/30 text-red-300'
                  )}>
                    <TrendingUp size={13} />
                    {profitData.profit >= 0 ? '+' : ''}{fmtPKR(profitData.profit)}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm p-1 rounded-xl border border-white/20">
                {(['today', 'week', 'month', 'custom'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    disabled={loading}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                      period === p
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    )}
                  >
                    {p === 'today' ? 'Today' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Custom'}
                  </button>
                ))}
                <div className="w-px h-5 bg-white/20 mx-1" />
                <button
                  onClick={loadReport}
                  disabled={loading}
                  className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 rounded-xl px-4 py-2.5 text-white text-sm font-semibold shadow-lg shadow-indigo-500/30 transition-all duration-200"
              >
                <LayoutDashboard size={14} />
                Deep Analytics
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Custom Range Picker ── */}
      <AnimatePresence>
        {period === 'custom' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <Card className="border-border/50">
              <CardContent className="p-4 flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Start Date</label>
                  <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-9 w-44" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">End Date</label>
                  <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-9 w-44" />
                </div>
                <Button onClick={loadReport} disabled={loading} className="h-9 gap-2">
                  <ArrowUpRight size={14} /> Apply Range
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, bg, border, sub }, i) => (
          <motion.div key={label} variants={fadeUp} initial="hidden" animate="visible" custom={i + 1}>
            <Card className={cn('border overflow-hidden', border)}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">{label}</p>
                  <div className={cn('p-1.5 rounded-xl', bg)}>
                    <Icon className={cn('w-3.5 h-3.5', color)} />
                  </div>
                </div>
                <p className={cn('text-xl font-bold tracking-tight font-mono', color)}>{value}</p>
                {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Revenue Trend Chart (full width) ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={8}>
        <Card className="shadow-sm border-border/60">
          <CardHeader className="px-6 pt-5 pb-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <div className="w-2 h-4 rounded-full bg-violet-500" />
                  Revenue Trend
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {period === 'today' ? 'Hourly breakdown' : 'Daily revenue over period'}
                </CardDescription>
              </div>
              {trendData.length > 0 && (
                <Badge variant="outline" className="font-mono text-xs text-violet-600 border-violet-500/30">
                  {fmtPKR(trendData.reduce((s, d) => s + d.Revenue, 0))} total
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-6">
            {loading ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground">
                <RefreshCw size={20} className="animate-spin mr-2" /> Loading...
              </div>
            ) : trendData.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-muted-foreground">
                <BarChart3 size={32} className="opacity-20 mb-2" />
                <p className="text-sm">No data for {periodLabel.toLowerCase()}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="rev" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} width={45} />
                  <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={<ChartTip />} />
                  <Area yAxisId="rev" type="monotone" dataKey="Revenue" stroke="#8b5cf6" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                  <Area yAxisId="ord" type="monotone" dataKey="Orders" stroke="#06b6d4" strokeWidth={1.5} fill="url(#ordGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── P&L + Payment Distribution ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={9}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* P&L Breakdown Bar */}
          <Card className="lg:col-span-3 shadow-sm border-border/60">
            <CardHeader className="px-6 pt-5 pb-3 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <div className="w-2 h-4 rounded-full bg-emerald-500" />
                Profit & Loss Breakdown
              </CardTitle>
              <CardDescription className="text-xs">Revenue vs cost structure</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-6">
              {loading || plData.length === 0 ? (
                <div className="h-52 flex flex-col items-center justify-center text-muted-foreground">
                  {loading
                    ? <><RefreshCw size={20} className="animate-spin mb-2" />Loading...</>
                    : <><Layers size={28} className="opacity-20 mb-2" /><p className="text-sm">No P&L data available</p></>
                  }
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={plData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} width={45} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
                    <Bar dataKey="value" name="Amount" radius={[6, 6, 0, 0]} maxBarSize={80}>
                      {plData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {profitData && !loading && (
                <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t">
                  {plData.map(d => (
                    <div key={d.name} className="text-center">
                      <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ background: d.fill }} />
                      <p className="text-[10px] text-muted-foreground">{d.name}</p>
                      <p className="text-[11px] font-bold font-mono" style={{ color: d.fill }}>{fmtK(d.value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Donut */}
          <Card className="lg:col-span-2 shadow-sm border-border/60">
            <CardHeader className="px-6 pt-5 pb-3 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <div className="w-2 h-4 rounded-full bg-blue-500" />
                Payment Split
              </CardTitle>
              <CardDescription className="text-xs">Orders by method</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-6 flex flex-col items-center">
              {loading ? (
                <div className="h-44 flex items-center justify-center text-muted-foreground">
                  <RefreshCw size={20} className="animate-spin" />
                </div>
              ) : paymentData.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-muted-foreground">
                  <CreditCard size={28} className="opacity-20 mb-2" />
                  <p className="text-sm">No payment data</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={paymentData} cx="50%" cy="50%" innerRadius={58} outerRadius={80} paddingAngle={4} dataKey="value" labelLine={false}>
                        {paymentData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip
                        formatter={(val: any, name: string, props: any) => [`${val} orders (${fmtPKR(props.payload.revenue)})`, name]}
                        contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                      />
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                        <tspan x="50%" dy="-8" fontSize="16" fontWeight="700" fill="hsl(var(--foreground))">{report.sales.length}</tspan>
                        <tspan x="50%" dy="18" fontSize="10" fill="hsl(var(--muted-foreground))">orders</tspan>
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2 w-full mt-1">
                    {paymentData.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                          <span className="text-sm font-medium">{d.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold font-mono" style={{ color: d.color }}>{d.value} orders</span>
                          <span className="text-[10px] text-muted-foreground block">{fmtPKR(d.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* ── Top Products Chart ── */}
      {topProductsChart.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={10}>
          <Card className="shadow-sm border-border/60">
            <CardHeader className="px-6 pt-5 pb-3 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <div className="w-2 h-4 rounded-full bg-amber-500" />
                Top Products by Revenue
              </CardTitle>
              <CardDescription className="text-xs">Top 8 products ranked by sales revenue</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-6">
              <ResponsiveContainer width="100%" height={Math.max(180, topProductsChart.length * 38)}>
                <BarChart layout="vertical" data={topProductsChart} margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
                  <Bar dataKey="Revenue" radius={[0, 6, 6, 0]} maxBarSize={22}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    {topProductsChart.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#f59e0b' : i === 1 ? '#a78bfa' : i === 2 ? '#34d399' : '#60a5fa'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Tables: Top Products + Recent Transactions ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={11}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Top Performers Table */}
          <Card className="shadow-sm border-border/60 flex flex-col min-h-[400px]">
            <CardHeader className="border-b bg-amber-500/5 py-4 px-5 space-y-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award size={16} className="text-amber-500" />
                  <CardTitle className="text-sm font-bold">Top Performers</CardTitle>
                </div>
                <div className="relative w-44">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={12} />
                  <Input placeholder="Search..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-7 h-7 text-xs bg-background" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
              {loading ? (
                <div className="flex-1 flex items-center justify-center min-h-[280px] text-muted-foreground">
                  <RefreshCw size={20} className="animate-spin mr-2" /> Loading...
                </div>
              ) : filteredProducts.length > 0 ? (
                <>
                  <div className="flex-1 overflow-auto max-h-[440px] custom-scrollbar">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableHead className="pl-5 w-14 text-xs">Rank</TableHead>
                          <TableHead className="text-xs">Product</TableHead>
                          <TableHead className="text-right text-xs">Vol.</TableHead>
                          <TableHead className="text-right pr-5 text-xs">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleProds.map((p, i) => (
                          <TableRow key={i} className="hover:bg-muted/30">
                            <TableCell className="pl-5 text-center">
                              <Badge variant="outline" className={cn('text-[10px] font-mono h-5 px-1.5 font-bold', i === 0 ? 'bg-amber-500/15 text-amber-600 border-amber-500/30' : i === 1 ? 'bg-slate-400/15 text-slate-600 border-slate-400/30' : i === 2 ? 'bg-orange-400/15 text-orange-600 border-orange-400/30' : 'text-muted-foreground')}>
                                #{i + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-sm">{p.name}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">{p.qty_sold}</TableCell>
                            <TableCell className="text-right pr-5 font-bold text-amber-600 font-mono text-xs">{fmtPKR(p.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="px-5 py-3 border-t bg-muted/5">
                    <LoadMoreButton hasMore={hasMoreProds} onLoadMore={loadMoreProds} showing={prodsShowing} total={prodsTotal} />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[280px] text-muted-foreground">
                  <ShoppingBag size={36} className="opacity-15 mb-3" />
                  <p className="text-sm font-medium">No products sold {periodLabel.toLowerCase()}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card className="shadow-sm border-border/60 flex flex-col min-h-[400px]">
            <CardHeader className="border-b bg-blue-500/5 py-4 px-5 space-y-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-blue-500" />
                  <CardTitle className="text-sm font-bold">Recent Transactions</CardTitle>
                </div>
                <button onClick={() => { window.location.hash = '/transactions'; }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  View all <ChevronRight size={12} />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
              {loading ? (
                <div className="flex-1 flex items-center justify-center min-h-[280px] text-muted-foreground">
                  <RefreshCw size={20} className="animate-spin mr-2" /> Loading...
                </div>
              ) : report.sales.length > 0 ? (
                <>
                  <div className="flex-1 overflow-auto max-h-[440px] custom-scrollbar">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableHead className="pl-5 text-xs">Invoice</TableHead>
                          <TableHead className="text-xs">Method</TableHead>
                          <TableHead className="text-right pr-5 text-xs">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleSales.map(s => (
                          <TableRow key={s.id} className="hover:bg-muted/30">
                            <TableCell className="pl-5">
                              <div className="font-mono text-xs font-bold text-foreground/80 leading-tight">{formatInvoiceId(s.id, s.date_created)}</div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{dayjs(s.date_created).format('DD MMM, hh:mm A')}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('uppercase text-[9px] px-1.5 h-4 font-semibold', s.payment_method !== 'cash' ? 'text-blue-600 border-blue-400/40 bg-blue-500/10' : 'text-emerald-600 border-emerald-400/40 bg-emerald-500/10')}>
                                {s.payment_method}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right pr-5 font-bold font-mono text-sm text-primary">{fmtPKR(s.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="px-5 py-3 border-t bg-muted/5">
                    <LoadMoreButton hasMore={hasMoreSales} onLoadMore={loadMoreSales} showing={salesShowing} total={salesTotal} />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[280px] text-muted-foreground">
                  <DollarSign size={36} className="opacity-15 mb-3" />
                  <p className="text-sm font-medium">No invoices for {periodLabel.toLowerCase()}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* ── Deep Analytics Modal ── */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto" onClick={() => setShowModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.97, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }} className="min-h-screen flex items-start justify-center p-4 sm:p-8">
            <div className="w-full max-w-5xl bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="relative p-6 border-b" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>
                <div className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full bg-indigo-500/15 blur-3xl" />
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-500/20 border border-indigo-400/30 p-2.5 rounded-xl">
                      <LayoutDashboard size={20} className="text-indigo-300" />
                    </div>
                    <div>
                      <h2 className="text-white text-lg font-bold">Deep Analytics</h2>
                      <p className="text-indigo-300/70 text-xs mt-0.5">Advanced breakdown for {periodLabel}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowModal(false)} className="text-white/50 hover:text-white/90 p-1.5 rounded-xl hover:bg-white/10 transition-colors">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-6 flex flex-col gap-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Avg Order Value', value: fmtPKR(avgOrder), color: 'text-violet-600', bg: 'bg-violet-500/10', icon: Wallet },
                    { label: 'Total Revenue', value: fmtPKR(profitData?.revenue || report.revenue), color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: DollarSign },
                    { label: 'Net Profit', value: fmtPKR(profitData?.profit || 0), color: (profitData?.profit ?? 0) >= 0 ? 'text-blue-600' : 'text-red-600', bg: 'bg-blue-500/10', icon: TrendingUp },
                    { label: 'Profit Margin', value: `${profitMargin}%`, color: 'text-indigo-600', bg: 'bg-indigo-500/10', icon: Percent },
                  ].map(({ label, value, color, bg, icon: Icon }) => (
                    <div key={label} className={cn('rounded-xl p-4 border border-border/40', bg)}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={13} className={color} />
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                      </div>
                      <p className={cn('text-lg font-bold font-mono', color)}>{value}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-4 rounded-full bg-cyan-500" />
                    <h3 className="font-bold text-sm">Hourly Sales Distribution</h3>
                    <span className="text-xs text-muted-foreground ml-1">Revenue & order volume by hour of day</span>
                  </div>
                  {report.sales.length === 0 ? (
                    <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No data available</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={hourlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={2} />
                        <YAxis yAxisId="rev" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} width={40} />
                        <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={25} />
                        <Tooltip content={<ChartTip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                        <Bar yAxisId="rev" dataKey="Revenue" fill="#06b6d4" fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={20} />
                        <Line yAxisId="ord" type="monotone" dataKey="Orders" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {trendData.length > 1 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-4 rounded-full bg-violet-500" />
                      <h3 className="font-bold text-sm">Revenue vs Order Volume</h3>
                      <span className="text-xs text-muted-foreground ml-1">Correlation between sales count and revenue</span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="modalRevGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="rev" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} width={42} />
                        <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip content={<ChartTip />} />
                        <Area yAxisId="rev" type="monotone" dataKey="Revenue" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#modalRevGrad)" dot={false} />
                        <Bar yAxisId="ord" dataKey="Orders" fill="#10b981" fillOpacity={0.7} radius={[2, 2, 0, 0]} maxBarSize={14} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {paymentData.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-4 rounded-full bg-blue-500" />
                      <h3 className="font-bold text-sm">Payment Method Breakdown</h3>
                    </div>
                    <div className="rounded-xl border border-border/50 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="pl-5 text-xs">Method</TableHead>
                            <TableHead className="text-right text-xs">Orders</TableHead>
                            <TableHead className="text-right text-xs">% of Total</TableHead>
                            <TableHead className="text-right pr-5 text-xs">Revenue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paymentData.map(d => (
                            <TableRow key={d.name} className="hover:bg-muted/30">
                              <TableCell className="pl-5">
                                <div className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                                  <span className="font-semibold text-sm">{d.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">{d.value}</TableCell>
                              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                {report.sales.length > 0 ? ((d.value / report.sales.length) * 100).toFixed(1) : 0}%
                              </TableCell>
                              <TableCell className="text-right pr-5 font-bold font-mono" style={{ color: d.color }}>{fmtPKR(d.revenue)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button onClick={() => setShowModal(false)} variant="outline" className="gap-2">
                    <X size={14} /> Close
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
}
