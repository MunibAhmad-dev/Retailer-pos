import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Truck, Pencil, Trash2, Phone, ShoppingBag, X, History, Printer, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { useNotifications } from '../components/NotificationProvider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton, SearchSpinner } from '../components/Pagination';

interface Product {
  id: number;
  name: string;
  category?: string;
  stock?: number;
  unit?: string;
  price?: number;
}

interface Vendor {
  id?: number;
  name: string;
  phone?: string;
  address?: string;
}

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [current, setCurrent] = useState<Vendor>({ name: '', phone: '', address: '' });
  
  // Restock logic
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [restockItems, setRestockItems] = useState<{product_id: number, quantity: number, purchase_price: number, selling_price?: number}[]>([]);
  const [restockLoading, setRestockLoading] = useState(false);

  // History + invoice
  const [historyVendor, setHistoryVendor] = useState<Vendor | null>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [showProductDialog, setShowProductDialog] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', price: 0, purchase_price: 0, stock: 0, category: '', unit: '' });
  const [globalProductSearch, setGlobalProductSearch] = useState('');
  
  const { addNotification } = useNotifications();

  useEffect(() => {
    loadVendors();
    loadProducts();
  }, []);

  const loadVendors = async () => {
    try {
      const res = await window.api.getVendors();
      if (res.success) setVendors(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await window.api.getProducts();
      if (res.success) setProducts(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Search with spinner feedback
  const handleSearch = (v: string) => {
    setIsSearching(true);
    setSearchTerm(v);
    setTimeout(() => setIsSearching(false), 200);
  };

  const filteredVendors = useMemo(() => vendors.filter((v) =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.phone || '').includes(searchTerm)
  ), [vendors, searchTerm]);

  // Pagination: show 12 initially (fills a viewport), load 10 more at a time
  const { visible: visibleVendors, hasMore, loadMore, total, showing } = usePagination(filteredVendors, 10, 2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current.name.trim()) {
       addNotification("Validation Error", "Vendor name is required.", "warning");
       return;
    }
    const res = await window.api.addVendor(current);
    if (res.success) {
      addNotification("Vendor added", `${current.name} added to database.`, "success");
      loadVendors();
      setShowDialog(false);
    } else {
      addNotification("Error", res.error || "Failed to add vendor", "error");
    }
  };

  const openRestock = (v: Vendor) => {
    setSelectedVendor(v);
    setRestockItems([{ product_id: 0, quantity: 1, purchase_price: 0, selling_price: undefined }]);
  };

  const handleAddRow = () => {
    setRestockItems([...restockItems, { product_id: 0, quantity: 1, purchase_price: 0, selling_price: undefined }]);
  };

  const updateRow = (index: number, field: string, value: any) => {
    const updated = [...restockItems];
    updated[index] = { ...updated[index], [field]: value };
    setRestockItems(updated);
  };

  const removeRow = (index: number) => {
    const updated = [...restockItems];
    updated.splice(index, 1);
    setRestockItems(updated);
  };

  const submitRestock = async () => {
    const validItems = restockItems.filter(i => i.product_id > 0 && i.quantity > 0 && i.purchase_price >= 0);
    if (validItems.length === 0) {
      addNotification('Validation Error', 'Please add at least one valid product to restock.', 'warning');
      return;
    }
    
    setRestockLoading(true);
    const total = validItems.reduce((acc, item) => acc + (item.quantity * item.purchase_price), 0);
    
    const res = await window.api.createPurchase({
      vendor_id: selectedVendor!.id!,
      items: validItems,
      total
    });

    if (res.success) {
      // Update selling price on any product where the user specified a new one
      for (const item of validItems) {
        if (item.selling_price && item.selling_price > 0 && item.product_id > 0) {
          const prod = products.find(p => p.id === item.product_id);
          if (prod) {
            await window.api.updateProduct(item.product_id, {
              ...prod,
              price: item.selling_price,
            });
          }
        }
      }
      addNotification('Stock Added', `Successfully restocked from ${selectedVendor?.name}.`, 'success');
      loadProducts(); // Refresh product list
      setSelectedVendor(null);
    } else {
      addNotification('Error', res.error || 'Failed to process restock', 'error');
    }
    setRestockLoading(false);
  };

  const openHistory = async (v: Vendor) => {
    setHistoryVendor(v);
    setSelectedVendor(null);
    setHistoryLoading(true);
    try {
      const res = await window.api.getVendorPurchases(v.id);
      setPurchases(res.success ? (res.data || []) : []);
    } catch { setPurchases([]); } finally { setHistoryLoading(false); }
  };

  const printVendorInvoice = (purchase: any) => {
    const win = window.open('', '_blank', 'width=800,height=700');
    if (!win) return;
    const rows = (purchase.items || []).map((item: any) => `
      <tr>
        <td style="padding:6px 4px;border-bottom:1px solid #eee">${item.product_name || item.product_id}</td>
        <td style="text-align:right;padding:6px 4px;border-bottom:1px solid #eee">${item.quantity_added}</td>
        <td style="text-align:right;padding:6px 4px;border-bottom:1px solid #eee">PKR ${Math.round(item.purchase_price).toLocaleString()}</td>
        <td style="text-align:right;padding:6px 4px;border-bottom:1px solid #eee">PKR ${Math.round(item.quantity_added * item.purchase_price).toLocaleString()}</td>
      </tr>
    `).join('');
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Purchase Invoice #${purchase.id}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
        h1 { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
        .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
        table { width:100%; border-collapse:collapse; margin-top:16px; }
        th { background:#f4f4f4; text-align:left; padding:8px 4px; border-bottom:2px solid #ddd; font-size:13px; }
        th:not(:first-child) { text-align:right; }
        tfoot td { font-weight:bold; padding:10px 4px; border-top:2px solid #333; }
        .info { display:flex; justify-content:space-between; margin-bottom:16px; }
        .info div { font-size:13px; }
        @media print { body { padding:16px; } }
      </style></head>
      <body>
        <h1>Purchase Invoice</h1>
        <p class="sub">#INV-${String(purchase.id).padStart(5,'0')} &nbsp;|&nbsp; ${new Date(purchase.date_created).toLocaleDateString('en-PK')}</p>
        <div class="info">
          <div><strong>Vendor:</strong> ${purchase.vendor_name || 'Unknown'}<br/>${purchase.vendor_phone ? purchase.vendor_phone : ''}</div>
          <div style="text-align:right"><strong>Purchase ID:</strong> ${purchase.id}<br/><strong>Date:</strong> ${new Date(purchase.date_created).toLocaleString('en-PK')}</div>
        </div>
        <table>
          <thead><tr><th>Product</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Cost</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="3">GRAND TOTAL</td><td style="text-align:right">PKR ${Math.round(purchase.total).toLocaleString()}</td></tr></tfoot>
        </table>
        <script>window.onload=function(){window.print();}<\/script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="flex gap-6 animate-in fade-in max-w-[1600px] h-full relative">
      <div className={`flex-1 transition-all duration-300 ${selectedVendor ? 'hidden md:flex md:w-1/2 lg:w-2/3' : 'w-full'}`}>
        <div className="flex flex-col gap-6 w-full">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Vendors & Suppliers</h1>
              <p className="text-muted-foreground text-sm mt-1">Manage suppliers and add new stock (Purchases)</p>
            </div>
            <Button onClick={() => { setCurrent({ name: '', phone: '', address: '' }); setShowDialog(true); }} className="gap-2 shadow-sm">
              <Plus size={16} /> New Vendor
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input 
              type="text" 
              placeholder="Search suppliers..." 
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 pr-9 h-11 text-base shadow-sm bg-card"
            />
            <SearchSpinner visible={isSearching} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
            {filteredVendors.length === 0 ? (
              <div className="col-span-full py-20 text-center flex flex-col items-center">
                <Truck size={48} className="text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground font-medium">No vendors found.</p>
              </div>
            ) : (
              visibleVendors.map(v => (
                <Card key={v.id} className={`shadow-sm ${selectedVendor?.id === v.id ? 'border-primary ring-1 ring-primary/30' : ''} ${historyVendor?.id === v.id ? 'border-blue-500 ring-1 ring-blue-500/30' : ''}`}>
                  <CardContent className="p-5 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-lg leading-tight line-clamp-1">{v.name}</div>
                    </div>
                    {v.phone ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone size={14} className="opacity-70" /> {v.phone}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground/50 italic">No phone</div>
                    )}
                    <div className="pt-3 border-t mt-1 flex gap-2">
                      <Button variant="outline" className="flex-1 gap-2 text-primary border-primary/20 hover:bg-primary/5" onClick={() => openRestock(v)}>
                        <ShoppingBag size={14} /> Add Stock
                      </Button>
                      <Button variant="ghost" size="icon" className="border border-border/50 text-blue-500 hover:bg-blue-500/10" title="View Purchase History" onClick={() => openHistory(v)}>
                        <History size={16} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <LoadMoreButton hasMore={hasMore} onLoadMore={loadMore} showing={showing} total={total} />
        </div>
      </div>

      {/* Restock Sidebar */}
      {selectedVendor && (
        <Card className="flex flex-col w-full md:w-1/2 lg:w-1/3 absolute md:relative right-0 h-[calc(100vh-100px)] shadow-2xl border-l md:border-l-0 z-10 bg-background/95 backdrop-blur-md animate-in slide-in-from-right-8">
          <CardHeader className="border-b bg-muted/20 pb-4 relative">
            <Button variant="ghost" size="icon" className="absolute right-4 top-4 rounded-full" onClick={() => setSelectedVendor(null)}>
              <X size={18} />
            </Button>
            <CardTitle className="text-xl font-bold pr-10">Restock from {selectedVendor.name}</CardTitle>
            <CardDescription>Add inventory batches to the system.</CardDescription>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {restockItems.map((item, index) => (
              <div key={index} className="flex flex-col gap-3 p-4 bg-muted/30 border rounded-lg relative">
                {restockItems.length > 1 && (
                  <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white hover:bg-destructive/90 shadow-md" onClick={() => removeRow(index)}>
                    <X size={12} />
                  </Button>
                )}
                
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Select Product</label>
                      <Button variant="ghost" className="h-5 text-[9px] px-1.5 text-primary hover:bg-primary/5" onClick={() => setShowProductDialog(true)}>
                        + Create New
                      </Button>
                    </div>
                    
                    <Select 
                      value={item.product_id.toString()}
                      onValueChange={(val) => updateRow(index, 'product_id', Number(val))}
                    >
                      <SelectTrigger className="w-full bg-background border-border/40">
                        <SelectValue placeholder="-- Select a Product --" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2 border-b bg-muted/20">
                          <Input 
                            placeholder="Search products..." 
                            className="h-8 text-xs" 
                            value={globalProductSearch}
                            onChange={(e) => setGlobalProductSearch(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                        </div>
                        {products
                          .filter(p => p.name.toLowerCase().includes(globalProductSearch.toLowerCase()))
                          .slice(0, 20)
                          .map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                              {p.name}{p.unit ? ` (${p.unit})` : ''} — Stock: {p.stock ?? 0}
                            </SelectItem>
                          ))}
                        {products.filter(p => p.name.toLowerCase().includes(globalProductSearch.toLowerCase())).length === 0 && (
                          <div className="p-4 text-center text-xs text-muted-foreground">No products found</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                <div className="flex gap-3">
                  <div className="space-y-1 flex-1">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Qty</label>
                    <Input type="number" min="1" value={item.quantity} onChange={(e) => updateRow(index, 'quantity', Number(e.target.value))} />
                  </div>
                  <div className="space-y-1 flex-1">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Cost Price (PKR)</label>
                    <Input type="number" min="0" value={item.purchase_price} onChange={(e) => updateRow(index, 'purchase_price', Number(e.target.value))} />
                  </div>
                  <div className="space-y-1 flex-1">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">New Sell Price</label>
                    <Input
                      type="number" min="0"
                      value={item.selling_price ?? ''}
                      onChange={(e) => updateRow(index, 'selling_price', e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="optional"
                      className="placeholder:text-muted-foreground/40"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <Button variant="outline" className="border-dashed" onClick={handleAddRow}>
              <Plus size={16} className="mr-2" /> Add Another Product
            </Button>
          </CardContent>

          <div className="p-4 border-t bg-card mt-auto">
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold text-muted-foreground">Total Value:</span>
              <span className="text-xl font-bold">
                PKR {restockItems.reduce((acc, i) => acc + (i.quantity * i.purchase_price), 0).toLocaleString()}
              </span>
            </div>
            <Button className="w-full py-6 text-lg font-bold" onClick={submitRestock} disabled={restockLoading}>
              Confirm Purchase
            </Button>
          </div>
        </Card>
      )}

      {/* Purchase History Sidebar */}
      {historyVendor && !selectedVendor && (
        <Card className="flex flex-col w-full md:w-1/2 lg:w-1/3 absolute md:relative right-0 h-[calc(100vh-100px)] shadow-2xl border-l md:border-l-0 z-10 bg-background/95 backdrop-blur-md animate-in slide-in-from-right-8">
          <CardHeader className="border-b bg-blue-500/5 pb-4 relative">
            <Button variant="ghost" size="icon" className="absolute right-4 top-4 rounded-full" onClick={() => setHistoryVendor(null)}>
              <X size={18} />
            </Button>
            <div className="flex items-center gap-2 pr-10">
              <History size={18} className="text-blue-500" />
              <CardTitle className="text-xl font-bold">{historyVendor.name}</CardTitle>
            </div>
            <CardDescription>Purchase history &amp; invoices</CardDescription>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {historyLoading ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm animate-pulse">Loading history...</div>
            ) : purchases.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <Truck size={48} className="opacity-20 mb-4" />
                <p className="text-sm">No purchases recorded for this vendor.</p>
              </div>
            ) : purchases.map((pur: any) => (
              <Card key={pur.id} className="border-border/50 shadow-sm">
                <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
                  <div>
                    <div className="font-bold text-sm">Invoice #INV-{String(pur.id).padStart(5,'0')}</div>
                    <div className="text-xs text-muted-foreground">{new Date(pur.date_created).toLocaleString('en-PK')}</div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => printVendorInvoice(pur)}>
                    <Printer size={13} /> Print
                  </Button>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="text-xs text-muted-foreground mb-2">{(pur.items || []).length} product(s)</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {(pur.items || []).map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-foreground font-medium">{item.product_name}</span>
                        <span className="text-muted-foreground">{item.quantity_added} × PKR {Math.round(item.purchase_price).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-2 border-t">
                    <span className="text-xs font-semibold text-muted-foreground">Total</span>
                    <Badge className="font-mono text-xs">PKR {Math.round(pur.total).toLocaleString()}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Dialog for Add */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl">
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>Add New Vendor</CardTitle>
                <CardDescription>Enter supplier details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Vendor Name <span className="text-destructive">*</span></label>
                  <Input type="text" required value={current.name} onChange={(e) => setCurrent({ ...current, name: e.target.value })} placeholder="e.g. ABC Wholesalers" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Phone Number</label>
                  <Input type="tel" value={current.phone || ''} onChange={(e) => setCurrent({ ...current, phone: e.target.value })} placeholder="0300 1234567" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Address</label>
                  <Input type="text" value={current.address || ''} onChange={(e) => setCurrent({ ...current, address: e.target.value })} />
                </div>
              </CardContent>
              <CardFooter className="flex gap-3 pt-4 border-t">
                <Button type="button" variant="outline" className="w-full" onClick={() => setShowDialog(false)}>Cancel</Button>
                <Button type="submit" className="w-full">Create Vendor</Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

      {/* Dialog for Quick Product Add */}
      {showProductDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl border-primary/20">
            <CardHeader className="bg-primary/5">
              <CardTitle className="flex items-center gap-2"><Plus className="text-primary" /> Quick Create Product</CardTitle>
              <CardDescription>Adding product for {selectedVendor?.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Product Name *</label>
                <Input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="e.g. Fresh Milk" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Category</label>
                  <Input value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} placeholder="e.g. Dairy" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Unit</label>
                  <Input value={newProduct.unit} onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })} placeholder="e.g. 1kg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Default Sell Price</label>
                  <Input type="number" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Initial Stock (Optional)</label>
                  <Input type="number" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: Number(e.target.value) })} />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" className="w-full" onClick={() => setShowProductDialog(false)}>Cancel</Button>
              <Button type="button" className="w-full" onClick={async () => {
                if (!newProduct.name) return addNotification("Error", "Product name is required", "error");
                try {
                  const res = await window.api.addProduct({ ...newProduct, purchase_price: 0 });
                  if (res.success) {
                    addNotification("Success", "Product created", "success");
                    setShowProductDialog(false);
                    setNewProduct({ name: '', price: 0, purchase_price: 0, stock: 0, category: '', unit: '' });
                    load(false); // Refresh products list
                  }
                } catch (e: any) { addNotification("Error", e.message, "error"); }
              }}>Save Product</Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
