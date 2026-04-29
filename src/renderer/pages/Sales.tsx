import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus, Minus, Search, ShoppingCart as CartIcon, X,
  CreditCard, Printer, RefreshCw, PenLine, CheckCircle, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
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

interface CartItem {
  id: string;
  product_id: number | null;
  name: string;
  price: number;
  quantity: number;
  is_custom: boolean;
  stock?: number;
}

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  stock?: number;
  unit?: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
}

interface Settings {
  store_name: string; store_phone: string; store_address: string;
  receipt_footer: string; store_logo: string;
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
  
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [amountPaid, setAmountPaid] = useState<string>('');
  
  const [showAddCustomer, setShowAddCustomer] = useState(false);
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
  }, []);

  const loadCustomers = async () => {
    try { 
      const res = await window.api.getCustomers(); 
      if (res?.success) {
        setCustomers(res.data);
        const params = new URLSearchParams(location.search);
        const cid = params.get('customer_id');
        if (cid) {
          setSelectedCustomerId(Number(cid));
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

  // Show 20 initially (fills a POS grid well), then load 10 more at a time
  const { visible: visibleProducts, hasMore, loadMore, total: prodTotal, showing: prodShowing } = usePagination(filteredProducts, 10, 2);

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
      setCart([...cart, { id: key, product_id: product.id, name: product.name, price: product.price, quantity: 1, is_custom: false, stock: product.stock }]);
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

  const updateQty = (id: string, qty: number) => {
    if (isNaN(qty) || qty <= 0) { setCart(cart.filter((i) => i.id !== id)); return; }
    const item = cart.find(i => i.id === id);
    if (item && item.stock !== undefined && qty > item.stock) {
        addNotification("Stock Limit", `Only ${item.stock} units available.`, "warning");
        setCart(cart.map((i) => i.id === id ? { ...i, quantity: item.stock } : i));
        return;
    }
    setCart(cart.map((i) => i.id === id ? { ...i, quantity: qty } : i));
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
      ${data.discount > 0 ? `<div class="total-row" style="font-weight:normal;font-size:11px;color:red"><span>Discount</span><span>-${fmtPKR(data.discount)}</span></div>` : ''}
      <div class="total-row"><span>Total</span><span>${fmtPKR(data.total)}</span></div>
      <div class="total-row" style="font-weight:normal;font-size:10px;margin-top:2px"><span>Payment</span><span>${data.paymentMethod === 'online' ? 'ONLINE PAYMENT' : data.paymentMethod.toUpperCase()}</span></div>
      
      <div class="divider"></div>
      <div style="text-align: center; margin-top: 6px;">
        <div style="font-size: 11px; font-weight: bold;">${data.settings.receipt_footer}</div>
        <div style="font-size: 9px; margin-top: 6px; color: #555;">Software made by +923298748232</div>
      </div>
    `;
  };
  //animation code 
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
  { bg: 'from-teal-600 to-teal-400',     border: 'border-teal-700',   badge: 'bg-white/20 text-teal-100' },
  { bg: 'from-pink-600 to-pink-400',     border: 'border-pink-700',   badge: 'bg-white/20 text-pink-100' },
  { bg: 'from-blue-700 to-blue-500',     border: 'border-blue-800',   badge: 'bg-white/20 text-blue-100' },
  { bg: 'from-emerald-600 to-emerald-400', border: 'border-emerald-700', badge: 'bg-white/20 text-emerald-100' },
];

const colorForProduct = (product: Product) => {
  const category = product.category?.toLowerCase().trim();
  if (category && CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category];
  }
  // Fallback to deterministic hash-based color
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
    
    const amtPaid = parseFloat(amountPaid);
    let paymentStatus = 'Paid';
    if (!isNaN(amtPaid) && amtPaid < total) {
       paymentStatus = 'Partial';
    }
    if (!isNaN(amtPaid) && amtPaid === 0 && total > 0) {
       paymentStatus = 'Unpaid';
    }

    try {
      const result = await window.api.createSale({
        customer_id: selectedCustomerId ? Number(selectedCustomerId) : undefined,
        subtotal,
        discount: discountAmount,
        total,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        amount_paid: isNaN(amtPaid) ? total : amtPaid,
        items: cart.map((c) => ({
          product_id: c.product_id || undefined,
          product_name: c.name,
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

        // Prevent immediate closing to enforce a cooldown that blocks double clicks
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
    await window.api.printInvoice(buildReceiptHtml(receiptData));
  };

  const handleSavePdf = async () => {
    if (!receiptData) return;
    await window.api.saveInvoicePdf(buildReceiptHtml(receiptData));
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
        {/* Products Core Area */}
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
          <CardContent className="flex-1 p-0 overflow-y-auto w-full min-h-0 custom-scrollbar p-4 xl:p-6 content-start">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleProducts.map((product) => {
  const col = colorForProduct(product);
  const isOutOfStock = (product.stock ?? 999) === 0;
  return (
    <div
      key={product.id}
      onClick={() => !isOutOfStock && addProductToCart(product)}
      className={cn(
        // Layout
        "group relative flex flex-col p-4 rounded-2xl border-2 cursor-pointer overflow-hidden select-none",
        // Gradient bg
        `bg-gradient-to-br ${col.bg}`,
        // Border
        col.border,
        // Hover / active transitions
        "transition-all duration-200 ease-out",
        isOutOfStock
          ? "opacity-50 cursor-not-allowed grayscale"
          : "hover:-translate-y-1.5 hover:scale-[1.03] hover:shadow-2xl active:scale-[1.01] active:-translate-y-0.5",
      )}
    >
      {/* Shimmer sweep on hover */}
      <div className="
        pointer-events-none absolute inset-0 -translate-x-full
        bg-gradient-to-r from-transparent via-white/25 to-transparent
        skew-x-[-15deg]
        group-hover:translate-x-[200%] transition-transform duration-700 ease-in-out
      " />

      {/* Decorative background ring */}
      <div className="pointer-events-none absolute -top-5 -right-5 w-20 h-20 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute bottom-2 left-1 w-10 h-10 rounded-full bg-white/[0.06]" />

      {/* Product Name */}
      <p className="relative z-10 font-bold text-sm leading-tight line-clamp-2 mb-1.5 text-white">
        {product.name}
      </p>

      {/* Category + Unit row */}
      <div className="relative z-10 flex items-center gap-1.5 flex-wrap mb-2">
        {product.category && (
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-medium",
            col.badge
          )}>
            {product.category}
          </span>
        )}
        {product.unit && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-white/30 text-white">
            {product.unit}
          </span>
        )}
      </div>

      {/* Price row */}
      <p className="relative z-10 text-white font-bold text-base tracking-wide mt-auto">
        {fmtPKR(product.price)}
      </p>

      {/* Stock badge */}
      <div className="relative z-10 mt-1.5 flex items-center gap-1">
        {isOutOfStock ? (
          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-black/40 text-red-300">
            Out of Stock
          </span>
        ) : (product.stock !== undefined && product.stock <= 10) ? (
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-black/30 text-yellow-200">
            {product.stock} left
          </span>
        ) : product.stock !== undefined ? (
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-black/20 text-white/70">
            {product.stock} in stock
          </span>
        ) : null}
      </div>
    </div>
  );
})}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-16 flex flex-col items-center justify-center text-muted-foreground text-sm">
                  <CartIcon size={48} className="opacity-10 mb-4" />
                  <p>No products found.</p>
                  <Button variant="link" onClick={() => setShowCustom(true)} className="mt-2 text-primary">Use custom sale instead?</Button>
                </div>
              )}
            </div>
            <LoadMoreButton hasMore={hasMore} onLoadMore={loadMore} showing={prodShowing} total={prodTotal} className="col-span-full" />
          </CardContent>
        </Card>

        {/* Current Order Cart */}
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
                  <p className="text-xs text-primary font-bold">{fmtPKR(item.price)}</p>
                </div>

                {/* Quantity Control Buttons */}
                <div className="flex items-center bg-background border rounded-lg overflow-hidden shadow-sm">
                  <button onClick={() => updateQty(item.id, item.quantity - 1)} className="p-1.5 px-2 hover:bg-muted active:bg-accent transition-colors"><Minus size={12} className="text-foreground/70" /></button>
                  <input 
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateQty(item.id, parseInt(e.target.value))}
                    className="w-10 text-center text-xs font-bold leading-none bg-transparent outline-none p-0 hide-arrows"
                    onFocus={(e) => e.target.select()}
                  />
                  <button onClick={() => updateQty(item.id, item.quantity + 1)} className="p-1.5 px-2 hover:bg-muted active:bg-accent transition-colors"><Plus size={12} className="text-foreground/70" /></button>
                </div>

                <p className="text-xs font-bold w-[4.5rem] text-right">{fmtPKR(item.price * item.quantity)}</p>

                <button onClick={() => setCart(cart.filter((i) => i.id !== item.id))} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                  <X size={14} />
                </button>
              </div>
            ))}
          </CardContent>

          <CardFooter className="p-4 border-t flex flex-col bg-muted/20 shrink-0 gap-3">
            {/* Discount Control */}
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
                  placeholder={discountType === 'percentage' ? "0%" : "0.00"}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
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

      {/* Custom Sale Dialog completely restyled via generic modal div logic to match premium cards */}
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
                      type="number" min="1" step="1" required value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Quantity <span className="text-destructive">*</span></label>
                    <Input
                      type="number" min="1" required value={customQty}
                      onChange={(e) => setCustomQty(e.target.value)}
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
                  <Select 
                    value={selectedCustomerId?.toString() || "none"}
                    onValueChange={(val) => setSelectedCustomerId(val === 'none' ? '' : Number(val))}
                  >
                    <SelectTrigger className="h-10 w-full bg-background border-border/50 shadow-sm">
                      <SelectValue placeholder="Select Customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Walk-in Customer (No Account)</SelectItem>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name} {c.phone ? `(${c.phone})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    type="number" 
                    min="0"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
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
    </div>
  );
}
