import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, Users, Pencil, Trash2, Phone, MessageCircle, DollarSign,
  ArrowRight, History, ShoppingBag, CreditCard, X, Receipt, Eye,
  Calendar, ChevronDown, Layers, Tag, Undo2, Printer, CheckCircle2, Check, FileText, RefreshCw, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { cn, formatInvoiceId } from '../lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useNotifications } from '../components/NotificationProvider';
import { useNavigate } from 'react-router-dom';
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton, SearchSpinner } from '../components/Pagination';
import { formatCustomerDataForPDF, generateCustomerPDFHTML } from '../lib/pdfExportService.ts';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Customer {
  id?: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

// ─── Constants & Helpers ──────────────────────────────────────────────────────
const HISTORY_PAGE = 15;
const fmtPKR = (n: any) => 'PKR ' + (Math.round(Number(n) || 0)).toLocaleString('en-PK');

// ─── Animation Variants ───────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.38, delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }
  }),
};

const slideIn = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.38, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, x: 24, transition: { duration: 0.22, ease: [0.23, 1, 0.32, 1] } },
};

// ─── CSS-only Tooltip ────────────────────────────────────────────────────────
const HoverTip = ({ text, children }: { text: string; children: React.ReactNode }) => (
  <div className="group/tip relative">
    {children}
    <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 z-50 opacity-0 group-hover/tip:opacity-100 transition-all duration-150 translate-y-1 group-hover/tip:translate-y-0">
      <div className="bg-foreground text-background text-[11px] font-semibold px-2.5 py-1.5 rounded-xl shadow-xl whitespace-nowrap">{text}</div>
    </div>
  </div>
);

// ─── Avatar initial circle ────────────────────────────────────────────────────
const Avatar = ({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) => {
  const sizeMap = { sm: 'w-8 h-8 text-sm', md: 'w-11 h-11 text-lg', lg: 'w-14 h-14 text-2xl' };
  return (
    <div className={cn('rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 font-black shrink-0', sizeMap[size])}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

// ─── Status Badge helper ──────────────────────────────────────────────────────
const statusBadgeClass = (status: string) => {
  if (status === 'Settled') return 'border-transparent bg-emerald-500 text-white shadow-sm hover:bg-emerald-500';
  if (status === 'Pending') return 'border-transparent bg-amber-500 text-white shadow-sm hover:bg-amber-500';
  if (status === 'Cancelled') return 'border-transparent bg-rose-600 text-white shadow-sm hover:bg-rose-600';
  if (status === 'Returned') return 'border-transparent bg-violet-600 text-white shadow-sm hover:bg-violet-600';
  return 'border-transparent bg-slate-500 text-white shadow-sm hover:bg-slate-500';
};

const typeBadgeClass = (type: string) => {
  if (type === 'SALE') return 'border-transparent bg-blue-500 text-white shadow-sm hover:bg-blue-500';
  if (type === 'PAYMENT') return 'border-transparent bg-emerald-500 text-white shadow-sm hover:bg-emerald-500';
  if (type === 'RETURN') return 'border-transparent bg-violet-600 text-white shadow-sm hover:bg-violet-600';
  if (type === 'DELETED_PAYMENT' || type === 'CANCELLED_BILL') return 'border-transparent bg-rose-600 text-white shadow-sm hover:bg-rose-600';
  return 'border-transparent bg-slate-500 text-white shadow-sm hover:bg-slate-500';
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function QuickPaymentInput({ sale, onPay }: { sale: any; onPay: (amount: string) => void }) {
  const [val, setVal] = React.useState('');
  return (
    <div className="flex-1 flex gap-1.5">
      <Input
        type="text"
        placeholder="Amount"
        className="h-8 text-[11px] font-bold w-24 shadow-sm bg-background"
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, ''))}
      />
      <Button
        size="sm"
        className="h-8 text-[11px] px-3 flex-1 bg-primary hover:bg-primary/90 shadow-sm"
        onClick={() => { if (!val) return; onPay(val); setVal(''); }}
      >
        Pay
      </Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [current, setCurrent] = useState<Customer>({ name: '', phone: '', email: '', address: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

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

  // History filters
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState<'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'custom'>('this_month');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'Settled' | 'Pending' | 'Cancelled' | 'Returned'>('all');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'Sales' | 'Payments' | 'Returns' | 'Deleted Payments' | 'Cancelled Bills'>('all');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Record<number, boolean>>({});
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // Summary date filter
  const [summaryDateFilter, setSummaryDateFilter] = useState<'today' | 'weekly' | 'custom' | 'months'>('today');
  const [summaryMonths, setSummaryMonths] = useState<string>('1');
  const [summaryFrom, setSummaryFrom] = useState('');
  const [summaryTo, setSummaryTo] = useState('');

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  // ─── Data Loading ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadCustomers();
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, []);

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
      else addNotification('Error', res.error || 'Failed to load details', 'error');
    } catch (err) { console.error(err); }
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleReturnSubmit = async () => {
    const itemsToReturn = saleItems.map(item => ({
      sale_item_id: item.id,
      product_id: item.product_id,
      product_name: item.product_name || item.name,
      quantity: parseInt(returnQuantities[item.id] || '0'),
      price: item.price,
      max_available: Math.max(0, item.quantity - (item.quantity_returned || 0))
    })).filter(i => i.quantity > 0);

    const invalidItems = itemsToReturn.filter(i => i.quantity > i.max_available);
    if (invalidItems.length > 0) {
      addNotification('Validation', `Cannot return more than sold for: ${invalidItems.map(i => i.product_name).join(', ')}`, 'error');
      return;
    }
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
          const itemsRes = await window.api.getSaleItems(selectedSale.id);
          if (itemsRes.success) setSaleItems(itemsRes.data);
        } else addNotification('Error', res.error || 'Failed to process return', 'error');
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
      } else addNotification("Error", res.error || "Failed to cancel", "error");
    }
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
    } catch { } finally { setSaleItemsLoading(false); }
  };

  const handleSearch = (v: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setIsSearching(true);
    setSearchTerm(v);
    searchTimerRef.current = setTimeout(() => setIsSearching(false), 200);
  };

  const filteredCustomers = useMemo(() => customers.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || '').includes(searchTerm)
  ), [customers, searchTerm]);

  const { visible: visibleCustomers, hasMore, loadMore, total, showing } = usePagination(filteredCustomers, 10, 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current.name.trim()) { addNotification('Validation Error', 'Customer name is required.', 'warning'); return; }
    if (isEditing && current.id) {
      const res = await window.api.updateCustomer(current.id, current);
      if (res.success) { addNotification('Customer updated', `${current.name} updated successfully.`, 'success'); loadCustomers(); setShowDialog(false); }
    } else {
      const res = await window.api.addCustomer(current);
      if (res.success) { addNotification('Customer added', `${current.name} added to database.`, 'success'); loadCustomers(); setShowDialog(false); }
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
      if (s && Number(finalAmount) > (s.remaining + 0.5)) { addNotification('Warning', 'Payment cannot exceed sale balance', 'warning'); return; }
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
    } else addNotification('Error', res.error || 'Failed to delete payment', 'error');
  };

  const handleWriteOff = async (saleId: number, remaining: number) => {
    const input = window.prompt(
      `Write off balance as discount for Sale #${saleId}.\nRemaining: PKR ${Math.round(remaining)}\n\nEnter amount to write off:`,
      String(Math.round(remaining))
    );
    if (input === null) return; // cancelled
    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) {
      addNotification('Invalid', 'Enter a valid positive amount.', 'warning');
      return;
    }
    if (amount > remaining + 0.5) {
      addNotification('Too High', `Cannot write off more than the remaining balance (${fmtPKR(remaining)}).`, 'warning');
      return;
    }
    const res = await (window.api as any).writeOffSaleBalance(saleId, amount);
    if (res?.success) {
      addNotification('Written Off', `${fmtPKR(amount)} written off as discount on Sale #${saleId}.`, 'success');
      if (selectedCustomer?.id) loadCustomerDetails(selectedCustomer.id);
    } else {
      addNotification('Error', res?.error || 'Failed to write off balance.', 'error');
    }
  };

  const handleMarkAllPaid = async () => {
    if (!selectedCustomer?.id || !customerDetails?.balance || customerDetails.balance <= 0) {
      addNotification('Info', 'Balance is already 0.', 'info');
      return;
    }
    setPaymentLoading(true);
    const res = await window.api.addCustomerPayment({ customer_id: selectedCustomer.id, amount: customerDetails.balance, notes: 'Marked All as Paid' });
    if (res.success) { addNotification('Settled', 'Customer balance settled.', 'success'); loadCustomerDetails(selectedCustomer.id!); }
    setPaymentLoading(false);
  };

  const exportPDF = async () => {
    if (!customerDetails) { addNotification('Error', 'Customer details are still loading.', 'error'); return; }
    try {
      const pdfData = formatCustomerDataForPDF(customerDetails);
      const html = generateCustomerPDFHTML(pdfData);
      const res = await window.api.saveInvoicePdf(html);
      if (res.success) addNotification('PDF Saved', 'Customer statement PDF saved successfully.', 'success');
      else if (res.error !== 'Cancelled') addNotification('Error', res.error || 'Failed to save customer statement.', 'error');
    } catch (err) { console.error(err); addNotification('Error', 'Failed to export customer statement.', 'error'); }
  };

  const sendWhatsApp = (sale?: any) => {
    if (!selectedCustomer?.phone) { addNotification('No Phone', "Customer doesn't have a phone number.", 'warning'); return; }
    let number = selectedCustomer.phone.replace(/[^0-9]/g, '');
    if (number.startsWith('0')) number = '92' + number.substring(1);
    const storeName = customerDetails?.settings?.store_name || 'Our Store';
    let msg = '';
    if (sale) {
      const remaining = Math.max(0, Math.round(sale.remaining));
      msg = `*Order Update / آرڈر اپڈیٹ - ${storeName}*\n\n` +
        `Hello / السلام علیکم *${selectedCustomer.name}*,\n` +
        `Order / آرڈر: *#${sale.id}*\n--------------------------\n` +
        `• Date / تاریخ: ${new Date(sale.date_created).toLocaleDateString()}\n` +
        `• Bill / کل بل: PKR ${Math.round(sale.total).toLocaleString()}\n` +
        `• Paid / ادا شدہ: PKR ${Math.round(sale.amountPaid).toLocaleString()}\n--------------------------\n` +
        `*Balance Due / بقایا رقم: PKR ${remaining.toLocaleString()}*\n\nPlease acknowledge. Thank you!\nشکریہ!`;
    } else {
      const totalTaken = customerDetails?.totalTaken || 0;
      const totalPaid = customerDetails?.totalPaid || 0;
      const totalReturned = customerDetails?.totalReturned || 0;
      const balance = Math.max(0, customerDetails?.balance || 0);
      msg = `*Account Summary / حساب کی تفصیل - ${storeName}*\n\n` +
        `Hello / السلام علیکم *${selectedCustomer.name}*,\n` +
        `Your balance summary / آپ کے حساب کی تفصیل:\n--------------------------\n` +
        `• Total Purchases / کل خریداری: PKR ${Math.round(totalTaken).toLocaleString()}\n` +
        `• Total Paid / کل ادائیگی: PKR ${Math.round(totalPaid).toLocaleString()}\n` +
        `• Returns / واپسی: PKR ${Math.round(totalReturned).toLocaleString()}\n--------------------------\n` +
        `*Net Balance Due / بقایا رقم: PKR ${Math.round(balance).toLocaleString()}*\n\nPlease clear your dues. Thank you!\nبراہ کرم اپنی بقایا رقم جلد ادا کریں۔ شکریہ!`;
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
            <thead><tr style="border-bottom: 1px solid #ddd;"><th style="text-align: left; padding: 4px 0;">Item</th><th style="text-align: center;">Qty</th><th style="text-align: right;">Total</th></tr></thead>
            <tbody>${items.map((i: any) => `<tr><td style="padding: 4px 0;">${i.product_name || i.name}</td><td style="text-align: center;">${i.quantity}</td><td style="text-align: right;">${fmtPKR(i.price * i.quantity)}</td></tr>`).join('')}</tbody>
          </table>
          <hr/>
          <div style="display: flex; justify-content: space-between; font-weight: bold;"><span>Grand Total:</span><span>${fmtPKR(sale.total)}</span></div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; margin-top: 4px;"><span>Amount Paid:</span><span>${fmtPKR(sale.amountPaid)}</span></div>
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; margin-top: 5px; color: red;"><span>Remaining:</span><span>${fmtPKR(sale.remaining)}</span></div>
          <p style="text-align: center; font-size: 10px; margin-top: 20px; color: #888;">Thank you for your business!</p>
        </div>
      `;
      await window.api.printInvoice(html);
    } catch (e) { addNotification("Error", "Failed to print invoice", "error"); }
  };

  // ─── Computed Data ────────────────────────────────────────────────────────
  const historyLogs = useMemo(() => {
    if (!customerDetails) return [];
    const sales = (customerDetails.sales || []).map((s: any) => ({ ...s, type: 'SALE', date: s.date_created }));
    const payments = (customerDetails.payments || []).map((p: any) => ({ ...p, type: 'PAYMENT', date: p.date_added }));
    const returns = (customerDetails.returns || []).map((r: any) => ({ ...r, type: 'RETURN', date: r.date_returned, total: r.total_returned }));
    return [...sales, ...payments, ...returns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [customerDetails]);

  const visibleHistory = historyLogs.slice(0, historyVisible);
  const hasMoreHistory = historyVisible < historyLogs.length;
  const actionHistory = useMemo(() => (customerDetails?.history || []) as any[], [customerDetails]);

  const advancedHistoryRows = useMemo(() => {
    if (!customerDetails) return [];
    const saleRefById = new Map<number, string>(
      (customerDetails.sales || []).map((s: any) => [Number(s.id), formatInvoiceId(s.id, s.date_created)])
    );
    const sales = (customerDetails.sales || []).map((s: any) => ({
      rowKind: 'SALE', id: `sale-${s.id}`, date: s.date_created, invoiceId: s.id,
      displayRef: formatInvoiceId(s.id, s.date_created),
      itemsText: (s.items || []).map((i: any) => i.product_name).join(', '),
      itemsCount: (s.items || []).length,
      total: Number(s.total) || 0, paid: Number(s.amountPaid) || 0,
      returned: Number(s.amountReturned) || 0, remaining: Math.max(0, Number(s.remaining) || 0),
      status: s.status === 'Cancelled' ? 'Cancelled' : (Number(s.amountReturned) || 0) > 0 ? 'Returned' : Math.max(0, Number(s.remaining) || 0) <= 0.5 ? 'Settled' : 'Pending',
      notes: s.notes || '', ref: formatInvoiceId(s.id, s.date_created), raw: s
    }));
    const payments = (customerDetails.payments || []).map((p: any) => ({
      rowKind: 'PAYMENT', id: `payment-${p.id}`, date: p.date_added || p.date_created, invoiceId: p.sale_id || null,
      displayRef: p.sale_id ? saleRefById.get(Number(p.sale_id)) || formatInvoiceId(p.sale_id, p.date_added || p.date_created) : `CP-${p.id}`,
      itemsText: '', itemsCount: 0, total: 0, paid: Number(p.amount) || 0, returned: 0, remaining: 0,
      status: 'Settled', notes: p.notes || '', ref: `CP-${p.id}`, raw: p
    }));
    const returns = (customerDetails.returns || []).map((r: any) => ({
      rowKind: 'RETURN', id: `return-${r.id}`, date: r.date_created || r.date_returned, invoiceId: r.sale_id || null,
      displayRef: r.sale_id ? saleRefById.get(Number(r.sale_id)) || formatInvoiceId(r.sale_id, r.date_created || r.date_returned) : `SR-${r.id}`,
      itemsText: '', itemsCount: 0, total: 0, paid: 0, returned: Number(r.total_returned) || 0, remaining: 0,
      status: 'Returned', notes: r.reason || r.notes || '', ref: `SR-${r.id}`, raw: r
    }));
    const history = (actionHistory || []).map((h: any) => ({
      rowKind: h.type === 'PAYMENT_DELETED' ? 'DELETED_PAYMENT' : h.type === 'SALE_CANCELLED' ? 'CANCELLED_BILL' : 'HISTORY',
      id: `history-${h.id}`, date: h.date,
      invoiceId: h.relatedId || null,
      displayRef: h.relatedId && String(h.relatedType || '').toUpperCase().includes('SALE')
        ? saleRefById.get(Number(h.relatedId)) || formatInvoiceId(h.relatedId, h.date)
        : `${h.relatedType || 'H'}-${h.relatedId || h.id}`,
      itemsText: '', itemsCount: 0, total: 0,
      paid: h.type?.includes('PAYMENT') ? Number(h.amount) || 0 : 0,
      returned: h.type?.includes('RETURN') ? Number(h.amount) || 0 : 0,
      remaining: 0,
      status: h.status === 'DELETED' ? 'Cancelled' : h.status === 'CANCELLED' ? 'Cancelled' : 'Settled',
      notes: h.notes || h.type || '', ref: `${h.relatedType || 'H'}-${h.relatedId || h.id}`, raw: h
    }));
    return [...sales, ...payments, ...returns, ...history]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [customerDetails, actionHistory]);

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
        if (historyTypeFilter === 'Sales' && row.rowKind !== 'SALE') return false;
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
    if (!customerDetails) return { totalTaken: 0, totalPaid: 0, totalReturned: 0 };
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
    const totalTaken = (customerDetails.sales || []).filter((s: any) => (s.status || '').toLowerCase() !== 'cancelled' && inSummaryRange(s.date_created)).reduce((sum: number, s: any) => sum + (Number(s.total) || 0), 0);
    const totalPaid = (customerDetails.payments || []).filter((p: any) => inSummaryRange(p.date_added || p.date_created)).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const totalReturned = (customerDetails.returns || []).filter((r: any) => inSummaryRange(r.date_created || r.date_returned)).reduce((sum: number, r: any) => sum + (Number(r.total_returned) || 0), 0);
    return { totalTaken, totalPaid, totalReturned };
  }, [customerDetails, summaryDateFilter, summaryMonths, summaryFrom, summaryTo]);

  const HISTORY_PAGE_SIZE = 20;
  const historyTotalPages = Math.max(1, Math.ceil(filteredAdvancedHistory.length / HISTORY_PAGE_SIZE));
  const pagedAdvancedHistory = useMemo(() => {
    const safePage = Math.min(historyPage, historyTotalPages);
    const start = (safePage - 1) * HISTORY_PAGE_SIZE;
    return filteredAdvancedHistory.slice(start, start + HISTORY_PAGE_SIZE);
  }, [filteredAdvancedHistory, historyPage, historyTotalPages]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex gap-5">

      {/* ════════════════ LEFT: Customer List ════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-border/40 bg-card">
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/15">
                  <Users size={18} className="text-blue-500" />
                </div>
                <h1 className="text-2xl font-black tracking-tight">Customers</h1>
              </div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest ml-[52px]">
                {customers.length} total customers
              </p>
            </div>
            <Button
              onClick={() => { setCurrent({ name: '', phone: '', email: '', address: '' }); setIsEditing(false); setShowDialog(true); }}
              className="gap-2 shadow-sm h-10 px-4 rounded-xl"
            >
              <Plus size={16} /> New Customer
            </Button>
          </motion.div>

          <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible" className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Search by name or phone..."
              className="pl-10 h-11 bg-background border-border/60 rounded-xl text-sm shadow-sm"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {isSearching && <SearchSpinner className="right-3.5 top-3 absolute" />}
          </motion.div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 text-muted-foreground">
              <Users size={52} className="opacity-15" />
              <div className="text-center">
                <p className="font-semibold text-sm">No customers yet</p>
                <p className="text-xs mt-1 opacity-70">Click "New Customer" to get started</p>
              </div>
            </div>
          ) : (
            <div>
              {visibleCustomers.map((c, i) => (
                <motion.div
                  key={c.id}
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  onClick={() => openCustomer(c)}
                  className={cn(
                    'flex items-center justify-between px-5 py-4 cursor-pointer transition-all duration-200 border-b border-border/30 last:border-none',
                    'hover:bg-muted/25',
                    selectedCustomer?.id === c.id
                      ? 'bg-primary/5 border-l-[3px] border-l-primary pl-[17px]'
                      : 'border-l-[3px] border-l-transparent'
                  )}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <Avatar name={c.name} size="md" />
                    <div className="min-w-0">
                      <h4 className="font-bold text-[15px] truncate">{c.name}</h4>
                      {c.phone && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Phone size={11} /> {c.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <HoverTip text="Edit customer">
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 rounded-xl hover:text-primary hover:bg-primary/10"
                        onClick={(e) => { e.stopPropagation(); setCurrent({ ...c }); setIsEditing(true); setShowDialog(true); }}
                      >
                        <Pencil size={14} />
                      </Button>
                    </HoverTip>
                    <HoverTip text="Delete customer">
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 rounded-xl text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDelete(e, c.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </HoverTip>
                    <ArrowRight size={16} className={cn('ml-1 transition-colors', selectedCustomer?.id === c.id ? 'text-primary' : 'text-muted-foreground/30')} />
                  </div>
                </motion.div>
              ))}
              <LoadMoreButton hasMore={hasMore} loadMore={loadMore} showing={showing} total={total} itemType="customers" />
            </div>
          )}
        </div>
      </div>

      {/* ════════════════ RIGHT: Customer Detail Panel ════════════════ */}
      <AnimatePresence>
        {selectedCustomer && (
          <motion.div
            key="detail-panel"
            variants={slideIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-[430px] shrink-0 flex flex-col rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden"
          >
            {/* Panel Header */}
            <div className="relative border-b border-border/40 bg-card">
              {/* Gradient accent bar */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 via-violet-500 to-blue-400" />

              <div className="px-5 pt-7 pb-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={selectedCustomer.name} size="lg" />
                    <div>
                      <h2 className="text-lg font-black leading-tight">{selectedCustomer.name}</h2>
                      <div className="flex flex-col gap-0.5 mt-1">
                        {selectedCustomer.phone && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Phone size={11} /> {selectedCustomer.phone}
                          </span>
                        )}
                        {selectedCustomer.address && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{selectedCustomer.address}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 shrink-0" onClick={closeCustomer}>
                    <X size={16} />
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-2 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    onClick={() => sendWhatsApp()}
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-2 h-9 rounded-xl"
                    onClick={() => navigate(`/sales`)}
                  >
                    <ShoppingBag size={14} /> New Sale
                  </Button>
                </div>
              </div>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto">
              {!customerDetails ? (
                <div className="flex h-full min-h-[400px] items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <RefreshCw size={26} className="animate-spin text-primary" />
                    </div>
                    <p className="text-sm font-semibold">Loading details...</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">

                  {/* ── Summary Stats ── */}
                  <div className="p-5 border-b border-border/30">
                    {/* Summary filter controls */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mr-1">Period</p>
                      <Select value={summaryDateFilter} onValueChange={(v: any) => setSummaryDateFilter(v)}>
                        <SelectTrigger className="h-7 w-[120px] text-[11px] rounded-lg border-border/60">
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
                          <SelectTrigger className="h-7 w-[130px] text-[11px] rounded-lg border-border/60">
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
                          <Input type="date" className="h-7 text-[11px] w-32 rounded-lg" value={summaryFrom} onChange={(e) => setSummaryFrom(e.target.value)} />
                          <Input type="date" className="h-7 text-[11px] w-32 rounded-lg" value={summaryTo} onChange={(e) => setSummaryTo(e.target.value)} />
                        </>
                      )}
                    </div>

                    {/* KPI cards */}
                    <div className="grid grid-cols-3 gap-2.5 mb-3">
                      <div className="relative overflow-hidden rounded-xl border border-blue-500/15 bg-card p-3">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/6 via-transparent to-transparent opacity-70" />
                        <div className="relative z-10">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Purchased</p>
                          <p className="text-sm font-black tracking-tight text-blue-600">{fmtPKR(summaryStats.totalTaken)}</p>
                        </div>
                      </div>
                      <div className="relative overflow-hidden rounded-xl border border-emerald-500/15 bg-card p-3">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/6 via-transparent to-transparent opacity-70" />
                        <div className="relative z-10">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Paid</p>
                          <p className="text-sm font-black tracking-tight text-emerald-600">{fmtPKR(summaryStats.totalPaid)}</p>
                        </div>
                      </div>
                      <div className="relative overflow-hidden rounded-xl border border-amber-500/15 bg-card p-3">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/6 via-transparent to-transparent opacity-70" />
                        <div className="relative z-10">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Returned</p>
                          <p className="text-sm font-black tracking-tight text-amber-600">-{fmtPKR(summaryStats.totalReturned)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Net Balance */}
                    <div className={cn(
                      'flex items-center justify-between rounded-xl px-4 py-3 border',
                      (customerDetails.balance || 0) > 0
                        ? 'bg-rose-500/5 border-rose-500/20'
                        : 'bg-emerald-500/5 border-emerald-500/20'
                    )}>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Net Balance (Qaraz)</p>
                        <Badge className={cn(
                          'mt-1 text-[9px] border-none font-bold',
                          (customerDetails.balance || 0) > 0 ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                        )}>
                          {(customerDetails.balance || 0) > 0 ? 'Unpaid' : 'Settled'}
                        </Badge>
                      </div>
                      {(customerDetails.balance || 0) > 0 ? (
                        <span className="text-xl font-black text-rose-500">{fmtPKR(Math.max(0, customerDetails.balance || 0))}</span>
                      ) : (
                        <span className="text-sm font-black text-emerald-600">Fully Settled ✓</span>
                      )}
                    </div>
                  </div>

                  {/* ── Payment Recording ── */}
                  {(customerDetails.balance || 0) > 0 && (
                    <div className="px-5 py-4 border-b border-border/30 bg-emerald-500/3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                        <CreditCard size={11} /> Record Payment
                      </p>
                      <div className="flex gap-2 mb-2">
                        <Input
                          type="text"
                          placeholder="Amount (PKR)..."
                          className="flex-1 h-9 text-sm font-mono bg-background"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value.replace(/[^0-9]/g, ''))}
                          onKeyDown={(e) => { if (e.key === 'Enter' && paymentAmount) handleAddPayment(); }}
                        />
                        <Button
                          size="sm"
                          className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                          disabled={paymentLoading || !paymentAmount}
                          onClick={() => { if (paymentAmount) handleAddPayment(); }}
                        >
                          {paymentLoading ? <RefreshCw size={13} className="animate-spin" /> : 'Log'}
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/5 font-semibold"
                        disabled={paymentLoading}
                        onClick={handleMarkAllPaid}
                      >
                        <CheckCircle2 size={12} className="mr-1.5" />
                        Clear Full Balance — {fmtPKR(customerDetails.balance)}
                      </Button>
                    </div>
                  )}

                  {/* ── Action Buttons ── */}
                  <div className="px-5 py-4 border-b border-border/30 flex flex-col gap-2.5">
                    <Button
                      className="w-full gap-2 h-10 rounded-xl shadow-sm"
                      onClick={() => setHistoryModalOpen(true)}
                    >
                      <History size={15} />
                      Advanced History
                      <Badge variant="secondary" className="ml-auto text-[10px] bg-white/20 text-white border-none">
                        {filteredAdvancedHistory.length}
                      </Badge>
                    </Button>
                    <Button
                      className="w-full gap-2 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-sm"
                      onClick={exportPDF}
                    >
                      <Download size={15} />
                      Export Statement PDF
                    </Button>
                  </div>

                  {/* ── Transaction Tabs ── */}
                  <div className="p-5">
                    <Tabs defaultValue="tx-history">
                      <TabsList className="w-full grid grid-cols-2 mb-4 h-10 rounded-xl">
                        <TabsTrigger value="tx-history" className="rounded-lg text-xs font-semibold">Transactions</TabsTrigger>
                        <TabsTrigger value="activity-log" className="rounded-lg text-xs font-semibold">Activity Log</TabsTrigger>
                      </TabsList>

                      {/* ── Transactions Tab ── */}
                      <TabsContent value="tx-history">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Transaction History</p>
                          <Badge variant="secondary" className="text-[10px]">{historyLogs.length} entries</Badge>
                        </div>
                        <div className="flex flex-col gap-3">
                          {historyLogs.length === 0 ? (
                            <div className="py-10 text-center border border-dashed border-border/60 rounded-xl bg-muted/5">
                              <History size={28} className="mx-auto opacity-15 mb-3" />
                              <p className="text-sm text-muted-foreground font-medium">No activity found.</p>
                            </div>
                          ) : (
                            visibleHistory.map((item: any, idx: number) => {
                              if (item.type === 'SALE') {
                                const s = item;
                                return (
                                  <motion.div
                                    key={`s-${s.id}`}
                                    custom={idx}
                                    variants={fadeUp}
                                    initial="hidden"
                                    animate="visible"
                                    className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                                  >
                                    {/* Sale card top accent */}
                                    <div className="h-[2px] bg-gradient-to-r from-blue-500 to-violet-500" />

                                    {/* Sale card header */}
                                    <div className="px-4 pt-3 pb-2.5 flex justify-between items-start border-b border-border/30">
                                      <div>
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sale #{s.id}</span>
                                          {s.status === 'Cancelled' ? (
                                            <Badge className="bg-slate-500 text-white text-[9px] py-0 h-4 border-none">Cancelled</Badge>
                                          ) : s.status === 'Returned' || s.amountReturned > 0 ? (
                                            <Badge className="bg-amber-500 text-white text-[9px] py-0 h-4 border-none">Returned</Badge>
                                          ) : Math.round(s.remaining) <= 0 ? (
                                            <Badge className="bg-emerald-500 text-white text-[9px] py-0 h-4 border-none">Settled</Badge>
                                          ) : s.amountPaid > 0 ? (
                                            <Badge className="bg-amber-500 text-white text-[9px] py-0 h-4 border-none">Partial</Badge>
                                          ) : (
                                            <Badge className="bg-rose-500 text-white text-[9px] py-0 h-4 border-none">Pending</Badge>
                                          )}
                                        </div>
                                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                          <Calendar size={10} />
                                          {new Date(s.date).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                      </div>
                                      <Button
                                        variant="ghost" size="icon"
                                        className="h-7 w-7 rounded-lg hover:bg-blue-500/10 hover:text-blue-600"
                                        onClick={() => openSaleDetail(s)}
                                      >
                                        <Eye size={13} />
                                      </Button>
                                    </div>

                                    {/* Sale card body */}
                                    <div className="px-4 py-3 space-y-3">
                                      <div className="grid grid-cols-3 gap-1.5">
                                        <div className="bg-muted/20 rounded-lg p-2 text-center">
                                          <p className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">Total</p>
                                          <p className="text-xs font-black">{fmtPKR(s.total)}</p>
                                        </div>
                                        <div className="bg-emerald-500/5 rounded-lg p-2 text-center border border-emerald-500/10">
                                          <p className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">Paid</p>
                                          <p className="text-xs font-black text-emerald-600">{fmtPKR(s.amountPaid)}</p>
                                        </div>
                                        <div className={cn('rounded-lg p-2 text-center', Math.round(s.remaining) > 0 ? 'bg-rose-500/5 border border-rose-500/10' : 'bg-muted/20')}>
                                          <p className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">Balance</p>
                                          <p className={cn('text-xs font-black', Math.round(s.remaining) > 0 ? 'text-rose-500' : 'text-emerald-600')}>
                                            {fmtPKR(Math.max(0, Math.round(s.remaining)))}
                                          </p>
                                        </div>
                                      </div>

                                      {s.items?.length > 0 && (
                                        <div className="text-[11px] text-muted-foreground bg-muted/20 px-2.5 py-2 rounded-lg border border-border/30">
                                          <p className="font-bold mb-0.5 flex items-center gap-1 text-foreground/70">
                                            <Layers size={10} /> Items:
                                          </p>
                                          <p className="line-clamp-2 leading-relaxed">
                                            {s.items.map((item: any) => `${item.product_name} ×${item.quantity}`).join(', ')}
                                          </p>
                                        </div>
                                      )}

                                      <div className="flex gap-1.5 pt-0.5">
                                        {s.status !== 'Cancelled' && s.remaining > 0.1 && (
                                          <QuickPaymentInput sale={s} onPay={(amt) => handleAddPayment(s.id, amt)} />
                                        )}
                                        {s.status !== 'Cancelled' && s.remaining > 0.1 && (
                                          <HoverTip text="Write off as discount">
                                            <Button
                                              variant="ghost" size="sm"
                                              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-violet-500 hover:bg-violet-500/10"
                                              onClick={() => handleWriteOff(s.id, s.remaining)}
                                            >
                                              <Tag size={12} />
                                            </Button>
                                          </HoverTip>
                                        )}
                                        <HoverTip text="View details">
                                          <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => openSaleDetail(s)}>
                                            <Eye size={12} />
                                          </Button>
                                        </HoverTip>
                                        {s.status !== 'Cancelled' && (
                                          <HoverTip text="Cancel sale">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10" onClick={() => handleCancelSale(s.id)}>
                                              <X size={12} />
                                            </Button>
                                          </HoverTip>
                                        )}
                                        <HoverTip text="WhatsApp">
                                          <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950" onClick={() => sendWhatsApp(s)}>
                                            <MessageCircle size={12} />
                                          </Button>
                                        </HoverTip>
                                        <HoverTip text="Print invoice">
                                          <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-950" onClick={() => printSaleInvoice(s)}>
                                            <Printer size={12} />
                                          </Button>
                                        </HoverTip>
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              } else if (item.type === 'PAYMENT') {
                                return (
                                  <motion.div
                                    key={`pay-${item.id}-${idx}`}
                                    custom={idx}
                                    variants={fadeUp}
                                    initial="hidden"
                                    animate="visible"
                                    className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex justify-between items-center group hover:border-emerald-500/30 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-600 shrink-0">
                                        <CheckCircle2 size={14} />
                                      </div>
                                      <div>
                                        <p className="text-[11px] font-black uppercase text-emerald-700 dark:text-emerald-400">Payment Collected</p>
                                        <p className="text-[10px] text-muted-foreground">{new Date(item.date).toLocaleString()}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">{fmtPKR(item.amount)}</span>
                                      <Button
                                        variant="ghost" size="icon"
                                        className="h-7 w-7 rounded-lg text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleDeletePayment(item.id)}
                                      >
                                        <Trash2 size={12} />
                                      </Button>
                                    </div>
                                  </motion.div>
                                );
                              } else if (item.type === 'RETURN') {
                                return (
                                  <motion.div
                                    key={`ret-${item.id}-${idx}`}
                                    custom={idx}
                                    variants={fadeUp}
                                    initial="hidden"
                                    animate="visible"
                                    className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex justify-between items-center"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600 shrink-0">
                                        <Undo2 size={14} />
                                      </div>
                                      <div>
                                        <p className="text-[11px] font-black uppercase text-amber-700 dark:text-amber-400">Return</p>
                                        <p className="text-[10px] text-muted-foreground">{new Date(item.date).toLocaleString()}</p>
                                      </div>
                                    </div>
                                    <span className="text-sm font-black text-amber-700 dark:text-amber-400">-{fmtPKR(item.total)}</span>
                                  </motion.div>
                                );
                              }
                              return null;
                            })
                          )}
                        </div>

                        {hasMoreHistory && (
                          <Button
                            variant="ghost"
                            onClick={() => setHistoryVisible(v => v + HISTORY_PAGE)}
                            className="w-full text-xs text-primary mt-4 border border-dashed border-border/50 rounded-xl h-10 hover:bg-primary/5"
                          >
                            <ChevronDown size={14} className="mr-1.5" />
                            Load more ({historyVisible} of {historyLogs.length})
                          </Button>
                        )}
                      </TabsContent>

                      {/* ── Activity Log Tab ── */}
                      <TabsContent value="activity-log">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Activity Log</p>
                          <Badge variant="secondary" className="text-[10px]">{actionHistory.length} entries</Badge>
                        </div>
                        {actionHistory.length === 0 ? (
                          <div className="py-10 text-center border border-dashed border-border/60 rounded-xl bg-muted/5">
                            <History size={28} className="mx-auto opacity-15 mb-3" />
                            <p className="text-sm text-muted-foreground font-medium">No history available yet.</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {actionHistory.map((h: any) => (
                              <div key={`ch-${h.id}`} className="rounded-xl border border-border/40 bg-muted/10 p-3 text-xs hover:bg-muted/20 transition-colors">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="font-bold text-[11px]">{h.type}</span>
                                  <span className="text-[10px] text-muted-foreground">{new Date(h.date).toLocaleString()}</span>
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  Amount: <span className="font-semibold text-foreground">{fmtPKR(h.amount || 0)}</span>
                                  {' · '} Related: {h.relatedType || '-'} #{h.relatedId || '-'}
                                  {' · '} Status: {h.status || 'COMPLETED'}
                                </div>
                                {h.notes && <div className="mt-1 text-[11px] text-muted-foreground italic">{h.notes}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════ Advanced History Modal ════════════════ */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-[min(1180px,96vw)] max-h-[92vh] overflow-hidden p-0 gap-0 rounded-2xl border-border/50">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 via-violet-500 to-blue-400 rounded-t-2xl z-10" />
          <DialogHeader className="border-b border-border/40 px-6 py-5 pr-14 pt-7">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-black">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/15">
                <History size={16} className="text-blue-500" />
              </div>
              Advanced History
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Search by invoice number, filter records, and expand sale rows for products, payments, and returns.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 overflow-y-auto space-y-4">
            {/* Filters */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px_200px] gap-2.5">
                <Input
                  value={historyQuery}
                  onChange={(e) => { setHistoryQuery(e.target.value); setHistoryPage(1); }}
                  placeholder="Search invoice #, product, notes, amount, reference..."
                  className="rounded-xl h-10 border-border/60"
                />
                <Select value={historyDateFilter} onValueChange={(v: any) => { setHistoryDateFilter(v); setHistoryPage(1); }}>
                  <SelectTrigger className="rounded-xl h-10 border-border/60"><SelectValue placeholder="Date range" /></SelectTrigger>
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
                  <SelectTrigger className="rounded-xl h-10 border-border/60"><SelectValue placeholder="Status" /></SelectTrigger>
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
                <div className="grid grid-cols-2 gap-2.5">
                  <Input type="date" value={historyFrom} onChange={(e) => { setHistoryFrom(e.target.value); setHistoryPage(1); }} className="rounded-xl h-10 border-border/60" />
                  <Input type="date" value={historyTo} onChange={(e) => { setHistoryTo(e.target.value); setHistoryPage(1); }} className="rounded-xl h-10 border-border/60" />
                </div>
              )}

              {/* Type filter pills */}
              <div className="flex flex-wrap gap-2">
                {(['all', 'Sales', 'Payments', 'Returns', 'Deleted Payments', 'Cancelled Bills'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setHistoryTypeFilter(t); setHistoryPage(1); }}
                    className={cn(
                      'text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all duration-150',
                      historyTypeFilter === t
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm">
              <div className="max-h-[55vh] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/30 z-10 backdrop-blur-sm">
                    <TableRow className="border-b border-border/40 hover:bg-transparent">
                      {['Date', 'Invoice Ref', 'Items', 'Total', 'Paid', 'Returned', 'Remaining', 'Status', 'Type'].map((h) => (
                        <TableHead key={h} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-3">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedAdvancedHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                          <History size={32} className="mx-auto opacity-15 mb-3" />
                          <p className="text-sm font-medium">No records found for selected filters.</p>
                        </TableCell>
                      </TableRow>
                    ) : pagedAdvancedHistory.map((row: any) => (
                      <React.Fragment key={row.id}>
                        <TableRow
                          className={cn(
                            'border-b border-border/20 transition-colors',
                            row.rowKind === 'SALE' ? 'cursor-pointer hover:bg-muted/25' : 'hover:bg-muted/10'
                          )}
                          onClick={() => {
                            if (row.rowKind !== 'SALE') return;
                            setExpandedInvoiceIds((prev) => ({ ...prev, [row.invoiceId]: !prev[row.invoiceId] }));
                          }}
                        >
                          <TableCell className="text-[11px] whitespace-nowrap text-muted-foreground">{new Date(row.date).toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="font-bold text-[12px] whitespace-nowrap">{row.displayRef || '-'}</div>
                            <div className="text-[10px] text-muted-foreground">{row.ref && row.ref !== row.displayRef ? row.ref : row.invoiceId ? `ID #${row.invoiceId}` : 'No linked invoice'}</div>
                          </TableCell>
                          <TableCell className="max-w-[220px]">
                            <div className="truncate text-[12px]">{row.itemsText || row.notes || '-'}</div>
                            {row.itemsCount ? <div className="text-[10px] text-muted-foreground">{row.itemsCount} item{row.itemsCount === 1 ? '' : 's'}</div> : null}
                          </TableCell>
                          <TableCell className="text-[12px] font-semibold">{fmtPKR(row.total || 0)}</TableCell>
                          <TableCell className="text-[12px] font-semibold text-emerald-600">{fmtPKR(row.paid || 0)}</TableCell>
                          <TableCell className="text-[12px] font-semibold text-amber-600">{fmtPKR(row.returned || 0)}</TableCell>
                          <TableCell className="text-[12px] font-semibold">{fmtPKR(Math.max(0, row.remaining || 0))}</TableCell>
                          <TableCell><Badge variant="outline" className={cn('whitespace-nowrap text-[10px]', statusBadgeClass(row.status))}>{row.status}</Badge></TableCell>
                          <TableCell><Badge variant="outline" className={cn('whitespace-nowrap text-[10px]', typeBadgeClass(row.rowKind))}>{row.rowKind.replace('_', ' ')}</Badge></TableCell>
                        </TableRow>
                        {row.rowKind === 'SALE' && expandedInvoiceIds[row.invoiceId] && (
                          <TableRow>
                            <TableCell colSpan={9} className="bg-muted/20 border-b border-border/20">
                              <div className="text-[11px] space-y-1.5 py-1 text-muted-foreground">
                                <div><span className="font-bold text-foreground">Products:</span> {(row.raw.items || []).map((i: any) => `${i.product_name} ×${i.quantity}`).join(', ') || 'No items'}</div>
                                <div><span className="font-bold text-foreground">Payment History:</span> {(row.raw.linkedPayments || []).map((p: any) => `${fmtPKR(p.amount)} (${new Date(p.date_added || p.date_created).toLocaleDateString()})`).join(', ') || 'None'}</div>
                                <div><span className="font-bold text-foreground">Returns:</span> {(row.raw.linkedReturns || []).map((r: any) => `${fmtPKR(r.total_returned)} (${new Date(r.date_created).toLocaleDateString()})`).join(', ') || 'None'}</div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/30 bg-muted/10">
                <span className="text-[11px] text-muted-foreground font-medium">
                  Page {Math.min(historyPage, historyTotalPages)} of {historyTotalPages}
                  <span className="ml-2 text-muted-foreground/60">({filteredAdvancedHistory.length} records)</span>
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}>← Prev</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" disabled={historyPage >= historyTotalPages} onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}>Next →</Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ════════════════ Sale Detail Modal ════════════════ */}
      <AnimatePresence>
        {selectedSale && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setSelectedSale(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="w-full max-w-lg"
              onClick={e => e.stopPropagation()}
            >
              <div className="rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden">
                {/* Gradient top bar */}
                <div className="h-[3px] bg-gradient-to-r from-blue-500 via-violet-500 to-blue-400" />

                {/* Header */}
                <div className="px-6 py-5 border-b border-border/40 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/15">
                        <Receipt size={15} className="text-blue-500" />
                      </div>
                      <h2 className="text-base font-black">Sale #{selectedSale.id}</h2>
                    </div>
                    <div className="flex items-center gap-3 ml-[42px]">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(selectedSale.date_created).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                      {selectedSale.payment_method && (
                        <Badge variant="outline" className="text-[10px] h-5">{selectedSale.payment_method}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold mb-0.5">Grand Total</div>
                    <div className="text-2xl font-black text-rose-500">{fmtPKR(selectedSale.total)}</div>
                  </div>
                </div>

                {/* Content */}
                <div className="max-h-[55vh] overflow-y-auto">
                  {/* Payment history for this sale */}
                  <div className="px-5 py-4 bg-emerald-500/5 border-b border-emerald-500/15">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                      <History size={12} /> Payment Logs
                    </h4>
                    {(selectedSale.linkedPayments || []).length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic">No payments collected for this bill yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(selectedSale.linkedPayments || []).map((pay: any) => (
                          <div key={pay.id} className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-lg border border-border/50 shadow-sm text-xs group hover:border-rose-300 transition-colors">
                            <CheckCircle2 size={12} className="text-emerald-500" />
                            <span className="font-bold">{fmtPKR(pay.amount)}</span>
                            <span className="text-[10px] text-muted-foreground border-l pl-2">{new Date(pay.date_added || pay.date_created).toLocaleDateString()}</span>
                            <button
                              onClick={() => handleDeletePayment(pay.id)}
                              className="ml-1 text-rose-500 hover:scale-110 transition-transform p-0.5"
                              title="Undo Payment"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sale items */}
                  {saleItemsLoading ? (
                    <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
                      <RefreshCw size={18} className="animate-spin" />
                      <span className="text-sm">Loading items...</span>
                    </div>
                  ) : saleItems.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground">
                      <Layers size={32} className="mx-auto opacity-15 mb-3" />
                      <p className="text-sm">No item breakdown found for this sale.</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/20 border-b border-border/30 sticky top-0">
                        <tr>
                          {['Item', 'Qty', 'Unit Price', 'Subtotal'].map((h, i) => (
                            <th key={h} className={cn('py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground', i > 0 && 'text-right')}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {saleItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/25 transition-colors">
                            <td className="py-3 px-4 font-semibold text-[13px]">{item.product_name || item.name || 'Unknown Item'}</td>
                            <td className="py-3 px-4 text-right font-mono text-[13px]">{item.quantity}</td>
                            <td className="py-3 px-4 text-right font-mono text-[13px] text-muted-foreground">{fmtPKR(item.price)}</td>
                            <td className="py-3 px-4 text-right font-black text-[13px] text-blue-600">{fmtPKR(item.price * item.quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-border/40 bg-muted/10">
                        {selectedSale.discount > 0 && (
                          <tr>
                            <td colSpan={3} className="py-2 px-4 text-[12px] text-muted-foreground">Discount</td>
                            <td className="py-2 px-4 text-right text-[12px] text-emerald-600 font-semibold">-{fmtPKR(selectedSale.discount)}</td>
                          </tr>
                        )}
                        <tr>
                          <td colSpan={3} className="py-3 px-4 font-bold text-sm">Grand Total</td>
                          <td className="py-3 px-4 text-right font-black text-lg text-rose-500">{fmtPKR(selectedSale.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-border/40 bg-card flex flex-col gap-2.5">
                  <div className="flex gap-2.5">
                    <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={() => setSelectedSale(null)}>Close</Button>
                    <Button
                      className="flex-1 h-10 rounded-xl gap-2 bg-amber-500 hover:bg-amber-600 shadow-sm shadow-amber-500/20"
                      disabled={selectedSale.status === 'Cancelled'}
                      onClick={() => {
                        const initialQtys: Record<number, string> = {};
                        saleItems.forEach(item => { initialQtys[item.product_id] = ''; });
                        setReturnQuantities(initialQtys);
                        setReturnReason('');
                        setReturnModalOpen(true);
                      }}
                    >
                      <Undo2 size={15} /> Return Items
                    </Button>
                  </div>
                  <div className="flex gap-2.5">
                    <Button
                      variant="secondary"
                      className="flex-1 h-9 rounded-xl gap-2 text-xs"
                      onClick={async () => {
                        window.api.printInvoice(`<div style="font-family:sans-serif;padding:20px;"><h2>Sale #${selectedSale.id}</h2><p>Date: ${new Date(selectedSale.date_created).toLocaleString()}</p><hr/>${saleItems.map(i => `<p>${i.product_name} x${i.quantity}: ${fmtPKR(i.price * i.quantity)}</p>`).join('')}<hr/><h3>Total: ${fmtPKR(selectedSale.total)}</h3></div>`);
                      }}
                    >
                      <Printer size={13} /> Print
                    </Button>
                    <Button
                      className="flex-1 h-9 rounded-xl gap-2 text-xs bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        const msg = `*Sale #${selectedSale.id}*\nTotal: ${fmtPKR(selectedSale.total)}\nItems:\n` + saleItems.map(i => `- ${i.product_name} x${i.quantity}`).join('\n');
                        const phone = selectedCustomer?.phone?.replace(/\D/g, '') || '';
                        window.open(`https://wa.me/${phone.startsWith('0') ? '92' + phone.substring(1) : phone}?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                    >
                      <MessageCircle size={13} /> WhatsApp
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════ Add / Edit Customer Dialog ════════════════ */}
      <AnimatePresence>
        {showDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="w-full max-w-md"
            >
              <div className="rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden">
                <div className="h-[3px] bg-gradient-to-r from-blue-500 via-violet-500 to-blue-400" />
                <form onSubmit={handleSubmit}>
                  <div className="px-6 py-5 border-b border-border/40">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/15">
                        <Users size={16} className="text-blue-500" />
                      </div>
                      <div>
                        <h2 className="text-base font-black">{isEditing ? 'Edit Customer' : 'New Customer'}</h2>
                        <p className="text-xs text-muted-foreground">Enter contact details below.</p>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-5 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        type="text"
                        required
                        value={current.name}
                        onChange={(e) => setCurrent({ ...current, name: e.target.value })}
                        placeholder="e.g. Ahmad Khan"
                        className="h-11 rounded-xl border-border/60 bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Phone Number</label>
                      <Input
                        type="tel"
                        value={current.phone || ''}
                        onChange={(e) => setCurrent({ ...current, phone: e.target.value })}
                        placeholder="0300 1234567"
                        className="h-11 rounded-xl border-border/60 bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Address</label>
                      <Input
                        type="text"
                        value={current.address || ''}
                        onChange={(e) => setCurrent({ ...current, address: e.target.value })}
                        placeholder="Shop 12, Main Bazar"
                        className="h-11 rounded-xl border-border/60 bg-background"
                      />
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-border/40 flex gap-3">
                    <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setShowDialog(false)}>Cancel</Button>
                    <Button type="submit" className="flex-1 h-11 rounded-xl shadow-sm">
                      {isEditing ? 'Save Changes' : 'Create Customer'}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════ Sale Return Modal ════════════════ */}
      <AnimatePresence>
        {returnModalOpen && selectedSale && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
              className="w-full max-w-2xl"
            >
              <div className="rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden">
                {/* Amber accent bar */}
                <div className="h-[3px] bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400" />

                {/* Header */}
                <div className="px-6 py-5 border-b border-border/40 flex items-center justify-between bg-amber-500/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/20">
                      <Undo2 size={16} className="text-amber-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-black">Return Items</h2>
                      <p className="text-xs text-muted-foreground">Sale #{selectedSale.id} · Select quantities to return</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8" onClick={() => setReturnModalOpen(false)}>
                    <X size={16} />
                  </Button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5">
                  <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm">
                    <div className="max-h-[38vh] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-muted/30 backdrop-blur-sm z-10">
                          <TableRow className="border-b border-border/40 hover:bg-transparent">
                            {['Product', 'Sold', 'Prev. Returned', 'Price', 'Qty to Return'].map((h, i) => (
                              <TableHead key={h} className={cn('text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-3', i >= 2 && 'text-right')}>{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {saleItems.map((item) => {
                            const prevReturned = item.quantity_returned || 0;
                            const availableToReturn = Math.max(0, item.quantity - prevReturned);
                            return (
                              <TableRow key={item.product_id} className="border-b border-border/20 hover:bg-muted/25 transition-colors">
                                <TableCell className="font-semibold text-[13px]">{item.product_name || item.name}</TableCell>
                                <TableCell className="text-center font-mono text-[13px]">{item.quantity}</TableCell>
                                <TableCell className="text-right font-bold text-[13px] text-amber-600">{prevReturned}</TableCell>
                                <TableCell className="text-right text-[13px] text-muted-foreground">{fmtPKR(item.price)}</TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="text"
                                    className={cn(
                                      'h-8 text-right font-bold w-20 ml-auto rounded-lg text-[12px]',
                                      availableToReturn === 0 && 'opacity-50 cursor-not-allowed bg-muted',
                                      (parseInt(returnQuantities[item.id] || '0') > availableToReturn) && 'border-rose-500 bg-rose-500/5 text-rose-500'
                                    )}
                                    value={returnQuantities[item.id] || ''}
                                    disabled={availableToReturn <= 0}
                                    onChange={(e) => {
                                      const raw = e.target.value.replace(/[^0-9]/g, '');
                                      setReturnQuantities(prev => ({ ...prev, [item.id]: raw }));
                                    }}
                                    placeholder="0"
                                  />
                                  {availableToReturn > 0 && (
                                    <p className={cn(
                                      'text-[9px] mt-1',
                                      (parseInt(returnQuantities[item.id] || '0') > availableToReturn) ? 'text-rose-500 font-bold' : 'text-muted-foreground'
                                    )}>
                                      Max: {availableToReturn}
                                    </p>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <FileText size={12} /> Reason for Return
                    </label>
                    <Input
                      placeholder="e.g., Defective item, customer changed mind..."
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="h-11 rounded-xl border-border/60 bg-background"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border/40 bg-muted/10 flex gap-3">
                  <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setReturnModalOpen(false)}>Cancel</Button>
                  <Button
                    className="flex-1 h-11 rounded-xl gap-2 bg-amber-500 hover:bg-amber-600 shadow-sm shadow-amber-500/20"
                    onClick={handleReturnSubmit}
                    disabled={isSubmittingReturn}
                  >
                    {isSubmittingReturn ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                    {isSubmittingReturn ? 'Processing...' : 'Confirm Return'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}