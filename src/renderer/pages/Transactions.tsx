import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Printer, RefreshCw, ChevronDown, Download, Receipt, Loader2, Undo2, X, AlertCircle } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

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

const paymentStatus = (sale: Sale) => {
  if (sale.status === 'Cancelled') return null;
  if (sale.remaining !== undefined && sale.remaining > 0.5) {
    return sale.amount_paid !== undefined && sale.amount_paid > 0.5
      ? { label: 'Partial', className: 'border-transparent bg-amber-500 text-white shadow-sm hover:bg-amber-500' }
      : { label: 'Unpaid', className: 'border-transparent bg-rose-600 text-white shadow-sm hover:bg-rose-600' };
  }
  return { label: 'Paid', className: 'border-transparent bg-emerald-600 text-white shadow-sm hover:bg-emerald-600' };
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
  const [settings, setSettings] = useState<Settings>({ store_name: 'Restaurant', store_phone: '', store_address: '', receipt_footer: 'Thank you!', store_logo: '' });
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

  // Sentinel ref for IntersectionObserver
  const sentinelRef = useRef<HTMLTableRowElement>(null);
  // Search debounce timer
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPage = useCallback(async (pageOffset: number, search: string, isReset = false) => {
    if (isReset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let activeStartDate: string | undefined = undefined;
      let activeEndDate: string | undefined = undefined;

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
        limit: PAGE_SIZE,
        offset: pageOffset,
        search: search || undefined,
        startDate: activeStartDate,
        endDate: activeEndDate
      });
      if (res?.success && res.data) {
        const newRows = res.data as Sale[];
        setSales(prev => isReset ? newRows : [...prev, ...newRows]);
        setTotal(res.total ?? 0);
        setOffset(pageOffset + newRows.length);
        setHasMore(newRows.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [dateFilter, startDate, endDate]);

  // Debounce the search input - 400ms after user stops typing
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchTerm]);

  // Reset and reload when search or date filter changes
  useEffect(() => {
    setSales([]);
    setOffset(0);
    setHasMore(true);
    loadPage(0, debouncedSearch, true);
  }, [debouncedSearch, dateFilter, startDate, endDate, loadPage]);

  useEffect(() => {
    loadSettings();
  }, []);

  // IntersectionObserver: when the sentinel row enters the viewport, load next page
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadPage(offset, debouncedSearch);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, offset, debouncedSearch, loadPage]);

  const loadSettings = async () => {
    try {
      const res = await window.api.getSettings();
      if (res?.success && res.data) setSettings(res.data);
    } catch { }
  };

  const handleRefresh = () => {
    addNotification('Refreshing', 'Fetching latest transactions', 'info');
    setSales([]);
    setOffset(0);
    setHasMore(true);
    loadPage(0, debouncedSearch, true);
  };

  const handleStatusUpdate = async (saleId: number, newStatus: string) => {
    try {
      const res = await window.api.updateSaleStatus(saleId, newStatus);
      if (res.success) {
        // Update locally without full reload
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
      <div class="item">
        <span>${item.product_name} x${item.quantity}</span>
        <span>${fmtPKR(item.price * item.quantity)}</span>
      </div>
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
      ${(sale.remaining !== undefined && sale.remaining > 0.5) ? `<div class="total-row" style="font-weight:bold;font-size:11px;color:red"><span>Remaining</span><span>${fmtPKR(sale.remaining)}</span></div>` : ''}
      <div class="total-row" style="font-weight:normal;font-size:10px;margin-top:2px">
        <span>Payment</span><span>${sale.payment_method === 'online' ? 'ONLINE PAYMENT' : (sale.payment_method || 'cash').toUpperCase()}</span>
      </div>
      <div class="divider"></div>
      <div style="text-align: center; margin-top: 6px;">
        <div style="font-size: 11px; font-weight: bold;">${settings.receipt_footer}</div>
        <div style="font-size: 9px; margin-top: 6px; color: #555;">Software made by +923298748232</div>
      </div>
    `;
  };

  const buildFormalInvoiceHtml = (sale: Sale, items: any[]) => {
    const pkrNum = (n: number) => Math.round(n).toLocaleString('en-PK');
    const paidAmt = sale.amount_paid !== undefined ? sale.amount_paid : sale.total;
    const balAmt = sale.remaining !== undefined ? sale.remaining : 0;

    let balanceRow = '';
    if (balAmt > 0) {
      balanceRow = `<tr><td class="label">BALANCE (CREDIT)</td><td class="value">PKR ${pkrNum(balAmt)}</td></tr>`;
    } else if (balAmt < 0) {
      balanceRow = `<tr><td class="label">CHANGE DUE</td><td class="value">PKR ${pkrNum(Math.abs(balAmt))}</td></tr>`;
    } else {
      balanceRow = `<tr><td class="label">BALANCE</td><td class="value">PKR 0</td></tr>`;
    }

    const rowsHtml = items.map((item, idx) => `
      <tr class="item-row">
        <td class="center">${idx + 1}</td>
        <td>${item.product_name}</td>
        <td class="center warranty-cell">—</td>
        <td class="center">${item.quantity}</td>
        <td class="right">PKR ${pkrNum(item.price)}</td>
        <td class="right amount-col">PKR ${pkrNum(item.price * item.quantity)}</td>
      </tr>
    `).join('');

    const emptyCount = Math.max(0, 10 - items.length);
    const emptyRowsHtml = Array(emptyCount).fill(`
      <tr class="item-row empty-row">
        <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td>
      </tr>
    `).join('');

    const notesLines = (settings.invoice_notes || settings.receipt_footer || '')
      .split('\n').filter(Boolean)
      .map(l => `<div class="note-line">${l.replace(/^[•\-]\s*/, '')}</div>`).join('');

    const logoHtml = settings.store_logo
      ? `<img src="${settings.store_logo}" class="logo" alt="logo"/>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Invoice ${formatInvoiceId(sale.id, sale.date_created)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 210mm;
    background: #fff;
    color: #1a1a1a;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 12mm 14mm 10mm;
    display: flex;
    flex-direction: column;
  }
  /* ── Header ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 8px;
    border-bottom: 3px solid #cc0000;
    margin-bottom: 10px;
  }
  .brand { display: flex; align-items: center; gap: 10px; }
  .logo { height: 52px; object-fit: contain; }
  .store-name { font-size: 20pt; font-weight: 900; color: #cc0000; line-height: 1.1; }
  .store-sub { font-size: 8pt; color: #555; margin-top: 3px; line-height: 1.5; }
  .invoice-meta { text-align: right; }
  .invoice-title { font-size: 18pt; font-weight: 900; color: #1a1a1a; letter-spacing: 2px; }
  .meta-row { font-size: 9pt; color: #333; margin-top: 4px; }
  .meta-row span { font-weight: bold; }
  /* ── Items Table ── */
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  thead tr { background: #cc0000; color: #fff; }
  thead th {
    padding: 7px 6px;
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 1px solid #aaa;
    white-space: nowrap;
  }
  .item-row td {
    border: 1px solid #ccc;
    padding: 6px 6px;
    font-size: 9.5pt;
    vertical-align: middle;
  }
  .item-row:nth-child(even) { background: #fafafa; }
  .empty-row td { height: 22px; }
  .center { text-align: center; }
  .right { text-align: right; }
  .amount-col { font-weight: 700; }
  .warranty-cell { color: #888; font-size: 8pt; }
  /* ── Bottom Section ── */
  .bottom { display: flex; justify-content: space-between; gap: 16px; margin-top: 10px; align-items: flex-start; }
  /* Notes */
  .notes-box {
    flex: 1;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 9px 11px;
    background: #fffbf8;
  }
  .notes-title { font-size: 8pt; font-weight: 700; color: #cc0000; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
  .note-line { font-size: 8pt; color: #c00; line-height: 1.7; padding-left: 8px; position: relative; }
  .note-line::before { content: "•"; position: absolute; left: 0; }
  /* Summary */
  .summary { min-width: 200px; }
  .summary table { width: 100%; }
  .summary td {
    border: 1px solid #ccc;
    padding: 5px 9px;
    font-size: 9.5pt;
  }
  .summary .label { color: #333; }
  .summary .value { text-align: right; font-weight: 600; }
  .summary .discount-row td { color: #cc0000; }
  .summary .grand-row td { font-weight: 800; font-size: 10.5pt; background: #f5f5f5; }
  /* Footer */
  .footer {
    margin-top: 14px;
    border-top: 2px solid #cc0000;
    padding-top: 8px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 8pt;
    color: #555;
  }
  .footer .sign-line { border-bottom: 1px solid #999; width: 160px; margin-top: 14px; }
  .footer .contact { text-align: right; line-height: 1.7; }
  @media print {
    html, body { width: 210mm; }
    .page { padding: 8mm 12mm; }
  }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="brand">
      ${logoHtml}
      <div>
        <div class="store-name">${settings.store_name || 'Store Name'}</div>
        <div class="store-sub">
          ${settings.store_address ? `${settings.store_address}<br/>` : ''}
          ${settings.store_phone ? `Tel: ${settings.store_phone}` : ''}
        </div>
      </div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">INVOICE</div>
      <div class="meta-row"><span>No:</span> ${formatInvoiceId(sale.id, sale.date_created)}</div>
      <div class="meta-row"><span>Date:</span> ${dayjs(sale.date_created).format('YYYY-MM-DD')}</div>
    </div>
  </div>

  <!-- Items Table -->
  <table>
    <thead>
      <tr>
        <th style="width:36px">S.No</th>
        <th style="text-align:left">Description</th>
        <th style="width:68px">Warranty</th>
        <th style="width:40px">Qty</th>
        <th style="width:96px">U-Price</th>
        <th style="width:104px">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      ${emptyRowsHtml}
    </tbody>
  </table>

  <!-- Bottom: Notes + Summary -->
  <div class="bottom">
    <div class="notes-box">
      <div class="notes-title">Terms &amp; Notes</div>
      ${notesLines || '<div class="note-line" style="color:#aaa;padding-left:0">No notes set. Add them in Settings → Invoice Notes.</div>'}
    </div>
    <div class="summary">
      <table>
        <tr><td class="label">AMOUNT</td><td class="value">PKR ${pkrNum(sale.subtotal || sale.total)}</td></tr>
        <tr class="discount-row"><td class="label">DISCOUNT</td><td class="value">${Number(sale.discount) > 0 ? '- PKR ' + pkrNum(Number(sale.discount)) : '—'}</td></tr>
        <tr class="grand-row"><td class="label">GRAND TOTAL</td><td class="value">PKR ${pkrNum(sale.total)}</td></tr>
        <tr><td class="label">PAID</td><td class="value">PKR ${pkrNum(paidAmt)}</td></tr>
        ${balanceRow}
      </table>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>
      <div style="font-size:8pt;color:#888;margin-bottom:2px">Authorized Signature</div>
      <div class="sign-line"></div>
    </div>
    <div class="contact">
      ${settings.store_name || ''}<br/>
      ${settings.store_address ? settings.store_address + '<br/>' : ''}
      ${settings.store_phone ? 'Tel: ' + settings.store_phone : ''}
    </div>
  </div>
</div>
</body>
</html>`;
  };

  const buildInvoiceHtml = (sale: Sale, items: any[]) => {
    if (settings.invoice_style === 'formal') {
      return buildFormalInvoiceHtml(sale, items);
    }
    return buildReceiptHtml(sale, items);
  };

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
    } catch (err) {
      addNotification("Error", "Could not load sale items", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReturnSubmit = async () => {
    if (!selectedSale) return;

    const itemsToReturn = saleItems
      .filter(item => returnQuantities[item.id] > 0)
      .map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: returnQuantities[item.id],
        price: item.price
      }));

    if (itemsToReturn.length === 0) {
      addNotification("Warning", "Please select at least one item to return", "warning");
      return;
    }

    const totalRefunded = itemsToReturn.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    setIsSubmittingReturn(true);
    try {
      const res = await window.api.createSaleReturn({
        sale_id: selectedSale.id,
        items: itemsToReturn,
        reason: returnReason,
        total_returned: totalRefunded
      });

      if (res.success) {
        addNotification("Success", "Return processed successfully", "success");
        setReturnModalOpen(false);
        handleRefresh();
      } else {
        addNotification("Error", res.error || "Failed to process return", "error");
      }
    } catch (err) {
      addNotification("Error", "Critical error processing return", "error");
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in max-w-[1400px]">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total > 0 ? (
              <span>Showing <strong>{sales.length}</strong> of <strong>{total.toLocaleString()}</strong> transactions</span>
            ) : (
              'Complete history of all point of sale transactions'
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={handleRefresh} className="h-12 w-12 rounded-xl border-border bg-card">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="p-4 border-b bg-muted/20">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
              <Input
                type="text"
                placeholder="Search by ID, payment method, or item name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 w-full bg-background"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-xl border bg-background p-1 shadow-xs">
                {(['today', 'weekly', 'monthly', 'custom'] as const).map((filter) => (
                  <Button
                    key={filter}
                    variant={dateFilter === filter ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setDateFilter(filter)}
                    className={cn(
                      "h-8 rounded-lg px-3 text-xs font-semibold capitalize transition-all",
                      dateFilter === filter ? "shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {filter === 'today' ? 'Today' : filter === 'weekly' ? 'Weekly' : filter === 'monthly' ? 'Monthly' : 'Custom'}
                  </Button>
                ))}
              </div>

              {dateFilter === 'custom' && (
                <div className="flex items-center gap-2 animate-in slide-in-from-right-3 duration-300">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 w-36 text-xs bg-background rounded-lg border-border"
                  />
                  <span className="text-muted-foreground text-xs font-semibold">to</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 w-36 text-xs bg-background rounded-lg border-border"
                  />
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-44">Invoice No</TableHead>
                <TableHead className="w-32">Date &amp; Time</TableHead>
                <TableHead className="max-w-[200px]">Items</TableHead>
                <TableHead className="w-24">Method</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right font-bold text-foreground">Total</TableHead>
                <TableHead className="text-right pr-6 w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={24} className="animate-spin text-primary opacity-50" />
                      <p>Loading transactions...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <Receipt size={40} className="opacity-20" />
                      <p>No transactions found{searchTerm ? ` for "${searchTerm}"` : ''}.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {sales.map((s) => (
                    <TableRow key={s.id} className="group">
                      <TableCell className="font-mono text-xs font-bold text-foreground/80">{formatInvoiceId(s.id, s.date_created)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{dayjs(s.date_created).format('DD MMM YYYY')}</span>
                          <span className="text-xs text-muted-foreground">{dayjs(s.date_created).format('hh:mm A')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px]">
                        <p className="truncate text-xs leading-relaxed" title={s.items_summary}>{s.items_summary || '-'}</p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "uppercase text-[10px] font-semibold",
                            s.payment_method === 'online'
                              ? "border-transparent bg-blue-600 text-white shadow-sm hover:bg-blue-600"
                              : "border-transparent bg-slate-600 text-white shadow-sm hover:bg-slate-600"
                          )}
                        >
                          {s.payment_method === 'online' ? 'Online' : s.payment_method}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <Select
                            value={s.status || 'Completed'}
                            onValueChange={(val) => handleStatusUpdate(s.id, val)}
                          >
                            <SelectTrigger className={cn(
                              "h-8 w-[130px] rounded-md text-xs font-semibold border shadow-sm [&>svg]:text-white",
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

                          {paymentStatus(s) && (
                            <Badge variant="outline" className={cn("w-[130px] justify-center text-[10px] font-semibold py-0.5", paymentStatus(s)?.className)}>
                              {paymentStatus(s)?.label}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">{fmtPKR(s.subtotal || s.total)}</TableCell>
                      <TableCell className="text-right text-destructive text-xs">{s.discount > 0 ? `-${fmtPKR(s.discount)}` : '-'}</TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        <div>{fmtPKR(s.total)}</div>
                        {s.remaining !== undefined && s.remaining > 0.5 && s.status !== 'Cancelled' && (
                          <div className="text-[10px] text-destructive dark:text-red-400 font-bold whitespace-nowrap mt-0.5">
                            Unpaid: {fmtPKR(s.remaining)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => reprintReceipt(s)} className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Reprint Receipt">
                            <Printer size={15} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => saveReceiptPdf(s)} className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" title="Download PDF">
                            <Download size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openReturnModal(s)}
                            className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                            title="Return Items"
                            disabled={s.status === 'Returned'}
                          >
                            <Undo2 size={15} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Load more button - explicit click trigger */}
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

                  {/* Sentinel row — IntersectionObserver watches this to trigger next page load */}
                  <TableRow ref={sentinelRef} className="pointer-events-none">
                    <TableCell colSpan={9} className="py-2 text-center">
                      {loadingMore && (
                        <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs py-2">
                          <Loader2 size={14} className="animate-spin" />
                          <span>Loading more transactions...</span>
                        </div>
                      )}
                      {!hasMore && sales.length > 0 && (
                        <p className="text-muted-foreground/50 text-xs py-2">
                          All {total.toLocaleString()} transactions loaded.
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Return Modal */}
      {returnModalOpen && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <Card className="w-full max-w-2xl shadow-2xl border-none overflow-hidden animate-in zoom-in-95 duration-300">
            <CardHeader className="bg-primary text-primary-foreground p-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Undo2 size={24} /> Return Items for {formatInvoiceId(selectedSale.id, selectedSale.date_created)}
                </CardTitle>
                <CardDescription className="text-primary-foreground/70">
                  Select items and quantities to return to stock.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10" onClick={() => setReturnModalOpen(false)}>
                <X size={20} />
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="rounded-xl border bg-muted/20 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Product Name</TableHead>
                      <TableHead className="text-center">Sold</TableHead>
                      <TableHead className="text-center">Prev. Returned</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right w-32">Qty to Return</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saleItems.map((item) => {
                      const availableToReturn = item.quantity - (item.quantity_returned || 0);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-center text-amber-600 font-bold">{item.quantity_returned || 0}</TableCell>
                          <TableCell className="text-right">{fmtPKR(item.price)}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="text"
                              className={cn(
                                "h-8 text-right font-bold border-primary/20",
                                availableToReturn === 0 && "opacity-50 cursor-not-allowed bg-muted"
                              )}
                              value={returnQuantities[item.id] || ''}
                              disabled={availableToReturn <= 0}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9]/g, '');
                                const val = Math.min(availableToReturn, parseInt(raw) || 0);
                                setReturnQuantities({
                                  ...returnQuantities,
                                  [item.id]: val
                                });
                              }}
                            />
                            {availableToReturn > 0 && (
                              <p className="text-[10px] text-muted-foreground mt-1">Max: {availableToReturn}</p>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <AlertCircle size={14} className="text-amber-500" /> Reason for Return
                </label>
                <Input
                  placeholder="e.g. Damaged item, customer change of mind..."
                  className="bg-muted/20"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
                <div className="text-left">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Refund Amount</p>
                  <p className="text-2xl font-black text-primary">
                    {fmtPKR(saleItems.reduce((sum, item) => sum + (item.price * (returnQuantities[item.id] || 0)), 0))}
                  </p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setReturnModalOpen(false)}>Cancel</Button>
                  <Button
                    className="flex-1 sm:flex-none gap-2"
                    onClick={handleReturnSubmit}
                    disabled={isSubmittingReturn || saleItems.reduce((sum, item) => sum + (returnQuantities[item.id] || 0), 0) === 0}
                  >
                    {isSubmittingReturn ? <Loader2 className="animate-spin" size={16} /> : <Undo2 size={16} />}
                    Process Return
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
