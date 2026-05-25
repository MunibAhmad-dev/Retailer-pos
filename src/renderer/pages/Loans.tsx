import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, Search, UserCheck, Activity, ArrowRight, Wallet,
  AlertTriangle, FileText, Download, MessageCircle, Eye, X,
  Printer, RefreshCw, TrendingUp, TrendingDown, Scale, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { useNotifications } from '../components/NotificationProvider';
import { useNavigate } from 'react-router-dom';
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton, SearchSpinner } from '../components/Pagination';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AccountEntity {
  id: number;
  name: string;
  phone?: string;
  balance: number;
  last_activity?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-PK');

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.38, delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }
  }),
};

// CSS-only tooltip
const HoverTip = ({ text, children }: { text: string; children: React.ReactNode }) => (
  <div className="group/tip relative">
    {children}
    <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 z-50 opacity-0 group-hover/tip:opacity-100 transition-all duration-150 translate-y-1 group-hover/tip:translate-y-0">
      <div className="bg-foreground text-background text-[11px] font-semibold px-2.5 py-1.5 rounded-xl shadow-xl whitespace-nowrap">{text}</div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Loans() {
  const [customers, setCustomers] = useState<AccountEntity[]>([]);
  const [vendors, setVendors] = useState<AccountEntity[]>([]);
  const [activeTab, setActiveTab] = useState<'receivables' | 'payables'>('receivables');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  // PDF Preview modal state
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewStatus, setPreviewStatus] = useState<'all' | 'settled' | 'pending' | 'partial' | 'cancelled' | 'returned'>('all');
  const [previewTab, setPreviewTab] = useState<'all' | 'receivables' | 'payables'>('all');
  const [previewPage, setPreviewPage] = useState(1);

  // Date filter state
  const [dateFilter, setDateFilter] = useState<'today' | 'weekly' | 'monthly' | 'custom'>('weekly');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const PREVIEW_PAGE_SIZE = 20;

  // ─── Data Loading ─────────────────────────────────────────────────────────
  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cusRes, venRes] = await Promise.all([
        window.api.getCustomers(),
        window.api.getVendors()
      ]);
      if (cusRes.success) setCustomers((cusRes.data || []).filter((c: any) => Math.abs(c.balance || 0) > 0.5));
      if (venRes.success) setVendors((venRes.data || []).filter((v: any) => Math.abs(v.balance || 0) > 0.5));
    } catch (e) {
      console.error(e);
      addNotification("Error", "Failed to load financial data", "error");
    } finally {
      setLoading(false);
    }
  };

  // ─── Filters ──────────────────────────────────────────────────────────────
  const handleSearch = (v: string) => {
    setIsSearching(true);
    setSearchTerm(v);
    setTimeout(() => setIsSearching(false), 200);
  };

  const inSelectedRange = (rawDate?: string) => {
    if (!rawDate) return false;
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateFilter === 'today') return d >= startOfDay;
    if (dateFilter === 'weekly') {
      const start = new Date(startOfDay); start.setDate(start.getDate() - 6); return d >= start;
    }
    if (dateFilter === 'monthly') {
      const start = new Date(startOfDay); start.setDate(start.getDate() - 29); return d >= start;
    }
    if (dateFilter === 'custom') {
      const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
      const to = toDate ? new Date(`${toDate}T23:59:59`) : null;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    }
    return true;
  };

  const currentData = activeTab === 'receivables' ? customers : vendors;

  const filteredData = useMemo(() => currentData.filter(item =>
    inSelectedRange(item.last_activity) && (
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.phone && item.phone.includes(searchTerm))
    )
  ), [currentData, searchTerm, dateFilter, fromDate, toDate]);

  const { visible: visibleItems, hasMore, loadMore, total: pTotal, showing } = usePagination(filteredData, 10, 1);

  // ─── Summary Totals ───────────────────────────────────────────────────────
  const totalReceivable = customers.reduce((acc, c) => acc + Math.max(0, c.balance || 0), 0);
  const totalPayable = vendors.reduce((acc, v) => acc + Math.max(0, v.balance || 0), 0);

  // ─── PDF Helpers ──────────────────────────────────────────────────────────
  const buildLedgerPdfHtml = (
    title: string,
    items: Array<AccountEntity & { kind?: 'receivables' | 'payables'; status?: string; remaining?: number }>,
    total: number
  ) => {
    const rowsHtml = items.map((item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.phone || '-'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.kind === 'payables' ? 'Payable' : 'Receivable'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${(item.status || 'pending').toUpperCase()}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; text-align: right;">PKR ${Math.round(item.remaining ?? item.balance ?? 0).toLocaleString('en-PK')}</td>
      </tr>
    `).join('');
    return `
      <div style="font-family: sans-serif; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0;">Financial Ledger</h1>
          <h3 style="color: #666; margin-top: 5px;">${title}</h3>
          <p style="color: #888; font-size: 12px;">Generated on ${new Date().toLocaleString()}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="text-align: left; padding: 12px; border-bottom: 2px solid #ddd;">Name</th>
              <th style="text-align: left; padding: 12px; border-bottom: 2px solid #ddd;">Phone</th>
              <th style="text-align: left; padding: 12px; border-bottom: 2px solid #ddd;">Type</th>
              <th style="text-align: left; padding: 12px; border-bottom: 2px solid #ddd;">Status</th>
              <th style="text-align: right; padding: 12px; border-bottom: 2px solid #ddd;">Due Balance</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="text-align: right; padding: 15px; font-weight: bold; font-size: 18px;">Total Outstanding:</td>
              <td style="text-align: right; padding: 15px; font-weight: bold; font-size: 18px; color: #2563eb;">PKR ${Math.round(total).toLocaleString('en-PK')}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  };

  // ─── Preview Data ─────────────────────────────────────────────────────────
  const previewRows = useMemo(() => {
    const q = previewSearch.trim().toLowerCase();
    const mapRows = (list: AccountEntity[], kind: 'receivables' | 'payables') =>
      list.map((i) => {
        const remaining = Math.max(0, Number(i.balance) || 0);
        const status = remaining <= 0.5 ? 'settled' : 'pending';
        return { ...i, kind, remaining, status, invoiceCount: '-', totalAmount: remaining, paidAmount: 0, lastActivityDate: '-' };
      });
    let rows = [...mapRows(customers, 'receivables'), ...mapRows(vendors, 'payables')].filter(r => inSelectedRange(r.last_activity));
    if (previewTab !== 'all') rows = rows.filter(r => r.kind === previewTab);
    if (previewStatus !== 'all') rows = rows.filter(r => r.status === previewStatus);
    if (q) rows = rows.filter(r => r.name.toLowerCase().includes(q) || (r.phone || '').includes(q) || String(Math.round(r.remaining)).includes(q));
    return rows.sort((a, b) => b.remaining - a.remaining);
  }, [customers, vendors, previewSearch, previewStatus, previewTab, dateFilter, fromDate, toDate]);

  const previewTotalPages = Math.max(1, Math.ceil(previewRows.length / PREVIEW_PAGE_SIZE));
  const previewVisibleRows = useMemo(() => {
    const page = Math.min(previewPage, previewTotalPages);
    const start = (page - 1) * PREVIEW_PAGE_SIZE;
    return previewRows.slice(start, start + PREVIEW_PAGE_SIZE);
  }, [previewRows, previewPage, previewTotalPages]);

  const previewSummary = useMemo(() => {
    const arPending = customers.reduce((acc, c) => acc + Math.max(0, Number(c.balance) || 0), 0);
    const apPending = vendors.reduce((acc, v) => acc + Math.max(0, Number(v.balance) || 0), 0);
    const settledCount = [...customers, ...vendors].filter(x => Math.max(0, Number(x.balance) || 0) <= 0.5).length;
    const pendingCount = [...customers, ...vendors].filter(x => Math.max(0, Number(x.balance) || 0) > 0.5).length;
    return { arPending, apPending, netOutstanding: Math.max(0, arPending + apPending), settledCount, pendingCount };
  }, [customers, vendors]);

  // ─── Export / Print Actions ───────────────────────────────────────────────
  const exportFromPreview = async () => {
    if (previewRows.length === 0) { addNotification('Warning', 'No records to export.', 'warning'); return; }
    const arRows = previewRows.filter(r => r.kind === 'receivables');
    const apRows = previewRows.filter(r => r.kind === 'payables');
    const html = `
      <div style="font-family: Inter, Arial, sans-serif; padding: 20px;">
        <h1 style="margin:0 0 8px 0;">Financial Accounts Preview</h1>
        <p style="margin:0 0 16px 0; color:#666;">Generated on ${new Date().toLocaleString()}</p>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:16px;">
          <div style="border:1px solid #eee; border-radius:10px; padding:10px;"><div style="font-size:11px; color:#666;">Total Receivables</div><div style="font-weight:700;">${fmt(previewSummary.arPending)}</div></div>
          <div style="border:1px solid #eee; border-radius:10px; padding:10px;"><div style="font-size:11px; color:#666;">Total Payables</div><div style="font-weight:700;">${fmt(previewSummary.apPending)}</div></div>
          <div style="border:1px solid #eee; border-radius:10px; padding:10px;"><div style="font-size:11px; color:#666;">Net Outstanding</div><div style="font-weight:700;">${fmt(previewSummary.netOutstanding)}</div></div>
        </div>
        <h3 style="margin: 12px 0;">Accounts Receivable</h3>
        <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
          <thead><tr style="background:#f7f7f7;"><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">Name</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">Phone</th><th style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">Remaining</th><th style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">Status</th></tr></thead>
          <tbody>${arRows.map(r => `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${r.name}</td><td style="padding:8px;border-bottom:1px solid #eee;">${r.phone || '-'}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${fmt(r.remaining)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${r.status.toUpperCase()}</td></tr>`).join('')}</tbody>
        </table>
        <h3 style="margin: 12px 0;">Accounts Payable</h3>
        <table style="width:100%; border-collapse:collapse;">
          <thead><tr style="background:#f7f7f7;"><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">Name</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd;">Phone</th><th style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">Remaining</th><th style="text-align:right;padding:8px;border-bottom:1px solid #ddd;">Status</th></tr></thead>
          <tbody>${apRows.map(r => `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${r.name}</td><td style="padding:8px;border-bottom:1px solid #eee;">${r.phone || '-'}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${fmt(r.remaining)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${r.status.toUpperCase()}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    `;
    addNotification("Generating", "Preparing PDF...", "info");
    try {
      const res = await window.api.saveInvoicePdf(html);
      if (res.success) addNotification('Success', 'PDF generated and opened successfully!', 'success');
      else addNotification('Error', res.error, 'error');
    } catch (e: any) { addNotification('Error', e.message, 'error'); }
  };

  const printPreview = async () => {
    if (previewRows.length === 0) { addNotification('Warning', 'No records to print.', 'warning'); return; }
    const html = buildLedgerPdfHtml('Financial Accounts Preview', previewRows as any, previewSummary.netOutstanding);
    try {
      const res = await window.api.printInvoice(html);
      if (!res.success) addNotification('Error', res.error || 'Print failed', 'error');
    } catch (e: any) { addNotification('Error', e.message, 'error'); }
  };

  const printSingleLedger = async (item: AccountEntity) => {
    addNotification("Generating", "Fetching ledger details...", "info");
    try {
      const isReceivable = activeTab === 'receivables';
      let details;
      if (isReceivable) {
        const res = await window.api.getCustomerDetails(item.id);
        if (!res.success) throw new Error(res.error || 'Failed to fetch details');
        details = res.data;
      } else {
        const res = await window.api.getVendorDetails(item.id);
        if (!res.success) throw new Error(res.error || 'Failed to fetch details');
        details = res.data;
      }

      let logs: any[] = [];
      if (isReceivable) {
        const sales = (details.sales || []).map((s: any) => ({ ...s, type: 'SALE', date: s.date_created, amount: s.total }));
        const payments = (details.payments || []).map((p: any) => ({ ...p, type: 'PAYMENT', date: p.date_added, amount: p.amount }));
        logs = [...sales, ...payments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      } else {
        const purchases = (details.purchases || []).map((p: any) => ({ ...p, type: 'PURCHASE', date: p.date_created, amount: p.total }));
        const payments = (details.payments || []).map((p: any) => ({ ...p, type: 'PAYMENT', date: p.date_created, amount: p.amount }));
        const returns = (details.returns || []).map((r: any) => ({ ...r, type: 'RETURN', date: r.date_created, amount: r.total_returned }));
        logs = [...purchases, ...payments, ...returns].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }

      let runningBalance = 0;
      const rowsHtml = logs.map(log => {
        let debit = 0; let credit = 0;
        if (isReceivable) {
          if (log.type === 'SALE') { debit = log.amount; runningBalance += debit; }
          else { credit = log.amount; runningBalance -= credit; }
        } else {
          if (log.type === 'PURCHASE') { credit = log.amount; runningBalance += credit; }
          else if (log.type === 'RETURN') { debit = log.amount; runningBalance -= debit; }
          else { debit = log.amount; runningBalance -= debit; }
        }
        return `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${new Date(log.date).toLocaleString()}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${log.type} ${log.notes ? `(${log.notes})` : ''}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: ${debit > 0 ? '#ef4444' : 'inherit'};">${debit > 0 ? Math.round(debit).toLocaleString() : '-'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: ${credit > 0 ? '#10b981' : 'inherit'};">${credit > 0 ? Math.round(credit).toLocaleString() : '-'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; text-align: right;">${Math.round(runningBalance).toLocaleString()}</td>
          </tr>
        `;
      }).join('');

      const html = `
        <div style="font-family: sans-serif; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0;">Statement of Account</h1>
            <h3 style="color: #666; margin-top: 5px;">${item.name} ${item.phone ? `(${item.phone})` : ''}</h3>
            <p style="color: #888; font-size: 12px;">Generated on ${new Date().toLocaleString()}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="text-align: left; padding: 12px; border-bottom: 2px solid #ddd;">Date</th>
                <th style="text-align: left; padding: 12px; border-bottom: 2px solid #ddd;">Description</th>
                <th style="text-align: right; padding: 12px; border-bottom: 2px solid #ddd;">Debit (PKR)</th>
                <th style="text-align: right; padding: 12px; border-bottom: 2px solid #ddd;">Credit (PKR)</th>
                <th style="text-align: right; padding: 12px; border-bottom: 2px solid #ddd;">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colspan="5" style="text-align: center; padding: 20px;">No transactions found.</td></tr>'}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" style="text-align: right; padding: 15px; font-weight: bold; font-size: 18px;">Closing Balance:</td>
                <td style="text-align: right; padding: 15px; font-weight: bold; font-size: 18px; color: ${runningBalance > 0 ? (isReceivable ? '#ef4444' : '#eab308') : '#10b981'};">PKR ${Math.round(runningBalance).toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
      const res = await window.api.saveInvoicePdf(html);
      if (res.success) addNotification('Success', 'Ledger PDF generated successfully!', 'success');
      else addNotification('Error', res.error, 'error');
    } catch (e: any) { addNotification('Error', e.message, 'error'); }
  };

  const sendWhatsApp = (item: AccountEntity) => {
    if (!item.phone) { addNotification("No Phone", "This contact doesn't have a phone number.", "warning"); return; }
    const cleanPhone = item.phone.replace(/[^0-9]/g, '');
    const finalPhone = cleanPhone.startsWith('0') ? '92' + cleanPhone.substring(1) : cleanPhone;
    const isReceivable = activeTab === 'receivables';
    const balanceStr = Math.round(item.balance).toLocaleString('en-PK');
    const msg = isReceivable
      ? `Hello ${item.name},\nThis is a gentle reminder that your pending balance is PKR ${balanceStr}. Please clear it at your earliest convenience. Thank you!\n\nالسلام علیکم ${item.name}،\nیہ یاد دہانی ہے کہ آپ کا بقایا بیلنس ${balanceStr} روپے ہے۔ براہ کرم جلد از جلد ادا کریں۔ شکریہ!`
      : `Hello ${item.name},\nThis is to inform you that our pending payable balance to you is PKR ${balanceStr}. We will clear it soon. Thank you!\n\nالسلام علیکم ${item.name}،\nہم آپ کو مطلع کرنا چاہتے ہیں کہ ہمارا آپ کی طرف بقایا بیلنس ${balanceStr} روپے ہے۔ ہم اسے جلد ادا کر دیں گے۔ شکریہ!`;
    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto pb-10">

      {/* ── Page Header ── */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/15">
              <Wallet size={18} className="text-violet-500" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Financial Accounts</h1>
          </div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest ml-[52px]">
            Manage accounts payable and receivable ledgers
          </p>
        </div>
        <Button
          onClick={() => { setPreviewPage(1); setShowPdfPreviewModal(true); }}
          variant="outline"
          className="gap-2 h-10 rounded-xl border-border/60 shadow-sm hover:border-primary/30 hover:bg-primary/5"
        >
          <FileText size={15} className="text-primary" /> View All Invoices
        </Button>
      </motion.div>

      {/* ── Date Filter Pills ── */}
      <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible" className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 rounded-xl bg-muted/60 p-1 border border-border/40">
          {(['today', 'weekly', 'monthly', 'custom'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={cn(
                'px-3.5 py-1.5 text-[11px] font-bold rounded-lg transition-all duration-200',
                dateFilter === f
                  ? 'bg-card shadow-sm text-foreground border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {f === 'today' ? 'Today' : f === 'weekly' ? 'Weekly' : f === 'monthly' ? 'Monthly' : 'Custom'}
            </button>
          ))}
        </div>
        <AnimatePresence>
          {dateFilter === 'custom' && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="flex gap-2"
            >
              <Input type="date" className="h-9 w-38 rounded-xl text-xs border-border/60" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <Input type="date" className="h-9 w-38 rounded-xl text-xs border-border/60" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Receivables card */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
          <HoverTip text={fmt(totalReceivable)}>
            <div
              onClick={() => setActiveTab('receivables')}
              className={cn(
                'relative overflow-hidden rounded-2xl border p-5 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-300',
                activeTab === 'receivables'
                  ? 'border-rose-500/30 bg-rose-500/5 shadow-md'
                  : 'border-border/50 bg-card hover:border-rose-500/20'
              )}
            >
              {activeTab === 'receivables' && <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-rose-500 to-orange-400" />}
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/6 via-transparent to-transparent opacity-70" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/15">
                    <TrendingUp size={16} className="text-rose-500" />
                  </div>
                  {activeTab === 'receivables' && <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
                </div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Receivables (AR)</p>
                <p className="text-xl font-black tracking-tight text-rose-600">{fmt(totalReceivable)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{customers.length} customers with balance</p>
              </div>
            </div>
          </HoverTip>
        </motion.div>

        {/* Payables card */}
        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
          <HoverTip text={fmt(totalPayable)}>
            <div
              onClick={() => setActiveTab('payables')}
              className={cn(
                'relative overflow-hidden rounded-2xl border p-5 cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-300',
                activeTab === 'payables'
                  ? 'border-amber-500/30 bg-amber-500/5 shadow-md'
                  : 'border-border/50 bg-card hover:border-amber-500/20'
              )}
            >
              {activeTab === 'payables' && <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 to-yellow-400" />}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/6 via-transparent to-transparent opacity-70" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/15">
                    <TrendingDown size={16} className="text-amber-500" />
                  </div>
                  {activeTab === 'payables' && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                </div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Payables (AP)</p>
                <p className="text-xl font-black tracking-tight text-amber-600">{fmt(totalPayable)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{vendors.length} vendors with balance</p>
              </div>
            </div>
          </HoverTip>
        </motion.div>

        {/* Net position card */}
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
          <div className="relative overflow-hidden rounded-2xl border border-blue-500/15 bg-card p-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 cursor-default">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/6 via-transparent to-transparent opacity-70" />
            <div className="relative z-10">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/15 mb-3 w-fit">
                <Scale size={16} className="text-blue-500" />
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Net Position</p>
              <p className="text-xl font-black tracking-tight text-blue-600">{fmt(totalReceivable - totalPayable)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {totalReceivable >= totalPayable ? 'Net receivable position' : 'Net payable position'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Main Table Card ── */}
      <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">

        {/* Card Header: Tab switcher + Search */}
        <div className="px-5 pt-5 pb-4 border-b border-border/40">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">

            {/* Tab switcher */}
            <div className="flex gap-1 rounded-xl bg-muted/50 p-1 border border-border/40">
              <button
                onClick={() => { setActiveTab('receivables'); setSearchTerm(''); }}
                className={cn(
                  'px-4 py-2 text-[12px] font-bold rounded-lg transition-all duration-200',
                  activeTab === 'receivables'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Receivables (AR)
                <span className={cn('ml-2 text-[10px] font-black px-1.5 py-0.5 rounded-md', activeTab === 'receivables' ? 'bg-white/25' : 'bg-muted text-muted-foreground')}>
                  {customers.length}
                </span>
              </button>
              <button
                onClick={() => { setActiveTab('payables'); setSearchTerm(''); }}
                className={cn(
                  'px-4 py-2 text-[12px] font-bold rounded-lg transition-all duration-200',
                  activeTab === 'payables'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Payables (AP)
                <span className={cn('ml-2 text-[10px] font-black px-1.5 py-0.5 rounded-md', activeTab === 'payables' ? 'bg-white/25' : 'bg-muted text-muted-foreground')}>
                  {vendors.length}
                </span>
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-background border-border/60 text-sm shadow-sm"
              />
              {isSearching && <SearchSpinner className="right-3 top-2.5 absolute" />}
            </div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex h-full min-h-[300px] items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <RefreshCw size={26} className="animate-spin text-primary" />
              </div>
              <p className="text-sm font-semibold">Loading accounts...</p>
            </div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
            <UserCheck size={48} className="opacity-15" />
            <div className="text-center">
              <p className="font-semibold text-sm text-foreground">All Clear!</p>
              <p className="text-xs mt-1 opacity-70">No outstanding balances in this category.</p>
            </div>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1fr_auto] px-5 py-2.5 bg-muted/20 border-b border-border/20">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Party</span>
              <span className="hidden sm:block text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Due Balance</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</span>
            </div>

            {visibleItems.map((item, i) => (
              <motion.div
                key={item.id}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="flex items-center justify-between px-5 py-4 border-b border-border/20 last:border-none hover:bg-muted/25 transition-colors group"
              >
                {/* Left: Avatar + Name */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={cn(
                    'w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 border',
                    activeTab === 'receivables'
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-600'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-600'
                  )}>
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-[14px] truncate">{item.name}</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.phone || 'No phone number'}</p>
                  </div>
                </div>

                {/* Right: Balance + Actions */}
                <div className="flex items-center gap-4 shrink-0">
                  {/* Balance (hidden on mobile, shown in row on desktop) */}
                  <div className="hidden sm:block text-right">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Due Balance</p>
                    <p className={cn('font-black text-[15px]', activeTab === 'receivables' ? 'text-rose-500' : 'text-amber-500')}>
                      {fmt(item.balance)}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-1.5">
                    <HoverTip text="Send WhatsApp reminder">
                      <Button
                        onClick={() => sendWhatsApp(item)}
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 dark:border-emerald-900 dark:hover:bg-emerald-950 shadow-sm"
                      >
                        <MessageCircle size={15} />
                      </Button>
                    </HoverTip>
                    <HoverTip text="Generate ledger PDF">
                      <Button
                        onClick={() => printSingleLedger(item)}
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 dark:border-blue-900 dark:hover:bg-blue-950 shadow-sm"
                      >
                        <Eye size={15} />
                      </Button>
                    </HoverTip>
                    <HoverTip text="Go to account to settle">
                      <Button
                        onClick={() => navigate(activeTab === 'receivables' ? `/customers?customer_id=${item.id}` : `/vendors`)}
                        size="sm"
                        className={cn(
                          'h-9 px-3.5 rounded-xl gap-1.5 text-[12px] font-bold shadow-sm',
                          activeTab === 'receivables'
                            ? 'bg-rose-500 hover:bg-rose-600 text-white'
                            : 'bg-amber-500 hover:bg-amber-600 text-white'
                        )}
                      >
                        Settle <ArrowRight size={13} />
                      </Button>
                    </HoverTip>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Mobile balance summary row */}
            <div className="sm:hidden flex items-center justify-between px-5 py-3 bg-muted/10 border-t border-border/30">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Outstanding</span>
              <span className={cn('font-black text-base', activeTab === 'receivables' ? 'text-rose-500' : 'text-amber-500')}>
                {fmt(activeTab === 'receivables' ? totalReceivable : totalPayable)}
              </span>
            </div>

            <div className="px-5 py-2">
              <LoadMoreButton hasMore={hasMore} onLoadMore={loadMore} showing={showing} total={pTotal} />
            </div>
          </div>
        )}
      </motion.div>

      {/* ════════════════ PDF Preview Modal ════════════════ */}
      <Dialog open={showPdfPreviewModal} onOpenChange={setShowPdfPreviewModal}>
        <DialogContent className="w-[98vw] max-w-[1240px] max-h-[92vh] p-0 overflow-hidden flex flex-col rounded-2xl border-border/50">
          {/* Gradient top accent */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-violet-500 via-blue-500 to-violet-400 rounded-t-2xl z-10" />

          <DialogHeader className="border-b border-border/40 px-6 py-5 pr-14 pt-7 shrink-0">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-black">
              <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/15">
                <FileText size={16} className="text-violet-500" />
              </div>
              Accounts PDF Preview
            </DialogTitle>
            <DialogDescription className="text-xs mt-0.5">
              Professional AR/AP overview — filter, search, then export or print.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: 'Receivables', value: fmt(previewSummary.arPending), color: 'rose' },
                { label: 'Payables', value: fmt(previewSummary.apPending), color: 'amber' },
                { label: 'Net Balance', value: fmt(previewSummary.netOutstanding), color: 'blue' },
                { label: 'Settled', value: String(previewSummary.settledCount), color: 'emerald' },
                { label: 'Pending', value: String(previewSummary.pendingCount), color: 'orange' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`relative overflow-hidden rounded-xl border border-${color}-500/20 bg-${color}-500/5 p-4 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200`}>
                  <div className={`absolute inset-0 bg-gradient-to-br from-${color}-500/8 via-transparent to-transparent`} />
                  <div className="relative z-10">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
                    <p className={`text-base font-black text-${color}-600 dark:text-${color}-400`}>{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap gap-2.5 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customer/vendor or amount..."
                  value={previewSearch}
                  onChange={(e) => { setPreviewSearch(e.target.value); setPreviewPage(1); }}
                  className="pl-9 h-10 rounded-xl border-border/60"
                />
              </div>
              <select
                className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm font-medium transition-colors hover:border-primary/30 focus:outline-none focus:border-primary/50"
                value={previewTab}
                onChange={(e) => { setPreviewTab(e.target.value as any); setPreviewPage(1); }}
              >
                <option value="all">All Accounts</option>
                <option value="receivables">Receivables</option>
                <option value="payables">Payables</option>
              </select>
              <select
                className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm font-medium transition-colors hover:border-primary/30 focus:outline-none focus:border-primary/50"
                value={previewStatus}
                onChange={(e) => { setPreviewStatus(e.target.value as any); setPreviewPage(1); }}
              >
                <option value="all">All Statuses</option>
                <option value="settled">Settled</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="cancelled">Cancelled</option>
                <option value="returned">Returned</option>
              </select>
              <span className="text-[11px] font-semibold text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 border border-border/30">
                {previewRows.length} records
              </span>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm">
              <div className="max-h-[50vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b border-border/40 sticky top-0 backdrop-blur-sm z-10">
                    <tr>
                      {['Party Name', 'Type', 'Contact Info', 'Remaining', 'Status'].map((h, i) => (
                        <th key={h} className={cn('py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground', i === 3 ? 'text-right' : i === 4 ? 'text-center' : 'text-left')}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewVisibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-muted-foreground">
                          <UserCheck size={32} className="mx-auto opacity-15 mb-3" />
                          <p className="text-sm font-medium">No records found.</p>
                        </td>
                      </tr>
                    ) : previewVisibleRows.map((r) => (
                      <tr key={`${r.kind}-${r.id}`} className="border-b border-border/20 hover:bg-muted/25 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className={cn(
                              'w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0',
                              r.kind === 'receivables' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'
                            )}>
                              {r.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-[13px]">{r.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge className={cn(
                            'text-[9px] font-black uppercase border-none',
                            r.kind === 'receivables' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                          )}>
                            {r.kind === 'receivables' ? 'Receivable' : 'Payable'}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-[12px] text-muted-foreground">{r.phone || 'No phone'}</td>
                        <td className="py-3.5 px-4 text-right font-black text-[14px] text-primary">{fmt(r.remaining)}</td>
                        <td className="py-3.5 px-4 text-center">
                          <Badge className={cn(
                            'text-[9px] font-black uppercase border-none',
                            r.status === 'settled' ? 'bg-emerald-500 text-white' :
                            r.status === 'pending' ? 'bg-amber-500 text-white' :
                            r.status === 'partial' ? 'bg-orange-500 text-white' :
                            r.status === 'cancelled' ? 'bg-rose-600 text-white' :
                            'bg-violet-600 text-white'
                          )}>
                            {r.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/30 bg-muted/10">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Page {Math.min(previewPage, previewTotalPages)} of {previewTotalPages}
                  <span className="ml-2 text-muted-foreground/60">({previewRows.length} records)</span>
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" disabled={previewPage <= 1} onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}>← Prev</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" disabled={previewPage >= previewTotalPages} onClick={() => setPreviewPage((p) => Math.min(previewTotalPages, p + 1))}>Next →</Button>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-between items-center gap-3 pt-1">
              <Button
                variant="ghost"
                className="text-xs text-muted-foreground h-9 rounded-xl"
                onClick={() => { setPreviewSearch(''); setPreviewStatus('all'); setPreviewTab('all'); setPreviewPage(1); }}
              >
                Reset Filters
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2 h-10 rounded-xl shadow-sm" onClick={printPreview}>
                  <Printer size={14} /> Print
                </Button>
                <Button className="gap-2 h-10 rounded-xl shadow-sm" onClick={exportFromPreview}>
                  <Download size={14} /> Generate PDF
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}