import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  DollarSign, ShoppingBag, TrendingUp, TrendingDown, Package, Activity, RefreshCw,
  ShieldCheck, Boxes, AlertTriangle, Wallet, Users, ArrowRight,
  Truck, Store, BarChart3, HandCoins, CheckCircle2, Search, Zap, ChevronRight,
  ArrowUpRight, ArrowDownRight, MapPin, PhoneCall, BadgeAlert, Lock
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn, formatInvoiceId } from '../lib/utils';
import { useNotifications } from '../components/NotificationProvider';
import { subService } from '../services/subscription';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  ComposedChart, Bar, Line, Legend, BarChart,
} from 'recharts';
import { useModules } from '../contexts/ModulesContext';

interface DashboardProps { onLock: () => void; onLockSystem?: () => void; }

/* ── Formatting helpers ── */
const fmt = (n: number) => 'PKR ' + Math.round(n ?? 0).toLocaleString('en-PK');

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning', emoji: '☀️' };
  if (h < 17) return { text: 'Good afternoon', emoji: '🌤️' };
  return { text: 'Good evening', emoji: '🌙' };
};

const PIE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.38, delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }
  }),
};

/* ── Mini sparkline inside KPI cards ── */
const Sparkline = ({ data, color, gradId }: { data: number[]; color: string; gradId: string }) => {
  if (data.length < 2) return <div className="h-11" />;
  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.8}
          fill={`url(#${gradId})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

/* ── Revenue chart tooltip ── */
const RevTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = new Date(label);
  return (
    <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl px-3 py-2.5 shadow-2xl">
      <p className="text-[11px] text-muted-foreground mb-0.5">
        {!isNaN(d.getTime()) ? d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' }) : label}
      </p>
      <p className="text-sm font-bold text-indigo-500">{fmt(payload[0].value)}</p>
    </div>
  );
};

/* ── P&L chart tooltip ── */
const PlTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = new Date(label);
  const rows: { key: string; label: string; color: string }[] = [
    { key: 'revenue',     label: 'Revenue',      color: '#3b82f6' },
    { key: 'cogs',        label: 'COGS',          color: '#f97316' },
    { key: 'expenses',    label: 'Expenses',      color: '#ef4444' },
    { key: 'grossProfit', label: 'Gross Profit',  color: '#10b981' },
    { key: 'netProfit',   label: 'Net Profit',    color: '#8b5cf6' },
  ];
  const map: Record<string, number> = {};
  for (const p of payload) map[p.dataKey] = Number(p.value) || 0;
  return (
    <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl px-3.5 py-3 shadow-2xl min-w-[180px]">
      <p className="text-[11px] text-muted-foreground mb-2 font-medium">
        {!isNaN(d.getTime()) ? d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' }) : label}
      </p>
      {rows.map(r => map[r.key] !== undefined && (
        <div key={r.key} className="flex items-center justify-between gap-4 mb-1">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
            {r.label}
          </span>
          <span className={cn('text-[11px] font-bold tabular-nums', map[r.key] < 0 ? 'text-red-500' : '')} style={map[r.key] >= 0 ? { color: r.color } : undefined}>
            {fmt(map[r.key])}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ── Simple hover tooltip wrapper ── */
const HoverTip = ({ text, children }: { text: string; children: React.ReactNode }) => (
  <div className="group/tip relative">
    {children}
    <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 z-50
      opacity-0 group-hover/tip:opacity-100 transition-all duration-150
      translate-y-1 group-hover/tip:translate-y-0">
      <div className="bg-foreground text-background text-[11px] font-semibold px-2.5 py-1.5
        rounded-xl shadow-xl whitespace-nowrap">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-1 overflow-hidden">
          <div className="w-2 h-2 bg-foreground rotate-45 -translate-y-1/2" />
        </div>
      </div>
    </div>
  </div>
);

export default function Dashboard({ onLock, onLockSystem }: DashboardProps) {
  const [period, setPeriod] = useState('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [itemQuery, setItemQuery] = useState('');
  const [itemWindow, setItemWindow] = useState<'week' | 'month'>('month');
  const [itemLimit, setItemLimit] = useState(10);
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState('');
  const [now, setNow] = useState(new Date());
  const [ownerName, setOwnerName] = useState('');
  const { addNotification } = useNotifications();
  const { modules } = useModules();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountTxnChart, setAccountTxnChart] = useState<any[]>([]);
  const [bakeryData, setBakeryData] = useState<any>(null);

  /* Fetch owner name from settings once */
  useEffect(() => {
    window.api.getSettings?.().then((res: any) => {
      if (res?.success && res.data) {
        const full: string = res.data.owner_full_name || res.data.store_name || '';
        setOwnerName(full.split(' ')[0] || 'there');
      }
    }).catch(() => {});
    // Also load accounts for the cash/bank balance section
    window.api.getAccounts?.().then((res: any) => {
      if (res?.success && res.data?.accounts) setAccounts(res.data.accounts);
      if (res?.success && res.data?.chartData) setAccountTxnChart(res.data.chartData);
    }).catch(() => {});
    // Load bakery dashboard data if module is enabled
    if (modules.bakery && window.api.getBakeryDashboard) {
      window.api.getBakeryDashboard().then((res: any) => {
        if (res?.success) setBakeryData(res.data);
      }).catch(() => {});
    }
  }, []);

  const loadStats = async (isManual = false, overrides?: { s?: string; e?: string; p?: string }) => {
    setLoading(true);
    try {
      const p = overrides?.p ?? period;
      let s = overrides?.s ?? customStart;
      let e = overrides?.e ?? customEnd;
      if (p !== 'custom') {
        const d = new Date();
        e = d.toISOString();
        if (p === 'today') s = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
        else if (p === 'week') s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6).toISOString();
        else if (p === 'month') s = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
        else if (p === 'year') s = new Date(d.getFullYear(), 0, 1).toISOString();
      }
      const payload = s ? { startDate: s, endDate: e || new Date().toISOString() } : undefined;
      const [statsRes] = await Promise.all([
        window.api.getDashboardStats(payload),
        // Refresh accounts on every stats cycle so balances stay current after sales/purchases/expenses
        window.api.getAccounts?.().then((r: any) => {
          if (r?.success && r.data?.accounts) setAccounts(r.data.accounts);
          if (r?.success && r.data?.chartData) setAccountTxnChart(r.data.chartData);
        }).catch(() => {}),
      ]);
      if (statsRes?.success && statsRes.data) {
        setStats(statsRes.data);
        if (isManual) addNotification('Dashboard refreshed', 'Latest metrics loaded.', 'success');
      } else if (isManual) {
        addNotification('Refresh Failed', statsRes?.error || 'Could not fetch analytics.', 'error');
      }
    } catch (err) {
      console.error(err);
      if (isManual) addNotification('Refresh Failed', 'Could not fetch analytics.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    const refresh = setInterval(() => loadStats(), 30_000);
    const clock = setInterval(() => setNow(new Date()), 1_000);
    const license = setInterval(() => {
      const sub = subService.getState();
      if (sub.expiryDate) {
        const diff = new Date(sub.expiryDate).getTime() - Date.now();
        if (diff > 0) {
          const d = Math.floor(diff / 86_400_000);
          const h = Math.floor((diff % 86_400_000) / 3_600_000);
          const m = Math.floor((diff % 3_600_000) / 60_000);
          const sec = Math.floor((diff % 60_000) / 1_000);
          setTimeLeft(`${d}d ${h}h ${m}m ${sec}s`);
        } else setTimeLeft('Expired');
      }
    }, 1_000);
    return () => { clearInterval(refresh); clearInterval(clock); clearInterval(license); };
  }, []);

  const handleCustomFilter = () => {
    if (!customStart) { addNotification('Missing Date', 'Select a start date.', 'warning'); return; }
    loadStats(true, { p: 'custom', s: new Date(customStart).toISOString(), e: customEnd ? new Date(customEnd).toISOString() : '' });
  };

  /* ── derived data ── */
  const salesTrend = useMemo(() =>
    (Array.isArray(stats?.salesTrend) ? stats.salesTrend : [])
      .filter((r: any) => r?.date)
      .map((r: any) => ({ ...r, revenue: Number(r.revenue) || 0 })),
    [stats?.salesTrend]);

  const sparkValues = useMemo(() => {
    const arr = salesTrend.map((r: any) => r.revenue);
    return arr.length > 1 ? arr.slice(-Math.min(arr.length, 10)) : [];
  }, [salesTrend]);

  const paymentData = useMemo(() =>
    (Array.isArray(stats?.paymentStats) ? stats.paymentStats : [])
      .map((r: any) => ({ ...r, revenue: Number(r.revenue) || 0 }))
      .filter((r: any) => r.revenue > 0),
    [stats?.paymentStats]);

  const allItemRows = useMemo(() => {
    const rows = Array.isArray(stats?.productSalesWindows) ? stats.productSalesWindows : [];
    const q = itemQuery.trim().toLowerCase();
    return q ? rows.filter((r: any) => String(r.name || '').toLowerCase().includes(q)) : rows;
  }, [stats?.productSalesWindows, itemQuery]);

  const deadRows = useMemo(() =>
    (Array.isArray(stats?.deadProducts) ? stats.deadProducts : []).slice(0, 30),
    [stats?.deadProducts]);

  const bestMonthMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of (Array.isArray(stats?.bestMonthByProduct) ? stats.bestMonthByProduct : []))
      m.set(String(r.product_name || ''), r);
    return m;
  }, [stats?.bestMonthByProduct]);

  /* ── stock summary ── */
  const lowStock: any[] = stats?.lowStockProducts || [];
  const outOfStockCount = lowStock.filter((p: any) => p.stock === 0).length;
  const lowStockCount = lowStock.filter((p: any) => p.stock > 0).length;
  /* backend returns totalProducts (all active products) */
  const totalProductCount: number = stats?.totalProducts || 0;
  const inStockCount = Math.max(0, totalProductCount - outOfStockCount - lowStockCount);

  const stockSummaryData = useMemo(() => {
    return [
      { name: 'In Stock', value: inStockCount, color: '#10b981' },
      { name: 'Low Stock', value: lowStockCount, color: '#f59e0b' },
      { name: 'Out of Stock', value: outOfStockCount, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [inStockCount, lowStockCount, outOfStockCount]);

  const totalStockValue: number = stats?.totalStockValue || 0;
  const totalRetailValue: number = stats?.totalRetailValue || 0;
  const totalLoans: number = stats?.totalOutstandingLoans || 0;
  const debtorCount: number = stats?.customersInDebt || 0;
  const totalStockItems = totalProductCount || (inStockCount + lowStockCount + outOfStockCount);

  const totalCash = accounts.filter((a: any) => a.type === 'cash').reduce((s: number, a: any) => s + (Number(a.current_balance) || 0), 0);
  const totalBank = accounts.filter((a: any) => a.type === 'bank').reduce((s: number, a: any) => s + (Number(a.current_balance) || 0), 0);
  const totalFunds = totalCash + totalBank;

  /* ── P&L chart data ── */
  const plChartData = useMemo(() => {
    return (Array.isArray(stats?.plTrend) ? stats.plTrend : []).map((d: any) => ({
      day:         d.day,
      revenue:     Number(d.revenue)     || 0,
      cogs:        Number(d.cogs)        || 0,
      expenses:    Number(d.expenses)    || 0,
      grossProfit: Number(d.grossProfit) || 0,
      netProfit:   Number(d.netProfit)   || 0,
    }));
  }, [stats?.plTrend]);

  /* P&L summary totals for header strip */
  const plTotals = useMemo(() => {
    const zero = { revenue: 0, cogs: 0, expenses: 0, grossProfit: 0, netProfit: 0 };
    return plChartData.reduce((acc, d) => ({
      revenue:     acc.revenue     + d.revenue,
      cogs:        acc.cogs        + d.cogs,
      expenses:    acc.expenses    + d.expenses,
      grossProfit: acc.grossProfit + d.grossProfit,
      netProfit:   acc.netProfit   + d.netProfit,
    }), zero);
  }, [plChartData]);

  /* Account chart data — each account with in/out bars */
  const accountChartData = useMemo(() =>
    accounts.map((a: any) => ({
      name:    a.bank_name ? `${a.name}\n${a.bank_name}` : a.name,
      shortName: a.name,
      balance: Math.max(0, Number(a.current_balance) || 0),
      total_in:  Number(a.total_in) || 0,
      total_out: Number(a.total_out) || 0,
      type:    a.type,
    })),
    [accounts]);

  /* Daily cash flow chart (IN vs OUT) — use camelCase keys for recharts compatibility */
  const cashFlowChartData = useMemo(() =>
    accountTxnChart.map((d: any) => ({
      day:      d.day,
      moneyIn:  Number(d.total_in) || 0,
      moneyOut: Number(d.total_out) || 0,
    })),
    [accountTxnChart]);

  const greeting = getGreeting();
  const displayName = ownerName || 'there';

  const PERIODS = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'year', label: 'This Year' },
    { id: 'custom', label: 'Custom' },
  ];

  const quickActions = [
    { title: 'New Sale', path: '/sales', icon: ShoppingBag, from: '#3b82f6', to: '#2563eb' },
    { title: 'Products', path: '/products', icon: Package, from: '#8b5cf6', to: '#7c3aed' },
    { title: 'Purchase', path: '/purchases', icon: Truck, from: '#f97316', to: '#ea580c' },
    { title: 'Inventory', path: '/inventory', icon: Boxes, from: '#06b6d4', to: '#0891b2' },
    { title: 'Customers', path: '/customers', icon: Users, from: '#10b981', to: '#059669' },
    { title: 'Vendors', path: '/vendors', icon: Store, from: '#f59e0b', to: '#d97706' },
    { title: 'Accounts', path: '/loans', icon: HandCoins, from: '#ef4444', to: '#dc2626' },
    { title: 'Reports', path: '/reports', icon: BarChart3, from: '#6366f1', to: '#4f46e5' },
  ];

  if (loading && !stats) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <RefreshCw size={26} className="animate-spin text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">Loading Analytics</p>
            <p className="text-xs text-muted-foreground mt-0.5">Fetching your business data…</p>
          </div>
        </div>
      </div>
    );
  }

  const sub = subService.getState();

  const periodLabel = period === 'today' ? 'day' : period === 'week' ? '7 days' : period === 'month' ? 'month' : 'year';

  return (
    <div className="flex flex-col gap-5 pb-12">

      {/* ── License Expiry Banner ── */}
      {sub.plan !== 'lifetime' && sub.daysRemaining <= 5 && (
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl shadow-red-500/20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="bg-white/20 p-2.5 rounded-xl animate-pulse">
                <AlertTriangle size={18} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">License Expiring Soon</p>
                <p className="text-white/80 text-xs mt-0.5">Ends in <span className="font-bold text-white">{timeLeft || `${sub.daysRemaining}d`}</span> — renew to avoid lockout</p>
              </div>
            </div>
            <Link to="/subscription" className="relative z-10 shrink-0">
              <Button size="sm" className="bg-white text-red-600 hover:bg-white/90 font-bold h-9 px-5 rounded-xl shadow-lg">Renew Now →</Button>
            </Link>
          </div>
        </motion.div>
      )}

      {/* ── Header ── */}
      <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {greeting.text}, <span className="text-primary">{displayName}</span> {greeting.emoji}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Here's what's happening with your store today.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 bg-muted/60 p-1 rounded-xl border border-border/40">
              {PERIODS.map((p) => (
                <button key={p.id}
                  onClick={() => { setPeriod(p.id); if (p.id !== 'custom') loadStats(true, { p: p.id }); }}
                  className={cn('relative h-7 px-3 text-xs font-semibold rounded-lg transition-all duration-200',
                    period === p.id ? 'bg-background text-primary shadow-sm border border-border/30' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {p.label}
                  {loading && period === p.id && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary animate-pulse shadow-sm shadow-primary/50" />
                  )}
                </button>
              ))}
            </div>
            {/* Lock Dashboard — covers content area, sidebar stays usable */}
            <Button variant="outline" size="sm" onClick={onLock}
              className="h-9 gap-2 rounded-xl border-border/50 text-muted-foreground hover:border-blue-500/40 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <ShieldCheck size={14} /><span className="hidden sm:inline text-xs">Lock</span>
            </Button>
            {/* Lock System — covers everything including sidebar */}
            {onLockSystem && (
              <Button variant="outline" size="sm" onClick={onLockSystem}
                className="h-9 gap-2 rounded-xl border-red-500/25 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20">
                <Lock size={14} /><span className="hidden sm:inline text-xs">Lock System</span>
              </Button>
            )}
            <button onClick={() => loadStats(true)}
              className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/25 hover:bg-primary/90 active:scale-95 transition-all"
              title="Refresh">
              <RefreshCw className={cn('h-4 w-4 text-primary-foreground', loading && 'animate-spin')} />
            </button>
          </div>
        </div>
        {period === 'custom' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl p-2 border border-border/40">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-3 text-xs" />
              <span className="text-muted-foreground text-xs">→</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-3 text-xs" />
              <Button size="sm" onClick={handleCustomFilter} className="h-8 px-4 rounded-lg text-xs">Apply</Button>
            </div>
          </motion.div>
        )}
      </motion.div>

      {stats && (
        <div className="flex flex-col gap-5" style={{ opacity: loading ? 0.72 : 1, transition: 'opacity 0.25s ease' }}>
          {/* ── Bakery Dashboard Section ── */}
          {modules.bakery && bakeryData && (
            <motion.div custom={0.5} variants={fadeUp} initial="hidden" animate="visible">
              <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-amber-500/3 overflow-hidden shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between p-5 pb-3 border-b border-orange-500/15">
                  <div className="flex items-center gap-3">
                    <div className="bg-orange-500/15 p-2.5 rounded-xl">
                      <span className="text-xl">🧁</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-orange-700 dark:text-orange-400">Bakery Dashboard</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {bakeryData.summary?.totalBakeryProducts ?? 0} bakery products ·{' '}
                        {bakeryData.summary?.totalExpired ?? 0} expired ·{' '}
                        {bakeryData.summary?.totalExpiringToday ?? 0} expiring today
                      </p>
                    </div>
                  </div>
                  <Link to="/products">
                    <Button variant="outline" size="sm" className="h-8 gap-1 rounded-xl text-xs border-orange-500/30 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20">
                      Manage <ArrowRight size={11} />
                    </Button>
                  </Link>
                </div>

                {/* Summary chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 pb-0">
                  {[
                    { label: 'Total Bakery', value: bakeryData.summary?.totalBakeryProducts ?? 0, color: 'text-orange-600', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
                    { label: 'Expired', value: bakeryData.summary?.totalExpired ?? 0, color: 'text-red-600', bg: 'bg-red-500/10', border: 'border-red-500/20' },
                    { label: 'Expiring Today', value: bakeryData.summary?.totalExpiringToday ?? 0, color: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                    { label: 'Near Expiry (7d)', value: bakeryData.summary?.totalExpiringSoon ?? 0, color: 'text-yellow-600', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
                  ].map(chip => (
                    <div key={chip.label} className={cn('rounded-xl border p-3', chip.bg, chip.border)}>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{chip.label}</p>
                      <p className={cn('text-2xl font-bold', chip.color)}>{chip.value}</p>
                    </div>
                  ))}
                </div>

                {/* Expired Products */}
                {bakeryData.expiredProducts?.length > 0 && (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Expired Products</p>
                      <span className="text-[10px] bg-red-500/10 text-red-600 border border-red-500/20 rounded-full px-2 py-0.5 font-mono">{bakeryData.expiredProducts.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {bakeryData.expiredProducts.slice(0, 5).map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-xs font-semibold">{p.name}</p>
                            <p className="text-[10px] text-red-500">Expired: {new Date(p.expiry_date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Stock: {p.stock ?? 0}</p>
                          </div>
                        </div>
                      ))}
                      {bakeryData.expiredProducts.length > 5 && (
                        <p className="text-[11px] text-muted-foreground text-center pt-1">+{bakeryData.expiredProducts.length - 5} more expired</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Expiring Today */}
                {bakeryData.expiringToday?.length > 0 && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Expiring Today</p>
                    </div>
                    <div className="space-y-1.5">
                      {bakeryData.expiringToday.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
                          <p className="text-xs font-semibold">{p.name}</p>
                          <p className="text-[10px] text-amber-600 font-medium">Today · Stock: {p.stock ?? 0}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Near Expiry (7 days) */}
                {bakeryData.expiringSoon?.length > 0 && (
                  <div className="px-4 pb-4">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      <p className="text-xs font-bold text-yellow-600 uppercase tracking-wider">Near Expiry (Next 7 Days)</p>
                    </div>
                    <div className="space-y-1.5">
                      {bakeryData.expiringSoon.slice(0, 5).map((p: any) => {
                        const daysLeft = p.expiry_date ? Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / 86400000) : null;
                        return (
                          <div key={p.id} className="flex items-center justify-between bg-yellow-500/5 border border-yellow-500/15 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-xs font-semibold">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground">{new Date(p.expiry_date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}</p>
                            </div>
                            <p className="text-[10px] font-bold text-yellow-600">{daysLeft !== null ? `${daysLeft}d left` : ''}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!bakeryData.expiredProducts?.length && !bakeryData.expiringToday?.length && !bakeryData.expiringSoon?.length && (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                    <span className="text-3xl">✅</span>
                    <p className="text-xs font-medium">All bakery products are within expiry dates</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── KPI Row 1 — with sparklines + hover tooltip ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Period Revenue', value: fmt(stats.filteredRevenue || 0), sub: `vs previous ${periodLabel}`, icon: DollarSign, color: '#3b82f6', gradId: 'sk-blue', accent: 'blue', pct: stats.revenuePctChange ?? null },
              { title: 'Actual Revenue', value: fmt(stats.filteredProfit || 0), sub: `vs previous ${periodLabel}`, icon: TrendingUp, color: '#10b981', gradId: 'sk-green', accent: 'emerald', pct: stats.profitPctChange ?? null },
              { title: 'Transactions', value: (stats.filteredCount || 0).toLocaleString(), sub: `vs previous ${periodLabel}`, icon: Activity, color: '#8b5cf6', gradId: 'sk-violet', accent: 'violet', pct: stats.countPctChange ?? null, noFmt: true },
              { title: "Today's Revenue", value: fmt(stats.totalSalesToday || 0), sub: 'vs yesterday', icon: Zap, color: '#f59e0b', gradId: 'sk-amber', accent: 'amber', pct: stats.todayPctChange ?? null },
            ].map((card, i) => {
              const accMap: Record<string, { bg: string; icon: string; border: string; grad: string }> = {
                blue: { bg: 'bg-blue-500/10', icon: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/15', grad: 'from-blue-500/6' },
                emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/15', grad: 'from-emerald-500/6' },
                violet: { bg: 'bg-violet-500/10', icon: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/15', grad: 'from-violet-500/6' },
                amber: { bg: 'bg-amber-500/10', icon: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/15', grad: 'from-amber-500/6' },
              };
              const c = accMap[card.accent];
              return (
                <motion.div key={i} custom={i + 2} variants={fadeUp} initial="hidden" animate="visible">
                  <HoverTip text={card.value}>
                    <div className={cn('relative overflow-hidden rounded-2xl border bg-card hover:-translate-y-1 hover:shadow-lg transition-all duration-300 cursor-default', c.border)}>
                      <div className={cn('absolute inset-0 bg-gradient-to-br via-transparent to-transparent opacity-70', c.grad)} />
                      <div className="relative z-10 px-5 pt-5 pb-0">
                        <div className="flex items-start justify-between mb-3">
                          <div className={cn('p-2.5 rounded-xl', c.bg)}>
                            <card.icon size={16} className={c.icon} />
                          </div>
                          {card.pct !== null ? (
                            <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-bold',
                              card.pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                            )}>
                              {card.pct >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                              {Math.abs(card.pct).toFixed(1)}%
                            </span>
                          ) : (
                            <ChevronRight size={12} className="text-muted-foreground/30 mt-0.5" />
                          )}
                        </div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">{card.title}</p>
                        <p className="text-xl font-bold tracking-tight leading-tight">{card.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{card.sub}</p>
                      </div>
                      {/* sparkline */}
                      <div className="relative z-10 -mx-0.5">
                        <Sparkline data={sparkValues} color={card.color} gradId={card.gradId} />
                      </div>
                    </div>
                  </HoverTip>
                </motion.div>
              );
            })}
          </div>

          {/* ── KPI Row 2 ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Stock Value', value: fmt(totalStockValue), sub: 'Total inventory at cost', icon: Boxes, accent: 'cyan' },
              { title: 'Retail Stock Value', value: fmt(totalRetailValue), sub: `Profit: ${fmt(totalRetailValue - totalStockValue)}`, icon: TrendingUp, accent: 'emerald' },
              { title: 'Customer Credit (AR)', value: fmt(totalLoans), sub: `${debtorCount} registered debtors`, icon: Wallet, accent: totalLoans > 0 ? 'red' : 'muted' },
              { title: 'Low Stock Alert', value: String(lowStock.length), sub: 'Products below threshold', icon: AlertTriangle, accent: lowStock.length > 0 ? 'orange' : 'muted' },
            ].map((card, i) => {
              const accMap: Record<string, { bg: string; icon: string; border: string; grad: string; val: string }> = {
                cyan: { bg: 'bg-cyan-500/10', icon: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/15', grad: 'from-cyan-500/6', val: 'text-foreground' },
                emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/15', grad: 'from-emerald-500/6', val: 'text-foreground' },
                red: { bg: 'bg-red-500/10', icon: 'text-red-600 dark:text-red-400', border: 'border-red-400/20', grad: 'from-red-500/6', val: 'text-red-500' },
                orange: { bg: 'bg-orange-500/10', icon: 'text-orange-600 dark:text-orange-400', border: 'border-orange-400/20', grad: 'from-orange-500/6', val: 'text-orange-500' },
                muted: { bg: 'bg-muted', icon: 'text-muted-foreground', border: 'border-border/50', grad: 'from-transparent', val: 'text-foreground' },
              };
              const c = accMap[card.accent];
              return (
                <motion.div key={i} custom={i + 6} variants={fadeUp} initial="hidden" animate="visible">
                  <HoverTip text={card.value}>
                    <div className={cn('relative overflow-hidden rounded-2xl border bg-card p-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 cursor-default', c.border)}>
                      <div className={cn('absolute inset-0 bg-gradient-to-br via-transparent to-transparent opacity-70', c.grad)} />
                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-4">
                          <div className={cn('p-2.5 rounded-xl', c.bg)}>
                            <card.icon size={16} className={c.icon} />
                          </div>
                          <ChevronRight size={12} className="text-muted-foreground/30" />
                        </div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">{card.title}</p>
                        <p className={cn('text-xl font-bold tracking-tight', c.val)}>{card.value}</p>
                        <p className="text-xs text-muted-foreground mt-1.5">{card.sub}</p>
                      </div>
                    </div>
                  </HoverTip>
                </motion.div>
              );
            })}
          </div>

          {/* ── Accounts & Cash Section ── */}
          {modules.accounting && accounts.length > 0 && (
            <motion.div custom={9} variants={fadeUp} initial="hidden" animate="visible">
              <div className="rounded-2xl bg-card p-5 relative overflow-hidden" style={{ border: '1px solid rgba(16,185,129,0.2)', boxShadow: '0 4px 24px -4px rgba(16,185,129,0.10), 0 1px 4px rgba(0,0,0,0.05)' }}>
                {/* Top accent bar */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-400" />
                <div className="flex items-center justify-between mb-4 mt-1">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <Wallet size={15} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">Accounts & Cash</h3>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">Live balances across all accounts</p>
                    </div>
                  </div>
                  <Link to="/accounts">
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-xl">
                      View All <ArrowRight size={12} />
                    </Button>
                  </Link>
                </div>

                {/* Summary totals */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Cash in Hand', value: totalCash, borderCls: 'border-emerald-500/20 bg-emerald-500/5', valCls: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Bank Total', value: totalBank, borderCls: 'border-blue-500/20 bg-blue-500/5', valCls: 'text-blue-600 dark:text-blue-400' },
                    { label: 'Net Funds', value: totalFunds, borderCls: totalFunds >= 0 ? 'border-violet-500/20 bg-violet-500/5' : 'border-red-400/20 bg-red-500/5', valCls: totalFunds >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-600 dark:text-red-400' },
                  ].map(({ label, value, borderCls, valCls }) => (
                    <div key={label} className={cn('rounded-xl border px-3 py-2.5', borderCls)}>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</p>
                      <p className={cn('text-sm font-black mt-0.5 truncate', valCls)}>{fmt(value)}</p>
                    </div>
                  ))}
                </div>

                {/* Individual account cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {accounts.map((acc: any) => (
                    <div key={acc.id} className={cn(
                      'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
                      acc.type === 'cash'
                        ? 'bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/25'
                        : 'bg-blue-500/5 border-blue-500/10 hover:border-blue-500/25'
                    )}>
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', acc.type === 'cash' ? 'bg-emerald-500' : 'bg-blue-500')} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold truncate text-foreground">{acc.name}</p>
                        {acc.bank_name && <p className="text-[9px] text-muted-foreground/60 truncate">{acc.bank_name}</p>}
                        <p className={cn('text-[11px] font-black truncate', acc.type === 'cash' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400')}>
                          {fmt(Number(acc.current_balance) || 0)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cash Flow Charts */}
                {accountChartData.length > 0 && (() => {
                  const hasFlow = accountChartData.some(a => a.total_in > 0 || a.total_out > 0);
                  const hasTrend = cashFlowChartData.some(d => d.moneyIn > 0 || d.moneyOut > 0);

                  return (
                    <div className="mt-4 space-y-4">
                      {/* Per-account balance + IN/OUT */}
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">
                          {hasFlow ? 'Cash Flow by Account (Total)' : 'Balance by Account'}
                        </p>
                        <ResponsiveContainer width="100%" height={Math.max(90, accountChartData.length * (hasFlow ? 52 : 36) + 20)}>
                          <BarChart
                            data={accountChartData}
                            layout="vertical"
                            margin={{ top: 4, right: 54, left: 4, bottom: 4 }}
                            barSize={hasFlow ? 10 : 15}
                            barCategoryGap="28%"
                          >
                            <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border) / 0.3)" horizontal={false} />
                            <XAxis
                              type="number" fontSize={9} tickLine={false} axisLine={false}
                              tick={{ fill: 'hsl(var(--muted-foreground))' }}
                              tickFormatter={v => {
                                const n = Number(v);
                                if (n === 0) return '0';
                                if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
                                if (n >= 1000) return `${Math.round(n / 1000)}k`;
                                return String(Math.round(n));
                              }}
                            />
                            <YAxis
                              type="category" dataKey="shortName"
                              width={82} fontSize={10}
                              tickLine={false} axisLine={false}
                              tick={{ fill: 'hsl(var(--muted-foreground))' }}
                            />
                            <Tooltip
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '16px', border: '1px solid hsl(var(--border))', fontSize: 11, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
                              formatter={(v: any, name: string) => [fmt(Number(v)), name]}
                            />
                            {hasFlow ? (
                              <>
                                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconType="circle" iconSize={7} />
                                <Bar dataKey="total_in" name="Money In" fill="#10b981" radius={[0, 4, 4, 0]}
                                  label={{ position: 'right', fontSize: 9, fill: 'hsl(var(--muted-foreground))', formatter: (v: number) => v > 0 ? fmt(v) : '' }} />
                                <Bar dataKey="total_out" name="Money Out" fill="#ef4444" radius={[0, 4, 4, 0]}
                                  label={{ position: 'right', fontSize: 9, fill: 'hsl(var(--muted-foreground))', formatter: (v: number) => v > 0 ? fmt(v) : '' }} />
                              </>
                            ) : (
                              <Bar dataKey="balance" name="Balance" radius={[0, 5, 5, 0]}
                                label={{ position: 'right', fontSize: 9, fill: 'hsl(var(--muted-foreground))', formatter: (v: number) => fmt(v) }}>
                                {accountChartData.map((a, i) => (
                                  <Cell key={i} fill={a.type === 'cash' ? '#10b981' : '#3b82f6'} />
                                ))}
                              </Bar>
                            )}
                          </BarChart>
                        </ResponsiveContainer>
                        {!hasFlow && (
                          <p className="text-[10px] text-muted-foreground/50 italic text-center mt-1">
                            Cash flow tracking starts once you record sales or purchases with an account selected
                          </p>
                        )}
                      </div>

                      {/* 30-Day trend — only when there is real data */}
                      {hasTrend && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">30-Day Cash Flow Trend</p>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" style={{ boxShadow: '0 0 5px rgba(16,185,129,0.6)' }} />In</span>
                              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" style={{ boxShadow: '0 0 5px rgba(239,68,68,0.6)' }} />Out</span>
                            </div>
                          </div>
                          <ResponsiveContainer width="100%" height={140}>
                            <ComposedChart data={cashFlowChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
                                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.22} />
                                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border) / 0.35)" />
                              <XAxis dataKey="day" fontSize={9} tickLine={false} axisLine={false}
                                tick={{ fill: 'hsl(var(--muted-foreground))' }} minTickGap={32} interval="preserveStartEnd"
                                tickFormatter={str => { const d = new Date(str); return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }}
                              />
                              <YAxis fontSize={9} tickLine={false} axisLine={false} width={44}
                                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                tickFormatter={v => { const n = Number(v); if (n === 0) return '0'; if (n >= 100000) return `${(n/100000).toFixed(1)}L`; return `${Math.round(n/1000)}k`; }}
                              />
                              <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '16px', border: '1px solid hsl(var(--border))', fontSize: 11, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
                                formatter={(v: any, name: string) => [fmt(Number(v)), name]}
                                labelFormatter={str => { const d = new Date(str); return isNaN(d.getTime()) ? str : d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' }); }}
                              />
                              <Area type="monotone" dataKey="moneyIn" name="Money In" stroke="#10b981" strokeWidth={2.2} fill="url(#inGrad)" dot={false} />
                              <Area type="monotone" dataKey="moneyOut" name="Money Out" stroke="#ef4444" strokeWidth={2.2} fill="url(#outGrad)" dot={false} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          )}

          {/* ── Charts: Revenue Overview + Stock Summary ── */}
          <motion.div custom={10} variants={fadeUp} initial="hidden" animate="visible">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

              {/* Revenue Overview — 3/5 */}
              <div className="lg:col-span-3 rounded-2xl bg-card overflow-hidden relative" style={{ border: '1px solid rgba(99,102,241,0.2)', boxShadow: '0 4px 28px -4px rgba(99,102,241,0.14), 0 1px 4px rgba(0,0,0,0.06)' }}>
                {/* Top accent bar */}
                <div className="h-[3px] bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-400" />
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" style={{ boxShadow: '0 0 8px rgba(99,102,241,0.65)' }} />
                      <h3 className="text-sm font-bold tracking-tight">Revenue Overview</h3>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 ml-[18px]">Daily sales trend for selected period</p>
                  </div>
                  {salesTrend.length > 0 && (
                    <div className="text-right shrink-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-0.5">Period Total</p>
                      <p className="text-lg font-black text-indigo-500 tabular-nums">{fmt(salesTrend.reduce((s: number, r: any) => s + r.revenue, 0))}</p>
                    </div>
                  )}
                </div>
                <div className="h-[264px] pb-3">
                  {salesTrend.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <BarChart3 size={32} className="opacity-20" />
                      <p className="text-xs">No trend data for selected period</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={salesTrend} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.32} />
                            <stop offset="50%" stopColor="#6366f1" stopOpacity={0.10} />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border) / 0.4)" />
                        <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false}
                          tick={{ fill: 'hsl(var(--muted-foreground))' }} minTickGap={28} interval="preserveStartEnd"
                          tickFormatter={str => { const d = new Date(str); return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }}
                        />
                        <YAxis fontSize={10} tickLine={false} axisLine={false} width={72}
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          tickFormatter={v => `PKR ${Number(v).toLocaleString('en-PK')}`}
                        />
                        <Tooltip content={<RevTooltip />} />
                        <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5}
                          fill="url(#revGrad)" dot={false}
                          activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 2.5, fill: 'hsl(var(--card))' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Stock Summary — 2/5 */}
              <div className="lg:col-span-2 rounded-2xl bg-card overflow-hidden relative" style={{ border: `1px solid ${outOfStockCount > 0 ? 'rgba(239,68,68,0.2)' : lowStockCount > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`, boxShadow: `0 4px 24px -4px ${outOfStockCount > 0 ? 'rgba(239,68,68,0.10)' : lowStockCount > 0 ? 'rgba(245,158,11,0.10)' : 'rgba(16,185,129,0.10)'}, 0 1px 4px rgba(0,0,0,0.05)` }}>
                {/* Top accent bar */}
                <div className={cn("h-[3px]", outOfStockCount > 0 ? "bg-gradient-to-r from-red-600 to-rose-400" : lowStockCount > 0 ? "bg-gradient-to-r from-amber-500 to-yellow-400" : "bg-gradient-to-r from-emerald-600 to-teal-400")} />
                <div className="px-5 pt-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn("w-2.5 h-2.5 rounded-full inline-block", outOfStockCount > 0 ? "bg-red-500" : lowStockCount > 0 ? "bg-amber-500" : "bg-emerald-500")} />
                        <h3 className="text-sm font-bold tracking-tight">Stock Summary</h3>
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 ml-[18px]">Inventory health overview</p>
                    </div>
                    <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border",
                      outOfStockCount > 0
                        ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                        : lowStockCount > 0
                        ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    )}>
                      {outOfStockCount > 0 ? `${outOfStockCount} out of stock` : lowStockCount > 0 ? `${lowStockCount} low stock` : 'All good ✓'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col">
                  {stockSummaryData.length === 0 ? (
                    /* fallback: payment methods */
                    paymentData.length === 0 ? (
                      <div className="h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Boxes size={32} className="opacity-20" />
                        <p className="text-xs">No stock data available</p>
                      </div>
                    ) : (
                      <>
                        <div style={{ height: 180 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={paymentData} cx="50%" cy="48%" innerRadius={52} outerRadius={78}
                                paddingAngle={4} dataKey="revenue" nameKey="payment_method" stroke="none">
                                {paymentData.map((_: any, idx: number) => (
                                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '14px', border: '1px solid hsl(var(--border))', fontSize: '12px' }}
                                formatter={(v: any) => [fmt(v), '']} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="px-4 pb-3 space-y-1.5">
                          {paymentData.map((e: any, i: number) => {
                            const total = paymentData.reduce((s: number, x: any) => s + x.revenue, 0);
                            const pct = total > 0 ? Math.round((e.revenue / total) * 100) : 0;
                            return (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                  <span className="text-muted-foreground capitalize">{e.payment_method}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-[10px]">{fmt(e.revenue)}</span>
                                  <span className="font-semibold w-8 text-right">{pct}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )
                  ) : (
                    <>
                      <div className="relative" style={{ height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={stockSummaryData} cx="50%" cy="50%" innerRadius={60} outerRadius={86}
                              paddingAngle={3} dataKey="value" nameKey="name" stroke="none">
                              {stockSummaryData.map((entry: any, idx: number) => (
                                <Cell key={idx} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '16px', border: '1px solid hsl(var(--border))', fontSize: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
                              formatter={(v: any, n: any) => [`${v} items`, n]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Center label */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <p className="text-2xl font-bold tabular-nums">{totalStockItems.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground font-medium">Total Items</p>
                        </div>
                      </div>
                      <div className="px-4 pb-4 space-y-2.5">
                        {stockSummaryData.map((seg: any) => {
                          const pct = totalStockItems > 0 ? Math.round((seg.value / totalStockItems) * 100) : 0;
                          return (
                            <div key={seg.name}>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                                  <span className="text-muted-foreground/90 font-medium">{seg.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold tabular-nums">{seg.value.toLocaleString()}</span>
                                  <span className="text-muted-foreground text-[10px] w-7 text-right">{pct}%</span>
                                </div>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: seg.color, boxShadow: `0 0 6px ${seg.color}80` }} />
                              </div>
                            </div>
                          );
                        })}
                        <Link to="/inventory" className="block mt-1.5">
                          <div className="flex items-center gap-1 text-[11px] text-primary font-semibold hover:underline">
                            <BarChart3 size={11} /> View Stock Report →
                          </div>
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Profit & Loss Multi-Level Chart ── */}
          <motion.div custom={10.5} variants={fadeUp} initial="hidden" animate="visible">
            <div className="rounded-2xl bg-card overflow-hidden" style={{ border: '1px solid rgba(139,92,246,0.18)', boxShadow: '0 4px 28px -4px rgba(139,92,246,0.12), 0 1px 4px rgba(0,0,0,0.06)' }}>
              {/* Top accent bar */}
              <div className="h-[3px] bg-gradient-to-r from-violet-600 via-purple-500 to-indigo-500" />
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 pt-4 pb-4 gap-3 border-b border-border/30">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" style={{ boxShadow: '0 0 8px rgba(139,92,246,0.65)' }} />
                    <h3 className="text-sm font-bold tracking-tight">Profit &amp; Loss — Last 30 Days</h3>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70 ml-[18px]">Revenue · COGS · Expenses · Gross &amp; Net Profit</p>
                </div>
                {plChartData.length > 0 && (
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {[
                      { label: 'Revenue',  value: plTotals.revenue,     color: 'text-blue-500',    bg: 'bg-blue-500/8 border-blue-500/20'   },
                      { label: 'COGS',     value: plTotals.cogs,        color: 'text-orange-500',  bg: 'bg-orange-500/8 border-orange-500/20' },
                      { label: 'Expenses', value: plTotals.expenses,    color: 'text-red-500',     bg: 'bg-red-500/8 border-red-500/20'     },
                      { label: 'Gross',    value: plTotals.grossProfit, color: plTotals.grossProfit >= 0 ? 'text-emerald-500' : 'text-red-500', bg: 'bg-emerald-500/8 border-emerald-500/20' },
                      { label: 'Net',      value: plTotals.netProfit,   color: plTotals.netProfit  >= 0 ? 'text-violet-500'  : 'text-red-500', bg: 'bg-violet-500/8 border-violet-500/20'   },
                    ].map(({ label, value, color, bg }) => (
                      <div key={label} className={cn('px-2.5 py-1.5 rounded-xl border', bg)}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">{label}</p>
                        <p className={cn('text-xs font-bold tabular-nums', color)}>{fmt(value)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Multi-line Chart */}
              <div className="h-[320px] px-1 pb-2 pt-2">
                {plChartData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <TrendingUp size={32} className="opacity-20" />
                    <p className="text-xs">No data for the last 30 days</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={plChartData} margin={{ top: 12, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        {/* Subtle area fills under profit lines for visual depth */}
                        <linearGradient id="plGrossArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.10} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="plNetArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.08} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border) / 0.38)" />
                      <XAxis
                        dataKey="day" fontSize={10} tickLine={false} axisLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        interval="preserveStartEnd" minTickGap={28}
                        tickFormatter={str => { const d = new Date(str); return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }}
                      />
                      <YAxis
                        fontSize={10} tickLine={false} axisLine={false} width={72}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={v => `PKR ${Number(v).toLocaleString('en-PK')}`}
                      />
                      <Tooltip content={<PlTooltip />} />
                      {/* Subtle area fills — rendered first so lines sit on top */}
                      <Area type="monotone" dataKey="grossProfit" fill="url(#plGrossArea)" stroke="none" isAnimationActive={false} legendType="none" />
                      <Area type="monotone" dataKey="netProfit"   fill="url(#plNetArea)"   stroke="none" isAnimationActive={false} legendType="none" />
                      {/* Revenue — bold solid blue */}
                      <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2}
                        dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#3b82f6', fill: 'hsl(var(--card))' }} />
                      {/* COGS — dashed orange (cost metric, secondary) */}
                      <Line type="monotone" dataKey="cogs" stroke="#f97316" strokeWidth={1.6}
                        strokeDasharray="5 3" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#f97316', fill: 'hsl(var(--card))' }} />
                      {/* Expenses — dashed red (cost metric, secondary) */}
                      <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={1.6}
                        strokeDasharray="5 3" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#ef4444', fill: 'hsl(var(--card))' }} />
                      {/* Gross Profit — solid emerald, medium weight */}
                      <Line type="monotone" dataKey="grossProfit" stroke="#10b981" strokeWidth={2.4}
                        dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#10b981', fill: 'hsl(var(--card))' }} />
                      {/* Net Profit — solid violet, boldest — the headline number */}
                      <Line type="monotone" dataKey="netProfit" stroke="#8b5cf6" strokeWidth={3}
                        dot={false} activeDot={{ r: 6, strokeWidth: 2.5, stroke: '#8b5cf6', fill: 'hsl(var(--card))' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Legend colour key strip */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-3 border-t border-border/20 bg-muted/15">
                {[
                  { color: '#3b82f6', label: 'Revenue',      stroke: 2,   dash: false },
                  { color: '#f97316', label: 'COGS',          stroke: 1.6, dash: true  },
                  { color: '#ef4444', label: 'Expenses',      stroke: 1.6, dash: true  },
                  { color: '#10b981', label: 'Gross Profit',  stroke: 2.4, dash: false },
                  { color: '#8b5cf6', label: 'Net Profit',    stroke: 3,   dash: false },
                ].map(({ color, label, stroke, dash }) => (
                  <span key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <svg width="22" height="6" className="flex-shrink-0">
                      <line x1="0" y1="3" x2="22" y2="3" stroke={color} strokeWidth={stroke}
                        strokeDasharray={dash ? '5 3' : undefined} strokeLinecap="round" />
                    </svg>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── Quick Actions ── */}
          <motion.div custom={11} variants={fadeUp} initial="hidden" animate="visible">
            <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold">Quick Actions</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Navigate to any section instantly</p>
                </div>
                <Zap size={14} className="text-muted-foreground/50" />
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                {quickActions.map((a, i) => (
                  <Link key={i} to={a.path}>
                    <div className="group flex flex-col items-center gap-2 p-3 rounded-2xl border border-border/40 bg-background/60 hover:border-border hover:bg-card hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-200"
                        style={{ background: `linear-gradient(135deg, ${a.from}, ${a.to})` }}>
                        <a.icon size={17} className="text-white" />
                      </div>
                      <span className="text-[11px] font-semibold text-center leading-tight">{a.title}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── Low Stock Alerts (enhanced table) ── */}
          {lowStock.length > 0 && (
            <motion.div custom={12} variants={fadeUp} initial="hidden" animate="visible">
              <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-5 pb-3 border-b border-border/40">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle size={14} className="text-orange-500" />
                      Low Stock Alerts
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-semibold text-orange-500">{lowStock.length}</span> products need attention
                    </p>
                  </div>
                  <Link to="/inventory">
                    <Button variant="outline" size="sm" className="h-8 gap-1 rounded-xl text-xs border-orange-500/25 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20">
                      View All <ArrowRight size={11} />
                    </Button>
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/20 border-b border-border/30">
                        <th className="py-3 px-5 text-xs font-medium text-muted-foreground text-left">Product</th>
                        <th className="py-3 px-4 text-xs font-medium text-muted-foreground text-left">SKU</th>
                        <th className="py-3 px-4 text-xs font-medium text-muted-foreground text-right">Current Stock</th>
                        <th className="py-3 px-4 text-xs font-medium text-muted-foreground text-right">Min. Threshold</th>
                        <th className="py-3 px-4 text-xs font-medium text-muted-foreground text-left">Status</th>
                        <th className="py-3 px-4 text-xs font-medium text-muted-foreground text-left">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStock.map((p: any) => (
                        <tr key={p.id} className={cn('border-b border-border/20 hover:bg-muted/25 transition-colors', p.stock === 0 && 'bg-red-500/5')}>
                          <td className="py-3.5 px-5">
                            <p className="font-medium">{p.name}</p>
                            {p.category && <p className="text-[10px] text-muted-foreground">{p.category}</p>}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                              {p.barcode || '—'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className={cn('font-bold tabular-nums text-sm', p.stock === 0 ? 'text-red-500' : 'text-orange-500')}>
                              {p.stock}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="text-sm text-muted-foreground tabular-nums">
                              {p.min_stock ?? p.reorder_point ?? 10}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {p.stock === 0
                              ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25 text-xs font-bold">Out of Stock</span>
                              : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/25 text-xs font-semibold">Low Stock</span>
                            }
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin size={11} className="opacity-50" />
                              <span>{p.location || 'Main Warehouse'}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── AR / AP ── */}
          <motion.div custom={13} variants={fadeUp} initial="hidden" animate="visible">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* AR */}
              <div className="rounded-2xl border border-emerald-500/15 bg-card shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between p-5 pb-4 border-b border-emerald-500/10">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10">
                        <TrendingUp size={13} className="text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Receivable (AR)</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{stats?.customersInDebt || 0}</span> customers owe{' '}
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(stats?.totalOutstandingLoans || 0)}</span>
                    </p>
                  </div>
                  <Link to="/loans">
                    <Button variant="outline" size="sm" className="h-8 gap-1 rounded-xl text-xs border-emerald-500/25 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                      View All <ArrowRight size={11} />
                    </Button>
                  </Link>
                </div>
                <div className="overflow-auto max-h-[220px]">
                  {!(stats?.topDebtors?.length) ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground/50">
                      <CheckCircle2 size={26} className="text-emerald-500/40" />
                      <p className="text-xs font-medium">No outstanding receivables</p>
                      <p className="text-xs">All customer payments are clear</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border/30">
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Customer</th>
                        <th className="text-right py-2.5 px-4 text-xs font-medium text-muted-foreground">Balance</th>
                      </tr></thead>
                      <tbody>
                        {stats.topDebtors.map((d: any) => (
                          <tr key={d.id} className="border-b border-border/15 hover:bg-emerald-500/5 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-semibold text-xs">{d.name}</p>
                              <p className="text-[10px] text-muted-foreground">{d.phone || '—'}</p>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(d.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* AP */}
              <div className="rounded-2xl border border-amber-500/15 bg-card shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between p-5 pb-4 border-b border-amber-500/10">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="p-1.5 rounded-lg bg-amber-500/10">
                        <TrendingDown size={13} className="text-amber-600 dark:text-amber-400" />
                      </div>
                      <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400">Payable (AP)</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{stats?.vendorsWithDebt || 0}</span> vendors waiting{' '}
                      <span className="font-bold text-amber-600 dark:text-amber-400">{fmt(stats?.totalOutstandingPayables || 0)}</span>
                    </p>
                  </div>
                  <Link to="/loans">
                    <Button variant="outline" size="sm" className="h-8 gap-1 rounded-xl text-xs border-amber-500/25 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30">
                      View All <ArrowRight size={11} />
                    </Button>
                  </Link>
                </div>
                <div className="overflow-auto max-h-[220px]">
                  {!(stats?.topPayableVendors?.length) ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground/50">
                      <CheckCircle2 size={26} className="text-amber-500/40" />
                      <p className="text-xs font-medium">No outstanding payables</p>
                      <p className="text-xs">All vendor payments are up to date</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border/30">
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Vendor</th>
                        <th className="text-right py-2.5 px-4 text-xs font-medium text-muted-foreground">Balance</th>
                      </tr></thead>
                      <tbody>
                        {stats.topPayableVendors.map((v: any) => (
                          <tr key={v.id} className="border-b border-border/15 hover:bg-amber-500/5 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-semibold text-xs">{v.name}</p>
                              <p className="text-[10px] text-muted-foreground">{v.phone || '—'}</p>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-amber-600 dark:text-amber-400 tabular-nums">{fmt(v.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Top Selling Products ── */}
          <motion.div custom={14} variants={fadeUp} initial="hidden" animate="visible">
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <div className="p-5 pb-3 border-b border-border/40">
                <h3 className="text-sm font-semibold">Top Selling Products</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Highest quantity sold in selected period</p>
              </div>
              {stats.topProducts?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/25 border-b border-border/30">
                        <th className="py-3 px-4 text-xs font-medium text-muted-foreground text-center w-10">#</th>
                        <th className="py-3 px-4 text-xs font-medium text-muted-foreground text-left">Product</th>
                        <th className="py-3 px-4 text-xs font-medium text-muted-foreground text-left hidden sm:table-cell">Category</th>
                        <th className="py-3 px-4 text-xs font-medium text-muted-foreground text-right">Qty Sold</th>
                        <th className="py-3 px-5 text-xs font-medium text-muted-foreground text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topProducts.map((p: any, i: number) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-muted/25 transition-colors">
                          <td className="py-3.5 px-4 text-center">
                            <span className={cn('inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold',
                              i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' :
                              i === 1 ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' :
                              i === 2 ? 'bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400' : 'bg-muted text-muted-foreground'
                            )}>{i + 1}</span>
                          </td>
                          <td className="py-3.5 px-4 font-medium">{p.name}</td>
                          <td className="py-3.5 px-4 text-xs text-muted-foreground hidden sm:table-cell">{p.category || '—'}</td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary/8 border border-primary/15 text-primary text-xs font-semibold tabular-nums">{p.qty_sold}</span>
                          </td>
                          <td className="py-3.5 px-5 text-right font-bold text-primary tabular-nums">{fmt(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
                  <ShoppingBag size={36} className="opacity-15" />
                  <p className="text-sm">No sales data for selected period</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Item Sales Tracker ── */}
          <motion.div custom={15} variants={fadeUp} initial="hidden" animate="visible">
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 pb-4 border-b border-border/40 gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Item Sales Tracker</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Per-product performance, dead items, and best months</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input value={itemQuery} onChange={e => { setItemQuery(e.target.value); setItemLimit(10); }}
                      placeholder="Search items…"
                      className="h-8 w-40 rounded-xl border border-input bg-background pl-7 pr-3 text-xs" />
                  </div>
                  <div className="flex bg-muted/60 rounded-xl p-0.5 border border-border/30">
                    {(['week', 'month'] as const).map(w => (
                      <button key={w} onClick={() => setItemWindow(w)}
                        className={cn('h-7 px-3 text-xs font-medium rounded-lg transition-all capitalize',
                          itemWindow === w ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                        )}>{w}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/20 border-b border-border/30">
                      <th className="py-3 px-5 text-xs font-medium text-muted-foreground text-left">Item</th>
                      <th className="py-3 px-4 text-xs font-medium text-muted-foreground text-right">Sold Qty</th>
                      <th className="py-3 px-4 text-xs font-medium text-muted-foreground text-right">Amount</th>
                      <th className="py-3 px-5 text-xs font-medium text-muted-foreground text-left">Best Month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allItemRows.slice(0, itemLimit).length === 0 ? (
                      <tr><td colSpan={4} className="py-12 text-center text-xs text-muted-foreground">No items found</td></tr>
                    ) : allItemRows.slice(0, itemLimit).map((r: any) => {
                      const best = bestMonthMap.get(String(r.name || ''));
                      const qty = itemWindow === 'week' ? Number(r.qty_week || 0) : Number(r.qty_month || 0);
                      const amount = itemWindow === 'week' ? Number(r.amount_week || 0) : Number(r.amount_month || 0);
                      return (
                        <tr key={r.id} className="border-b border-border/20 hover:bg-muted/25 transition-colors">
                          <td className="py-3.5 px-5 font-medium">{r.name}</td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="inline-flex px-2 py-0.5 rounded-full bg-muted border border-border/40 text-xs font-semibold text-muted-foreground tabular-nums">{qty}</span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold tabular-nums">{fmt(amount)}</td>
                          <td className="py-3.5 px-5 text-xs text-muted-foreground">{best ? `${best.ym} (${fmt(Number(best.amount || 0))})` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {itemLimit < allItemRows.length && (
                <div className="flex justify-center p-4 border-t border-border/30">
                  <Button size="sm" variant="outline" onClick={() => setItemLimit(l => l + 10)} className="h-8 text-xs rounded-xl gap-1">
                    Load More <span className="text-muted-foreground">({allItemRows.length - itemLimit} left)</span>
                  </Button>
                </div>
              )}
              {deadRows.length > 0 && (
                <div className="p-5 pt-4 border-t border-border/30 bg-muted/10">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Dead Items — No Sales This Month</p>
                  <div className="flex flex-wrap gap-2">
                    {deadRows.map((d: any) => (
                      <span key={d.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-border/40 text-xs font-medium text-muted-foreground">
                        {d.name}
                        <span className="px-1.5 py-0.5 rounded-full bg-background border border-border/30 text-xs font-bold">{d.stock}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Outstanding Receivables (AR) — premium redesign ── */}
          {totalLoans > 0 && (
            <motion.div custom={16} variants={fadeUp} initial="hidden" animate="visible">
              <div
                className="rounded-2xl bg-card overflow-hidden shadow-sm"
                style={{ border: '1px solid rgba(239,68,68,0.16)' }}
              >
                {/* Gradient top accent */}
                <div className="h-[3px] bg-gradient-to-r from-red-600 via-rose-500 to-orange-400" />

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-red-500/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/15 shrink-0">
                      <Wallet size={15} className="text-red-500 dark:text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">Outstanding Receivables</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Customer AR ledger · Money owed to you
                      </p>
                    </div>
                  </div>
                  <Link to="/loans">
                    <Button
                      variant="outline" size="sm"
                      className="h-8 gap-1.5 rounded-xl text-xs border-red-400/25 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      Manage <ArrowRight size={11} />
                    </Button>
                  </Link>
                </div>

                {/* ── KPI metric strip ── */}
                <div className="grid grid-cols-3 divide-x divide-border/30 border-b border-border/20">
                  {[
                    {
                      label: 'Total Outstanding',
                      value: fmt(totalLoans),
                      val2: null,
                      color: 'text-red-500 dark:text-red-400',
                      bg: 'bg-red-500/5',
                      icon: BadgeAlert,
                      iconColor: 'text-red-500/60',
                    },
                    {
                      label: 'Active Debtors',
                      value: String(debtorCount),
                      val2: 'customers',
                      color: 'text-foreground',
                      bg: '',
                      icon: Users,
                      iconColor: 'text-muted-foreground/40',
                    },
                    {
                      label: 'Avg per Customer',
                      value: debtorCount > 0 ? fmt(Math.round(totalLoans / debtorCount)) : 'PKR 0',
                      val2: null,
                      color: 'text-foreground',
                      bg: '',
                      icon: HandCoins,
                      iconColor: 'text-muted-foreground/40',
                    },
                  ].map((m, i) => (
                    <div key={i} className={cn('relative px-5 py-4 overflow-hidden', m.bg)}>
                      <m.icon size={36} className={cn('absolute -right-2 -bottom-2 pointer-events-none', m.iconColor)} />
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 relative z-10">
                        {m.label}
                      </p>
                      <p className={cn('text-xl font-bold tabular-nums tracking-tight relative z-10', m.color)}>
                        {m.value}
                        {m.val2 && <span className="text-xs text-muted-foreground font-normal ml-1">{m.val2}</span>}
                      </p>
                    </div>
                  ))}
                </div>

                {/* ── Debtor progress bars ── */}
                {stats?.topDebtors?.length > 0 ? (
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Top Debtors · Collection Priority
                      </p>
                      <span className="text-[10px] text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full border border-border/40">
                        % of total balance
                      </span>
                    </div>

                    <div className="space-y-5">
                      {stats.topDebtors.slice(0, 5).map((d: any, i: number) => {
                        const pct = totalLoans > 0 ? (d.balance / totalLoans) * 100 : 0;

                        const PALETTE = [
                          { bar: 'from-red-600 to-rose-500',       ring: '#ef4444', label: 'Critical', badge: 'bg-red-500/12 text-red-600 dark:text-red-400 border-red-500/20' },
                          { bar: 'from-orange-500 to-amber-500',   ring: '#f97316', label: 'High',     badge: 'bg-orange-500/12 text-orange-600 dark:text-orange-400 border-orange-500/20' },
                          { bar: 'from-amber-500 to-yellow-400',   ring: '#f59e0b', label: 'Medium',   badge: 'bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/20' },
                          { bar: 'from-yellow-400 to-lime-400',    ring: '#eab308', label: 'Low',      badge: 'bg-yellow-500/12 text-yellow-700 dark:text-yellow-400 border-yellow-500/20' },
                          { bar: 'from-lime-500 to-emerald-400',   ring: '#84cc16', label: 'Minimal',  badge: 'bg-lime-500/12 text-lime-700 dark:text-lime-400 border-lime-500/20' },
                        ];
                        const p = PALETTE[i] ?? PALETTE[PALETTE.length - 1];

                        return (
                          <div key={d.id}>
                            {/* Row header */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {/* Rank badge */}
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                                  style={{ background: p.ring, boxShadow: `0 2px 8px ${p.ring}55` }}
                                >
                                  {i + 1}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-sm font-semibold truncate block">{d.name}</span>
                                  {d.phone && (
                                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                                      <PhoneCall size={9} />
                                      {d.phone}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 ml-3">
                                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', p.badge)}>
                                  {p.label}
                                </span>
                                <div className="text-right">
                                  <span className="text-sm font-bold tabular-nums">{fmt(d.balance)}</span>
                                  <span className="block text-[10px] text-muted-foreground tabular-nums">{pct.toFixed(1)}%</span>
                                </div>
                              </div>
                            </div>

                            {/* Animated progress bar */}
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ delay: 0.22 + i * 0.09, duration: 0.95, ease: [0.23, 1, 0.32, 1] }}
                                className={cn('h-full rounded-full bg-gradient-to-r', p.bar)}
                                style={{ boxShadow: `2px 0 8px ${p.ring}55` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* View all link */}
                    {debtorCount > 5 && (
                      <Link to="/loans" className="inline-flex items-center gap-1.5 mt-5 text-[11px] text-primary font-semibold hover:underline underline-offset-2">
                        <Users size={11} />
                        View all {debtorCount} debtors →
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground/50">
                    <CheckCircle2 size={28} className="text-emerald-400/50" />
                    <p className="text-xs font-medium">No debtor records found</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Recent Transactions ── */}
          <motion.div custom={17} variants={fadeUp} initial="hidden" animate="visible">
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-5 pb-3 border-b border-border/40">
                <div>
                  <h3 className="text-sm font-semibold">Recent Transactions</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Latest 10 sales activity</p>
                </div>
                <Link to="/transactions">
                  <Button variant="outline" size="sm" className="h-8 gap-1 rounded-xl text-xs">
                    View All <ArrowRight size={11} />
                  </Button>
                </Link>
              </div>
              {stats.recentSales?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/20 border-b border-border/30">
                        <th className="py-3 px-5 text-xs font-medium text-muted-foreground text-left">Invoice #</th>
                        <th className="py-3 px-4 text-xs font-medium text-muted-foreground text-left">Time</th>
                        <th className="py-3 px-4 text-xs font-medium text-muted-foreground text-left">Method</th>
                        <th className="py-3 px-5 text-xs font-medium text-muted-foreground text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentSales.map((s: any) => (
                        <tr key={s.id} className="border-b border-border/20 hover:bg-muted/25 transition-colors">
                          <td className="py-3.5 px-5 font-mono text-xs text-muted-foreground">{formatInvoiceId(s.id, s.date_created)}</td>
                          <td className="py-3.5 px-4 text-xs text-muted-foreground tabular-nums">
                            {new Date(s.date_created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3.5 px-4">
                            {/* ── Payment method badge – clear in both light and dark ── */}
                            {s.payment_method === 'cash' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-white capitalize">
                                {s.payment_method}
                              </span>
                            )}
                            {s.payment_method === 'card' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500 text-white capitalize">
                                {s.payment_method}
                              </span>
                            )}
                            {s.payment_method === 'online' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-500 text-white capitalize">
                                {s.payment_method}
                              </span>
                            )}
                            {s.payment_method === 'bank_transfer' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500 text-white capitalize">
                                Bank Transfer
                              </span>
                            )}
                            {!['cash', 'card', 'online', 'bank_transfer'].includes(s.payment_method) && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-500 text-white capitalize">
                                {s.payment_method}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-right font-bold text-primary tabular-nums">{fmt(s.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
                  <Activity size={36} className="opacity-15" />
                  <p className="text-sm">No recent transactions found</p>
                </div>
              )}
            </div>
          </motion.div>

        </div>
      )}
    </div>
  );
}
