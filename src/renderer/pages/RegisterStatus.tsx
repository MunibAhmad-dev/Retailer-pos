import React, { useState, useEffect, useRef } from 'react';
import { 
  Wallet, LogIn, LogOut, AlertCircle, CheckCircle2, 
  History, DollarSign, PieChart, ShoppingBag, Receipt,
  Clock, User, ArrowRight, Activity, RefreshCw, 
  ChevronRight, ArrowDownRight, ArrowUpRight, ShieldAlert
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { useNotifications } from '../components/NotificationProvider';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

export default function RegisterStatus() {
  const [currentRegister, setCurrentRegister] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openingBalance, setOpeningBalance] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [mode, setMode] = useState<'status' | 'open' | 'close'>('status');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { addNotification } = useNotifications();
  const actualCashRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    if (mode === 'close' && actualCashRef.current) {
      actualCashRef.current.focus();
    }
  }, [mode]);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await window.api.getCurrentRegister();
      if (res.success) {
        setCurrentRegister(res.data);
        if (res.data) {
          setMode('status');
          fetchSummary(res.data.id);
        } else {
          setMode('open');
        }
      } else {
        addNotification("Error", res.error || "Could not check register status", "error");
      }
    } catch (err: any) {
      addNotification("Error", err.message || "Could not check register status", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async (id: number) => {
    setIsRefreshing(true);
    try {
      const res = await window.api.getRegisterSummary(id);
      if (res.success) {
        setSummary(res.data);
      } else {
        addNotification("Summary Error", res.error || "Could not load shift summary", "warning");
      }
    } catch (err: any) {
      addNotification("Error", err.message || "Could not load shift summary", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpen = async () => {
    try {
      const res = await window.api.openRegister({ 
        openingBalance: parseFloat(openingBalance) || 0,
        openedBy: 'Admin'
      });
      if (res.success) {
        addNotification("Register Opened", `Opening balance: Rs. ${openingBalance}`, "success");
        checkStatus();
      } else {
        addNotification("Error", res.error, "error");
      }
    } catch (err: any) {
      addNotification("Error", err.message, "error");
    }
  };

  const handleClose = async () => {
    if (!actualCash) {
      addNotification("Required", "Please enter the actual cash in hand", "warning");
      return;
    }
    try {
      const res = await window.api.closeRegister({
        registerId: currentRegister.id,
        actualCash: parseFloat(actualCash) || 0,
        closedBy: 'Admin',
        notes: notes
      });
      if (res.success) {
        addNotification("Register Closed", "The register session has been finalized.", "success");
        setActualCash(''); setNotes('');
        checkStatus();
      } else {
        addNotification("Error", res.error, "error");
      }
    } catch (err: any) {
      addNotification("Error", err.message, "error");
    }
  };

  const fmt = (val: number) => `Rs. ${Math.round(val || 0).toLocaleString()}`;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Activity className="h-10 w-10 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Loading register data...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">Cash Register</h1>
          <p className="text-muted-foreground text-sm">Manage your daily cash shifts.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/register-history">
            <Button variant="outline" size="sm" className="gap-2">
              <History size={16} /> History
            </Button>
          </Link>
          {currentRegister && (
            <Button variant="ghost" size="sm" onClick={() => fetchSummary(currentRegister.id)} disabled={isRefreshing}>
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Register Actions Card */}
        <div className="md:col-span-1">
          {mode === 'open' ? (
            <Card>
              <CardHeader>
                <CardTitle>Open Register</CardTitle>
                <CardDescription>Start a new shift.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Opening Balance (Rs.)</Label>
                  <Input 
                    type="number" 
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <Button onClick={handleOpen} className="w-full">Open Shift</Button>
              </CardContent>
            </Card>
          ) : mode === 'status' ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Active Shift</CardTitle>
                  <Badge variant="secondary">Open</Badge>
                </div>
                <CardDescription>Shift ID: #{currentRegister?.id}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Opened at:</div>
                  <div className="font-medium text-right">{currentRegister?.opened_at ? new Date(currentRegister.opened_at).toLocaleTimeString() : '—'}</div>
                  <div className="text-muted-foreground">Opened by:</div>
                  <div className="font-medium text-right">{currentRegister?.opened_by}</div>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Opening Cash</p>
                  <p className="text-xl font-bold">{fmt(currentRegister?.opening_balance)}</p>
                </div>
                <Button variant="destructive" className="w-full gap-2" onClick={() => setMode('close')}>
                  <LogOut size={16} /> Close Register
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle>Closing Register</CardTitle>
                <CardDescription>Verify cash and close shift.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Actual Cash in Drawer (Rs.)</Label>
                  <Input 
                    ref={actualCashRef}
                    type="number" 
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Shift Notes</Label>
                  <textarea 
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    placeholder="Any comments?" 
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setMode('status')}>Back</Button>
                  <Button variant="destructive" className="flex-1" onClick={handleClose}>Close Shift</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Summary Details */}
        <div className="md:col-span-2">
          {mode === 'open' ? (
            <div className="h-full border border-dashed rounded-lg flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-muted/20">
              <Wallet size={48} className="mb-4 opacity-20" />
              <p className="font-medium">Register is Offline</p>
              <p className="text-xs">Please open a shift to see live summary.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="bg-emerald-50 border-emerald-100 dark:bg-emerald-950/10">
                  <CardContent className="pt-6">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Cash Sales</p>
                    <p className="text-2xl font-bold mt-1 text-emerald-700">{fmt(summary?.cashSales)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-100 dark:bg-blue-950/10">
                  <CardContent className="pt-6">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Card/Bank Sales</p>
                    <p className="text-2xl font-bold mt-1 text-blue-700">{fmt(summary?.cardSales)}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Activity size={16} /> Reconciliation Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y text-sm">
                    <div className="flex justify-between p-4">
                      <span>Opening Balance</span>
                      <span className="font-medium">{fmt(summary?.openingBalance)}</span>
                    </div>
                    <div className="flex justify-between p-4 text-emerald-600">
                      <span>(+) Cash Sales</span>
                      <span className="font-medium">+{fmt(summary?.cashSales)}</span>
                    </div>
                    <div className="flex justify-between p-4 text-red-600">
                      <span>(-) Expenses</span>
                      <span className="font-medium">-{fmt(summary?.totalExpenses)}</span>
                    </div>
                    <div className="flex justify-between p-6 bg-muted/30">
                      <span className="font-bold">Expected Cash</span>
                      <span className="font-bold text-lg">{fmt(summary?.expectedCash)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex gap-4 text-amber-800">
                <AlertCircle className="shrink-0" size={20} />
                <div className="text-xs leading-relaxed">
                  <p className="font-bold mb-1">Shift Policy</p>
                  <p>Ensure all physical cash and digital slips are reconciled correctly before closing your shift. Discrepancies will be logged.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
