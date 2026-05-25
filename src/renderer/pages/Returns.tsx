import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw, ShoppingCart, Package, ChevronDown, ChevronUp,
  RefreshCw, Calendar, Search, X, Loader2, AlertCircle,
  ArrowLeftRight, TrendingDown, FileText, User, Building2,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import { useNotifications } from '../components/NotificationProvider';
import dayjs from 'dayjs';

/* ─── Types ─────────────────────────────────────────────── */
interface SaleReturn {
  id: number;
  sale_id: number;
  total_returned: number;
  reason: string;
  notes: string;
  date_created: string;
  original_total: number;
  customer_name: string;
}

interface PurchaseReturn {
  id: number;
  purchase_id: number;
  total_returned: number;
  reason: string;
  notes: string;
  date_created: string;
  original_total: number;
  vendor_name: string;
}

interface SaleReturnItem {
  id: number;
  return_id: number;
  sale_item_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
}

interface PurchaseReturnItem {
  id: number;
  return_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  purchase_price: number;
}

/* ─── Helpers ────────────────────────────────────────────── */
const fmtPKR = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-PK');
const fmtDate = (d: string) => dayjs(d).format('DD MMM YYYY, h:mm A');

const DATE_FILTERS = [
  { key: 'today',   label: 'Today' },
  { key: 'weekly',  label: 'This Week' },
  { key: 'monthly', label: 'This Month' },
  { key: 'custom',  label: 'Custom' },
] as const;

type DateFilter = 'today' | 'weekly' | 'monthly' | 'custom';

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 },
  }),
};

/* ─── Stat Card ──────────────────────────────────────────── */
function StatCard({
  icon: Icon, label, value, sub, color, delay = 0,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  color: string; delay?: number;
}) {
  return (
    <motion.div variants={fadeUp} custom={delay} initial="hidden" animate="show">
      <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
        <CardContent className="p-4 flex items-center gap-4">
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-xl font-bold text-foreground leading-tight truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Expandable Row (Sales Returns) ─────────────────────── */
function SaleReturnRow({ ret }: { ret: SaleReturn }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<SaleReturnItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const toggle = async () => {
    if (!expanded && items.length === 0) {
      setLoadingItems(true);
      try {
        const res = await window.api.getSaleReturnItems(ret.id);
        if (res?.success) setItems(res.data ?? []);
      } catch { /* ignore */ }
      finally { setLoadingItems(false); }
    }
    setExpanded(p => !p);
  };

  const returnPct = ret.original_total > 0
    ? ((ret.total_returned / ret.original_total) * 100).toFixed(1)
    : '0';

  return (
    <>
      <tr
        className="border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={toggle}
      >
        <td className="px-4 py-3 text-sm font-medium text-foreground">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono text-xs">#{ret.sale_id}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-foreground">
          <div className="flex items-center gap-1.5">
            <User size={13} className="text-muted-foreground" />
            {ret.customer_name || <span className="text-muted-foreground italic">Walk-in</span>}
          </div>
        </td>
        <td className="px-4 py-3 text-sm">
          <span className="font-semibold text-rose-600 dark:text-rose-400">
            {fmtPKR(ret.total_returned)}
          </span>
          <span className="text-xs text-muted-foreground ml-1.5">({returnPct}%)</span>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground max-w-[180px]">
          <span className="truncate block">
            {ret.reason || <em className="text-muted-foreground/60">—</em>}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
          {fmtDate(ret.date_created)}
        </td>
        <td className="px-4 py-3 text-right">
          {loadingItems
            ? <Loader2 size={14} className="animate-spin text-muted-foreground inline" />
            : expanded
              ? <ChevronUp size={15} className="text-muted-foreground inline" />
              : <ChevronDown size={15} className="text-muted-foreground inline" />
          }
        </td>
      </tr>

      <AnimatePresence>
        {expanded && (
          <motion.tr
            key="items"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <td colSpan={6} className="px-0 py-0">
              <div className="bg-muted/20 border-b border-border/40 px-6 py-3">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">No items found.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th className="text-left font-medium pb-1.5 pr-4">Product</th>
                        <th className="text-right font-medium pb-1.5 pr-4">Qty</th>
                        <th className="text-right font-medium pb-1.5">Unit Price</th>
                        <th className="text-right font-medium pb-1.5">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.id} className="border-t border-border/20">
                          <td className="py-1.5 pr-4 text-foreground">{item.product_name}</td>
                          <td className="py-1.5 pr-4 text-right text-muted-foreground">{item.quantity}</td>
                          <td className="py-1.5 text-right text-muted-foreground">{fmtPKR(item.price)}</td>
                          <td className="py-1.5 text-right font-medium text-rose-600 dark:text-rose-400">
                            {fmtPKR(item.price * item.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {ret.notes && (
                  <p className="text-xs text-muted-foreground mt-2 border-t border-border/20 pt-2">
                    <span className="font-medium">Notes:</span> {ret.notes}
                  </p>
                )}
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Expandable Row (Purchase Returns) ─────────────────── */
function PurchaseReturnRow({ ret }: { ret: PurchaseReturn }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<PurchaseReturnItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const toggle = async () => {
    if (!expanded && items.length === 0) {
      setLoadingItems(true);
      try {
        const res = await window.api.getPurchaseReturnItems(ret.id);
        if (res?.success) setItems(res.data ?? []);
      } catch { /* ignore */ }
      finally { setLoadingItems(false); }
    }
    setExpanded(p => !p);
  };

  const returnPct = ret.original_total > 0
    ? ((ret.total_returned / ret.original_total) * 100).toFixed(1)
    : '0';

  return (
    <>
      <tr
        className="border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={toggle}
      >
        <td className="px-4 py-3 text-sm font-medium text-foreground">
          <span className="text-muted-foreground font-mono text-xs">#{ret.purchase_id}</span>
        </td>
        <td className="px-4 py-3 text-sm text-foreground">
          <div className="flex items-center gap-1.5">
            <Building2 size={13} className="text-muted-foreground" />
            {ret.vendor_name || <span className="text-muted-foreground italic">Unknown</span>}
          </div>
        </td>
        <td className="px-4 py-3 text-sm">
          <span className="font-semibold text-amber-600 dark:text-amber-400">
            {fmtPKR(ret.total_returned)}
          </span>
          <span className="text-xs text-muted-foreground ml-1.5">({returnPct}%)</span>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground max-w-[180px]">
          <span className="truncate block">
            {ret.reason || <em className="text-muted-foreground/60">—</em>}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
          {fmtDate(ret.date_created)}
        </td>
        <td className="px-4 py-3 text-right">
          {loadingItems
            ? <Loader2 size={14} className="animate-spin text-muted-foreground inline" />
            : expanded
              ? <ChevronUp size={15} className="text-muted-foreground inline" />
              : <ChevronDown size={15} className="text-muted-foreground inline" />
          }
        </td>
      </tr>

      <AnimatePresence>
        {expanded && (
          <motion.tr
            key="items"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <td colSpan={6} className="px-0 py-0">
              <div className="bg-muted/20 border-b border-border/40 px-6 py-3">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">No items found.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th className="text-left font-medium pb-1.5 pr-4">Product</th>
                        <th className="text-right font-medium pb-1.5 pr-4">Qty</th>
                        <th className="text-right font-medium pb-1.5">Unit Cost</th>
                        <th className="text-right font-medium pb-1.5">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.id} className="border-t border-border/20">
                          <td className="py-1.5 pr-4 text-foreground">{item.product_name}</td>
                          <td className="py-1.5 pr-4 text-right text-muted-foreground">{item.quantity}</td>
                          <td className="py-1.5 text-right text-muted-foreground">{fmtPKR(item.purchase_price)}</td>
                          <td className="py-1.5 text-right font-medium text-amber-600 dark:text-amber-400">
                            {fmtPKR(item.purchase_price * item.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {ret.notes && (
                  <p className="text-xs text-muted-foreground mt-2 border-t border-border/20 pt-2">
                    <span className="font-medium">Notes:</span> {ret.notes}
                  </p>
                )}
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function Returns() {
  const { addNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState<'sales' | 'purchases'>('sales');

  // Shared filters
  const [dateFilter, setDateFilter] = useState<DateFilter>('monthly');
  const [fromDate, setFromDate]     = useState('');
  const [toDate, setToDate]         = useState('');
  const [search, setSearch]         = useState('');

  // Data
  const [saleReturns, setSaleReturns]         = useState<SaleReturn[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState('');

  /* ─ Fetch ─ */
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const opts: any = { dateFilter };
      if (dateFilter === 'custom' && fromDate && toDate) {
        opts.fromDate = fromDate;
        opts.toDate   = toDate;
      }

      const [sRes, pRes] = await Promise.all([
        window.api.getSaleReturns(opts),
        window.api.getPurchaseReturns(opts),
      ]);

      if (sRes?.success)  setSaleReturns(sRes.data ?? []);
      if (pRes?.success)  setPurchaseReturns(pRes.data ?? []);
    } catch {
      setError('Failed to load returns. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [dateFilter, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  /* ─ Derived stats ─ */
  const saleTotalAmt    = saleReturns.reduce((s, r) => s + r.total_returned, 0);
  const purchaseTotalAmt = purchaseReturns.reduce((s, r) => s + r.total_returned, 0);

  /* ─ Search filter ─ */
  const filteredSaleReturns = saleReturns.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(r.sale_id).includes(q) ||
      (r.customer_name || '').toLowerCase().includes(q) ||
      (r.reason || '').toLowerCase().includes(q)
    );
  });

  const filteredPurchaseReturns = purchaseReturns.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(r.purchase_id).includes(q) ||
      (r.vendor_name || '').toLowerCase().includes(q) ||
      (r.reason || '').toLowerCase().includes(q)
    );
  });

  const activeReturns = activeTab === 'sales' ? filteredSaleReturns : filteredPurchaseReturns;
  const emptyMessage  = activeTab === 'sales'
    ? 'No sales returns found for this period.'
    : 'No purchase returns found for this period.';

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-full">

      {/* ── Header ── */}
      <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <ArrowLeftRight size={18} className="text-rose-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Returns</h1>
              <p className="text-xs text-muted-foreground">Track sales & purchase returns</p>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="self-start sm:self-auto">
          <RefreshCw size={14} className={cn('mr-1.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </motion.div>

      {/* ── Date Filters ── */}
      <motion.div variants={fadeUp} custom={1} initial="hidden" animate="show"
        className="flex flex-wrap items-center gap-2"
      >
        {DATE_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setDateFilter(f.key)}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all',
              dateFilter === f.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
            )}
          >
            {f.label}
          </button>
        ))}

        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <Calendar size={14} className="text-muted-foreground" />
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="h-8 text-sm w-36" />
            <span className="text-muted-foreground text-sm">–</span>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="h-8 text-sm w-36" />
          </div>
        )}
      </motion.div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={ShoppingCart}
          label="Sales Returns"
          value={String(saleReturns.length)}
          sub={`${fmtPKR(saleTotalAmt)} refunded`}
          color="bg-rose-500/10 border border-rose-500/20 text-rose-500"
          delay={0}
        />
        <StatCard
          icon={Package}
          label="Purchase Returns"
          value={String(purchaseReturns.length)}
          sub={`${fmtPKR(purchaseTotalAmt)} recovered`}
          color="bg-amber-500/10 border border-amber-500/20 text-amber-500"
          delay={1}
        />
        <StatCard
          icon={TrendingDown}
          label="Total Sales Refunded"
          value={fmtPKR(saleTotalAmt)}
          sub={`${saleReturns.length} transaction${saleReturns.length !== 1 ? 's' : ''}`}
          color="bg-violet-500/10 border border-violet-500/20 text-violet-500"
          delay={2}
        />
        <StatCard
          icon={RotateCcw}
          label="Total Purchase Recovered"
          value={fmtPKR(purchaseTotalAmt)}
          sub={`${purchaseReturns.length} transaction${purchaseReturns.length !== 1 ? 's' : ''}`}
          color="bg-cyan-500/10 border border-cyan-500/20 text-cyan-500"
          delay={3}
        />
      </div>

      {/* ── Tabs + Table ── */}
      <motion.div variants={fadeUp} custom={4} initial="hidden" animate="show">
        <Card className="border-border/60">
          {/* Tab bar + search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pt-4 pb-0 border-b border-border/40">
            <div className="flex gap-0">
              {[
                { key: 'sales',     label: 'Sales Returns',    count: saleReturns.length },
                { key: 'purchases', label: 'Purchase Returns', count: purchaseReturns.length },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key as any); setSearch(''); }}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px',
                    activeTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.key === 'sales'
                    ? <ShoppingCart size={14} />
                    : <Package size={14} />}
                  {tab.label}
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full font-mono',
                    activeTab === tab.key
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative mb-3 sm:mb-0">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={activeTab === 'sales' ? 'Search by sale ID, customer…' : 'Search by purchase ID, vendor…'}
                className="pl-8 h-8 text-sm w-60"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 m-4 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading returns…</span>
            </div>
          ) : activeReturns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                <FileText size={22} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
              <p className="text-xs text-muted-foreground/60">
                {search ? 'Try clearing your search filter.' : 'Try changing the date range.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    {activeTab === 'sales' ? (
                      <>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sale #</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Returned</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reason</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Purchase #</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Returned</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reason</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="wait">
                    {activeTab === 'sales'
                      ? filteredSaleReturns.map(ret => (
                          <SaleReturnRow key={ret.id} ret={ret} />
                        ))
                      : filteredPurchaseReturns.map(ret => (
                          <PurchaseReturnRow key={ret.id} ret={ret} />
                        ))
                    }
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}

          {/* Footer count */}
          {!loading && activeReturns.length > 0 && (
            <div className="px-5 py-3 border-t border-border/30 text-xs text-muted-foreground">
              Showing {activeReturns.length} {activeTab === 'sales' ? 'sale' : 'purchase'} return{activeReturns.length !== 1 ? 's' : ''}
              {search && ` matching "${search}"`}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
