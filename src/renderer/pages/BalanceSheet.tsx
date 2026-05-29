import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  TrendingUp, TrendingDown, Package, Users, Wallet,
  Loader2, X, Info, FileSpreadsheet, DollarSign, Banknote,
  Scale, Printer, Activity, CheckCircle2, AlertCircle, Truck
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import dayjs from 'dayjs';

// ─── Types ────────────────────────────────────────────────────────────────────
interface BalanceSheetData {
  inventoryValue: number;
  receivables: number;
  payables: number;
  zakatRate?: number;
  zakatableAssetsGross?: number;
  zakatableAssetsNet?: number;
  revenue: number;
  cogs: number;
  expenses: number;
  vendorOutflow: number;
  netProfit: number;
  paymentStats: { payment_method: string; revenue: number; count: number }[];
  recentTransactions: any[];
  period: { start: string | null; end: string | null };
}

interface Account {
  id: number;
  name: string;
  type: string;
  current_balance: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rs = (n: number) => 'Rs. ' + Math.abs(Math.round(n)).toLocaleString();

// ─── Row component for balance sheet lines ────────────────────────────────────
function BSRow({ label, value, bold, indent, positive, negative, divider }: {
  label: string; value?: number | null; bold?: boolean; indent?: boolean;
  positive?: boolean; negative?: boolean; divider?: boolean;
}) {
  return (
    <div className={cn(
      'flex justify-between items-center py-1.5',
      divider && 'border-t border-border/60 mt-1 pt-2',
    )}>
      <span className={cn(
        'text-sm',
        indent && 'pl-4 text-muted-foreground',
        bold && 'font-bold text-foreground',
        !indent && !bold && 'text-muted-foreground',
      )}>
        {label}
      </span>
      {value !== undefined && value !== null && (
        <span className={cn(
          'text-sm tabular-nums',
          bold && 'font-black text-base',
          positive && 'text-emerald-600',
          negative && 'text-red-500',
          !positive && !negative && (bold ? 'text-foreground' : 'text-muted-foreground'),
        )}>
          {rs(value)}
        </span>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BalanceSheet() {
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [appliedRange, setAppliedRange] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [appliedCustomFrom, setAppliedCustomFrom] = useState('');
  const [appliedCustomTo, setAppliedCustomTo] = useState('');

  // Zakat state
  const [showZakat, setShowZakat] = useState(false);
  const [nisab, setNisab] = useState(100000);
  const [zakatFrom, setZakatFrom] = useState(dayjs().subtract(1, 'year').format('YYYY-MM-DD'));
  const [zakatTo, setZakatTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [zakatData, setZakatData] = useState<BalanceSheetData | null>(null);
  const [zakatLoading, setZakatLoading] = useState(false);

  const fetchSeqRef = useRef(0);

  // ── Derived numbers ────────────────────────────────────────────────────────
  const cashTotal = useMemo(() =>
    accounts.reduce((s, a) => s + (a.current_balance || 0), 0), [accounts]);

  const totalCurrentAssets = useMemo(() =>
    cashTotal + (data?.inventoryValue || 0) + (data?.receivables || 0), [cashTotal, data]);

  const totalLiabilities = data?.payables || 0;
  const totalEquity = totalCurrentAssets - totalLiabilities;
  const retainedEarnings = data?.netProfit || 0;
  const ownersCapital = totalEquity - retainedEarnings;
  const grossProfit = (data?.revenue || 0) - (data?.cogs || 0);
  const isBalanced = data ? Math.abs(totalCurrentAssets - (totalLiabilities + totalEquity)) < 1 : false;

  const currentRatio = totalLiabilities > 0 ? totalCurrentAssets / totalLiabilities : null;
  const profitMargin = data && data.revenue > 0 ? (data.netProfit / data.revenue) * 100 : null;
  const workingCapital = totalCurrentAssets - totalLiabilities;
  const debtToEquity = totalEquity !== 0 ? totalLiabilities / totalEquity : null;

  // Zakat
  const zSource = zakatData || data;
  const zakatRate = Number(zSource?.zakatRate ?? 0.025);
  const zakatGross = Number(zSource?.zakatableAssetsGross ?? ((zSource?.inventoryValue || 0) + (zSource?.receivables || 0)));
  const zakatNet = Number(zSource?.zakatableAssetsNet ?? Math.max(0, zakatGross - (zSource?.payables || 0)));
  const zakatDue = zakatNet * zakatRate;

  const periodLabel = useMemo(() => {
    if (appliedRange === 'today') return dayjs().format('DD MMM YYYY');
    if (appliedRange === 'week') return 'Last 7 Days';
    if (appliedRange === 'month') return 'Last 30 Days';
    if (appliedRange === 'year') return 'Last 365 Days';
    if (appliedRange === 'custom' && appliedCustomFrom && appliedCustomTo)
      return `${dayjs(appliedCustomFrom).format('DD MMM YYYY')} — ${dayjs(appliedCustomTo).format('DD MMM YYYY')}`;
    return 'All Time';
  }, [appliedRange, appliedCustomFrom, appliedCustomTo]);

  // ── Data loading ───────────────────────────────────────────────────────────
  useEffect(() => {
    loadData();
    loadAccounts();
  }, [appliedRange, appliedCustomFrom, appliedCustomTo]);

  const loadData = async () => {
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    try {
      const fmtD = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD HH:mm:ss');
      let startDate: string | undefined;
      let endDate: string = dayjs().endOf('day').toISOString();
      if (appliedRange === 'today') startDate = fmtD(dayjs().startOf('day'));
      else if (appliedRange === 'week') startDate = fmtD(dayjs().subtract(7, 'day').startOf('day'));
      else if (appliedRange === 'month') startDate = fmtD(dayjs().subtract(30, 'day').startOf('day'));
      else if (appliedRange === 'year') startDate = fmtD(dayjs().subtract(365, 'day').startOf('day'));
      else if (appliedRange === 'custom') {
        startDate = appliedCustomFrom ? `${appliedCustomFrom} 00:00:00` : undefined;
        endDate = appliedCustomTo ? `${appliedCustomTo} 23:59:59` : endDate;
      }
      const res = await window.api.getBalanceSheet({ startDate, endDate });
      if (seq !== fetchSeqRef.current) return;
      if (res.success) setData(res.data);
    } catch (e) { console.error(e); }
    finally { if (seq === fetchSeqRef.current) setLoading(false); }
  };

  const loadAccounts = async () => {
    try {
      const res = await window.api.getAccounts();
      if (res?.success && Array.isArray(res.data?.accounts)) setAccounts(res.data.accounts);
    } catch { /* non-critical */ }
  };

  const fetchZakatData = async () => {
    setZakatLoading(true);
    try {
      const res = await window.api.getBalanceSheet({
        startDate: `${zakatFrom} 00:00:00`,
        endDate: `${zakatTo} 23:59:59`,
      });
      if (res.success) setZakatData(res.data);
    } finally { setZakatLoading(false); }
  };

  useEffect(() => { if (showZakat && !zakatData) fetchZakatData(); }, [showZakat]);

  // ── Excel Export ───────────────────────────────────────────────────────────
  const exportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    // Balance Sheet sheet
    const bsRows: (string | number | null)[][] = [
      ['OsaTech POS — Balance Sheet'],
      ['Period:', periodLabel],
      ['Generated:', dayjs().format('DD MMM YYYY, HH:mm')],
      [],
      ['ASSETS', 'Amount (Rs.)'],
      ['Current Assets', ''],
      ['  Cash & Bank Accounts', cashTotal],
      ['  Accounts Receivable (Customer Dues)', data.receivables],
      ['  Inventory / Stock Value', data.inventoryValue],
      ['  ─────────────────────────────', ''],
      ['  Total Current Assets', totalCurrentAssets],
      [],
      ['TOTAL ASSETS', totalCurrentAssets],
      [],
      ['LIABILITIES & EQUITY', ''],
      ['Current Liabilities', ''],
      ['  Accounts Payable (Vendor Dues)', data.payables],
      ['  ─────────────────────────────', ''],
      ['  Total Liabilities', totalLiabilities],
      [],
      ["Owner's Equity", ''],
      ['  Net Profit / (Loss) for Period', retainedEarnings],
      ["  Owner's Capital (Residual)", ownersCapital],
      ['  ─────────────────────────────', ''],
      ['  Total Equity', totalEquity],
      [],
      ['TOTAL LIABILITIES + EQUITY', totalLiabilities + totalEquity],
      [],
      isBalanced ? ['✓ Balance Sheet Equation Verified (Assets = Liabilities + Equity)', ''] :
        ['⚠ Balance check difference', totalCurrentAssets - (totalLiabilities + totalEquity)],
      [],
      ['INCOME STATEMENT', ''],
      ['Revenue (Gross Sales)', data.revenue],
      ['Cost of Goods Sold (COGS)', data.cogs],
      ['Gross Profit', grossProfit],
      ['Operating Expenses', data.expenses],
      ['Net Profit / (Loss)', data.netProfit],
      [],
      ['FINANCIAL RATIOS', ''],
      ['Current Ratio', currentRatio !== null ? +currentRatio.toFixed(2) : 'N/A'],
      ['Profit Margin (%)', profitMargin !== null ? +(profitMargin.toFixed(1)) : 'N/A'],
      ['Working Capital', workingCapital],
      ['Debt-to-Equity Ratio', debtToEquity !== null ? +debtToEquity.toFixed(2) : 'N/A'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(bsRows);
    ws['!cols'] = [{ wch: 42 }, { wch: 22 }];

    // Apply some styles (bold headers)
    const boldRows = [0, 4, 14, 19, 29, 35];
    boldRows.forEach(r => {
      const cellRef = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[cellRef]) ws[cellRef].s = { font: { bold: true } };
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet');

    // Payment Methods sheet
    if (data.paymentStats.length > 0) {
      const pmRows: (string | number)[][] = [
        ['Payment Methods Breakdown'],
        ['Period:', periodLabel],
        [],
        ['Method', 'Revenue (Rs.)', 'Transactions', '% of Total'],
        ...data.paymentStats.map(s => [
          s.payment_method.toUpperCase(),
          s.revenue,
          s.count,
          data.revenue > 0 ? +((s.revenue / data.revenue) * 100).toFixed(1) : 0,
        ]),
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(pmRows);
      ws2['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Payment Methods');
    }

    // Accounts / Cash sheet
    if (accounts.length > 0) {
      const acRows: (string | number)[][] = [
        ['Cash & Bank Accounts'],
        [],
        ['Account Name', 'Type', 'Balance (Rs.)'],
        ...accounts.map(a => [a.name, a.type, a.current_balance]),
        [],
        ['TOTAL', '', cashTotal],
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(acRows);
      ws3['!cols'] = [{ wch: 28 }, { wch: 15 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Cash & Bank');
    }

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance-sheet-${dayjs().format('YYYY-MM-DD')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 size={36} className="animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Calculating balance sheet…</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Balance Sheet</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Standard accounting statement · {periodLabel}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Period chips */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/50">
            {(['today', 'week', 'month', 'year', 'custom'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all',
                  range === r
                    ? 'bg-background shadow text-foreground border border-border/60'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {r}
              </button>
            ))}
          </div>

          {range === 'custom' && (
            <div className="flex gap-2">
              <Input type="date" className="h-8 text-xs w-36" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <Input type="date" className="h-8 text-xs w-36" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          )}

          <Button size="sm" className="h-8"
            onClick={() => { setAppliedRange(range); setAppliedCustomFrom(customFrom); setAppliedCustomTo(customTo); }}>
            Apply
          </Button>

          <Button size="sm" variant="outline" className="h-8 gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            onClick={() => setShowZakat(true)}>
            <Wallet size={13} /> Zakat
          </Button>

          <Button size="sm" variant="outline" className="h-8 gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={exportExcel}>
            <FileSpreadsheet size={13} /> Export Excel
          </Button>

          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => window.print()}>
            <Printer size={13} /> Print
          </Button>
        </div>
      </div>

      {/* ── Balance Equation Banner ── */}
      <div className={cn(
        'flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-semibold',
        isBalanced
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300'
          : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300',
      )}>
        {isBalanced
          ? <CheckCircle2 size={15} className="shrink-0" />
          : <AlertCircle size={15} className="shrink-0" />}
        <span>
          <strong>Assets ({rs(totalCurrentAssets)})</strong> = Liabilities ({rs(totalLiabilities)}) + Equity ({rs(totalEquity)})
          {isBalanced ? ' ✓ Balanced' : ' — Rounding difference noted'}
        </span>
      </div>

      {/* ── T-Account Balance Sheet ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── LEFT: ASSETS ── */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3 border-b border-border/60 bg-emerald-500/5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <TrendingUp size={14} className="text-emerald-600" />
            </div>
            <h2 className="font-black text-sm uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Assets</h2>
          </div>

          <div className="px-5 py-4 space-y-0.5">
            {/* Current Assets header */}
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2">Current Assets</p>

            {/* Cash & Bank breakdown */}
            <BSRow label="Cash & Bank Accounts" value={cashTotal} indent positive={cashTotal > 0} />
            {accounts.map(a => (
              <div key={a.id} className="flex justify-between items-center py-0.5 pl-8">
                <span className="text-xs text-muted-foreground/70 truncate max-w-[160px]">{a.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground/70">{rs(a.current_balance)}</span>
              </div>
            ))}
            {accounts.length === 0 && (
              <div className="pl-8 text-xs text-muted-foreground/50 italic py-0.5">No accounts found</div>
            )}

            <BSRow label="Accounts Receivable" value={data.receivables} indent positive={data.receivables > 0} />
            <div className="pl-8 text-xs text-muted-foreground/50 italic py-0.5">Customer outstanding dues</div>

            <BSRow label="Inventory / Stock Value" value={data.inventoryValue} indent positive={data.inventoryValue > 0} />
            <div className="pl-8 text-xs text-muted-foreground/50 italic py-0.5">Goods held for sale</div>

            <div className="my-2 border-t border-dashed border-border/60" />
            <BSRow label="Total Current Assets" value={totalCurrentAssets} bold positive />
            <BSRow label="Total Non-Current Assets" value={0} indent />
            <div className="my-2 border-t-2 border-border" />
            <BSRow label="TOTAL ASSETS" value={totalCurrentAssets} bold positive />
          </div>
        </div>

        {/* ── RIGHT: LIABILITIES + EQUITY ── */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3 border-b border-border/60 bg-red-500/5">
            <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
              <TrendingDown size={14} className="text-red-600" />
            </div>
            <h2 className="font-black text-sm uppercase tracking-wider text-red-700 dark:text-red-400">Liabilities & Equity</h2>
          </div>

          <div className="px-5 py-4 space-y-0.5">
            {/* Liabilities */}
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2">Current Liabilities</p>

            <BSRow label="Accounts Payable" value={data.payables} indent negative={data.payables > 0} />
            <div className="pl-8 text-xs text-muted-foreground/50 italic py-0.5">Vendor outstanding dues</div>

            <div className="my-2 border-t border-dashed border-border/60" />
            <BSRow label="Total Liabilities" value={totalLiabilities} bold negative={totalLiabilities > 0} />

            {/* Equity */}
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mt-4 mb-2">Owner's Equity</p>

            <BSRow
              label="Net Profit / (Loss) — Period"
              value={retainedEarnings}
              indent
              positive={retainedEarnings >= 0}
              negative={retainedEarnings < 0}
            />
            <BSRow
              label="Owner's Capital (Residual)"
              value={ownersCapital}
              indent
              positive={ownersCapital >= 0}
              negative={ownersCapital < 0}
            />
            <div className="my-2 border-t border-dashed border-border/60" />
            <BSRow label="Total Equity" value={totalEquity} bold positive={totalEquity >= 0} negative={totalEquity < 0} />

            <div className="my-2 border-t-2 border-border" />
            <BSRow label="TOTAL LIABILITIES + EQUITY" value={totalLiabilities + totalEquity} bold />
          </div>
        </div>
      </div>

      {/* ── Financial Ratios ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Current Ratio',
            value: currentRatio !== null ? currentRatio.toFixed(2) : 'N/A',
            sub: currentRatio === null ? 'No liabilities' : currentRatio >= 2 ? 'Healthy (≥2.0)' : currentRatio >= 1 ? 'Adequate (≥1.0)' : 'Low (<1.0)',
            color: currentRatio === null ? 'blue' : currentRatio >= 2 ? 'emerald' : currentRatio >= 1 ? 'amber' : 'red',
            icon: Scale,
            tip: 'Current Assets ÷ Current Liabilities. ≥2 is ideal.',
          },
          {
            label: 'Profit Margin',
            value: profitMargin !== null ? profitMargin.toFixed(1) + '%' : 'N/A',
            sub: profitMargin === null ? 'No revenue' : profitMargin >= 20 ? 'Excellent' : profitMargin >= 10 ? 'Good' : profitMargin >= 0 ? 'Low' : 'Loss',
            color: profitMargin === null ? 'blue' : profitMargin >= 20 ? 'emerald' : profitMargin >= 10 ? 'blue' : profitMargin >= 0 ? 'amber' : 'red',
            icon: Activity,
            tip: 'Net Profit ÷ Revenue. Higher is better.',
          },
          {
            label: 'Working Capital',
            value: rs(workingCapital),
            sub: workingCapital >= 0 ? 'Positive — can pay bills' : 'Negative — cash tight',
            color: workingCapital >= 0 ? 'emerald' : 'red',
            icon: Banknote,
            tip: 'Current Assets − Current Liabilities.',
          },
          {
            label: 'Debt-to-Equity',
            value: debtToEquity !== null ? debtToEquity.toFixed(2) : 'N/A',
            sub: debtToEquity === null ? 'No equity' : debtToEquity <= 1 ? 'Low risk' : debtToEquity <= 2 ? 'Moderate' : 'High leverage',
            color: debtToEquity === null ? 'blue' : debtToEquity <= 1 ? 'emerald' : debtToEquity <= 2 ? 'amber' : 'red',
            icon: TrendingDown,
            tip: 'Total Liabilities ÷ Total Equity.',
          },
        ].map(({ label, value, sub, color, icon: Icon, tip }) => (
          <div key={label} className={cn(
            'rounded-xl border p-4 flex flex-col gap-1',
            color === 'emerald' && 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800',
            color === 'red' && 'bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-800',
            color === 'amber' && 'bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800',
            color === 'blue' && 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800',
          )}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</span>
              <Icon size={14} className={cn(
                color === 'emerald' && 'text-emerald-500',
                color === 'red' && 'text-red-500',
                color === 'amber' && 'text-amber-500',
                color === 'blue' && 'text-blue-500',
              )} />
            </div>
            <p className={cn(
              'text-xl font-black',
              color === 'emerald' && 'text-emerald-700 dark:text-emerald-400',
              color === 'red' && 'text-red-700 dark:text-red-400',
              color === 'amber' && 'text-amber-700 dark:text-amber-400',
              color === 'blue' && 'text-blue-700 dark:text-blue-400',
            )}>{value}</p>
            <p className="text-[10px] text-muted-foreground/60">{sub}</p>
            <p className="text-[9px] text-muted-foreground/40 mt-auto pt-1 border-t border-border/30">{tip}</p>
          </div>
        ))}
      </div>

      {/* ── Income Statement ── */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3 border-b border-border/60">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity size={14} className="text-primary" />
          </div>
          <div>
            <h2 className="font-black text-sm uppercase tracking-wider">Income Statement</h2>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">Profit & Loss Summary · {periodLabel}</p>
          </div>
        </div>

        <div className="p-5">
          {/* Waterfall */}
          <div className="space-y-1">
            <BSRow label="Gross Revenue (Sales)" value={data.revenue} positive />
            <BSRow label="Less: Cost of Goods Sold (COGS)" value={data.cogs} indent negative />
            <BSRow label="Gross Profit" value={grossProfit} bold positive={grossProfit >= 0} negative={grossProfit < 0} divider />
            <BSRow label="Less: Operating Expenses" value={data.expenses} indent negative />
            <div className="mt-3 pt-3 border-t-2 border-dashed border-border flex justify-between items-center">
              <span className="font-black text-sm uppercase tracking-wide">Net Profit / (Loss)</span>
              <span className={cn(
                'text-2xl font-black',
                data.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500',
              )}>
                {data.netProfit >= 0 ? '' : '− '}{rs(data.netProfit)}
              </span>
            </div>
          </div>

          {/* Payment Methods */}
          {data.paymentStats.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border/40">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3">Revenue by Payment Method</p>
              <div className="space-y-2">
                {data.paymentStats.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-black',
                      s.payment_method === 'cash' ? 'bg-emerald-100 text-emerald-700' :
                        s.payment_method === 'online' ? 'bg-blue-100 text-blue-700' :
                          'bg-violet-100 text-violet-700',
                    )}>
                      {s.payment_method[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold capitalize">{s.payment_method}</span>
                        <span className="font-black">{rs(s.revenue)}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${data.revenue > 0 ? (s.revenue / data.revenue) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-muted-foreground/50 mt-0.5">
                        {data.revenue > 0 ? Math.round((s.revenue / data.revenue) * 100) : 0}% of total · {s.count} txns
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Zakat Calculator Modal ── */}
      {showZakat && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-emerald-500/20 bg-card shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-emerald-200/40 bg-emerald-500/5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Wallet size={18} className="text-emerald-600" />
                  <h2 className="text-xl font-black text-emerald-700">Zakat Calculator</h2>
                </div>
                <p className="text-xs text-emerald-900/60 font-medium">2.5% of net zakatable wealth (Nisab threshold applies)</p>
              </div>
              <button onClick={() => setShowZakat(false)} className="mt-1 p-1 rounded-lg hover:bg-emerald-100 transition-colors">
                <X size={16} className="text-emerald-700" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

              {/* Period selector */}
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest text-emerald-800">Calculation Period</span>
                  {zakatLoading && <Loader2 size={14} className="animate-spin text-emerald-600" />}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-emerald-700 uppercase block mb-1">From</label>
                    <Input type="date" value={zakatFrom} onChange={e => setZakatFrom(e.target.value)}
                      className="h-9 text-xs border-emerald-200 focus:border-emerald-500 bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-emerald-700 uppercase block mb-1">To</label>
                    <Input type="date" value={zakatTo} onChange={e => setZakatTo(e.target.value)}
                      className="h-9 text-xs border-emerald-200 focus:border-emerald-500 bg-white" />
                  </div>
                </div>
                <button onClick={fetchZakatData} disabled={zakatLoading}
                  className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors">
                  <Activity size={13} /> Recalculate
                </button>
              </div>

              {/* Nisab threshold */}
              <div className="p-4 rounded-xl border-2 border-emerald-100 bg-emerald-50/30">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold uppercase text-emerald-800">Nisab Threshold (PKR)</span>
                  <span className="text-[10px] text-emerald-600 italic">Adjustable</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-emerald-500 shrink-0" />
                  <input type="number" value={nisab} onChange={e => setNisab(Number(e.target.value))}
                    className="flex-1 bg-transparent border-none text-xl font-black focus:outline-none text-emerald-900 dark:text-emerald-300" />
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-2">
                {[
                  { icon: Package, label: 'Stock / Inventory Value', value: zSource?.inventoryValue || 0 },
                  { icon: Users, label: 'Total Receivables (Customer Dues)', value: zSource?.receivables || 0 },
                  { icon: Truck, label: 'Less: Accounts Payable', value: zSource?.payables || 0, deduct: true },
                  { icon: TrendingUp, label: 'Net Zakatable Assets', value: zakatNet, total: true },
                ].map(({ icon: Icon, label, value, deduct, total }) => (
                  <div key={label} className={cn(
                    'flex justify-between items-center py-2 border-b border-emerald-100',
                    total && 'border-b-2 border-emerald-300 pb-3',
                  )}>
                    <span className={cn('text-sm flex items-center gap-2', total ? 'font-black text-emerald-900 dark:text-emerald-300' : 'text-muted-foreground')}>
                      <Icon size={13} />
                      {label}
                    </span>
                    <span className={cn('text-sm font-bold', deduct ? 'text-red-600' : total ? 'text-emerald-900 dark:text-emerald-300 font-black text-base' : '')}>
                      {deduct ? '− ' : ''}{rs(value)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Formula explanation */}
              <div className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-100 text-xs text-emerald-900 space-y-1">
                <p className="font-black text-[10px] uppercase tracking-widest text-emerald-800 mb-2">Calculation Formula</p>
                <p>Gross Zakatable = Inventory + Receivables</p>
                <p>Net Zakatable = Gross − Payables</p>
                <p>If Net ≥ Nisab → Zakat = Net × {Math.round(zakatRate * 1000) / 10}%</p>
                <p className="text-emerald-700 font-medium pt-1 border-t border-emerald-100">
                  ({rs(zSource?.inventoryValue || 0)} + {rs(zSource?.receivables || 0)} − {rs(zSource?.payables || 0)}) × {Math.round(zakatRate * 1000) / 10}%
                </p>
              </div>

              {/* Eligibility + result */}
              <div className={cn(
                'flex items-center justify-between rounded-xl border p-3',
                zakatNet >= nisab
                  ? 'bg-emerald-100/50 border-emerald-300'
                  : 'bg-slate-100 border-slate-200',
              )}>
                <span className="text-xs font-black uppercase tracking-widest">Zakat Eligibility</span>
                <Badge className={cn('font-black text-xs', zakatNet >= nisab ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-slate-500 hover:bg-slate-500')}>
                  {zakatNet >= nisab ? 'Eligible' : 'Not Eligible'}
                </Badge>
              </div>

              {zakatNet >= nisab ? (
                <div className="p-5 rounded-2xl bg-emerald-600 text-white text-center shadow-xl shadow-emerald-600/30">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">
                    Zakat Due ({Math.round(zakatRate * 1000) / 10}%)
                  </p>
                  <p className="text-3xl font-black">{rs(zakatDue)}</p>
                  <p className="text-xs mt-2 opacity-80 leading-relaxed">
                    Your zakatable assets exceed the Nisab. This amount is due annually on wealth held for one lunar year.
                  </p>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-slate-100 text-slate-600 border border-slate-200">
                  <p className="text-sm font-bold flex items-center gap-2">
                    <Info size={15} /> Not Eligible to Pay Zakat
                  </p>
                  <p className="text-xs mt-1.5 opacity-80">
                    Net zakatable assets ({rs(zakatNet)}) are below Nisab ({rs(nisab)}). Zakat is not obligatory at this time.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border/40 bg-muted/10 flex justify-end">
              <button onClick={() => setShowZakat(false)}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
