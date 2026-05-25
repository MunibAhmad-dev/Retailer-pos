import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, Plus, Trash2, FileText, Activity,
  X, TrendingDown, Layers, BarChart2, CalendarDays,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useNotifications } from '../components/NotificationProvider';
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton } from '../components/Pagination';
import { cn } from '../lib/utils';

interface Expense {
  id: number;
  title: string;
  category: string;
  amount: number;
  date_added: string;
  notes: string;
}

const fmtPKR = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-PK');

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 },
  }),
};

/* ─── Category colour palette ─── */
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
  CATEGORY_PALETTE[(cat || '').toLowerCase()] ??
  CATEGORY_PALETTE['misc'];

/* ─── Suggested categories ─── */
const CATEGORY_SUGGESTIONS = [
  'Rent', 'Utilities', 'Electricity', 'Salary', 'Maintenance',
  'Supplies', 'Transport', 'Food', 'Misc',
];

const DATE_FILTERS = [
  { key: 'today',   label: 'Today' },
  { key: 'weekly',  label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'custom',  label: 'Custom' },
] as const;

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [currentRegister, setCurrentRegister] = useState<any>(null);
  const [dateFilter, setDateFilter] = useState<'today' | 'weekly' | 'monthly' | 'custom'>('weekly');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { addNotification } = useNotifications();

  useEffect(() => {
    load();
    checkRegister();
  }, [dateFilter, fromDate, toDate]);

  const checkRegister = async () => {
    try {
      const res = await window.api.getCurrentRegister();
      if (res.success) setCurrentRegister(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const payload = {
        dateFilter,
        startDate: fromDate ? `${fromDate} 00:00:00` : undefined,
        endDate: toDate ? `${toDate} 23:59:59` : undefined,
      };
      const res = await window.api.getExpenses(payload);
      if (res?.success) setExpenses(res.data);
    } catch {
      addNotification('Error', 'Could not load expenses.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt <= 0) return;
      const res = await window.api.addExpense({
        title,
        category,
        amount: amt,
        notes,
        register_id: currentRegister?.id || null,
      });
      if (res.success) {
        addNotification('Expense Added', 'Expense record was saved.', 'success');
        setShowAdd(false);
        setTitle(''); setCategory(''); setAmount(''); setNotes('');
        load();
      }
    } catch {
      addNotification('Error', 'Failed to add expense.', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this expense record?')) return;
    try {
      const res = await window.api.deleteExpense(id);
      if (res.success) {
        addNotification('Deleted', 'Expense was removed.', 'info');
        load();
      }
    } catch {
      addNotification('Error', 'Failed to delete expense.', 'error');
    }
  };

  /* ─── KPI computations ─── */
  const currentMonthExpenses = useMemo(() =>
    expenses.filter(e => {
      const d = new Date(e.date_added);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((acc, e) => acc + e.amount, 0),
  [expenses]);

  const totalAll = useMemo(() => expenses.reduce((a, e) => a + e.amount, 0), [expenses]);
  const avgExpense = useMemo(() =>
    expenses.length > 0 ? totalAll / expenses.length : 0,
  [expenses, totalAll]);

  const { visible: visibleExpenses, hasMore, loadMore, total: eTotal, showing } = usePagination(expenses, 10, 1);

  /* ─── KPI cards data ─── */
  const kpis = [
    {
      label: 'This Month',
      value: fmtPKR(currentMonthExpenses),
      icon: Activity,
      iconClass: 'bg-rose-500/10 border-rose-500/20 text-rose-500',
      change: null,
    },
    {
      label: 'Total Records',
      value: expenses.length.toString(),
      icon: FileText,
      iconClass: 'bg-orange-500/10 border-orange-500/20 text-orange-500',
      change: null,
    },
    {
      label: 'Avg per Expense',
      value: fmtPKR(avgExpense),
      icon: BarChart2,
      iconClass: 'bg-violet-500/10 border-violet-500/20 text-violet-500',
      change: null,
    },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-5xl">

      {/* ── Page header ── */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="show" custom={0}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <TrendingDown size={16} className="text-rose-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Shop Expenses</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-[42px]">
            Track operational costs like rent, electricity, and salaries
          </p>
        </div>

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
            {showAdd
              ? <><X size={15} /> Cancel</>
              : <><Plus size={15} /> Add Expense</>}
          </Button>
        </motion.div>
      </motion.div>

      {/* ── Date filter tabs ── */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="show" custom={1}
        className="flex flex-col sm:flex-row gap-2 items-start sm:items-center"
      >
        <div className="flex gap-1 rounded-xl bg-muted/60 border border-border/40 p-1">
          {DATE_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
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
            <motion.div
              key="custom-dates"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="flex gap-2"
            >
              <div className="relative">
                <CalendarDays size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  className="h-9 pl-8 sm:w-40 text-sm"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                />
              </div>
              <div className="relative">
                <CalendarDays size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  className="h-9 pl-8 sm:w-40 text-sm"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            variants={fadeUp} initial="hidden" animate="show" custom={i + 2}
            whileHover={{ y: -2, transition: { duration: 0.18 } }}
          >
            <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 shadow-sm flex items-center gap-4">
              <div className={cn('w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0', kpi.iconClass)}>
                <kpi.icon size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                  {kpi.label}
                </p>
                <p className="text-xl font-bold font-mono tracking-tight truncate">{kpi.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Add expense form ── */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            key="add-form"
            initial={{ opacity: 0, scale: 0.97, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="rounded-2xl border border-rose-500/25 bg-card shadow-lg overflow-hidden">
              {/* Form header */}
              <div className="bg-rose-500/5 border-b border-rose-500/15 px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                  <DollarSign size={15} className="text-rose-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Log New Expense</p>
                  <p className="text-xs text-muted-foreground">
                    This will be deducted from your Gross Profit in the P&L report.
                  </p>
                </div>
              </div>

              <form onSubmit={handleAdd}>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Expense Title <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        required
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="e.g. November Rent"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Amount (PKR) <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        type="number"
                        required
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="5000"
                        className="h-10 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Category
                      </label>
                      <Input
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        placeholder="e.g. Utilities, Rent, Salary"
                        className="h-10"
                        list="category-suggestions"
                      />
                      <datalist id="category-suggestions">
                        {CATEGORY_SUGGESTIONS.map(s => <option key={s} value={s} />)}
                      </datalist>
                      {/* Quick-pick chips */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {['Rent', 'Salary', 'Utilities', 'Misc'].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setCategory(s)}
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all',
                              category === s
                                ? 'bg-foreground text-background border-foreground'
                                : 'bg-muted/60 text-muted-foreground border-border/50 hover:border-border',
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Notes
                      </label>
                      <Input
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Optional description"
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-border/60 bg-muted/20 flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdd(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5 font-semibold"
                  >
                    <Plus size={14} /> Save Expense
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expenses table ── */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="show" custom={5}
        className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden"
      >
        {/* Table header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-muted-foreground" />
            <span className="text-sm font-semibold">Expense Ledger</span>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {eTotal} record{eTotal !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[140px_1fr_130px_1fr_140px_44px] gap-2 px-5 py-2.5 border-b border-border/40 bg-muted/10">
          {['Date', 'Title', 'Category', 'Notes', 'Amount', ''].map(h => (
            <span key={h} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/40">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
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
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.22, delay: idx * 0.02 }}
                    className="group grid grid-cols-[140px_1fr_130px_1fr_140px_44px] gap-2 items-center px-5 py-3.5 hover:bg-muted/30 transition-colors"
                  >
                    {/* Date */}
                    <div className="flex items-center gap-1.5">
                      <CalendarDays size={12} className="text-muted-foreground/50 flex-shrink-0" />
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(e.date_added).toLocaleDateString('en-PK', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Title */}
                    <span className="font-semibold text-sm truncate">{e.title}</span>

                    {/* Category */}
                    <div>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium',
                        catStyle.pill,
                      )}>
                        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', catStyle.dot)} />
                        {e.category || 'Misc'}
                      </span>
                    </div>

                    {/* Notes */}
                    <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {e.notes || <span className="text-muted-foreground/40">—</span>}
                    </span>

                    {/* Amount */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold font-mono text-rose-500">
                        -{fmtPKR(e.amount)}
                      </span>
                    </div>

                    {/* Delete */}
                    <div className="flex items-center justify-center">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDelete(e.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                        title="Delete expense"
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

        {/* Load more */}
        {!loading && expenses.length > 0 && (
          <div className="px-5 py-3 border-t border-border/40 bg-muted/10">
            <LoadMoreButton hasMore={hasMore} onLoadMore={loadMore} showing={showing} total={eTotal} />
          </div>
        )}
      </motion.div>

    </div>
  );
}
