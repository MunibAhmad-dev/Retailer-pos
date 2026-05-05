import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    checkStatus();
  }, []);

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
        <div className="relative">
          <Activity className="h-12 w-12 text-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-2 w-2 bg-primary rounded-full animate-ping" />
          </div>
        </div>
        <p className="text-muted-foreground font-medium animate-pulse">Syncing register data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500 max-w-6xl mx-auto pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-wider text-xs">
            <Wallet size={14} /> Cash Management
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Daily Cash Shift</h1>
          <p className="text-muted-foreground text-sm">Monitor sales and reconcile your cash drawer in real-time.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/register-history">
            <Button variant="outline" className="gap-2 bg-background border-slate-200 hover:bg-slate-50 shadow-sm">
              <History size={16} /> View History
            </Button>
          </Link>
          {currentRegister && (
            <Button variant="ghost" size="icon" onClick={() => fetchSummary(currentRegister.id)} className={cn(isRefreshing && "animate-spin")}>
              <RefreshCw size={16} />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Status & Controls (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {mode === 'open' ? (
            <Card className="border-2 border-emerald-500/20 shadow-xl shadow-emerald-500/5 overflow-hidden">
               <div className="bg-emerald-600 p-8 text-white relative">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <LogIn size={120} strokeWidth={1} />
                  </div>
                  <h3 className="text-2xl font-bold">Ready to Start?</h3>
                  <p className="text-emerald-100 text-sm mt-2">Open the register to begin tracking today's sales.</p>
               </div>
               <CardContent className="pt-8 space-y-6">
                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase text-slate-500 tracking-widest">Opening Cash Balance</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold pointer-events-none">Rs.</span>
                      <Input 
                        type="text" 
                        className="pl-12 h-16 text-2xl font-black border-slate-200 focus-visible:ring-emerald-500" 
                        value={openingBalance}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          setOpeningBalance(val);
                        }}
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground italic px-1">Enter the amount of cash currently in your drawer.</p>
                  </div>
                  <Button onClick={handleOpen} className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-lg font-bold shadow-lg shadow-emerald-600/20 gap-2 group">
                    Open Register <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </Button>
               </CardContent>
            </Card>
          ) : mode === 'status' ? (
            <Card className="border-2 border-slate-900/10 shadow-xl overflow-hidden">
               <div className="bg-slate-900 p-8 text-white relative">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Activity size={100} strokeWidth={1} />
                  </div>
                  <div className="flex justify-between items-start mb-6">
                    <Badge className="bg-emerald-500 hover:bg-emerald-500 px-3 py-1 text-[10px] font-black tracking-widest uppercase">Active Session</Badge>
                    <span className="text-slate-500 text-[10px] font-mono">SHIFT-#{currentRegister?.id}</span>
                  </div>
                  <h3 className="text-2xl font-bold">Shift Progress</h3>
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="space-y-1">
                       <span className="text-[10px] text-slate-500 uppercase font-bold">Started</span>
                       <p className="text-sm font-semibold flex items-center gap-1.5"><Clock size={14} className="text-emerald-400"/> {currentRegister?.opened_at ? new Date(currentRegister.opened_at).toLocaleTimeString() : '—'}</p>
                    </div>
                    <div className="space-y-1">
                       <span className="text-[10px] text-slate-500 uppercase font-bold">Operator</span>
                       <p className="text-sm font-semibold flex items-center gap-1.5"><User size={14} className="text-blue-400"/> {currentRegister?.opened_by || 'Admin'}</p>
                    </div>
                  </div>
               </div>
               <CardContent className="pt-8 px-8">
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 mb-8">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-tighter">Initial Opening Cash</span>
                    <div className="text-3xl font-black text-slate-900 mt-1">{fmt(currentRegister?.opening_balance)}</div>
                  </div>
                  <Button variant="destructive" className="w-full h-14 font-bold text-base shadow-lg shadow-destructive/20 gap-2" onClick={() => setMode('close')}>
                    <LogOut size={20} /> End Shift & Reconcile
                  </Button>
               </CardContent>
            </Card>
          ) : (
            <Card className="border-2 border-red-500/20 shadow-xl shadow-red-500/5 overflow-hidden animate-in slide-in-from-left-4">
               <div className="bg-red-600 p-8 text-white relative">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Receipt size={120} strokeWidth={1} />
                  </div>
                  <h3 className="text-2xl font-bold">Closing Shift</h3>
                  <p className="text-red-100 text-sm mt-2">Count your cash and finalize today's totals.</p>
               </div>
               <CardContent className="pt-8 space-y-6">
                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase text-slate-500 tracking-widest">Actual Cash in Drawer</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold pointer-events-none">Rs.</span>
                      <Input 
                        type="text" 
                        className="pl-12 h-16 text-2xl font-black border-red-100 focus-visible:ring-red-500" 
                        value={actualCash}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          setActualCash(val);
                        }}
                        autoFocus
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-slate-500 tracking-widest">Shift Notes</Label>
                    <textarea 
                      className="w-full rounded-xl border border-slate-200 p-4 text-sm min-h-[100px] focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)} 
                      placeholder="Optional: Mention any shortages, overages, or major cash events..." 
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setMode('status')}>Back</Button>
                    <Button onClick={handleClose} className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 font-bold shadow-md">Close Shift</Button>
                  </div>
               </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Visual Summary (8 cols) */}
        <div className="lg:col-span-8">
          {mode === 'open' ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-16 bg-slate-50/50 dark:bg-slate-900/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
               <div className="w-32 h-32 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-8 shadow-inner">
                  <Wallet size={50} className="text-slate-300 dark:text-slate-600" />
               </div>
               <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Register is Offline</h4>
               <p className="text-sm text-slate-500 max-w-sm mt-3 leading-relaxed">
                 You must open a register session to start processing sales. This ensures all cash flow is accurately tracked to your shift.
               </p>
               <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-md">
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 text-left">
                    <div className="h-2 w-8 bg-emerald-500 rounded-full mb-3" />
                    <p className="text-xs font-bold uppercase text-slate-400">Step 1</p>
                    <p className="text-xs text-slate-600 mt-1 font-medium">Verify drawer cash</p>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 text-left">
                    <div className="h-2 w-8 bg-blue-500 rounded-full mb-3" />
                    <p className="text-xs font-bold uppercase text-slate-400">Step 2</p>
                    <p className="text-xs text-slate-600 mt-1 font-medium">Open new shift</p>
                  </div>
               </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
               {/* Summary Stats Grid */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-none bg-emerald-500 text-white shadow-xl shadow-emerald-500/20">
                     <CardContent className="p-8">
                        <div className="flex justify-between items-start">
                           <div className="p-3 bg-white/20 rounded-2xl"><ShoppingBag size={24}/></div>
                           <Badge className="bg-white/20 hover:bg-white/30 text-white border-none font-bold">+ {summary?.cashSales > 0 ? "Active" : "Pending"}</Badge>
                        </div>
                        <div className="mt-8">
                           <p className="text-xs font-black uppercase tracking-widest text-emerald-100 opacity-80">Cash Sales Today</p>
                           <h2 className="text-4xl font-black mt-1">{fmt(summary?.cashSales)}</h2>
                        </div>
                        <div className="mt-6 flex items-center gap-2 text-xs font-medium text-emerald-100">
                          <ArrowUpRight size={14} /> Revenue from cash payments
                        </div>
                     </CardContent>
                  </Card>

                  <Card className="border-none bg-blue-600 text-white shadow-xl shadow-blue-600/20">
                     <CardContent className="p-8">
                        <div className="flex justify-between items-start">
                           <div className="p-3 bg-white/20 rounded-2xl"><PieChart size={24}/></div>
                           <Badge className="bg-white/20 hover:bg-white/30 text-white border-none font-bold">Audit</Badge>
                        </div>
                        <div className="mt-8">
                           <p className="text-xs font-black uppercase tracking-widest text-blue-100 opacity-80">Card & Bank Sales</p>
                           <h2 className="text-4xl font-black mt-1">{fmt(summary?.cardSales)}</h2>
                        </div>
                        <div className="mt-6 flex items-center gap-2 text-xs font-medium text-blue-100">
                          <Activity size={14} /> Digital payment volume
                        </div>
                     </CardContent>
                  </Card>
               </div>

               {/* Detailed Breakdown */}
               <Card className="border-2 border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                 <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50 px-8 py-6">
                    <CardTitle className="text-xl font-black flex items-center gap-3"><RefreshCw size={20} className="text-primary"/> Shift Balance Reconciliation</CardTitle>
                 </CardHeader>
                 <CardContent className="p-0">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                       <div className="flex items-center justify-between p-8 hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500"><Wallet size={20}/></div>
                             <div>
                                <p className="font-bold text-slate-900 dark:text-slate-100">Opening Balance</p>
                                <p className="text-xs text-slate-500">Starting cash at shift open</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="font-black text-xl text-slate-900 dark:text-slate-100">{fmt(summary?.openingBalance)}</p>
                          </div>
                       </div>

                       <div className="flex items-center justify-between p-8 hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-center text-emerald-600"><ArrowUpRight size={20}/></div>
                             <div>
                                <p className="font-bold text-slate-900 dark:text-slate-100">Total Cash In</p>
                                <p className="text-xs text-slate-500">All cash transactions received</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="font-black text-xl text-emerald-600">+{fmt(summary?.cashSales)}</p>
                          </div>
                       </div>

                       <div className="flex items-center justify-between p-8 hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-red-100 dark:bg-red-950/30 rounded-2xl flex items-center justify-center text-red-600"><ArrowDownRight size={20}/></div>
                             <div>
                                <p className="font-bold text-slate-900 dark:text-slate-100">Total Cash Out</p>
                                <p className="text-xs text-slate-500">Expenses paid from drawer</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="font-black text-xl text-red-600">-{fmt(summary?.totalExpenses)}</p>
                          </div>
                       </div>

                       <div className="flex items-center justify-between p-10 bg-slate-900 text-white rounded-b-xl border-t-4 border-primary">
                          <div className="flex items-center gap-4">
                             <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-primary"><DollarSign size={28}/></div>
                             <div>
                                <p className="font-black text-xl tracking-tight">Expected Cash Balance</p>
                                <p className="text-xs text-slate-400 font-medium">The theoretical amount that should be in drawer</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-4xl font-black text-primary">{fmt(summary?.expectedCash)}</p>
                             <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mt-2">Calculated in Real-time</p>
                          </div>
                       </div>
                    </div>
                 </CardContent>
               </Card>

               <div className="bg-amber-50 dark:bg-amber-950/20 rounded-[2rem] p-8 border border-amber-200 dark:border-amber-900/50 flex items-start gap-6 shadow-sm">
                  <div className="p-4 bg-amber-200/50 dark:bg-amber-900/30 rounded-2xl text-amber-700 dark:text-amber-500"><AlertCircle size={28}/></div>
                  <div className="space-y-2">
                    <h4 className="font-black text-lg text-amber-900 dark:text-amber-400 tracking-tight leading-none">Shift Reconciliation Policy</h4>
                    <p className="text-sm text-amber-900/70 dark:text-amber-200/60 leading-relaxed font-medium">
                      Ensure all digital payments (JazzCash, Card) are matched with physical slips. Any shortage in cash reconciliation will be permanently logged for owner review. 
                    </p>
                    <div className="flex gap-4 mt-4">
                      <div className="flex items-center gap-2 text-[10px] font-black text-amber-800 uppercase">
                        <CheckCircle2 size={12}/> Verified Audits
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-black text-amber-800 uppercase">
                        <ShieldAlert size={12}/> Zero Leakage
                      </div>
                    </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
