import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, Zap, ArrowRight, Boxes, Users, Wallet, AlertTriangle,
  RefreshCw, Database, ShieldCheck, Cloud, CloudOff, TrendingUp, Clock3
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useNotifications } from '../components/NotificationProvider';
import { cn } from '../lib/utils';

const fmtPKR = (n: number) => `PKR ${Math.round(n || 0).toLocaleString('en-PK')}`;

export default function MoreFeatures() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [productsAnalytics, setProductsAnalytics] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [registerState, setRegisterState] = useState<any>(null);
  const [driveStatus, setDriveStatus] = useState<any>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [
        sRes,
        aRes,
        pRes,
        cRes,
        vRes,
        rRes,
        dRes
      ] = await Promise.all([
        window.api.getDashboardStats(),
        window.api.getProductAnalytics(),
        window.api.getAllPayments({ limit: 10, offset: 0 }),
        window.api.getCustomers(),
        window.api.getVendors(),
        window.api.getCurrentRegister(),
        window.api.getGoogleDriveStatus()
      ]);

      if (sRes?.success) setStats(sRes.data || null);
      if (aRes?.success) setProductsAnalytics(aRes.data || []);
      if (pRes?.success) setPayments(pRes.data || []);
      if (cRes?.success) setCustomers(cRes.data || []);
      if (vRes?.success) setVendors(vRes.data || []);
      if (rRes?.success) setRegisterState(rRes.data || null);
      if (dRes?.success) setDriveStatus(dRes);
    } catch (e: any) {
      addNotification('Load Error', e.message || 'Could not load advanced toolkit.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const featureCards = useMemo(() => ([
    { title: 'Business Health', desc: 'Live KPIs & quick signals', path: '/', tab: 'business' },
    { title: 'Payment Ledger', desc: 'Advanced payment history', path: '/payments', tab: 'business' },
    { title: 'Returns Control', desc: 'Sale/Purchase returns center', path: '/returns', tab: 'business' },
    { title: 'Register Summary', desc: 'Shift/session cash visibility', path: '/register', tab: 'business' },
    { title: 'Sales Intelligence', desc: 'Revenue and trend reports', path: '/reports', tab: 'analytics' },
    { title: 'Balance Insights', desc: 'Business financial snapshot', path: '/balance-sheet', tab: 'analytics' },
    { title: 'Inventory Intelligence', desc: 'Fast/slow stock insights', path: '/inventory', tab: 'inventory' },
    { title: 'Product Analytics', desc: 'Profitability and stock value', path: '/products', tab: 'inventory' },
    { title: 'Customer Insights', desc: 'Receivables and behavior', path: '/customers', tab: 'customers' },
    { title: 'Vendor Insights', desc: 'Payables and purchases', path: '/vendors', tab: 'customers' },
    { title: 'Data Export/Import', desc: 'Operational backup utilities', path: '/settings', tab: 'utilities' },
    { title: 'Subscription & Access', desc: 'License and protection tools', path: '/subscription', tab: 'utilities' },
  ]), []);

  const q = search.trim().toLowerCase();
  const filteredFeatureCards = useMemo(() => {
    if (!q) return featureCards;
    return featureCards.filter((f) =>
      f.title.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q)
    );
  }, [featureCards, q]);

  const inventorySignals = useMemo(() => {
    const all = productsAnalytics || [];
    const deadStock = all.filter((p) => (Number(p.total_sold) || 0) === 0);
    const fastMoving = [...all].sort((a, b) => (Number(b.total_sold) || 0) - (Number(a.total_sold) || 0)).slice(0, 5);
    const lowStock = all.filter((p) => (Number(p.stock) || 0) <= 10);
    return { deadStock, fastMoving, lowStock };
  }, [productsAnalytics]);

  const businessSignals = useMemo(() => {
    const totalReceivable = customers.reduce((acc, c) => acc + Math.max(0, Number(c.balance) || 0), 0);
    const totalPayable = vendors.reduce((acc, v) => acc + Math.max(0, Number(v.balance) || 0), 0);
    return { totalReceivable, totalPayable };
  }, [customers, vendors]);

  const triggerCloudBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await window.api.triggerGoogleDriveBackup();
      if (res?.success) {
        addNotification('Backup Started', 'Cloud backup has been triggered.', 'success');
        const statusRes = await window.api.getGoogleDriveStatus();
        if (statusRes?.success) setDriveStatus(statusRes);
      } else {
        addNotification('Backup Failed', res?.error || 'Could not start backup.', 'error');
      }
    } catch (e: any) {
      addNotification('Backup Failed', e.message || 'Could not start backup.', 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[360px] text-muted-foreground gap-3">
        <RefreshCw className="h-5 w-5 animate-spin" />
        <span className="text-sm font-medium">Loading premium toolkit...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles size={26} className="text-primary" /> More Features
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Premium business toolkit with advanced insights, operations and utilities.
          </p>
        </div>
        <div className="w-full lg:w-[360px]">
          <Input
            placeholder="Search tools, analytics, utilities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase">Today Sales</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{fmtPKR(stats?.totalSalesToday || 0)}</p></CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase">Transactions Today</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{(stats?.totalTransactionsToday || 0).toLocaleString()}</p></CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase">Receivables</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-red-600">{fmtPKR(businessSignals.totalReceivable)}</p></CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase">Payables</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-amber-600">{fmtPKR(businessSignals.totalPayable)}</p></CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase">Low Stock Alerts</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold text-orange-600">{inventorySignals.lowStock.length}</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="business">
        <TabsList className="w-full justify-start overflow-auto">
          <TabsTrigger value="business">Business Tools</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Insights</TabsTrigger>
          <TabsTrigger value="customers">Customer/Vendor Insights</TabsTrigger>
          <TabsTrigger value="utilities">Smart Utilities</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredFeatureCards.filter((f) => f.tab === 'business').map((f) => (
              <Link to={f.path} key={f.title}>
                <Card className="h-full hover:-translate-y-0.5 hover:shadow-md transition-all">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      {f.title} <ArrowRight size={15} className="text-muted-foreground" />
                    </CardTitle>
                    <CardDescription>{f.desc}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Ledger Activity</CardTitle>
              <CardDescription>Latest incoming/outgoing movements from payment ledger.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right pr-4">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">No recent payment entries.</TableCell></TableRow>
                  ) : payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell><Badge variant="outline">{p.type}</Badge></TableCell>
                      <TableCell className="font-medium">{p.party_name}</TableCell>
                      <TableCell>{new Date(p.date_added).toLocaleString()}</TableCell>
                      <TableCell className={cn("text-right pr-4 font-semibold", p.direction === 'incoming' ? 'text-emerald-600' : 'text-amber-600')}>
                        {fmtPKR(p.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp size={16} /> Weekly Sales</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{fmtPKR(stats?.totalSalesWeek || 0)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp size={16} /> Monthly Sales</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{fmtPKR(stats?.totalSalesMonth || 0)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock3 size={16} /> Active Shift</CardTitle></CardHeader>
              <CardContent>
                {registerState ? (
                  <p className="text-sm font-semibold text-emerald-600">Open since {new Date(registerState.opened_at).toLocaleString()}</p>
                ) : (
                  <p className="text-sm font-semibold text-muted-foreground">No open shift</p>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredFeatureCards.filter((f) => f.tab === 'analytics').map((f) => (
              <Link to={f.path} key={f.title}>
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{f.title}</CardTitle>
                    <CardDescription>{f.desc}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Fast Moving</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-600">{inventorySignals.fastMoving.length}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Dead Stock</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-amber-600">{inventorySignals.deadStock.length}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Low Stock</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{inventorySignals.lowStock.length}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Moving Products</CardTitle>
              <CardDescription>Highest sold SKUs from current analytics snapshot.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Sold</TableHead><TableHead className="text-right pr-4">Stock</TableHead></TableRow></TableHeader>
                <TableBody>
                  {inventorySignals.fastMoving.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="h-20 text-center text-muted-foreground">No movement data available.</TableCell></TableRow>
                  ) : inventorySignals.fastMoving.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">{Number(p.total_sold) || 0}</TableCell>
                      <TableCell className="text-right pr-4">{Number(p.stock) || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFeatureCards.filter((f) => f.tab === 'inventory').map((f) => (
              <Link to={f.path} key={f.title}>
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3"><CardTitle className="text-base">{f.title}</CardTitle><CardDescription>{f.desc}</CardDescription></CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users size={16} /> Customer Base</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{customers.length.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-1">Outstanding: <span className="font-semibold text-red-600">{fmtPKR(businessSignals.totalReceivable)}</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet size={16} /> Vendor Base</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{vendors.length.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-1">Outstanding: <span className="font-semibold text-amber-600">{fmtPKR(businessSignals.totalPayable)}</span></p>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredFeatureCards.filter((f) => f.tab === 'customers').map((f) => (
              <Link to={f.path} key={f.title}>
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3"><CardTitle className="text-base">{f.title}</CardTitle><CardDescription>{f.desc}</CardDescription></CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="utilities" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Cloud size={16} /> Backup Center</CardTitle>
                <CardDescription>Google Drive backup status and recovery readiness.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  {driveStatus?.connected ? <Cloud className="h-4 w-4 text-emerald-500" /> : <CloudOff className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-sm font-medium">{driveStatus?.connected ? 'Connected to Google Drive' : 'Not connected'}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Last backup: {driveStatus?.lastBackup ? new Date(driveStatus.lastBackup).toLocaleString() : 'Not available'}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => window.api.connectGoogleDrive()}>Connect Drive</Button>
                  <Button size="sm" onClick={triggerCloudBackup} disabled={backupLoading || !driveStatus?.connected}>
                    {backupLoading ? 'Triggering...' : 'Trigger Backup'}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Database size={16} /> Data Safety Utilities</CardTitle>
                <CardDescription>Export/import and maintenance controls from existing system.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 mt-0.5" />
                  Reuse existing settings and backup workflows to avoid risky duplicate tools.
                </div>
                <Link to="/settings">
                  <Button variant="outline" className="gap-2">
                    Open Settings & Data Tools <ArrowRight size={14} />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredFeatureCards.filter((f) => f.tab === 'utilities').map((f) => (
              <Link to={f.path} key={f.title}>
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3"><CardTitle className="text-base">{f.title}</CardTitle><CardDescription>{f.desc}</CardDescription></CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Card className="border-amber-400/20 bg-amber-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Zap size={16} className="text-amber-600" /> Smart Alerts</CardTitle>
          <CardDescription>Operational attention points based on current data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className={cn(inventorySignals.lowStock.length > 0 ? 'text-orange-500' : 'text-emerald-500')} />
            <span>{inventorySignals.lowStock.length > 0 ? `${inventorySignals.lowStock.length} products are low on stock.` : 'Stock levels are currently healthy.'}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className={cn(businessSignals.totalReceivable > 0 ? 'text-red-500' : 'text-emerald-500')} />
            <span>{businessSignals.totalReceivable > 0 ? `Customer receivables pending: ${fmtPKR(businessSignals.totalReceivable)}.` : 'No customer receivables pending.'}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className={cn(businessSignals.totalPayable > 0 ? 'text-amber-500' : 'text-emerald-500')} />
            <span>{businessSignals.totalPayable > 0 ? `Vendor payables pending: ${fmtPKR(businessSignals.totalPayable)}.` : 'No vendor payables pending.'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

