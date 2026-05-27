import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, TrendingUp, Search, RefreshCw, FolderTree, ArrowRight, X,
  Calendar, Truck, AlertTriangle, ArrowUpDown, PlusCircle, MinusCircle,
  Info, Boxes, ChevronDown, ChevronRight, BarChart3, Layers,
  TrendingDown, ShieldCheck, History, Warehouse
} from 'lucide-react';
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
} from '../components/ui/select';
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

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.23, 1, 0.32, 1] }
  }),
};

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
        if (isManual) addNotification('Refreshed', 'Inventory catalogue re-synced.', 'success');
      }
    } catch {
      if (isManual) addNotification('Error', 'Could not load inventory.', 'error');
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
      addNotification('Warning', 'Please enter a valid quantity', 'warning');
      return;
    }

    setIsSubmittingAdjustment(true);
    try {
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
        addNotification('Success', 'Stock adjusted successfully', 'success');
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
        addNotification('Error', res.error || 'Failed to adjust stock', 'error');
      }
    } catch (err) {
      addNotification('Error', 'Critical error adjusting stock', 'error');
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

  const { visible: visibleFiltered, hasMore: hasMoreFiltered, loadMore: loadMoreFiltered, total: filteredTotal, showing: filteredShowing } = usePagination(filtered, 10, 1);

  const categories = [...new Set(sortedProducts.map((p) => p.category).filter(Boolean))];
  const byCategory = categories.map((cat) => ({
    name: cat,
    items: sortedProducts.filter((p) => p.category === cat),
  }));
  const uncategorized = sortedProducts.filter((p) => !p.category);
  if (uncategorized.length) byCategory.push({ name: 'Uncategorized', items: uncategorized });

  const { visible: visibleCategories, hasMore: hasMoreCat, loadMore: loadMoreCat, total: catTotal, showing: catShowing } = usePagination(byCategory, 4, 1);

  const { visible: visibleBatches, hasMore: hasMoreBatches, loadMore: loadMoreBatches, total: batchesTotal, showing: batchesShowing } = usePagination(batches, 10, 1);

  const lowStockItems = sortedProducts.filter(p => (p.stock || 0) < threshold && (p.stock || 0) > 0);
  const outOfStockItems = sortedProducts.filter(p => (p.stock || 0) === 0);

  const damagedCount = useMemo(
    () => adjustments.filter((a) => Number(a.quantity) < 0).length,
    [adjustments]
  );
  const damagedUnits = useMemo(
    () => adjustments.reduce((sum, a) => sum + (Number(a.quantity) < 0 ? Math.abs(Number(a.quantity) || 0) : 0), 0),
    [adjustments]
  );

  return (
    <div className="flex gap-6 max-w-[1600px] h-full relative">
      {/* ── Main Panel ── */}
      <div className={`flex-1 transition-all duration-300 ${selectedProduct ? 'hidden md:flex md:w-1/2 lg:w-2/3' : 'w-full'}`}>
        <div className="flex flex-col gap-6 w-full pb-20">

          {/* ── Hero Header ── */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="relative overflow-hidden rounded-2xl shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 45%, #0c2f50 70%, #0f172a 100%)' }}
          >
            <div className="pointer-events-none absolute -top-14 -right-14 w-64 h-64 rounded-full bg-cyan-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-blue-500/10 blur-2xl" />
            <div className="relative z-10 p-7">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="bg-cyan-500/20 border border-cyan-400/30 rounded-2xl w-14 h-14 flex items-center justify-center shadow-lg backdrop-blur-sm flex-shrink-0">
                      <Boxes size={26} className="text-cyan-300" />
                    </div>
                    <div>
                      <p className="text-cyan-300/80 text-xs font-semibold uppercase tracking-widest mb-0.5">Stock Management</p>
                      <h1 className="text-white text-2xl sm:text-3xl font-bold tracking-tight">Inventory Stock</h1>
                    </div>
                  </div>
                  <p className="text-white/50 text-sm mb-3 ml-0.5">Track actual product quantities and stock batches</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-white/80 text-sm font-medium backdrop-blur-sm">
                      <Package size={13} className="text-cyan-300" />
                      {products.length} Products
                    </div>
                    {lowStockItems.length > 0 && (
                      <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-white/80 text-sm font-medium backdrop-blur-sm">
                        <AlertTriangle size={13} className="text-amber-300" />
                        {lowStockItems.length} Low Stock
                      </div>
                    )}
                    {outOfStockItems.length > 0 && (
                      <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-white/80 text-sm font-medium backdrop-blur-sm">
                        <TrendingDown size={13} className="text-red-300" />
                        {outOfStockItems.length} Out of Stock
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => load(true)}
                  disabled={loading}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-5 py-2.5 text-white text-sm font-semibold backdrop-blur-sm transition-all duration-200 disabled:opacity-50"
                >
                  <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>
          </motion.div>

          {/* ── KPI Strip ── */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
            className="grid grid-cols-3 gap-4"
          >
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Warehouse size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Products</p>
                <p className="text-2xl font-bold text-foreground">{products.length}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200/40 bg-card shadow-sm p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Low Stock</p>
                <p className="text-2xl font-bold text-amber-600">{lowStockItems.length}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-red-200/40 bg-card shadow-sm p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <TrendingDown size={20} className="text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">{outOfStockItems.length}</p>
              </div>
            </div>
          </motion.div>

          {/* ── Low Stock Alert Banner ── */}
          <AnimatePresence>
            {lowStockItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 flex items-start gap-4 shadow-sm"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle size={18} className="text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                    Low Stock Alert — {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} below threshold ({threshold} units)
                  </h3>
                  <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1 mb-3">
                    The following products need restocking soon.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {lowStockItems.slice(0, 15).map(p => (
                      <Badge
                        key={p.id}
                        variant="outline"
                        className="border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 cursor-pointer hover:border-amber-400 transition-colors"
                        onClick={() => openProduct(p)}
                      >
                        {p.name}: <span className="font-bold ml-1">{p.stock || 0}</span>
                      </Badge>
                    ))}
                    {lowStockItems.length > 15 && (
                      <Badge variant="outline" className="border-amber-400/40 text-amber-600">+{lowStockItems.length - 15} more</Badge>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Search & Sort ── */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-border/40 bg-muted/20 flex items-center gap-2">
              <BarChart3 size={15} className="text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Browse Inventory</span>
            </div>
            <div className="p-5">
              <div className="flex flex-col md:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    type="text"
                    placeholder="Search products by name or category..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10 pr-9 h-11 text-base shadow-sm bg-background w-full rounded-xl border-border/60"
                  />
                  <SearchSpinner visible={isSearching} />
                </div>
                <div className="shrink-0 flex items-center bg-background rounded-xl border border-border/60 h-11 px-2 shadow-sm">
                  <ArrowUpDown size={14} className="text-muted-foreground ml-2 mr-1" />
                  <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                    <SelectTrigger className="w-[190px] border-none shadow-none focus:ring-0 h-9">
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

              {/* ── Search Results ── */}
              {searchTerm ? (
                <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm">
                  {/* Header */}
                  <div className="px-5 py-3 bg-muted/30 border-b border-border/40 grid grid-cols-12 gap-4">
                    <span className="col-span-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product Name</span>
                    <span className="col-span-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</span>
                    <span className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Stock</span>
                    <span className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Price</span>
                  </div>
                  {filtered.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground text-sm">
                      No products found matching "{searchTerm}".
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {visibleFiltered.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => openProduct(p)}
                          className={cn(
                            'grid grid-cols-12 gap-4 px-5 py-3.5 cursor-pointer transition-colors hover:bg-muted/30',
                            selectedProduct?.id === p.id && 'bg-primary/5 border-l-2 border-l-primary'
                          )}
                        >
                          <span className="col-span-5 font-semibold text-sm text-foreground truncate">{p.name}</span>
                          <span className="col-span-3">
                            {p.category
                              ? <Badge variant="secondary" className="font-mono text-[10px] uppercase">{p.category}</Badge>
                              : <span className="text-muted-foreground text-sm">—</span>
                            }
                          </span>
                          <span className="col-span-2 text-right">
                            <Badge
                              variant={(p.stock || 0) === 0 ? 'destructive' : (p.stock || 0) < threshold ? 'outline' : 'outline'}
                              className={cn(
                                'text-[10px]',
                                (p.stock || 0) === 0 && 'border-red-500/50 bg-red-500/10 text-red-600',
                                (p.stock || 0) > 0 && (p.stock || 0) < threshold && 'border-amber-500/50 bg-amber-500/10 text-amber-600',
                                (p.stock || 0) >= threshold && 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600'
                              )}
                            >
                              {p.stock || 0}
                            </Badge>
                          </span>
                          <span className="col-span-2 text-right font-semibold text-primary text-sm">{fmtPKR(p.price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {hasMoreFiltered && (
                    <div className="p-4 border-t border-border/40">
                      <LoadMoreButton hasMore={hasMoreFiltered} onLoadMore={loadMoreFiltered} showing={filteredShowing} total={filteredTotal} />
                    </div>
                  )}
                </div>
              ) : (
                /* ── Category Groups ── */
                <>
                  <div className="space-y-4">
                    {visibleCategories.map((group, gi) => (
                      <motion.div
                        key={group.name}
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        custom={gi}
                        className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden hover:border-border transition-colors"
                      >
                        {/* Category header */}
                        <div className="px-5 py-4 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                              <FolderTree size={14} className="text-primary" />
                            </div>
                            <span className="text-[15px] font-bold text-foreground">{group.name}</span>
                          </div>
                          <Badge variant="outline" className="bg-background border-border/60 text-muted-foreground text-xs">
                            {group.items.length} items
                          </Badge>
                        </div>

                        {/* Product grid */}
                        <div className="p-5">
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {group.items.map((p) => {
                              const stockQty = p.stock || 0;
                              const isOut = stockQty === 0;
                              const isLow = !isOut && stockQty < threshold;
                              const isGood = stockQty >= threshold;
                              return (
                                <div
                                  key={p.id}
                                  onClick={() => openProduct(p)}
                                  className={cn(
                                    'group flex flex-col justify-between border rounded-xl p-4 transition-all cursor-pointer',
                                    selectedProduct?.id === p.id
                                      ? 'border-primary ring-1 ring-primary/30 bg-primary/5'
                                      : 'bg-card border-border/60 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5'
                                  )}
                                >
                                  <p className="font-semibold text-sm line-clamp-2 text-foreground/90 group-hover:text-primary transition-colors leading-snug">
                                    {p.name}
                                  </p>
                                  <div className="mt-3 pt-3 border-t border-border/40 flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center">
                                      <span className="text-[11px] text-muted-foreground">Price</span>
                                      <span className="text-primary font-bold text-sm tracking-tight">{fmtPKR(p.price)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-[11px] text-muted-foreground">Stock</span>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          'text-[10px] h-4 py-0 px-1.5',
                                          isOut && 'border-red-500/40 bg-red-500/10 text-red-600',
                                          isLow && 'border-amber-500/40 bg-amber-500/10 text-amber-600',
                                          isGood && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                                        )}
                                      >
                                        {stockQty}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <div className="mt-6">
                    <LoadMoreButton hasMore={hasMoreCat} onLoadMore={loadMoreCat} showing={catShowing} total={catTotal} />
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Stock Detail Drawer ── */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 32 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-col w-full md:w-1/2 lg:w-1/3 absolute md:relative right-0 h-[calc(100vh-100px)] rounded-2xl border border-border/50 shadow-2xl z-10 bg-background/95 backdrop-blur-md overflow-hidden"
          >
            {/* Drawer header */}
            <div
              className="relative p-5 pb-4 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0f172a 100%)' }}
            >
              <div className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 rounded-full bg-cyan-500/10 blur-2xl" />
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute right-4 top-4 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X size={15} className="text-white" />
              </button>
              <div className="flex items-start gap-3 pr-8">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Package size={17} className="text-cyan-300" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-white font-bold text-base leading-snug line-clamp-2">{selectedProduct.name}</h2>
                  <p className="text-white/50 text-xs mt-0.5">Inventory batch history (FIFO)</p>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-0 border-b border-border/40 flex-shrink-0">
              <div className="p-4 border-r border-border/40">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Current Stock</p>
                <p className="text-2xl font-bold text-foreground">{selectedProduct.stock || 0}</p>
                <p className="text-xs text-muted-foreground">units</p>
              </div>
              <div className="p-4">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Selling Price</p>
                <p className="text-xl font-bold text-primary">{fmtPKR(selectedProduct.price)}</p>
              </div>
            </div>

            {/* Damaged row */}
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between bg-rose-500/5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <TrendingDown size={14} className="text-rose-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Returned / Damaged</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-none text-[10px]">{damagedCount} entries</Badge>
                <Badge className="bg-rose-600 text-white border-none text-[10px]">-{damagedUnits} units</Badge>
              </div>
            </div>

            {/* Adjust button */}
            <div className="px-4 py-3 border-b border-border/40 flex-shrink-0">
              <Button
                className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white h-9 rounded-xl text-sm font-semibold"
                onClick={() => {
                  setAdjustmentType('Wastage');
                  setAdjustmentQty('');
                  setAdjustmentReason('');
                  setAdjustmentModalOpen(true);
                }}
              >
                <AlertTriangle size={15} /> Adjust / Fix Stock
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border/40 bg-muted/10 flex-shrink-0">
              <button
                onClick={() => setActiveTab('batches')}
                className={cn(
                  'flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5',
                  activeTab === 'batches'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-background'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Layers size={12} /> Batches ({batches.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={cn(
                  'flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5',
                  activeTab === 'history'
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-background'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <History size={12} /> History ({adjustments.length})
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'batches' ? (
                batchesLoading ? (
                  <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">Loading batches...</div>
                ) : (
                  <div className="p-4 pb-20 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Package size={14} className="text-muted-foreground" />
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Available Batches</span>
                    </div>
                    {batches.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-10 text-center border border-dashed border-border/60 rounded-xl">
                        No stock available for this product.
                      </div>
                    ) : (
                      visibleBatches.map((b, i) => (
                        <div key={b.id} className="rounded-xl border border-border/50 bg-card p-4 shadow-sm relative overflow-hidden hover:border-border transition-colors">
                          {i === 0 && (
                            <div className="absolute right-0 top-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold px-2.5 py-1 rounded-bl-lg border-l border-b border-emerald-500/20">
                              NEXT (FIFO)
                            </div>
                          )}
                          <div className="flex justify-between items-start mb-3 mt-0.5 pr-16">
                            <span className="font-bold text-sm text-foreground">{b.quantity_remaining} units</span>
                            <Badge variant="outline" className="font-mono text-[11px] border-border/60">{fmtPKR(b.purchase_price)}/unit</Badge>
                          </div>
                          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar size={11} className="flex-shrink-0" />
                              Added: {new Date(b.date_added).toLocaleDateString()}
                            </div>
                            {b.vendor_name && (
                              <div className="flex items-center gap-2">
                                <Truck size={11} className="flex-shrink-0" />
                                Vendor: {b.vendor_name}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {hasMoreBatches && (
                      <div className="mt-4">
                        <LoadMoreButton hasMore={hasMoreBatches} onLoadMore={loadMoreBatches} showing={batchesShowing} total={batchesTotal} />
                      </div>
                    )}
                  </div>
                )
              ) : (
                adjustmentsLoading ? (
                  <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">Loading history...</div>
                ) : (
                  <div className="p-4 pb-20 space-y-3">
                    {adjustments.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-10 text-center border border-dashed border-border/60 rounded-xl">
                        No adjustment history found.
                      </div>
                    ) : (
                      adjustments.map((adj) => (
                        <div
                          key={adj.id}
                          className={cn(
                            'relative pl-4 border-l-2 transition-colors rounded-r-lg pr-3 py-2',
                            adj.quantity < 0 ? 'border-red-400 hover:border-red-500' : 'border-blue-400 hover:border-blue-500'
                          )}
                        >
                          <div className={cn(
                            'absolute -left-[5px] top-3 h-2.5 w-2.5 rounded-full border-2 border-background',
                            adj.quantity < 0 ? 'bg-red-500' : 'bg-blue-500'
                          )} />
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-foreground">{adj.type}</span>
                            <span className="text-[10px] text-muted-foreground">{new Date(adj.date_created).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={cn('text-sm font-black', adj.quantity < 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400')}>
                              {adj.quantity > 0 ? '+' : ''}{adj.quantity} units
                            </span>
                            {adj.quantity < 0 && (
                              <Badge className="bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-none text-[9px] h-4">
                                Returned / Damaged
                              </Badge>
                            )}
                          </div>
                          {adj.reason && (
                            <div className="bg-muted/40 rounded-lg px-2.5 py-1.5 text-xs italic text-muted-foreground">
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Adjustment Modal ── */}
      <AnimatePresence>
        {adjustmentModalOpen && selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="w-full max-w-md rounded-2xl border border-border/50 shadow-2xl overflow-hidden bg-background"
            >
              {/* Modal header */}
              <div
                className="relative p-6 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #92400e 0%, #b45309 50%, #78350f 100%)' }}
              >
                <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-300/10 blur-2xl" />
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                        <AlertTriangle size={18} className="text-amber-200" />
                      </div>
                      <h2 className="text-xl font-bold text-white">Stock Adjustment</h2>
                    </div>
                    <p className="text-amber-200/70 text-sm ml-12">{selectedProduct.name}</p>
                  </div>
                  <button
                    onClick={() => setAdjustmentModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <X size={16} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Modal body */}
              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Adjustment Type</label>
                  <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                    <SelectTrigger className="w-full border-amber-200/60 rounded-xl h-11">
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
                  <label className="text-sm font-semibold text-foreground">Quantity</label>
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="0"
                      className="pl-11 h-12 text-lg font-bold border-amber-200/60 rounded-xl"
                      value={adjustmentQty}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (adjustmentType === 'Correction') {
                          if (/^-?\d*$/.test(raw)) setAdjustmentQty(raw);
                        } else {
                          setAdjustmentQty(raw.replace(/[^0-9]/g, ''));
                        }
                      }}
                    />
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-600">
                      {(adjustmentType === 'Wastage' || adjustmentType === 'Theft') ? <MinusCircle size={20} /> : <PlusCircle size={20} />}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Info size={11} />
                    {adjustmentType === 'Wastage' || adjustmentType === 'Theft'
                      ? 'This quantity will be subtracted from total stock.'
                      : 'Use +number to add stock or -number to reduce stock.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Reason / Note</label>
                  <Input
                    placeholder="e.g. Expired on shelf, Found broken..."
                    className="rounded-xl border-amber-100/60 bg-muted/20 h-11"
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 pt-2 border-t border-border/40">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl h-11"
                    onClick={() => setAdjustmentModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-11 font-semibold"
                    onClick={handleAdjustmentSubmit}
                    disabled={isSubmittingAdjustment || !adjustmentQty}
                  >
                    {isSubmittingAdjustment
                      ? <RefreshCw className="animate-spin" size={15} />
                      : <ShieldCheck size={15} />
                    }
                    Confirm Adjustment
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
