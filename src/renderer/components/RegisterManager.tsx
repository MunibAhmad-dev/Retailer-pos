import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Wallet, LogIn, LogOut, AlertCircle, CheckCircle2, History, DollarSign, PieChart, ShoppingBag, Receipt } from 'lucide-react';
import { useNotifications } from './NotificationProvider';
import { cn } from '../lib/utils';

interface RegisterManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterStatusChange?: (status: any) => void;
}

export default function RegisterManager({ isOpen, onClose, onRegisterStatusChange }: RegisterManagerProps) {
  const [currentRegister, setCurrentRegister] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [mode, setMode] = useState<'status' | 'open' | 'close' | 'summary'>('status');
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen]);

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
        if (onRegisterStatusChange) onRegisterStatusChange(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async (id: number) => {
    try {
      const res = await window.api.getRegisterSummary(id);
      if (res.success) {
        setSummary(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpen = async () => {
    try {
      const res = await window.api.openRegister({ 
        openingBalance: parseFloat(openingBalance) || 0,
        openedBy: 'Admin' // Should come from auth
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
        setCurrentRegister(null);
        setActualCash('');
        setNotes('');
        checkStatus();
        onClose();
      } else {
        addNotification("Error", res.error, "error");
      }
    } catch (err: any) {
      addNotification("Error", err.message, "error");
    }
  };

  const fmt = (val: number) => `Rs. ${Math.round(val || 0).toLocaleString()}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-slate-900 text-white p-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Wallet size={24} className="text-emerald-400" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Cash Register</DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Manage your shift sessions and cash flow
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 bg-background">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Checking register status...</p>
            </div>
          ) : mode === 'open' ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95">
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-start gap-3">
                <LogIn className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-emerald-800">
                  The register is currently <strong>Closed</strong>. Enter an opening balance to start your session.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="opening-balance">Opening Cash Balance</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground font-bold">Rs.</span>
                    <Input 
                      id="opening-balance" 
                      type="number" 
                      className="pl-10 h-12 text-lg font-bold" 
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Cash available in drawer at start of shift</p>
                </div>
              </div>

              <Button onClick={handleOpen} className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2">
                <LogIn size={18} /> Open Register Session
              </Button>
            </div>
          ) : mode === 'status' && currentRegister ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500 hover:bg-emerald-500">OPEN SESSION</Badge>
                  <span className="text-xs text-muted-foreground">ID: #{currentRegister.id}</span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  Started: {new Date(currentRegister.opened_at).toLocaleTimeString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-muted/50 border flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Started By</span>
                  <span className="font-bold text-sm">{currentRegister.opened_by}</span>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 border flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Opening Bal</span>
                  <span className="font-bold text-sm text-emerald-600">{fmt(currentRegister.opening_balance)}</span>
                </div>
              </div>

              {summary && (
                <div className="space-y-3 pt-2">
                   <div className="flex items-center justify-between text-sm py-2 border-b border-dashed">
                      <span className="flex items-center gap-2 text-muted-foreground"><ShoppingBag size={14} /> Cash Sales</span>
                      <span className="font-bold text-emerald-600">+{fmt(summary.cashSales)}</span>
                   </div>
                   <div className="flex items-center justify-between text-sm py-2 border-b border-dashed">
                      <span className="flex items-center gap-2 text-muted-foreground"><PieChart size={14} /> Other Sales</span>
                      <span className="font-bold text-blue-600">+{fmt(summary.otherSales)}</span>
                   </div>
                   <div className="flex items-center justify-between text-sm py-2 border-b border-dashed">
                      <span className="flex items-center gap-2 text-muted-foreground"><Receipt size={14} /> Total Expenses</span>
                      <span className="font-bold text-red-600">-{fmt(summary.totalExpenses)}</span>
                   </div>
                   <div className="flex items-center justify-between py-4 bg-primary/5 px-4 rounded-xl mt-4">
                      <span className="font-bold text-sm uppercase">Expected Cash</span>
                      <span className="text-xl font-black text-primary">{fmt(summary.expectedCash)}</span>
                   </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={onClose}>Continue Working</Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2" onClick={() => setMode('close')}>
                   <LogOut size={18} /> Close Register
                </Button>
              </div>
            </div>
          ) : mode === 'close' ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95">
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3">
                <LogOut className="text-red-600 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-red-800">
                  Finalize your shift. Please count your cash carefully and enter the total below.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="actual-cash">Actual Cash in Hand</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground font-bold">Rs.</span>
                    <Input 
                      id="actual-cash" 
                      type="number" 
                      className="pl-10 h-12 text-lg font-bold border-red-200 focus-visible:ring-red-500" 
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value)}
                      placeholder="0.00"
                      autoFocus
                    />
                  </div>
                  {summary && actualCash && (
                    <div className={cn(
                      "text-xs font-bold p-2 rounded-lg mt-2 flex items-center gap-2",
                      parseFloat(actualCash) === summary.expectedCash ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {parseFloat(actualCash) === summary.expectedCash ? (
                        <><CheckCircle2 size={14} /> Cash Matches System!</>
                      ) : (
                        <><AlertCircle size={14} /> Difference: {fmt(parseFloat(actualCash) - summary.expectedCash)}</>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes / Observations</Label>
                  <Input 
                    id="notes" 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Shortage reason, repair needs, etc."
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setMode('status')}>Back</Button>
                <Button onClick={handleClose} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold gap-2">
                  Complete & Close
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
