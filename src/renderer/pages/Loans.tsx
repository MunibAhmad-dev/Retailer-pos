import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, Search, UserCheck, Activity, ArrowRight, Wallet, History, AlertTriangle, FileText, Download, MessageCircle, Eye, X, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { useNotifications } from '../components/NotificationProvider';
import { useNavigate } from 'react-router-dom';
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton, SearchSpinner } from '../components/Pagination';
import { cn } from '../lib/utils';

interface AccountEntity {
  id: number;
  name: string;
  phone?: string;
  balance: number;
  last_activity?: string;
}

export default function Loans() {
  const [customers, setCustomers] = useState<AccountEntity[]>([]);
  const [vendors, setVendors] = useState<AccountEntity[]>([]);
  const [activeTab, setActiveTab] = useState<'receivables' | 'payables'>('receivables');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewStatus, setPreviewStatus] = useState<'all' | 'settled' | 'pending' | 'partial' | 'cancelled' | 'returned'>('all');
  const [previewTab, setPreviewTab] = useState<'all' | 'receivables' | 'payables'>('all');
  const [previewPage, setPreviewPage] = useState(1);
  const [dateFilter, setDateFilter] = useState<'today' | 'weekly' | 'monthly' | 'custom'>('weekly');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const PREVIEW_PAGE_SIZE = 20;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cusRes, venRes] = await Promise.all([
        window.api.getCustomers(),
        window.api.getVendors()
      ]);

      if (cusRes.success) {
        setCustomers((cusRes.data || []).filter((c: any) => Math.abs(c.balance || 0) > 0.5));
      }
      if (venRes.success) {
        setVendors((venRes.data || []).filter((v: any) => Math.abs(v.balance || 0) > 0.5));
      }
    } catch (e) {
      console.error(e);
      addNotification("Error", "Failed to load financial data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (v: string) => {
    setIsSearching(true);
    setSearchTerm(v);
    setTimeout(() => setIsSearching(false), 200);
  };

  const currentData = activeTab === 'receivables' ? customers : vendors;

  const inSelectedRange = (rawDate?: string) => {
    if (!rawDate) return false;
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateFilter === 'today') return d >= startOfDay;
    if (dateFilter === 'weekly') {
      const start = new Date(startOfDay);
      start.setDate(start.getDate() - 6);
      return d >= start;
    }
    if (dateFilter === 'monthly') {
      const start = new Date(startOfDay);
      start.setDate(start.getDate() - 29);
      return d >= start;
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

  const filteredData = useMemo(() => currentData.filter(item =>
    inSelectedRange(item.last_activity) && (
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.phone && item.phone.includes(searchTerm))
    )
  ), [currentData, searchTerm, dateFilter, fromDate, toDate]);

  const { visible: visibleItems, hasMore, loadMore, total: pTotal, showing } = usePagination(filteredData, 10, 1);

  const totalReceivable = customers.reduce((acc, c) => acc + Math.max(0, c.balance || 0), 0);
  const totalPayable = vendors.reduce((acc, v) => acc + Math.max(0, v.balance || 0), 0);

  const fmt = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-PK');

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
          <tbody>
            ${rowsHtml}
          </tbody>
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

  const previewRows = useMemo(() => {
    const q = previewSearch.trim().toLowerCase();
    const mapRows = (list: AccountEntity[], kind: 'receivables' | 'payables') =>
      list.map((i) => {
        const remaining = Math.max(0, Number(i.balance) || 0);
        const status = remaining <= 0.5 ? 'settled' : 'pending';
        return {
          ...i,
          kind,
          remaining,
          status,
          invoiceCount: '-',
          totalAmount: remaining,
          paidAmount: 0,
          lastActivityDate: '-'
        };
      });

    let rows = [...mapRows(customers, 'receivables'), ...mapRows(vendors, 'payables')].filter(r => inSelectedRange(r.last_activity));
    if (previewTab !== 'all') rows = rows.filter(r => r.kind === previewTab);
    if (previewStatus !== 'all') rows = rows.filter(r => r.status === previewStatus);
    if (q) {
      rows = rows.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.phone || '').includes(q) ||
        String(Math.round(r.remaining)).includes(q)
      );
    }
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
    return {
      arPending,
      apPending,
      netOutstanding: Math.max(0, arPending + apPending),
      settledCount,
      pendingCount
    };
  }, [customers, vendors]);

  const exportFromPreview = async () => {
    if (previewRows.length === 0) {
      addNotification('Warning', 'No records to export.', 'warning');
      return;
    }

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
      if (res.success) {
        addNotification('Success', 'PDF generated and opened successfully!', 'success');
      } else {
        addNotification('Error', res.error, 'error');
      }
    } catch (e: any) {
      addNotification('Error', e.message, 'error');
    }
  };

  const printPreview = async () => {
    if (previewRows.length === 0) {
      addNotification('Warning', 'No records to print.', 'warning');
      return;
    }
    const html = buildLedgerPdfHtml('Financial Accounts Preview', previewRows as any, previewSummary.netOutstanding);
    try {
      const res = await window.api.printInvoice(html);
      if (!res.success) addNotification('Error', res.error || 'Print failed', 'error');
    } catch (e: any) {
      addNotification('Error', e.message, 'error');
    }
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
        const purchases = (details.purchases || []).map((p: any) => ({
          ...p, type: 'PURCHASE', date: p.date_created, amount: p.total
        }));
        const payments = (details.payments || []).map((p: any) => ({
          ...p, type: 'PAYMENT', date: p.date_created, amount: p.amount  // vendor_payments uses date_created
        }));
        const returns = (details.returns || []).map((r: any) => ({
          ...r, type: 'RETURN', date: r.date_created, amount: r.total_returned
        }));
        logs = [...purchases, ...payments, ...returns].sort((a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
      }

      let runningBalance = 0;
      const rowsHtml = logs.map(log => {
        let debit = 0;
        let credit = 0;

        if (isReceivable) {
          if (log.type === 'SALE') { debit = log.amount; runningBalance += debit; }
          else { credit = log.amount; runningBalance -= credit; }
        } else {
          if (log.type === 'PURCHASE') { credit = log.amount; runningBalance += credit; }
          else if (log.type === 'RETURN') { debit = log.amount; runningBalance -= debit; }  // return reduces what we owe
          else { debit = log.amount; runningBalance -= debit; }  // PAYMENT
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
      if (res.success) {
        addNotification('Success', 'Ledger PDF generated successfully!', 'success');
      } else {
        addNotification('Error', res.error, 'error');
      }
    } catch (e: any) {
      addNotification('Error', e.message, 'error');
    }
  };

  const sendWhatsApp = (item: AccountEntity) => {
    if (!item.phone) {
      addNotification("No Phone", "This contact doesn't have a phone number.", "warning");
      return;
    }
    const cleanPhone = item.phone.replace(/[^0-9]/g, '');
    let finalPhone = cleanPhone;
    if (cleanPhone.startsWith('0')) {
      finalPhone = '92' + cleanPhone.substring(1);
    }

    const isReceivable = activeTab === 'receivables';
    const balanceStr = Math.round(item.balance).toLocaleString('en-PK');

    let msg = '';
    if (isReceivable) {
      msg = `Hello ${item.name},\nThis is a gentle reminder that your pending balance is PKR ${balanceStr}. Please clear it at your earliest convenience. Thank you!\n\nالسلام علیکم ${item.name}،\nیہ یاد دہانی ہے کہ آپ کا بقایا بیلنس ${balanceStr} روپے ہے۔ براہ کرم جلد از جلد ادا کریں۔ شکریہ!`;
    } else {
      msg = `Hello ${item.name},\nThis is to inform you that our pending payable balance to you is PKR ${balanceStr}. We will clear it soon. Thank you!\n\nالسلام علیکم ${item.name}،\nہم آپ کو مطلع کرنا چاہتے ہیں کہ ہمارا آپ کی طرف بقایا بیلنس ${balanceStr} روپے ہے۔ ہم اسے جلد ادا کر دیں گے۔ شکریہ!`;
    }

    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10 animate-in fade-in">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wallet size={28} className="text-primary" /> Financial Accounts
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Manage accounts payable and receivable ledgers</p>
        </div>

        <Button onClick={() => { setPreviewPage(1); setShowPdfPreviewModal(true); }} variant="outline" className="gap-2 shadow-sm border-primary/20 hover:bg-primary/5">
          <FileText size={16} className="text-primary" />
          View All Invoices
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(['today', 'weekly', 'monthly', 'custom'] as const).map((f) => (
            <Button
              key={f}
              type="button"
              variant={dateFilter === f ? 'default' : 'ghost'}
              size="sm"
              className="h-8"
              onClick={() => setDateFilter(f)}
            >
              {f === 'today' ? 'Today' : f === 'weekly' ? 'Weekly' : f === 'monthly' ? 'Monthly' : 'Custom'}
            </Button>
          ))}
        </div>
        {dateFilter === 'custom' && (
          <>
            <Input type="date" className="h-10 w-40" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Input type="date" className="h-10 w-40" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className={cn("shadow-md transition-colors", activeTab === 'receivables' ? "bg-destructive/10 border-destructive/20" : "bg-card border-border")}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className={cn("font-medium uppercase text-xs tracking-wider", activeTab === 'receivables' ? "text-destructive" : "text-muted-foreground")}>
              Total Receivable (Customers Owe You)
            </CardTitle>
            <AlertTriangle size={20} className={activeTab === 'receivables' ? "text-destructive" : "text-muted-foreground"} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-3xl font-bold tracking-tight", activeTab === 'receivables' ? "text-destructive" : "text-foreground")}>{fmt(totalReceivable)}</div>
            <p className="text-sm mt-1 opacity-80">Across {customers.length} customers</p>
          </CardContent>
        </Card>

        <Card className={cn("shadow-md transition-colors", activeTab === 'payables' ? "bg-amber-500/10 border-amber-500/20" : "bg-card border-border")}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className={cn("font-medium uppercase text-xs tracking-wider", activeTab === 'payables' ? "text-amber-600" : "text-muted-foreground")}>
              Total Payable (You Owe Vendors)
            </CardTitle>
            <AlertTriangle size={20} className={activeTab === 'payables' ? "text-amber-600" : "text-muted-foreground"} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-3xl font-bold tracking-tight", activeTab === 'payables' ? "text-amber-600" : "text-foreground")}>{fmt(totalPayable)}</div>
            <p className="text-sm mt-1 opacity-80">Across {vendors.length} vendors</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-border/50">
        <CardHeader className="border-b bg-muted/20 pb-0 pt-4 px-4">
          <div className="w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div className="flex bg-muted p-1 rounded-lg w-full sm:w-[400px]">
                <button
                  onClick={() => { setActiveTab('receivables'); setSearchTerm(''); }}
                  className={cn(
                    "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                    activeTab === 'receivables' ? "bg-destructive text-white shadow" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                >
                  Receivables (AR)
                </button>
                <button
                  onClick={() => { setActiveTab('payables'); setSearchTerm(''); }}
                  className={cn(
                    "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                    activeTab === 'payables' ? "bg-amber-500 text-white shadow" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                >
                  Payables (AP)
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9 bg-background h-9 shadow-sm"
                />
                <SearchSpinner visible={isSearching} />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-20 text-muted-foreground">
              <Activity size={32} className="animate-spin text-primary opacity-50" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col justify-center items-center py-20 text-muted-foreground">
              <UserCheck size={48} className="opacity-20 mb-4" />
              <p className="text-lg font-medium text-foreground">All Clear!</p>
              <p className="text-sm">No outstanding balances found in this category.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {visibleItems.map(item => (
                <div key={item.id} className="flex flex-col sm:flex-row items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4 w-full sm:w-auto mb-4 sm:mb-0">
                    <div className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg",
                      activeTab === 'receivables' ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"
                    )}>
                      {item.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">{item.name}</h4>
                      <p className="text-sm text-muted-foreground">{item.phone || 'No phone'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Due Balance</p>
                      <p className={cn("font-bold text-lg", activeTab === 'receivables' ? "text-destructive" : "text-amber-600")}>
                        {fmt(item.balance)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => sendWhatsApp(item)}
                        variant="outline"
                        size="sm"
                        className="gap-2 text-green-600 border-green-200 hover:bg-green-50 shadow-sm"
                      >
                        <MessageCircle size={16} />
                      </Button>
                      <Button
                        onClick={() => printSingleLedger(item)}
                        variant="outline"
                        size="sm"
                        className="gap-2 shadow-sm text-primary hover:text-primary"
                      >
                        <Eye size={16} /> Ledger
                      </Button>
                      <Button
                        onClick={() => navigate(activeTab === 'receivables' ? `/customers?customer_id=${item.id}` : `/vendors`)}
                        variant="secondary"
                        size="sm"
                        className="gap-2 shadow-sm whitespace-nowrap"
                      >
                        Settle <ArrowRight size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="px-4">
                <LoadMoreButton hasMore={hasMore} onLoadMore={loadMore} showing={showing} total={pTotal} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showPdfPreviewModal} onOpenChange={setShowPdfPreviewModal}>
        <DialogContent className="w-[98vw] max-w-[1240px] h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="border-b bg-muted/20 px-6 py-4 text-left">
            <DialogTitle className="text-xl font-bold">Accounts PDF Preview</DialogTitle>
            <DialogDescription>Professional AR/AP preview before export</DialogDescription>
          </DialogHeader>
          <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="rounded-xl border bg-rose-100 p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm border-rose-300 dark:bg-rose-950/20 dark:border-rose-900/50">
                  <p className="text-[10px] uppercase text-muted-foreground font-black tracking-widest mb-1">Receivables</p>
                  <p className="text-xl font-black text-rose-800 dark:text-rose-400">{fmt(previewSummary.arPending)}</p>
                </div>
                <div className="rounded-xl border bg-amber-100 p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm border-amber-300 dark:bg-amber-950/20 dark:border-amber-900/50">
                  <p className="text-[10px] uppercase text-muted-foreground font-black tracking-widest mb-1">Payables</p>
                  <p className="text-xl font-black text-amber-800 dark:text-amber-400">{fmt(previewSummary.apPending)}</p>
                </div>
                <div className="rounded-xl border bg-blue-100 p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm border-blue-300 dark:bg-blue-950/20 dark:border-blue-900/50">
                  <p className="text-[10px] uppercase text-muted-foreground font-black tracking-widest mb-1">Net Balance</p>
                  <p className="text-xl font-black text-blue-800 dark:text-blue-400">{fmt(previewSummary.netOutstanding)}</p>
                </div>
                <div className="rounded-xl border bg-emerald-100 p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-900/50">
                  <p className="text-[10px] uppercase text-muted-foreground font-black tracking-widest mb-1">Settled</p>
                  <p className="text-xl font-black text-emerald-800 dark:text-emerald-400">{previewSummary.settledCount}</p>
                </div>
                <div className="rounded-xl border bg-orange-100 p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm border-orange-300 dark:bg-orange-950/20 dark:border-orange-900/50">
                  <p className="text-[10px] uppercase text-muted-foreground font-black tracking-widest mb-1">Pending</p>
                  <p className="text-xl font-black text-orange-800 dark:text-orange-400">{previewSummary.pendingCount}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Input placeholder="Search customer/vendor or amount..." value={previewSearch} onChange={(e) => { setPreviewSearch(e.target.value); setPreviewPage(1); }} className="h-10" />
                <select className="h-10 rounded-md border bg-background px-2 text-sm transition-colors hover:border-primary/40 focus:border-primary/60" value={previewTab} onChange={(e) => { setPreviewTab(e.target.value as any); setPreviewPage(1); }}>
                  <option value="all">All Accounts</option>
                  <option value="receivables">Receivables</option>
                  <option value="payables">Payables</option>
                </select>
                <select className="h-10 rounded-md border bg-background px-2 text-sm transition-colors hover:border-primary/40 focus:border-primary/60" value={previewStatus} onChange={(e) => { setPreviewStatus(e.target.value as any); setPreviewPage(1); }}>
                  <option value="all">All Status</option>
                  <option value="settled">Settled</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="returned">Returned</option>
                </select>
                <div className="text-xs text-muted-foreground flex items-center justify-end">{previewRows.length} records</div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <div className="max-h-[56vh] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 border-b sticky top-0">
                      <tr className="bg-muted/50 uppercase text-[10px] font-black tracking-widest text-muted-foreground">
                        <th className="text-left py-4 px-4 border-b">Party Name</th>
                        <th className="text-left py-4 px-4 border-b">Type</th>
                        <th className="text-left py-4 px-4 border-b">Contact Info</th>
                        <th className="text-right py-4 px-4 border-b">Remaining</th>
                        <th className="text-center py-4 px-4 border-b">Account Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewVisibleRows.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">No records found.</td></tr>
                      ) : previewVisibleRows.map((r) => (
                        <tr key={`${r.kind}-${r.id}`} className="border-b border-border/50 transition-colors hover:bg-muted/30">
                          <td className="py-4 px-4">
                            <p className="font-bold text-sm">{r.name}</p>
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant="outline" className={cn(
                              "text-[9px] font-black uppercase px-2 py-0.5",
                              r.kind === 'receivables' ? "text-rose-800 border-rose-300 bg-rose-100 dark:text-rose-300 dark:border-rose-900/50 dark:bg-rose-950/50" : "text-amber-800 border-amber-300 bg-amber-100 dark:text-amber-300 dark:border-amber-900/50 dark:bg-amber-950/50"
                            )}>
                              {r.kind === 'receivables' ? 'Receivable' : 'Payable'}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 text-xs font-medium text-muted-foreground">{r.phone || 'No Phone'}</td>
                          <td className="py-4 px-4 text-right font-black text-base text-primary">{fmt(r.remaining)}</td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              "inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-tighter shadow-sm",
                              r.status === 'settled' ? "bg-emerald-100 text-black dark:bg-emerald-900/40 dark:text-emerald-300" :
                              r.status === 'pending' ? "bg-amber-100 text-black dark:bg-amber-900/40 dark:text-amber-300" :
                              r.status === 'partial' ? "bg-orange-100 text-black dark:bg-orange-900/40 dark:text-orange-300" :
                              r.status === 'cancelled' ? "bg-rose-100 text-black dark:bg-rose-900/40 dark:text-rose-300" :
                              "bg-violet-100 text-black dark:bg-violet-900/40 dark:text-violet-300"
                            )}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between p-2 border-t bg-muted/5">
                  <span className="text-xs text-muted-foreground">Page {Math.min(previewPage, previewTotalPages)} of {previewTotalPages}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={previewPage <= 1} onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}>Prev</Button>
                    <Button size="sm" variant="outline" disabled={previewPage >= previewTotalPages} onClick={() => setPreviewPage((p) => Math.min(previewTotalPages, p + 1))}>Next</Button>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-t -mx-5 px-5 py-3 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPreviewSearch('');
                    setPreviewStatus('all');
                    setPreviewTab('all');
                    setPreviewPage(1);
                  }}
                  className="hover:scale-[1.01] transition-transform"
                >
                  Preview
                </Button>
                <Button variant="outline" className="gap-2" onClick={printPreview}><Printer size={14} /> Print</Button>
                <Button className="gap-2" onClick={exportFromPreview}><Download size={14} /> Generate PDF</Button>
              </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
