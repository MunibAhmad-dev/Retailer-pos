import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Plus, X, Trash2, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight,
  Landmark, Banknote, CalendarDays, RefreshCw,
  Activity, Layers, DollarSign,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useNotifications } from '../components/NotificationProvider';
import { cn } from '../lib/utils';

/* ─── Types ────────────────────────────────────────────────────────────── */
interface Account {
  id: number;
  name: string;
  type: 'cash' | 'bank';
  opening_balance: number;
  current_balance: number;
  bank_name: string;
  account_number: string;
  notes: string;
  is_default: number;
  created_at: string;
}

interface AccountTxn {
  id: number;
  account_id: number;
  account_name: string;
  account_type: string;
  type: 'in' | 'out';
  amount: number;
  category: string;
  note: string;
  date_created: string;
}

interface ChartDay { day: string; total_in: number; total_out: number; }

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const fmt = (n: number) => 'PKR ' + Math.round(n ?? 0).toLocaleString('en-PK');

const CATEGORY_COLORS: Record<string, string> = {
  sale:     '#10b981',
  purchase: '#f59e0b',
  expense:  '#ef4444',
  salary:   '#8b5cf6',
  transfer: '#3b82f6',
  opening:  '#64748b',
  manual:   '#94a3b8',
};

const CATEGORY_LABELS: Record<string, string> = {
  sale:     'Sale Income',
  purchase: 'Purchase',
  expense:  'Expense',
  salary:   'Salary',
  transfer: 'Transfer',
  opening:  'Opening Balance',
  manual:   'Manual Entry',
};

const ACCOUNT_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#0ea5e9'];

const QUICK_CATEGORIES_IN  = ['Sale Income', 'Loan Received', 'Investment', 'Other Income'];
const QUICK_CATEGORIES_OUT = ['Purchase', 'Expense', 'Salary', 'Withdrawal', 'Other'];

const DATE_PRESETS = [
  { key: 'all',    label: 'All Time' },
  { key: 'week',   label: '7 Days' },
  { key: 'month',  label: '30 Days' },
  { key: 'custom', label: 'Custom' },
] as const;
type DatePreset = typeof DATE_PRESETS[number]['key'];

function toYMD(d: Date) { return d.toISOString().split('T')[0]; }
function getPresetDates(preset: DatePreset): { from: string; to: string } | null {
  if (preset === 'all') return null;
  const now = new Date(); const today = toYMD(now);
  if (preset === 'week')  return { from: toYMD(new Date(now.getTime() - 6  * 86400000)), to: today };
  if (preset === 'month') return { from: toYMD(new Date(now.getTime() - 29 * 86400000)), to: today };
  return null;
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 },
  }),
};

/* ─── Custom Tooltip for AreaChart ──────────────────────────────────────── */
const CashFlowTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const inVal  = payload.find((p: any) => p.dataKey === 'total_in')?.value ?? 0;
  const outVal = payload.find((p: any) => p.dataKey === 'total_out')?.value ?? 0;
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm shadow-xl p-3 min-w-[160px]">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">{label}</p>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
          <span className="text-xs text-muted-foreground">In</span>
          <span className="text-xs font-bold text-emerald-500 ml-auto">{fmt(inVal)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
          <span className="text-xs text-muted-foreground">Out</span>
          <span className="text-xs font-bold text-rose-500 ml-auto">{fmt(outVal)}</span>
        </div>
      </div>
    </div>
  );
};

/* ─── Account Card ──────────────────────────────────────────────────────── */
function AccountCard({
  account, onAddEntry, onTransfer, onDelete, canTransfer, index,
}: {
  account: Account;
  onAddEntry: (acc: Account) => void;
  onTransfer: (acc: Account) => void;
  onDelete: (acc: Account) => void;
  canTransfer: boolean;
  index: number;
}) {
  const isBank = account.type === 'bank';
  const bal = Number(account.current_balance ?? 0);
  const isNeg = bal < 0;

  return (
    <motion.div
      variants={fadeUp} initial="hidden" animate="show" custom={index}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      className={cn(
        'rounded-2xl border bg-card shadow-sm p-5 flex flex-col gap-4 relative overflow-hidden',
        isBank ? 'border-blue-500/25' : 'border-emerald-500/25',
      )}
    >
      {/* Decorative gradient */}
      <div className={cn(
        'absolute inset-0 opacity-[0.03] pointer-events-none',
        isBank
          ? 'bg-gradient-to-br from-blue-500 to-blue-600'
          : 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      )} />

      {/* Header */}
      <div className="flex items-start justify-between relative">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0',
            isBank
              ? 'bg-blue-500/10 border-blue-500/20 text-blue-500'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
          )}>
            {isBank ? <Landmark size={18} /> : <Banknote size={18} />}
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">{account.name}</p>
            {isBank && account.bank_name && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{account.bank_name}</p>
            )}
            {isBank && account.account_number && (
              <p className="text-[10px] font-mono text-muted-foreground/60">{account.account_number}</p>
            )}
          </div>
        </div>
        {!account.is_default && (
          <button
            onClick={() => onDelete(account)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
            title="Delete account"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Balance */}
      <div className="relative">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">
          Current Balance
        </p>
        <p className={cn(
          'text-2xl font-bold font-mono tracking-tight',
          isNeg ? 'text-rose-500' : (isBank ? 'text-blue-500' : 'text-emerald-500'),
        )}>
          {fmt(bal)}
        </p>
        {Number(account.opening_balance) > 0 && (
          <p className="text-[10px] text-muted-foreground/40 mt-0.5">
            Opening: {fmt(Number(account.opening_balance))}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 relative">
        <Button
          size="sm"
          onClick={() => onAddEntry(account)}
          className={cn(
            'flex-1 gap-1.5 text-xs font-semibold h-8',
            isBank
              ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20'
              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
          )}
          variant="ghost"
        >
          <Plus size={13} /> Add Entry
        </Button>
        {canTransfer && (
          <Button
            size="sm"
            onClick={() => onTransfer(account)}
            variant="ghost"
            className="flex-1 gap-1.5 text-xs font-semibold h-8 border border-border/60 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftRight size={13} /> Transfer
          </Button>
        )}
      </div>
    </motion.div>
  );
}

/* ─── AddAccountModal ────────────────────────────────────────────────────────
   Isolated component — form state lives here so keystrokes don't re-render
   the parent Accounts page with its charts and transaction list.
──────────────────────────────────────────────────────────────────────────── */
function AddAccountModal({ isOpen, onClose, onSaved }: { isOpen: boolean; onClose: () => void; onSaved: () => void }) {
  const { addNotification } = useNotifications();
  const [accName,     setAccName]    = useState('');
  const [accType,     setAccType]    = useState<'cash' | 'bank'>('cash');
  const [accOpenBal,  setAccOpenBal] = useState('');
  const [accBankName, setAccBankName]= useState('');
  const [accAccNum,   setAccAccNum]  = useState('');
  const [accNotes,    setAccNotes]   = useState('');

  // Reset form when closed
  useEffect(() => {
    if (!isOpen) {
      setAccName(''); setAccType('cash'); setAccOpenBal('');
      setAccBankName(''); setAccAccNum(''); setAccNotes('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;
    try {
      const res = await window.api.addAccount({
        name: accName, type: accType,
        opening_balance: parseFloat(accOpenBal) || 0,
        bank_name: accBankName, account_number: accAccNum, notes: accNotes,
      });
      if (res.success) {
        addNotification('Account Created', `"${accName}" added successfully.`, 'success');
        onClose();
        onSaved();
      } else throw new Error(res.error);
    } catch (e: any) { addNotification('Error', e.message, 'error'); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative bg-card rounded-2xl border border-border/60 shadow-2xl w-full max-w-md overflow-hidden"
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="bg-emerald-500/5 border-b border-emerald-500/15 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                  <Plus size={15} className="text-emerald-500" />
                </div>
                <p className="font-semibold text-sm">New Account</p>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted/60 flex items-center justify-center text-muted-foreground">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account Type</label>
                  <div className="flex gap-2">
                    {[{ v: 'cash', label: 'Cash in Hand', icon: Banknote }, { v: 'bank', label: 'Bank Account', icon: Landmark }].map(t => (
                      <button key={t.v} type="button"
                        onClick={() => setAccType(t.v as any)}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all',
                          accType === t.v
                            ? t.v === 'cash'
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                              : 'bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-400'
                            : 'border-border/50 text-muted-foreground hover:border-border',
                        )}
                      >
                        <t.icon size={15} /> {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Account Name <span className="text-rose-500">*</span>
                    </label>
                    <Input required value={accName} onChange={e => setAccName(e.target.value)}
                      placeholder={accType === 'bank' ? 'e.g. Meezan Savings' : 'e.g. Shop Cash'} className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opening Balance</label>
                    <Input type="number" value={accOpenBal} onChange={e => setAccOpenBal(e.target.value)}
                      placeholder="0" className="h-10 font-mono"
                    />
                  </div>
                  {accType === 'bank' && (
                    <>
                      <div className="space-y-1.5 col-span-2 sm:col-span-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bank Name</label>
                        <Input value={accBankName} onChange={e => setAccBankName(e.target.value)}
                          placeholder="e.g. Meezan Bank" className="h-10"
                        />
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account Number</label>
                        <Input value={accAccNum} onChange={e => setAccAccNum(e.target.value)}
                          placeholder="e.g. 0123-0123456789-01" className="h-10 font-mono"
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</label>
                    <Input value={accNotes} onChange={e => setAccNotes(e.target.value)}
                      placeholder="Optional description" className="h-10"
                    />
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-border/60 bg-muted/20 flex justify-end gap-3">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                  <Plus size={14} /> Create Account
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── AddTxnModal ────────────────────────────────────────────────────────── */
function AddTxnModal({
  isOpen, accounts, prefillAccount, onClose, onSaved,
}: {
  isOpen: boolean;
  accounts: Account[];
  prefillAccount: Account | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { addNotification } = useNotifications();
  const [txnAccount,  setTxnAccount]  = useState<number | ''>('');
  const [txnType,     setTxnType]     = useState<'in' | 'out'>('in');
  const [txnAmount,   setTxnAmount]   = useState('');
  const [txnCategory, setTxnCategory] = useState('');
  const [txnNote,     setTxnNote]     = useState('');

  // Reset / pre-fill when modal opens
  useEffect(() => {
    if (isOpen) {
      setTxnAccount(prefillAccount ? prefillAccount.id : '');
      setTxnType('in');
      setTxnAmount('');
      setTxnCategory('');
      setTxnNote('');
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(txnAmount);
    if (!txnAccount || isNaN(amount) || amount <= 0) return;
    try {
      const res = await window.api.addAccountTxn({
        account_id: txnAccount,
        type: txnType,
        amount,
        category: txnCategory.toLowerCase() || 'manual',
        note: txnNote,
      });
      if (res.success) {
        addNotification('Entry Added', 'Transaction recorded.', 'success');
        onClose();
        onSaved();
      } else throw new Error(res.error);
    } catch (e: any) { addNotification('Error', e.message, 'error'); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative bg-card rounded-2xl border border-border/60 shadow-2xl w-full max-w-md overflow-hidden"
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="bg-violet-500/5 border-b border-violet-500/15 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                  <DollarSign size={15} className="text-violet-500" />
                </div>
                <p className="font-semibold text-sm">
                  {prefillAccount ? `Add Entry — ${prefillAccount.name}` : 'Add Transaction Entry'}
                </p>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted/60 flex items-center justify-center text-muted-foreground">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</label>
                  <div className="flex gap-2">
                    {[
                      { v: 'in',  label: 'Money In',  icon: ArrowUpCircle,   cls: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400' },
                      { v: 'out', label: 'Money Out', icon: ArrowDownCircle, cls: 'bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400' },
                    ].map(t => (
                      <button key={t.v} type="button" onClick={() => { setTxnType(t.v as any); setTxnCategory(''); }}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all',
                          txnType === t.v ? t.cls : 'border-border/50 text-muted-foreground hover:border-border',
                        )}
                      >
                        <t.icon size={14} /> {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!prefillAccount && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account <span className="text-rose-500">*</span></label>
                    <select required value={txnAccount}
                      onChange={e => setTxnAccount(Number(e.target.value))}
                      className="w-full h-10 rounded-lg border border-border/60 bg-background text-sm px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    >
                      <option value="">Select account…</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (PKR) <span className="text-rose-500">*</span></label>
                    <Input required type="number" value={txnAmount} onChange={e => setTxnAmount(e.target.value)}
                      placeholder="0" className="h-10 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</label>
                    <Input value={txnCategory} onChange={e => setTxnCategory(e.target.value)}
                      placeholder={txnType === 'in' ? 'e.g. Sale Income' : 'e.g. Expense'}
                      className="h-10" list="cat-suggestions"
                    />
                    <datalist id="cat-suggestions">
                      {(txnType === 'in' ? QUICK_CATEGORIES_IN : QUICK_CATEGORIES_OUT).map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                  <div className="col-span-2 flex flex-wrap gap-1.5">
                    {(txnType === 'in' ? QUICK_CATEGORIES_IN : QUICK_CATEGORIES_OUT).slice(0, 4).map(c => (
                      <button key={c} type="button" onClick={() => setTxnCategory(c)}
                        className={cn(
                          'px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-all',
                          txnCategory === c ? 'bg-foreground text-background border-foreground' : 'bg-muted/60 text-muted-foreground border-border/50 hover:border-border',
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note</label>
                    <Input value={txnNote} onChange={e => setTxnNote(e.target.value)}
                      placeholder="Optional description" className="h-10"
                    />
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-border/60 bg-muted/20 flex justify-end gap-3">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                <Button type="submit" size="sm" className={cn(
                  'gap-1.5 text-white',
                  txnType === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700',
                )}>
                  {txnType === 'in' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                  Record {txnType === 'in' ? 'Income' : 'Expense'}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── TransferModal ──────────────────────────────────────────────────────── */
function TransferModal({
  isOpen, accounts, initialFromId, onClose, onSaved,
}: {
  isOpen: boolean;
  accounts: Account[];
  initialFromId: number | '';
  onClose: () => void;
  onSaved: () => void;
}) {
  const { addNotification } = useNotifications();
  const [trFromAcc, setTrFromAcc] = useState<number | ''>(initialFromId);
  const [trToAcc,   setTrToAcc]   = useState<number | ''>('');
  const [trAmount,  setTrAmount]  = useState('');
  const [trNote,    setTrNote]    = useState('');

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setTrFromAcc(initialFromId);
      setTrToAcc('');
      setTrAmount('');
      setTrNote('');
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(trAmount);
    if (!trFromAcc || !trToAcc || isNaN(amount) || amount <= 0) return;
    try {
      const res = await window.api.transferBetweenAccounts({
        from_account_id: trFromAcc,
        to_account_id: trToAcc,
        amount,
        note: trNote || 'Internal Transfer',
      });
      if (res.success) {
        addNotification('Transfer Complete', `PKR ${amount.toLocaleString()} transferred.`, 'success');
        onClose();
        onSaved();
      } else throw new Error(res.error);
    } catch (e: any) { addNotification('Error', e.message, 'error'); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative bg-card rounded-2xl border border-border/60 shadow-2xl w-full max-w-sm overflow-hidden"
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="bg-blue-500/5 border-b border-blue-500/15 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  <ArrowLeftRight size={15} className="text-blue-500" />
                </div>
                <p className="font-semibold text-sm">Transfer Between Accounts</p>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted/60 flex items-center justify-center text-muted-foreground">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From Account <span className="text-rose-500">*</span></label>
                  <select required value={trFromAcc} onChange={e => setTrFromAcc(Number(e.target.value))}
                    className="w-full h-10 rounded-lg border border-border/60 bg-background text-sm px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    <option value="">Select account…</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({fmt(Number(a.current_balance))})</option>)}
                  </select>
                </div>
                <div className="flex justify-center">
                  <div className="w-8 h-8 rounded-full border border-border/60 bg-muted/40 flex items-center justify-center">
                    <ArrowDownCircle size={14} className="text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">To Account <span className="text-rose-500">*</span></label>
                  <select required value={trToAcc} onChange={e => setTrToAcc(Number(e.target.value))}
                    className="w-full h-10 rounded-lg border border-border/60 bg-background text-sm px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    <option value="">Select account…</option>
                    {accounts.filter(a => a.id !== trFromAcc).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (PKR) <span className="text-rose-500">*</span></label>
                  <Input required type="number" value={trAmount} onChange={e => setTrAmount(e.target.value)}
                    placeholder="0" className="h-10 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note</label>
                  <Input value={trNote} onChange={e => setTrNote(e.target.value)}
                    placeholder="Optional note" className="h-10"
                  />
                </div>
              </div>
              <div className="px-5 py-4 border-t border-border/60 bg-muted/20 flex justify-end gap-3">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                  <ArrowLeftRight size={14} /> Transfer
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */
export default function Accounts() {
  const { addNotification } = useNotifications();

  const [accounts, setAccounts]     = useState<Account[]>([]);
  const [txns, setTxns]             = useState<AccountTxn[]>([]);
  const [txnsTotal, setTxnsTotal]   = useState(0);
  const [chartData, setChartData]   = useState<ChartDay[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<'accounts' | 'txns'>('accounts');

  // Date filter for txns
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [dateFrom, setDateFrom]     = useState(() => toYMD(new Date(Date.now() - 29 * 86400000)));
  const [dateTo, setDateTo]         = useState(() => toYMD(new Date()));
  const [filterAccountId, setFilterAccountId] = useState<number | ''>('');

  // Modals
  const [showAddAccount,     setShowAddAccount]     = useState(false);
  const [showAddTxn,         setShowAddTxn]         = useState(false);
  const [showTransfer,       setShowTransfer]       = useState(false);
  const [prefillAccount,     setPrefillAccount]     = useState<Account | null>(null);
  const [initialTransferFrom, setInitialTransferFrom] = useState<number | ''>('');

  /* ── Derived stats ── */
  const cashTotal = useMemo(() =>
    accounts.filter(a => a.type === 'cash').reduce((s, a) => s + Number(a.current_balance), 0),
  [accounts]);
  const bankTotal = useMemo(() =>
    accounts.filter(a => a.type === 'bank').reduce((s, a) => s + Number(a.current_balance), 0),
  [accounts]);
  const netFunds = cashTotal + bankTotal;

  const pieData = useMemo(() =>
    accounts.map((a, i) => ({
      name: a.name,
      value: Math.max(0, Number(a.current_balance)),
      color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
    })).filter(d => d.value > 0),
  [accounts]);

  /* ── Load ── */
  const loadAccounts = useCallback(async () => {
    try {
      const res = await window.api.getAccounts();
      if (res.success) {
        setAccounts(res.data.accounts);
        setChartData(res.data.chartData);
      }
    } catch (e: any) {
      addNotification('Error', 'Could not load accounts.', 'error');
    }
  }, []);

  const loadTxns = useCallback(async () => {
    try {
      const range = getPresetDates(datePreset);
      const from = range ? range.from : (datePreset === 'custom' ? dateFrom : undefined);
      const to   = range ? range.to   : (datePreset === 'custom' ? dateTo   : undefined);
      const res = await window.api.getAccountTxns({
        account_id: filterAccountId || undefined,
        date_from: from,
        date_to: to,
      });
      if (res.success) {
        setTxns(res.data);
        setTxnsTotal(res.total);
      }
    } catch (e: any) {
      addNotification('Error', 'Could not load transactions.', 'error');
    }
  }, [datePreset, dateFrom, dateTo, filterAccountId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadAccounts();
      await loadTxns();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!loading) loadTxns();
  }, [datePreset, dateFrom, dateTo, filterAccountId]);

  /* ── Handlers ── */
  const handleDeleteTxn = async (id: number) => {
    if (!window.confirm('Delete this transaction? This will update the account balance.')) return;
    try {
      const res = await window.api.deleteAccountTxn(id);
      if (res.success) {
        addNotification('Deleted', 'Transaction removed.', 'info');
        await loadAccounts(); await loadTxns();
      }
    } catch { addNotification('Error', 'Could not delete transaction.', 'error'); }
  };

  const handleDeleteAccount = async (acc: Account) => {
    if (!window.confirm(`Delete account "${acc.name}"? All its transactions will also be removed.`)) return;
    try {
      const res = await window.api.deleteAccount(acc.id);
      if (res.success) {
        addNotification('Account Deleted', `"${acc.name}" has been removed.`, 'info');
        await loadAccounts(); await loadTxns();
      } else throw new Error(res.error);
    } catch (e: any) { addNotification('Error', e.message, 'error'); }
  };

  const openAddTxnFor = (acc: Account) => {
    setPrefillAccount(acc);
    setShowAddTxn(true);
  };

  const openTransferFrom = (acc: Account) => {
    setInitialTransferFrom(acc.id);
    setShowTransfer(true);
  };

  /* ── Running balance for txns ── */
  const txnsWithBalance = useMemo(() => {
    // We compute running balance from bottom up (oldest first) then reverse for display
    const sorted = [...txns].reverse();
    const accBalMap: Record<number, number> = {};
    accounts.forEach(a => { accBalMap[a.id] = Number(a.opening_balance); });
    const withBal = sorted.map(t => {
      const before = accBalMap[t.account_id] ?? 0;
      const after  = t.type === 'in' ? before + Number(t.amount) : before - Number(t.amount);
      accBalMap[t.account_id] = after;
      return { ...t, balance_after: after };
    });
    return withBal.reverse();
  }, [txns, accounts]);

  /* ── Chart fill ── */
  const filledChart = useMemo(() => {
    if (chartData.length === 0) return [];
    const map = new Map(chartData.map(d => [d.day, d]));
    const days: ChartDay[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = toYMD(new Date(Date.now() - i * 86400000));
      days.push(map.get(d) ?? { day: d, total_in: 0, total_out: 0 });
    }
    return days.map(d => ({ ...d, day: d.day.slice(5) })); // Show MM-DD
  }, [chartData]);

  /* ── Render ── */
  return (
    <div className="flex flex-col gap-6 max-w-6xl">

      {/* ── Page Header ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}
        className="flex items-start justify-between gap-4 flex-wrap"
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Wallet size={16} className="text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Accounts & Cash Flow</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-[42px]">
            Track cash in hand, bank balances, and every money movement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-9"
            onClick={async () => { setLoading(true); await loadAccounts(); await loadTxns(); setLoading(false); }}
          >
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} /> Refresh
          </Button>
          {accounts.length > 1 && (
            <Button variant="outline" size="sm" className="gap-1.5 h-9 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
              onClick={() => setShowTransfer(true)}
            >
              <ArrowLeftRight size={14} /> Transfer
            </Button>
          )}
          <Button size="sm" className="gap-1.5 h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setShowAddAccount(true)}
          >
            <Plus size={14} /> Add Account
          </Button>
        </div>
      </motion.div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Cash in Hand', value: cashTotal, icon: Banknote,
            color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20',
            sub: `${accounts.filter(a => a.type === 'cash').length} cash account(s)`,
            custom: 0,
          },
          {
            label: 'Bank Total', value: bankTotal, icon: Landmark,
            color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20',
            sub: `${accounts.filter(a => a.type === 'bank').length} bank account(s)`,
            custom: 1,
          },
          {
            label: 'Net Funds', value: netFunds, icon: Wallet,
            color: 'text-violet-500', bg: 'bg-violet-500/10 border-violet-500/20',
            sub: `${accounts.length} account(s) total`,
            custom: 2,
          },
        ].map((kpi) => (
          <motion.div key={kpi.label} variants={fadeUp} initial="hidden" animate="show" custom={kpi.custom + 1}
            whileHover={{ y: -2, transition: { duration: 0.18 } }}
          >
            <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm flex items-center gap-4" style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
              <div className={cn('w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0', kpi.bg)}>
                <kpi.icon size={20} className={kpi.color} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                  {kpi.label}
                </p>
                <p className={cn('text-xl font-bold font-mono tracking-tight', kpi.value < 0 && 'text-rose-500')}>
                  {fmt(kpi.value)}
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">{kpi.sub}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Cash Flow Area Chart */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={4}
          className="lg:col-span-2 rounded-2xl bg-card overflow-hidden relative"
          style={{ border: '1px solid rgba(16,185,129,0.2)', boxShadow: '0 4px 24px -4px rgba(16,185,129,0.12), 0 1px 4px rgba(0,0,0,0.05)' }}
        >
          {/* Top accent bar */}
          <div className="h-[3px] bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-400" />
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" style={{ boxShadow: '0 0 7px rgba(16,185,129,0.65)' }} />
                  <p className="text-sm font-bold">Cash Flow — Last 30 Days</p>
                </div>
                <p className="text-[11px] text-muted-foreground/70 ml-[18px]">Daily money in vs out across all accounts</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" style={{ boxShadow: '0 0 5px rgba(16,185,129,0.6)' }} />In
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" style={{ boxShadow: '0 0 5px rgba(239,68,68,0.6)' }} />Out
                </span>
              </div>
            </div>
            {filledChart.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground/50">
                No transactions yet — add entries to see cash flow
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={filledChart} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.30} />
                      <stop offset="50%" stopColor="#10b981" stopOpacity={0.10} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.26} />
                      <stop offset="50%" stopColor="#ef4444" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false} axisLine={false} interval={4}
                  />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false} axisLine={false} width={58}
                    tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
                  />
                  <Tooltip content={<CashFlowTooltip />} />
                  <Area type="monotone" dataKey="total_in"  stroke="#10b981" strokeWidth={2.2} fill="url(#gradIn)"  dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#10b981', fill: 'hsl(var(--card))' }} />
                  <Area type="monotone" dataKey="total_out" stroke="#ef4444" strokeWidth={2.2} fill="url(#gradOut)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#ef4444', fill: 'hsl(var(--card))' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* Balance Distribution Donut */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={5}
          className="rounded-2xl bg-card overflow-hidden relative"
          style={{ border: '1px solid rgba(59,130,246,0.2)', boxShadow: '0 4px 20px -4px rgba(59,130,246,0.10), 0 1px 4px rgba(0,0,0,0.05)' }}
        >
          {/* Top accent bar */}
          <div className="h-[3px] bg-gradient-to-r from-blue-600 via-violet-500 to-indigo-400" />
          <div className="p-5">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" style={{ boxShadow: '0 0 7px rgba(59,130,246,0.65)' }} />
              <p className="text-sm font-bold">Balance Distribution</p>
            </div>
            <p className="text-[11px] text-muted-foreground/70 mb-4 ml-[18px]">By account</p>
            {pieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground/50">
                No positive balances
              </div>
            ) : (
              <>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={155}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" cx="50%" cy="50%"
                        innerRadius={48} outerRadius={72} paddingAngle={3}
                        strokeWidth={0}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={`cell-${i}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any, name: any) => [fmt(value), name]}
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 14,
                          fontSize: 11,
                          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-base font-black tabular-nums text-foreground">
                      {fmt(pieData.reduce((s, d) => s + d.value, 0))}
                    </p>
                    <p className="text-[9px] text-muted-foreground font-semibold">Net Funds</p>
                  </div>
                </div>
                <div className="space-y-2.5 mt-2">
                  {pieData.map((d) => {
                    const total = pieData.reduce((s, x) => s + x.value, 0);
                    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                    return (
                      <div key={d.name}>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                            <span className="text-muted-foreground/90 truncate max-w-[80px] font-medium">{d.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold font-mono">{fmt(d.value)}</span>
                            <span className="text-muted-foreground text-[10px] w-7 text-right">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-1 rounded-full bg-muted/60 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Tabs ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={6}>
        <div className="flex gap-1 p-1 rounded-xl bg-muted/60 border border-border/40 w-fit mb-5">
          {[
            { key: 'accounts', label: 'Accounts',     icon: Landmark },
            { key: 'txns',     label: 'Transactions', icon: Activity },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                activeTab === tab.key
                  ? 'bg-background text-foreground shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.icon size={14} /> {tab.label}
              {tab.key === 'accounts' && (
                <span className="ml-1 w-4 h-4 rounded-full bg-muted text-[9px] font-bold flex items-center justify-center">
                  {accounts.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'accounts' ? (
            <motion.div key="accounts-tab"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              {loading ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-muted-foreground/20 border-t-emerald-500 rounded-full"
                  />
                  <span className="text-sm">Loading accounts…</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {accounts.map((acc, i) => (
                    <AccountCard
                      key={acc.id}
                      account={acc}
                      index={i}
                      onAddEntry={openAddTxnFor}
                      onTransfer={openTransferFrom}
                      onDelete={handleDeleteAccount}
                      canTransfer={accounts.length > 1}
                    />
                  ))}
                  {/* Add account CTA */}
                  <motion.button
                    whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setShowAddAccount(true)}
                    className="rounded-2xl border-2 border-dashed border-border/50 hover:border-primary/40 bg-card/30 hover:bg-card/60 p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-all min-h-[160px]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-muted/60 border border-border/40 flex items-center justify-center">
                      <Plus size={18} />
                    </div>
                    <span className="text-sm font-medium">Add New Account</span>
                    <span className="text-[11px] text-muted-foreground/50">Cash or bank account</span>
                  </motion.button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="txns-tab"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              {/* Txn Filters */}
              <div className="flex flex-wrap gap-2 items-center mb-4">
                {/* Account filter */}
                <select
                  value={filterAccountId}
                  onChange={e => setFilterAccountId(e.target.value ? Number(e.target.value) : '')}
                  className="h-9 rounded-lg border border-border/60 bg-background text-sm px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="">All Accounts</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>

                {/* Date preset */}
                <div className="flex gap-1 p-1 rounded-xl bg-muted/60 border border-border/40">
                  {DATE_PRESETS.map(p => (
                    <button key={p.key} onClick={() => setDatePreset(p.key)}
                      className={cn(
                        'px-3 py-1 text-xs font-medium rounded-lg transition-all duration-200',
                        datePreset === p.key
                          ? 'bg-background text-foreground shadow-sm border border-border/60'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {datePreset === 'custom' && (
                    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="flex gap-2"
                    >
                      <div className="relative">
                        <CalendarDays size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input type="date" className="h-9 pl-8 w-38 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                      </div>
                      <div className="relative">
                        <CalendarDays size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input type="date" className="h-9 pl-8 w-38 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button size="sm" className="gap-1.5 h-9 ml-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => { setShowAddTxn(true); setPrefillAccount(null); }}
                >
                  <Plus size={13} /> Add Entry
                </Button>
              </div>

              {/* Txn Table */}
              <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-muted-foreground" />
                    <span className="text-sm font-semibold">Transaction Ledger</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{txnsTotal} record{txnsTotal !== 1 ? 's' : ''}</span>
                </div>

                {/* Column headers */}
                <div className="hidden sm:grid grid-cols-[130px_1fr_120px_80px_130px_1fr_90px_44px] gap-2 px-5 py-2 border-b border-border/40 bg-muted/10">
                  {['Date', 'Account', 'Category', 'Type', 'Note', 'Amount', 'Balance', ''].map(h => (
                    <span key={h} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{h}</span>
                  ))}
                </div>

                <div className="divide-y divide-border/40">
                  {txnsWithBalance.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-36 gap-2 text-muted-foreground">
                      <Activity size={20} className="text-muted-foreground/30" />
                      <p className="text-sm">No transactions found</p>
                      <p className="text-xs text-muted-foreground/50">Add an entry above to get started</p>
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {txnsWithBalance.map((txn, idx) => {
                        const catColor = CATEGORY_COLORS[txn.category] ?? '#94a3b8';
                        const catLabel = CATEGORY_LABELS[txn.category] ?? txn.category;
                        return (
                          <motion.div key={txn.id}
                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }}
                            transition={{ duration: 0.18, delay: Math.min(idx * 0.015, 0.2) }}
                            className="group hidden sm:grid grid-cols-[130px_1fr_120px_80px_130px_1fr_90px_44px] gap-2 items-center px-5 py-3 hover:bg-muted/30 transition-colors"
                          >
                            <span className="font-mono text-xs text-muted-foreground">
                              {new Date(txn.date_created).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' })}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {txn.account_type === 'bank' ? <Landmark size={11} className="text-blue-500" /> : <Banknote size={11} className="text-emerald-500" />}
                              <span className="text-xs font-medium truncate">{txn.account_name}</span>
                            </div>
                            <span className="text-[11px] px-2 py-0.5 rounded-full border truncate"
                              style={{ color: catColor, borderColor: `${catColor}30`, background: `${catColor}12` }}
                            >
                              {catLabel}
                            </span>
                            <span className={cn(
                              'flex items-center gap-1 text-[11px] font-semibold',
                              txn.type === 'in' ? 'text-emerald-500' : 'text-rose-500',
                            )}>
                              {txn.type === 'in'
                                ? <ArrowUpCircle size={12} />
                                : <ArrowDownCircle size={12} />}
                              {txn.type.toUpperCase()}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">{txn.note || '—'}</span>
                            <span className={cn(
                              'font-bold font-mono text-sm',
                              txn.type === 'in' ? 'text-emerald-500' : 'text-rose-500',
                            )}>
                              {txn.type === 'in' ? '+' : '-'}{fmt(Number(txn.amount))}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {fmt(Number((txn as any).balance_after ?? 0))}
                            </span>
                            <div className="flex items-center justify-center">
                              <button
                                onClick={() => handleDeleteTxn(txn.id)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Modals (isolated components — form state doesn't re-render this page) ── */}
      <AddAccountModal
        isOpen={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onSaved={loadAccounts}
      />
      <AddTxnModal
        isOpen={showAddTxn}
        accounts={accounts}
        prefillAccount={prefillAccount}
        onClose={() => { setShowAddTxn(false); setPrefillAccount(null); }}
        onSaved={async () => { await loadAccounts(); await loadTxns(); }}
      />
      <TransferModal
        isOpen={showTransfer}
        accounts={accounts}
        initialFromId={initialTransferFrom}
        onClose={() => setShowTransfer(false)}
        onSaved={async () => { await loadAccounts(); await loadTxns(); }}
      />

    </div>
  );
}
