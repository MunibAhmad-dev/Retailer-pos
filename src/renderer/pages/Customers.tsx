import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Users, Pencil, Trash2, Phone, MessageCircle, DollarSign,
  ArrowRight, History, ShoppingBag, CreditCard, X, Receipt, Eye,
  Calendar, ChevronDown, Layers, Tag, Undo2, Printer, CheckCircle2, Check, FileText, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useNotifications } from '../components/NotificationProvider';
import { useNavigate } from 'react-router-dom';
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton, SearchSpinner } from '../components/Pagination';

interface Customer {
  id?: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

const HISTORY_PAGE = 15;
const fmtPKR = (n: any) => 'PKR ' + (Math.round(Number(n) || 0)).toLocaleString('en-PK');

function QuickPaymentInput({ sale, onPay }: { sale: any, onPay: (amount: string) => void }) {
  const [val, setVal] = React.useState('');
  return (
    <div className="flex-1 flex gap-1">
      <Input
        type="text"
        placeholder="Amount"
        className="h-8 text-[10px] font-bold w-24 shadow-sm"
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, ''))}
      />
      <Button 
        size="sm" 
        className="h-8 text-[10px] px-3 flex-1 bg-primary hover:bg-primary/90" 
        onClick={() => { 
          if (!val) return;
          onPay(val); 
          setVal(''); 
        }}
      >
        Pay
      </Button>
    </div>
  );
}

function ManualPaymentInput({ onAdd, onMarkAllPaid, balance, loading }: { onAdd: (amt: string) => void, onMarkAllPaid: () => void, balance: number, loading: boolean }) {
  const [val, setVal] = React.useState('');
  return (
    <div className="p-5 border-b bg-muted/10">
      <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><CreditCard size={16} /> Record Payment Received</h4>
      <div className="flex gap-2">
        <Input 
          type="text"
          placeholder="Amount received..." 
          value={val}
          onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, ''))} 
          className="flex-1" 
        />
        <Button disabled={loading || !val} onClick={() => { onAdd(val); setVal(''); }}>Add</Button>
      </div>
      {balance > 0 && (
        <Button variant="outline" className="w-full mt-2 text-primary" onClick={onMarkAllPaid} disabled={loading}>Mark All as Paid</Button>
      )}
    </div>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [current, setCurrent] = useState<Customer>({ name: '', phone: '', email: '', address: '' });
  const [isEditing, setIsEditing] = useState(false);

  // Details view state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // History pagination
  const [historyVisible, setHistoryVisible] = useState(HISTORY_PAGE);

  // Sale detail modal
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [saleItemsLoading, setSaleItemsLoading] = useState(false);
  const [inlinePayments, setInlinePayments] = useState<Record<number, string>>({});

  // Sale Return state
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, string>>({});
  const [returnReason, setReturnReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    try {
      const res = await window.api.getCustomers();
      if (res.success) setCustomers(res.data || []);
      else addNotification('Error', res.error || 'Failed to load customers', 'error');
    } catch (err) { console.error(err); }
  };

  const loadCustomerDetails = async (id: number) => {
    try {
      const res = await window.api.getCustomerDetails(id);
      if (res.success) setCustomerDetails(res.data);
      else addNotification('Error', res.error || 'Failed to clear balance', 'error');
    } catch (err) { console.error(err); }
  };

  const handleReturnSubmit = async () => {
    const itemsToReturn = saleItems.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name || item.name,
      quantity: parseInt(returnQuantities[item.product_id] || '0'),
      price: item.price
    })).filter(i => i.quantity > 0);

    if (itemsToReturn.length === 0) {
      addNotification('Validation', 'Please enter at least one quantity to return.', 'warning');
      return;
    }

    const totalReturnAmount = itemsToReturn.reduce((sum, i) => sum + (i.quantity * i.price), 0);

    if (confirm(`Are you sure you want to return items worth ${fmtPKR(totalReturnAmount)}?`)) {
      setIsSubmittingReturn(true);
      try {
        const res = await window.api.createSaleReturn({
          sale_id: selectedSale.id,
          items: itemsToReturn,
          total_returned: totalReturnAmount,
          reason: returnReason || 'Customer Return',
          notes: `Return processed from Customer page`
        });

        if (res.success) {
          addNotification('Success', 'Return processed successfully', 'success');
          setReturnModalOpen(false);
          loadCustomerDetails(selectedCustomer?.id!);
          // Refresh sale items to update previous returns
          const itemsRes = await window.api.getSaleItems(selectedSale.id);
          if (itemsRes.success) setSaleItems(itemsRes.data);
        } else {
          addNotification('Error', res.error || 'Failed to process return', 'error');
        }
      } catch (err) {
        console.error(err);
        addNotification('Error', 'An unexpected error occurred', 'error');
      } finally { setIsSubmittingReturn(false); }
    }
  };

  const handleCancelSale = async (saleId: number) => {
    if (confirm("Are you sure you want to CANCEL this sale? This will mark the bill as void.")) {
      const res = await window.api.cancelSale(saleId);
      if (res.success) {
        addNotification("Success", "Sale cancelled", "success");
        if (selectedCustomer?.id) loadCustomerDetails(selectedCustomer.id);
      } else {
        addNotification("Error", res.error || "Failed to cancel", "error");
      }
    }
  };

  const handleQuickPayment = async (sale: any) => {
    const amount = inlinePayments[sale.id];
    if (!amount || isNaN(Number(amount))) return;
    await handleAddPayment(sale.id, amount);
  };

  const openCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerDetails(null);
    setHistoryVisible(HISTORY_PAGE);
    setSelectedSale(null);
    if (c.id) loadCustomerDetails(c.id);
  };

  const closeCustomer = () => {
    setSelectedCustomer(null);
    setCustomerDetails(null);
    setPaymentAmount('');
    setSelectedSale(null);
  };

  const openSaleDetail = async (sale: any) => {
    setSelectedSale(sale);
    setSaleItemsLoading(true);
    try {
      const res = await window.api.getSaleItems(sale.id);
      if (res.success) setSaleItems(res.data || []);
    } catch { }
    finally { setSaleItemsLoading(false); }
  };

  const handleSearch = (v: string) => {
    setIsSearching(true);
    setSearchTerm(v);
    setTimeout(() => setIsSearching(false), 200);
  };

  const filteredCustomers = useMemo(() => customers.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || '').includes(searchTerm)
  ), [customers, searchTerm]);

  const { visible: visibleCustomers, hasMore, loadMore, total, showing } = usePagination(filteredCustomers, 10, 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current.name.trim()) {
      addNotification('Validation Error', 'Customer name is required.', 'warning');
      return;
    }
    if (isEditing && current.id) {
      const res = await window.api.updateCustomer(current.id, current);
      if (res.success) {
        addNotification('Customer updated', `${current.name} updated successfully.`, 'success');
        loadCustomers();
        setShowDialog(false);
      }
    } else {
      const res = await window.api.addCustomer(current);
      if (res.success) {
        addNotification('Customer added', `${current.name} added to database.`, 'success');
        loadCustomers();
        setShowDialog(false);
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (!id) return;
    if (confirm('Are you sure you want to delete this customer?')) {
      const res = await window.api.deleteCustomer(id);
      if (res.success) {
        addNotification('Customer deleted', 'Customer record removed.', 'info');
        if (selectedCustomer?.id === id) closeCustomer();
        loadCustomers();
      }
    }
  };

  const handleAddPayment = async (saleId?: number, amountOverride?: string) => {
    let finalAmount = amountOverride || paymentAmount;

    if (saleId && !amountOverride) {
      const amt = window.prompt("Enter amount collected:", String(Math.round(customerDetails.sales.find((s: any) => s.id === saleId)?.remaining || 0)));
      if (amt === null) return;
      finalAmount = amt;
    }

    if (!selectedCustomer?.id || !finalAmount || isNaN(Number(finalAmount)) || Number(finalAmount) <= 0) {
      addNotification('Validation', 'Please enter a valid amount.', 'warning');
      return;
    }

    const currentBalance = (customerDetails?.balance || 0);
    if (saleId) {
      const s = customerDetails.sales.find((sale: any) => sale.id === saleId);
      if (s && Number(finalAmount) > (s.remaining + 0.5)) {
        addNotification('Warning', 'Payment cannot exceed sale balance', 'warning');
        return;
      }
    } else if (Number(finalAmount) > currentBalance + 0.5) {
      addNotification('Warning', `Payment cannot exceed the remaining balance of ${fmtPKR(currentBalance)}`, 'warning');
      return;
    }

    setPaymentLoading(true);
    const res = await window.api.addCustomerPayment({
      customer_id: selectedCustomer.id,
      amount: Number(finalAmount),
      notes: saleId ? `Payment for Sale #${saleId}` : 'Manual Account Payment',
      sale_id: saleId
    });
    if (res.success) {
      addNotification('Payment Added', `PKR ${finalAmount} has been recorded.`, 'success');
      loadCustomerDetails(selectedCustomer.id!);
    } else addNotification('Error', res.error || 'Payment failed', 'error');
    setPaymentLoading(false);
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!window.confirm('Are you sure you want to delete this payment? This will restore the balance.')) return;
    const res = await window.api.deleteCustomerPayment(paymentId);
    if (res.success) {
      addNotification('Success', 'Payment deleted successfully', 'success');
      if (selectedCustomer?.id) {
        await loadCustomerDetails(selectedCustomer.id);
        if (selectedSale) {
          const freshCust = await window.api.getCustomerDetails(selectedCustomer.id);
          if (freshCust.success) {
            const freshSale = freshCust.data.sales.find((s: any) => s.id === selectedSale.id);
            if (freshSale) setSelectedSale(freshSale);
          }
        }
      }
    } else {
      addNotification('Error', res.error || 'Failed to delete payment', 'error');
    }
  };

  const handleMarkAllPaid = async () => {
    if (!selectedCustomer?.id || !customerDetails?.balance || customerDetails.balance <= 0) {
      addNotification('Info', 'Balance is already 0.', 'info');
      return;
    }
    setPaymentLoading(true);
    const res = await window.api.addCustomerPayment({ customer_id: selectedCustomer.id, amount: customerDetails.balance, notes: 'Marked All as Paid' });
    if (res.success) {
      addNotification('Settled', 'Customer balance settled.', 'success');
      loadCustomerDetails(selectedCustomer.id!);
    }
    setPaymentLoading(false);
  };

  const sendWhatsApp = (sale?: any) => {
    if (!selectedCustomer?.phone) { addNotification('No Phone', "Customer doesn't have a phone number.", 'warning'); return; }
    let number = selectedCustomer.phone.replace(/[^0-9]/g, '');
    if (number.startsWith('0')) number = '92' + number.substring(1);

    let msg = '';
    if (sale) {
      const remaining = Math.round(sale.remaining);
      msg = `Hello ${selectedCustomer.name},\nThis is regarding Sale Order #${sale.id} (Date: ${new Date(sale.date_created).toLocaleDateString()}).\nTotal: PKR ${sale.total.toLocaleString()}\nPaid: PKR ${sale.amountPaid.toLocaleString()}\nRemaining: PKR ${remaining.toLocaleString()}\nPlease acknowledge. Thank you!`;
    } else {
      const balance = customerDetails?.balance || 0;
      msg = `Hello ${selectedCustomer.name},\nYour total pending balance is PKR ${balance.toLocaleString('en-PK')}.\nThank you!`;
    }
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const printSaleInvoice = async (sale: any) => {
    try {
      const res = await window.api.getSaleItems(sale.id);
      if (!res.success) throw new Error("Failed to load items");
      const items = res.data;

      const html = `
        <div style="font-family: sans-serif; padding: 10px; max-width: 300px; margin: auto; border: 1px solid #eee;">
          <h2 style="text-align: center; margin-bottom: 5px;">INVOICE</h2>
          <p style="text-align: center; font-size: 12px; margin-top: 0;">Sale #${sale.id} | ${new Date(sale.date_created).toLocaleString()}</p>
          <hr/>
          <p><strong>Customer:</strong> ${selectedCustomer?.name}</p>
          <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1px solid #ddd;">
                <th style="text-align: left; padding: 4px 0;">Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((i: any) => `
                <tr>
                  <td style="padding: 4px 0;">${i.product_name || i.name}</td>
                  <td style="text-align: center;">${i.quantity}</td>
                  <td style="text-align: right;">${fmtPKR(i.price * i.quantity)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <hr/>
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>Grand Total:</span>
            <span>${fmtPKR(sale.total)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; margin-top: 4px;">
            <span>Amount Paid:</span>
            <span>${fmtPKR(sale.amountPaid)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; margin-top: 5px; color: red;">
            <span>Remaining:</span>
            <span>${fmtPKR(sale.remaining)}</span>
          </div>
          <p style="text-align: center; font-size: 10px; margin-top: 20px; color: #888;">Thank you for your business!</p>
        </div>
      `;
      await window.api.printInvoice(html);
    } catch (e) {
      addNotification("Error", "Failed to print invoice", "error");
    }
  };

  const historyLogs = useMemo(() => {
    if (!customerDetails) return [];
    const sales = (customerDetails.sales || []).map((s: any) => ({ ...s, type: 'SALE', date: s.date_created }));
    const payments = (customerDetails.payments || []).map((p: any) => ({ ...p, type: 'PAYMENT', date: p.date_added }));
    const returns = (customerDetails.returns || []).map((r: any) => ({ ...r, type: 'RETURN', date: r.date_returned, total: r.total_returned }));
    return [...sales, ...payments, ...returns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [customerDetails]);

  const visibleHistory = historyLogs.slice(0, historyVisible);
  const hasMoreHistory = historyVisible < historyLogs.length;

  return (
    <div className="h-full flex gap-6">
      {/* ─── Customer List ─── */}
      <Card className="flex-1 shadow-lg border-border/50 flex flex-col min-w-0 bg-card overflow-hidden">
        <CardHeader className="border-b bg-muted/10 pb-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <CardTitle className="text-3xl font-black tracking-tight flex items-center gap-2">
                <Users className="text-primary" size={28} /> Customers & Credit
              </CardTitle>
              <CardDescription className="text-sm mt-1">Manage customers, loans (Qaraz), and payments</CardDescription>
            </div>
            <Button onClick={() => { setCurrent({ name: '', phone: '', email: '', address: '' }); setIsEditing(false); setShowDialog(true); }} className="gap-2 shadow-md">
              <Plus size={18} /> New Customer
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input placeholder="Search by name or phone..." className="pl-10 h-12 text-lg shadow-sm bg-background border-border" value={searchTerm} onChange={(e) => handleSearch(e.target.value)} />
            {isSearching && <SearchSpinner className="right-3 top-3.5 absolute" />}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0">
          {customers.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Users size={48} className="mx-auto opacity-20 mb-4" />
              <p className="text-lg font-medium">No customers found.</p>
              <p className="text-sm">Click "New Customer" to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {visibleCustomers.map((c) => (
                <div key={c.id} className={`flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer transition-colors ${selectedCustomer?.id === c.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`} onClick={() => openCustomer(c)}>
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0 font-bold text-lg">{c.name.charAt(0).toUpperCase()}</div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-lg truncate">{c.name}</h4>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        {c.phone && <span className="flex items-center gap-1.5"><Phone size={14} /> {c.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="icon" className="hover:text-primary" onClick={(e) => { e.stopPropagation(); setCurrent({ ...c }); setIsEditing(true); setShowDialog(true); }}><Pencil size={18} /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={(e) => handleDelete(e, c.id)}><Trash2 size={18} /></Button>
                    <ArrowRight size={20} className="text-muted-foreground/40 ml-2" />
                  </div>
                </div>
              ))}
              <LoadMoreButton hasMore={hasMore} loadMore={loadMore} showing={showing} total={total} itemType="customers" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Customer Detail Panel ─── */}
      {selectedCustomer && (
        <Card className="w-[420px] shrink-0 shadow-lg border-border/50 flex flex-col bg-card animate-in slide-in-from-right-8 duration-300">
          <CardHeader className="border-b bg-muted/20 pb-4 relative">
            <Button variant="ghost" size="icon" className="absolute right-4 top-4 rounded-full" onClick={closeCustomer}><X size={18} /></Button>
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 font-black text-xl mb-2">{selectedCustomer.name.charAt(0).toUpperCase()}</div>
            <CardTitle className="text-xl font-bold pr-10">{selectedCustomer.name}</CardTitle>
            <CardDescription className="flex flex-col gap-1 mt-1">
              {selectedCustomer.phone && <span className="flex items-center gap-2"><Phone size={13} /> {selectedCustomer.phone}</span>}
              {selectedCustomer.address && <span className="text-xs">{selectedCustomer.address}</span>}
            </CardDescription>
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="flex-1 gap-2 bg-green-600 hover:bg-green-700" onClick={sendWhatsApp}><MessageCircle size={16} /> WhatsApp</Button>
              <Button size="sm" variant="outline" className="flex-1 gap-2" onClick={() => navigate(`/sales`)}><ShoppingBag size={16} /> New Sale</Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-0">
            {!customerDetails ? (
              <div className="p-8 text-center text-muted-foreground animate-pulse">Loading details...</div>
            ) : (
              <div className="flex flex-col">
                {/* Financials */}
                <div className="grid grid-cols-2 gap-4 p-5 bg-card border-b">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Total Purchased</span>
                    <span className="text-lg font-bold">{fmtPKR(customerDetails.totalTaken || 0)}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Amount Paid</span>
                    <span className="text-lg font-bold text-emerald-600">{fmtPKR(customerDetails.totalPaid || 0)}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase text-amber-600">Items Returned (-)</span>
                    <span className="text-lg font-bold text-amber-600">{fmtPKR(customerDetails.totalReturned || 0)}</span>
                  </div>
                  <div className="col-span-2 mt-2 pt-4 border-t border-dashed flex items-center justify-between bg-muted/5 -mx-5 px-5 py-3">
                    <span className="text-sm font-black uppercase text-muted-foreground">Remaining Balance</span>
                    <span className={`text-2xl font-black ${customerDetails.balance > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                      {fmtPKR(Math.max(0, customerDetails.balance || 0))}
                    </span>
                  </div>
                </div>

                <ManualPaymentInput 
                  balance={customerDetails.balance} 
                  loading={paymentLoading} 
                  onAdd={(amt) => handleAddPayment(undefined, amt)} 
                  onMarkAllPaid={handleMarkAllPaid} 
                />

                {/* Combined Transaction History */}
                <div className="p-5">
                  <h4 className="text-sm font-bold mb-4 flex items-center gap-2 text-primary">
                    <History size={16} /> Transaction History
                    <Badge variant="secondary" className="ml-auto text-[10px]">{historyLogs.length} entries</Badge>
                  </h4>

                  <div className="flex flex-col gap-4">
                    {historyLogs.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-xl bg-muted/5">No activity found.</div>
                    ) : (
                      visibleHistory.map((item: any, idx: number) => {
                        if (item.type === 'SALE') {
                          const s = item;
                          return (
                            <div key={`s-${s.id}`} className="bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border-border/60 hover:border-blue-300/30">
                              {/* Card Header */}
                              <div className="p-4 bg-muted/5 flex justify-between items-start border-b border-dashed">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sale #{s.id}</span>
                                    {s.status === 'Cancelled' ? (
                                      <Badge className="bg-slate-200 text-slate-600 hover:bg-slate-200 text-[10px] py-0 h-4 border-none uppercase">Cancelled</Badge>
                                    ) : s.status === 'Returned' || s.amountReturned > 0 ? (
                                      <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-[10px] py-0 h-4 border-none uppercase">Returned</Badge>
                                    ) : Math.round(s.remaining) <= 0 ? (
                                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px] py-0 h-4 border-none uppercase">Settled</Badge>
                                    ) : s.amountPaid > 0 ? (
                                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] py-0 h-4 border-none uppercase">Partial</Badge>
                                    ) : (
                                      <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10 text-[10px] py-0 h-4 border-none uppercase">Pending</Badge>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 font-medium">
                                    <Calendar size={10} /> {new Date(s.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-blue-500/10 hover:text-blue-600" onClick={() => openSaleDetail(s)}>
                                  <Eye size={14} />
                                </Button>
                              </div>

                              {/* Card Body */}
                              <div className="p-4 space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Total</p>
                                    <p className="text-sm font-bold">{fmtPKR(s.total)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Paid</p>
                                    <p className="text-sm font-bold text-emerald-600">{fmtPKR(s.amountPaid)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Balance</p>
                                    <p className={`text-sm font-black ${Math.round(s.remaining) > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                                      {fmtPKR(Math.max(0, Math.round(s.remaining)))}
                                    </p>
                                  </div>
                                </div>

                                <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/40">
                                  <p className="font-bold mb-0.5 flex items-center gap-1"><Layers size={10} /> Bill Items:</p>
                                  <p className="line-clamp-2">
                                    {s.items?.map((item: any) => `${item.product_name} (x${item.quantity})`).join(', ') || 'No item data available'}
                                  </p>
                                </div>

                                <div className="flex gap-1.5 pt-1">
                                  {s.status !== 'Cancelled' && s.remaining > 0.1 && (
                                    <QuickPaymentInput 
                                      sale={s} 
                                      onPay={(amt) => handleAddPayment(s.id, amt)} 
                                    />
                                  )}
                                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => openSaleDetail(s)}>
                                    <Eye size={12} />
                                  </Button>
                                  {s.status !== 'Cancelled' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => handleCancelSale(s.id)}
                                      title="Cancel Sale"
                                    >
                                      <X size={12} />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 border-emerald-100 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                    onClick={() => sendWhatsApp(s)}
                                  >
                                    <MessageCircle size={14} />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 border-blue-200 text-blue-600 hover:bg-blue-50"
                                    onClick={() => printSaleInvoice(s)}
                                  >
                                    <Printer size={14} />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        } else if (item.type === 'PAYMENT') {
                          return (
                            <div key={`pay-${item.id}-${idx}`} className="bg-emerald-50/40 border border-emerald-100 p-3 rounded-xl flex justify-between items-center group">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                     <CheckCircle2 size={14} />
                                  </div>
                                  <div>
                                     <p className="text-xs font-black uppercase text-emerald-800">Payment Collected</p>
                                     <p className="text-[10px] text-emerald-600/70">{new Date(item.date).toLocaleString()}</p>
                                  </div>
                               </div>
                               <div className="text-right flex items-center gap-3">
                                  <span className="text-sm font-black text-emerald-700">{fmtPKR(item.amount)}</span>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleDeletePayment(item.id)}>
                                     <Trash2 size={12} />
                                  </Button>
                               </div>
                            </div>
                          );
                        } else if (item.type === 'RETURN') {
                          return (
                            <div key={`ret-${item.id}-${idx}`} className="bg-amber-50/40 border border-amber-100 p-3 rounded-xl flex justify-between items-center">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                     <Undo2 size={14} />
                                  </div>
                                  <div>
                                     <p className="text-xs font-black uppercase text-amber-800">Return Request</p>
                                     <p className="text-[10px] text-amber-600/70">{new Date(item.date).toLocaleString()}</p>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <span className="text-sm font-black text-amber-700">-{fmtPKR(item.total)}</span>
                                </div>
                            </div>
                          );
                        }
                        return null;
                      })
                    )}
                  </div>

                  {hasMoreHistory && (
                    <Button variant="ghost" onClick={() => setHistoryVisible(v => v + HISTORY_PAGE)} className="w-full text-xs text-primary mt-4 border border-dashed rounded-xl h-10">
                      <ChevronDown size={14} className="mr-1" /> Load more entries ({historyVisible} of {historyLogs.length})
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Sale Detail Modal ─── */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedSale(null)}>
          <Card className="w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <CardHeader className="border-b pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2"><Receipt size={18} className="text-blue-500" /> Sale #{selectedSale.id}</CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(selectedSale.date_created).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    {selectedSale.payment_method && <Badge variant="outline" className="text-xs">{selectedSale.payment_method}</Badge>}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="text-2xl font-black text-destructive">{fmtPKR(selectedSale.total)}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
              {/* Payment History for this Sale */}
              <div className="p-4 bg-muted/20 border-b">
                <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                  <History size={14} /> Payment Logs
                </h4>
                {(selectedSale.linkedPayments || []).length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2 italic">No payments collected for this bill yet.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(selectedSale.linkedPayments || []).map((pay: any) => (
                      <div key={pay.id} className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-border shadow-sm text-xs group">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        <span className="font-bold">{fmtPKR(pay.amount)}</span>
                        <span className="text-[10px] text-muted-foreground border-l pl-2">{new Date(pay.date_added || pay.date_created).toLocaleDateString()}</span>
                        <button
                          onClick={() => handleDeletePayment(pay.id)}
                          className="ml-auto text-destructive hover:scale-110 transition-all p-1 bg-destructive/5 rounded-full"
                          title="Undo Payment"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {saleItemsLoading ? (
                <div className="p-8 text-center text-muted-foreground animate-pulse">Loading items...</div>
              ) : saleItems.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Layers size={32} className="mx-auto opacity-20 mb-2" />
                  <p className="text-sm">No item breakdown found for this sale.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b sticky top-0">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-xs uppercase">Item</th>
                      <th className="text-center py-3 px-3 font-semibold text-muted-foreground text-xs uppercase">Qty</th>
                      <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-xs uppercase">Unit Price</th>
                      <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-xs uppercase">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {saleItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="py-3 px-4">
                          <div className="font-semibold">{item.product_name || item.name || 'Unknown Item'}</div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono">{item.quantity}</td>
                        <td className="py-3 px-4 text-right font-mono">{fmtPKR(item.price)}</td>
                        <td className="py-3 px-4 text-right font-bold text-blue-600">{fmtPKR(item.price * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 bg-muted/20">
                    {selectedSale.discount > 0 && (
                      <tr>
                        <td colSpan={3} className="py-2 px-4 text-sm text-muted-foreground">Discount</td>
                        <td className="py-2 px-4 text-right text-sm text-emerald-600 font-semibold">- {fmtPKR(selectedSale.discount)}</td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={3} className="py-3 px-4 font-bold text-sm">Grand Total</td>
                      <td className="py-3 px-4 text-right font-black text-lg text-destructive">{fmtPKR(selectedSale.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-4 border-t">
              <div className="flex w-full gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedSale(null)}>Close</Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-2 shadow-sm bg-amber-600 hover:bg-amber-700"
                  disabled={selectedSale.status === 'Cancelled'}
                  onClick={() => {
                    const initialQtys: Record<number, string> = {};
                    saleItems.forEach(item => { initialQtys[item.product_id] = ''; });
                    setReturnQuantities(initialQtys);
                    setReturnReason('');
                    setReturnModalOpen(true);
                  }}
                >
                  <Undo2 size={16} /> Return Items
                </Button>
              </div>
              <div className="flex w-full gap-3">
                <Button
                  variant="secondary"
                  className="flex-1 gap-2 text-xs"
                  onClick={async () => {
                    const settingsRes = await window.api.getSettings();
                    const settings = settingsRes.success ? settingsRes.data : {};
                    // We need to build the invoice HTML. Since the helper is in Sales.tsx, 
                    // and we want to avoid duplication, we'll use a simplified version here 
                    // or just redirect to Sales? No, better to have a helper.
                    // For now, I'll use a standard alert or simple print.
                    window.api.printInvoice(`
                      <div style="font-family:sans-serif;padding:20px;">
                        <h2>Sale #${selectedSale.id}</h2>
                        <p>Date: ${new Date(selectedSale.date_created).toLocaleString()}</p>
                        <hr/>
                        ${saleItems.map(i => `<p>${i.product_name} x${i.quantity}: ${fmtPKR(i.price * i.quantity)}</p>`).join('')}
                        <hr/>
                        <h3>Total: ${fmtPKR(selectedSale.total)}</h3>
                      </div>
                    `);
                  }}
                >
                  <Printer size={14} /> Print
                </Button>
                <Button
                  className="flex-1 gap-2 text-xs bg-green-600 hover:bg-green-700 text-white border-transparent"
                  onClick={() => {
                    const msg = `*Sale #${selectedSale.id}*\nTotal: ${fmtPKR(selectedSale.total)}\nItems:\n` +
                      saleItems.map(i => `- ${i.product_name} x${i.quantity}`).join('\n');
                    const phone = selectedCustomer?.phone?.replace(/\D/g, '') || '';
                    window.open(`https://wa.me/${phone.startsWith('0') ? '92' + phone.substring(1) : phone}?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                >
                  <MessageCircle size={14} /> WhatsApp
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* ─── Add / Edit Dialog ─── */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl">
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>{isEditing ? 'Edit Customer' : 'Add New Customer'}</CardTitle>
                <CardDescription>Enter contact details below.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Full Name <span className="text-destructive">*</span></label>
                  <Input type="text" required value={current.name} onChange={(e) => setCurrent({ ...current, name: e.target.value })} placeholder="e.g. Ahmad Khan" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Phone Number</label>
                  <Input type="tel" value={current.phone || ''} onChange={(e) => setCurrent({ ...current, phone: e.target.value })} placeholder="0300 1234567" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Address</label>
                  <Input type="text" value={current.address || ''} onChange={(e) => setCurrent({ ...current, address: e.target.value })} placeholder="Shop 12, Main Bazar" />
                </div>
              </CardContent>
              <CardFooter className="flex gap-3 pt-4 border-t">
                <Button type="button" variant="outline" className="w-full" onClick={() => setShowDialog(false)}>Cancel</Button>
                <Button type="submit" className="w-full">{isEditing ? 'Save Changes' : 'Create Customer'}</Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

      {/* ─── Sale Return Modal ─── */}
      {returnModalOpen && selectedSale && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <Card className="w-full max-w-2xl shadow-2xl border-none overflow-hidden animate-in zoom-in-95 duration-300">
            <CardHeader className="bg-amber-600 text-white p-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Undo2 size={24} /> Return Items (Sale #{selectedSale.id})
                </CardTitle>
                <CardDescription className="text-amber-50/70">
                  Select quantities to return from this sale.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10" onClick={() => setReturnModalOpen(false)}>
                <X size={20} />
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="rounded-xl border bg-muted/20 overflow-hidden max-h-[40vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 sticky top-0 z-10">
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Sold</TableHead>
                      <TableHead className="text-center">Prev. Returned</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right w-32">Qty to Return</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saleItems.map((item) => {
                      const prevReturned = item.quantity_returned || 0;
                      const availableToReturn = Math.max(0, item.quantity - prevReturned);
                      return (
                        <TableRow key={item.product_id}>
                          <TableCell className="font-medium">{item.product_name || item.name}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-center text-amber-600 font-bold">{prevReturned}</TableCell>
                          <TableCell className="text-right">{fmtPKR(item.price)}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="text"
                              className={cn(
                                "h-8 text-right font-bold border-amber-200 focus:border-amber-500",
                                availableToReturn === 0 && "opacity-50 cursor-not-allowed bg-muted"
                              )}
                              value={returnQuantities[item.product_id] || ''}
                              disabled={availableToReturn <= 0}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9]/g, '');
                                const val = Math.min(availableToReturn, parseInt(raw) || 0);
                                setReturnQuantities(prev => ({
                                  ...prev,
                                  [item.product_id]: val === 0 && raw === '' ? '' : String(val)
                                }));
                              }}
                              placeholder="0"
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
                  <FileText size={16} className="text-muted-foreground" /> Reason for Return
                </label>
                <Input
                  placeholder="e.g., Defective item, customer changed mind..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 p-6 flex gap-3 border-t">
              <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setReturnModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-12 rounded-xl bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20 gap-2"
                onClick={handleReturnSubmit}
                disabled={isSubmittingReturn}
              >
                {isSubmittingReturn ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                {isSubmittingReturn ? 'Processing...' : 'Confirm Return'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
