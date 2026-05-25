import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Printer, RefreshCw, Download, Receipt, Loader2,
  Undo2, X, AlertCircle, TrendingUp, CreditCard, Tag, Package
} from 'lucide-react';
import dayjs from 'dayjs';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn, formatInvoiceId } from '../lib/utils';
import { useNotifications } from '../components/NotificationProvider';
import { LoadMoreButton } from '../components/Pagination';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';

interface Sale {
  id: number;
  subtotal: number;
  discount: number;
  total: number;
  date_created: string;
  payment_method: string;
  items_summary: string;
  status: 'Completed' | 'Returned' | 'Cancelled';
  amount_paid?: number;
  remaining?: number;
  payment_status?: string;
  customer_id?: number;
  customer_name?: string;
}

interface Settings {
  store_name: string;
  store_phone: string;
  store_address: string;
  receipt_footer: string;
  store_logo: string;
  receipt_size?: string;
  invoice_style?: string;
  invoice_notes?: string;
}

const PAGE_SIZE = 50;
const fmtPKR = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-PK');

const saleStatusClass = (status?: string) => {
  if (status === 'Returned') return 'border-transparent bg-violet-600 text-white shadow-sm hover:bg-violet-600';
  if (status === 'Cancelled') return 'border-transparent bg-rose-600 text-white shadow-sm hover:bg-rose-600';
  return 'border-transparent bg-emerald-600 text-white shadow-sm hover:bg-emerald-600';
};

/**
 * BUG FIX: Walk-in (cash/online) customers always pay at the counter.
 * There is no "pay later" option for them. If a cash sale shows remaining > 0
 * but amount_paid is 0/undefined, it's a data-tracking issue — not real debt.
 * Only flag as Unpaid for explicit credit/loan type sales or confirmed partial payments.
 */
const isCreditMethod = (method: string | undefined) => {
  const m = (method || '').toLowerCase();
  return m === 'credit' || m === 'loan' || m === 'khata' || m === 'udhaar';
};

const hasRealDebt = (sale: Sale): boolean => {
  if (sale.status === 'Cancelled' || sale.status === 'Returned') return false;
  const remaining = sale.remaining ?? 0;
  if (remaining <= 0.5) return false;
  const amountPaid = sale.amount_paid ?? 0;
  const saleTotal = sale.total ?? 0;
  // Partial: amount_paid tracked OR remaining is less than total (something was paid)
  if (amountPaid > 0.5 || (saleTotal > 0 && remaining < saleTotal - 0.5)) return true;
  // No payment at all → credit method OR linked customer with full remaining (udhaar via any method)
  if (isCreditMethod(sale.payment_method)) return true;
  if (sale.customer_id) return true; // linked customer = real debt regardless of method
  return false;
};

const paymentStatus = (sale: Sale) => {
  if (sale.status === 'Cancelled' || sale.status === 'Returned') return null;

  const remaining = sale.remaining ?? 0;
  const amountPaid = sale.amount_paid ?? 0;
  const saleTotal = sale.total ?? 0;

  if (remaining > 0.5) {
    // Partial: either amount_paid is tracked, OR remaining < total (implies some was paid)
    const isPartial = amountPaid > 0.5 || (saleTotal > 0 && remaining < saleTotal - 0.5);
    if (isPartial) {
      return { label: 'Partial', className: 'border-transparent bg-amber-500 text-white shadow-sm hover:bg-amber-500' };
    }
    // Nothing paid at all — show Unpaid for credit/loan method
    if (isCreditMethod(sale.payment_method)) {
      return { label: 'Unpaid', className: 'border-transparent bg-rose-600 text-white shadow-sm hover:bg-rose-600' };
    }
    // Linked customer (udhaar via cash/online) → also real unpaid debt
    if (sale.customer_id) {
      return { label: 'Unpaid', className: 'border-transparent bg-rose-600 text-white shadow-sm hover:bg-rose-600' };
    }
    // True walk-in (no customer): cash paid at counter, safe to ignore
    return null;
  }

  // Fully paid or no remaining balance tracked
  if (amountPaid > 0 || sale.remaining !== undefined) {
    return { label: 'Paid', className: 'border-transparent bg-emerald-600 text-white shadow-sm hover:bg-emerald-600' };
  }
  return null;
};

export default function Transactions() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [settings, setSettings] = useState<Settings>({
    store_name: 'Restaurant', store_phone: '', store_address: '',
    receipt_footer: 'Thank you!', store_logo: '',
  });
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  const [returnReason, setReturnReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const [dateFilter, setDateFilter] = useState<'today' | 'weekly' | 'monthly' | 'custom'>('today');
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));

  const { addNotification } = useNotifications();
  const sentinelRef = useRef<HTMLTableRowElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Summary stats from loaded sales ─────────────────────────────────────────
  const summaryStats = useMemo(() => {
    const completed = sales.filter(s => s.status === 'Completed');
    const revenue = completed.reduce((sum, s) => sum + (s.total || 0), 0);
    const discounts = sales.reduce((sum, s) => sum + (s.discount || 0), 0);
    const debtCount = sales.filter(s => hasRealDebt(s)).length;
    return { revenue, discounts, debtCount, completedCount: completed.length };
  }, [sales]);

  // ── Load ──────────────────────────────────────────────────────────────────────
  const loadPage = useCallback(async (pageOffset: number, search: string, isReset = false) => {
    if (isReset) setLoading(true); else setLoadingMore(true);
    try {
      let activeStartDate: string | undefined;
      let activeEndDate: string | undefined;
      if (dateFilter === 'today') {
        activeStartDate = dayjs().startOf('day').toISOString();
        activeEndDate = dayjs().endOf('day').toISOString();
      } else if (dateFilter === 'weekly') {
        activeStartDate = dayjs().subtract(6, 'day').startOf('day').toISOString();
        activeEndDate = dayjs().endOf('day').toISOString();
      } else if (dateFilter === 'monthly') {
        activeStartDate = dayjs().subtract(29, 'day').startOf('day').toISOString();
        activeEndDate = dayjs().endOf('day').toISOString();
      } else if (dateFilter === 'custom') {
        activeStartDate = dayjs(startDate).startOf('day').toISOString();
        activeEndDate = dayjs(endDate).endOf('day').toISOString();
      }
      const res = await window.api.getSales({
        limit: PAGE_SIZE, offset: pageOffset,
        search: search || undefined,
        startDate: activeStartDate, endDate: activeEndDate,
      });
      if (res?.success && res.data) {
        const newRows = res.data as Sale[];
        setSales(prev => isReset ? newRows : [...prev, ...newRows]);
        setTotal(res.total ?? 0);
        setOffset(pageOffset + newRows.length);
        setHasMore(newRows.length === PAGE_SIZE);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [dateFilter, startDate, endDate]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchTerm]);

  useEffect(() => {
    setSales([]); setOffset(0); setHasMore(true);
    loadPage(0, debouncedSearch, true);
  }, [debouncedSearch, dateFilter, startDate, endDate, loadPage]);

  useEffect(() => { loadSettings(); }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading)
          loadPage(offset, debouncedSearch);
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, offset, debouncedSearch, loadPage]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const loadSettings = async () => {
    try {
      const res = await window.api.getSettings();
      if (res?.success && res.data) setSettings(res.data);
    } catch { }
  };

  const handleRefresh = () => {
    addNotification('Refreshing', 'Fetching latest transactions', 'info');
    setSales([]); setOffset(0); setHasMore(true);
    loadPage(0, debouncedSearch, true);
  };

  const handleStatusUpdate = async (saleId: number, newStatus: string) => {
    try {
      const res = await window.api.updateSaleStatus(saleId, newStatus);
      if (res.success) {
        setSales(prev => prev.map(s => s.id === saleId ? { ...s, status: newStatus as Sale['status'] } : s));
        addNotification('Status Updated', `Sale #${saleId} marked as ${newStatus}.`, 'success');
      } else {
        addNotification('Update Failed', res.error || 'Failed to update status', 'error');
      }
    } catch {
      addNotification('Error', 'Critical error updating status', 'error');
    }
  };

  const buildReceiptHtml = (sale: Sale, items: any[]) => {
    const itemsHtml = items.map((item: any) => `
      <div class="item"><span>${item.product_name} x${item.quantity}</span><span>${fmtPKR(item.price * item.quantity)}</span></div>
    `).join('');
    return `
      ${settings.store_logo ? `<img src="${settings.store_logo}" style="max-height:48px;display:block;margin:0 auto 6px"/>` : ''}
      <h2>${settings.store_name}</h2>
      ${settings.store_address ? `<p class="center">${settings.store_address}</p>` : ''}
      ${settings.store_phone ? `<p class="center">Tel: ${settings.store_phone}</p>` : ''}
      <div class="divider"></div>
      <p class="center" style="font-weight:bold;font-size:12px;">Invoice: ${formatInvoiceId(sale.id, sale.date_created)}</p>
      <p class="center" style="font-size:10px;margin-top:2px;color:#555;">${dayjs(sale.date_created.replace(' ', 'T')).format('DD MMM YYYY hh:mm A')}</p>
      <div class="divider"></div>
      ${itemsHtml}
      <div class="divider"></div>
      <div class="total-row" style="font-weight:normal;font-size:11px"><span>Subtotal</span><span>${fmtPKR(sale.subtotal || sale.total)}</span></div>
      ${(sale.discount || 0) > 0 ? `<div class="total-row" style="font-weight:normal;font-size:11px;color:red"><span>Discount</span><span>-${fmtPKR(sale.discount)}</span></div>` : ''}
      <div class="total-row"><span>Total</span><span>${fmtPKR(sale.total)}</span></div>
      <div class="total-row" style="font-weight:normal;font-size:11px"><span>Paid</span><span>${fmtPKR(sale.amount_paid !== undefined ? sale.amount_paid : sale.total)}</span></div>
      ${hasRealDebt(sale) ? `<div class="total-row" style="font-weight:bold;font-size:11px;color:red"><span>Remaining</span><span>${fmtPKR(sale.remaining!)}</span></div>` : ''}
      <div class="total-row" style="font-weight:normal;font-size:10px;margin-top:2px">
        <span>Payment</span><span>${sale.payment_method === 'online' ? 'ONLINE PAYMENT' : (sale.payment_method || 'cash').toUpperCase()}</span>
      </div>
      <div class="divider"></div>
      <div style="text-align:center;margin-top:6px;">
        <div style="font-size:11px;font-weight:bold;">${settings.receipt_footer}</div>
        <div style="font-size:9px;margin-top:6px;color:#555;">Software made by +923298748232</div>
      </div>
    `;
  };

  const buildFormalInvoiceHtml = (sale: Sale, items: any[]) => {
    const pkrNum = (n: number) => Math.round(n).toLocaleString('en-PK');
    const paidAmt = sale.amount_paid !== undefined ? sale.amount_paid : sale.total;
    const balAmt = sale.remaining !== undefined ? sale.remaining : 0;
    let balanceRow = '';
    if (balAmt > 0) balanceRow = `<tr><td class="label">BALANCE (CREDIT)</td><td class="value">PKR ${pkrNum(balAmt)}</td></tr>`;
    else if (balAmt < 0) balanceRow = `<tr><td class="label">CHANGE DUE</td><td class="value">PKR ${pkrNum(Math.abs(balAmt))}</td></tr>`;
    else balanceRow = `<tr><td class="label">BALANCE</td><td class="value">PKR 0</td></tr>`;
    const rowsHtml = items.map((item, idx) => `
      <tr class="item-row">
        <td class="center">${idx + 1}</td><td>${item.product_name}</td>
        <td class="center warranty-cell">—</td><td class="center">${item.quantity}</td>
        <td class="right">PKR ${pkrNum(item.price)}</td>
        <td class="right amount-col">PKR ${pkrNum(item.price * item.quantity)}</td>
      </tr>`).join('');
    const emptyCount = Math.max(0, 10 - items.length);
    const emptyRowsHtml = Array(emptyCount).fill(`<tr class="item-row empty-row"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>`).join('');
    const notesLines = (settings.invoice_notes || settings.receipt_footer || '').split('\n').filter(Boolean).map(l => `<div class="note-line">${l.replace(/^[•\-]\s*/, '')}</div>`).join('');
    const logoHtml = settings.store_logo ? `<img src="${settings.store_logo}" class="logo" alt="logo"/>` : '';
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Invoice ${formatInvoiceId(sale.id, sale.date_created)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}html,body{width:210mm;background:#fff;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif;font-size:11pt}
  .page{width:210mm;min-height:297mm;padding:12mm 14mm 10mm;display:flex;flex-direction:column}
  .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:8px;border-bottom:3px solid #cc0000;margin-bottom:10px}
  .brand{display:flex;align-items:center;gap:10px}.logo{height:52px;object-fit:contain}
  .store-name{font-size:20pt;font-weight:900;color:#cc0000;line-height:1.1}.store-sub{font-size:8pt;color:#555;margin-top:3px;line-height:1.5}
  .invoice-meta{text-align:right}.invoice-title{font-size:18pt;font-weight:900;color:#1a1a1a;letter-spacing:2px}
  .meta-row{font-size:9pt;color:#333;margin-top:4px}.meta-row span{font-weight:bold}
  table{width:100%;border-collapse:collapse;margin-top:6px}thead tr{background:#cc0000;color:#fff}
  thead th{padding:7px 6px;font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border:1px solid #aaa;white-space:nowrap}
  .item-row td{border:1px solid #ccc;padding:6px;font-size:9.5pt;vertical-align:middle}.item-row:nth-child(even){background:#fafafa}
  .empty-row td{height:22px}.center{text-align:center}.right{text-align:right}.amount-col{font-weight:700}.warranty-cell{color:#888;font-size:8pt}
  .bottom{display:flex;justify-content:space-between;gap:16px;margin-top:10px;align-items:flex-start}
  .notes-box{flex:1;border:1px solid #e0e0e0;border-radius:4px;padding:9px 11px;background:#fffbf8}
  .notes-title{font-size:8pt;font-weight:700;color:#cc0000;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}
  .note-line{font-size:8pt;color:#c00;line-height:1.7;padding-left:8px;position:relative}.note-line::before{content:"•";position:absolute;left:0}
  .summary{min-width:200px}.summary table{width:100%}.summary td{border:1px solid #ccc;padding:5px 9px;font-size:9.5pt}
  .summary .label{color:#333}.summary .value{text-align:right;font-weight:600}.summary .discount-row td{color:#cc0000}
  .summary .grand-row td{font-weight:800;font-size:10.5pt;background:#f5f5f5}
  .footer{margin-top:14px;border-top:2px solid #cc0000;padding-top:8px;display:flex;justify-content:space-between;align-items:flex-end;font-size:8pt;color:#555}
  .footer .sign-line{border-bottom:1px solid #999;width:160px;margin-top:14px}.footer .contact{text-align:right;line-height:1.7}
  @media print{html,body{width:210mm}.page{padding:8mm 12mm}}
</style></head><body><div class="page">
  <div class="header"><div class="brand">${logoHtml}<div><div class="store-name">${settings.store_name||'Store Name'}</div><div class="store-sub">${settings.store_address?settings.store_address+'<br/>':''}${settings.store_phone?'Tel: '+settings.store_phone:''}</div></div></div>
  <div class="invoice-meta"><div class="invoice-title">INVOICE</div><div class="meta-row"><span>No:</span> ${formatInvoiceId(sale.id,sale.date_created)}</div><div class="meta-row"><span>Date:</span> ${dayjs(sale.date_created).format('YYYY-MM-DD')}</div></div></div>
  <table><thead><tr><th style="width:36px">S.No</th><th style="text-align:left">Description</th><th style="width:68px">Warranty</th><th style="width:40px">Qty</th><th style="width:96px">U-Price</th><th style="width:104px">Amount</th></tr></thead>
  <tbody>${rowsHtml}${emptyRowsHtml}</tbody></table>
  <div class="bottom"><div class="notes-box"><div class="notes-title">Terms &amp; Notes</div>${notesLines||'<div class="note-line" style="color:#aaa;padding-left:0">No notes set.</div>'}</div>
  <div class="summary"><table><tr><td class="label">AMOUNT</td><td class="value">PKR ${pkrNum(sale.subtotal||sale.total)}</td></tr><tr class="discount-row"><td class="label">DISCOUNT</td><td class="value">${Number(sale.discount)>0?'- PKR '+pkrNum(Number(sale.discount)):'—'}</td></tr><tr class="grand-row"><td class="label">GRAND TOTAL</td><td class="value">PKR ${pkrNum(sale.total)}</td></tr><tr><td class="label">PAID</td><td class="value">PKR ${pkrNum(paidAmt)}</td></tr>${balanceRow}</table></div></div>
  <div class="footer"><div><div style="font-size:8pt;color:#888;margin-bottom:2px">Authorized Signature</div><div class="sign-line"></div></div>
  <div class="contact">${settings.store_name||''}<br/>${settings.store_address?settings.store_address+'<br/>':''}${settings.store_phone?'Tel: '+settings.store_phone:''}</div></div>
</div></body></html>`;
  };

  const buildInvoiceHtml = (sale: Sale, items: any[]) =>
    settings.invoice_style === 'formal' ? buildFormalInvoiceHtml(sale, items) : buildReceiptHtml(sale, items);

  const reprintReceipt = async (sale: Sale) => {
    const res = await window.api.getSaleItems(sale.id);
    const items = (res?.success && res.data) ? res.data : [];
    await window.api.printInvoice(buildInvoiceHtml(sale, items));
    addNotification('Printed', 'Invoice queued to printer.', 'success');
  };

  const saveReceiptPdf = async (sale: Sale) => {
    const res = await window.api.getSaleItems(sale.id);
    const items = res?.success && res.data ? res.data : [];
    await window.api.saveInvoicePdf(buildInvoiceHtml(sale, items));
    addNotification('PDF Saved', 'Invoice PDF created successfully.', 'success');
  };

  const openReturnModal = async (sale: Sale) => {
    setSelectedSale(sale);
    setLoading(true);
    try {
      const res = await window.api.getSaleItems(sale.id);
      if (res.success) {
        setSaleItems(res.data);
        const initialQtys: Record<number, number> = {};
        res.data.forEach((item: any) => { initialQtys[item.id] = 0; });
        setReturnQuantities(initialQtys);
        setReturnModalOpen(true);
      }
    } catch { addNotification('Error', 'Could not load sale items', 'error'); }
    finally { setLoading(false); }
  };

  const handleReturnSubmit = async () => {
    if (!selectedSale) return;
    const itemsToReturn = saleItems
      .filter(item => returnQuantities[item.id] > 0)
      .map(item => ({
        product_id: item.product_id, product_name: item.product_name,
        quantity: returnQuantities[item.id], price: item.price,
      }));
    if (itemsToReturn.length === 0) {
      addNotification('Warning', 'Please select at least one item to return', 'warning');
      return;
    }
    const totalRefunded = itemsToReturn.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setIsSubmittingReturn(true);
    try {
      const res = await window.api.createSaleReturn({
        sale_id: selectedSale.id, items: itemsToReturn,
        reason: returnReason, total_returned: totalRefunded,
      });
      if (res.success) {
        addNotification('Success', 'Return processed successfully', 'success');
        setReturnModalOpen(false);
        handleRefresh();
      } else {
        addNotification('Error', res.error || 'Failed to process return', 'error');
      }
    } catch { addNotification('Error', 'Critical error processing return', 'error'); }
    finally { setIsSubmittingReturn(false); }
  };

  // ── JSX ────────────────────────────────────────────────────────────────────────
  const DATE_FILTERS = [
    { key: 'today' as const, label: 'Today' },
    { key: 'weekly' as const, label: 'Weekly' },
    { key: 'monthly' as const, label: 'Monthly' },
    { key: 'custom' as const, label: 'Custom' },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-[1400px]">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Receipt size={18} className="text-primary" />
            </div>
            <h1 className="text-xl font-black tracking-tight">Transactions</h1>
          </div>
          <p className="text-xs text-muted-foreground/70 pl-[46px]">
            {total > 0
              ? <span><strong>{sales.length.toLocaleString()}</strong> of <strong>{total.toLocaleString()}</strong> transactions loaded</span>
              : 'Complete history of all point of sale transactions'}
          </p>
        </div>
        <Button
          variant="outline" size="icon"
          onClick={handleRefresh}
          className="h-9 w-9 rounded-xl border-border/60"
          title="Refresh"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Completed Sales', value: summaryStats.completedCount.toLocaleString(), icon: Receipt, iconCls: 'text-blue-500', bgCls: 'bg-blue-500/10' },
          { label: 'Revenue (Loaded)', value: fmtPKR(summaryStats.revenue), icon: TrendingUp, iconCls: 'text-emerald-500', bgCls: 'bg-emerald-500/10' },
          { label: 'Total Discounts', value: fmtPKR(summaryStats.discounts), icon: Tag, iconCls: 'text-amber-500', bgCls: 'bg-amber-500/10' },
          { label: 'Pending Payments', value: summaryStats.debtCount.toLocaleString(), icon: AlertCircle, iconCls: summaryStats.debtCount > 0 ? 'text-destructive' : 'text-emerald-500', bgCls: summaryStats.debtCount > 0 ? 'bg-destructive/10' : 'bg-emerald-500/10' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.25 }}
            className="rounded-xl border border-border/60 bg-card p-3.5"
          >
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mb-2', kpi.bgCls)}>
              <kpi.icon size={13} className={kpi.iconCls} />
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.label}</p>
            <p className={cn('text-sm font-black mt-0.5', kpi.iconCls)}>{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Main card ── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">

        {/* Filter bar */}
        <div className="p-4 border-b border-border/60 bg-muted/5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={14} />
              <Input
                type="text"
                placeholder="Search by ID, payment method, or item name…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm bg-background border-border/60"
              />
            </div>

            {/* Date filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-background border border-border/60 rounded-xl p-0.5">
                {DATE_FILTERS.map((f) => (
                  <Button
                    key={f.key}
                    variant={dateFilter === f.key ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setDateFilter(f.key)}
                    className={cn(
                      'h-7 px-3 text-xs font-semibold rounded-lg transition-all',
                      dateFilter !== f.key && 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>

              <AnimatePresence>
                {dateFilter === 'custom' && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2"
                  >
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 w-32 text-xs bg-background border-border/60 rounded-lg" />
                    <span className="text-xs text-muted-foreground font-medium">to</span>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 w-32 text-xs bg-background border-border/60 rounded-lg" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20 border-b border-border/60">
                <TableHead className="w-44 text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">Invoice No</TableHead>
                <TableHead className="w-32 text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">Date &amp; Time</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">Items</TableHead>
                <TableHead className="w-24 text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">Method</TableHead>
                <TableHead className="w-36 text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">Status</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">Subtotal</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">Disc.</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">Total</TableHead>
                <TableHead className="text-right pr-5 w-28 text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Loader2 size={22} className="animate-spin text-primary/50" />
                      <p className="text-sm">Loading transactions…</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center">
                        <Receipt size={24} className="opacity-30" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">No transactions found</p>
                        {searchTerm && <p className="text-xs mt-0.5">No results for "{searchTerm}"</p>}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {sales.map((s) => {
                    const ps = paymentStatus(s);
                    const showDebt = hasRealDebt(s);
                    return (
                      <TableRow key={s.id} className="group hover:bg-muted/20 transition-colors border-b border-border/40">
                        {/* Invoice ID */}
                        <TableCell>
                          <span className="font-mono text-xs font-bold text-foreground/80 bg-muted/40 px-1.5 py-0.5 rounded-md">
                            {formatInvoiceId(s.id, s.date_created)}
                          </span>
                        </TableCell>

                        {/* Date */}
                        <TableCell>
                          <p className="text-xs font-semibold text-foreground/90">{dayjs(s.date_created).format('DD MMM YYYY')}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{dayjs(s.date_created).format('hh:mm A')}</p>
                        </TableCell>

                        {/* Items summary */}
                        <TableCell className="max-w-[180px]">
                          <p className="truncate text-xs text-muted-foreground leading-relaxed" title={s.items_summary}>
                            {s.items_summary || '—'}
                          </p>
                        </TableCell>

                        {/* Payment method */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'uppercase text-[10px] font-bold',
                              s.payment_method === 'online'
                                ? 'border-transparent bg-blue-600 text-white shadow-sm hover:bg-blue-600'
                                : isCreditMethod(s.payment_method)
                                ? 'border-transparent bg-violet-600 text-white shadow-sm hover:bg-violet-600'
                                : 'border-transparent bg-slate-600 text-white shadow-sm hover:bg-slate-600'
                            )}
                          >
                            {s.payment_method || 'cash'}
                          </Badge>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <div className="flex flex-col gap-1.5">
                            <Select value={s.status || 'Completed'} onValueChange={(val) => handleStatusUpdate(s.id, val)}>
                              <SelectTrigger className={cn(
                                'h-7 w-[118px] rounded-lg text-xs font-bold border shadow-sm [&>svg]:text-white',
                                saleStatusClass(s.status)
                              )}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Completed" className="text-xs font-medium">Completed</SelectItem>
                                <SelectItem value="Returned" className="text-xs font-medium">Returned</SelectItem>
                                <SelectItem value="Cancelled" className="text-xs font-medium">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>

                            {ps && (
                              <Badge variant="outline" className={cn('w-[118px] justify-center text-[9px] font-bold py-0.5 h-5', ps.className)}>
                                {ps.label}
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Subtotal */}
                        <TableCell className="text-right text-xs text-muted-foreground font-mono">
                          {fmtPKR(s.subtotal || s.total)}
                        </TableCell>

                        {/* Discount */}
                        <TableCell className="text-right text-xs font-mono">
                          {s.discount > 0
                            ? <span className="text-destructive font-semibold">−{fmtPKR(s.discount)}</span>
                            : <span className="text-muted-foreground/40">—</span>}
                        </TableCell>

                        {/* Total */}
                        <TableCell className="text-right">
                          <p className="font-black text-sm text-primary">{fmtPKR(s.total)}</p>
                          {showDebt && (
                            <p className="text-[10px] text-destructive font-bold mt-0.5 whitespace-nowrap">
                              Owed: {fmtPKR(s.remaining!)}
                            </p>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right pr-5">
                          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => reprintReceipt(s)}
                              className="h-7 w-7 rounded-lg text-blue-500 hover:bg-blue-500/10 hover:text-blue-500"
                              title="Print"
                            >
                              <Printer size={13} />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => saveReceiptPdf(s)}
                              className="h-7 w-7 rounded-lg text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-500"
                              title="Save PDF"
                            >
                              <Download size={13} />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => openReturnModal(s)}
                              className="h-7 w-7 rounded-lg text-amber-500 hover:bg-amber-500/10 hover:text-amber-500 disabled:opacity-30"
                              title="Return Items"
                              disabled={s.status === 'Returned' || s.status === 'Cancelled'}
                            >
                              <Undo2 size={13} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* Load-more row */}
                  {hasMore && (
                    <TableRow className="pointer-events-auto">
                      <TableCell colSpan={9} className="py-2 text-center">
                        <LoadMoreButton
                          hasMore={hasMore}
                          onLoadMore={() => loadPage(offset, debouncedSearch)}
                          showing={sales.length}
                          total={total}
                        />
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Sentinel row */}
                  <TableRow ref={sentinelRef} className="pointer-events-none">
                    <TableCell colSpan={9} className="py-2 text-center">
                      {loadingMore && (
                        <div className="flex items-center justify-center gap-2 text-muted-foreground/60 text-xs py-2">
                          <Loader2 size={12} className="animate-spin" />
                          Loading more transactions…
                        </div>
                      )}
                      {!hasMore && sales.length > 0 && (
                        <p className="text-muted-foreground/40 text-xs py-2">
                          All {total.toLocaleString()} transactions loaded.
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          RETURN MODAL
      ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {returnModalOpen && selectedSale && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 14 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 14 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="w-full max-w-2xl"
            >
              <div className="rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">

                {/* Modal header */}
                <div className="bg-primary p-5 flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-black text-primary-foreground flex items-center gap-2">
                      <Undo2 size={20} /> Return Items
                    </h2>
                    <p className="text-primary-foreground/70 text-xs mt-0.5 font-mono">
                      {formatInvoiceId(selectedSale.id, selectedSale.date_created)}
                    </p>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="rounded-full hover:bg-white/10 text-primary-foreground"
                    onClick={() => setReturnModalOpen(false)}
                  >
                    <X size={18} />
                  </Button>
                </div>

                {/* Modal body */}
                <div className="p-5 space-y-5">
                  {/* Items table */}
                  <div className="rounded-xl border border-border/60 overflow-hidden max-h-[40vh] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="text-xs font-bold uppercase">Product</TableHead>
                          <TableHead className="text-center text-xs font-bold uppercase">Sold</TableHead>
                          <TableHead className="text-center text-xs font-bold uppercase">Prev. Return</TableHead>
                          <TableHead className="text-right text-xs font-bold uppercase">Price</TableHead>
                          <TableHead className="text-right w-32 text-xs font-bold uppercase">Qty to Return</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {saleItems.map((item) => {
                          const availableToReturn = item.quantity - (item.quantity_returned || 0);
                          return (
                            <TableRow key={item.id} className="hover:bg-muted/20">
                              <TableCell className="font-semibold text-sm">{item.product_name}</TableCell>
                              <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                              <TableCell className="text-center text-amber-600 dark:text-amber-400 font-bold text-sm">{item.quantity_returned || 0}</TableCell>
                              <TableCell className="text-right text-sm font-mono">{fmtPKR(item.price)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <Input
                                    type="text"
                                    className={cn(
                                      'h-8 w-20 text-right font-bold border-primary/20',
                                      availableToReturn === 0 && 'opacity-50 cursor-not-allowed bg-muted'
                                    )}
                                    value={returnQuantities[item.id] || ''}
                                    disabled={availableToReturn <= 0}
                                    onChange={(e) => {
                                      const raw = e.target.value.replace(/[^0-9]/g, '');
                                      const val = Math.min(availableToReturn, parseInt(raw) || 0);
                                      setReturnQuantities({ ...returnQuantities, [item.id]: val });
                                    }}
                                  />
                                  {availableToReturn > 0 && (
                                    <p className="text-[10px] text-muted-foreground/60">Max: {availableToReturn}</p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="text-xs font-bold flex items-center gap-1.5 text-muted-foreground mb-2">
                      <AlertCircle size={12} className="text-amber-500" /> Reason for Return
                    </label>
                    <Input
                      placeholder="e.g. Damaged item, customer change of mind…"
                      className="bg-muted/10"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                    />
                  </div>

                  {/* Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-border/60">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Total Refund</p>
                      <p className="text-2xl font-black text-primary mt-0.5">
                        {fmtPKR(saleItems.reduce((sum, item) => sum + (item.price * (returnQuantities[item.id] || 0)), 0))}
                      </p>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                      <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setReturnModalOpen(false)}>Cancel</Button>
                      <Button
                        className="flex-1 sm:flex-none gap-2 font-semibold"
                        onClick={handleReturnSubmit}
                        disabled={isSubmittingReturn || saleItems.reduce((sum, item) => sum + (returnQuantities[item.id] || 0), 0) === 0}
                      >
                        {isSubmittingReturn ? <Loader2 className="animate-spin" size={15} /> : <Undo2 size={15} />}
                        Process Return
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
