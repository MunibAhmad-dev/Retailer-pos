import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Pencil, Trash2, Phone, MessageCircle,
  History, ShoppingBag, CreditCard, X, Truck, Package,
  ChevronDown, Eye, Calendar, Layers, Undo2, RefreshCw,
  CheckCircle2, Printer, Download, MapPin, ArrowRight, Hash,
  TrendingUp, Wallet, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useNotifications } from '../components/NotificationProvider';
import { useNavigate } from 'react-router-dom';
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton, SearchSpinner } from '../components/Pagination';
import { cn } from '../lib/utils';
import { formatVendorDataForPDF, generateVendorPDFHTML } from '../lib/pdfExportService.ts';

interface Vendor {
  id?: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

const HISTORY_PAGE = 15;
const fmtPKR = (n: any) => 'PKR ' + (Math.round(Number(n) || 0)).toLocaleString('en-PK');
const formatPurchaseRef = (id: number | string, dateString?: string) => {
  const d = dateString ? new Date(dateString) : new Date();
  const safeDate = Number.isNaN(d.getTime()) ? new Date() : d;
  const datePart = `${safeDate.getFullYear()}${String(safeDate.getMonth() + 1).padStart(2, '0')}${String(safeDate.getDate()).padStart(2, '0')}`;
  const numericId = Number(id);
  const idPart = Number.isFinite(numericId) ? String(Math.max(0, Math.trunc(numericId))).padStart(5, '0') : String(id || '').trim();
  return `PO-${datePart}-${idPart || '00000'}`;
};

// ─── Avatar gradient palette ──────────────────────────────────────────────────
const VENDOR_GRADIENTS = [
  { a: '#6366f1', b: '#8b5cf6' },
  { a: '#3b82f6', b: '#06b6d4' },
  { a: '#10b981', b: '#059669' },
  { a: '#f59e0b', b: '#ef4444' },
  { a: '#ec4899', b: '#f43f5e' },
  { a: '#8b5cf6', b: '#a78bfa' },
];
const getVendorGradient = (name: string) =>
  VENDOR_GRADIENTS[name.charCodeAt(0) % VENDOR_GRADIENTS.length];

// ─── Animation variants ───────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.04, duration: 0.28, ease: 'easeOut' },
  }),
};

// ─── QuickPaymentInput ────────────────────────────────────────────────────────
function QuickPaymentInput({ purchase, onPay }: { purchase: any; onPay: (amount: string) => void }) {
  const [val, setVal] = React.useState('');
  return (
    <div className="flex-1 flex gap-1.5">
      <Input
        type="text"
        placeholder="Amount"
        className="h-8 text-xs font-mono w-24 bg-background/80"
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, ''))}
      />
      <Button
        size="sm"
        className="h-8 text-[11px] px-3 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
        onClick={() => { if (!val) return; onPay(val); setVal(''); }}
      >
        Pay
      </Button>
    </div>
  );
}

// ─── ManualPaymentInput ───────────────────────────────────────────────────────
function ManualPaymentInput({
  onAdd, onMarkAllPaid, balance, loading,
}: { onAdd: (amt: string) => void; onMarkAllPaid: () => void; balance: number; loading: boolean }) {
  const [val, setVal] = React.useState('');
  return (
    <div className="p-4 border-b">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <CreditCard size={13} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
          Record Payment Sent
        </h4>
      </div>
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Amount paid (PKR)..."
          value={val}
          onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, ''))}
          className="flex-1 h-9"
        />
        <Button
          disabled={loading || !val}
          onClick={() => { onAdd(val); setVal(''); }}
          className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white px-5 text-sm font-bold"
          size="sm"
        >
          Log
        </Button>
      </div>
      {balance > 0 && (
        <Button
          variant="outline"
          className="w-full mt-2 h-8 text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/5 font-semibold"
          onClick={onMarkAllPaid}
          disabled={loading}
        >
          Clear Full Balance — {fmtPKR(balance)}
        </Button>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [current, setCurrent] = useState<Vendor>({ name: '', phone: '', email: '', address: '' });
  const [isEditing, setIsEditing] = useState(false);

  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorDetails, setVendorDetails] = useState<any>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(''); // required by closeVendor / handleAddPayment

  const [historyVisible, setHistoryVisible] = useState(HISTORY_PAGE);

  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);
  const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
  const [purchaseItemsLoading, setPurchaseItemsLoading] = useState(false);

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, string>>({});
  const [returnReason, setReturnReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [inlinePayments, setInlinePayments] = useState<Record<number, string>>({});

  const [historyQuery, setHistoryQuery] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState<'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'custom'>('this_month');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'Settled' | 'Pending' | 'Cancelled' | 'Returned'>('all');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'Purchases' | 'Payments' | 'Returns' | 'Deleted Payments' | 'Cancelled Bills'>('all');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Record<number, boolean>>({});
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const [summaryDateFilter, setSummaryDateFilter] = useState<'today' | 'weekly' | 'custom' | 'months'>('today');
  const [summaryMonths, setSummaryMonths] = useState<string>('1');
  const [summaryFrom, setSummaryFrom] = useState('');
  const [summaryTo, setSummaryTo] = useState('');

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadVendors();
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, []);

  // ── Data handlers ─────────────────────────────────────────────────────────────
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
      .filter((item, idx) => {
        const itemKey = item.id || item.product_id || idx;
        return (parseInt(String(returnQuantities[itemKey])) || 0) > 0;
      })
      .map((item, idx) => {
        const itemKey = item.id || item.product_id || idx;
        return {
          id: item.id, product_id: item.product_id,
          product_name: item.product_name,
          quantity: parseInt(String(returnQuantities[itemKey])) || 0,
          purchase_price: item.purchase_price,
        };
      });

    if (itemsToReturn.length === 0) {
      addNotification('Warning', 'Please select at least one item to return', 'warning');
      return;
    }
    const totalReturned = itemsToReturn.reduce((sum, item) => sum + (item.purchase_price * item.quantity), 0);
    setIsSubmittingReturn(true);
    try {
      const res = await window.api.createPurchaseReturn({
        purchase_id: selectedPurchase.id, items: itemsToReturn,
        reason: returnReason, total_returned: totalReturned,
      });
      if (res.success) {
        addNotification('Success', 'Return processed successfully', 'success');
        setReturnModalOpen(false);
        setSelectedPurchase(null);
        if (selectedVendor?.id) loadVendorDetails(selectedVendor.id);
        loadVendors();
      } else {
        addNotification('Error', res.error || 'Failed to process return', 'error');
      }
    } catch { addNotification('Error', 'Critical error processing return', 'error'); }
    finally { setIsSubmittingReturn(false); }
  };

  const handleCancelPurchase = async (purchaseId: number) => {
    if (confirm('Are you sure you want to CANCEL this purchase? This will mark the bill as void.')) {
      const res = await window.api.cancelPurchase(purchaseId);
      if (res.success) {
        addNotification('Success', 'Purchase cancelled', 'success');
        if (selectedVendor?.id) loadVendorDetails(selectedVendor.id);
      } else {
        addNotification('Error', res.error || 'Failed to cancel', 'error');
      }
    }
  };

  const handleSearch = (v: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setIsSearching(true);
    setSearchTerm(v);
    searchTimerRef.current = setTimeout(() => setIsSearching(false), 200);
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
      const amt = window.prompt('Enter payment amount:', String(Math.round(vendorDetails.purchases.find((p: any) => p.id === purchaseId)?.remaining || 0)));
      if (amt === null) return;
      finalAmount = amt;
    }
    if (!selectedVendor?.id || !finalAmount || isNaN(Number(finalAmount)) || Number(finalAmount) <= 0) return;
    setPaymentLoading(true);
    try {
      const res = await window.api.addVendorPayment({
        vendor_id: selectedVendor.id, amount: Number(finalAmount),
        notes: purchaseId ? `Payment for PO #${purchaseId}` : 'Manual Account Payment',
        purchase_id: purchaseId,
      });
      if (res.success) {
        addNotification('Payment Recorded', `Successfully recorded PKR ${finalAmount}`, 'success');
        if (selectedVendor?.id) {
          await loadVendorDetails(selectedVendor.id);
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

  const exportPDF = async () => {
    if (!vendorDetails) { addNotification('Error', 'Vendor details are still loading.', 'error'); return; }
    try {
      const pdfData = formatVendorDataForPDF(vendorDetails);
      const html = generateVendorPDFHTML(pdfData);
      const res = await window.api.saveInvoicePdf(html);
      if (res.success) {
        addNotification('PDF Saved', 'Vendor statement PDF saved successfully.', 'success');
      } else if (res.error !== 'Cancelled') {
        addNotification('Error', res.error || 'Failed to save vendor statement.', 'error');
      }
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Failed to export vendor statement.', 'error');
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
      if (!res.success) throw new Error('Failed to load items');
      const items = res.data;
      const html = `
        <div style="font-family: sans-serif; padding: 10px; max-width: 300px; margin: auto; border: 1px solid #eee;">
          <h2 style="text-align: center; margin-bottom: 5px;">PURCHASE INVOICE</h2>
          <p style="text-align: center; font-size: 12px; margin-top: 0;">PO #${purchase.id} | ${new Date(purchase.date_created).toLocaleString()}</p>
          <hr/>
          <p><strong>Vendor:</strong> ${selectedVendor?.name}</p>
          <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
            <thead><tr style="border-bottom: 1px solid #ddd;">
              <th style="text-align: left; padding: 4px 0;">Item</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Total</th>
            </tr></thead>
            <tbody>
              ${items.map((i: any) => `<tr><td style="padding: 4px 0;">${i.product_name}</td><td style="text-align: center;">${i.quantity_added}</td><td style="text-align: right;">${fmtPKR(i.purchase_price * i.quantity_added)}</td></tr>`).join('')}
            </tbody>
          </table>
          <hr/>
          <div style="display: flex; justify-content: space-between; font-weight: bold;"><span>Grand Total:</span><span>${fmtPKR(purchase.total)}</span></div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; margin-top: 4px;"><span>Amount Paid:</span><span>${fmtPKR(purchase.amountPaid)}</span></div>
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; margin-top: 5px; color: red;"><span>Remaining:</span><span>${fmtPKR(purchase.remaining)}</span></div>
          <p style="text-align: center; font-size: 10px; margin-top: 20px; color: #888;">Generated by POS System</p>
        </div>`;
      await window.api.printInvoice(html);
    } catch { addNotification('Error', 'Failed to print invoice', 'error'); }
  };

  // ── Computed data (all unchanged) ─────────────────────────────────────────────
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
  const actionHistory = useMemo(() => (vendorDetails?.history || []) as any[], [vendorDetails]);

  const advancedHistoryRows = useMemo(() => {
    if (!vendorDetails) return [];
    const purchaseRefById = new Map<number, string>(
      (vendorDetails.purchases || []).map((p: any) => [Number(p.id), formatPurchaseRef(p.id, p.date_created)])
    );
    const purchases = (vendorDetails.purchases || []).map((p: any) => ({
      rowKind: 'PURCHASE', id: `purchase-${p.id}`, date: p.date_created,
      invoiceId: p.id, displayRef: formatPurchaseRef(p.id, p.date_created),
      itemsText: (p.items || []).map((i: any) => i.product_name).join(', '),
      itemsCount: (p.items || []).length, total: Number(p.total) || 0,
      paid: Number(p.amountPaid) || 0, returned: Number(p.amountReturned) || 0,
      remaining: Math.max(0, Number(p.remaining) || 0),
      status: p.status === 'Cancelled' ? 'Cancelled' : (Number(p.amountReturned) || 0) > 0 ? 'Returned' : Math.max(0, Number(p.remaining) || 0) <= 0.5 ? 'Settled' : 'Pending',
      notes: '', ref: formatPurchaseRef(p.id, p.date_created), raw: p,
    }));
    const payments = (vendorDetails.payments || []).map((p: any) => ({
      rowKind: 'PAYMENT', id: `payment-${p.id}`, date: p.date_created,
      invoiceId: p.purchase_id || null,
      displayRef: p.purchase_id ? purchaseRefById.get(Number(p.purchase_id)) || formatPurchaseRef(p.purchase_id, p.date_created) : `VP-${p.id}`,
      itemsText: '', itemsCount: 0, total: 0, paid: Number(p.amount) || 0,
      returned: 0, remaining: 0, status: 'Settled', notes: p.notes || '',
      ref: `VP-${p.id}`, raw: p,
    }));
    const returns = (vendorDetails.returns || []).map((r: any) => ({
      rowKind: 'RETURN', id: `return-${r.id}`,
      date: r.date_created || r.date_returned, invoiceId: r.purchase_id || null,
      displayRef: r.purchase_id ? purchaseRefById.get(Number(r.purchase_id)) || formatPurchaseRef(r.purchase_id, r.date_created || r.date_returned) : `PR-${r.id}`,
      itemsText: '', itemsCount: 0, total: 0, paid: 0,
      returned: Number(r.total_returned) || 0, remaining: 0, status: 'Returned',
      notes: r.reason || r.notes || '', ref: `PR-${r.id}`, raw: r,
    }));
    const history = (actionHistory || []).map((h: any) => ({
      rowKind: h.type === 'PAYMENT_DELETED' ? 'DELETED_PAYMENT' : h.type === 'PURCHASE_CANCELLED' ? 'CANCELLED_BILL' : 'HISTORY',
      id: `history-${h.id}`, date: h.date, invoiceId: h.relatedId || null,
      displayRef: h.relatedId && String(h.relatedType || '').toUpperCase().includes('PURCHASE')
        ? purchaseRefById.get(Number(h.relatedId)) || formatPurchaseRef(h.relatedId, h.date)
        : `${h.relatedType || 'H'}-${h.relatedId || h.id}`,
      itemsText: '', itemsCount: 0, total: 0,
      paid: h.type?.includes('PAYMENT') ? Number(h.amount) || 0 : 0,
      returned: h.type?.includes('RETURN') ? Number(h.amount) || 0 : 0,
      remaining: 0,
      status: h.status === 'DELETED' ? 'Cancelled' : h.status === 'CANCELLED' ? 'Cancelled' : 'Settled',
      notes: h.notes || h.type || '', ref: `${h.relatedType || 'H'}-${h.relatedId || h.id}`, raw: h,
    }));
    return [...purchases, ...payments, ...returns, ...history]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [vendorDetails, actionHistory]);

  const filteredAdvancedHistory = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const inDateRange = (d: Date) => {
      if (historyDateFilter === 'today') return d >= startOfDay;
      if (historyDateFilter === 'this_week') return d >= startOfWeek;
      if (historyDateFilter === 'this_month') return d >= startOfMonth;
      if (historyDateFilter === 'last_month') return d >= startOfLastMonth && d <= endOfLastMonth;
      if (historyDateFilter === 'this_year') return d >= startOfYear;
      if (historyDateFilter === 'custom') {
        const from = historyFrom ? new Date(`${historyFrom}T00:00:00`) : null;
        const to = historyTo ? new Date(`${historyTo}T23:59:59`) : null;
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      return true;
    };
    const query = historyQuery.trim().toLowerCase();
    return advancedHistoryRows.filter((row: any) => {
      const d = new Date(row.date);
      if (Number.isNaN(d.getTime()) || !inDateRange(d)) return false;
      if (historyStatusFilter !== 'all' && row.status !== historyStatusFilter) return false;
      if (historyTypeFilter !== 'all') {
        if (historyTypeFilter === 'Purchases' && row.rowKind !== 'PURCHASE') return false;
        if (historyTypeFilter === 'Payments' && row.rowKind !== 'PAYMENT') return false;
        if (historyTypeFilter === 'Returns' && row.rowKind !== 'RETURN') return false;
        if (historyTypeFilter === 'Deleted Payments' && row.rowKind !== 'DELETED_PAYMENT') return false;
        if (historyTypeFilter === 'Cancelled Bills' && row.rowKind !== 'CANCELLED_BILL') return false;
      }
      if (!query) return true;
      const pool = [row.displayRef || '', row.ref, row.invoiceId ? String(row.invoiceId) : '', row.itemsText || '', row.notes || '', String(row.total || ''), String(row.paid || ''), String(row.returned || '')].join(' ').toLowerCase();
      return pool.includes(query);
    });
  }, [advancedHistoryRows, historyDateFilter, historyFrom, historyTo, historyStatusFilter, historyTypeFilter, historyQuery]);

  const summaryStats = useMemo(() => {
    if (!vendorDetails) return { totalPurchased: 0, totalPaid: 0, totalReturned: 0 };
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - 6);
    const monthsBack = Math.min(12, Math.max(1, Number(summaryMonths) || 1));
    const startOfMonths = new Date(now); startOfMonths.setHours(0, 0, 0, 0); startOfMonths.setMonth(startOfMonths.getMonth() - monthsBack);
    const inSummaryRange = (dateRaw: any) => {
      const d = new Date(dateRaw);
      if (Number.isNaN(d.getTime())) return false;
      if (summaryDateFilter === 'today') return d >= startOfDay;
      if (summaryDateFilter === 'weekly') return d >= startOfWeek;
      if (summaryDateFilter === 'months') return d >= startOfMonths;
      if (summaryDateFilter === 'custom') {
        const from = summaryFrom ? new Date(`${summaryFrom}T00:00:00`) : null;
        const to = summaryTo ? new Date(`${summaryTo}T23:59:59`) : null;
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      return true;
    };
    const totalPurchased = (vendorDetails.purchases || []).filter((p: any) => (p.status || '').toLowerCase() !== 'cancelled' && inSummaryRange(p.date_created)).reduce((sum: number, p: any) => sum + (Number(p.total) || 0), 0);
    const totalPaid = (vendorDetails.payments || []).filter((p: any) => inSummaryRange(p.date_created)).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const totalReturned = (vendorDetails.returns || []).filter((r: any) => inSummaryRange(r.date_created || r.date_returned)).reduce((sum: number, r: any) => sum + (Number(r.total_returned) || 0), 0);
    return { totalPurchased, totalPaid, totalReturned };
  }, [vendorDetails, summaryDateFilter, summaryMonths, summaryFrom, summaryTo]);

  const HISTORY_PAGE_SIZE = 20;
  const historyTotalPages = Math.max(1, Math.ceil(filteredAdvancedHistory.length / HISTORY_PAGE_SIZE));
  const pagedAdvancedHistory = useMemo(() => {
    const safePage = Math.min(historyPage, historyTotalPages);
    const start = (safePage - 1) * HISTORY_PAGE_SIZE;
    return filteredAdvancedHistory.slice(start, start + HISTORY_PAGE_SIZE);
  }, [filteredAdvancedHistory, historyPage, historyTotalPages]);

  const statusBadgeClass = (status: string) => {
    if (status === 'Settled') return 'border-transparent bg-emerald-600 text-white shadow-sm hover:bg-emerald-600';
    if (status === 'Pending') return 'border-transparent bg-amber-500 text-white shadow-sm hover:bg-amber-500';
    if (status === 'Cancelled') return 'border-transparent bg-rose-600 text-white shadow-sm hover:bg-rose-600';
    if (status === 'Returned') return 'border-transparent bg-violet-600 text-white shadow-sm hover:bg-violet-600';
    return 'border-transparent bg-slate-600 text-white shadow-sm hover:bg-slate-600';
  };

  const typeBadgeClass = (type: string) => {
    if (type === 'PURCHASE') return 'border-transparent bg-blue-600 text-white shadow-sm hover:bg-blue-600';
    if (type === 'PAYMENT') return 'border-transparent bg-emerald-600 text-white shadow-sm hover:bg-emerald-600';
    if (type === 'RETURN') return 'border-transparent bg-violet-600 text-white shadow-sm hover:bg-violet-600';
    if (type === 'DELETED_PAYMENT' || type === 'CANCELLED_BILL') return 'border-transparent bg-rose-600 text-white shadow-sm hover:bg-rose-600';
    return 'border-transparent bg-slate-600 text-white shadow-sm hover:bg-slate-600';
  };

  // ── JSX ────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex gap-5">

      {/* ════════════════════════════════════════════════════════════════════
          LEFT PANEL — Vendor List
      ════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">

        {/* Header */}
        <div className="p-5 border-b border-border/60 bg-muted/5 shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2.5 mb-0.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Truck size={18} className="text-primary" />
                </div>
                <h1 className="text-xl font-black tracking-tight">Vendors</h1>
              </div>
              <p className="text-xs text-muted-foreground/70 pl-[46px]">
                {vendors.length} supplier{vendors.length !== 1 ? 's' : ''} · Accounts Payable
              </p>
            </div>
            <Button
              onClick={() => { setCurrent({ name: '', phone: '', email: '', address: '' }); setIsEditing(false); setShowDialog(true); }}
              className="gap-2 h-9 text-sm font-semibold shadow-sm"
            >
              <Plus size={16} /> Add Vendor
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={15} />
            <Input
              placeholder="Search by name or phone..."
              className="pl-9 h-10 text-sm bg-background border-border/60"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {isSearching && <SearchSpinner className="right-3 top-2.5 absolute" />}
          </div>
        </div>

        {/* Vendor list */}
        <div className="flex-1 overflow-y-auto">
          {vendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-12">
              <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center">
                <Truck size={28} className="opacity-30" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm">No vendors yet</p>
                <p className="text-xs mt-0.5">Click "Add Vendor" to create your first supplier.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {visibleVendors.map((v, i) => {
                const grad = getVendorGradient(v.name);
                const isActive = selectedVendor?.id === v.id;
                return (
                  <motion.div
                    key={v.id}
                    custom={i}
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    onClick={() => openVendor(v)}
                    className={cn(
                      'relative flex items-center gap-3.5 px-4 py-3.5 cursor-pointer transition-all duration-150 group',
                      isActive
                        ? 'bg-primary/5'
                        : 'hover:bg-muted/30'
                    )}
                  >
                    {/* Active pill */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-9 rounded-r-full bg-primary" />
                    )}

                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0 shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${grad.a}, ${grad.b})` }}
                    >
                      {v.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-semibold text-sm truncate', isActive && 'text-primary')}>{v.name}</p>
                      {v.phone && (
                        <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                          <Phone size={9} /> {v.phone}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary rounded-lg"
                        onClick={(e) => openEdit(v, e)}
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-lg"
                        onClick={(e) => handleDelete(v.id!, e)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>

                    {isActive
                      ? <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      : <ArrowRight size={14} className="text-muted-foreground/25 shrink-0 group-hover:text-muted-foreground/50 transition-colors" />
                    }
                  </motion.div>
                );
              })}
              <LoadMoreButton hasMore={hasMore} loadMore={loadMore} showing={showing} total={total} itemType="vendors" />
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          RIGHT PANEL — Vendor Detail
      ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedVendor && (
          <motion.div
            key="vendor-detail"
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 32 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="w-[420px] shrink-0 flex flex-col rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm"
          >
            {/* Panel header */}
            <div className="shrink-0 p-5 border-b border-border/60 relative">
              <Button
                variant="ghost" size="icon"
                className="absolute right-4 top-4 h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                onClick={closeVendor}
              >
                <X size={16} />
              </Button>

              <div className="flex items-center gap-3 mb-3 pr-10">
                {(() => {
                  const grad = getVendorGradient(selectedVendor.name);
                  return (
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shrink-0 shadow-md"
                      style={{ background: `linear-gradient(135deg, ${grad.a}, ${grad.b})` }}
                    >
                      {selectedVendor.name.charAt(0).toUpperCase()}
                    </div>
                  );
                })()}
                <div className="min-w-0">
                  <h2 className="font-black text-base truncate">{selectedVendor.name}</h2>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {selectedVendor.phone && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Phone size={9} /> {selectedVendor.phone}
                      </span>
                    )}
                    {selectedVendor.address && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                        <MapPin size={9} /> {selectedVendor.address}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" className="h-8 gap-1.5 text-xs bg-[#25d366] hover:bg-[#1fba57] text-white font-semibold" onClick={() => sendWhatsApp()}>
                  <MessageCircle size={13} /> WhatsApp
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-semibold" onClick={() => navigate(`/purchases?vendor_id=${selectedVendor.id}`)}>
                  <ShoppingBag size={13} /> New PO
                </Button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {!vendorDetails ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                  <RefreshCw size={20} className="animate-spin opacity-50" />
                  <p className="text-xs">Loading details…</p>
                </div>
              ) : (
                <>
                  {/* ── KPI Cards ── */}
                  <div className="p-4 border-b border-border/60">
                    {/* Summary filter bar */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      <Select value={summaryDateFilter} onValueChange={(v: any) => setSummaryDateFilter(v)}>
                        <SelectTrigger className="h-7 w-[120px] text-[11px] rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="months">By Months</SelectItem>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      {summaryDateFilter === 'months' && (
                        <Select value={summaryMonths} onValueChange={setSummaryMonths}>
                          <SelectTrigger className="h-7 w-[130px] text-[11px] rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                              <SelectItem key={m} value={String(m)}>Last {m} {m === 1 ? 'Month' : 'Months'}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {summaryDateFilter === 'custom' && (
                        <>
                          <Input type="date" className="h-7 text-[11px] w-28 rounded-lg" value={summaryFrom} onChange={(e) => setSummaryFrom(e.target.value)} />
                          <Input type="date" className="h-7 text-[11px] w-28 rounded-lg" value={summaryTo} onChange={(e) => setSummaryTo(e.target.value)} />
                        </>
                      )}
                      <Badge className={cn(
                        'ml-auto text-[10px] font-bold border-none',
                        (vendorDetails.balance || 0) > 0
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      )}>
                        {(vendorDetails.balance || 0) > 0 ? 'Unpaid Balance' : 'Fully Settled'}
                      </Badge>
                    </div>

                    {/* KPI grid */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { label: 'Total Purchased', value: summaryStats.totalPurchased, icon: ShoppingBag, iconCls: 'text-blue-500', bgCls: 'bg-blue-500/10' },
                        { label: 'Total Paid', value: summaryStats.totalPaid, icon: CheckCircle2, iconCls: 'text-emerald-500', bgCls: 'bg-emerald-500/10' },
                        { label: 'Stock Returns', value: summaryStats.totalReturned, icon: Undo2, iconCls: 'text-amber-500', bgCls: 'bg-amber-500/10' },
                        {
                          label: 'Net Balance',
                          value: Math.max(0, vendorDetails.balance || 0),
                          icon: Wallet,
                          iconCls: (vendorDetails.balance || 0) > 0 ? 'text-destructive' : 'text-emerald-500',
                          bgCls: (vendorDetails.balance || 0) > 0 ? 'bg-destructive/10' : 'bg-emerald-500/10',
                        },
                      ].map((kpi) => (
                        <div key={kpi.label} className="rounded-xl border border-border/60 bg-background/60 p-3">
                          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mb-2', kpi.bgCls)}>
                            <kpi.icon size={14} className={kpi.iconCls} />
                          </div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">{kpi.label}</p>
                          <p className={cn('text-sm font-black', kpi.iconCls)}>{fmtPKR(kpi.value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Manual Payment ── */}
                  <ManualPaymentInput
                    balance={vendorDetails.balance}
                    loading={paymentLoading}
                    onAdd={(amt) => handleAddPayment(undefined, amt)}
                    onMarkAllPaid={handleMarkAllPaid}
                  />

                  {/* ── Action buttons ── */}
                  <div className="p-4 border-b border-border/60 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="w-full h-9 gap-2 text-xs font-semibold justify-start"
                      onClick={() => setHistoryModalOpen(true)}
                    >
                      <History size={14} className="text-primary" />
                      Advanced History
                      <Badge variant="secondary" className="ml-auto text-[10px] font-bold">{filteredAdvancedHistory.length}</Badge>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-9 gap-2 text-xs font-semibold justify-start"
                      onClick={exportPDF}
                    >
                      <Download size={14} className="text-blue-500" />
                      Export Statement PDF
                    </Button>
                  </div>

                  {/* ── Transaction Timeline ── */}
                  <div className="p-4">
                    <Tabs defaultValue="tx-history">
                      <TabsList className="w-full grid grid-cols-2 mb-4 h-8">
                        <TabsTrigger value="tx-history" className="text-[11px]">Transactions</TabsTrigger>
                        <TabsTrigger value="activity-log" className="text-[11px]">Action Log</TabsTrigger>
                      </TabsList>

                      {/* ── Transaction History tab ── */}
                      <TabsContent value="tx-history">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Timeline</p>
                          <Badge variant="secondary" className="text-[10px]">{historyLogs.length} entries</Badge>
                        </div>

                        {historyLogs.length === 0 ? (
                          <div className="py-10 text-center border border-dashed rounded-xl text-sm text-muted-foreground">
                            No activity yet.
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {visibleHistory.map((item: any, idx: number) => {

                              /* ── PURCHASE card ── */
                              if (item.type === 'PURCHASE') {
                                const p = item;
                                const paid = Number(p.amountPaid) || 0;
                                const total = Number(p.total) || 1;
                                const progress = Math.min(100, Math.round((paid / total) * 100));
                                const isCancelled = p.status === 'Cancelled';
                                const isSettled = !isCancelled && Math.round(p.remaining) <= 0;
                                const isReturned = !isCancelled && (p.amountReturned > 0);
                                const isPartial = !isCancelled && !isSettled && paid > 0;

                                return (
                                  <div key={`p-${p.id}`} className="rounded-xl border border-border/60 bg-background/50 overflow-hidden hover:border-primary/30 transition-colors">
                                    {/* Card top */}
                                    <div className="px-4 pt-3.5 pb-2.5 flex items-start justify-between">
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                                            PO #{p.id}
                                          </span>
                                          <Badge className={cn(
                                            'text-[9px] h-4 px-1.5 font-bold border-none',
                                            isCancelled ? 'bg-slate-500 text-white'
                                              : isSettled ? 'bg-emerald-500 text-white'
                                              : isReturned ? 'bg-violet-500 text-white'
                                              : isPartial ? 'bg-amber-500 text-white'
                                              : 'bg-rose-500 text-white'
                                          )}>
                                            {isCancelled ? 'Cancelled' : isSettled ? 'Settled' : isReturned ? 'Returned' : isPartial ? 'Partial' : 'Pending'}
                                          </Badge>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                                          <Calendar size={9} />
                                          {new Date(p.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                      </div>
                                      <Button
                                        variant="ghost" size="icon"
                                        className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary shrink-0 -mt-0.5"
                                        onClick={() => openPurchaseDetail(p)}
                                      >
                                        <Eye size={13} />
                                      </Button>
                                    </div>

                                    {/* Financials */}
                                    <div className="px-4 pb-2 grid grid-cols-3 gap-2">
                                      {[
                                        { label: 'Total', value: p.total, cls: 'text-foreground' },
                                        { label: 'Paid', value: p.amountPaid, cls: 'text-emerald-600 dark:text-emerald-400' },
                                        { label: 'Remaining', value: Math.max(0, Number(p.remaining) || 0), cls: Math.max(0, Number(p.remaining) || 0) > 0.5 ? 'text-destructive' : 'text-muted-foreground' },
                                      ].map((f) => (
                                        <div key={f.label}>
                                          <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/50">{f.label}</p>
                                          <p className={cn('text-xs font-bold mt-0.5', f.cls)}>{fmtPKR(f.value)}</p>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Progress bar */}
                                    {!isCancelled && (
                                      <div className="px-4 pb-2.5">
                                        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                                          <div
                                            className={cn(
                                              'h-full rounded-full transition-all duration-700',
                                              progress >= 100 ? 'bg-emerald-500' : progress > 0 ? 'bg-amber-500' : 'bg-rose-500'
                                            )}
                                            style={{ width: `${progress}%` }}
                                          />
                                        </div>
                                        <p className="text-[9px] text-muted-foreground/50 mt-1">{progress}% paid</p>
                                      </div>
                                    )}

                                    {/* Items preview */}
                                    {p.items?.length > 0 && (
                                      <div className="mx-4 mb-2.5 px-2.5 py-2 rounded-lg bg-muted/20 border border-border/40">
                                        <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/50 mb-1 flex items-center gap-1">
                                          <Layers size={9} /> Items
                                        </p>
                                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                                          {p.items.map((item: any) => `${item.product_name} ×${item.quantity}`).join(' · ')}
                                        </p>
                                      </div>
                                    )}

                                    {/* Action row */}
                                    <div className="px-4 pb-3.5 flex gap-1.5">
                                      {!isCancelled && p.remaining > 0.1 && (
                                        <QuickPaymentInput purchase={p} onPay={(amt) => handleAddPayment(p.id, amt)} />
                                      )}
                                      <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-[#25d366]/30 text-[#25d366] hover:bg-[#25d366]/10" onClick={() => sendWhatsApp(p)}>
                                        <MessageCircle size={13} />
                                      </Button>
                                      <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-primary/20 text-primary hover:bg-primary/5" onClick={() => printPurchaseInvoice(p)}>
                                        <Printer size={13} />
                                      </Button>
                                      {!isCancelled && (
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground/40 hover:text-destructive" onClick={() => handleCancelPurchase(p.id)} title="Cancel">
                                          <X size={12} />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              }

                              /* ── PAYMENT row ── */
                              if (item.type === 'PAYMENT') {
                                return (
                                  <div key={`pay-${item.id}-${idx}`} className="bg-emerald-500/8 border border-emerald-500/20 p-3 rounded-xl flex justify-between items-center group">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                                        <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                                      </div>
                                      <div>
                                        <p className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400">Payment Sent</p>
                                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                          {new Date(item.date).toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">{fmtPKR(item.amount)}</span>
                                      <Button
                                        variant="ghost" size="icon"
                                        className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleDeletePayment(item.id)}
                                      >
                                        <Trash2 size={12} />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              }

                              /* ── RETURN row ── */
                              if (item.type === 'RETURN') {
                                return (
                                  <div key={`ret-${item.id}-${idx}`} className="bg-amber-500/8 border border-amber-500/20 p-3 rounded-xl flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                                        <Undo2 size={14} className="text-amber-600 dark:text-amber-400" />
                                      </div>
                                      <div>
                                        <p className="text-xs font-black uppercase text-amber-700 dark:text-amber-400">Return Processed</p>
                                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                          {new Date(item.date).toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="text-sm font-black text-amber-700 dark:text-amber-400">−{fmtPKR(item.amount)}</span>
                                  </div>
                                );
                              }
                              return null;
                            })}

                            {hasMoreHistory && (
                              <Button
                                variant="outline"
                                onClick={() => setHistoryVisible(v => v + HISTORY_PAGE)}
                                className="w-full text-xs h-9 border-dashed text-muted-foreground hover:text-foreground"
                              >
                                <ChevronDown size={13} className="mr-1.5" />
                                Load more ({historyVisible} of {historyLogs.length})
                              </Button>
                            )}
                          </div>
                        )}
                      </TabsContent>

                      {/* ── Action Log tab ── */}
                      <TabsContent value="activity-log">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Action Log</p>
                          <Badge variant="secondary" className="text-[10px]">{actionHistory.length}</Badge>
                        </div>
                        {actionHistory.length === 0 ? (
                          <div className="py-8 text-center border border-dashed rounded-xl text-xs text-muted-foreground">
                            No history available yet.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {actionHistory.map((h: any) => (
                              <div key={`vh-${h.id}`} className="rounded-xl border border-border/60 bg-background/50 p-3 text-xs">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="font-bold text-foreground">{h.type}</span>
                                  <span className="text-muted-foreground/60 text-[10px]">{new Date(h.date).toLocaleString()}</span>
                                </div>
                                <div className="text-muted-foreground text-[11px]">
                                  {fmtPKR(h.amount || 0)} · {h.relatedType || '-'} #{h.relatedId || '-'} · {h.status || 'COMPLETED'}
                                </div>
                                {h.notes && <div className="mt-1 text-muted-foreground/60">{h.notes}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════════
          ADVANCED HISTORY MODAL
      ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-[min(1180px,96vw)] max-h-[92vh] overflow-hidden p-0 gap-0">
          <DialogHeader className="border-b px-5 py-4 pr-12">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <History size={18} className="text-primary" /> Advanced History
            </DialogTitle>
            <DialogDescription>
              Search by purchase reference, filter records, and expand purchase rows.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 overflow-y-auto">
            <div className="space-y-3">
              {/* Filters */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_220px] gap-2">
                <Input
                  value={historyQuery}
                  onChange={(e) => { setHistoryQuery(e.target.value); setHistoryPage(1); }}
                  placeholder="Search purchase ref, product, notes, amount..."
                />
                <Select value={historyDateFilter} onValueChange={(v: any) => { setHistoryDateFilter(v); setHistoryPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Date range" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="this_week">This Week</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="this_year">This Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={historyStatusFilter} onValueChange={(v: any) => { setHistoryStatusFilter(v); setHistoryPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Settled">Settled</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                    <SelectItem value="Returned">Returned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {historyDateFilter === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={historyFrom} onChange={(e) => { setHistoryFrom(e.target.value); setHistoryPage(1); }} />
                  <Input type="date" value={historyTo} onChange={(e) => { setHistoryTo(e.target.value); setHistoryPage(1); }} />
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {(['all', 'Purchases', 'Payments', 'Returns', 'Deleted Payments', 'Cancelled Bills'] as const).map((t) => (
                  <Button
                    key={t} size="sm"
                    variant={historyTypeFilter === t ? 'default' : 'outline'}
                    className="text-xs h-8"
                    onClick={() => { setHistoryTypeFilter(t); setHistoryPage(1); }}
                  >
                    {t === 'all' ? 'All Types' : t}
                  </Button>
                ))}
              </div>

              {/* Table */}
              <div className="border rounded-xl overflow-hidden">
                <div className="max-h-[60vh] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Purchase Ref</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Returned</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedAdvancedHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                            No records found for selected filters.
                          </TableCell>
                        </TableRow>
                      ) : pagedAdvancedHistory.map((row: any) => (
                        <React.Fragment key={row.id}>
                          <TableRow
                            className={row.rowKind === 'PURCHASE' ? 'cursor-pointer hover:bg-muted/40' : ''}
                            onClick={() => {
                              if (row.rowKind !== 'PURCHASE') return;
                              setExpandedInvoiceIds((prev) => ({ ...prev, [row.invoiceId]: !prev[row.invoiceId] }));
                            }}
                          >
                            <TableCell className="text-xs whitespace-nowrap">{new Date(row.date).toLocaleString()}</TableCell>
                            <TableCell>
                              <div className="font-semibold whitespace-nowrap">{row.displayRef || '-'}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {row.ref && row.ref !== row.displayRef ? row.ref : row.invoiceId ? `ID #${row.invoiceId}` : 'No linked purchase'}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[260px]">
                              <div className="truncate">{row.itemsText || row.notes || '-'}</div>
                              {row.itemsCount ? <div className="text-[11px] text-muted-foreground">{row.itemsCount} item{row.itemsCount === 1 ? '' : 's'}</div> : null}
                            </TableCell>
                            <TableCell className="text-right">{fmtPKR(row.total || 0)}</TableCell>
                            <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{fmtPKR(row.paid || 0)}</TableCell>
                            <TableCell className="text-right text-amber-600 dark:text-amber-400">{fmtPKR(row.returned || 0)}</TableCell>
                            <TableCell className="text-right">{fmtPKR(Math.max(0, row.remaining || 0))}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('whitespace-nowrap', statusBadgeClass(row.status))}>{row.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('whitespace-nowrap', typeBadgeClass(row.rowKind))}>{row.rowKind.replace('_', ' ')}</Badge>
                            </TableCell>
                          </TableRow>
                          {row.rowKind === 'PURCHASE' && expandedInvoiceIds[row.invoiceId] && (
                            <TableRow>
                              <TableCell colSpan={9} className="bg-muted/20">
                                <div className="text-xs space-y-1 py-1">
                                  <div><span className="font-bold">Products:</span> {(row.raw.items || []).map((i: any) => `${i.product_name} x${i.quantity}`).join(', ') || 'No items'}</div>
                                  <div><span className="font-bold">Payments:</span> {(row.raw.linkedPayments || []).map((p: any) => `${fmtPKR(p.amount)} (${new Date(p.date_created).toLocaleDateString()})`).join(', ') || 'None'}</div>
                                  <div><span className="font-bold">Returns:</span> {(row.raw.linkedReturns || []).map((r: any) => `${fmtPKR(r.total_returned)} (${new Date(r.date_created).toLocaleDateString()})`).join(', ') || 'None'}</div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/5">
                  <span className="text-xs text-muted-foreground">Page {Math.min(historyPage, historyTotalPages)} of {historyTotalPages}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}>Prev</Button>
                    <Button size="sm" variant="outline" disabled={historyPage >= historyTotalPages} onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}>Next</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════════
          PURCHASE DETAIL MODAL
      ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedPurchase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setSelectedPurchase(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <Card className="shadow-2xl border-border/60">
                <CardHeader className="border-b pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <Package size={16} className="text-blue-500" />
                        </div>
                        Purchase #{selectedPurchase.id}
                      </CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-2">
                        <Calendar size={11} />
                        {new Date(selectedPurchase.date_created).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60 mb-0.5">Grand Total</p>
                      <p className="text-2xl font-black text-destructive">{fmtPKR(selectedPurchase.total)}</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
                  {/* Payment history for this purchase */}
                  <div className="p-4 bg-muted/20 border-b">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-3 flex items-center gap-2">
                      <History size={12} /> Payment History
                    </h4>
                    {(selectedPurchase.linkedPayments || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No payments recorded for this bill.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(selectedPurchase.linkedPayments || []).map((pay: any) => (
                          <div key={pay.id} className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-lg border border-border/60 shadow-sm text-xs group">
                            <CheckCircle2 size={11} className="text-emerald-500" />
                            <span className="font-bold">{fmtPKR(pay.amount)}</span>
                            <span className="text-[10px] text-muted-foreground border-l pl-2">{new Date(pay.date_created).toLocaleDateString()}</span>
                            <button
                              onClick={() => handleDeletePayment(pay.id)}
                              className="ml-1 text-destructive hover:scale-110 transition-all p-1 rounded-full bg-destructive/5"
                              title="Delete payment"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  {purchaseItemsLoading ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <RefreshCw size={18} className="animate-spin mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Loading items…</p>
                    </div>
                  ) : purchaseItems.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground">
                      <Layers size={28} className="mx-auto opacity-20 mb-2" />
                      <p className="text-sm">No item breakdown found.</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 border-b sticky top-0">
                        <tr>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Product</th>
                          <th className="text-center py-3 px-3 text-xs font-semibold text-muted-foreground uppercase">Qty</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Unit</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {purchaseItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-semibold">{item.product_name || 'Unknown'}</p>
                              {item.category && <p className="text-xs text-muted-foreground">{item.category}</p>}
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-sm">{item.quantity_added}</td>
                            <td className="py-3 px-4 text-right font-mono text-sm">{fmtPKR(item.purchase_price)}</td>
                            <td className="py-3 px-4 text-right font-bold text-destructive">{fmtPKR(item.purchase_price * item.quantity_added)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 bg-muted/20">
                        <tr>
                          <td colSpan={3} className="py-3 px-4 font-black text-sm">Grand Total</td>
                          <td className="py-3 px-4 text-right font-black text-lg text-destructive">{fmtPKR(selectedPurchase.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </CardContent>

                <CardFooter className="border-t pt-4 gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setSelectedPurchase(null)}>Close</Button>
                  <Button
                    className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                    disabled={selectedPurchase.status === 'Cancelled'}
                    onClick={() => {
                      const initialQtys: Record<string | number, string> = {};
                      purchaseItems.forEach((item, idx) => { initialQtys[item.id || item.product_id || idx] = ''; });
                      setReturnQuantities(initialQtys);
                      setReturnReason('');
                      setReturnModalOpen(true);
                    }}
                  >
                    <Undo2 size={15} /> Return Items
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════════
          PURCHASE RETURN MODAL
      ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {returnModalOpen && selectedPurchase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="w-full max-w-2xl"
            >
              <Card className="shadow-2xl border-none overflow-hidden">
                <CardHeader className="bg-amber-600 text-white p-5 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Undo2 size={20} /> Return Items — PO #{selectedPurchase.id}
                    </CardTitle>
                    <CardDescription className="text-amber-50/70 mt-0.5">
                      Select items and quantities to return to supplier.
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10 text-white" onClick={() => setReturnModalOpen(false)}>
                    <X size={18} />
                  </Button>
                </CardHeader>

                <CardContent className="p-5 space-y-5">
                  <div className="rounded-xl border border-border/60 overflow-hidden max-h-[40vh] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50 sticky top-0 z-10">
                          <TableHead>Product</TableHead>
                          <TableHead className="text-center">Bought</TableHead>
                          <TableHead className="text-center">Returned</TableHead>
                          <TableHead className="text-center text-primary">Available</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right w-32">Qty to Return</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchaseItems.map((item, idx) => {
                          const availableToReturn = Math.max(0, item.quantity_remaining);
                          const itemKey = item.id || item.product_id || idx;
                          return (
                            <TableRow key={itemKey}>
                              <TableCell className="font-medium">{item.product_name}</TableCell>
                              <TableCell className="text-center">{item.quantity_added}</TableCell>
                              <TableCell className="text-center text-amber-600 dark:text-amber-400 font-bold">{item.quantity_returned || 0}</TableCell>
                              <TableCell className="text-center font-black text-primary">{availableToReturn}</TableCell>
                              <TableCell className="text-right text-sm">{fmtPKR(item.purchase_price)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <div className="flex items-center gap-1.5">
                                    {availableToReturn > 0 && (
                                      <Button
                                        variant="ghost" size="sm"
                                        className="h-6 px-1.5 text-[10px] text-primary hover:bg-primary/10"
                                        onClick={() => setReturnQuantities(prev => ({ ...prev, [itemKey]: String(availableToReturn) }))}
                                      >
                                        Max
                                      </Button>
                                    )}
                                    <Input
                                      type="text"
                                      className={cn(
                                        'h-8 w-20 text-right font-bold',
                                        (parseInt(String(returnQuantities[itemKey])) || 0) > availableToReturn ? 'border-destructive text-destructive bg-destructive/5' : 'border-primary/20',
                                        availableToReturn === 0 && 'opacity-50 cursor-not-allowed bg-muted'
                                      )}
                                      value={returnQuantities[itemKey] || ''}
                                      disabled={availableToReturn <= 0}
                                      onChange={(e) => {
                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                        setReturnQuantities(prev => ({ ...prev, [itemKey]: raw }));
                                      }}
                                      placeholder="0"
                                    />
                                  </div>
                                  {(parseInt(String(returnQuantities[itemKey])) || 0) > availableToReturn && (
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

                  <div>
                    <label className="text-xs font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400 mb-2">
                      <Package size={12} /> Reason for Return
                    </label>
                    <Input
                      placeholder="e.g. Expired, Damaged, Quality issues…"
                      className="border-amber-500/20"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-border/60">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Debit Note Value</p>
                      <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                        {fmtPKR(purchaseItems.reduce((sum, item, idx) => {
                          const itemKey = item.id || item.product_id || idx;
                          return sum + (item.purchase_price * (parseInt(String(returnQuantities[itemKey])) || 0));
                        }, 0))}
                      </p>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                      <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setReturnModalOpen(false)}>Cancel</Button>
                      <Button
                        className="flex-1 sm:flex-none gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={handleReturnSubmit}
                        disabled={isSubmittingReturn || purchaseItems.reduce((sum, item, idx) => {
                          const itemKey = item.id || item.product_id || idx;
                          return sum + (parseInt(String(returnQuantities[itemKey])) || 0);
                        }, 0) === 0}
                      >
                        {isSubmittingReturn
                          ? <RefreshCw className="animate-spin" size={15} />
                          : <Undo2 size={15} />}
                        Process Return
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════════
          ADD / EDIT VENDOR DIALOG
      ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-md"
            >
              <Card className="shadow-2xl border-border/60">
                <form onSubmit={handleSubmit}>
                  <CardHeader className="pb-4 border-b border-border/60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Truck size={18} className="text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{isEditing ? 'Edit Vendor' : 'Add New Vendor'}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">Enter supplier details below.</CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        Vendor Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="text"
                        required
                        value={current.name}
                        onChange={(e) => setCurrent({ ...current, name: e.target.value })}
                        placeholder="e.g. Sony Distributors"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Phone Number</label>
                      <Input
                        type="tel"
                        value={current.phone || ''}
                        onChange={(e) => setCurrent({ ...current, phone: e.target.value })}
                        placeholder="0300 1234567"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Address</label>
                      <Input
                        type="text"
                        value={current.address || ''}
                        onChange={(e) => setCurrent({ ...current, address: e.target.value })}
                        placeholder="Warehouse 12, Main Bazar"
                        className="h-10"
                      />
                    </div>
                  </CardContent>

                  <CardFooter className="gap-3 pt-4 border-t border-border/60">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>Cancel</Button>
                    <Button type="submit" className="flex-1 font-semibold">
                      {isEditing ? 'Save Changes' : 'Create Vendor'}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
