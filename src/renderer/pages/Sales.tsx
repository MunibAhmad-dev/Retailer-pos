import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus, Minus, Search, ShoppingCart as CartIcon, X,
  CreditCard, Printer, RefreshCw, PenLine, CheckCircle, Loader2, AlertTriangle, Package, Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { cn } from '../lib/utils';
import { useNotifications } from '../components/NotificationProvider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useLocation } from 'react-router-dom';
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton } from '../components/Pagination';
import AnimatedList from '../components/AnimatedList';

interface CartItem {
  id: string;
  product_id: number | null;
  name: string;
  price: number;
  quantity: number;
  is_custom: boolean;
  stock?: number;
  metadata?: any;
  product_type?: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  stock?: number;
  unit?: string;
  metadata?: any;
  product_type?: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
}

interface Settings {
  store_name: string; store_phone: string; store_address: string;
  receipt_footer: string; store_logo: string;
  invoice_style?: string; // 'thermal' | 'formal'
  invoice_notes?: string;
}

interface ReceiptData {
  saleId: number | bigint;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  settings: Settings;
  date: string;
  customerPhone?: string;
}

import RegisterManager from '../components/RegisterManager';

const fmtPKR = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-PK');

function ReceiptModal({ data, onPrint, onSavePdf, onClose }: {
  data: ReceiptData;
  onPrint: () => void;
  onSavePdf: () => void;
  onClose: () => void;
}) {
  const [isPrinting, setIsPrinting] = useState(false);
  const { addNotification } = useNotifications();

  const handlePrint = async () => {
    setIsPrinting(true);
    await onPrint();
    setIsPrinting(false);
    addNotification("Printed successfully", "The receipt was queued to the printer.", "success");
  };

  const handleSavePdf = async () => {
    await onSavePdf();
    addNotification("Saved PDF successfully", "The receipt was saved as a PDF file.", "success");
  };

  const handleWhatsApp = () => {
    if (!data.customerPhone) return;
    let msg = `*Receipt #${data.saleId}*\n*${data.settings.store_name}*\n\n`;
    data.items.forEach(i => {
      msg += `${i.name} (x${i.quantity}): ${fmtPKR(i.price * i.quantity)}\n`;
    });
    if (data.discount > 0) msg += `\nDiscount: -${fmtPKR(data.discount)}`;
    msg += `\n*Total: ${fmtPKR(data.total)}*`;

    // Format phone number (remove non-digits, ensure country code)
    let phone = data.customerPhone.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '92' + phone.substring(1);

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-sm flex flex-col max-h-[90vh] shadow-2xl animate-in zoom-in-95 duration-200">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-2">
            <CheckCircle size={20} className="text-green-500" />
            <CardTitle className="text-lg">Sale Complete!</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 -mr-2">
            <X size={18} />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-6 bg-muted/10">
          <div className="bg-background border border-dashed border-border rounded-xl p-5 font-mono text-xs text-foreground shadow-sm">
            {data.settings.store_logo && (
              <img src={data.settings.store_logo} alt="Logo" className="h-10 mx-auto mb-2 object-contain" />
            )}
            <p className="text-center font-bold text-sm mb-0.5">{data.settings.store_name}</p>
            {data.settings.store_address && (
              <p className="text-center text-muted-foreground leading-tight">{data.settings.store_address}</p>
            )}
            {data.settings.store_phone && (
              <p className="text-center text-muted-foreground">Tel: {data.settings.store_phone}</p>
            )}

            <div className="border-b border-dashed border-border my-3" />

            <p className="text-center text-muted-foreground">Receipt #{String(data.saleId)}</p>
            <p className="text-center text-muted-foreground/70 text-[10px]">{data.date}</p>

            <div className="border-b border-dashed border-border my-3" />

            <div className="space-y-1.5">
              {data.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span className="flex-1 mr-2 truncate">
                    {item.name}
                    {item.is_custom && <span className="text-purple-500 ml-1">(custom)</span>}
                    {' '}x{item.quantity}
                  </span>
                  <span className="font-semibold flex-shrink-0">{fmtPKR(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="border-b border-dashed border-border my-3" />

            <div className="flex justify-between text-muted-foreground text-[10px] mt-1">
              <span>Subtotal</span>
              <span>{fmtPKR(data.subtotal)}</span>
            </div>
            {data.discount > 0 && (
              <div className="flex justify-between text-destructive text-[10px] mt-0.5">
                <span>Discount</span>
                <span>-{fmtPKR(data.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm mt-1">
              <span>Total</span>
              <span>{fmtPKR(data.total)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground text-[10px] mt-1">
              <span>Payment</span>
              <span className="uppercase">{data.paymentMethod === 'online' ? 'Online Payment' : data.paymentMethod}</span>
            </div>

            {data.settings.receipt_footer && (
              <>
                <div className="border-b border-dashed border-border my-3" />
                <p className="text-center text-muted-foreground">{data.settings.receipt_footer}</p>
              </>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-4 border-t">
          <div className="flex w-full gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Close</Button>
            <Button onClick={handlePrint} disabled={isPrinting} className="flex-1 gap-2 shadow-md">
              {isPrinting ? <RefreshCw size={15} className="animate-spin" /> : <Printer size={15} />}
              {isPrinting ? 'Printing...' : 'Print '}
            </Button>
          </div>
          <div className="flex gap-3 w-full">
            <Button variant="secondary" onClick={handleSavePdf} disabled={isPrinting} className="flex-1 gap-2 text-xs">
              Save as PDF
            </Button>
            {data.customerPhone && (
              <Button onClick={handleWhatsApp} className="flex-1 gap-2 text-xs bg-green-600 hover:bg-green-700 text-white border-transparent">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="css-i6dzq1"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                WhatsApp
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function Sales() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [customerSearch, setCustomerSearch] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [amountPaid, setAmountPaid] = useState<string>('');

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [currentRegister, setCurrentRegister] = useState<any>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const [settings, setSettings] = useState<Settings>({
    store_name: 'My Restaurant', store_phone: '', store_address: '', receipt_footer: 'Thank you!', store_logo: ''
  });

  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const customNameRef = useRef<HTMLInputElement>(null);

  const { addNotification } = useNotifications();
  const location = useLocation();

  useEffect(() => {
    loadProducts();
    loadCustomers();
    loadSettings();
    checkRegister();
  }, []);

  const checkRegister = async () => {
    try {
      const res = await window.api.getCurrentRegister();
      if (res.success) {
        setCurrentRegister(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await window.api.getCustomers();
      if (res?.success) {
        setCustomers(res.data);
        const params = new URLSearchParams(location.search);
        const cid = params.get('customer_id');
        if (cid) {
          setSelectedCustomerId(Number(cid));
        } else {
          // Default to Walk-in customer
          const walkin = res.data.find((c: any) => c.name.toLowerCase().includes('walk-in'));
          if (walkin) {
            setSelectedCustomerId(walkin.id);
            setCustomerSearch(walkin.name);
          }
        }
      }
    } catch { }
  };

  useEffect(() => {
    if (showCustom) {
      setCustomName('');
      setCustomPrice('');
      setCustomQty('1');
      setTimeout(() => customNameRef.current?.focus(), 100);
    }
  }, [showCustom]);

  const loadProducts = async () => {
    try { const res = await window.api.getProducts(); setProducts((res?.success && res.data) ? res.data as any : []); } catch { }
  };
  const loadSettings = async () => {
    try { const res = await window.api.getSettings(); if (res?.success && res.data) setSettings(res.data); } catch { }
  };

  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (v: string) => {
    setIsSearching(true);
    setSearchTerm(v);
    setTimeout(() => setIsSearching(false), 250);
  };

  const filteredProducts = useMemo(() => products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode || '').toLowerCase().includes(searchTerm.toLowerCase())
  ), [products, searchTerm]);

  const filteredCustomers = useMemo(() => customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone || '').toLowerCase().includes(customerSearch.toLowerCase())
  ), [customers, customerSearch]);

  const { visible: visibleProducts, hasMore, loadMore, total: prodTotal, showing: prodShowing } = usePagination(filteredProducts, 10, 1);

  const addProductToCart = (product: Product) => {
    const key = String(product.id);
    const existing = cart.find((i) => i.id === key);
    if (existing) {
      if (product.stock !== undefined && existing.quantity + 1 > product.stock) {
        addNotification("Stock Limit", `Only ${product.stock} units available.`, "warning");
        return;
      }
      setCart(cart.map((i) => i.id === key ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      if (product.stock !== undefined && product.stock <= 0) {
        addNotification("Out of Stock", `${product.name} is out of stock.`, "error");
        return;
      }
      setCart([...cart, {
        id: key,
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        is_custom: false,
        stock: product.stock,
        metadata: product.metadata,
        product_type: product.product_type
      }]);
    }
  };

  const addCustomToCart = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(customPrice);
    const qty = parseInt(customQty) || 1;
    if (!customName.trim() || isNaN(price) || price <= 0) return;
    const key = `custom-${Date.now()}`;
    setCart([...cart, { id: key, product_id: null, name: customName.trim(), price, quantity: qty, is_custom: true }]);
    setShowCustom(false);
  };

  const updateQty = (id: string, rawValue: string) => {
    const qty = parseInt(rawValue.replace(/[^0-9]/g, '')) || 0;
    const item = cart.find(i => i.id === id);
    if (item && item.stock !== undefined && qty > item.stock) {
      addNotification("Stock Limit", `Only ${item.stock} units available.`, "warning");
      setCart(cart.map((i) => i.id === id ? { ...i, quantity: item.stock } : i));
      return;
    }
    setCart(cart.map((i) => i.id === id ? { ...i, quantity: qty } : i));
  };

  const updatePrice = (id: string, rawValue: string) => {
    const val = rawValue.replace(/[^0-9.]/g, '');
    const price = parseFloat(val) || 0;
    setCart(cart.map((i) => i.id === id ? { ...i, price } : i));
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountAmount = discountType === 'percentage'
    ? (subtotal * (parseFloat(discountValue) || 0)) / 100
    : (parseFloat(discountValue) || 0);
  const total = Math.max(0, subtotal - discountAmount);

  const buildReceiptHtml = (data: ReceiptData) => {
    const itemsHtml = data.items.map((item) =>
      `<div class="item"><span>${item.name} x${item.quantity}</span><span>${fmtPKR(item.price * item.quantity)}</span></div>`
    ).join('');
    return `
      ${data.settings.store_logo ? `<img src="${data.settings.store_logo}" style="max-height:48px;display:block;margin:0 auto 4px"/>` : ''}
      <h2>${data.settings.store_name}</h2>
      ${data.settings.store_address ? `<p class="center">${data.settings.store_address}</p>` : ''}
      ${data.settings.store_phone ? `<p class="center">Tel: ${data.settings.store_phone}</p>` : ''}
      <div class="divider"></div>
      <p class="center" style="font-weight:bold;font-size:12px;">Receipt #${data.saleId}</p>
      <p class="center" style="font-size:10px;margin-top:2px;color:#555;">${data.date}</p>
      <div class="divider"></div>
      ${itemsHtml}
      <div class="divider"></div>
      <div class="total-row" style="font-weight:normal;font-size:11px"><span>Subtotal</span><span>${fmtPKR(data.subtotal)}</span></div>
      ${Number(data.discount) > 0 ? `<div class="total-row" style="font-weight:normal;font-size:11px;color:red"><span>Discount</span><span>-${fmtPKR(Number(data.discount))}</span></div>` : ''}
      <div class="total-row"><span>Total</span><span>${fmtPKR(data.total)}</span></div>
      <div class="total-row" style="font-weight:normal;font-size:10px;margin-top:2px"><span>Payment</span><span>${data.paymentMethod === 'online' ? 'ONLINE PAYMENT' : data.paymentMethod.toUpperCase()}</span></div>
      
      <div class="divider"></div>
      <div style="text-align: center; margin-top: 6px;">
        <div style="font-size: 11px; font-weight: bold;">${data.settings.receipt_footer}</div>
        <div style="font-size: 9px; margin-top: 6px; color: #555;">Software made by +923298748232</div>
      </div>
    `;
  };

  const buildFormalInvoiceHtml = (data: ReceiptData) => {
    const fmt = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-PK');
    const pkrNum = (n: number) => Math.round(n).toLocaleString('en-PK');

    const rowsHtml = data.items.map((item, idx) => `
      <tr class="item-row">
        <td class="center">${idx + 1}</td>
        <td>${item.name}</td>
        <td class="center warranty-cell">—</td>
        <td class="center">${item.quantity}</td>
        <td class="right">PKR ${pkrNum(item.price)}</td>
        <td class="right amount-col">PKR ${pkrNum(item.price * item.quantity)}</td>
      </tr>
    `).join('');

    const emptyCount = Math.max(0, 10 - data.items.length);
    const emptyRowsHtml = Array(emptyCount).fill(`
      <tr class="item-row empty-row">
        <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td>
      </tr>
    `).join('');

    const notesLines = (data.settings.invoice_notes || data.settings.receipt_footer || '')
      .split('\n').filter(Boolean)
      .map(l => `<div class="note-line">${l.replace(/^[•\-]\s*/, '')}</div>`).join('');

    const logoHtml = data.settings.store_logo
      ? `<img src="${data.settings.store_logo}" class="logo" alt="logo"/>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Invoice #${String(data.saleId).padStart(4, '0')}</title>
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
        <div class="store-name">${data.settings.store_name || 'Store Name'}</div>
        <div class="store-sub">
          ${data.settings.store_address ? `${data.settings.store_address}<br/>` : ''}
          ${data.settings.store_phone ? `Tel: ${data.settings.store_phone}` : ''}
        </div>
      </div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">INVOICE</div>
      <div class="meta-row"><span>No:</span> #${String(data.saleId).padStart(4, '0')}</div>
      <div class="meta-row"><span>Date:</span> ${data.date}</div>
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
        <tr><td class="label">AMOUNT</td><td class="value">PKR ${pkrNum(data.subtotal)}</td></tr>
        <tr class="discount-row"><td class="label">DISCOUNT</td><td class="value">${Number(data.discount) > 0 ? '- PKR ' + pkrNum(Number(data.discount)) : '—'}</td></tr>
        <tr class="grand-row"><td class="label">GRAND TOTAL</td><td class="value">PKR ${pkrNum(data.total)}</td></tr>
        <tr><td class="label">PAID</td><td class="value">PKR ${pkrNum(data.total)}</td></tr>
        <tr><td class="label">BALANCE</td><td class="value">PKR 0</td></tr>
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
      ${data.settings.store_name || ''}<br/>
      ${data.settings.store_address ? data.settings.store_address + '<br/>' : ''}
      ${data.settings.store_phone ? 'Tel: ' + data.settings.store_phone : ''}
    </div>
  </div>
</div>
</body>
</html>`;
  };

  const buildInvoiceHtml = (data: ReceiptData) => {
    if (data.settings.invoice_style === 'formal') {
      return buildFormalInvoiceHtml(data);
    }
    return buildReceiptHtml(data);
  };
  const CATEGORY_COLORS: Record<string, { bg: string, border: string, badge: string }> = {
    'chicken': { bg: 'from-orange-600 to-amber-500', border: 'border-orange-700', badge: 'bg-white/20 text-orange-100' },
    'bottle': { bg: 'from-green-600 to-emerald-500', border: 'border-green-700', badge: 'bg-white/20 text-green-100' },
    'rice': { bg: 'from-yellow-700 to-amber-600', border: 'border-yellow-800', badge: 'bg-white/20 text-yellow-100' },
    'chawal': { bg: 'from-yellow-700 to-amber-600', border: 'border-yellow-800', badge: 'bg-white/20 text-yellow-100' },
    'chargha': { bg: 'from-red-700 to-rose-600', border: 'border-red-800', badge: 'bg-white/20 text-red-100' },
    'channy': { bg: 'from-amber-800 to-orange-700', border: 'border-amber-900', badge: 'bg-white/20 text-amber-100' },
    'glass': { bg: 'from-cyan-600 to-sky-500', border: 'border-cyan-700', badge: 'bg-white/20 text-cyan-100' },
    'drinks': { bg: 'from-blue-600 to-indigo-500', border: 'border-blue-700', badge: 'bg-white/20 text-blue-100' },
  };

  const CARD_COLORS = [
    { bg: 'from-violet-600 to-purple-500', border: 'border-violet-700', badge: 'bg-white/20 text-purple-100' },
    { bg: 'from-teal-600 to-teal-400', border: 'border-teal-700', badge: 'bg-white/20 text-teal-100' },
    { bg: 'from-pink-600 to-pink-400', border: 'border-pink-700', badge: 'bg-white/20 text-pink-100' },
    { bg: 'from-blue-700 to-blue-500', border: 'border-blue-800', badge: 'bg-white/20 text-blue-100' },
    { bg: 'from-emerald-600 to-emerald-400', border: 'border-emerald-700', badge: 'bg-white/20 text-emerald-100' },
  ];

  const colorForProduct = (product: Product) => {
    const category = product.category?.toLowerCase().trim();
    if (category && CATEGORY_COLORS[category]) {
      return CATEGORY_COLORS[category];
    }
    return CARD_COLORS[product.id % CARD_COLORS.length];
  };

  const handleAddCustomerInline = async () => {
    if (!newCustomerName.trim()) {
      addNotification("Error", "Customer name is required", "error");
      return;
    }
    try {
      setIsProcessing(true);
      const res = await window.api.addCustomer({ name: newCustomerName, phone: newCustomerPhone });
      if (res.success) {
        await loadCustomers();
        setSelectedCustomerId(res.data.id);
        setShowAddCustomer(false);
        setNewCustomerName('');
        setNewCustomerPhone('');
        addNotification("Success", "Customer added successfully", "success");
      } else {
        addNotification("Error", res.error || "Failed to add customer", "error");
      }
    } catch (e: any) {
      addNotification("Error", "Network or database error", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const processPayment = async () => {
    if (cart.length === 0 || isProcessing) return;

    setIsProcessing(true);

    const amtPaid = amountPaid === "" ? (selectedCustomerId ? 0 : total) : parseFloat(amountPaid);
    let paymentStatus = 'Paid';
    if (!isNaN(amtPaid) && amtPaid < total) {
      paymentStatus = 'Partial';
    }
    if (!isNaN(amtPaid) && amtPaid <= 0 && total > 0) {
      paymentStatus = 'Pending';
    }

    try {
      const result = await window.api.createSale({
        customer_id: selectedCustomerId ? Number(selectedCustomerId) : undefined,
        subtotal,
        discount: discountAmount,
        total,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        amount_paid: isNaN(amtPaid) ? (selectedCustomerId ? 0 : total) : amtPaid,
        register_id: currentRegister?.id || null,
        items: cart.map((c) => ({
          product_id: c.product_id || undefined,
          product_name: c.name || 'Unknown Item',
          quantity: c.quantity,
          price: c.price,
          is_custom: c.is_custom,
        })),
      });
      if (result.success) {
        addNotification("Sale Processed", `Transaction completed via ${paymentMethod} payment.`, "success");
        const cust = customers.find(c => c.id === Number(selectedCustomerId));
        setReceiptData({
          saleId: result.data?.saleId || Date.now(),
          items: [...cart],
          subtotal,
          discount: discountAmount,
          total,
          paymentMethod,
          settings: { ...settings },
          date: new Date().toLocaleString('en-PK', { timeZoneName: 'short' }),
          customerPhone: cust?.phone
        });
        loadProducts();
        setDiscountValue('');
        setAmountPaid('');
        setSelectedCustomerId('');

        setTimeout(() => {
          setShowCheckoutModal(false);
          setIsProcessing(false);
        }, 800);
      } else {
        addNotification("Transaction Failed", result.error || "A processing error occurred.", "error");
        setIsProcessing(false);
      }
    } catch {
      addNotification("Error", "Critical error processing sale.", "error");
      setIsProcessing(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!receiptData) return;
    // Always fetch fresh settings so invoice_style changes are reflected immediately
    let freshSettings = receiptData.settings;
    try {
      const res = await window.api.getSettings();
      if (res?.success && res.data) freshSettings = res.data;
    } catch { }
    await window.api.printInvoice(buildInvoiceHtml({ ...receiptData, settings: freshSettings }));
  };

  const handleSavePdf = async () => {
    if (!receiptData) return;
    // Always fetch fresh settings so invoice_style changes are reflected immediately
    let freshSettings = receiptData.settings;
    try {
      const res = await window.api.getSettings();
      if (res?.success && res.data) freshSettings = res.data;
    } catch { }
    await window.api.saveInvoicePdf(buildInvoiceHtml({ ...receiptData, settings: freshSettings }));
  };

  const handleCloseReceipt = () => {
    setReceiptData(null);
    setCart([]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in">
      <header className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CreditCard className="text-primary" size={28} /> Point of Sale
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Select products to ring up a new order</p>
        </div>
        <Button onClick={() => setShowCustom(true)} variant="secondary" className="gap-2 shadow-sm font-semibold">
          <PenLine size={16} /> Custom Sale
        </Button>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        <Card className="flex-1 flex flex-col overflow-hidden max-h-full border-border/50 bg-card/50 min-w-0 min-h-0">
          <CardHeader className="p-4 border-b bg-muted/20 pb-4 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
              <Input
                type="text"
                placeholder="Search by name, category or barcode..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-9 pr-9 h-11 text-base bg-background shadow-sm"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 size={15} className="animate-spin text-primary opacity-70" />
                </div>
              )}
            </div>
          </CardHeader>
          <div className="bg-muted/10 border-b p-2 overflow-x-auto no-scrollbar flex items-center gap-2">
            <Button
              size="sm"
              variant={searchTerm === '' ? "default" : "ghost"}
              onClick={() => handleSearch('')}
              className="h-8 rounded-full text-xs"
            >
              All Items
            </Button>
            {Array.from(new Set(products.map(p => p.category).filter(Boolean))).map(cat => (
              <Button
                key={cat}
                size="sm"
                variant={searchTerm.toLowerCase() === cat.toLowerCase() ? "default" : "ghost"}
                onClick={() => handleSearch(cat)}
                className="h-8 rounded-full text-xs whitespace-nowrap"
              >
                {cat}
              </Button>
            ))}
          </div>
          <CardContent className="flex-1 p-0 flex flex-col min-h-0">
            <div className="bg-muted/30 border-b px-4 py-2 flex text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
              <span className="flex-1">Product Details</span>
              <span className="w-24 text-center">Category</span>
              <span className="w-20 text-center">Stock</span>
              <span className="w-24 text-right">Price</span>
              <span className="w-10"></span>
            </div>

            <AnimatedList
              items={visibleProducts}
              className="flex-1"
              maxHeight="none"
              renderItem={(product: any) => {
                const isOutOfStock = (product.stock ?? 999) <= 0;
                const lowStock = !isOutOfStock && (product.stock ?? 999) < 10;

                return (
                  <div
                    className={cn(
                      "flex items-center p-3 rounded-xl border border-border/40 bg-card hover:border-primary/30 hover:shadow-md transition-all h-20",
                      isOutOfStock && "opacity-60 bg-muted/20 grayscale"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col">
                        <span className="font-black text-sm text-foreground truncate group-hover:text-primary transition-colors">
                          {product.name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1 overflow-hidden">
                          {product.barcode && (
                            <span className="text-[9px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded border border-border/50 shrink-0">
                              {product.barcode}
                            </span>
                          )}
                          {product.unit && (
                            <span className="text-[9px] text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded font-bold border border-primary/10 shrink-0">
                              {product.unit}
                            </span>
                          )}
                          {(() => {
                            const specEntries = product.metadata ? Object.entries(product.metadata).filter(([k, v]) => k !== 'tags' && v).map(([k, v]) => `${k.replace('_', ' ')}: ${v}`) : [];
                            const specTags = product.metadata?.tags && Array.isArray(product.metadata.tags) ? product.metadata.tags : [];
                            const specStr = [...specEntries, ...specTags].join(' • ');
                            if (!specStr) return null;
                            return (
                              <span className="text-[9px] text-muted-foreground truncate capitalize" title={specStr}>
                                {specStr}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="w-24 px-2 flex justify-center">
                      <Badge variant="secondary" className="text-[9px] h-5 font-bold px-2 rounded-lg bg-slate-100 text-slate-600 border-none">
                        {product.category || 'General'}
                      </Badge>
                    </div>

                    <div className="w-20 flex justify-center">
                      <div className={cn(
                        "inline-flex flex-col items-center justify-center min-w-[50px] p-1.5 rounded-xl border-2 shadow-sm",
                        isOutOfStock ? "bg-red-50 text-red-600 border-red-100" :
                          lowStock ? "bg-amber-50 text-amber-600 border-amber-100 animate-pulse" :
                            "bg-emerald-50 text-emerald-600 border-emerald-100"
                      )}>
                        <span className="text-[11px] font-black leading-none">
                          {isOutOfStock ? 'OUT' : product.stock}
                        </span>
                        <span className="text-[8px] uppercase font-bold tracking-tighter mt-1 opacity-70 leading-none">
                          Units
                        </span>
                      </div>
                    </div>

                    <div className="w-24 text-right px-2 font-black text-sm text-slate-800">
                      {fmtPKR(product.price)}
                    </div>

                    <div className="w-10 flex justify-end">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center bg-primary text-white shadow-lg shadow-primary/20">
                        <Plus size={16} />
                      </div>
                    </div>
                  </div>
                );
              }}
              onItemSelect={(product) => {
                const isOutOfStock = (product.stock ?? 999) <= 0;
                if (!isOutOfStock) addProductToCart(product);
                else addNotification("Out of Stock", "This item is currently unavailable.", "error");
              }}
            />

            {visibleProducts.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
                <Package size={48} className="opacity-10 mb-4" />
                <p className="text-sm font-medium">No products found</p>
                <p className="text-xs">Try adjusting your search or category filter</p>
              </div>
            )}

            <div className="p-4 bg-muted/10 border-t flex items-center justify-between">
              <div className="text-xs text-muted-foreground font-medium">
                Showing <span className="text-foreground font-bold">{prodShowing}</span> of <span className="text-foreground font-bold">{prodTotal}</span> products
              </div>
              {hasMore && (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadMore();
                  }}
                  className="gap-2 shadow-[0_4px_14px_0_rgba(0,118,255,0.39)] hover:shadow-[0_6px_20px_rgba(0,118,255,0.23)] hover:bg-[#0070f3] transition-all px-8 font-black bg-[#0070f3] text-white border-none h-10"
                >
                  <RefreshCw size={16} className="animate-spin-slow" />
                  LOAD 10 MORE PRODUCTS
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col lg:w-[380px] min-w-[340px] shrink-0 border-border/60 shadow-lg bg-card max-h-full overflow-hidden">
          <CardHeader className="p-4 py-3 border-b bg-muted/30 flex-row flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative">
                <CartIcon size={20} className="text-foreground" />
                {cart.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold shadow-sm ring-1 ring-background animate-in zoom-in duration-300">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </div>
              <CardTitle className="text-base font-bold tracking-tight">Current Order</CardTitle>
            </div>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setCart([])} className="h-6 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 px-2">Clear All</Button>
            )}
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 content-start space-y-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center py-12">
                <CartIcon size={48} className="opacity-10 mb-4" />
                <p className="text-sm">Your cart is empty.</p>
                <p className="text-xs opacity-70 mt-1">Tap a product to begin.</p>
              </div>
            ) : cart.map((item) => (
              <div key={item.id} className={cn(
                "flex items-center gap-3 p-3 rounded-xl border bg-card transition-all group",
                item.is_custom ? "border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-900/10" : ""
              )}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-sm font-semibold truncate leading-tight">{item.name}</p>
                    {item.is_custom && <Badge variant="secondary" className="text-[9px] px-1 h-4 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">Custom</Badge>}
                  </div>
                  {(() => {
                    const specEntries = item.metadata ? Object.entries(item.metadata).filter(([k, v]) => k !== 'tags' && v).map(([k, v]) => `${k.replace('_', ' ')}: ${v}`) : [];
                    const specTags = item.metadata?.tags && Array.isArray(item.metadata.tags) ? item.metadata.tags : [];
                    const specStr = [...specEntries, ...specTags].join(' • ');
                    if (!specStr) return null;
                    return (
                      <div className="text-[9px] text-muted-foreground truncate mb-1 capitalize" title={specStr}>
                        {specStr}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center bg-background border rounded-lg overflow-hidden shadow-sm">
                    <button type="button" onClick={() => updateQty(item.id, String(item.quantity - 1))} className="p-1.5 px-2 hover:bg-muted active:bg-accent transition-colors"><Minus size={12} className="text-foreground/70" /></button>
                    <input
                      type="text"
                      value={item.quantity || ''}
                      onChange={(e) => updateQty(item.id, e.target.value)}
                      className="w-10 text-center text-xs font-bold leading-none bg-transparent outline-none p-0 hide-arrows"
                      onFocus={(e) => e.target.select()}
                    />
                    <button type="button" onClick={() => updateQty(item.id, String(item.quantity + 1))} className="p-1.5 px-2 hover:bg-muted active:bg-accent transition-colors"><Plus size={12} className="text-foreground/70" /></button>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-muted-foreground">Rs.</span>
                    <input
                      type="text"
                      value={item.price || ''}
                      onChange={(e) => updatePrice(item.id, e.target.value)}
                      className="w-16 h-5 text-xs font-black text-primary bg-transparent border-b border-primary/20 focus:border-primary outline-none px-0.5"
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                </div>

                <button onClick={() => setCart(cart.filter((i) => i.id !== item.id))} className="text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-1">
                  <X size={14} />
                </button>
              </div>
            ))}
          </CardContent>

          <CardFooter className="p-4 border-t flex flex-col bg-muted/20 shrink-0 gap-3">
            {cart.length > 0 && (
              <div className="w-full bg-background border rounded-xl p-3 shadow-sm focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Apply Discount</span>
                  <div className="flex bg-muted rounded-md p-0.5">
                    <button
                      onClick={() => setDiscountType('percentage')}
                      className={cn("px-2.5 py-0.5 text-[10px] font-bold rounded transition-colors", discountType === 'percentage' ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}
                    >%</button>
                    <button
                      onClick={() => setDiscountType('fixed')}
                      className={cn("px-2.5 py-0.5 text-[10px] font-bold rounded transition-colors", discountType === 'fixed' ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}
                    >Amt</button>
                  </div>
                </div>
                <Input
                  type="number"
                  min="0"
                  max={discountType === 'percentage' ? "100" : subtotal}
                  placeholder={discountType === 'percentage' ? "0%" : "0.00"}
                  value={discountValue}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val < 0) return;
                    if (discountType === 'percentage' && val > 100) return;
                    if (discountType === 'fixed' && val > subtotal) return;
                    setDiscountValue(e.target.value);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="h-8 text-sm"
                />
              </div>
            )}

            <div className="flex gap-2 w-full">
              {(['cash', 'online'] as const).map((m) => (
                <Button
                  key={m}
                  variant={paymentMethod === m ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod(m)}
                  className="flex-1 capitalize shadow-none transition-all"
                >
                  {m === 'online' ? 'Online' : m}
                </Button>
              ))}
            </div>

            <div className="w-full space-y-1.5 mb-1 mt-1">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Subtotal</span>
                <span className="font-semibold">{fmtPKR(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-sm animate-in fade-in slide-in-from-top-1">
                  <span className="text-destructive font-medium">Discount</span>
                  <span className="text-destructive font-bold">-{fmtPKR(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t mt-1">
                <span className="font-bold text-foreground">Total</span>
                <span className="text-2xl font-bold tracking-tight text-primary drop-shadow-sm">{fmtPKR(total)}</span>
              </div>
            </div>

            <Button
              onClick={() => {
                setAmountPaid(String(total));
                setShowCheckoutModal(true);
              }}
              disabled={cart.length === 0 || isProcessing}
              size="lg"
              className="w-full h-12 text-base font-bold gap-2 shadow-md hover:shadow-lg transition-all border-none"
            >
              <CreditCard size={18} /> Checkout
            </Button>
          </CardFooter>
        </Card>
      </div>

      {showCustom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded-lg">
                  <PenLine size={18} className="text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle className="text-lg">Custom Item</CardTitle>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowCustom(false)} className="h-8 w-8 -mr-2 text-muted-foreground">
                <X size={18} />
              </Button>
            </CardHeader>
            <form onSubmit={addCustomToCart}>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Item Name <span className="text-destructive">*</span></label>
                  <Input
                    ref={customNameRef} required value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Special Platter"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Price (PKR) <span className="text-destructive">*</span></label>
                    <Input
                      type="text" required value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Quantity <span className="text-destructive">*</span></label>
                    <Input
                      type="text" required value={customQty}
                      onChange={(e) => setCustomQty(e.target.value.replace(/[^0-9]/g, ''))}
                    />
                  </div>
                </div>
                {customName && customPrice && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-lg p-3 text-sm animate-in fade-in slide-in-from-bottom-2">
                    <span className="text-purple-700 dark:text-purple-300 font-medium truncate inline-block max-w-[60%] align-middle">{customName} <span className="opacity-70">x{customQty || 1}</span></span>
                    <span className="float-right font-bold text-purple-700 dark:text-purple-300 align-middle">{fmtPKR((parseFloat(customPrice) || 0) * (parseInt(customQty) || 1))}</span>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex gap-3 pt-0">
                <Button type="button" variant="outline" className="w-full" onClick={() => setShowCustom(false)}>Cancel</Button>
                <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white border-transparent">Add to Cart</Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
              <CardTitle className="text-xl">Checkout</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowCheckoutModal(false)} className="-mr-2">
                <X size={18} />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">Select Customer (Optional)</label>
                  {!showAddCustomer && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setShowAddCustomer(true)}>
                      + New Customer
                    </Button>
                  )}
                </div>

                {showAddCustomer ? (
                  <div className="bg-muted/50 p-3 rounded-md border border-border space-y-2 animate-in fade-in">
                    <Input
                      placeholder="Customer Name *"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Phone Number"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleAddCustomerInline} disabled={isProcessing}>Add & Select</Button>
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => setShowAddCustomer(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="relative space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                      <Input
                        placeholder="Type customer name or phone..."
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          if (!e.target.value) setSelectedCustomerId('');
                        }}
                        onFocus={() => {
                          if (!customerSearch) setCustomerSearch('');
                        }}
                        className="pl-9 h-10 text-sm bg-background border-border/50 shadow-sm"
                      />
                      {selectedCustomerId && (
                        <Button
                          variant="ghost" size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setSelectedCustomerId('');
                            setCustomerSearch('');
                          }}
                        >
                          <X size={14} />
                        </Button>
                      )}
                    </div>

                    {customerSearch && !selectedCustomerId && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-xl max-h-[200px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                        <div
                          className="p-2 text-xs hover:bg-accent cursor-pointer flex items-center justify-between border-b border-border/50"
                          onClick={() => {
                            setSelectedCustomerId('');
                            setCustomerSearch('Walk-in Customer');
                          }}
                        >
                          <span className="font-bold">Walk-in Customer</span>
                          <Badge variant="outline" className="text-[10px]">Guest</Badge>
                        </div>
                        {filteredCustomers.length === 0 ? (
                          <div className="p-4 text-center text-xs text-muted-foreground italic">No customers found.</div>
                        ) : (
                          filteredCustomers.map(c => (
                            <div
                              key={c.id}
                              className="p-2.5 hover:bg-accent cursor-pointer border-b border-border/40 last:border-0 transition-colors"
                              onClick={() => {
                                setSelectedCustomerId(c.id);
                                setCustomerSearch(c.name);
                              }}
                            >
                              <div className="font-semibold text-sm">{c.name}</div>
                              {c.phone && <div className="text-[10px] text-muted-foreground">{c.phone}</div>}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {!customerSearch && !selectedCustomerId && (
                      <p className="text-[10px] text-muted-foreground ml-1 italic">Type to find or add a customer above.</p>
                    )}

                    {selectedCustomerId && (
                      <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/10 animate-in slide-in-from-top-2">
                        <div className="bg-primary/20 p-1.5 rounded-full">
                          <Users size={14} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-bold leading-none">{customers.find(c => c.id === selectedCustomerId)?.name}</p>
                          <p className="text-[10px] text-muted-foreground">Linked to this sale</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">Selecting a customer will link this sale to their account history.</p>
              </div>

              <div className="bg-muted/30 p-4 rounded-xl border border-border">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Total Amount</span>
                  <span className="font-bold text-lg">{fmtPKR(total)}</span>
                </div>

                <div className="space-y-2 mt-4">
                  <label className="text-sm font-semibold">Amount Paid (PKR)</label>
                  <Input
                    type="text"
                    value={amountPaid}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setAmountPaid(val);
                    }}
                    className="text-lg font-bold bg-background"
                  />
                  {selectedCustomerId ? (
                    <p className="text-xs text-muted-foreground">
                      Remaining balance: {fmtPKR(Math.max(0, total - (parseFloat(amountPaid) || 0)))} will be added to customer's Qaraz (Credit).
                    </p>
                  ) : (
                    parseFloat(amountPaid) < total && (
                      <p className="text-xs text-destructive font-medium">
                        Warning: Walk-in customers cannot have partial payments. Please select a customer to track credit.
                      </p>
                    )
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-3 pt-0">
              <Button variant="outline" className="w-full" onClick={() => setShowCheckoutModal(false)}>Cancel</Button>
              <Button
                onClick={processPayment}
                disabled={isProcessing || (!selectedCustomerId && parseFloat(amountPaid) < total)}
                className="w-full"
              >
                {isProcessing ? <RefreshCw size={18} className="animate-spin mr-2" /> : <CheckCircle size={18} className="mr-2" />}
                Complete Sale
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {receiptData && (
        <ReceiptModal
          data={receiptData}
          onPrint={handlePrintReceipt}
          onSavePdf={handleSavePdf}
          onClose={handleCloseReceipt}
        />
      )}
      <RegisterManager
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onRegisterStatusChange={setCurrentRegister}
      />
    </div>
  );
}
