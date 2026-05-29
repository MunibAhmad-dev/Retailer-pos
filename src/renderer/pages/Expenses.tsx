import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, Plus, Trash2, FileText, Activity,
  X, TrendingDown, Layers, BarChart2, CalendarDays, Banknote,
  Users, UserPlus, Pencil, Phone, Briefcase, BadgeDollarSign,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useNotifications } from '../components/NotificationProvider';
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton } from '../components/Pagination';
import { cn } from '../lib/utils';
import { useModules } from '../contexts/ModulesContext';

/* ─── Types ───────────────────────────────────────────────────────────────── */
interface Expense {
  id: number;
  title: string;
  category: string;
  amount: number;
  date_added: string;
  notes: string;
}

interface Employee {
  id: number;
  name: string;
  role: string;
  monthly_salary: number;
  phone: string;
  notes: string;
  is_active: number;
  created_at: string;
}

const fmtPKR = (n: number) => 'PKR ' + Math.round(n ?? 0).toLocaleString('en-PK');

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 },
  }),
};

/* ─── Category colour palette ─────────────────────────────────────────────── */
const CATEGORY_PALETTE: Record<string, { pill: string; dot: string }> = {
  rent:        { pill: 'bg-violet-500/10 border border-violet-500/20 text-violet-700 dark:text-violet-400', dot: 'bg-violet-500' },
  utilities:   { pill: 'bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400',         dot: 'bg-blue-500' },
  electricity: { pill: 'bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400',         dot: 'bg-blue-500' },
  salary:      { pill: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  salaries:    { pill: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  maintenance: { pill: 'bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400',     dot: 'bg-amber-500' },
  supplies:    { pill: 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-400',         dot: 'bg-cyan-500' },
  food:        { pill: 'bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  transport:   { pill: 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500' },
  misc:        { pill: 'bg-zinc-500/10 border border-zinc-500/20 text-zinc-600 dark:text-zinc-400',         dot: 'bg-zinc-500' },
};
const getCategoryStyle = (cat: string) =>
  CATEGORY_PALETTE[(cat || '').toLowerCase()] ?? CATEGORY_PALETTE['misc'];

const CATEGORY_SUGGESTIONS = ['Rent', 'Utilities', 'Electricity', 'Salary', 'Maintenance', 'Supplies', 'Transport', 'Food', 'Misc'];

const DATE_FILTERS = [
  { key: 'today',   label: 'Today' },
  { key: 'weekly',  label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'custom',  label: 'Custom' },
] as const;

/* ═══════════════════════════════════════════════════════════════════════════
   ISOLATED MODAL COMPONENTS
   Each owns its own form state — keystrokes don't re-render the parent page
═══════════════════════════════════════════════════════════════════════════ */

/* ─── AddEmployeeModal ─────────────────────────────────────────────────── */
function AddEmployeeModal({ isOpen, onClose, onSaved }: {
  isOpen: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { addNotification } = useNotifications();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) { setName(''); setRole(''); setMonthlySalary(''); setPhone(''); setNotes(''); }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const res = await (window.api as any).addEmployee({
        name: name.trim(), role, monthly_salary: parseFloat(monthlySalary) || 0, phone, notes,
      });
      if (res.success) {
        addNotification('Employee Added', `${name.trim()} added to payroll.`, 'success');
        onClose(); onSaved();
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
          <motion.div className="relative bg-card rounded-2xl border border-border/60 shadow-2xl w-full max-w-md overflow-hidden"
            initial={{ scale: 0.95, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }} transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="bg-emerald-500/5 border-b border-emerald-500/15 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                  <UserPlus size={15} className="text-emerald-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Add Employee</p>
                  <p className="text-[11px] text-muted-foreground">New payroll member</p>
                </div>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted/60 flex items-center justify-center text-muted-foreground">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <Input required value={name} onChange={e => setName(e.target.value)}
                      placeholder="e.g. Muhammad Ali" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role / Position</label>
                    <Input value={role} onChange={e => setRole(e.target.value)}
                      placeholder="e.g. Cashier" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly Salary (PKR)</label>
                    <Input type="number" min="0" value={monthlySalary} onChange={e => setMonthlySalary(e.target.value)}
                      placeholder="25000" className="h-10 font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="0300-1234567" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</label>
                    <Input value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="Optional" className="h-10" />
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-border/60 bg-muted/20 flex justify-end gap-3">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                  <UserPlus size={14} /> Add Employee
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── EditEmployeeModal ────────────────────────────────────────────────── */
function EditEmployeeModal({ isOpen, employee, onClose, onSaved }: {
  isOpen: boolean; employee: Employee | null; onClose: () => void; onSaved: () => void;
}) {
  const { addNotification } = useNotifications();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen && employee) {
      setName(employee.name || '');
      setRole(employee.role || '');
      setMonthlySalary(employee.monthly_salary ? String(employee.monthly_salary) : '');
      setPhone(employee.phone || '');
      setNotes(employee.notes || '');
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !name.trim()) return;
    try {
      const res = await (window.api as any).updateEmployee(employee.id, {
        name: name.trim(), role, monthly_salary: parseFloat(monthlySalary) || 0, phone, notes, is_active: employee.is_active,
      });
      if (res.success) {
        addNotification('Updated', `${name.trim()} updated.`, 'success');
        onClose(); onSaved();
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
          <motion.div className="relative bg-card rounded-2xl border border-border/60 shadow-2xl w-full max-w-md overflow-hidden"
            initial={{ scale: 0.95, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }} transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="bg-blue-500/5 border-b border-blue-500/15 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  <Pencil size={14} className="text-blue-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Edit Employee</p>
                  <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{employee?.name}</p>
                </div>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted/60 flex items-center justify-center text-muted-foreground">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Name <span className="text-rose-500">*</span></label>
                    <Input required value={name} onChange={e => setName(e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</label>
                    <Input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Cashier" className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly Salary (PKR)</label>
                    <Input type="number" min="0" value={monthlySalary} onChange={e => setMonthlySalary(e.target.value)} className="h-10 font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</label>
                    <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-10" />
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-border/60 bg-muted/20 flex justify-end gap-3">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                  <Pencil size={13} /> Save Changes
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── PaySalaryModal ───────────────────────────────────────────────────── */
function PaySalaryModal({ isOpen, employee, accounts, onClose, onSaved }: {
  isOpen: boolean; employee: Employee | null; accounts: any[]; onClose: () => void; onSaved: () => void;
}) {
  const { addNotification } = useNotifications();
  const { modules } = useModules();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && employee) {
      setAmount(employee.monthly_salary ? String(Math.round(employee.monthly_salary)) : '');
      setNotes('');
      setSelectedAccountId('');
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    setSaving(true);
    try {
      const res = await window.api.addExpense({
        title: `Salary — ${employee.name}`,
        category: 'Salary',
        amount: amt,
        notes: notes || `Salary payment for ${employee.name}${employee.role ? ` (${employee.role})` : ''}`,
        account_id: selectedAccountId ? Number(selectedAccountId) : undefined,
      });
      if (res.success) {
        addNotification('Salary Paid', `${fmtPKR(amt)} paid to ${employee.name}.`, 'success');
        onClose(); onSaved();
      } else throw new Error(res.error);
    } catch (e: any) {
      addNotification('Error', e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const selAcc = accounts.find((a: any) => a.id === selectedAccountId);
  const amt = parseFloat(amount) || 0;
  const bal = selAcc ? Number(selAcc.current_balance) || 0 : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !saving && onClose()} />
          <motion.div className="relative bg-card rounded-2xl border border-border/60 shadow-2xl w-full max-w-md overflow-hidden"
            initial={{ scale: 0.95, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }} transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            <div className="relative overflow-hidden px-5 py-4 border-b"
              style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)' }}
            >
              <div className="pointer-events-none absolute -top-6 -right-6 w-28 h-28 rounded-full bg-emerald-400/10 blur-2xl" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
                    <BadgeDollarSign size={18} className="text-emerald-300" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">Pay Salary</p>
                    <p className="text-emerald-300/80 text-[11px]">
                      {employee?.name}
                      {employee?.role ? <span className="opacity-70"> · {employee.role}</span> : ''}
                    </p>
                  </div>
                </div>
                <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors p-1 rounded-lg hover:bg-white/10">
                  <X size={16} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-5 space-y-4">
                {/* Amount */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Amount (PKR) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">PKR</span>
                    <Input
                      required type="number" min="1"
                      value={amount} onChange={e => setAmount(e.target.value)}
                      placeholder="25000" className="h-11 pl-11 font-mono text-base font-bold"
                      disabled={saving}
                    />
                  </div>
                  {employee?.monthly_salary > 0 && (
                    <p className="text-[11px] text-muted-foreground/60">
                      Monthly rate: <span className="font-semibold text-foreground">{fmtPKR(employee.monthly_salary)}</span>
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note</label>
                  <Input
                    value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder={`e.g. November salary`} className="h-10"
                    disabled={saving}
                  />
                </div>

                {/* Pay from account */}
                {modules.accounting && accounts.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Banknote size={11} /> Pay From Account (optional)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {accounts.map((acc: any) => (
                        <button key={acc.id} type="button"
                          onClick={() => setSelectedAccountId(selectedAccountId === acc.id ? '' : acc.id)}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all',
                            selectedAccountId === acc.id
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                              : 'bg-muted/30 border-border/50 text-muted-foreground hover:border-border hover:bg-muted/50'
                          )}
                        >
                          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', acc.type === 'cash' ? 'bg-emerald-500' : 'bg-blue-500')} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate">{acc.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{fmtPKR(Number(acc.current_balance) || 0)}</p>
                          </div>
                          {selectedAccountId === acc.id && <span className="text-emerald-500 text-xs flex-shrink-0">✓</span>}
                        </button>
                      ))}
                    </div>
                    {selectedAccountId && amt > 0 && (
                      <p className={cn('text-[11px] font-medium flex items-center gap-1.5', amt <= bal ? 'text-emerald-600' : 'text-rose-500')}>
                        <span className={cn('w-1.5 h-1.5 rounded-full inline-block', amt <= bal ? 'bg-emerald-500' : 'bg-rose-500')} />
                        {amt <= bal
                          ? `Balance after payment: ${fmtPKR(bal - amt)}`
                          : `Insufficient funds — deficit ${fmtPKR(amt - bal)}`}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="px-5 py-4 border-t border-border/60 bg-muted/20 flex justify-end gap-3">
                <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
                <Button type="submit" size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold"
                  disabled={saving}
                >
                  <BadgeDollarSign size={14} />
                  {saving ? 'Processing…' : 'Pay Salary'}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function Expenses() {
  /* ── Core state ── */
  const [expenses,  setExpenses]  = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<'expenses' | 'payroll'>('expenses');

  /* ── Expense form state ── */
  const [showAdd,  setShowAdd]  = useState(false);
  const [title,    setTitle]    = useState('');
  const [category, setCategory] = useState('');
  const [amount,   setAmount]   = useState('');
  const [notes,    setNotes]    = useState('');
  const [currentRegister, setCurrentRegister] = useState<any>(null);
  const [dateFilter, setDateFilter] = useState<'today' | 'weekly' | 'monthly' | 'custom'>('weekly');
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');

  /* ── Payroll modal state (just open/which) — form state is in modals ── */
  const [showAddEmployee,  setShowAddEmployee]  = useState(false);
  const [editEmployee,     setEditEmployee]     = useState<Employee | null>(null);
  const [payEmployee,      setPayEmployee]      = useState<Employee | null>(null);

  const { addNotification } = useNotifications();
  const { modules } = useModules();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');

  /* ── Effects ── */
  useEffect(() => {
    load();
    checkRegister();
    loadEmployees();
  }, [dateFilter, fromDate, toDate]);

  useEffect(() => {
    if (modules.accounting) {
      window.api.getAccounts?.().then((res: any) => {
        if (res?.success && res.data?.accounts) setAccounts(res.data.accounts);
      }).catch(() => {});
    } else {
      setAccounts([]);
      setSelectedAccountId('');
    }
  }, [modules.accounting]);

  /* ── Data loaders ── */
  const checkRegister = async () => {
    try {
      const res = await window.api.getCurrentRegister();
      if (res.success) setCurrentRegister(res.data);
    } catch {}
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await window.api.getExpenses({
        dateFilter,
        startDate: fromDate ? `${fromDate} 00:00:00` : undefined,
        endDate:   toDate   ? `${toDate} 23:59:59`   : undefined,
      });
      if (res?.success) setExpenses(res.data);
    } catch {
      addNotification('Error', 'Could not load expenses.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const res = await (window.api as any).getEmployees();
      if (res?.success) setEmployees(res.data || []);
    } catch {}
  };

  /* ── Expense handlers ── */
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt <= 0) return;
      const res = await window.api.addExpense({
        title, category, amount: amt, notes,
        register_id: currentRegister?.id || null,
        account_id:  selectedAccountId ? Number(selectedAccountId) : undefined,
      });
      if (res.success) {
        addNotification('Expense Added', 'Expense record was saved.', 'success');
        setShowAdd(false);
        setTitle(''); setCategory(''); setAmount(''); setNotes('');
        setSelectedAccountId('');
        load();
        if (modules.accounting) {
          window.api.getAccounts?.().then((r: any) => {
            if (r?.success && r.data?.accounts) setAccounts(r.data.accounts);
          }).catch(() => {});
        }
      }
    } catch {
      addNotification('Error', 'Failed to add expense.', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this expense record?')) return;
    try {
      const res = await window.api.deleteExpense(id);
      if (res.success) { addNotification('Deleted', 'Expense removed.', 'info'); load(); }
    } catch {
      addNotification('Error', 'Failed to delete expense.', 'error');
    }
  };

  const handleDeleteEmployee = async (emp: Employee) => {
    if (!window.confirm(`Remove ${emp.name} from payroll?`)) return;
    try {
      const res = await (window.api as any).deleteEmployee(emp.id);
      if (res.success) { addNotification('Removed', `${emp.name} removed.`, 'info'); loadEmployees(); }
    } catch {
      addNotification('Error', 'Failed to remove employee.', 'error');
    }
  };

  /* ── KPI computations ── */
  const currentMonthExpenses = useMemo(() =>
    expenses.filter(e => {
      const d = new Date(e.date_added), now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((a, e) => a + e.amount, 0),
  [expenses]);
  const totalAll   = useMemo(() => expenses.reduce((a, e) => a + e.amount, 0), [expenses]);
  const avgExpense = useMemo(() => expenses.length > 0 ? totalAll / expenses.length : 0, [expenses, totalAll]);

  /* ── Payroll computations ── */
  const activeEmployees     = useMemo(() => employees.filter(e => e.is_active), [employees]);
  const totalMonthlyPayroll = useMemo(() => activeEmployees.reduce((s, e) => s + (e.monthly_salary || 0), 0), [activeEmployees]);
  const salaryExpenses      = useMemo(() => expenses.filter(e => e.category.toLowerCase() === 'salary'), [expenses]);

  /* ── Pagination ── */
  const { visible: visibleExpenses, hasMore, loadMore, total: eTotal, showing } = usePagination(expenses, 10, 1);

  return (
    <div className="flex flex-col gap-6 max-w-5xl">

      {/* ── Page header ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <TrendingDown size={16} className="text-rose-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Expenses & Payroll</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-[42px]">
            Track operational costs and manage employee salaries
          </p>
        </div>

        {activeTab === 'expenses' && (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
            <Button
              onClick={() => setShowAdd(v => !v)}
              className={cn(
                'gap-2 font-semibold shadow-sm transition-all',
                showAdd
                  ? 'bg-muted text-foreground hover:bg-muted/80 border border-border'
                  : 'bg-rose-600 hover:bg-rose-700 text-white',
              )}
            >
              {showAdd ? <><X size={15} /> Cancel</> : <><Plus size={15} /> Add Expense</>}
            </Button>
          </motion.div>
        )}
        {activeTab === 'payroll' && (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
            <Button
              onClick={() => setShowAddEmployee(true)}
              className="gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <UserPlus size={15} /> Add Employee
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* ── Tab bar ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={1}
        className="flex gap-1 p-1 rounded-xl bg-muted/60 border border-border/40 w-fit"
      >
        {[
          { key: 'expenses', label: 'Expenses',  icon: TrendingDown },
          { key: 'payroll',  label: 'Payroll',   icon: Users },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
              activeTab === tab.key
                ? 'bg-background text-foreground shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <tab.icon size={14} /> {tab.label}
            {tab.key === 'payroll' && activeEmployees.length > 0 && (
              <span className="ml-0.5 min-w-[18px] h-[18px] rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center px-1">
                {activeEmployees.length}
              </span>
            )}
          </button>
        ))}
      </motion.div>

      {/* ══════════════════════════════════════════════════════
          EXPENSES TAB
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'expenses' && (
        <>
          {/* Date filter */}
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={2}
            className="flex flex-col sm:flex-row gap-2 items-start sm:items-center"
          >
            <div className="flex gap-1 rounded-xl bg-muted/60 border border-border/40 p-1">
              {DATE_FILTERS.map(f => (
                <button key={f.key} onClick={() => setDateFilter(f.key)}
                  className={cn(
                    'px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-200',
                    dateFilter === f.key
                      ? 'bg-background text-foreground shadow-sm border border-border/60'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <AnimatePresence>
              {dateFilter === 'custom' && (
                <motion.div key="custom"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.22 }} className="flex gap-2"
                >
                  <div className="relative">
                    <CalendarDays size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input type="date" className="h-9 pl-8 sm:w-40 text-sm" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                  </div>
                  <div className="relative">
                    <CalendarDays size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input type="date" className="h-9 pl-8 sm:w-40 text-sm" value={toDate} onChange={e => setToDate(e.target.value)} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'This Month', value: fmtPKR(currentMonthExpenses), icon: Activity,  iconClass: 'bg-rose-500/10 border-rose-500/20 text-rose-500' },
              { label: 'Total Records', value: String(expenses.length),   icon: FileText,  iconClass: 'bg-orange-500/10 border-orange-500/20 text-orange-500' },
              { label: 'Avg per Expense', value: fmtPKR(avgExpense),      icon: BarChart2, iconClass: 'bg-violet-500/10 border-violet-500/20 text-violet-500' },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} variants={fadeUp} initial="hidden" animate="show" custom={i + 3}
                whileHover={{ y: -2, transition: { duration: 0.18 } }}
              >
                <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 shadow-sm flex items-center gap-4">
                  <div className={cn('w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0', kpi.iconClass)}>
                    <kpi.icon size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">{kpi.label}</p>
                    <p className="text-xl font-bold font-mono tracking-tight">{kpi.value}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Add expense form */}
          <AnimatePresence>
            {showAdd && (
              <motion.div key="add-form"
                initial={{ opacity: 0, scale: 0.97, y: -12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -8 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="rounded-2xl border border-rose-500/25 bg-card shadow-lg overflow-hidden">
                  <div className="bg-rose-500/5 border-b border-rose-500/15 px-5 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                      <DollarSign size={15} className="text-rose-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Log New Expense</p>
                      <p className="text-xs text-muted-foreground">Deducted from Gross Profit in P&L report.</p>
                    </div>
                  </div>
                  <form onSubmit={handleAdd}>
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Expense Title <span className="text-rose-500">*</span>
                          </label>
                          <Input required value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. November Rent" className="h-10" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Amount (PKR) <span className="text-rose-500">*</span>
                          </label>
                          <Input type="number" required value={amount} onChange={e => setAmount(e.target.value)}
                            placeholder="5000" className="h-10 font-mono" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</label>
                          <Input value={category} onChange={e => setCategory(e.target.value)}
                            placeholder="e.g. Utilities, Rent, Salary" className="h-10" list="category-suggestions" />
                          <datalist id="category-suggestions">
                            {CATEGORY_SUGGESTIONS.map(s => <option key={s} value={s} />)}
                          </datalist>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {['Rent', 'Salary', 'Utilities', 'Misc'].map(s => (
                              <button key={s} type="button" onClick={() => setCategory(s)}
                                className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all',
                                  category === s ? 'bg-foreground text-background border-foreground' : 'bg-muted/60 text-muted-foreground border-border/50 hover:border-border'
                                )}
                              >{s}</button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</label>
                          <Input value={notes} onChange={e => setNotes(e.target.value)}
                            placeholder="Optional description" className="h-10" />
                        </div>
                      </div>

                      {modules.accounting && accounts.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Banknote size={12} className="text-rose-500" /> Pay From Account
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {accounts.map((acc: any) => (
                              <button key={acc.id} type="button"
                                onClick={() => setSelectedAccountId(selectedAccountId === acc.id ? '' : acc.id)}
                                className={cn('flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all',
                                  selectedAccountId === acc.id
                                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-400'
                                    : 'bg-muted/30 border-border/50 text-muted-foreground hover:border-border hover:bg-muted/50'
                                )}
                              >
                                <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', acc.type === 'cash' ? 'bg-emerald-500' : 'bg-blue-500')} />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold truncate">{acc.name}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">PKR {Math.round(Number(acc.current_balance) || 0).toLocaleString('en-PK')}</p>
                                </div>
                                {selectedAccountId === acc.id && <span className="text-rose-500 text-sm flex-shrink-0">✓</span>}
                              </button>
                            ))}
                          </div>
                          {!selectedAccountId && (
                            <p className="text-[10px] text-muted-foreground/70 italic">No account selected — expense won't be deducted from balance</p>
                          )}
                          {(() => {
                            if (!selectedAccountId) return null;
                            const selAcc = accounts.find((a: any) => a.id === selectedAccountId);
                            const amt = parseFloat(amount) || 0;
                            if (!selAcc || amt <= 0) return null;
                            const bal = Number(selAcc.current_balance) || 0;
                            if (amt <= bal) return (
                              <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                Balance after deduction: {fmtPKR(bal - amt)}
                              </p>
                            );
                            return (
                              <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2.5 space-y-1">
                                <p className="text-[11px] text-red-600 font-semibold">⚠ Insufficient funds in "{selAcc.name}"</p>
                                <p className="text-[10px] text-muted-foreground/60 italic">Balance will go negative — top up first.</p>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="px-5 py-4 border-t border-border/60 bg-muted/20 flex justify-end gap-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
                      <Button type="submit" size="sm" className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5 font-semibold">
                        <Plus size={14} /> Save Expense
                      </Button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Expenses table */}
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={6}
            className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-muted-foreground" />
                <span className="text-sm font-semibold">Expense Ledger</span>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{eTotal} record{eTotal !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-[140px_1fr_130px_1fr_140px_44px] gap-2 px-5 py-2.5 border-b border-border/40 bg-muted/10">
              {['Date', 'Title', 'Category', 'Notes', 'Amount', ''].map(h => (
                <span key={h} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{h}</span>
              ))}
            </div>
            <div className="divide-y divide-border/40">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                    className="w-6 h-6 border-2 border-muted-foreground/20 border-t-rose-500 rounded-full"
                  />
                  <span className="text-sm">Loading expenses…</span>
                </div>
              ) : expenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                  <div className="w-11 h-11 rounded-xl bg-muted/60 border border-border/50 flex items-center justify-center">
                    <FileText size={20} className="text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium">No expenses recorded yet</p>
                  <p className="text-xs text-muted-foreground/60">Click "Add Expense" to log your first entry</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {visibleExpenses.map((e, idx) => {
                    const catStyle = getCategoryStyle(e.category);
                    return (
                      <motion.div key={e.id}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.22, delay: idx * 0.02 }}
                        className="group grid grid-cols-[140px_1fr_130px_1fr_140px_44px] gap-2 items-center px-5 py-3.5 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <CalendarDays size={12} className="text-muted-foreground/50 flex-shrink-0" />
                          <span className="font-mono text-xs text-muted-foreground">
                            {new Date(e.date_added).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <span className="font-semibold text-sm truncate">{e.title}</span>
                        <div>
                          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium', catStyle.pill)}>
                            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', catStyle.dot)} />
                            {e.category || 'Misc'}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {e.notes || <span className="text-muted-foreground/40">—</span>}
                        </span>
                        <span className="text-sm font-bold font-mono text-rose-500">-{fmtPKR(e.amount)}</span>
                        <div className="flex items-center justify-center">
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                            onClick={() => handleDelete(e.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={13} />
                          </motion.button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
            {!loading && expenses.length > 0 && (
              <div className="px-5 py-3 border-t border-border/40 bg-muted/10">
                <LoadMoreButton hasMore={hasMore} onLoadMore={loadMore} showing={showing} total={eTotal} />
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          PAYROLL TAB
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'payroll' && (
        <>
          {/* Payroll KPI strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'Active Employees', value: String(activeEmployees.length),
                icon: Users, iconClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
              },
              {
                label: 'Monthly Payroll', value: fmtPKR(totalMonthlyPayroll),
                icon: BadgeDollarSign, iconClass: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
              },
              {
                label: 'Salary Paid (Period)', value: fmtPKR(salaryExpenses.reduce((s, e) => s + e.amount, 0)),
                icon: Briefcase, iconClass: 'bg-violet-500/10 border-violet-500/20 text-violet-500',
              },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} variants={fadeUp} initial="hidden" animate="show" custom={i + 2}
                whileHover={{ y: -2, transition: { duration: 0.18 } }}
              >
                <div className="rounded-2xl border border-border/50 bg-card/80 p-5 shadow-sm flex items-center gap-4">
                  <div className={cn('w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0', kpi.iconClass)}>
                    <kpi.icon size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">{kpi.label}</p>
                    <p className="text-xl font-bold font-mono tracking-tight">{kpi.value}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Employee cards */}
          {employees.length === 0 ? (
            <motion.div variants={fadeUp} initial="hidden" animate="show" custom={5}
              className="rounded-2xl border-2 border-dashed border-border/50 bg-card/30 py-16 flex flex-col items-center gap-3 text-muted-foreground"
            >
              <div className="w-14 h-14 rounded-2xl bg-muted/60 border border-border/40 flex items-center justify-center">
                <Users size={26} className="opacity-30" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm">No employees yet</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Click "Add Employee" to set up your payroll</p>
              </div>
              <Button size="sm" onClick={() => setShowAddEmployee(true)}
                className="gap-2 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <UserPlus size={14} /> Add First Employee
              </Button>
            </motion.div>
          ) : (
            <motion.div variants={fadeUp} initial="hidden" animate="show" custom={5}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {employees.map((emp, i) => (
                  <motion.div key={emp.id}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.06 }}
                    className={cn(
                      'rounded-2xl border bg-card shadow-sm p-5 flex flex-col gap-3 relative overflow-hidden',
                      emp.is_active ? 'border-emerald-500/20' : 'border-border/40 opacity-60',
                    )}
                  >
                    {/* Subtle bg gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] to-transparent pointer-events-none" />

                    {/* Card header */}
                    <div className="flex items-start justify-between relative">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-base">
                            {emp.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm leading-tight truncate">{emp.name}</p>
                          {emp.role && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{emp.role}</p>
                          )}
                        </div>
                      </div>
                      {!emp.is_active && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40">
                          Inactive
                        </span>
                      )}
                    </div>

                    {/* Salary & phone */}
                    <div className="space-y-1.5 relative">
                      <div className="flex items-center gap-2">
                        <BadgeDollarSign size={12} className="text-emerald-500 flex-shrink-0" />
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {fmtPKR(emp.monthly_salary || 0)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">/ month</span>
                      </div>
                      {emp.phone && (
                        <div className="flex items-center gap-2">
                          <Phone size={11} className="text-muted-foreground/50 flex-shrink-0" />
                          <span className="text-xs text-muted-foreground font-mono">{emp.phone}</span>
                        </div>
                      )}
                      {emp.notes && (
                        <p className="text-[11px] text-muted-foreground/60 italic truncate">{emp.notes}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 relative pt-1 border-t border-border/30">
                      <Button size="sm" onClick={() => setPayEmployee(emp)}
                        className="flex-1 gap-1.5 h-8 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                        variant="ghost"
                      >
                        <BadgeDollarSign size={13} /> Pay Salary
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditEmployee(emp)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteEmployee(emp)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Salary payment history */}
          {salaryExpenses.length > 0 && (
            <motion.div variants={fadeUp} initial="hidden" animate="show" custom={6}
              className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-emerald-500/5">
                <div className="flex items-center gap-2">
                  <BadgeDollarSign size={14} className="text-emerald-500" />
                  <span className="text-sm font-semibold">Salary Payment History</span>
                </div>
                <span className="text-xs text-muted-foreground">{salaryExpenses.length} payment{salaryExpenses.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-[140px_1fr_1fr_140px_44px] gap-2 px-5 py-2.5 border-b border-border/40 bg-muted/10">
                {['Date', 'Employee', 'Note', 'Amount', ''].map(h => (
                  <span key={h} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{h}</span>
                ))}
              </div>
              <div className="divide-y divide-border/40">
                {salaryExpenses.slice(0, 20).map((e, idx) => (
                  <motion.div key={e.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: idx * 0.02 }}
                    className="group grid grid-cols-[140px_1fr_1fr_140px_44px] gap-2 items-center px-5 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(e.date_added).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="font-semibold text-sm truncate">
                      {e.title.replace(/^Salary\s*[—\-]\s*/i, '') || e.title}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">{e.notes || '—'}</span>
                    <span className="text-sm font-bold font-mono text-emerald-600">-{fmtPKR(e.amount)}</span>
                    <div className="flex items-center justify-center">
                      <button onClick={() => handleDelete(e.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* ── Modal instances (isolated, don't re-render parent on keystroke) ── */}
      <AddEmployeeModal
        isOpen={showAddEmployee}
        onClose={() => setShowAddEmployee(false)}
        onSaved={loadEmployees}
      />
      <EditEmployeeModal
        isOpen={!!editEmployee}
        employee={editEmployee}
        onClose={() => setEditEmployee(null)}
        onSaved={loadEmployees}
      />
      <PaySalaryModal
        isOpen={!!payEmployee}
        employee={payEmployee}
        accounts={accounts}
        onClose={() => setPayEmployee(null)}
        onSaved={() => { load(); loadEmployees(); if (modules.accounting) window.api.getAccounts?.().then((r: any) => { if (r?.success && r.data?.accounts) setAccounts(r.data.accounts); }).catch(() => {}); }}
      />

    </div>
  );
}
