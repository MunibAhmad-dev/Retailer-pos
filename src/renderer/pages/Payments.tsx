import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CircleDollarSign, Search, Filter, RefreshCcw, ArrowUpRight, ArrowDownLeft, FileText, Download, Plus, Printer, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useNotifications } from '../components/NotificationProvider';
import { cn } from '../lib/utils';

const fmtPKR = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-PK');

export default function Payments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'weekly' | 'monthly' | 'custom'>('weekly');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedDateFilter, setAppliedDateFilter] = useState<'today' | 'weekly' | 'monthly' | 'custom'>('weekly');
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalIncoming, setTotalIncoming] = useState(0);
  const [totalOutgoing, setTotalOutgoing] = useState(0);
  const { addNotification } = useNotifications();
  const PAGE_SIZE = 15;
  const fetchSeqRef = useRef(0);

  useEffect(() => {
    loadPayments(true);
  }, [searchTerm, appliedDateFilter, appliedFromDate, appliedToDate]);

  const loadPayments = async (fresh = false) => {
    const seq = ++fetchSeqRef.current;
    if (fresh) {
      setLoading(true);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = fresh ? 0 : offset;
      const res = await window.api.getAllPayments({
        limit: PAGE_SIZE,
        offset: currentOffset,
        search: searchTerm,
        dateFilter: appliedDateFilter,
        startDate: appliedFromDate ? `${appliedFromDate} 00:00:00` : undefined,
        endDate: appliedToDate ? `${appliedToDate} 23:59:59` : undefined
      });
      if (seq !== fetchSeqRef.current) return;
      if (res.success) {
        if (fresh) {
          setPayments(res.data);
        } else {
          setPayments(prev => [...prev, ...res.data]);
        }
        setTotal(res.total);
        setOffset(currentOffset + PAGE_SIZE);
        // Always update aggregate totals from backend (includes all records)
        if (res.totalIncoming !== undefined) setTotalIncoming(res.totalIncoming);
        if (res.totalOutgoing !== undefined) setTotalOutgoing(res.totalOutgoing);
      }
    } catch (error) {
      if (seq !== fetchSeqRef.current) return;
      addNotification("Error", "Failed to load payment history", "error");
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  const filtered = useMemo(() => payments, [payments]);

  const exportCSV = () => {
    const headers = ['Type', 'Party Name', 'Date', 'Notes', 'Amount'];
    const rows = payments.map(p => [
      p.type,
      p.party_name,
      new Date(p.date_added).toLocaleString(),
      (p.notes || '').replace(/,/g, ';'),
      p.amount
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(v => `"${v}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payment_ledger_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const buildReceiptHtml = (p: any): string => {
    const dateStr = new Date(p.date_added).toLocaleString();
    const amountStr = fmtPKR(p.amount);
    if (p.type === 'Customer Payment' || p.type === 'Vendor Payment') {
      return `<div style="font-family:'Segoe UI',sans-serif;padding:40px;border:1px solid #e2e8f0;max-width:600px;margin:auto;background:#fff;border-radius:12px"><div style="text-align:center;margin-bottom:30px"><h1 style="margin:0;color:#1e40af;font-size:28px;font-weight:800;text-transform:uppercase;letter-spacing:1px">Payment Receipt</h1><p style="margin:5px 0 0;color:#64748b;font-size:14px">Official Transaction Record</p></div><div style="display:flex;justify-content:space-between;margin-bottom:30px;padding:15px;background:#f8fafc;border-radius:8px"><div><p style="margin:0;font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">Receipt Number</p><p style="margin:2px 0 0;font-weight:700;color:#1e293b">#PAY-${p.id}</p></div><div style="text-align:right"><p style="margin:0;font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700">Date</p><p style="margin:2px 0 0;font-weight:700;color:#1e293b">${dateStr}</p></div></div><div style="margin-bottom:30px"><div style="display:flex;justify-content:space-between;margin-bottom:10px;border-bottom:1px solid #f1f5f9;padding-bottom:5px"><span style="color:#64748b">Party</span><span style="font-weight:700;color:#1e293b">${p.party_name}</span></div><div style="display:flex;justify-content:space-between;margin-bottom:10px;border-bottom:1px solid #f1f5f9;padding-bottom:5px"><span style="color:#64748b">Type</span><span style="font-weight:700;color:#1e293b">${p.type}</span></div><div style="display:flex;justify-content:space-between"><span style="color:#64748b">Notes</span><span style="font-style:italic;color:#1e293b">${p.notes || '—'}</span></div></div><div style="background:#1e40af;padding:25px;border-radius:10px;text-align:center;color:#fff;margin-bottom:30px"><p style="margin:0;font-size:12px;font-weight:700;opacity:.8;text-transform:uppercase">Amount</p><p style="margin:8px 0 0;font-size:36px;font-weight:900;letter-spacing:-1px">${amountStr}</p></div><div style="text-align:center;font-size:11px;color:#cbd5e1;margin-top:30px">Computer generated receipt — No signature required.</div></div>`;
    }
    return `<div style="font-family:'Segoe UI',sans-serif;padding:40px;border:1px solid #ffe4e6;max-width:600px;margin:auto;background:#fff;border-radius:12px"><div style="text-align:center;margin-bottom:30px"><h1 style="margin:0;color:#e11d48;font-size:28px;font-weight:800;text-transform:uppercase;letter-spacing:1px">Return Voucher</h1><p style="margin:5px 0 0;color:#9f1239;font-size:14px">Official Credit Adjustment</p></div><div style="display:flex;justify-content:space-between;margin-bottom:30px;padding:15px;background:#fff1f2;border-radius:8px"><div><p style="margin:0;font-size:10px;color:#9f1239;text-transform:uppercase;font-weight:700">Voucher</p><p style="margin:2px 0 0;font-weight:700;color:#881337">#RET-${p.id}</p></div><div style="text-align:right"><p style="margin:0;font-size:10px;color:#9f1239;text-transform:uppercase;font-weight:700">Date</p><p style="margin:2px 0 0;font-weight:700;color:#881337">${dateStr}</p></div></div><div style="margin-bottom:30px"><div style="display:flex;justify-content:space-between;margin-bottom:10px;border-bottom:1px solid #fecdd3;padding-bottom:5px"><span style="color:#9f1239">Party</span><span style="font-weight:700;color:#881337">${p.party_name}</span></div><div style="display:flex;justify-content:space-between;margin-bottom:10px;border-bottom:1px solid #fecdd3;padding-bottom:5px"><span style="color:#9f1239">Type</span><span style="font-weight:700;color:#881337">${p.type}</span></div><div style="display:flex;justify-content:space-between"><span style="color:#9f1239">Reason</span><span style="font-style:italic;color:#881337">${p.notes || '—'}</span></div></div><div style="background:#e11d48;padding:25px;border-radius:10px;text-align:center;color:#fff;margin-bottom:30px"><p style="margin:0;font-size:12px;font-weight:700;opacity:.8;text-transform:uppercase">Refund Amount</p><p style="margin:8px 0 0;font-size:36px;font-weight:900;letter-spacing:-1px">${amountStr}</p></div><div style="text-align:center;font-size:11px;color:#fb7185;margin-top:30px">Generated by Retailer POS System</div></div>`;
  };

  const savePdf = async (p: any) => {
    try {
      const result = await window.api.saveInvoicePdf(buildReceiptHtml(p));
      if (result?.success) {
        addNotification('PDF Saved', 'Payment receipt PDF saved.', 'success');
      } else if (result?.error && result.error !== 'Cancelled') {
        addNotification('PDF Failed', result.error || 'Could not generate PDF.', 'error');
      }
    } catch (err: any) {
      addNotification('PDF Error', err?.message || 'Unexpected error.', 'error');
    }
  };

  const printReceipt = async (p: any) => {
    await window.api.printInvoice(buildReceiptHtml(p));
  };

  const shareWhatsApp = (p: any) => {
    const msg = `*Payment Receipt*\n\n` +
      `*ID:* #${p.id}\n` +
      `*Date:* ${new Date(p.date_added).toLocaleString()}\n` +
      `*Party:* ${p.party_name}\n` +
      `*Type:* ${p.type}\n` +
      `*Amount:* ${fmtPKR(p.amount)}\n` +
      `*Notes:* ${p.notes || 'N/A'}\n\n` +
      `_Generated by Retailer POS_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Ledger</h1>
          <p className="text-muted-foreground mt-1 text-sm">Centralized view of all customer receipts and vendor settlements</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => loadPayments(true)} variant="outline" className="gap-2 h-10 shadow-sm border-primary/20 hover:bg-primary/5">
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button onClick={exportCSV} variant="outline" className="gap-2 h-10 shadow-sm border-primary/20 hover:bg-primary/5">
            <Download size={16} />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-lg bg-emerald-500/10 backdrop-blur-md border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600 flex items-center gap-2">
              <ArrowDownLeft size={16} /> Total Receipts (Incoming)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{fmtPKR(totalIncoming)}</div>
            <p className="text-xs text-emerald-600/70 mt-1">Customer payments + vendor returns</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-blue-500/10 backdrop-blur-md border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2">
              <ArrowUpRight size={16} /> Total Payments (Outgoing)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{fmtPKR(totalOutgoing)}</div>
            <p className="text-xs text-blue-600/70 mt-1">Vendor payments + customer refunds</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-card/60 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText size={16} /> Net Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", (totalIncoming - totalOutgoing) >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {fmtPKR(Math.abs(totalIncoming - totalOutgoing))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{(totalIncoming - totalOutgoing) >= 0 ? 'Net positive' : 'Net negative'} · {total} total records</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md overflow-hidden">
        <CardHeader className="border-b bg-muted/20 py-4 px-6 flex flex-row items-center justify-between gap-4">
          <div className="w-full flex flex-col md:flex-row gap-2">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Search by name, type, or notes..."
                className="pl-10 h-10 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
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
                <Input type="date" className="h-10 md:w-44" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <Input type="date" className="h-10 md:w-44" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </>
            )}
            <Button
              variant="outline"
              className="h-10"
              onClick={() => {
                setSearchTerm(searchInput.trim());
                setAppliedDateFilter(dateFilter);
                setAppliedFromDate(fromDate);
                setAppliedToDate(toDate);
                setOffset(0);
              }}
            >
              Apply
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
            <Filter size={14} /> Showing {filtered.length} of {total}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 border-y hover:bg-muted/30">
                <TableHead className="pl-6 py-4">Type</TableHead>
                <TableHead>Party / Name</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Notes / Reason</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-center pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                    <RefreshCcw size={32} className="mx-auto mb-3 opacity-20 animate-spin" />
                    Loading ledger...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center text-muted-foreground">
                    <CircleDollarSign size={40} className="mx-auto mb-3 opacity-20" />
                    No payments found in ledger
                  </TableCell>
                </TableRow>
              ) : filtered.map((p) => {
                const isIncoming = p.type === 'Customer Payment' || p.type === 'Purchase Return';
                const isRefund = p.type === 'Sale Refund';

                return (
                  <TableRow key={`${p.type}-${p.id}`} className="group hover:bg-primary/5 transition-colors cursor-default">
                    <TableCell className="pl-6">
                      <Badge
                        className={cn(
                          "rounded-full px-3 py-0.5 border-none text-xs font-semibold",
                          p.type === 'Sale Refund' && "bg-red-500/10 text-red-600",
                          p.type === 'Purchase Return' && "bg-amber-500/10 text-amber-600",
                          p.type === 'Customer Payment' && "bg-emerald-500/10 text-emerald-600",
                          p.type === 'Vendor Payment' && "bg-blue-500/10 text-blue-600"
                        )}
                      >
                        {p.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-foreground">{p.party_name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs italic">
                      {new Date(p.date_added).toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground italic">
                      {p.notes || '--'}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-black tracking-tight text-base",
                      isIncoming ? 'text-emerald-600' : 'text-blue-600',
                      isRefund && 'text-red-600'
                    )}>
                      {isIncoming ? '+' : '-'} {fmtPKR(p.amount)}
                    </TableCell>
                    <TableCell className="text-center pr-6">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => printReceipt(p)} title="Print Receipt">
                          <Printer size={15} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-violet-500 hover:text-violet-600 hover:bg-violet-500/10" onClick={() => savePdf(p)} title="Save as PDF">
                          <Download size={15} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500" onClick={() => shareWhatsApp(p)} title="Share on WhatsApp">
                          <MessageCircle size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {payments.length < total && !searchTerm && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center bg-muted/5">
                    <Button
                      variant="outline"
                      onClick={() => loadPayments(false)}
                      disabled={loadingMore}
                      className="gap-2 border-primary/20 hover:bg-primary/5 shadow-sm"
                    >
                      {loadingMore ? <RefreshCcw size={16} className="animate-spin" /> : <Plus size={16} />}
                      Load More ({payments.length} of {total})
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
