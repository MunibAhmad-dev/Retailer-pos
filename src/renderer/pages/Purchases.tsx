import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, Search, Plus, CheckCircle, RefreshCw, Trash2, Package,
  Truck, Receipt, X, Banknote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';
import { useNotifications } from '../components/NotificationProvider';
import { useModules } from '../contexts/ModulesContext';

interface Product {
  id: number;
  name: string;
  price: number;
  purchase_price: number;
  stock?: number;
  unit?: string;
  barcode?: string;
}

interface PurchaseItem {
  id: string;
  product_id: number;
  name: string;
  purchase_price: number;
  selling_price?: number;
  quantity: number;
  stock?: number;
}

interface Vendor {
  id: number;
  name: string;
}

const fmtPKR = (n: number) => 'PKR ' + Math.round(n ?? 0).toLocaleString('en-PK');

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.4, delay: i * 0.055, ease: [0.23, 1, 0.32, 1] }
  }),
};

export default function Purchases() {
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [cart, setCart] = useState<PurchaseItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState<number | ''>('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');
  const { addNotification } = useNotifications();
  const { modules } = useModules();

  useEffect(() => {
    loadProducts();
    loadVendors();
  }, []);

  // Reload (or clear) accounts whenever the accounting module is toggled
  useEffect(() => {
    if (modules.accounting) {
      window.api.getAccounts?.().then((res: any) => {
        if (res?.success && res.data?.accounts) setAccounts(res.data.accounts);
      }).catch(() => {});
    } else {
      setAccounts([]);
      setSelectedAccountId('');
    }
  }, [modules.accounting]);

  const loadProducts = async () => {
    const res = await window.api.getProducts();
    if (res.success) setProducts(res.data);
  };

  const loadVendors = async () => {
    const res = await window.api.getVendors();
    if (res.success) setVendors(res.data);
  };

  const filteredProducts = useMemo(() => products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode || '').toLowerCase().includes(searchTerm.toLowerCase())
  ), [products, searchTerm]);

  const filteredVendors = useMemo(() => vendors.filter((v) =>
    v.name.toLowerCase().includes(vendorSearch.toLowerCase())
  ), [vendors, vendorSearch]);

  const addProductToCart = (product: Product) => {
    const key = String(product.id);
    const existing = cart.find((i) => i.id === key);
    if (existing) {
      setCart(cart.map((i) => i.id === key ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, {
        id: key,
        product_id: product.id,
        name: product.name,
        purchase_price: product.purchase_price || 0,
        selling_price: product.price || 0,
        quantity: 1,
        stock: product.stock,
      }]);
    }
  };

  const updateQty = (id: string, rawValue: string) => {
    const qty = parseInt(rawValue.replace(/[^0-9]/g, '')) || 0;
    setCart(prev => prev.map((i) => i.id === id ? { ...i, quantity: qty } : i));
  };

  const updatePrice = (id: string, rawValue: string) => {
    const val = rawValue.replace(/[^0-9.]/g, '');
    const price = parseFloat(val) || 0;
    setCart(prev => prev.map((i) => i.id === id ? { ...i, purchase_price: price } : i));
  };

  const total = cart.reduce((s, i) => s + i.purchase_price * i.quantity, 0);

  const processPurchase = async () => {
    if (cart.length === 0 || isProcessing) return;
    if (!selectedVendorId) {
      addNotification('Validation', 'Please select a vendor before processing the purchase.', 'warning');
      return;
    }
    if (modules.accounting && accounts.length > 0 && !selectedAccountId) {
      addNotification('Account Required', 'Please select a payment account (Cash in Hand or Bank) before confirming.', 'warning');
      return;
    }
    setIsProcessing(true);
    try {
      const paid = parseFloat(amountPaid) || 0;
      const res = await window.api.createPurchase({
        vendor_id: Number(selectedVendorId),
        total,
        amount_paid: paid,
        account_id: selectedAccountId ? Number(selectedAccountId) : undefined,
        items: cart.map((c) => ({
          product_id: c.product_id,
          product_name: c.name || 'Unknown Product',
          purchase_price: c.purchase_price,
          selling_price: c.selling_price,
          quantity: c.quantity,
        })),
      });
      if (res.success) {
        addNotification('Success', 'Purchase Order completed and stock updated!', 'success');
        setCart([]);
        setAmountPaid('');
        setSelectedVendorId('');
        setSelectedAccountId('');
        setShowCheckoutModal(false);
        loadProducts();
        // Refresh account balances so picker shows updated balance for next purchase
        if (modules.accounting) {
          window.api.getAccounts?.().then((r: any) => {
            if (r?.success && r.data?.accounts) setAccounts(r.data.accounts);
          }).catch(() => {});
        }
      } else {
        addNotification('Error', res.error || 'Failed to process purchase', 'error');
      }
    } catch (e: any) {
      addNotification('Error', e.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">

      {/* ── Hero Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a3a5c 45%, #0c3050 70%, #0f172a 100%)' }}
      >
        <div className="pointer-events-none absolute -top-14 -right-14 w-64 h-64 rounded-full bg-green-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-emerald-500/10 blur-2xl" />
        <div className="relative z-10 p-7">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-4 mb-3">
                <div className="bg-green-500/20 border border-green-400/30 rounded-2xl w-14 h-14 flex items-center justify-center shadow-lg backdrop-blur-sm flex-shrink-0">
                  <Truck size={26} className="text-green-300" />
                </div>
                <div>
                  <p className="text-green-300/80 text-xs font-semibold uppercase tracking-widest mb-0.5">Inventory Procurement</p>
                  <h1 className="text-white text-2xl sm:text-3xl font-bold tracking-tight">Purchase Orders</h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-white/80 text-sm font-medium backdrop-blur-sm">
                  <Package size={13} className="text-green-300" />
                  {products.length} Products
                </div>
                {cart.length > 0 && (
                  <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-white/80 text-sm font-medium backdrop-blur-sm">
                    <ShoppingBag size={13} className="text-amber-300" />
                    {cart.length} items in cart
                  </div>
                )}
                <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-white/80 text-sm font-medium backdrop-blur-sm">
                  <Truck size={13} className="text-blue-300" />
                  {vendors.length} Vendors
                </div>
              </div>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => setShowCheckoutModal(true)}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-400 rounded-xl px-5 py-2.5 text-white text-sm font-semibold shadow-lg shadow-green-500/30 transition-all duration-200"
              >
                <CheckCircle size={15} />
                Process Purchase · {fmtPKR(total)}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Main Layout ── */}
      <div className="h-[calc(100vh-16rem)] flex gap-6">

        {/* Product Selection */}
        <Card className="flex-1 flex flex-col min-w-0 shadow-sm border-border/50 bg-card overflow-hidden">
          <CardHeader className="p-4 border-b bg-muted/10">
            <div className="flex justify-between items-center mb-2">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Receipt size={16} className="text-primary" /> Select Products
                </CardTitle>
                <CardDescription className="text-xs">Click a product to add it to the order</CardDescription>
              </div>
            </div>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
              <Input
                placeholder="Search products by name or barcode..."
                className="pl-10 h-10 text-sm bg-muted/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X size={13} />
                </button>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-0 custom-scrollbar">
            {filteredProducts.slice(0, 50).map((product: Product) => (
              <div
                key={product.id}
                className="flex justify-between items-center p-3.5 border-b border-border/30 hover:bg-primary/[0.03] cursor-pointer transition-colors group"
                onClick={() => addProductToCart(product)}
              >
                <div className="min-w-0">
                  <h4 className="font-semibold text-sm">{product.name}</h4>
                  <div className="text-xs text-muted-foreground mt-0.5 flex gap-2">
                    {product.barcode && <span className="font-mono bg-muted px-1.5 rounded">{product.barcode}</span>}
                    <span>Stock: <span className="font-bold text-foreground">{product.stock || 0}</span></span>
                    {product.unit && <span className="text-muted-foreground/60">{product.unit}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">Cost Price</div>
                  <div className="font-bold text-primary text-sm">{fmtPKR(product.purchase_price || 0)}</div>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Package size={36} className="opacity-20 mb-3" />
                <p className="text-sm font-medium">{searchTerm ? 'No products match your search' : 'No products available'}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cart — Incoming Items */}
        <Card className="flex flex-col lg:w-[400px] min-w-[340px] shrink-0 border-border/60 shadow-sm bg-card max-h-full overflow-hidden">
          <CardHeader className="p-4 py-3 border-b bg-muted/20 flex-row flex justify-between items-center shrink-0">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Truck size={15} className="text-primary" /> Incoming Delivery
              {cart.length > 0 && (
                <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded-full border border-primary/20">{cart.length}</span>
              )}
            </CardTitle>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setCart([])} className="text-destructive h-7 text-xs">Clear</Button>
            )}
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60 py-16">
                <Package size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">No products added yet</p>
                <p className="text-xs mt-1 text-muted-foreground/60">Click a product to add it</p>
              </div>
            ) : cart.map((item) => {
              const originalProduct = products.find(p => p.id === item.product_id);
              const originalCost = originalProduct?.purchase_price || 0;
              const priceDiff = item.purchase_price - originalCost;

              return (
                <div key={item.id} className="flex flex-col gap-2 p-3 rounded-xl border bg-card shadow-sm border-border/50">
                  <div className="flex justify-between items-start font-semibold text-sm leading-tight">
                    <span className="flex-1 pr-2">{item.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => setCart(cart.filter(i => i.id !== item.id))}>
                      <Trash2 size={12} />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">Quantity</label>
                      <Input
                        type="text" className="h-8 text-sm font-bold bg-muted/20"
                        value={item.quantity || ''}
                        onChange={(e) => updateQty(item.id, e.target.value)}
                        onFocus={e => e.target.select()}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">New Cost</label>
                        {priceDiff !== 0 && (
                          <span className={cn('text-[9px] font-black px-1 rounded', priceDiff > 0 ? 'bg-red-500/10 text-red-600' : 'bg-green-500/10 text-green-600')}>
                            {priceDiff > 0 ? '▲' : '▼'} {Math.round(Math.abs(priceDiff))}
                          </span>
                        )}
                      </div>
                      <Input
                        type="text" className={cn('h-8 text-sm font-bold', priceDiff !== 0 ? 'border-amber-500/50 bg-amber-500/5' : 'bg-muted/20')}
                        value={item.purchase_price !== undefined ? Math.round(item.purchase_price) : ''}
                        onChange={(e) => updatePrice(item.id, e.target.value)}
                        onFocus={e => e.target.select()}
                      />
                    </div>
                  </div>

                  {/* Selling Price Sync */}
                  <div className="pt-2 mt-0.5 border-t border-dashed border-border/40 flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">Sale Price</span>
                      <span className="text-[9px] text-muted-foreground/60 italic">Curr: {fmtPKR(originalProduct?.price || 0)}</span>
                    </div>
                    <Input
                      placeholder="New Sale Price"
                      className="w-28 h-7 text-[11px] font-bold border-primary/20 bg-primary/5 focus:border-primary"
                      value={item.selling_price !== undefined ? Math.round(item.selling_price) : ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        const newPrice = parseFloat(val) || 0;
                        setCart(prev => prev.map(i => i.id === item.id ? { ...i, selling_price: newPrice } : i));
                      }}
                      onFocus={e => e.target.select()}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>

          <CardFooter className="p-4 border-t flex flex-col gap-3 bg-muted/10 shrink-0">
            <div className="flex justify-between w-full items-center">
              <span className="text-sm font-semibold text-muted-foreground">Bill Total</span>
              <span className="text-xl font-black text-primary">{fmtPKR(total)}</span>
            </div>
            <Button
              className="w-full h-11 text-sm font-bold bg-green-600 hover:bg-green-500 shadow-lg shadow-green-500/20"
              disabled={cart.length === 0}
              onClick={() => setShowCheckoutModal(true)}
            >
              <CheckCircle size={15} className="mr-2" />
              Process Purchase
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* ── Checkout Modal ── */}
      {showCheckoutModal && createPortal(
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !isProcessing && setShowCheckoutModal(false)}
        >
          <div
            className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative p-5 border-b" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #14532d 100%)' }}>
              <div className="pointer-events-none absolute -top-6 -right-6 w-32 h-32 rounded-full bg-green-500/10 blur-2xl" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="bg-green-500/20 border border-green-400/30 p-2.5 rounded-xl">
                    <Truck size={18} className="text-green-300" />
                  </div>
                  <div>
                    <h2 className="text-white text-base font-bold">Finalize Purchase Order</h2>
                    <p className="text-green-300/70 text-xs mt-0.5">{cart.length} item(s) · {fmtPKR(total)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="text-white/50 hover:text-white/90 transition-colors p-1 rounded-lg hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar">

              {/* Vendor Selection */}
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  <Truck size={13} className="text-muted-foreground" />
                  Select Vendor <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <Input
                    placeholder="Type vendor name..."
                    value={vendorSearch}
                    onChange={(e) => { setVendorSearch(e.target.value); if (!e.target.value) setSelectedVendorId(''); }}
                    className="pl-9 h-10 text-sm"
                  />
                  {selectedVendorId && (
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground" onClick={() => { setSelectedVendorId(''); setVendorSearch(''); }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                {vendorSearch && !selectedVendorId && (
                  <div className="bg-popover border border-border rounded-xl shadow-xl max-h-[200px] overflow-y-auto">
                    {filteredVendors.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground italic">No vendors found.</div>
                    ) : filteredVendors.map(v => (
                      <div key={v.id} className="p-3 hover:bg-accent cursor-pointer border-b border-border/40 last:border-0 flex items-center justify-between"
                        onClick={() => { setSelectedVendorId(v.id); setVendorSearch(v.name); }}>
                        <span className="font-semibold text-sm">{v.name}</span>
                        <Truck size={13} className="text-muted-foreground/50" />
                      </div>
                    ))}
                  </div>
                )}
                {selectedVendorId && (
                  <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/20 animate-in slide-in-from-top-2">
                    <div className="bg-primary/15 p-2 rounded-full">
                      <Truck size={14} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold leading-none">{vendors.find(v => v.id === selectedVendorId)?.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Vendor selected</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Bill Summary */}
              <div className="bg-muted/30 rounded-xl border border-border/50 p-4 space-y-3">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Total Bill Amount</span>
                  <span className="font-bold text-lg">{fmtPKR(total)}</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount Paid Today</label>
                  <Input
                    type="text"
                    value={amountPaid}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      if (!raw) { setAmountPaid(''); return; }
                      const num = parseInt(raw, 10) || 0;
                      setAmountPaid(String(Math.min(num, Math.ceil(total))));
                    }}
                    placeholder="0"
                    className="font-bold text-base h-11"
                  />
                  {selectedVendorId && (
                    <p className="text-xs text-muted-foreground">
                      Remaining {fmtPKR(Math.max(0, total - (parseFloat(amountPaid) || 0)))} → vendor's payable balance
                    </p>
                  )}
                </div>
              </div>

              {/* Account Picker — only when accounting module ON */}
              {modules.accounting && accounts.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Banknote size={12} className="text-blue-500" />
                    Pay From Account
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {accounts.map((acc: any) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setSelectedAccountId(selectedAccountId === acc.id ? '' : acc.id)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all',
                          selectedAccountId === acc.id
                            ? 'bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-400'
                            : 'bg-muted/30 border-border/50 text-muted-foreground hover:border-border hover:bg-muted/50'
                        )}
                      >
                        <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', acc.type === 'cash' ? 'bg-emerald-500' : 'bg-blue-500')} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">{acc.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{fmtPKR(Number(acc.current_balance) || 0)}</p>
                        </div>
                        {selectedAccountId === acc.id && <span className="text-blue-500 text-sm flex-shrink-0">✓</span>}
                      </button>
                    ))}
                  </div>
                  {!selectedAccountId && (
                    <p className="text-[10px] text-muted-foreground/70 italic">No account selected — payment won't be deducted from balance</p>
                  )}
                  {(() => {
                    if (!selectedAccountId) return null;
                    const selAcc = accounts.find((a: any) => a.id === selectedAccountId);
                    const paid = parseFloat(amountPaid) || 0;
                    if (!selAcc || paid <= 0) return null;
                    const bal = Number(selAcc.current_balance) || 0;
                    if (paid <= bal) return (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        Sufficient funds — balance after payment: {fmtPKR(bal - paid)}
                      </p>
                    );
                    const deficit = paid - bal;
                    return (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2.5 space-y-1">
                        <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                          Insufficient funds in "{selAcc.name}"
                        </p>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div>
                            <p className="text-muted-foreground/60">Account Balance</p>
                            <p className="font-bold text-foreground">{fmtPKR(bal)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground/60">You Are Paying</p>
                            <p className="font-bold text-red-600">{fmtPKR(paid)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground/60">Deficit</p>
                            <p className="font-bold text-red-600">-{fmtPKR(deficit)}</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 italic">Balance will go negative — consider topping up the account first.</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-muted/10 space-y-2.5">
              {modules.accounting && accounts.length > 0 && !selectedAccountId && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium text-center flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                  Please select a payment account to continue
                </p>
              )}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowCheckoutModal(false)} disabled={isProcessing}>
                  Cancel
                </Button>
                <Button
                  onClick={processPurchase}
                  disabled={isProcessing || !selectedVendorId || cart.length === 0 || (modules.accounting && accounts.length > 0 && !selectedAccountId)}
                  className="flex-1 bg-green-600 hover:bg-green-500 gap-2"
                >
                  {isProcessing ? <RefreshCw className="animate-spin" size={15} /> : <CheckCircle size={15} />}
                  Confirm Order
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
