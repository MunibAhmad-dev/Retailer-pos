import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign, ShoppingBag, TrendingUp, Package, Activity, RefreshCw,
  ShieldCheck, CreditCard, Boxes, AlertTriangle, Wallet, Users, ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import { useNotifications } from '../components/NotificationProvider';
import { subService } from '../services/subscription';
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
    { title: 'New Sale', path: '/sales', icon: ShoppingBag, color: 'border-blue-500/20 hover:border-blue-500/50 hover:bg-blue-500/5' },
    { title: 'Products', path: '/products', icon: Package, color: 'border-indigo-500/20 hover:border-indigo-500/50 hover:bg-indigo-500/5' },
    { title: 'Reports', path: '/reports', icon: TrendingUp, color: 'border-green-500/20 hover:border-green-500/50 hover:bg-green-500/5' },
    { title: 'Inventory', path: '/inventory', icon: Boxes, color: 'border-orange-500/20 hover:border-orange-500/50 hover:bg-orange-500/5' },
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
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/30 p-2 rounded-lg border border-border/50">
          <Select value={period} onValueChange={(val) => {
            setPeriod(val);
            if (val !== 'custom') loadStats(true, { p: val });
          }}>
            <SelectTrigger className="w-[160px] h-9 bg-background">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Lifetime (All)</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
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
            <Button variant="default" size="sm" onClick={() => loadStats(true)} className="h-9 gap-2 shadow-sm">
              <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </div>

      {stats && (
        <>
          {/* Primary Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {statCards.map((card, i) => (
              <Card key={i} className="hover:-translate-y-1 hover:shadow-lg transition-all duration-300 border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase">{card.title}</CardTitle>
                  <div className={cn('p-2 rounded-lg', card.bg)}>
                    <card.icon className={cn('h-4 w-4', card.color)} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ===== Inventory + Loan Health Row ===== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stock Cost Value */}
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

            {/* Retail Value */}
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

            {/* Outstanding Loans */}
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

            {/* Low Stock Alert */}
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

          {/* ===== Main Grid: Quick Actions + Top Products ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
            <Card className="col-span-1 lg:col-span-2 shadow-md">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Shortcut to main modules</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {quickActions.map((action, i) => (
                  <Link key={i} to={action.path} className="h-full">
                    <div className={cn(
                      'flex flex-col items-center justify-center p-4 h-24 rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-200 cursor-pointer',
                      action.color
                    )}>
                      <action.icon size={28} className="mb-3 text-foreground/70" />
                      <span className="text-sm font-semibold text-foreground/80">{action.title}</span>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card className="col-span-1 lg:col-span-5 shadow-md">
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
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center">
                    <Users size={28} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total amount owed to your shop</p>
                    <p className="text-3xl font-bold text-red-500">{fmt(totalLoans)}</p>
                  </div>
                </div>
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
