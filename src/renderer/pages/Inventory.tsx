import React, { useState, useEffect, useMemo } from 'react';
import { Package, TrendingUp, Search, RefreshCw, FolderTree, ArrowRight, X, Calendar, Truck, AlertTriangle, ArrowUpDown, PlusCircle, MinusCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
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
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton, SearchSpinner } from '../components/Pagination';

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  stock?: number;
}

const fmtPKR = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-PK');

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(10);
  const [sortBy, setSortBy] = useState<'name' | 'stockAsc' | 'stockDesc'>('name');

  // Stock details state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [adjustmentsLoading, setAdjustmentsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'batches' | 'history'>('batches');

  // Adjustment state
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [adjustmentQty, setAdjustmentQty] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('Wastage');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);

  const { addNotification } = useNotifications();

  useEffect(() => { load(); }, []);

  const load = async (isManual = false) => {
    setLoading(true);
    try {
      const [prodRes, batchRes, settingsRes] = await Promise.all([
        window.api.getProducts(),
        window.api.getInventoryBatches(),
        window.api.getSettings()
      ]);

      if (settingsRes?.success && settingsRes.data?.low_stock_threshold) {
        setThreshold(settingsRes.data.low_stock_threshold);
      }

      if (prodRes?.success) {
        setProducts(prodRes.data as any[]);
        if (isManual) addNotification("Refreshed", "Inventory catalogue re-synced.", "success");
      }
    }
    catch {
      if (isManual) addNotification("Error", "Could not load inventory.", "error");
    } finally {
      setLoading(false);
    }
  };

  const openProduct = async (p: Product) => {
    setSelectedProduct(p);
    setBatchesLoading(true);
    setAdjustmentsLoading(true);
    setActiveTab('batches');
    try {
      const [batchRes, adjRes] = await Promise.all([
        window.api.getInventoryBatches(p.id),
        window.api.getStockAdjustments(p.id)
      ]);
      if (batchRes.success) setBatches(batchRes.data);
      if (adjRes.success) setAdjustments(adjRes.data);
    } catch (err) {
      console.error(err);
    }
    setBatchesLoading(false);
    setAdjustmentsLoading(false);
  };

  const handleAdjustmentSubmit = async () => {
    if (!selectedProduct || !adjustmentQty || isNaN(Number(adjustmentQty)) || Number(adjustmentQty) === 0) {
      addNotification("Warning", "Please enter a valid quantity", "warning");
      return;
    }

    setIsSubmittingAdjustment(true);
    try {
      // If adjustmentType is Wastage/Theft, quantity should be negative
      const qty = (adjustmentType === 'Wastage' || adjustmentType === 'Theft')
        ? -Math.abs(Number(adjustmentQty))
        : Number(adjustmentQty);

      const res = await window.api.createStockAdjustment({
        product_id: selectedProduct.id,
        quantity: qty,
        type: adjustmentType,
        reason: adjustmentReason
      });

      if (res.success) {
        addNotification("Success", "Stock adjusted successfully", "success");
        setAdjustmentModalOpen(false);
        setAdjustmentQty('');
        setAdjustmentReason('');
        load();
        if (selectedProduct) {
          const [batchRes, adjRes] = await Promise.all([
            window.api.getInventoryBatches(selectedProduct.id),
            window.api.getStockAdjustments(selectedProduct.id)
          ]);
          if (batchRes.success) setBatches(batchRes.data);
          if (adjRes.success) setAdjustments(adjRes.data);
        }
      } else {
        addNotification("Error", res.error || "Failed to adjust stock", "error");
      }
    } catch (err) {
      addNotification("Error", "Critical error adjusting stock", "error");
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  let sortedProducts = [...products];
  if (sortBy === 'name') sortedProducts.sort((a, b) => a.name.localeCompare(b.name));
  if (sortBy === 'stockAsc') sortedProducts.sort((a, b) => (a.stock || 0) - (b.stock || 0));
  if (sortBy === 'stockDesc') sortedProducts.sort((a, b) => (b.stock || 0) - (a.stock || 0));

  const handleSearch = (v: string) => {
    setIsSearching(true);
    setSearchTerm(v);
    setTimeout(() => setIsSearching(false), 250);
  };

  const filtered = useMemo(() => sortedProducts.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  ), [sortedProducts, searchTerm]);

  // Paginate search results
  const { visible: visibleFiltered, hasMore: hasMoreFiltered, loadMore: loadMoreFiltered, total: filteredTotal, showing: filteredShowing } = usePagination(filtered, 10, 1);

  // First prepare the category data
  const categories = [...new Set(sortedProducts.map((p) => p.category).filter(Boolean))];
  const byCategory = categories.map((cat) => ({
    name: cat,
    items: sortedProducts.filter((p) => p.category === cat),
  }));
  const uncategorized = sortedProducts.filter((p) => !p.category);
  if (uncategorized.length) byCategory.push({ name: 'Uncategorized', items: uncategorized });

  // Then paginate the prepared category data
  const { visible: visibleCategories, hasMore: hasMoreCat, loadMore: loadMoreCat, total: catTotal, showing: catShowing } = usePagination(byCategory, 4, 1);

  // Paginate batches for the selected product
  const { visible: visibleBatches, hasMore: hasMoreBatches, loadMore: loadMoreBatches, total: batchesTotal, showing: batchesShowing } = usePagination(batches, 10, 1);

  const lowStockItems = sortedProducts.filter(p => (p.stock || 0) < threshold);

  return (
    <div className="flex gap-6 animate-in fade-in max-w-[1600px] h-full relative">
      <div className={`flex-1 transition-all duration-300 ${selectedProduct ? 'hidden md:flex md:w-1/2 lg:w-2/3' : 'w-full'}`}>
        <div className="flex flex-col gap-6 w-full pb-20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Inventory Stock</h1>
              <p className="text-muted-foreground text-sm mt-1">Track actual product quantities and stock batches</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => load(true)} className="gap-2 h-9 shadow-sm" disabled={loading}>
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh Inventory
              </Button>
            </div>
          </div>

          {lowStockItems.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-4">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-600 dark:text-red-400">Low Stock Alert ({lowStockItems.length} items)</h3>
                <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                  The following items have fallen below your low stock threshold ({threshold} units):
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {lowStockItems.slice(0, 15).map(p => (
                    <Badge key={p.id} variant="outline" className="border-red-500/30 bg-background/50 text-red-600">
                      {p.name}: <span className="font-bold ml-1">{p.stock || 0}</span>
                    </Badge>
                  ))}
                  {lowStockItems.length > 15 && <Badge variant="outline" className="border-red-500/30">+{lowStockItems.length - 15} more</Badge>}
                </div>
              </div>
            </div>
          )}

          <Card className="shadow-sm border-none bg-transparent">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
                <Input
                  type="text"
                  placeholder="Search products by name or category..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 pr-9 h-11 text-base shadow-sm bg-card w-full"
                />
                <SearchSpinner visible={isSearching} />
              </div>
              <div className="shrink-0 flex items-center bg-card rounded-md border border-input h-11 px-1 shadow-sm">
                <ArrowUpDown size={15} className="text-muted-foreground ml-3 mr-1" />
                <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                  <SelectTrigger className="w-[180px] border-none shadow-none focus:ring-0 h-9">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Sort by Name (A-Z)</SelectItem>
                    <SelectItem value="stockAsc">Lowest Stock First</SelectItem>
                    <SelectItem value="stockDesc">Highest Stock First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {searchTerm ? (
              <Card className="overflow-hidden shadow-md">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-1/2">Product Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right pr-6">Selling Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                            No products found matching "{searchTerm}".
                          </TableCell>
                        </TableRow>
                      ) : visibleFiltered.map((p) => (
                        <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => openProduct(p)}>
                          <TableCell className="font-semibold">{p.name}</TableCell>
                          <TableCell>
                            {p.category ? <Badge variant="secondary" className="font-mono text-[10px] uppercase">{p.category}</Badge> : <span className="text-muted-foreground">â€”</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={p.stock !== undefined && p.stock >= threshold ? 'outline' : 'destructive'}>{p.stock || 0}</Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6 font-semibold text-primary">{fmtPKR(p.price)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-6">
                  {visibleCategories.map((group) => (
                    <Card key={group.name} className="overflow-hidden shadow-sm border-border/60 hover:border-border transition-colors">
                      <CardHeader className="px-5 py-4 bg-muted/20 border-b flex flex-row items-center justify-between">
                        <CardTitle className="text-[15px] font-bold text-foreground flex items-center gap-2">
                          <FolderTree size={16} className="text-muted-foreground" />
                          {group.name}
                        </CardTitle>
                        <Badge variant="outline" className="bg-background">{group.items.length} items</Badge>
                      </CardHeader>
                      <CardContent className="p-5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                          {group.items.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => openProduct(p)}
                              className={`group flex flex-col justify-between border rounded-xl p-4 transition-all cursor-pointer ${selectedProduct?.id === p.id ? 'border-primary ring-1 ring-primary/30 bg-primary/5' : 'bg-card border-border hover:bg-muted/30 hover:border-primary/30'}`}
                            >
                              <p className="font-semibold text-sm line-clamp-2 text-foreground/90 group-hover:text-primary transition-colors">{p.name}</p>
                              <div className="mt-3 pt-3 border-t border-border/50 flex flex-col gap-1">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Price</span>
                                  <span className="text-primary font-bold text-sm tracking-tight">{fmtPKR(p.price)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Stock</span>
                                  <Badge variant={p.stock !== undefined && p.stock >= threshold ? 'outline' : 'destructive'} className="text-[10px] h-4 py-0 px-1">{p.stock || 0}</Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <LoadMoreButton hasMore={hasMoreCat} onLoadMore={loadMoreCat} showing={catShowing} total={catTotal} />
              </>
            )}
          </Card>
        </div>
      </div>

      {/* Stock Batches Drawer */}
      {selectedProduct && (
        <Card className="flex flex-col w-full md:w-1/2 lg:w-1/3 absolute md:relative right-0 h-[calc(100vh-100px)] shadow-2xl border-l md:border-l-0 z-10 bg-background/95 backdrop-blur-md animate-in slide-in-from-right-8">
          <CardHeader className="border-b bg-muted/20 pb-4 relative">
            <Button variant="ghost" size="icon" className="absolute right-4 top-4 rounded-full" onClick={() => setSelectedProduct(null)}>
              <X size={18} />
            </Button>
            <CardTitle className="text-xl font-bold pr-10">{selectedProduct.name}</CardTitle>
            <CardDescription>Detailed inventory batch history (FIFO).</CardDescription>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-0">
            <div className="flex flex-col h-full">
              <div className="grid grid-cols-2 gap-4 p-5 bg-card border-b shrink-0">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Current Stock</span>
                  <span className="text-2xl font-bold text-foreground">{selectedProduct.stock || 0} units</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Selling Price</span>
                  <span className="text-2xl font-bold text-primary">{fmtPKR(selectedProduct.price)}</span>
                </div>
                <div className="col-span-2 pt-4 border-t">
                  <Button
                    className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => {
                      setAdjustmentType('Wastage');
                      setAdjustmentQty('');
                      setAdjustmentReason('');
                      setAdjustmentModalOpen(true);
                    }}
                  >
                    <AlertTriangle size={16} /> Adjust / Fix Stock
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b bg-muted/10 shrink-0">
                <button
                  onClick={() => setActiveTab('batches')}
                  className={cn("flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2", activeTab === 'batches' ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground hover:text-foreground")}
                >
                  Available Batches ({batches.length})
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={cn("flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2", activeTab === 'history' ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground hover:text-foreground")}
                >
                  Audit History ({adjustments.length})
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {activeTab === 'batches' ? (
                  batchesLoading ? (
                    <div className="p-8 text-center text-muted-foreground animate-pulse">Loading batches...</div>
                  ) : (
                    <div className="p-5 pb-20">
                      <h4 className="text-sm font-bold mb-4 flex items-center gap-2"><Package size={16} /> Available Batches</h4>
                      <div className="flex flex-col gap-4">
                        {batches.length === 0 ? (
                          <div className="text-sm text-muted-foreground p-4 text-center border rounded-lg border-dashed">No stock available for this product.</div>
                        ) : (
                          visibleBatches.map((b, i) => (
                            <div key={b.id} className="bg-card border rounded-lg p-4 shadow-sm relative overflow-hidden">
                              {i === 0 && batchesShowing === 10 && <div className="absolute right-0 top-0 bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-bl-lg">NEXT TO SELL (FIFO)</div>}
                              <div className="flex justify-between items-start mb-2 mt-1">
                                <span className="font-bold text-sm text-foreground">Stock: {b.quantity_remaining} units</span>
                                <Badge variant="outline" className="font-mono">{fmtPKR(b.purchase_price)} / unit</Badge>
                              </div>
                              <div className="flex flex-col gap-1 text-xs text-muted-foreground mt-3">
                                <div className="flex items-center gap-2"><Calendar size={12} /> Added: {new Date(b.date_added).toLocaleDateString()}</div>
                                {b.vendor_name && <div className="flex items-center gap-2"><Truck size={12} /> Vendor: {b.vendor_name}</div>}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      {hasMoreBatches && (
                        <div className="mt-6">
                          <LoadMoreButton
                            hasMore={hasMoreBatches}
                            onLoadMore={loadMoreBatches}
                            showing={batchesShowing}
                            total={batchesTotal}
                          />
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  adjustmentsLoading ? (
                    <div className="p-8 text-center text-muted-foreground animate-pulse">Loading history...</div>
                  ) : (
                    <div className="p-5 pb-20 space-y-4">
                      {adjustments.length === 0 ? (
                        <div className="text-sm text-muted-foreground p-8 text-center border rounded-lg border-dashed">No adjustment history found.</div>
                      ) : (
                        adjustments.map((adj) => (
                          <div key={adj.id} className="relative pl-4 border-l-2 border-muted hover:border-primary/40 transition-colors">
                            <div className={cn("absolute -left-[5px] top-1 h-2 w-2 rounded-full", adj.quantity < 0 ? "bg-red-500" : "bg-blue-500")} />
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-bold">{adj.type}</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(adj.date_created).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={cn("text-sm font-black", adj.quantity < 0 ? "text-red-600" : "text-blue-600")}>
                                {adj.quantity > 0 ? '+' : ''}{adj.quantity} units
                              </span>
                            </div>
                            {adj.reason && (
                              <div className="bg-muted/30 rounded-md p-2 text-xs italic text-muted-foreground">
                                "{adj.reason}"
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Adjustment Modal */}
      {adjustmentModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <Card className="w-full max-w-md shadow-2xl border-none overflow-hidden animate-in zoom-in-95 duration-300">
            <CardHeader className="bg-amber-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <AlertTriangle size={24} /> Stock Adjustment
                  </CardTitle>
                  <CardDescription className="text-amber-50/70">
                    {selectedProduct.name}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10" onClick={() => setAdjustmentModalOpen(false)}>
                  <X size={20} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Adjustment Type</label>
                  <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                    <SelectTrigger className="w-full border-amber-200">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Wastage">📉 Wastage / Damage (-)</SelectItem>
                      <SelectItem value="Theft">🚨 Theft / Loss (-)</SelectItem>
                      <SelectItem value="Correction">🔧 Manual Correction (+/-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Quantity</label>
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="0"
                      className="pl-10 h-12 text-lg font-bold border-amber-200"
                      value={adjustmentQty}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        setAdjustmentQty(raw);
                      }}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600">
                      {(adjustmentType === 'Wastage' || adjustmentType === 'Theft') ? <MinusCircle size={20} /> : <PlusCircle size={20} />}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Info size={10} />
                    {adjustmentType === 'Wastage' || adjustmentType === 'Theft'
                      ? "This quantity will be subtracted from total stock."
                      : "Positive for addition, negative for subtraction."}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Reason / Note</label>
                  <Input
                    placeholder="e.g. Expired on shelf, Found broken..."
                    className="bg-muted/20 border-amber-100"
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button variant="outline" className="flex-1" onClick={() => setAdjustmentModalOpen(false)}>Cancel</Button>
                <Button
                  className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleAdjustmentSubmit}
                  disabled={isSubmittingAdjustment || !adjustmentQty}
                >
                  {isSubmittingAdjustment ? <RefreshCw className="animate-spin" size={16} /> : <AlertTriangle size={16} />}
                  Confirm Adjustment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


