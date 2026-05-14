import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Pencil, Trash2, Search, Package, Tag, Layers, BarChart2, TrendingUp, TrendingDown, AlertCircle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import { useNotifications } from '../components/NotificationProvider';
import { PRODUCT_TYPES, PRODUCT_SCHEMAS } from '../lib/productSchemas';

interface Product {
  id?: number;
  name: string;
  price: number;          // selling price
  purchase_price: number; // cost price
  stock: number;
  category: string;
  barcode?: string;
  unit?: string;          // e.g. kg, pcs, box, litre
  product_type?: string;
  vendor_id?: number;
  metadata?: any;
}

const empty: Product = { name: '', price: 0, purchase_price: 0, stock: 0, category: '', barcode: '', unit: '', product_type: 'general', metadata: {} };
const fmtPKR = (n: number) => 'PKR ' + Math.round(n ?? 0).toLocaleString('en-PK');

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [current, setCurrent] = useState<Product>(empty);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const nameRef = useRef<HTMLInputElement>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [displayCount, setDisplayCount] = useState(20);
  const { addNotification } = useNotifications();

  useEffect(() => {
    load();
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, []);
  useEffect(() => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    if (showDialog) {
      focusTimerRef.current = setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [showDialog]);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await window.api.getProducts();
      if (res?.success) setProducts(res.data || []);
      else addNotification('Load Error', 'Failed to load products.', 'error');
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    } finally {
      setIsLoading(false);
    }
    // Load analytics in background
    try {
      const ar = await window.api.getProductAnalytics();
      if (ar?.success) setAnalytics(ar.data || []);
      const vr = await window.api.getVendors();
      if (vr?.success) setVendors(vr.data || []);
    } catch (e) { } /* silent */
  };

  const normalizedSearch = searchTerm.toLowerCase();
  const filtered = useMemo(() => products.filter(
    (p) =>
      p.name.toLowerCase().includes(normalizedSearch) ||
      (p.category || '').toLowerCase().includes(normalizedSearch) ||
      (p.barcode || '').includes(searchTerm)
  ), [products, normalizedSearch, searchTerm]);

  const displayedProducts = filtered.slice(0, displayCount);

  useEffect(() => {
    setDisplayCount(20);
  }, [searchTerm]);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))], [products]);
  const lowStockCount = useMemo(() => products.filter((p) => (p.stock ?? 0) < 10).length, [products]);

  const openAdd = () => { setCurrent({ ...empty }); setIsEditing(false); setShowDialog(true); };
  const openEdit = (p: Product) => { setCurrent({ ...p }); setIsEditing(true); setShowDialog(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current.name.trim()) {
      addNotification('Validation Error', 'Product name is required.', 'warning');
      nameRef.current?.focus();
      return;
    }
    const price = Number(current.price);
    if (isNaN(price) || price <= 0) {
      addNotification('Validation Error', 'Selling price must be a positive number.', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      const productData = {
        name: current.name.trim(),
        price,
        purchase_price: Number(current.purchase_price) || 0,
        stock: Number(current.stock) || 0,
        category: (current.category || '').trim(),
        barcode: (current.barcode || '').trim(),
        unit: (current.unit || '').trim(),
        product_type: current.product_type || 'general',
        metadata: current.metadata || {},
      };
      const res = isEditing && current.id
        ? await window.api.updateProduct(current.id, productData)
        : await window.api.addProduct(productData);

      if (res?.success) {
        addNotification('Success', isEditing ? 'Product updated.' : 'Product added.', 'success');
        setTimeout(() => { setShowDialog(false); load(); }, 200);
      } else {
        throw new Error(res?.error || 'Failed to save product');
      }
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    try {
      const res = await window.api.deleteProduct(id);
      if (res?.success) {
        addNotification('Deleted', 'Product deleted.', 'success');
        await load();
        setDeleteConfirmId(null);
      } else {
        throw new Error(res?.error || 'Failed to delete product');
      }
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
      setDeleteConfirmId(null);
    }
  };

  const margin = (p: Product) => {
    if (!p.purchase_price || p.purchase_price <= 0) return null;
    return (((p.price - p.purchase_price) / p.price) * 100).toFixed(0);
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products Catalogue</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage stock, pricing and cost of goods</p>
        </div>
        <Button onClick={openAdd} className="gap-2 shadow-sm">
          <Plus size={16} /> Add Product
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="bg-primary/10 p-2.5 rounded-xl"><Package className="text-primary w-4 h-4" /></div>
            <div>
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Products</CardTitle>
              <div className="text-2xl font-bold">{products.length}</div>
            </div>
          </CardHeader>
        </Card>
        <Card className="shadow-sm border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="bg-blue-500/10 p-2.5 rounded-xl"><Layers className="text-blue-500 w-4 h-4" /></div>
            <div>
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Categories</CardTitle>
              <div className="text-2xl font-bold">{categories.length}</div>
            </div>
          </CardHeader>
        </Card>
        <Card className="shadow-sm border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="bg-green-500/10 p-2.5 rounded-xl"><BarChart2 className="text-green-500 w-4 h-4" /></div>
            <div>
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Stock</CardTitle>
              <div className="text-2xl font-bold">{products.reduce((s, p) => s + (p.stock ?? 0), 0).toLocaleString()}</div>
            </div>
          </CardHeader>
        </Card>
        <Card className={cn("shadow-sm border-border/50", lowStockCount > 0 && "border-orange-400/50 bg-orange-500/5")}>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className={cn("p-2.5 rounded-xl", lowStockCount > 0 ? "bg-orange-500/10" : "bg-muted")}>
              <Tag className={cn("w-4 h-4", lowStockCount > 0 ? "text-orange-500" : "text-muted-foreground")} />
            </div>
            <div>
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Low Stock</CardTitle>
              <div className={cn("text-2xl font-bold", lowStockCount > 0 && "text-orange-500")}>{lowStockCount}</div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Table */}
      <Card className="shadow-sm">
        <CardHeader className="p-4 border-b bg-muted/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Search by name, category or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 w-full sm:w-80"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto custom-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Cost Price</TableHead>
                <TableHead className="text-right">Selling Price</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground animate-pulse">Loading products...</TableCell></TableRow>
              ) : displayedProducts.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  {searchTerm ? 'No matching products.' : 'No products yet. Click "Add Product" to begin.'}
                </TableCell></TableRow>
              ) : Object.entries(
                displayedProducts.reduce((acc: Record<string, Product[]>, p) => {
                  const cat = p.category || (p.product_type ? p.product_type.charAt(0).toUpperCase() + p.product_type.slice(1) : 'Uncategorized');
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(p);
                  return acc;
                }, {})
              ).map(([cat, prods]) => (
                <React.Fragment key={cat}>
                  <TableRow className="bg-muted/50 border-b-2 border-primary/20">
                    <TableCell colSpan={8} className="font-bold text-primary/80 uppercase tracking-wider text-xs py-2">
                      {cat} ({prods.length})
                    </TableCell>
                  </TableRow>
                  {prods.map((p) => {
                    const m = margin(p);
                    const isLow = (p.stock ?? 0) < 10;

                    const specEntries = p.metadata ? Object.entries(p.metadata).filter(([k, v]) => k !== 'tags' && v) : [];
                    const specTags = p.metadata?.tags && Array.isArray(p.metadata.tags) ? p.metadata.tags : [];

                    return (
                      <TableRow key={p.id} className="hover:bg-muted/40">
                        <TableCell>
                          <div className="font-semibold">{p.name}</div>
                          {p.barcode && <div className="text-xs text-muted-foreground font-mono mt-0.5">{p.barcode}</div>}
                          {(() => {
                            const specEntries = p.metadata ? Object.entries(p.metadata).filter(([k, v]) => k !== 'tags' && v).map(([k, v]) => `${k.replace('_', ' ')}: ${v}`) : [];
                            const specTags = p.metadata?.tags && Array.isArray(p.metadata.tags) ? p.metadata.tags : [];
                            const specStr = [...specEntries, ...specTags].join(' • ');
                            if (!specStr) return null;
                            return (
                              <div className="text-[10px] text-muted-foreground truncate max-w-[200px] mt-0.5 capitalize" title={specStr}>
                                {specStr}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {p.category ? <Badge variant="secondary" className="font-mono text-xs">{p.category}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {p.unit ? <Badge variant="outline" className="font-mono text-xs text-blue-600 border-blue-400/40">{p.unit}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground font-mono text-sm">
                          {p.purchase_price > 0 ? fmtPKR(p.purchase_price) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">{fmtPKR(p.price)}</TableCell>
                        <TableCell className="text-right">
                          {m ? (
                            <Badge className={cn("font-mono text-xs", Number(m) >= 20 ? "bg-green-500/15 text-green-600 border-green-500/30" : "bg-orange-500/15 text-orange-600 border-orange-500/30")} variant="outline">
                              {m}%
                            </Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={isLow ? 'destructive' : 'secondary'} className="font-mono">
                            {p.stock ?? 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(p)} className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                              <Pencil size={14} />
                            </Button>
                            {deleteConfirmId === p.id ? (
                              <div className="flex items-center gap-1 bg-destructive/10 px-2 rounded-lg border border-destructive/20 animate-in fade-in">
                                <span className="text-xs font-semibold text-destructive">Sure?</span>
                                <Button variant="default" size="sm" onClick={() => handleDelete(p.id)} className="h-6 px-2 text-[10px] bg-destructive hover:bg-destructive/90">Yes</Button>
                                <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)} className="h-6 px-2 text-[10px]">No</Button>
                              </div>
                            ) : (
                              <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(p.id!)} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 size={14} />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>

          {displayCount < filtered.length && (
            <div className="p-6 border-t flex justify-center bg-muted/5">
              <Button
                variant="outline"
                onClick={() => setDisplayCount(prev => prev + 20)}
                className="gap-2 shadow-sm"
              >
                <Plus size={16} />
                Load More 20 Products
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      {showDialog && createPortal((
        <div
          className="fixed inset-0 z-[999] flex items-start justify-center p-4 sm:p-8 bg-black/5 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => !isSaving && setShowDialog(false)}
        >
          <Card
            className="relative z-[1000] w-full max-w-lg my-auto shadow-xl border bg-card animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit}>
              <CardHeader className="border-b bg-muted/30 pb-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Package size={20} className="text-primary" />
                      {isEditing ? 'Edit Product' : 'Add New Product'}
                    </CardTitle>
                    <CardDescription>
                      {isEditing ? 'Update product details below.' : 'Fill in all details to add to your catalogue.'}
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-full h-8 w-8 text-muted-foreground hover:bg-muted"
                    onClick={() => setShowDialog(false)}
                  >
                    <X size={18} />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 pt-6 max-h-[65vh] overflow-y-auto custom-scrollbar">
                {/* Type Selector */}
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {PRODUCT_TYPES.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        if (isEditing) return; // Prevent changing type while editing to avoid confusion
                        setCurrent((p) => ({ ...p, product_type: t.id, metadata: {} }));
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 p-2 rounded-lg border cursor-pointer transition-colors text-center select-none",
                        current.product_type === t.id
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : isEditing ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50 text-muted-foreground"
                      )}
                    >
                      <span className="text-xl">{t.icon}</span>
                      <span className="text-[10px] font-medium leading-tight">{t.label}</span>
                    </div>
                  ))}
                </div>

                {/* Core Details */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {PRODUCT_TYPES.find(t => t.id === current.product_type)?.icon} Core Details
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-sm font-semibold">Product Name <span className="text-destructive">*</span></label>
                      <Input
                        ref={nameRef}
                        required
                        value={current.name}
                        onChange={(e) => setCurrent((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Enter product name"
                        disabled={isSaving}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">Cost / Purchase Price</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">PKR</span>
                        <Input
                          type="number" min="0" step="1"
                          value={current.purchase_price || ''}
                          onChange={(e) => setCurrent((p) => ({ ...p, purchase_price: parseFloat(e.target.value) || 0 }))}
                          placeholder="0"
                          className="pl-11"
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">Selling Price <span className="text-destructive">*</span></label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">PKR</span>
                        <Input
                          type="number" min="1" step="1" required
                          value={current.price || ''}
                          onChange={(e) => setCurrent((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                          placeholder="0"
                          className="pl-11"
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Profit margin preview */}
                  {current.purchase_price > 0 && current.price > 0 && (
                    <div className={cn("text-xs px-3 py-2 rounded-lg border font-medium",
                      current.price > current.purchase_price
                        ? "bg-green-500/10 border-green-500/20 text-green-600"
                        : "bg-destructive/10 border-destructive/20 text-destructive"
                    )}>
                      {current.price > current.purchase_price
                        ? `✓ Profit margin: ${(((current.price - current.purchase_price) / current.price) * 100).toFixed(1)}%  (PKR ${Math.round(current.price - current.purchase_price).toLocaleString('en-PK')} per unit)`
                        : `⚠ Selling price is BELOW cost price!`
                      }
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">Opening Stock</label>
                      <Input
                        type="number" min="0" step="1"
                        value={current.stock ?? ''}
                        onChange={(e) => setCurrent((p) => ({ ...p, stock: parseInt(e.target.value) || 0 }))}
                        placeholder="0"
                        disabled={isSaving}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">Unit of Measure</label>
                      <select
                        className="w-full h-10 px-3 py-2 text-sm rounded-md border bg-background"
                        value={current.unit || ''}
                        onChange={(e) => setCurrent((p) => ({ ...p, unit: e.target.value }))}
                        disabled={isSaving}
                      >
                        <option value="">— select —</option>
                        {current.product_type === 'food' ? (
                          <><option value="serving">serving</option><option value="piece">piece</option><option value="plate">plate</option><option value="bowl">bowl</option><option value="cup">cup</option></>
                        ) : current.product_type === 'medicine' ? (
                          <><option value="strip">strip</option><option value="bottle">bottle</option><option value="vial">vial</option><option value="box">box</option></>
                        ) : current.product_type === 'grocery' ? (
                          <><option value="kg">kg</option><option value="g">g</option><option value="litre">litre</option><option value="ml">ml</option><option value="pack">pack</option><option value="box">box</option></>
                        ) : current.product_type === 'clothing' ? (
                          <><option value="pcs">pcs</option><option value="set">set</option><option value="dozen">dozen</option></>
                        ) : (
                          <><option value="pcs">pcs</option><option value="kg">kg</option><option value="box">box</option><option value="set">set</option><option value="roll">roll</option><option value="metre">metre</option></>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">Barcode / SKU</label>
                      <Input
                        type="text"
                        value={current.barcode || ''}
                        onChange={(e) => setCurrent((p) => ({ ...p, barcode: e.target.value }))}
                        placeholder="Scan or type"
                        disabled={isSaving}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold">Category (Internal)</label>
                      <Input
                        type="text"
                        value={current.category || ''}
                        onChange={(e) => setCurrent((p) => ({ ...p, category: e.target.value }))}
                        placeholder="e.g. Dry Goods"
                        list="cat-list"
                        disabled={isSaving}
                      />
                      <datalist id="cat-list">
                        {categories.map((c) => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Preferred Supplier (Optional)</label>
                    <select
                      className="w-full h-10 px-3 py-2 text-sm rounded-md border bg-background"
                      value={current.vendor_id || ''}
                      onChange={(e) => setCurrent((p) => ({ ...p, vendor_id: e.target.value ? parseInt(e.target.value) : undefined }))}
                      disabled={isSaving}
                    >
                      <option value="">— None —</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dynamic Type-Specific Sections */}
                {PRODUCT_SCHEMAS[current.product_type || 'general']?.sections?.map((sec: any, idx: number) => (
                  <div key={idx} className="space-y-3 pt-2 border-t border-border/50">
                    <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      {sec.tags ? '🏷 ' : ''}{sec.title}
                    </div>

                    {sec.tags ? (
                      <div className="flex flex-wrap gap-2">
                        {sec.tags.map((tag: string) => {
                          const isSelected = current.metadata?.tags?.includes(tag);
                          return (
                            <div
                              key={tag}
                              onClick={() => {
                                if (isSaving) return;
                                const tags = current.metadata?.tags || [];
                                const newTags = isSelected ? tags.filter((t: string) => t !== tag) : [...tags, tag];
                                setCurrent(p => ({ ...p, metadata: { ...p.metadata, tags: newTags } }));
                              }}
                              className={cn(
                                "px-3 py-1.5 text-xs rounded-full border cursor-pointer select-none transition-colors",
                                isSelected
                                  ? "bg-primary/10 border-primary text-primary font-medium"
                                  : "bg-muted/30 hover:bg-muted text-muted-foreground"
                              )}
                            >
                              {tag}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {sec.fields.map((f: any) => (
                          <div key={f.id} className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-600">{f.label}</label>
                            {f.type === 'select' ? (
                              <>
                                <Input
                                  type="text"
                                  className="h-9 text-sm"
                                  value={current.metadata?.[f.id] || ''}
                                  onChange={(e) => setCurrent(p => ({ ...p, metadata: { ...p.metadata, [f.id]: e.target.value } }))}
                                  placeholder={f.ph || `Select or type ${f.label.toLowerCase()}`}
                                  disabled={isSaving}
                                  list={`opts-${f.id}`}
                                />
                                <datalist id={`opts-${f.id}`}>
                                  {f.opts.map((o: string) => <option key={o} value={o} />)}
                                </datalist>
                              </>
                            ) : (
                              <Input
                                type="text"
                                className="h-9 text-sm"
                                value={current.metadata?.[f.id] || ''}
                                onChange={(e) => setCurrent(p => ({ ...p, metadata: { ...p.metadata, [f.id]: e.target.value } }))}
                                placeholder={f.ph || ''}
                                disabled={isSaving}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>

              <div className="p-5 border-t bg-muted/10 flex gap-3">
                <Button type="button" variant="outline" className="w-full" onClick={() => setShowDialog(false)} disabled={isSaving}>Cancel</Button>
                <Button type="submit" className="w-full" disabled={isSaving}>
                  {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Product'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ), document.body)}

      {/* ===== Analytics Section ===== */}
      <div className="flex items-center justify-between mt-2">
        <h2 className="text-xl font-bold flex items-center gap-2"><BarChart2 size={20} className="text-primary" /> Product Analytics</h2>
        <Button variant="ghost" size="sm" onClick={() => setShowAnalytics(v => !v)} className="gap-2">
          {showAnalytics ? 'Hide' : 'Show'} Analytics
        </Button>
      </div>

      {showAnalytics && analytics.length > 0 && (() => {
        const totalStockValue = analytics.reduce((s, a) => s + (a.stock_value || 0), 0);
        const totalRetailValue = analytics.reduce((s, a) => s + (a.retail_value || 0), 0);
        const totalProfit = analytics.reduce((s, a) => s + (a.total_profit || 0), 0);
        const topProfitable = [...analytics].sort((a, b) => b.total_profit - a.total_profit).slice(0, 5);
        const slowMovers = analytics.filter(a => a.total_sold === 0 || a.total_sold === null);
        const outOfStock = analytics.filter(a => (a.stock ?? 0) === 0);
        // Category breakdown
        const catMap: Record<string, { value: number; retail: number; count: number }> = {};
        analytics.forEach(a => {
          const cat = a.category || 'Uncategorized';
          if (!catMap[cat]) catMap[cat] = { value: 0, retail: 0, count: 0 };
          catMap[cat].value += a.stock_value || 0;
          catMap[cat].retail += a.retail_value || 0;
          catMap[cat].count += 1;
        });
        const categories = Object.entries(catMap).sort((a, b) => b[1].value - a[1].value);

        return (
          <div className="flex flex-col gap-6">
            {/* Summary strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Stock Cost', value: fmtPKR(totalStockValue), color: 'text-cyan-600', bg: 'bg-cyan-500/10', icon: Layers },
                { label: 'Total Retail Value', value: fmtPKR(totalRetailValue), color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: TrendingUp },
                { label: 'Potential Profit', value: fmtPKR(totalRetailValue - totalStockValue), color: 'text-green-600', bg: 'bg-green-500/10', icon: TrendingUp },
                { label: 'Realised Profit', value: fmtPKR(totalProfit), color: 'text-primary', bg: 'bg-primary/10', icon: BarChart2 },
              ].map((c, i) => (
                <Card key={i} className="border-border/50 shadow-sm">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs text-muted-foreground uppercase font-medium">{c.label}</CardTitle>
                    <div className={`p-2 rounded-lg ${c.bg}`}><c.icon className={`h-4 w-4 ${c.color}`} /></div>
                  </CardHeader>
                  <CardContent><div className={`text-xl font-bold ${c.color}`}>{c.value}</div></CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Most Profitable */}
              <Card className="shadow-sm">
                <CardHeader className="border-b bg-green-500/5 pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
                    <TrendingUp size={16} /> Most Profitable Products
                  </CardTitle>
                  <CardDescription>Based on total profit earned from sales</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto custom-scrollbar">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Sold</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                        <TableHead className="text-right pr-4">Profit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProfitable.map((p: any) => {
                        const mg = p.price > 0 ? (((p.price - p.purchase_price) / p.price) * 100).toFixed(0) : null;
                        return (
                          <TableRow key={p.id} className="hover:bg-muted/40">
                            <TableCell className="font-semibold text-sm">{p.name}</TableCell>
                            <TableCell className="text-right"><Badge variant="secondary" className="font-mono text-xs">{p.total_sold || 0}</Badge></TableCell>
                            <TableCell className="text-right">
                              {mg ? <Badge variant="outline" className="font-mono text-xs text-green-600 border-green-400/40 bg-green-500/10">{mg}%</Badge> : '—'}
                            </TableCell>
                            <TableCell className="text-right pr-4 font-bold text-green-600">{fmtPKR(p.total_profit || 0)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Slow Movers / Out of Stock */}
              <div className="flex flex-col gap-4">
                <Card className="shadow-sm">
                  <CardHeader className="border-b bg-orange-500/5 pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-orange-600">
                      <TrendingDown size={16} /> Slow Movers (Never Sold)
                    </CardTitle>
                    <CardDescription>{slowMovers.length} products with zero sales</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 max-h-48 overflow-y-auto">
                    {slowMovers.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground text-sm">Great! All products have been sold.</div>
                    ) : (
                      <Table>
                        <TableBody>
                          {slowMovers.map((p: any) => (
                            <TableRow key={p.id} className="hover:bg-muted/40">
                              <TableCell className="font-semibold text-sm">{p.name}</TableCell>
                              <TableCell className="text-right text-muted-foreground text-xs">{p.category || '—'}</TableCell>
                              <TableCell className="text-right"><Badge variant="secondary" className="font-mono text-xs">Stock: {p.stock}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {outOfStock.length > 0 && (
                  <Card className="shadow-sm border-destructive/20">
                    <CardHeader className="border-b bg-destructive/5 pb-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                        <AlertCircle size={16} /> Out of Stock ({outOfStock.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3 flex flex-wrap gap-2">
                      {outOfStock.map((p: any) => (
                        <Badge key={p.id} variant="destructive" className="font-normal">{p.name}</Badge>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Category Breakdown */}
            {categories.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="border-b pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Tag size={16} /> Stock Value by Category</CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto custom-scrollbar">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Products</TableHead>
                        <TableHead className="text-right">Cost Value</TableHead>
                        <TableHead className="text-right pr-4">Retail Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map(([cat, data]) => (
                        <TableRow key={cat} className="hover:bg-muted/40">
                          <TableCell><Badge variant="secondary" className="font-mono">{cat}</Badge></TableCell>
                          <TableCell className="text-right text-muted-foreground">{data.count}</TableCell>
                          <TableCell className="text-right font-semibold text-cyan-600">{fmtPKR(data.value)}</TableCell>
                          <TableCell className="text-right pr-4 font-bold text-emerald-600">{fmtPKR(data.retail)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })()}
    </div>
  );
}
