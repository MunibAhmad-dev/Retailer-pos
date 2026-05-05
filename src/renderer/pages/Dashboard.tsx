import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign, ShoppingBag, TrendingUp, Package, Activity, RefreshCw,
  ShieldCheck, CreditCard, Boxes, AlertTriangle, Wallet, Users, ArrowRight,
  Info, Filter, Truck, Store, BarChart3, FileText, Receipt, HandCoins, CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import { useNotifications } from '../components/NotificationProvider';
import { subService } from '../services/subscription';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

interface DashboardProps { onLock: () => void; }

const fmt = (n: number) => 'PKR ' + Math.round(n ?? 0).toLocaleString('en-PK');

export default function Dashboard({ onLock }: DashboardProps) {
  // Date Filtering State
  const [period, setPeriod] = useState<string>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const loadStats = async (isManualRefresh = false, overrides?: { s?: string; e?: string; p?: string }) => {
    setLoading(true);
    try {
      const activePeriod = overrides?.p ?? period;
      let sDate = overrides?.s ?? customStart;
      let eDate = overrides?.e ?? customEnd;

      if (activePeriod !== 'custom' && activePeriod !== 'all') {
        const now = new Date();
        eDate = new Date().toISOString();
        if (activePeriod === 'today') sDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        else if (activePeriod === 'week') sDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString();
        else if (activePeriod === 'month') sDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      } else if (activePeriod === 'all') {
        sDate = ''; eDate = '';
      }

      const payload = sDate ? { startDate: sDate, endDate: eDate || new Date().toISOString() } : undefined;
      const res = await window.api.getDashboardStats(payload);
      setStats(res?.success && res.data ? res.data : null);
      if (isManualRefresh) addNotification('Dashboard refreshed', 'Latest metrics loaded.', 'success');
    } catch (err) {
      console.error(err);
      addNotification('Refresh Failed', 'Could not fetch dashboard analytics.', 'error');
    } finally {
      setLoading(false);
    }
  };
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const { addNotification } = useNotifications();

  useEffect(() => {
    loadStats();
    const interval = setInterval(() => loadStats(false), 30000);
    
    const timer = setInterval(() => {
      const sub = subService.getState();
      if (sub.expiryDate) {
        const diff = new Date(sub.expiryDate).getTime() - Date.now();
        if (diff > 0) {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeLeft(`${days}d ${hours}h ${mins}m ${secs}s`);
        } else {
          setTimeLeft('Expired');
        }
      }
    }, 1000);
    
    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, []);

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setPeriod(val);
    if (val !== 'custom') loadStats(true, { p: val });
  };

  const handleCustomFilter = () => {
    if (!customStart) { addNotification('Missing Date', 'Select a start date.', 'warning'); return; }
    loadStats(true, { p: 'custom', s: new Date(customStart).toISOString(), e: customEnd ? new Date(customEnd).toISOString() : '' });
  };

  // --- Build stat cards based on period ---
  let statCards: any[] = [];
  if (stats) {
    if (period === 'all') {
      statCards = [
        { title: "Today's Revenue", value: fmt(stats.totalSalesToday), sub: `${stats.totalTransactionsToday} sales today`, icon: DollarSign, color: 'text-green-500', bg: 'bg-green-500/10' },
        { title: 'This Week', value: fmt(stats.totalSalesWeek), sub: 'Last 7 days', icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { title: 'This Month', value: fmt(stats.totalSalesMonth), sub: 'Current month', icon: ShoppingBag, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        { title: 'Total Trx', value: stats.totalTransactions?.toLocaleString(), sub: 'Lifetime sales', icon: Activity, color: 'text-orange-500', bg: 'bg-orange-500/10' },
        { title: 'Products', value: stats.totalProducts?.toLocaleString(), sub: 'In catalogue', icon: Package, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
      ];
    } else {
      statCards = [
        { title: 'Period Revenue', value: fmt(stats.filteredRevenue || 0), sub: 'For selected range', icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10' },
        { title: 'Period Transactions', value: (stats.filteredCount || 0).toLocaleString(), sub: 'For selected range', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { title: "Today's Revenue", value: fmt(stats.totalSalesToday), sub: 'Today only', icon: DollarSign, color: 'text-green-500', bg: 'bg-green-500/10' },
        { title: 'Products', value: stats.totalProducts?.toLocaleString(), sub: 'In catalogue', icon: Package, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
      ];
    }
  }

  const quickActions = [
    { title: 'New Sale',    emoji: '🛒', desc: 'Sell to customers',   path: '/sales',       icon: ShoppingBag, accent: '#3b82f6', bg: 'hover:bg-blue-500/8 border-blue-500/20 hover:border-blue-500/40' },
    { title: 'Products',   emoji: '📦', desc: 'Manage your items',   path: '/products',    icon: Package,     accent: '#8b5cf6', bg: 'hover:bg-violet-500/8 border-violet-500/20 hover:border-violet-500/40' },
    { title: 'Purchase',   emoji: '🚚', desc: 'Restock from vendors', path: '/purchases',   icon: Truck,       accent: '#f97316', bg: 'hover:bg-orange-500/8 border-orange-500/20 hover:border-orange-500/40' },
    { title: 'Inventory',  emoji: '🗄️', desc: 'Track stock levels',  path: '/inventory',   icon: Boxes,       accent: '#06b6d4', bg: 'hover:bg-cyan-500/8 border-cyan-500/20 hover:border-cyan-500/40' },
    { title: 'Customers',  emoji: '👥', desc: 'Qaraz / credit list',  path: '/customers',   icon: Users,       accent: '#10b981', bg: 'hover:bg-emerald-500/8 border-emerald-500/20 hover:border-emerald-500/40' },
    { title: 'Vendors',    emoji: '🏪', desc: 'Suppliers & payments', path: '/vendors',     icon: Store,       accent: '#f59e0b', bg: 'hover:bg-amber-500/8 border-amber-500/20 hover:border-amber-500/40' },
    { title: 'Accounts',   emoji: '💰', desc: 'AP / AR ledgers',      path: '/loans',       icon: HandCoins,   accent: '#ef4444', bg: 'hover:bg-red-500/8 border-red-500/20 hover:border-red-500/40' },
    { title: 'Reports',    emoji: '📊', desc: 'Sales analytics',      path: '/reports',     icon: BarChart3,   accent: '#6366f1', bg: 'hover:bg-indigo-500/8 border-indigo-500/20 hover:border-indigo-500/40' },
  ];

  if (loading && !stats) {
    return (
      <div className="flex h-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <RefreshCw size={40} className="animate-spin text-primary" />
          <p className="text-sm font-medium animate-pulse">Loading Analytics...</p>
        </div>
      </div>
    );
  }

  const lowStockList: any[] = stats?.lowStockProducts || [];
  const totalStockValue: number = stats?.totalStockValue || 0;
  const totalRetailValue: number = stats?.totalRetailValue || 0;
  const totalLoans: number = stats?.totalOutstandingLoans || 0;
  const debtorCount: number = stats?.customersInDebt || 0;

  return (
    <div className="flex flex-col gap-6 pb-10">
      {(() => {
        const sub = subService.getState();
        if (sub.plan !== 'lifetime' && sub.daysRemaining <= 5) {
          return (
            <div className="bg-destructive border border-destructive rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top duration-500 shadow-xl shadow-destructive/20 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2.5 rounded-lg text-white shadow-md backdrop-blur-md animate-pulse">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h4 className="font-black text-white leading-none uppercase tracking-tight">License Expiring Soon</h4>
                  <p className="text-white/90 text-sm mt-1.5 flex flex-wrap items-center gap-x-2 font-medium">
                    Ends in: <span className="font-black underline underline-offset-4 decoration-2">{timeLeft || `${sub.daysRemaining} days`}</span>. Renew now to avoid lock-out!
                  </p>
                </div>
              </div>
              <Link to="/subscription" className="w-full md:w-auto">
                <Button size="sm" className="w-full bg-white text-destructive hover:bg-white/90 shadow-lg font-black px-6 border-none h-10">
                  RENEW NOW
                </Button>
              </Link>
            </div>
          );
        }
        return null;
      })()}

      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/40">
          {[
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'Weekly' },
            { id: 'month', label: 'Monthly' },
            { id: 'all', label: 'Lifetime' },
            { id: 'custom', label: 'Custom' }
          ].map((p) => (
            <Button
              key={p.id}
              variant={period === p.id ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-8 px-3 text-xs font-bold transition-all duration-200 rounded-lg",
                period === p.id ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => {
                setPeriod(p.id);
                if (p.id !== 'custom') loadStats(true, { p: p.id });
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
          {period === 'custom' && (
            <div className="flex items-center gap-2 animate-in fade-in">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" />
              <span className="text-muted-foreground text-xs">to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" />
              <Button size="sm" onClick={handleCustomFilter} className="h-9">Filter</Button>
            </div>
          )}
          <div className="h-6 w-px bg-border hidden sm:block mx-1" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onLock} className="h-9 gap-2">
              <ShieldCheck size={16} /><span className="hidden sm:inline">Lock</span>
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => loadStats(true)} 
              className="h-9 w-9 p-0 shadow-md transition-transform active:scale-95"
              title="Refresh Stats"
            >
              <RefreshCw className={cn("h-4 w-4 text-white", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

      {stats && (
        <>
          {/* Primary Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {statCards.map((card, i) => (
              <Card key={i} className="hover:-translate-y-1 hover:shadow-lg transition-all duration-300 border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{card.title}</CardTitle>
                  <div className={cn('p-2 rounded-lg', card.bg)}>
                    <card.icon className={cn('h-4 w-4', card.color)} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black tracking-tight">{card.value}</div>
                  <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase opacity-70">{card.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border/50 shadow-sm hover:-translate-y-1 transition-transform">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Stock Cost Value</CardTitle>
                <div className="p-2 rounded-lg bg-cyan-500/10"><Boxes className="h-4 w-4 text-cyan-500" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-cyan-600">{fmt(totalStockValue)}</div>
                <p className="text-xs text-muted-foreground mt-1">Total inventory at cost</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm hover:-translate-y-1 transition-transform">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Retail Stock Value</CardTitle>
                <div className="p-2 rounded-lg bg-emerald-500/10"><TrendingUp className="h-4 w-4 text-emerald-500" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-emerald-600">{fmt(totalRetailValue)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Potential profit: <span className="font-semibold text-emerald-500">{fmt(totalRetailValue - totalStockValue)}</span>
                </p>
              </CardContent>
            </Card>

            <Card className={cn("shadow-sm hover:-translate-y-1 transition-transform", totalLoans > 0 ? "border-red-400/30 bg-red-500/5" : "border-border/50")}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Outstanding Loans</CardTitle>
                <div className="p-2 rounded-lg bg-red-500/10"><Wallet className="h-4 w-4 text-red-500" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-red-500">{fmt(totalLoans)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="font-semibold text-red-400">{debtorCount}</span> customers in debt
                </p>
              </CardContent>
            </Card>

            <Card className={cn("shadow-sm hover:-translate-y-1 transition-transform", lowStockList.length > 0 ? "border-orange-400/30 bg-orange-500/5" : "border-border/50")}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Low Stock Alert</CardTitle>
                <div className="p-2 rounded-lg bg-orange-500/10"><AlertTriangle className="h-4 w-4 text-orange-500" /></div>
              </CardHeader>
              <CardContent>
                <div className={cn("text-xl font-bold", lowStockList.length > 0 ? "text-orange-500" : "text-muted-foreground")}>{lowStockList.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Products below threshold</p>
              </CardContent>
            </Card>
          </div>

          {/* ===== Quick Actions Full Width ===== */}
          <Card className="shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Quick Actions</CardTitle>
                <CardDescription>Tap a button to go to any section — icons show what each area does</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  {quickActions.map((action, i) => (
                    <Link key={i} to={action.path}>
                      <div className={cn(
                        'flex flex-col items-center justify-center gap-2 p-4 h-28 rounded-2xl border-2 bg-card transition-all duration-200 cursor-pointer group shadow-sm hover:shadow-md hover:-translate-y-0.5',
                        action.bg
                      )}>
                        <span className="text-3xl leading-none">{action.emoji}</span>
                        <span className="text-sm font-bold text-foreground leading-tight text-center">{action.title}</span>
                        <span className="text-[10px] text-muted-foreground text-center leading-tight">{action.desc}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

          {/* ===== Top Products ===== */}
          <Card className="shadow-md">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle>Top Selling Products</CardTitle>
                <CardDescription>Highest quantity sold{period !== 'all' ? ' in selected period' : ' overall'}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {stats.topProducts?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty Sold</TableHead>
                        <TableHead className="text-right pr-6">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.topProducts.map((p: any, i: number) => (
                        <TableRow key={i} className="hover:bg-muted/50">
                          <TableCell className="text-center font-medium text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-semibold">{p.name}</TableCell>
                          <TableCell className="text-right"><Badge variant="outline" className="font-mono">{p.qty_sold}</Badge></TableCell>
                          <TableCell className="text-right pr-6 font-semibold text-primary">{fmt(p.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <ShoppingBag size={48} className="opacity-10 mb-4" />
                    <p>No sales data yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>

          {/* ===== AP / AR Invoice Tables ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Receivables (AR) */}
            <Card className={cn("shadow-md border-2", (stats?.totalOutstandingLoans || 0) > 0 ? "border-red-400/30 bg-red-50 dark:bg-red-950/20" : "border-border/50")}>
              <CardHeader className="pb-3 border-b border-red-400/20 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-red-600 flex items-center gap-2">
                    <Receipt size={16}/> Receivable (AR) — قرض واپس ملنی
                  </CardTitle>
                  <CardDescription className="dark:text-red-200/60">{stats?.customersInDebt || 0} customers owe &nbsp;
                    <span className="font-bold text-red-500">{fmt(stats?.totalOutstandingLoans || 0)}</span>
                  </CardDescription>
                </div>
                <Link to="/loans">
                  <Button variant="outline" size="sm" className="gap-1 border-red-400/30 text-red-600 hover:bg-red-50 text-xs shrink-0">
                    View All <ArrowRight size={12}/>
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {(stats?.topDebtors || []).length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead>Customer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="text-right pr-4">Balance Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(stats?.topDebtors || []).map((d: any) => (
                        <TableRow key={d.id} className="hover:bg-red-50/50">
                          <TableCell className="font-semibold">{d.name}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{d.phone || '—'}</TableCell>
                          <TableCell className="text-right pr-4 font-bold text-red-600">{fmt(d.balance)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                    <CheckCircle2 size={32} className="text-green-500 opacity-60" />
                    <p className="text-sm">No outstanding receivables 🎉</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payables (AP) */}
            <Card className={cn("shadow-md border-2", (stats?.totalOutstandingPayables || 0) > 0 ? "border-amber-400/30 bg-amber-50 dark:bg-amber-950/20" : "border-border/50")}>
              <CardHeader className="pb-3 border-b border-amber-400/20 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-amber-700 dark:text-amber-500 flex items-center gap-2">
                    <HandCoins size={16}/> Payable (AP) — ادائیگی باقی
                  </CardTitle>
                  <CardDescription className="dark:text-amber-200/60">{stats?.vendorsWithDebt || 0} vendors waiting &nbsp;
                    <span className="font-bold text-amber-600 dark:text-amber-500">{fmt(stats?.totalOutstandingPayables || 0)}</span>
                  </CardDescription>
                </div>
                <Link to="/loans">
                  <Button variant="outline" size="sm" className="gap-1 border-amber-400/30 text-amber-700 hover:bg-amber-50 text-xs shrink-0">
                    View All <ArrowRight size={12}/>
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {(stats?.topPayableVendors || []).length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead>Vendor</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="text-right pr-4">Amount Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(stats?.topPayableVendors || []).map((v: any) => (
                        <TableRow key={v.id} className="hover:bg-amber-50/50">
                          <TableCell className="font-semibold">{v.name}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{v.phone || '—'}</TableCell>
                          <TableCell className="text-right pr-4 font-bold text-amber-700">{fmt(v.balance)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                    <CheckCircle2 size={32} className="text-green-500 opacity-60" />
                    <p className="text-sm">No outstanding payables 🎉</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ===== Charts Section (Moved to bottom) ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Revenue Trend Chart */}
            <Card className="shadow-md overflow-hidden border-none bg-slate-900 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="text-emerald-400" size={18} /> Revenue Trend
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">Daily performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.salesTrend}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="date" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      stroke="#94a3b8"
                      tickFormatter={(str) => {
                        const date = new Date(str);
                        return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                      }}
                    />
                    <YAxis 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      stroke="#94a3b8"
                      tickFormatter={(value) => `Rs.${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#f8fafc' }}
                      itemStyle={{ color: '#10b981' }}
                      formatter={(value: any) => [fmt(value), 'Revenue']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#10b981" 
                      fillOpacity={1} 
                      fill="url(#colorRev)" 
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Payment Distribution Chart */}
            <Card className="shadow-md border-none bg-slate-900 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="text-blue-400" size={18} /> Payment Methods
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">Revenue share by type</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.paymentStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="revenue"
                      nameKey="payment_method"
                      stroke="none"
                    >
                      {stats.paymentStats?.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#f8fafc' }}
                      formatter={(value: any) => fmt(value)}
                    />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* ===== Low Stock Table ===== */}
          {lowStockList.length > 0 && (
            <Card className="shadow-md border-orange-400/20">
              <CardHeader className="border-b border-orange-400/20 bg-orange-500/5 flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-orange-600">
                    <AlertTriangle size={18} /> Low Stock Warning
                  </CardTitle>
                  <CardDescription>Products below 10 units — restock immediately</CardDescription>
                </div>
                <Link to="/inventory">
                  <Button variant="outline" size="sm" className="gap-2 border-orange-500/30 text-orange-600 hover:bg-orange-50">
                    View Inventory <ArrowRight size={14} />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Stock Remaining</TableHead>
                      <TableHead className="text-right pr-6">Selling Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockList.map((p: any) => (
                      <TableRow key={p.id} className={cn('hover:bg-muted/40', p.stock === 0 && 'bg-destructive/5')}>
                        <TableCell className="font-semibold">{p.name}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={p.stock === 0 ? 'destructive' : 'outline'}
                            className={cn('font-mono', p.stock > 0 && 'text-orange-600 border-orange-400/40 bg-orange-500/10')}>
                            {p.stock === 0 ? 'OUT OF STOCK' : `${p.stock} left`}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6 text-primary font-semibold">{fmt(p.price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ===== Loans Summary ===== */}
          {totalLoans > 0 && (
            <Card className="shadow-md border-red-400/20">
              <CardHeader className="border-b border-red-400/20 bg-red-500/5 flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <Wallet size={18} /> Outstanding Customer Loans
                  </CardTitle>
                  <CardDescription>{debtorCount} customers have pending balances</CardDescription>
                </div>
                <Link to="/loans">
                  <Button variant="outline" size="sm" className="gap-2 border-red-400/30 text-red-600 hover:bg-red-50">
                    Manage Loans <ArrowRight size={14} />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="flex flex-col lg:flex-row items-center justify-between p-6 gap-6">
                 <div className="flex items-center gap-4 w-full">
                   <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-inner">
                     <Wallet size={32} className="text-red-600" />
                   </div>
                   <div>
                     <p className="text-xs font-bold uppercase tracking-wider text-red-600/70 mb-1">Total Outstanding Debt</p>
                     <p className="text-4xl font-black text-red-600 tracking-tight">{fmt(totalLoans)}</p>
                   </div>
                 </div>
                 <Card className="w-full lg:max-w-md shadow-xl border-amber-500/30 dark:border-amber-500/20 bg-amber-50/80 dark:bg-amber-950/40 backdrop-blur-md">
                    <CardHeader className="pb-3 border-b border-amber-500/20 bg-amber-500/10">
                       <CardTitle className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-2 uppercase tracking-widest">
                         <Info size={14} className="text-amber-600" /> Financial Insights
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-5">
                       <div className="flex gap-4 items-start">
                          <div className="w-9 h-9 rounded-2xl bg-amber-500/20 dark:bg-amber-500/30 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-sm">
                             <HandCoins size={18} className="text-amber-800 dark:text-amber-300"/>
                          </div>
                          <p className="text-[12px] leading-snug text-amber-950 dark:text-amber-50 font-bold">
                            Your <strong className="text-amber-600 dark:text-amber-400 uppercase tracking-tighter">receivables</strong> are payments owed to you. Monitor these closely to maintain healthy cash flow.
                          </p>
                       </div>
                       <div className="flex gap-4 items-start">
                          <div className="w-9 h-9 rounded-2xl bg-blue-500/20 dark:bg-blue-500/30 flex items-center justify-center shrink-0 border border-blue-500/30 shadow-sm">
                             <TrendingUp size={18} className="text-blue-800 dark:text-blue-300"/>
                          </div>
                          <p className="text-[12px] leading-snug text-blue-950 dark:text-blue-50 font-bold">
                            <strong className="text-blue-600 dark:text-blue-400 uppercase tracking-tighter">Net Profit</strong> represents your earnings after all costs. A margin of 15-20% is considered healthy.
                          </p>
                       </div>
                    </CardContent>
                  </Card>
              </CardContent>
            </Card>
          )}

          {/* ===== Recent Transactions Table ===== */}
          <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Latest 10 sales activity</CardDescription>
              </div>
              <Link to="/transactions">
                <Button variant="outline" size="sm" className="gap-2">
                  View All <ArrowRight size={14} />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {stats.recentSales?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-24">Inv #</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right pr-6">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentSales.map((s: any) => (
                      <TableRow key={s.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-xs text-muted-foreground">#{String(s.id).padStart(5, '0')}</TableCell>
                        <TableCell className="text-sm">{new Date(s.date_created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "capitalize font-bold text-[10px]",
                            s.payment_method === 'cash' ? "text-green-600 border-green-200 bg-green-50/50" : "text-blue-600 border-blue-200 bg-blue-50/50"
                          )}>
                            {s.payment_method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6 font-bold text-primary">{fmt(s.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-3">
                  <Activity size={48} className="opacity-10" />
                  <p>No recent transactions found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
