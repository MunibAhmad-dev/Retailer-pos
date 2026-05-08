import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, Search, Plus, CheckCircle, RefreshCw, Trash2, Package, Truck, Receipt, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { cn } from '../lib/utils';
import { useNotifications } from '../components/NotificationProvider';


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
  quantity: number;
  stock?: number;
}

interface Vendor {
  id: number;
  name: string;
}

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
  const { addNotification } = useNotifications();

  useEffect(() => {
    loadProducts();
    loadVendors();
  }, []);

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
        selling_price: product.price || 0, // Initialize with current selling price
        quantity: 1, 
        stock: product.stock 
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
      addNotification("Validation", "Please select a vendor before processing the purchase.", "warning");
      return;
    }

    setIsProcessing(true);
    try {
      const paid = parseFloat(amountPaid) || 0;
      const res = await window.api.createPurchase({
        vendor_id: Number(selectedVendorId),
        total: total,
        amount_paid: paid,
        items: cart.map((c) => ({
          product_id: c.product_id,
          product_name: c.name || 'Unknown Product',
          purchase_price: c.purchase_price,
          selling_price: c.selling_price, // Pass the new selling price
          quantity: c.quantity,
        })),
      });

      if (res.success) {
        addNotification("Success", "Purchase Order completed and stock updated!", "success");
        setCart([]);
        setAmountPaid('');
        setSelectedVendorId('');
        setShowCheckoutModal(false);
        loadProducts(); // Refresh stock
      } else {
        addNotification("Error", res.error || "Failed to process purchase", "error");
      }
    } catch (e: any) {
      addNotification("Error", e.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full flex gap-6">
      {/* Product Selection */}
      <Card className="flex-1 flex flex-col min-w-0 shadow-lg border-border/50 bg-card">
        <CardHeader className="p-4 border-b bg-muted/10">
          <div className="flex justify-between items-center mb-2">
            <div>
              <CardTitle className="text-2xl font-black flex items-center gap-2">
                <Receipt className="text-primary" /> Purchase Orders
              </CardTitle>
              <CardDescription>Add incoming stock and record vendor bills</CardDescription>
            </div>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input 
              placeholder="Search products by name or barcode..." 
              className="pl-10 h-12 text-lg font-medium shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-0 flex flex-col bg-muted/5">
          <div className="flex-1">
            {filteredProducts.slice(0, 30).map((product: Product) => (
              <div 
                key={product.id}
                className="flex justify-between items-center p-3 border-b hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => addProductToCart(product)}
              >
                <div>
                  <h4 className="font-bold text-sm">{product.name}</h4>
                  <div className="text-xs text-muted-foreground mt-1 flex gap-2">
                    {product.barcode && <span className="font-mono bg-muted px-1.5 rounded">{product.barcode}</span>}
                    <span>Current Stock: <span className="font-bold text-foreground">{product.stock || 0}</span></span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Cost Price</div>
                  <div className="font-bold text-primary">Rs. {Math.round(product.purchase_price || 0).toLocaleString('en-PK')}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cart (Incoming Items) */}
      <Card className="flex flex-col lg:w-[400px] min-w-[340px] shrink-0 border-border/60 shadow-lg bg-card max-h-full">
        <CardHeader className="p-4 py-3 border-b bg-muted/30 flex-row flex justify-between items-center">
          <CardTitle className="text-base font-bold flex items-center gap-2"><Truck size={18}/> Incoming Delivery</CardTitle>
          {cart.length > 0 && <Button variant="ghost" size="sm" onClick={() => setCart([])} className="text-destructive h-7">Clear</Button>}
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
              <Package size={48} className="mb-4" />
              <p>No products added yet.</p>
            </div>
          ) : cart.map((item) => {
            const originalProduct = products.find(p => p.id === item.product_id);
            const originalCost = originalProduct?.purchase_price || 0;
            const priceDiff = item.purchase_price - originalCost;
            
            return (
              <div key={item.id} className="flex flex-col gap-2 p-3 rounded-lg border bg-card shadow-sm border-border/60">
                <div className="flex justify-between items-start font-bold text-sm leading-tight">
                  <span className="flex-1 pr-2">{item.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => setCart(cart.filter(i => i.id !== item.id))}>
                    <Trash2 size={12} />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-1">
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
                        <span className={cn("text-[9px] font-black px-1 rounded", priceDiff > 0 ? "bg-red-500/10 text-red-600" : "bg-green-500/10 text-green-600")}>
                          {priceDiff > 0 ? '▲' : '▼'} {Math.round(Math.abs(priceDiff))}
                        </span>
                      )}
                    </div>
                    <Input 
                      type="text" className={cn("h-8 text-sm font-bold", priceDiff !== 0 ? "border-amber-500/50 bg-amber-500/5" : "bg-muted/20")}
                      value={item.purchase_price !== undefined ? Math.round(item.purchase_price) : ''} 
                      onChange={(e) => updatePrice(item.id, e.target.value)}
                      onFocus={e => e.target.select()}
                    />
                  </div>
                </div>

                {/* Selling Price Sync Option */}
                <div className="pt-2 mt-1 border-t border-dashed flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase">Sale Price</span>
                    <span className="text-[9px] text-muted-foreground/60 italic">Curr: Rs.{Math.round(originalProduct?.price || 0)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input 
                      placeholder="New Sale Price"
                      className="w-24 h-7 text-[11px] font-bold border-primary/20 bg-primary/5 focus:border-primary"
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
              </div>
            );
          })}
        </CardContent>

        <CardFooter className="p-4 border-t flex flex-col gap-3 bg-muted/10 shrink-0">
          <div className="flex justify-between w-full font-black text-xl mb-2">
            <span>Bill Total:</span>
            <span className="text-primary">Rs. {total.toLocaleString()}</span>
          </div>
          <Button 
            className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700" 
            disabled={cart.length === 0}
            onClick={() => setShowCheckoutModal(true)}
          >
            Process Purchase
          </Button>
        </CardFooter>
      </Card>

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="border-b">
              <CardTitle>Finalize Purchase Order</CardTitle>
              <CardDescription>Log the vendor bill and update stock.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Select Vendor <span className="text-destructive">*</span></label>
                <div className="relative space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <Input 
                      placeholder="Type vendor name..." 
                      value={vendorSearch}
                      onChange={(e) => {
                        setVendorSearch(e.target.value);
                        if (!e.target.value) setSelectedVendorId('');
                      }}
                      className="pl-9 h-11 text-sm bg-background border-border shadow-sm"
                    />
                    {selectedVendorId && (
                      <Button 
                        variant="ghost" size="icon" 
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setSelectedVendorId('');
                          setVendorSearch('');
                        }}
                      >
                        <X size={16} />
                      </Button>
                    )}
                  </div>

                  {vendorSearch && !selectedVendorId && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-xl max-h-[200px] overflow-y-auto">
                      {filteredVendors.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground italic">No vendors found.</div>
                      ) : (
                        filteredVendors.map(v => (
                          <div 
                            key={v.id} 
                            className="p-3 hover:bg-accent cursor-pointer border-b border-border/40 last:border-0 transition-colors flex items-center justify-between"
                            onClick={() => {
                              setSelectedVendorId(v.id);
                              setVendorSearch(v.name);
                            }}
                          >
                            <span className="font-semibold text-sm">{v.name}</span>
                            <Truck size={14} className="text-muted-foreground opacity-50" />
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {selectedVendorId && (
                    <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20 animate-in slide-in-from-top-2">
                      <div className="bg-primary/20 p-2 rounded-full text-primary">
                        <Truck size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-none">{vendors.find(v => v.id === selectedVendorId)?.name}</p>
                        <p className="text-xs text-muted-foreground">Supplier selected</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex justify-between text-sm mb-1">
                  <span>Total Bill Amount:</span>
                  <span className="font-bold">Rs. {total.toLocaleString()}</span>
                </div>
                <div className="space-y-2 mt-4">
                  <label className="text-sm font-semibold">Amount Paid Today (Rs.)</label>
                  <Input 
                    type="text" 
                    value={amountPaid} 
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setAmountPaid(val);
                    }} 
                    placeholder="0"
                    className="font-bold text-lg"
                  />
                  {selectedVendorId && (
                     <p className="text-xs text-muted-foreground mt-1">
                       Remaining Rs. {Math.max(0, total - (parseFloat(amountPaid) || 0)).toLocaleString()} will be added to the vendor's payable balance.
                     </p>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCheckoutModal(false)}>Cancel</Button>
              <Button onClick={processPurchase} disabled={isProcessing} className="flex-1 bg-green-600 hover:bg-green-700">
                {isProcessing ? <RefreshCw className="animate-spin mr-2" size={16}/> : <CheckCircle className="mr-2" size={16}/>}
                Confirm
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
