import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, Users, Pencil, Trash2, Phone, MessageCircle, DollarSign,
  ArrowRight, History, ShoppingBag, CreditCard, X, Receipt, Eye,
  Calendar, ChevronDown, Layers, Tag, Undo2, Printer, CheckCircle2, Check, FileText, RefreshCw, Download
} from 'lucide-react';
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
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState<'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'custom'>('this_month');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'Settled' | 'Pending' | 'Cancelled' | 'Returned'>('all');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'Sales' | 'Payments' | 'Returns' | 'Deleted Payments' | 'Cancelled Bills'>('all');
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

  useEffect(() => {
    loadCustomers();
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
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
      else addNotification('Error', res.error || 'Failed to clear balance', 'error');
    } catch (err) { console.error(err); }
  };

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
      addNotification('Validation', `You cannot return more than what was sold for: ${invalidItems.map(i => i.product_name).join(', ')}`, 'error');
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

  const exportPDF = async () => {
    if (!customerDetails) {
      addNotification('Error', 'Customer details are still loading.', 'error');
      return;
    }

    try {
      const pdfData = formatCustomerDataForPDF(customerDetails);
      const html = generateCustomerPDFHTML(pdfData);
      const res = await window.api.saveInvoicePdf(html);
      if (res.success) {
        addNotification('PDF Saved', 'Customer statement PDF saved successfully.', 'success');
      } else if (res.error !== 'Cancelled') {
        addNotification('Error', res.error || 'Failed to save customer statement.', 'error');
      }
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Failed to export customer statement.', 'error');
    }
  };

  const sendWhatsApp = (sale?: any) => {
    if (!selectedCustomer?.phone) {
      addNotification('No Phone', "Customer doesn't have a phone number.", 'warning');
      return;
    }

    let number = selectedCustomer.phone.replace(/[^0-9]/g, '');
    if (number.startsWith('0')) number = '92' + number.substring(1);

    const storeName = customerDetails?.settings?.store_name || 'Our Store';
    let msg = '';

    if (sale) {
      const remaining = Math.max(0, Math.round(sale.remaining));
      msg = `*Order Update / آرڈر اپڈیٹ - ${storeName}*\n\n` +
        `Hello / السلام علیکم *${selectedCustomer.name}*,\n` +
        `Order / آرڈر: *#${sale.id}*\n` +
        `--------------------------\n` +
        `• Date / تاریخ: ${new Date(sale.date_created).toLocaleDateString()}\n` +
        `• Bill / کل بل: PKR ${Math.round(sale.total).toLocaleString()}\n` +
        `• Paid / ادا شدہ: PKR ${Math.round(sale.amountPaid).toLocaleString()}\n` +
        `--------------------------\n` +
        `*Balance Due / بقایا رقم: PKR ${remaining.toLocaleString()}*\n\n` +
        `Please acknowledge. Thank you!\n` +
        `شکریہ!`;
    } else {
      const totalTaken = customerDetails?.totalTaken || 0;
      const totalPaid = customerDetails?.totalPaid || 0;
      const totalReturned = customerDetails?.totalReturned || 0;
      const balance = Math.max(0, customerDetails?.balance || 0);

      msg = `*Account Summary / حساب کی تفصیل - ${storeName}*\n\n` +
        `Hello / السلام علیکم *${selectedCustomer.name}*,\n` +
        `Your balance summary / آپ کے حساب کی تفصیل:\n` +
        `--------------------------\n` +
        `• Total Purchases / کل خریداری: PKR ${Math.round(totalTaken).toLocaleString()}\n` +
        `• Total Paid / کل ادائیگی: PKR ${Math.round(totalPaid).toLocaleString()}\n` +
        `• Returns / واپسی: PKR ${Math.round(totalReturned).toLocaleString()}\n` +
        `--------------------------\n` +
        `*Net Balance Due / بقایا رقم: PKR ${Math.round(balance).toLocaleString()}*\n\n` +
        `Please clear your dues. Thank you!\n` +
        `براہ کرم اپنی بقایا رقم جلد ادا کریں۔ شکریہ!`;
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
  const actionHistory = useMemo(() => (customerDetails?.history || []) as any[], [customerDetails]);
  const advancedHistoryRows = useMemo(() => {
    if (!customerDetails) return [];
    const saleRefById = new Map<number, string>(
      (customerDetails.sales || []).map((s: any) => [Number(s.id), formatInvoiceId(s.id, s.date_created)])
    );
    const sales = (customerDetails.sales || []).map((s: any) => ({
      rowKind: 'SALE',
      id: `sale-${s.id}`,
      date: s.date_created,
      invoiceId: s.id,
      displayRef: formatInvoiceId(s.id, s.date_created),
      itemsText: (s.items || []).map((i: any) => i.product_name).join(', '),
      itemsCount: (s.items || []).length,
      total: Number(s.total) || 0,
      paid: Number(s.amountPaid) || 0,
      returned: Number(s.amountReturned) || 0,
      remaining: Math.max(0, Number(s.remaining) || 0),
      status: s.status === 'Cancelled' ? 'Cancelled' : (Number(s.amountReturned) || 0) > 0 ? 'Returned' : Math.max(0, Number(s.remaining) || 0) <= 0.5 ? 'Settled' : 'Pending',
      notes: s.notes || '',
      ref: formatInvoiceId(s.id, s.date_created),
      raw: s
    }));
    const payments = (customerDetails.payments || []).map((p: any) => ({
      rowKind: 'PAYMENT',
      id: `payment-${p.id}`,
      date: p.date_added || p.date_created,
      invoiceId: p.sale_id || null,
      displayRef: p.sale_id ? saleRefById.get(Number(p.sale_id)) || formatInvoiceId(p.sale_id, p.date_added || p.date_created) : `CP-${p.id}`,
      itemsText: '',
      itemsCount: 0,
      total: 0,
      paid: Number(p.amount) || 0,
      returned: 0,
      remaining: 0,
      status: 'Settled',
      notes: p.notes || '',
      ref: `CP-${p.id}`,
      raw: p
    }));
    const returns = (customerDetails.returns || []).map((r: any) => ({
      rowKind: 'RETURN',
      id: `return-${r.id}`,
      date: r.date_created || r.date_returned,
      invoiceId: r.sale_id || null,
      displayRef: r.sale_id ? saleRefById.get(Number(r.sale_id)) || formatInvoiceId(r.sale_id, r.date_created || r.date_returned) : `SR-${r.id}`,
      itemsText: '',
      itemsCount: 0,
      total: 0,
      paid: 0,
      returned: Number(r.total_returned) || 0,
      remaining: 0,
      status: 'Returned',
      notes: r.reason || r.notes || '',
      ref: `SR-${r.id}`,
      raw: r
    }));
    const history = (actionHistory || []).map((h: any) => ({
      rowKind: h.type === 'PAYMENT_DELETED' ? 'DELETED_PAYMENT' : h.type === 'SALE_CANCELLED' ? 'CANCELLED_BILL' : 'HISTORY',
      id: `history-${h.id}`,
      date: h.date,
      invoiceId: h.relatedId || null,
      displayRef: h.relatedId && String(h.relatedType || '').toUpperCase().includes('SALE')
        ? saleRefById.get(Number(h.relatedId)) || formatInvoiceId(h.relatedId, h.date)
        : `${h.relatedType || 'H'}-${h.relatedId || h.id}`,
      itemsText: '',
      itemsCount: 0,
      total: 0,
      paid: h.type?.includes('PAYMENT') ? Number(h.amount) || 0 : 0,
      returned: h.type?.includes('RETURN') ? Number(h.amount) || 0 : 0,
      remaining: 0,
      status: h.status === 'DELETED' ? 'Cancelled' : h.status === 'CANCELLED' ? 'Cancelled' : 'Settled',
      notes: h.notes || h.type || '',
      ref: `${h.relatedType || 'H'}-${h.relatedId || h.id}`,
      raw: h
    }));
    return [...sales, ...payments, ...returns, ...history]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [customerDetails, actionHistory]);

  const filteredAdvancedHistory = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
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
      const pool = [
        row.displayRef || '',
        row.ref,
        row.invoiceId ? String(row.invoiceId) : '',
        row.itemsText || '',
        row.notes || '',
        String(row.total || ''),
        String(row.paid || ''),
        String(row.returned || '')
      ].join(' ').toLowerCase();
      return pool.includes(query);
    });
  }, [advancedHistoryRows, historyDateFilter, historyFrom, historyTo, historyStatusFilter, historyTypeFilter, historyQuery]);

  const summaryStats = useMemo(() => {
    if (!customerDetails) return { totalTaken: 0, totalPaid: 0, totalReturned: 0 };

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - 6);
    const monthsBack = Math.min(12, Math.max(1, Number(summaryMonths) || 1));
    const startOfMonths = new Date(now);
    startOfMonths.setHours(0, 0, 0, 0);
    startOfMonths.setMonth(startOfMonths.getMonth() - monthsBack);

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

    const totalTaken = (customerDetails.sales || [])
      .filter((s: any) => (s.status || '').toLowerCase() !== 'cancelled' && inSummaryRange(s.date_created))
      .reduce((sum: number, s: any) => sum + (Number(s.total) || 0), 0);
    const totalPaid = (customerDetails.payments || [])
      .filter((p: any) => inSummaryRange(p.date_added || p.date_created))
      .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const totalReturned = (customerDetails.returns || [])
      .filter((r: any) => inSummaryRange(r.date_created || r.date_returned))
      .reduce((sum: number, r: any) => sum + (Number(r.total_returned) || 0), 0);

    return { totalTaken, totalPaid, totalReturned };
  }, [customerDetails, summaryDateFilter, summaryMonths, summaryFrom, summaryTo]);

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
    if (type === 'SALE') return 'border-transparent bg-blue-600 text-white shadow-sm hover:bg-blue-600';
    if (type === 'PAYMENT') return 'border-transparent bg-emerald-600 text-white shadow-sm hover:bg-emerald-600';
    if (type === 'RETURN') return 'border-transparent bg-violet-600 text-white shadow-sm hover:bg-violet-600';
    if (type === 'DELETED_PAYMENT' || type === 'CANCELLED_BILL') return 'border-transparent bg-rose-600 text-white shadow-sm hover:bg-rose-600';
    return 'border-transparent bg-slate-600 text-white shadow-sm hover:bg-slate-600';
  };

  return (
    <div className="h-full flex gap-6">
      {/* ─── Customer List ─── */}
      <Card className="flex-1 shadow-lg border-border/50 flex flex-col min-w-0 bg-card overflow-hidden">
        <CardHeader className="border-b bg-muted/10 pb-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <CardTitle className="text-3xl font-black tracking-tight flex items-center gap-2">
                <Users className="text-primary" size={28} /> Customers
              </CardTitle>
              <CardDescription className="text-sm mt-1">Manage customers and payments</CardDescription>
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
              <Button size="sm" className="flex-1 gap-2 bg-green-600 hover:bg-green-700" onClick={() => sendWhatsApp()}><MessageCircle size={16} /> WhatsApp</Button>
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
                  <div className="col-span-2 flex flex-col gap-2 pb-2">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">Summary Filter</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={summaryDateFilter} onValueChange={(v: any) => setSummaryDateFilter(v)}>
                        <SelectTrigger className="h-8 w-[130px] text-xs rounded-md">
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
                          <SelectTrigger className="h-8 w-[160px] text-xs rounded-md">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                              <SelectItem key={m} value={String(m)}>
                                Last {m} {m === 1 ? 'Month' : 'Months'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {summaryDateFilter === 'custom' && (
                        <>
                          <Input type="date" className="h-8 text-xs w-32" value={summaryFrom} onChange={(e) => setSummaryFrom(e.target.value)} />
                          <Input type="date" className="h-8 text-xs w-32" value={summaryTo} onChange={(e) => setSummaryTo(e.target.value)} />
                        </>
                      )}
                      <Badge className={(customerDetails.balance || 0) > 0 ? 'bg-destructive/10 text-destructive border-none' : 'bg-emerald-100 text-emerald-700 border-none'}>
                        {(customerDetails.balance || 0) > 0 ? 'Qaraz (Unpaid)' : 'Settled (Paid)'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Total Purchased</span>
                    <span className="text-lg font-bold">{fmtPKR(summaryStats.totalTaken || 0)}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Amount Paid</span>
                    <span className="text-lg font-bold text-emerald-600">{fmtPKR(summaryStats.totalPaid || 0)}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase text-amber-600">Items Returned (-)</span>
                    <span className="text-lg font-bold text-amber-600">{fmtPKR(summaryStats.totalReturned || 0)}</span>
                  </div>
                  <div className="col-span-2 mt-2 pt-4 border-t border-dashed flex items-center justify-between bg-muted/5 -mx-5 px-5 py-3">
                    <span className="text-sm font-black uppercase text-muted-foreground">Net Balance Owed (Qaraz)</span>
                    {(customerDetails.balance || 0) > 0 ? (
                      <span className="text-2xl font-black text-destructive">
                        {fmtPKR(Math.max(0, customerDetails.balance || 0))}
                      </span>
                    ) : (
                      <span className="text-sm font-black text-emerald-600">PKR 0 - Fully Settled</span>
                    )}
                  </div>
                </div>
                <div className="p-5 border-b bg-muted/10">
                  <Button
                    className="w-full gap-2"
                    onClick={() => setHistoryModalOpen(true)}
                  >
                    <History size={16} />
                    Open Advanced History
                    <Badge variant="secondary" className="ml-auto text-[10px]">{filteredAdvancedHistory.length} records</Badge>
                  </Button>
                </div>

                <div className="p-5 border-b bg-muted/10">
                  <Button
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                    onClick={exportPDF}
                  >
                    <Download size={16} />
                    Export Statement as PDF
                  </Button>
                </div>


                {/* Combined Transaction History */}
                <div className="p-5">
                  <Tabs defaultValue="tx-history">
                    <TabsList className="w-full grid grid-cols-2 mb-4">
                      <TabsTrigger value="activity-log">History</TabsTrigger>
                      <TabsTrigger value="tx-history">Transaction History</TabsTrigger>
                    </TabsList>
                    <TabsContent value="activity-log">
                      <h4 className="text-sm font-bold mb-4 flex items-center gap-2 text-primary">
                        <History size={16} /> History
                        <Badge variant="secondary" className="ml-auto text-[10px]">{actionHistory.length} entries</Badge>
                      </h4>
                      {actionHistory.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-xl">No history available yet.</div>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {actionHistory.map((h: any) => (
                            <div key={`ch-${h.id}`} className="rounded-lg border bg-card p-2.5 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold">{h.type}</span>
                                <span className="text-muted-foreground">{new Date(h.date).toLocaleString()}</span>
                              </div>
                              <div className="mt-1 text-muted-foreground">
                                Amount: {fmtPKR(h.amount || 0)} | Related: {h.relatedType || '-'} #{h.relatedId || '-'} | Status: {h.status || 'COMPLETED'}
                              </div>
                              {h.notes ? <div className="mt-1">{h.notes}</div> : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="tx-history">
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
                                <div key={`pay-${item.id}-${idx}`} className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 p-3 rounded-xl flex justify-between items-center group">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
                                      <CheckCircle2 size={14} />
                                    </div>
                                    <div>
                                      <p className="text-xs font-black uppercase text-black dark:text-emerald-300" style={{ color: '#000' }}>Payment Collected</p>
                                      <p className="text-[10px] text-black/70 dark:text-emerald-300/70" style={{ color: '#000' }}>{new Date(item.date).toLocaleString()}</p>
                                    </div>
                                  </div>
                                  <div className="text-right flex items-center gap-3">
                                    <span className="text-sm font-black text-black dark:text-emerald-300" style={{ color: '#000' }}>{fmtPKR(item.amount)}</span>
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
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-[min(1180px,96vw)] max-h-[92vh] overflow-hidden p-0 gap-0">
          <DialogHeader className="border-b px-5 py-4 pr-12">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <History size={18} className="text-primary" /> Advanced History
            </DialogTitle>
            <DialogDescription>
              Search by invoice number, filter records, and expand sale rows for products, payments, and returns.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 overflow-y-auto">
              <div className="space-y-3">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_220px] gap-2">
                    <Input value={historyQuery} onChange={(e) => { setHistoryQuery(e.target.value); setHistoryPage(1); }} placeholder="Search invoice #, product, notes, amount, reference..." />
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {(['all', 'Sales', 'Payments', 'Returns', 'Deleted Payments', 'Cancelled Bills'] as const).map((t) => (
                      <Button key={t} variant={historyTypeFilter === t ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => { setHistoryTypeFilter(t); setHistoryPage(1); }}>
                        {t}
                      </Button>
                    ))}
                  </div>

                  <div className="border rounded-xl overflow-hidden">
                    <div className="max-h-[60vh] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Invoice Ref</TableHead>
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
                            <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No records found for selected filters.</TableCell></TableRow>
                          ) : pagedAdvancedHistory.map((row: any) => (
                            <React.Fragment key={row.id}>
                              <TableRow className={row.rowKind === 'SALE' ? 'cursor-pointer hover:bg-muted/40' : ''} onClick={() => {
                                if (row.rowKind !== 'SALE') return;
                                setExpandedInvoiceIds((prev) => ({ ...prev, [row.invoiceId]: !prev[row.invoiceId] }));
                              }}>
                                <TableCell className="text-xs whitespace-nowrap">{new Date(row.date).toLocaleString()}</TableCell>
                                <TableCell>
                                  <div className="font-semibold whitespace-nowrap">{row.displayRef || '-'}</div>
                                  <div className="text-[11px] text-muted-foreground">{row.ref && row.ref !== row.displayRef ? row.ref : row.invoiceId ? `ID #${row.invoiceId}` : 'No linked invoice'}</div>
                                </TableCell>
                                <TableCell className="max-w-[260px]">
                                  <div className="truncate">{row.itemsText || row.notes || '-'}</div>
                                  {row.itemsCount ? <div className="text-[11px] text-muted-foreground">{row.itemsCount} item{row.itemsCount === 1 ? '' : 's'}</div> : null}
                                </TableCell>
                                <TableCell className="text-right">{fmtPKR(row.total || 0)}</TableCell>
                                <TableCell className="text-right text-emerald-700">{fmtPKR(row.paid || 0)}</TableCell>
                                <TableCell className="text-right text-amber-700">{fmtPKR(row.returned || 0)}</TableCell>
                                <TableCell className="text-right">{fmtPKR(Math.max(0, row.remaining || 0))}</TableCell>
                                <TableCell><Badge variant="outline" className={cn('whitespace-nowrap', statusBadgeClass(row.status))}>{row.status}</Badge></TableCell>
                                <TableCell><Badge variant="outline" className={cn('whitespace-nowrap', typeBadgeClass(row.rowKind))}>{row.rowKind.replace('_', ' ')}</Badge></TableCell>
                              </TableRow>
                              {row.rowKind === 'SALE' && expandedInvoiceIds[row.invoiceId] && (
                                <TableRow>
                                  <TableCell colSpan={9} className="bg-muted/20">
                                    <div className="text-xs space-y-1">
                                      <div><span className="font-bold">Products:</span> {(row.raw.items || []).map((i: any) => `${i.product_name} x${i.quantity}`).join(', ') || 'No items'}</div>
                                      <div><span className="font-bold">Payment History:</span> {(row.raw.linkedPayments || []).map((p: any) => `${fmtPKR(p.amount)} (${new Date(p.date_added || p.date_created).toLocaleDateString()})`).join(', ') || 'None'}</div>
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
                    <div className="flex items-center justify-between p-2 border-t bg-muted/5">
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
                                "h-8 text-right font-bold",
                                availableToReturn === 0 && "opacity-50 cursor-not-allowed bg-muted",
                                (parseInt(returnQuantities[item.id] || '0') > availableToReturn) && "border-destructive bg-destructive/5 text-destructive"
                              )}
                              value={returnQuantities[item.id] || ''}
                              disabled={availableToReturn <= 0}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9]/g, '');
                                setReturnQuantities(prev => ({
                                  ...prev,
                                  [item.id]: raw
                                }));
                              }}
                              placeholder="0"
                            />
                            {availableToReturn > 0 && (
                              <p className={cn(
                                "text-[10px] mt-1",
                                (parseInt(returnQuantities[item.id] || '0') > availableToReturn) ? "text-destructive font-bold" : "text-muted-foreground"
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
