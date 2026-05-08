import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Pencil, Trash2, Phone, MessageCircle, DollarSign,
  ArrowRight, History, ShoppingBag, CreditCard, X, Truck, Package,
  ChevronDown, Eye, Calendar, Hash, Layers, Undo2, RefreshCw, FileText, CheckCircle2, Check, Printer
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useNotifications } from '../components/NotificationProvider';
import { useNavigate } from 'react-router-dom';
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton, SearchSpinner } from '../components/Pagination';
import { cn } from '../lib/utils';

interface Vendor {
  id?: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

const HISTORY_PAGE = 15;
const fmtPKR = (n: any) => 'PKR ' + (Math.round(Number(n) || 0)).toLocaleString('en-PK');

function QuickPaymentInput({ purchase, onPay }: { purchase: any, onPay: (amount: string) => void }) {
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
      <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><CreditCard size={16} /> Record Payment Sent</h4>
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Amount paid..."
          value={val}
          onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, ''))}
          className="flex-1"
        />
        <Button disabled={loading || !val} onClick={() => { onAdd(val); setVal(''); }}>Log</Button>
      </div>
      {balance > 0 && (
        <Button variant="outline" className="w-full mt-2 text-primary" onClick={onMarkAllPaid} disabled={loading}>Mark Balance as Cleared</Button>
      )}
    </div>
  );
}

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [current, setCurrent] = useState<Vendor>({ name: '', phone: '', email: '', address: '' });
  const [isEditing, setIsEditing] = useState(false);

  // Details view state
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorDetails, setVendorDetails] = useState<any>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // History pagination
  const [historyVisible, setHistoryVisible] = useState(HISTORY_PAGE);

  // Purchase detail modal
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);
  const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
  const [purchaseItemsLoading, setPurchaseItemsLoading] = useState(false);

  // Purchase Return state
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, string>>({});
  const [returnReason, setReturnReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [inlinePayments, setInlinePayments] = useState<Record<number, string>>({});

  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => { loadVendors(); }, []);

  const loadVendors = async () => {
    try {
      const res = await window.api.getVendors();
      if (res.success) setVendors(res.data || []);
      else addNotification('Error', res.error || 'Failed to load vendors', 'error');
    } catch (err) { console.error(err); }
  };

  const loadVendorDetails = async (id: number) => {
    try {
      const res = await window.api.getVendorDetails(id);
      if (res.success) setVendorDetails(res.data);
      else addNotification('Error', res.error || 'Failed to load details', 'error');
    } catch (err) { console.error(err); }
  };

  const openVendor = (v: Vendor) => {
    setSelectedVendor(v);
    setVendorDetails(null);
    setHistoryVisible(HISTORY_PAGE);
    setSelectedPurchase(null);
    if (v.id) loadVendorDetails(v.id);
  };

  const closeVendor = () => {
    setSelectedVendor(null);
    setVendorDetails(null);
    setPaymentAmount('');
    setSelectedPurchase(null);
  };

  const openPurchaseDetail = async (purchase: any) => {
    setSelectedPurchase(purchase);
    setPurchaseItemsLoading(true);
    try {
      const res = await window.api.getPurchaseItems(purchase.id);
      if (res.success) setPurchaseItems(res.data || []);
    } catch { }
    finally { setPurchaseItemsLoading(false); }
  };

  const handleReturnSubmit = async () => {
    if (!selectedPurchase) return;

    const itemsToReturn = purchaseItems
      .filter(item => (parseInt(String(returnQuantities[item.id])) || 0) > 0)
      .map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: parseInt(String(returnQuantities[item.id])) || 0,
        purchase_price: item.purchase_price
      }));

    if (itemsToReturn.length === 0) {
      addNotification("Warning", "Please select at least one item to return", "warning");
      return;
    }

    const totalReturned = itemsToReturn.reduce((sum, item) => sum + (item.purchase_price * item.quantity), 0);

    setIsSubmittingReturn(true);
    try {
      const res = await window.api.createPurchaseReturn({
        purchase_id: selectedPurchase.id,
        items: itemsToReturn,
        reason: returnReason,
        total_returned: totalReturned
      });

      if (res.success) {
        addNotification("Success", "Return processed successfully", "success");
        setReturnModalOpen(false);
        setSelectedPurchase(null);
        if (selectedVendor?.id) loadVendorDetails(selectedVendor.id);
        loadVendors();
      } else {
        addNotification("Error", res.error || "Failed to process return", "error");
      }
    } catch (err) {
      addNotification("Error", "Critical error processing return", "error");
    } finally { setIsSubmittingReturn(false); }
  };

  const handleCancelPurchase = async (purchaseId: number) => {
    if (confirm("Are you sure you want to CANCEL this purchase? This will mark the bill as void.")) {
      const res = await window.api.cancelPurchase(purchaseId);
      if (res.success) {
        addNotification("Success", "Purchase cancelled", "success");
        if (selectedVendor?.id) loadVendorDetails(selectedVendor.id);
      } else {
        addNotification("Error", res.error || "Failed to cancel", "error");
      }
    }
  };

  const handleSearch = (v: string) => {
    setIsSearching(true);
    setSearchTerm(v);
    setTimeout(() => setIsSearching(false), 200);
  };

  const filteredVendors = useMemo(() => vendors.filter((v) =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.phone || '').includes(searchTerm)
  ), [vendors, searchTerm]);

  const { visible: visibleVendors, hasMore, loadMore, total, showing } = usePagination(filteredVendors, 10, 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current.name.trim()) {
      addNotification('Validation Error', 'Vendor name is required.', 'warning');
      return;
    }
    if (isEditing && current.id) {
      const res = await window.api.updateVendor(current.id, current);
      if (res.success) {
        setVendors(vendors.map((v) => v.id === current.id ? res.data : v));
        if (selectedVendor?.id === current.id) setSelectedVendor(res.data);
        setShowDialog(false);
        addNotification('Success', 'Vendor updated', 'success');
      } else addNotification('Error', res.error || 'Failed to update', 'error');
    } else {
      const res = await window.api.addVendor(current);
      if (res.success) {
        setVendors([res.data, ...vendors]);
        setShowDialog(false);
        addNotification('Success', 'Vendor created', 'success');
      } else addNotification('Error', res.error || 'Failed to create', 'error');
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this vendor?')) {
      const res = await window.api.deleteVendor(id);
      if (res.success) {
        setVendors(vendors.filter((v) => v.id !== id));
        if (selectedVendor?.id === id) closeVendor();
        addNotification('Deleted', 'Vendor removed successfully.', 'success');
      } else addNotification('Error', res.error || 'Failed to delete vendor', 'error');
    }
  };

  const openEdit = (v: Vendor, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrent(v);
    setIsEditing(true);
    setShowDialog(true);
  };

  const handleQuickPayment = async (purchase: any) => {
    const amount = inlinePayments[purchase.id];
    if (!amount || isNaN(Number(amount))) return;
    await handleAddPayment(purchase.id, amount);
  };

  const handleAddPayment = async (purchaseId?: number, amountOverride?: string) => {
    let finalAmount = amountOverride || paymentAmount;

    if (purchaseId && !amountOverride) {
      const amt = window.prompt("Enter payment amount:", String(Math.round(vendorDetails.purchases.find((p: any) => p.id === purchaseId)?.remaining || 0)));
      if (amt === null) return;
      finalAmount = amt;
    }

    if (!selectedVendor?.id || !finalAmount || isNaN(Number(finalAmount)) || Number(finalAmount) <= 0) return;

    // Allow payments regardless of global balance to support invoice-specific settlement and prepayments

    setPaymentLoading(true);
    try {
      const res = await window.api.addVendorPayment({
        vendor_id: selectedVendor.id,
        amount: Number(finalAmount),
        notes: purchaseId ? `Payment for PO #${purchaseId}` : 'Manual Account Payment',
        purchase_id: purchaseId
      });
      if (res.success) {
        addNotification('Payment Recorded', `Successfully recorded PKR ${finalAmount}`, 'success');
        if (selectedVendor?.id) {
          await loadVendorDetails(selectedVendor.id);
          // Refresh the selected purchase modal if it's open
          if (selectedPurchase) {
            const freshVendor = await window.api.getVendorDetails(selectedVendor.id);
            if (freshVendor.success) {
              const freshPurchase = freshVendor.data.purchases.find((p: any) => p.id === selectedPurchase.id);
              if (freshPurchase) setSelectedPurchase(freshPurchase);
            }
          }
        }
      } else addNotification('Error', res.error || 'Failed to record payment', 'error');
    } finally { setPaymentLoading(false); }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!window.confirm('Are you sure you want to delete this payment? This will restore the balance.')) return;
    const res = await window.api.deleteVendorPayment(paymentId);
    if (res.success) {
      addNotification('Success', 'Payment deleted successfully', 'success');
      if (selectedVendor?.id) {
        await loadVendorDetails(selectedVendor.id);
        // Refresh selected purchase modal if open
        if (selectedPurchase) {
          const freshVendor = await window.api.getVendorDetails(selectedVendor.id);
          if (freshVendor.success) {
            const freshPurchase = freshVendor.data.purchases.find((p: any) => p.id === selectedPurchase.id);
            if (freshPurchase) setSelectedPurchase(freshPurchase);
          }
        }
      }
    } else {
      addNotification('Error', res.error || 'Failed to delete payment', 'error');
    }
  };

  const handleMarkAllPaid = async () => {
    if (!selectedVendor?.id || !vendorDetails?.balance || vendorDetails.balance <= 0) return;
    if (confirm(`Record a payment of PKR ${vendorDetails.balance} to clear the entire balance?`)) {
      setPaymentLoading(true);
      try {
        const res = await window.api.addVendorPayment({ vendor_id: selectedVendor.id, amount: vendorDetails.balance, notes: 'Cleared full balance' });
        if (res.success) {
          addNotification('Balance Cleared', `Paid full balance of PKR ${vendorDetails.balance}`, 'success');
          loadVendorDetails(selectedVendor.id!);
        } else addNotification('Error', res.error || 'Failed to clear balance', 'error');
      } finally { setPaymentLoading(false); }
    }
  };

  const sendWhatsApp = (purchase?: any) => {
    if (!selectedVendor?.phone) { addNotification('No Phone', "Vendor doesn't have a phone number.", 'warning'); return; }
    const cleanPhone = selectedVendor.phone.replace(/[^0-9]/g, '');
    const finalPhone = cleanPhone.startsWith('0') ? '92' + cleanPhone.substring(1) : cleanPhone;

    let msg = '';
    if (purchase) {
      const remaining = Math.round(purchase.remaining);
      msg = `Hello ${selectedVendor.name},\nThis is regarding Purchase Order #${purchase.id} (Date: ${new Date(purchase.date_created).toLocaleDateString()}).\nTotal: PKR ${purchase.total.toLocaleString()}\nPaid: PKR ${purchase.amountPaid.toLocaleString()}\nRemaining: PKR ${remaining.toLocaleString()}\nPlease acknowledge. Thank you!`;
    } else {
      const balance = vendorDetails?.balance || 0;
      msg = `Hello ${selectedVendor.name},\nOur current total pending balance to you is PKR ${balance.toLocaleString('en-PK')}.\nThank you!`;
    }

    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const printPurchaseInvoice = async (purchase: any) => {
    try {
      const res = await window.api.getPurchaseItems(purchase.id);
      if (!res.success) throw new Error("Failed to load items");
      const items = res.data;

      const html = `
        <div style="font-family: sans-serif; padding: 10px; max-width: 300px; margin: auto; border: 1px solid #eee;">
          <h2 style="text-align: center; margin-bottom: 5px;">PURCHASE INVOICE</h2>
          <p style="text-align: center; font-size: 12px; margin-top: 0;">PO #${purchase.id} | ${new Date(purchase.date_created).toLocaleString()}</p>
          <hr/>
          <p><strong>Vendor:</strong> ${selectedVendor?.name}</p>
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
                  <td style="padding: 4px 0;">${i.product_name}</td>
                  <td style="text-align: center;">${i.quantity_added}</td>
                  <td style="text-align: right;">${fmtPKR(i.purchase_price * i.quantity_added)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <hr/>
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>Grand Total:</span>
            <span>${fmtPKR(purchase.total)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; margin-top: 4px;">
            <span>Amount Paid:</span>
            <span>${fmtPKR(purchase.amountPaid)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; margin-top: 5px; color: red;">
            <span>Remaining:</span>
            <span>${fmtPKR(purchase.remaining)}</span>
          </div>
          <p style="text-align: center; font-size: 10px; margin-top: 20px; color: #888;">Generated by POS System</p>
        </div>
      `;
      await window.api.printInvoice(html);
    } catch (e) {
      addNotification("Error", "Failed to print invoice", "error");
    }
  };

  // Unified sorted timeline
  const historyLogs = useMemo(() => {
    if (!vendorDetails) return [];
    const logs: any[] = [];
    vendorDetails.purchases?.forEach((p: any) => logs.push({ ...p, type: 'PURCHASE', date: p.date_created }));
    vendorDetails.payments?.forEach((p: any) => logs.push({ ...p, type: 'PAYMENT', date: p.date_created }));
    vendorDetails.returns?.forEach((r: any) => logs.push({ ...r, type: 'RETURN', date: r.date_returned, amount: r.total_returned }));
    return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [vendorDetails]);

  const visibleHistory = historyLogs.slice(0, historyVisible);
  const hasMoreHistory = historyVisible < historyLogs.length;

  return (
    <div className="h-full flex gap-6">
      {/* ─── Vendor List ─── */}
      <Card className="flex-1 shadow-lg border-border/50 flex flex-col min-w-0 bg-card overflow-hidden">
        <CardHeader className="border-b bg-muted/10 pb-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <CardTitle className="text-3xl font-black tracking-tight flex items-center gap-2">
                <Truck className="text-primary" size={28} /> Vendors
              </CardTitle>
              <CardDescription className="text-sm mt-1">Manage your suppliers and accounts payable</CardDescription>
            </div>
            <Button onClick={() => { setCurrent({ name: '', phone: '', email: '', address: '' }); setIsEditing(false); setShowDialog(true); }} className="gap-2 shadow-md">
              <Plus size={18} /> Add Vendor
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input placeholder="Search vendors by name or phone..." className="pl-10 h-12 text-lg shadow-sm bg-background border-border" value={searchTerm} onChange={(e) => handleSearch(e.target.value)} />
            {isSearching && <SearchSpinner className="right-3 top-3.5 absolute" />}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0">
          {vendors.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Truck size={48} className="mx-auto opacity-20 mb-4" />
              <p className="text-lg font-medium">No vendors found.</p>
              <p className="text-sm">Click "Add Vendor" to create your first supplier.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {visibleVendors.map((v) => (
                <div key={v.id} className={`flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer transition-colors ${selectedVendor?.id === v.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`} onClick={() => openVendor(v)}>
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 font-bold text-lg">{v.name.charAt(0).toUpperCase()}</div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-lg truncate">{v.name}</h4>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        {v.phone && <span className="flex items-center gap-1.5"><Phone size={14} /> {v.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="icon" className="hover:text-primary" onClick={(e) => openEdit(v, e)}><Pencil size={18} /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={(e) => handleDelete(v.id!, e)}><Trash2 size={18} /></Button>
                    <ArrowRight size={20} className="text-muted-foreground/40 ml-2" />
                  </div>
                </div>
              ))}
              <LoadMoreButton hasMore={hasMore} loadMore={loadMore} showing={showing} total={total} itemType="vendors" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Vendor Detail Panel ─── */}
      {selectedVendor && (
        <Card className="w-[420px] shrink-0 shadow-lg border-border/50 flex flex-col bg-card animate-in slide-in-from-right-8 duration-300">
          <CardHeader className="border-b bg-muted/20 pb-4 relative">
            <Button variant="ghost" size="icon" className="absolute right-4 top-4 rounded-full" onClick={closeVendor}><X size={18} /></Button>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xl mb-2">{selectedVendor.name.charAt(0).toUpperCase()}</div>
            <CardTitle className="text-xl font-bold pr-10">{selectedVendor.name}</CardTitle>
            <CardDescription className="flex flex-col gap-1 mt-1">
              {selectedVendor.phone && <span className="flex items-center gap-2"><Phone size={13} /> {selectedVendor.phone}</span>}
              {selectedVendor.address && <span className="text-xs">{selectedVendor.address}</span>}
            </CardDescription>
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="flex-1 gap-2 bg-green-600 hover:bg-green-700" onClick={sendWhatsApp}><MessageCircle size={16} /> WhatsApp</Button>
              <Button size="sm" variant="outline" className="flex-1 gap-2" onClick={() => navigate(`/purchases?vendor_id=${selectedVendor.id}`)}><ShoppingBag size={16} /> New PO</Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-0">
            {!vendorDetails ? (
              <div className="p-8 text-center text-muted-foreground animate-pulse">Loading details...</div>
            ) : (
              <div className="flex flex-col">
                {/* Financials */}
                <div className="grid grid-cols-2 gap-4 p-5 bg-card border-b">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Total Bought</span>
                    <span className="text-lg font-bold">{fmtPKR(vendorDetails.totalPurchased || 0)}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">How Much Paid</span>
                    <span className="text-lg font-bold text-emerald-600">{fmtPKR(vendorDetails.totalPaid || 0)}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase text-amber-600">Stock Returns (-)</span>
                    <span className="text-lg font-bold text-amber-600">{fmtPKR(vendorDetails.totalReturned || 0)}</span>
                  </div>
                  <div className="col-span-2 mt-2 pt-4 border-t border-dashed flex items-center justify-between bg-muted/5 -mx-5 px-5 py-3">
                    <span className="text-sm font-black uppercase text-muted-foreground">
                      Total Unpaid Invoices
                    </span>
                    <div className="text-right">
                      <span className="text-2xl font-black text-destructive">
                        {fmtPKR(vendorDetails.balance || 0)}
                      </span>
                      {vendorDetails.accountBalance < -0.5 && (
                        <p className="text-[10px] text-emerald-600 font-bold -mt-1">
                          {fmtPKR(Math.abs(vendorDetails.accountBalance))} Account Credit Available
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <ManualPaymentInput
                  balance={vendorDetails.balance}
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
                        if (item.type === 'PURCHASE') {
                          const p = item;
                          return (
                            <div key={`p-${p.id}`} className="bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border-border/60 hover:border-primary/30">
                              {/* Card Header */}
                              <div className="p-4 bg-muted/5 flex justify-between items-start border-b border-dashed">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Purchase #{p.id}</span>
                                    {p.status === 'Cancelled' ? (
                                      <Badge className="bg-slate-200 text-slate-600 hover:bg-slate-200 text-[10px] py-0 h-4 border-none uppercase">Cancelled</Badge>
                                    ) : p.status === 'Returned' || p.amountReturned > 0 ? (
                                      <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-[10px] py-0 h-4 border-none uppercase">Returned</Badge>
                                    ) : Math.round(p.remaining) <= 0 ? (
                                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px] py-0 h-4 border-none uppercase">Settled</Badge>
                                    ) : p.amountPaid > 0 ? (
                                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] py-0 h-4 border-none uppercase">Partial</Badge>
                                    ) : (
                                      <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10 text-[10px] py-0 h-4 border-none uppercase">Pending</Badge>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 font-medium">
                                    <Calendar size={10} /> {new Date(p.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary" onClick={() => openPurchaseDetail(p)}>
                                  <Eye size={14} />
                                </Button>
                              </div>

                              {/* Card Body */}
                              <div className="p-4 space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Total</p>
                                    <p className="text-sm font-bold">{fmtPKR(p.total)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Paid</p>
                                    <p className="text-sm font-bold text-emerald-600">{fmtPKR(p.amountPaid)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Remaining</p>
                                    <p className={`text-sm font-black ${Math.round(p.remaining) > 0.5 ? 'text-destructive' : Math.round(p.remaining) < -0.5 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                      {p.remaining < -0.5 ? `(Overpaid) ${fmtPKR(Math.abs(p.remaining))}` : fmtPKR(p.remaining)}
                                    </p>
                                  </div>
                                </div>

                                <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/40">
                                  <p className="font-bold mb-0.5 flex items-center gap-1"><Layers size={10} /> Bill Items:</p>
                                  <p className="line-clamp-2">
                                    {p.items?.map((item: any) => `${item.product_name} (x${item.quantity})`).join(', ') || 'No item data available'}
                                  </p>
                                </div>

                                <div className="flex gap-1.5 pt-1">
                                  {p.status !== 'Cancelled' && p.remaining > 0.1 && (
                                    <QuickPaymentInput
                                      purchase={p}
                                      onPay={(amt) => handleAddPayment(p.id, amt)}
                                    />
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 border-emerald-100 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                    onClick={() => sendWhatsApp(p)}
                                  >
                                    <MessageCircle size={14} />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 border-primary/20 text-primary hover:bg-primary/5"
                                    onClick={() => printPurchaseInvoice(p)}
                                  >
                                    <Printer size={14} />
                                  </Button>
                                  {p.status !== 'Cancelled' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => handleCancelPurchase(p.id)}
                                      title="Cancel Purchase"
                                    >
                                      <X size={12} />
                                    </Button>
                                  )}
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
                                  <p className="text-xs font-black uppercase text-emerald-800">Payment Sent</p>
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
                                  <p className="text-xs font-black uppercase text-amber-800">Return Processed</p>
                                  <p className="text-[10px] text-amber-600/70">{new Date(item.date).toLocaleString()}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-black text-amber-700">-{fmtPKR(item.amount)}</span>
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

      {/* ─── Purchase Detail Modal ─── */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedPurchase(null)}>
          <Card className="w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <CardHeader className="border-b pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2"><Package size={18} className="text-primary" /> Purchase #{selectedPurchase.id}</CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(selectedPurchase.date_created).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="text-2xl font-black text-destructive">{fmtPKR(selectedPurchase.total)}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
              {/* Payment History for this Purchase */}
              <div className="p-4 bg-muted/20 border-b">
                <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                  <History size={14} /> Payment History
                </h4>
                {(selectedPurchase.linkedPayments || []).length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2 italic">No payments recorded for this bill.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(selectedPurchase.linkedPayments || []).map((pay: any) => (
                      <div key={pay.id} className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-border shadow-sm text-xs group">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        <span className="font-bold">{fmtPKR(pay.amount)}</span>
                        <span className="text-[10px] text-muted-foreground border-l pl-2">{new Date(pay.date_created).toLocaleDateString()}</span>
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

              {purchaseItemsLoading ? (
                <div className="p-8 text-center text-muted-foreground animate-pulse">Loading items...</div>
              ) : purchaseItems.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Layers size={32} className="mx-auto opacity-20 mb-2" />
                  <p className="text-sm">No item breakdown found for this purchase.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b sticky top-0">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-xs uppercase">Product</th>
                      <th className="text-center py-3 px-3 font-semibold text-muted-foreground text-xs uppercase">Qty</th>
                      <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-xs uppercase">Unit Cost</th>
                      <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-xs uppercase">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {purchaseItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="py-3 px-4">
                          <div className="font-semibold">{item.product_name || 'Unknown Product'}</div>
                          {item.category && <div className="text-xs text-muted-foreground">{item.category}</div>}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">{item.quantity_added}</td>
                        <td className="py-3 px-4 text-right font-mono">{fmtPKR(item.purchase_price)}</td>
                        <td className="py-3 px-4 text-right font-bold text-destructive">{fmtPKR(item.purchase_price * item.quantity_added)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 bg-muted/20">
                    <tr>
                      <td colSpan={3} className="py-3 px-4 font-bold text-sm">Grand Total</td>
                      <td className="py-3 px-4 text-right font-black text-lg text-destructive">{fmtPKR(selectedPurchase.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </CardContent>
            <CardFooter className="border-t pt-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setSelectedPurchase(null)}>Close</Button>
              <Button variant="destructive" className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700" disabled={selectedPurchase.status === 'Cancelled'} onClick={() => {
                const initialQtys: Record<number, string> = {};
                purchaseItems.forEach(item => { initialQtys[item.id] = ''; });
                setReturnQuantities(initialQtys);
                setReturnReason('');
                setReturnModalOpen(true);
              }}>
                <Undo2 size={16} /> Return Items
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* ─── Purchase Return Modal ─── */}
      {returnModalOpen && selectedPurchase && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <Card className="w-full max-w-2xl shadow-2xl border-none overflow-hidden animate-in zoom-in-95 duration-300">
            <CardHeader className="bg-amber-600 text-white p-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Undo2 size={24} /> Return Items to Vendor (PO #{selectedPurchase.id})
                </CardTitle>
                <CardDescription className="text-amber-50/70">
                  Select items and quantities to return to the supplier.
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
                      <TableHead>Product Name</TableHead>
                      <TableHead className="text-center">Bought</TableHead>
                      <TableHead className="text-center">Prev. Returned</TableHead>
                      <TableHead className="text-center text-primary">In Stock (Unsold)</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right w-32">Qty to Return</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseItems.map((item) => {
                      const availableToReturn = Math.max(0, item.quantity_remaining);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="text-center">{item.quantity_added}</TableCell>
                          <TableCell className="text-center text-amber-600 font-bold">{item.quantity_returned || 0}</TableCell>
                          <TableCell className="text-center font-black text-primary">{availableToReturn}</TableCell>
                          <TableCell className="text-right">{fmtPKR(item.purchase_price)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-2">
                                {availableToReturn > 0 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-[10px] text-primary hover:bg-primary/10"
                                    onClick={() => setReturnQuantities({ ...returnQuantities, [item.id]: String(availableToReturn) })}
                                  >
                                    Max
                                  </Button>
                                )}
                                <Input
                                  type="text"
                                  className={cn(
                                    "h-8 w-20 text-right font-bold",
                                    (parseInt(String(returnQuantities[item.id])) || 0) > availableToReturn ? "border-destructive text-destructive bg-destructive/5" : "border-primary/20",
                                    availableToReturn === 0 && "opacity-50 cursor-not-allowed bg-muted"
                                  )}
                                  value={returnQuantities[item.id] || ''}
                                  disabled={availableToReturn <= 0}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/[^0-9]/g, '');
                                    setReturnQuantities({
                                      ...returnQuantities,
                                      [item.id]: raw
                                    });
                                  }}
                                  placeholder="0"
                                />
                              </div>
                              {(parseInt(String(returnQuantities[item.id])) || 0) > availableToReturn && (
                                <span className="text-[9px] text-destructive font-bold uppercase animate-pulse">Exceeds Stock</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2 text-amber-700">
                  <Package size={14} /> Reason for Vendor Return
                </label>
                <Input
                  placeholder="e.g. Expired, Damaged, Quality issues..."
                  className="bg-muted/20 border-amber-100"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
                <div className="text-left">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Debit Note Value</p>
                  <p className="text-2xl font-black text-amber-600">
                    {fmtPKR(purchaseItems.reduce((sum, item) => sum + (item.purchase_price * (parseInt(String(returnQuantities[item.id])) || 0)), 0))}
                  </p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setReturnModalOpen(false)}>Cancel</Button>
                  <Button
                    className="flex-1 sm:flex-none gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={handleReturnSubmit}
                    disabled={isSubmittingReturn || purchaseItems.reduce((sum, item) => sum + (parseInt(String(returnQuantities[item.id])) || 0), 0) === 0}
                  >
                    {isSubmittingReturn ? <RefreshCw className="animate-spin" size={16} /> : <Undo2 size={16} />}
                    Process Return
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Add / Edit Dialog ─── */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl">
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>{isEditing ? 'Edit Vendor' : 'Add New Vendor'}</CardTitle>
                <CardDescription>Enter supplier details below.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Vendor Name <span className="text-destructive">*</span></label>
                  <Input type="text" required value={current.name} onChange={(e) => setCurrent({ ...current, name: e.target.value })} placeholder="e.g. Sony Distributors" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Phone Number</label>
                  <Input type="tel" value={current.phone || ''} onChange={(e) => setCurrent({ ...current, phone: e.target.value })} placeholder="0300 1234567" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Address</label>
                  <Input type="text" value={current.address || ''} onChange={(e) => setCurrent({ ...current, address: e.target.value })} placeholder="Warehouse 12, Main Bazar" />
                </div>
              </CardContent>
              <CardFooter className="flex gap-3 pt-4 border-t">
                <Button type="button" variant="outline" className="w-full" onClick={() => setShowDialog(false)}>Cancel</Button>
                <Button type="submit" className="w-full">{isEditing ? 'Save Changes' : 'Create Vendor'}</Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
