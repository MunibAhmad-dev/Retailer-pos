import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardCheck, ShoppingCart, Receipt, Wallet, TrendingUp,
  TrendingDown, RefreshCw, DollarSign, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

const fmtPKR = (n: any) => 'PKR ' + (Math.round(Number(n) || 0)).toLocaleString('en-PK');

const todayStr = () => new Date().toISOString().split('T')[0];

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.28, ease: 'easeOut' } }),
};

export default function DailyClose() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [register, setRegister] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, expensesRes, registerRes, accountsRes] = await Promise.all([
        window.api.getDashboardStats(),
        window.api.getExpenses(),
        window.api.getCurrentRegister(),
        window.api.getAccounts(),
      ]);
      if (statsRes.success) setStats(statsRes.data);
      if (expensesRes.success) setAllExpenses(expensesRes.data || []);
      if (registerRes.success && registerRes.data) setRegister(registerRes.data);
      if (accountsRes.success) setAccounts((accountsRes.data as any)?.accounts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filter expenses to today only (client-side)
  const todayExpenses = useMemo(() => {
    const t = todayStr();
    return allExpenses.filter((e: any) => {
      const d = (e.date || e.date_created || '').slice(0, 10);
      return d === t;
    });
  }, [allExpenses]);

  const todayExpensesTotal = useMemo(() =>
    todayExpenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0),
    [todayExpenses]);

  const cashInHand = useMemo(() =>
    accounts.find((a: any) => a.is_default === 1 || a.type === 'cash')?.current_balance || 0,
    [accounts]);

  const salesToday = stats?.totalSalesToday || 0;
  const transactionsToday = stats?.totalTransactionsToday || 0;
  const openingBalance = register?.opening_balance || 0;
  const netCashFlow = salesToday - todayExpensesTotal;
  const expectedClosing = openingBalance + netCashFlow;

  const dateStr = new Date().toLocaleDateString('en-PK', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={22} className="animate-spin text-primary opacity-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <ClipboardCheck size={18} className="text-primary" />
            </div>
            <h1 className="text-xl font-black tracking-tight">Daily Close</h1>
          </div>
          <p className="text-xs text-muted-foreground/70 pl-[46px]">{dateStr}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 h-9" onClick={loadData}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Today\'s Sales', value: salesToday,
            icon: ShoppingCart, sub: `${transactionsToday} transaction${transactionsToday !== 1 ? 's' : ''}`,
            iconCls: 'text-emerald-500', bgCls: 'bg-emerald-500/10', valCls: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Today\'s Expenses', value: todayExpensesTotal,
            icon: Receipt, sub: `${todayExpenses.length} entr${todayExpenses.length !== 1 ? 'ies' : 'y'}`,
            iconCls: 'text-rose-500', bgCls: 'bg-rose-500/10', valCls: 'text-rose-600 dark:text-rose-400',
          },
          {
            label: 'Net Cash Flow', value: netCashFlow,
            icon: netCashFlow >= 0 ? TrendingUp : TrendingDown,
            sub: 'Revenue minus expenses',
            iconCls: netCashFlow >= 0 ? 'text-emerald-500' : 'text-rose-500',
            bgCls: netCashFlow >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10',
            valCls: netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
          },
          {
            label: 'Cash in Hand', value: cashInHand,
            icon: Wallet, sub: 'Current account balance',
            iconCls: 'text-blue-500', bgCls: 'bg-blue-500/10', valCls: 'text-blue-600 dark:text-blue-400',
          },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} custom={i} variants={fadeUp} initial="hidden" animate="show">
            <Card className="border-border/60">
              <CardContent className="p-4">
                <div className={`w-8 h-8 rounded-lg ${kpi.bgCls} flex items-center justify-center mb-3`}>
                  <kpi.icon size={16} className={kpi.iconCls} />
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">{kpi.label}</p>
                <p className={`text-base font-black ${kpi.valCls}`}>{fmtPKR(kpi.value)}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{kpi.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Cash Register Card */}
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show">
          <Card className="border-border/60 h-full">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Wallet size={14} className="text-primary" />
                Cash Register
                {register
                  ? <Badge className="ml-auto bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-none text-[10px] font-bold">Open</Badge>
                  : <Badge className="ml-auto bg-muted text-muted-foreground border-none text-[10px]">Closed</Badge>
                }
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              {register ? (
                <div className="space-y-2.5">
                  {[
                    { label: 'Opening Balance', value: fmtPKR(openingBalance) },
                    { label: 'Opened At', value: new Date(register.opened_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) },
                    { label: 'Opened By', value: register.opened_by || '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold font-mono text-xs">{value}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-border/60">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Expected Closing Cash</span>
                      <span className="text-sm font-black text-primary">{fmtPKR(expectedClosing)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 flex items-center gap-2 text-muted-foreground">
                  <AlertCircle size={14} className="opacity-50" />
                  <p className="text-sm">No register opened today.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Account Balances Card */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="show">
          <Card className="border-border/60 h-full">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <DollarSign size={14} className="text-primary" />
                Account Balances
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No accounts configured.</p>
              ) : (
                <div className="space-y-2">
                  {accounts.map((acc: any) => (
                    <div key={acc.id} className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${acc.type === 'cash' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                        <span className="text-sm">{acc.name}</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-semibold capitalize">{acc.type}</Badge>
                      </div>
                      <span className={`font-black text-sm ${Number(acc.current_balance) < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                        {fmtPKR(acc.current_balance)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Today's Expenses List */}
      {todayExpenses.length > 0 && (
        <motion.div custom={6} variants={fadeUp} initial="hidden" animate="show">
          <Card className="border-border/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Receipt size={14} className="text-rose-500" />
                Today's Expenses
                <Badge variant="secondary" className="ml-auto text-[10px] font-bold">{todayExpenses.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="divide-y divide-border/40 max-h-48 overflow-y-auto">
                {todayExpenses.map((exp: any) => (
                  <div key={exp.id} className="flex justify-between items-center py-2">
                    <div>
                      <p className="text-sm font-medium">{exp.description || exp.category || 'Expense'}</p>
                      {exp.category && exp.description && (
                        <p className="text-[10px] text-muted-foreground/70">{exp.category}</p>
                      )}
                    </div>
                    <span className="font-bold text-rose-600 dark:text-rose-400 text-sm shrink-0 ml-3">{fmtPKR(exp.amount)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Day Summary */}
      <motion.div custom={7} variants={fadeUp} initial="hidden" animate="show">
        <Card className="border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-950/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <h3 className="font-black text-sm">Day Summary</h3>
              <span className="text-[10px] text-muted-foreground/60 ml-1">
                {new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Opening Balance', value: openingBalance, sign: '' },
                { label: '+ Sales Revenue', value: salesToday, sign: 'positive' },
                { label: '− Expenses', value: todayExpensesTotal, sign: 'negative' },
              ].map(({ label, value, sign }) => (
                <div key={label} className="flex justify-between text-sm border-b border-emerald-500/10 pb-2 last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-semibold ${sign === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : sign === 'negative' ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
                    {fmtPKR(value)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-1">
                <span className="font-black text-sm">Expected Closing Balance</span>
                <span className={`font-black text-base ${expectedClosing >= openingBalance ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {fmtPKR(expectedClosing)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

    </div>
  );
}
