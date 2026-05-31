import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import {
  Plus, Pencil, Trash2, Search, Package, Tag, Layers, BarChart2,
  TrendingUp, TrendingDown, AlertCircle, X, Upload, Download,
  FileSpreadsheet, CheckCircle2, ChevronDown, Boxes, ShoppingCart,
  Loader2, Wallet, CreditCard, Archive,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import { useNotifications } from '../components/NotificationProvider';
import { PRODUCT_TYPES, PRODUCT_SCHEMAS } from '../lib/productSchemas';
import { useModules } from '../contexts/ModulesContext';

interface Product {
  id?: number;
  name: string;
  price: number;
  purchase_price: number;
  stock: number;
  category: string;
  barcode?: string;
  unit?: string;
  product_type?: string;
  vendor_id?: number;
  purchase_status?: 'available' | 'to_order';
  metadata?: any;
  is_bakery?: number;
  production_date?: string;
  expiry_date?: string;
  weight_value?: number;
  unit_type?: string;
  price_per_kg?: number;
  auto_price_by_weight?: number;
  stock_source?: 'opening_balance' | 'purchased' | 'unknown'; // accounting tracking
}

interface ImportRow {
  name: string;
  purchase_price: number;
  price: number;
  stock: number;
  category: string;
  barcode: string;
  unit: string;
  product_type: string;
  _valid: boolean;
  _errors: string[];
}

const empty: Product = {
  name: '', price: 0, purchase_price: 0, stock: 0,
  category: '', barcode: '', unit: '', product_type: 'general', metadata: {},
  is_bakery: 0, production_date: '', expiry_date: '',
  weight_value: undefined, unit_type: 'piece', price_per_kg: undefined, auto_price_by_weight: 0,
  vendor_id: undefined, purchase_status: 'available',
};

const fmtPKR = (n: number) => 'PKR ' + Math.round(n ?? 0).toLocaleString('en-PK');

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.4, delay: i * 0.055, ease: [0.23, 1, 0.32, 1] }
  }),
};

/* ─── ProductFormModal ───────────────────────────────────────────────────────
   Isolated component so keystrokes only re-render this modal, not the full
   Products page with its large product table and useMemo computations.
──────────────────────────────────────────────────────────────────────────── */
interface ProductFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  initialProduct: Product;
  vendors: any[];
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}

function ProductFormModal({ isOpen, isEditing, initialProduct, vendors, categories, onClose, onSaved }: ProductFormModalProps) {
  const { addNotification } = useNotifications();
  const { modules } = useModules();
  const [current, setCurrent] = useState<Product>(initialProduct);
  const [isSaving, setIsSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // ── Stock accounting state (new-product only, accounting module) ──────────
  const [stockSource,   setStockSource]   = useState<'opening_balance' | 'purchased'>('opening_balance');
  const [stockAcctId,   setStockAcctId]   = useState<number | ''>('');
  const [acctList,      setAcctList]      = useState<{ id: number; name: string; current_balance: number; type: string }[]>([]);

  // Reset form state and auto-focus whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrent({ ...initialProduct });
      setIsSaving(false);
      setStockSource('opening_balance');
      setStockAcctId('');
      const t = setTimeout(() => nameRef.current?.focus(), 100);
      // Load accounts if accounting module is on (for "Just Purchased" option)
      if (modules.accounting && !isEditing) {
        window.api.getAccounts().then((res: any) => {
          if (res?.success && Array.isArray(res.data?.accounts)) setAcctList(res.data.accounts);
        }).catch(() => {});
      }
      return () => clearTimeout(t);
    }
  }, [isOpen]); // intentionally exclude initialProduct — it's captured at open time

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current.name.trim()) {
      addNotification('Validation', 'Product name is required.', 'warning');
      nameRef.current?.focus();
      return;
    }
    const price = Number(current.price);
    if (isNaN(price) || price <= 0) {
      addNotification('Validation', 'Selling price must be a positive number.', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      const openingStock = Number(current.stock) || 0;
      const productData: any = {
        name: current.name.trim(),
        price,
        purchase_price: Number(current.purchase_price) || 0,
        stock: openingStock,
        category: (current.category || '').trim(),
        barcode: (current.barcode || '').trim(),
        unit: (current.unit || '').trim(),
        product_type: current.product_type || 'general',
        metadata: current.metadata || {},
        is_bakery: current.is_bakery || 0,
        production_date: current.production_date || null,
        expiry_date: current.expiry_date || null,
        weight_value: current.weight_value ?? null,
        unit_type: current.unit_type || 'piece',
        price_per_kg: current.price_per_kg ?? null,
        auto_price_by_weight: current.auto_price_by_weight || 0,
        vendor_id: current.vendor_id || null,
        purchase_status: current.purchase_status || 'available',
        stock_source: current.stock_source || 'unknown',
      };

      // ── Stock accounting (add mode only, accounting module ON) ───────────
      if (!isEditing && modules.accounting && openingStock > 0) {
        productData.stock_source = stockSource;
        if (stockSource === 'purchased' && stockAcctId) {
          productData.account_id = stockAcctId;
        }
      }

      const res = isEditing && current.id
        ? await window.api.updateProduct(current.id, productData)
        : await window.api.addProduct(productData);
      if (res?.success) {
        addNotification('Success', isEditing ? 'Product updated.' : 'Product added.', 'success');
        setTimeout(() => { onClose(); onSaved(); }, 200);
      } else throw new Error(res?.error || 'Failed to save product');
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={() => !isSaving && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-lg my-auto bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          {/* Dialog Header */}
          <div
            className="relative p-6 border-b"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a3a5c 100%)' }}
          >
            <div className="pointer-events-none absolute top-0 right-0 w-32 h-32 rounded-full bg-blue-500/10 blur-2xl" />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/20 border border-blue-400/30 p-2.5 rounded-xl">
                  <Package size={19} className="text-blue-300" />
                </div>
                <div>
                  <h2 className="text-white text-lg font-bold">
                    {isEditing ? 'Edit Product' : 'Add New Product'}
                  </h2>
                  <p className="text-blue-300/70 text-xs mt-0.5">
                    {isEditing ? 'Update product details below.' : 'Fill in details to add to catalogue.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-white/50 hover:text-white/90 transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="space-y-6 pt-6 pb-1 px-6 max-h-[65vh] overflow-y-auto custom-scrollbar">
            {/* Type Selector */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {PRODUCT_TYPES.map(t => (
                <div
                  key={t.id}
                  onClick={() => {
                    if (isEditing) return;
                    setCurrent(p => ({ ...p, product_type: t.id, metadata: {} }));
                  }}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 p-2 rounded-xl border cursor-pointer transition-all duration-150 text-center select-none',
                    current.product_type === t.id
                      ? 'border-primary bg-primary/10 text-primary shadow-sm'
                      : isEditing
                        ? 'opacity-40 cursor-not-allowed border-border/40'
                        : 'hover:bg-muted/60 text-muted-foreground border-border/40'
                  )}
                >
                  <span className="text-xl">{t.icon}</span>
                  <span className="text-[10px] font-medium leading-tight">{t.label}</span>
                </div>
              ))}
            </div>

            {/* Core Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span>{PRODUCT_TYPES.find(t => t.id === current.product_type)?.icon}</span> Core Details
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Product Name <span className="text-destructive">*</span></label>
                <Input
                  ref={nameRef}
                  required
                  value={current.name}
                  onChange={e => setCurrent(p => ({ ...p, name: e.target.value }))}
                  placeholder="Enter product name"
                  disabled={isSaving}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Cost / Purchase Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">PKR</span>
                    <Input
                      type="number" min="0" step="1"
                      value={current.purchase_price || ''}
                      onChange={e => setCurrent(p => ({ ...p, purchase_price: parseFloat(e.target.value) || 0 }))}
                      placeholder="0" className="pl-11" disabled={isSaving}
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
                      onChange={e => setCurrent(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                      placeholder="0" className="pl-11" disabled={isSaving}
                    />
                  </div>
                </div>
              </div>

              {/* Profit preview */}
              {current.purchase_price > 0 && current.price > 0 && (
                <div className={cn(
                  'text-xs px-3 py-2.5 rounded-xl border font-medium',
                  current.price > current.purchase_price
                    ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-600'
                    : 'bg-destructive/8 border-destructive/20 text-destructive'
                )}>
                  {current.price > current.purchase_price
                    ? `✓ Margin: ${(((current.price - current.purchase_price) / current.price) * 100).toFixed(1)}%  — PKR ${Math.round(current.price - current.purchase_price).toLocaleString('en-PK')} profit/unit`
                    : '⚠ Selling price is BELOW cost price!'}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  {/* Label and step change based on bakery weight type */}
                  {(() => {
                    const isWt = current.is_bakery && (current.unit_type === 'kg' || current.unit_type === 'gram');
                    const lbl = isWt ? `Opening Stock (${current.unit_type})` : 'Opening Stock';
                    const stepVal = isWt ? '0.001' : '1';
                    const parseFn = isWt
                      ? (v: string) => parseFloat(v) || 0
                      : (v: string) => parseInt(v) || 0;
                    return (
                      <>
                        <label className="text-sm font-semibold">{lbl}</label>
                        {isWt && (
                          <p className="text-[10px] text-orange-500 font-medium -mt-0.5">
                            Total {current.unit_type} you have right now
                          </p>
                        )}
                        <Input
                          type="number" min="0" step={stepVal}
                          value={current.stock ?? ''}
                          onChange={e => setCurrent(p => ({ ...p, stock: parseFn(e.target.value) }))}
                          placeholder="0" disabled={isSaving}
                        />
                      </>
                    );
                  })()}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Unit of Measure</label>
                  <select
                    className="w-full h-10 px-3 py-2 text-sm rounded-md border bg-background"
                    value={current.unit || ''}
                    onChange={e => setCurrent(p => ({ ...p, unit: e.target.value }))}
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

              {/* ── Stock Accounting Section ── */}
              {modules.accounting && !isEditing && (Number(current.stock) || 0) > 0 && (
                <div className="space-y-3 rounded-xl border border-border/60 bg-muted/25 p-4">

                  {/* Header */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Wallet size={12} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Stock Accounting</p>
                      <p className="text-[10px] text-muted-foreground">
                        How should this opening stock be recorded?
                      </p>
                    </div>
                  </div>

                  {/* Option cards */}
                  <div className="grid grid-cols-2 gap-2">

                    {/* Opening Balance */}
                    <button
                      type="button"
                      onClick={() => setStockSource('opening_balance')}
                      disabled={isSaving}
                      className={cn(
                        'relative text-left p-3 rounded-xl border-2 transition-all focus:outline-none',
                        stockSource === 'opening_balance'
                          ? 'border-primary bg-primary/[0.07]'
                          : 'border-border/50 bg-background hover:bg-muted/40 hover:border-border',
                      )}
                    >
                      {stockSource === 'opening_balance' && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle2 size={10} className="text-primary-foreground" strokeWidth={3} />
                        </div>
                      )}
                      <Archive
                        size={15}
                        className={cn('mb-2', stockSource === 'opening_balance' ? 'text-primary' : 'text-muted-foreground')}
                      />
                      <p className="text-xs font-bold text-foreground leading-none">Opening Balance</p>
                      <p className="text-[10px] text-muted-foreground leading-snug mt-1">
                        Stock existed before this software. No cash account affected.
                      </p>
                    </button>

                    {/* Just Purchased */}
                    <button
                      type="button"
                      onClick={() => setStockSource('purchased')}
                      disabled={isSaving}
                      className={cn(
                        'relative text-left p-3 rounded-xl border-2 transition-all focus:outline-none',
                        stockSource === 'purchased'
                          ? 'border-emerald-500 bg-emerald-500/[0.07]'
                          : 'border-border/50 bg-background hover:bg-muted/40 hover:border-border',
                      )}
                    >
                      {stockSource === 'purchased' && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                          <CheckCircle2 size={10} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                      <CreditCard
                        size={15}
                        className={cn('mb-2', stockSource === 'purchased' ? 'text-emerald-500' : 'text-muted-foreground')}
                      />
                      <p className="text-xs font-bold text-foreground leading-none">Just Purchased</p>
                      <p className="text-[10px] text-muted-foreground leading-snug mt-1">
                        Bought now. Deduct cost from an account.
                      </p>
                    </button>
                  </div>

                  {/* Account selector + cost (purchased only) */}
                  {stockSource === 'purchased' && (
                    <div className="space-y-2.5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">Pay From Account</label>
                        <select
                          value={stockAcctId}
                          onChange={e => setStockAcctId(e.target.value ? Number(e.target.value) : '')}
                          disabled={isSaving}
                          className="w-full h-9 px-3 py-2 text-sm rounded-lg border border-border/60 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                        >
                          <option value="">— select account —</option>
                          {acctList.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.name} (Rs. {Math.round(a.current_balance).toLocaleString()})
                            </option>
                          ))}
                        </select>
                        {acctList.length === 0 && (
                          <p className="text-[10px] text-amber-500 dark:text-amber-400">
                            No accounts found — add one in the Accounts section first.
                          </p>
                        )}
                      </div>

                      {/* Cost row */}
                      {(Number(current.purchase_price) || 0) > 0 && (Number(current.stock) || 0) > 0 && (
                        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background px-3 py-2.5">
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground">Cost to deduct</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                              {Number(current.stock)} × Rs.{Number(current.purchase_price).toLocaleString()}
                            </p>
                          </div>
                          <p className="text-sm font-black text-foreground">
                            Rs. {Math.round((Number(current.purchase_price) || 0) * (Number(current.stock) || 0)).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tip */}
                  {stockSource === 'opening_balance' && (
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      💡 For initial setup. Future stock arrivals use the <strong className="text-foreground/80">Purchases</strong> module.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Barcode / SKU</label>
                  <Input
                    type="text" value={current.barcode || ''}
                    onChange={e => setCurrent(p => ({ ...p, barcode: e.target.value }))}
                    placeholder="Scan or type" disabled={isSaving} className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Category</label>
                  <Input
                    type="text" value={current.category || ''}
                    onChange={e => setCurrent(p => ({ ...p, category: e.target.value }))}
                    placeholder="e.g. Dry Goods" list="cat-list" disabled={isSaving}
                  />
                  <datalist id="cat-list">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Preferred Supplier (Optional)</label>
                <select
                  className="w-full h-10 px-3 py-2 text-sm rounded-md border bg-background"
                  value={current.vendor_id || ''}
                  onChange={e => setCurrent(p => ({ ...p, vendor_id: e.target.value ? parseInt(e.target.value) : undefined }))}
                  disabled={isSaving}
                >
                  <option value="">— None —</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>

            {/* Dynamic Type Sections */}
            {PRODUCT_SCHEMAS[current.product_type || 'general']?.sections?.map((sec: any, idx: number) => (
              <div key={idx} className="space-y-3 pt-2 border-t border-border/40">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
                            'px-3 py-1.5 text-xs rounded-full border cursor-pointer select-none transition-colors',
                            isSelected
                              ? 'bg-primary/10 border-primary text-primary font-medium'
                              : 'bg-muted/30 hover:bg-muted text-muted-foreground'
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
                        <label className="text-xs font-semibold text-muted-foreground">{f.label}</label>
                        {f.type === 'select' ? (
                          <>
                            <Input
                              type="text" className="h-9 text-sm"
                              value={current.metadata?.[f.id] || ''}
                              onChange={e => setCurrent(p => ({ ...p, metadata: { ...p.metadata, [f.id]: e.target.value } }))}
                              placeholder={f.ph || `Select or type ${f.label.toLowerCase()}`}
                              disabled={isSaving} list={`opts-${f.id}`}
                            />
                            <datalist id={`opts-${f.id}`}>
                              {f.opts.map((o: string) => <option key={o} value={o} />)}
                            </datalist>
                          </>
                        ) : (
                          <Input
                            type="text" className="h-9 text-sm"
                            value={current.metadata?.[f.id] || ''}
                            onChange={e => setCurrent(p => ({ ...p, metadata: { ...p.metadata, [f.id]: e.target.value } }))}
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

            {/* ── Bakery Module Section ── */}
            {modules.bakery && (
              <div className="space-y-3 pt-2 border-t border-orange-500/20">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
                    🧁 Bakery Details
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrent(p => ({ ...p, is_bakery: p.is_bakery ? 0 : 1 }))}
                    className={cn(
                      'flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all',
                      current.is_bakery
                        ? 'bg-orange-500/10 border-orange-500/40 text-orange-600'
                        : 'bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <span className={cn('w-8 h-4 rounded-full relative transition-colors inline-block', current.is_bakery ? 'bg-orange-500' : 'bg-muted-foreground/30')}>
                      <span className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all', current.is_bakery ? 'right-0.5' : 'left-0.5')} />
                    </span>
                    Bakery Product
                  </button>
                </div>

                {current.is_bakery ? (
                  <div className="space-y-3 bg-orange-500/5 border border-orange-500/15 rounded-xl p-3">
                    {/* Production & Expiry Dates */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Production Date</label>
                        <Input
                          type="date"
                          value={current.production_date || ''}
                          onChange={e => setCurrent(p => ({ ...p, production_date: e.target.value }))}
                          disabled={isSaving}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Expiry Date</label>
                        <Input
                          type="date"
                          value={current.expiry_date || ''}
                          onChange={e => setCurrent(p => ({ ...p, expiry_date: e.target.value }))}
                          disabled={isSaving}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>

                    {/* Unit Type (first — drives labels below) */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Unit Type</label>
                      <select
                        className="w-full h-9 px-3 py-2 text-sm rounded-md border bg-background"
                        value={current.unit_type || 'piece'}
                        onChange={e => setCurrent(p => ({ ...p, unit_type: e.target.value }))}
                        disabled={isSaving}
                      >
                        <option value="kg">kg — sold by kilogram</option>
                        <option value="gram">gram — sold by grams</option>
                        <option value="piece">piece — individual units</option>
                        <option value="tray">tray — full tray units</option>
                      </select>
                    </div>

                    {/* Default Sell Amount + Stock info */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          {(current.unit_type === 'kg' || current.unit_type === 'gram')
                            ? `Default Sell Qty (${current.unit_type})`
                            : 'Weight per Unit (kg)'}
                        </label>
                        <Input
                          type="number" min="0" step="0.001"
                          value={current.weight_value ?? ''}
                          onChange={e => {
                            const w = parseFloat(e.target.value) || undefined;
                            setCurrent(p => ({
                              ...p,
                              weight_value: w,
                              price: (p.auto_price_by_weight && p.price_per_kg && w)
                                ? Math.round(p.price_per_kg * w)
                                : p.price,
                            }));
                          }}
                          placeholder={current.unit_type === 'gram' ? 'e.g. 250' : 'e.g. 0.5'}
                          disabled={isSaving}
                          className="h-9 text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground/60">
                          {(current.unit_type === 'kg' || current.unit_type === 'gram')
                            ? 'Default portion added to cart'
                            : 'For info & auto-pricing'}
                        </p>
                      </div>

                      {/* Total stock info panel */}
                      {(current.unit_type === 'kg' || current.unit_type === 'gram') && (current.stock ?? 0) > 0 && (
                        <div className="flex flex-col justify-center items-center bg-orange-500/8 border border-orange-500/20 rounded-xl p-2.5 text-center">
                          <p className="text-[10px] text-orange-600 font-black uppercase tracking-widest">In Stock</p>
                          <p className="text-lg font-black text-orange-700 dark:text-orange-400 mt-0.5">
                            {current.stock} {current.unit_type}
                          </p>
                          {(current.weight_value ?? 0) > 0 && (
                            <p className="text-[10px] text-orange-500/70 mt-0.5">
                              ≈ {((current.stock ?? 0) / (current.weight_value ?? 1)).toFixed(1)} portions
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Auto-Price by Weight toggle */}
                    <div className="flex items-center justify-between bg-card rounded-lg border border-border/50 p-2.5">
                      <div>
                        <p className="text-xs font-semibold">Auto-Price by Weight</p>
                        <p className="text-[10px] text-muted-foreground">
                          Price at sale = qty × price per {current.unit_type === 'gram' ? '100g' : 'kg'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrent(p => ({ ...p, auto_price_by_weight: p.auto_price_by_weight ? 0 : 1 }))}
                        className={cn('w-10 h-5 rounded-full relative transition-colors shrink-0', current.auto_price_by_weight ? 'bg-orange-500' : 'bg-muted-foreground/30')}
                      >
                        <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all', current.auto_price_by_weight ? 'right-0.5' : 'left-0.5')} />
                      </button>
                    </div>

                    {/* Price per kg / 100g (conditional) */}
                    {!!current.auto_price_by_weight && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Price per {current.unit_type === 'gram' ? '100g' : 'kg'} (PKR)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">PKR</span>
                          <Input
                            type="number" min="0" step="1"
                            value={current.price_per_kg ?? ''}
                            onChange={e => {
                              const ppk = parseFloat(e.target.value) || 0;
                              const w = current.weight_value || 0;
                              setCurrent(p => ({
                                ...p,
                                price_per_kg: ppk,
                                // price = default portion × rate
                                price: (w > 0 && ppk > 0)
                                  ? (current.unit_type === 'gram' ? Math.round(ppk * w / 100) : Math.round(ppk * w))
                                  : p.price,
                              }));
                            }}
                            placeholder="0"
                            className="pl-11 h-9 text-sm"
                            disabled={isSaving}
                          />
                        </div>
                        {/* Live calculation preview */}
                        {(current.price_per_kg ?? 0) > 0 && (
                          <div className="rounded-lg bg-orange-500/8 border border-orange-500/15 p-2.5 space-y-0.5">
                            {(current.weight_value ?? 0) > 0 && (
                              <p className="text-[11px] text-orange-700 dark:text-orange-400 font-bold">
                                Default sell price ({current.weight_value} {current.unit_type}):
                                PKR {(current.unit_type === 'gram'
                                  ? Math.round((current.price_per_kg ?? 0) * (current.weight_value ?? 0) / 100)
                                  : Math.round((current.price_per_kg ?? 0) * (current.weight_value ?? 0))
                                ).toLocaleString('en-PK')}
                              </p>
                            )}
                            <p className="text-[10px] text-orange-600/70">
                              In POS: entering qty changes price automatically
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground/60 italic">
                    Enable to add expiry dates, production date, weight info & auto-pricing.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="p-5 border-t bg-muted/10 flex gap-3">
            <Button type="button" variant="outline" className="w-full" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" className="w-full" disabled={isSaving}>
              {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [initialProduct, setInitialProduct] = useState<Product>(empty);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [displayCount, setDisplayCount] = useState(20);
  const { addNotification } = useNotifications();

  // Excel Import State
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; errors: string[] } | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

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
    try {
      const ar = await window.api.getProductAnalytics();
      if (ar?.success) setAnalytics(ar.data || []);
      const vr = await window.api.getVendors();
      if (vr?.success) setVendors(vr.data || []);
    } catch (_) {}
  };

  const normalizedSearch = searchTerm.toLowerCase();
  const filtered = useMemo(() => products.filter(
    p => p.name.toLowerCase().includes(normalizedSearch) ||
      (p.category || '').toLowerCase().includes(normalizedSearch) ||
      (p.barcode || '').includes(searchTerm)
  ), [products, normalizedSearch, searchTerm]);

  const displayedProducts = filtered.slice(0, displayCount);

  useEffect(() => { setDisplayCount(20); }, [searchTerm]);

  const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))], [products]);
  const lowStockCount = useMemo(() => products.filter(p => (p.stock ?? 0) < 10).length, [products]);

  const openAdd = () => { setInitialProduct({ ...empty }); setIsEditing(false); setShowDialog(true); };
  const openEdit = (p: Product) => { setInitialProduct({ ...p }); setIsEditing(true); setShowDialog(true); };

  const handleTogglePurchaseStatus = async (p: Product) => {
    if (!p.id) return;
    const newStatus = p.purchase_status === 'to_order' ? 'available' : 'to_order';
    const res = await (window.api as any).setProductPurchaseStatus(p.id, newStatus);
    if (res?.success) {
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, purchase_status: newStatus } : x));
      addNotification(
        newStatus === 'to_order' ? 'Marked to Order' : 'Marked Available',
        newStatus === 'to_order' ? `"${p.name}" added to purchase list` : `"${p.name}" removed from purchase list`,
        'success'
      );
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
      } else throw new Error(res?.error || 'Failed to delete');
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
      setDeleteConfirmId(null);
    }
  };

  const margin = (p: Product) => {
    if (!p.purchase_price || p.purchase_price <= 0) return null;
    return (((p.price - p.purchase_price) / p.price) * 100).toFixed(0);
  };

  // ─── Excel Export ────────────────────────────────────────────────────────────
  const exportToExcel = () => {
    if (products.length === 0) {
      addNotification('Nothing to Export', 'No products found.', 'warning');
      return;
    }
    const data = filtered.map(p => ({
      'Name': p.name,
      'Category': p.category || '',
      'Product Type': p.product_type || 'general',
      'Barcode/SKU': p.barcode || '',
      'Unit': p.unit || '',
      'Cost Price (PKR)': p.purchase_price || 0,
      'Selling Price (PKR)': p.price,
      'Stock': p.stock ?? 0,
      'Margin (%)': p.purchase_price > 0
        ? Number((((p.price - p.purchase_price) / p.price) * 100).toFixed(1))
        : '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 10 }, { wch: 18 }, { wch: 20 }, { wch: 10 }, { wch: 12 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addNotification('Exported!', `${filtered.length} products exported to Excel.`, 'success');
  };

  const downloadTemplate = () => {
    const template = [{
      name: 'Sample Product', purchase_price: 100, price: 150,
      stock: 50, category: 'General', barcode: '1234567890',
      unit: 'pcs', product_type: 'general'
    }];
    const ws = XLSX.utils.json_to_sheet(template);
    ws['!cols'] = [
      { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 10 },
      { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import Template');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_import_template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── Excel Import ─────────────────────────────────────────────────────────
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const parsed: ImportRow[] = rows
          .map(row => {
            const errors: string[] = [];
            const name = String(
              row['name'] || row['Name'] || row['product_name'] || row['Product Name'] || ''
            ).trim();
            const price = parseFloat(
              row['price'] || row['Selling Price (PKR)'] || row['selling_price'] || '0'
            ) || 0;
            const purchase_price = parseFloat(
              row['purchase_price'] || row['Cost Price (PKR)'] || row['cost_price'] || '0'
            ) || 0;
            const stock = parseInt(
              row['stock'] || row['Stock'] || row['quantity'] || row['Quantity'] || '0'
            ) || 0;
            const category = String(row['category'] || row['Category'] || '').trim();
            const barcode = String(row['barcode'] || row['Barcode/SKU'] || '').trim();
            const unit = String(row['unit'] || row['Unit'] || '').trim();
            const product_type = String(
              row['product_type'] || row['Product Type'] || 'general'
            ).trim().toLowerCase();

            if (!name) errors.push('Name required');
            if (price <= 0) errors.push('Price must be > 0');

            return { name, price, purchase_price, stock, category, barcode, unit, product_type, _valid: errors.length === 0, _errors: errors };
          })
          .filter(r => r.name !== '');
        setImportRows(parsed);
        setImportProgress(null);
      } catch (_) {
        addNotification('Parse Error', 'Could not read Excel file. Ensure it is a valid .xlsx format.', 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const executeImport = async () => {
    const validRows = importRows.filter(r => r._valid);
    if (validRows.length === 0) return;
    setIsImporting(true);
    setImportProgress({ done: 0, total: validRows.length, errors: [] });
    const errors: string[] = [];
    let done = 0;
    for (const row of validRows) {
      try {
        const existingByBarcode = row.barcode
          ? products.find(p => p.barcode === row.barcode)
          : null;
        const existingByName = products.find(
          p => p.name.toLowerCase() === row.name.toLowerCase()
        );
        const existing = existingByBarcode || existingByName;
        if (existing && existing.id) {
          await window.api.updateProduct(existing.id, {
            stock: (existing.stock ?? 0) + row.stock,
            ...(row.purchase_price > 0 && { purchase_price: row.purchase_price }),
            ...(row.price > 0 && { price: row.price }),
          });
        } else {
          await window.api.addProduct({
            name: row.name, price: row.price, purchase_price: row.purchase_price,
            stock: row.stock, category: row.category, barcode: row.barcode,
            unit: row.unit, product_type: row.product_type || 'general', metadata: {},
          });
        }
        done++;
        setImportProgress({ done, total: validRows.length, errors: [...errors] });
      } catch (err: any) {
        errors.push(`${row.name}: ${err.message}`);
        done++;
        setImportProgress({ done, total: validRows.length, errors: [...errors] });
      }
    }
    setIsImporting(false);
    await load();
    if (errors.length === 0) {
      addNotification('Import Complete!', `${done} products imported successfully.`, 'success');
    } else {
      addNotification('Import Done', `${done - errors.length} imported, ${errors.length} failed.`, 'warning');
    }
  };

  const closeImportDialog = () => {
    if (isImporting) return;
    setShowImportDialog(false);
    setImportRows([]);
    setImportProgress(null);
  };

  // ─── JSX ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 w-full">

      {/* ── Hero Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #0c3050 45%, #1a3a5c 70%, #0f172a 100%)' }}
      >
        <div className="pointer-events-none absolute -top-14 -right-14 w-64 h-64 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-cyan-500/10 blur-2xl" />
        <div className="pointer-events-none absolute top-1/2 left-1/3 -translate-y-1/2 w-80 h-24 bg-sky-600/5 rounded-full blur-3xl" />

        <div className="relative z-10 p-7">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            {/* Left */}
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-blue-500/20 border border-blue-400/30 rounded-2xl w-14 h-14 flex items-center justify-center shadow-lg backdrop-blur-sm flex-shrink-0">
                  <Package size={26} className="text-blue-300" />
                </div>
                <div>
                  <p className="text-blue-300/80 text-xs font-semibold uppercase tracking-widest mb-0.5">
                    Inventory Management
                  </p>
                  <h1 className="text-white text-2xl sm:text-3xl font-bold tracking-tight">
                    Products Catalogue
                  </h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-white/80 text-sm font-medium backdrop-blur-sm">
                  <Boxes size={13} className="text-blue-300" />
                  {products.length} Products
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-white/80 text-sm font-medium backdrop-blur-sm">
                  <Layers size={13} className="text-cyan-300" />
                  {categories.length} Categories
                </div>
                {lowStockCount > 0 && (
                  <div className="flex items-center gap-2 bg-orange-500/20 border border-orange-400/30 rounded-full px-4 py-1.5 text-orange-300 text-sm font-medium backdrop-blur-sm">
                    <AlertCircle size={13} />
                    {lowStockCount} Low Stock
                  </div>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex flex-col xs:flex-row sm:flex-col gap-2 shrink-0">
              <button
                onClick={() => setShowImportDialog(true)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/18 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm font-medium backdrop-blur-sm transition-all duration-200 hover:border-white/30"
              >
                <Upload size={15} className="text-cyan-300" />
                Import Excel
              </button>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/18 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm font-medium backdrop-blur-sm transition-all duration-200 hover:border-white/30"
              >
                <Download size={15} className="text-emerald-300" />
                Export Excel
              </button>
              <button
                onClick={openAdd}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-400 rounded-xl px-5 py-2.5 text-white text-sm font-semibold shadow-lg shadow-blue-500/30 transition-all duration-200"
              >
                <Plus size={15} />
                Add Product
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Products', value: products.length,
            icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20',
          },
          {
            label: 'Categories', value: categories.length,
            icon: Layers, color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20',
          },
          {
            label: 'Total Stock', value: products.reduce((s, p) => s + (p.stock ?? 0), 0).toLocaleString(),
            icon: BarChart2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
          },
          {
            label: 'Low Stock', value: lowStockCount,
            icon: Tag,
            color: lowStockCount > 0 ? 'text-orange-500' : 'text-muted-foreground',
            bg: lowStockCount > 0 ? 'bg-orange-500/10' : 'bg-muted/20',
            border: lowStockCount > 0 ? 'border-orange-500/30' : 'border-border/30',
          },
        ].map(({ label, value, icon: Icon, color, bg, border }, i) => (
          <motion.div key={label} variants={fadeUp} initial="hidden" animate="visible" custom={i + 1}>
            <Card className={cn('border overflow-hidden', border)}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                  <div className={cn('p-2 rounded-xl', bg)}>
                    <Icon className={cn('w-4 h-4', color)} />
                  </div>
                </div>
                <p className={cn('text-2xl font-bold tracking-tight', color)}>{value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Products Table ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
        <Card className="shadow-sm border-border/60">
          <CardHeader className="p-5 border-b bg-muted/10">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                <Input
                  placeholder="Search by name, category, barcode..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 bg-muted/30"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground shrink-0">
                <span className="font-semibold text-foreground">{displayedProducts.length}</span>
                {' '}of{' '}
                <span className="font-semibold text-foreground">{filtered.length}</span>
                {' '}products
              </p>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/25 hover:bg-muted/25">
                  <TableHead className="pl-5">Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right pr-5">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-36 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                        <span className="text-sm">Loading products...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayedProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-40 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="bg-muted/40 p-4 rounded-2xl">
                          <Package size={28} className="opacity-40" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {searchTerm ? 'No matching products' : 'No products yet'}
                          </p>
                          <p className="text-xs mt-0.5 opacity-70">
                            {searchTerm ? 'Try adjusting your search' : 'Click "Add Product" or import an Excel file'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  Object.entries(
                    displayedProducts.reduce((acc: Record<string, Product[]>, p) => {
                      const cat = p.category || (p.product_type
                        ? p.product_type.charAt(0).toUpperCase() + p.product_type.slice(1)
                        : 'Uncategorized');
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(p);
                      return acc;
                    }, {})
                  ).map(([cat, prods]) => (
                    <React.Fragment key={cat}>
                      {/* Category Row */}
                      <TableRow className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-y border-primary/10 hover:bg-gradient-to-r hover:from-primary/8">
                        <TableCell colSpan={8} className="py-2.5 pl-5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-1 h-4 rounded-full bg-primary/50" />
                            <span className="font-bold text-primary/70 uppercase tracking-wider text-[11px]">{cat}</span>
                            <Badge variant="outline" className="text-[10px] border-primary/20 text-primary/50 font-mono h-5 px-1.5">
                              {prods.length}
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Product Rows */}
                      {prods.map(p => {
                        const m = margin(p);
                        const isLow = (p.stock ?? 0) < 10;
                        const specEntries = p.metadata
                          ? Object.entries(p.metadata).filter(([k, v]) => k !== 'tags' && v).map(([k, v]) => `${k.replace('_', ' ')}: ${v}`)
                          : [];
                        const specTags = p.metadata?.tags && Array.isArray(p.metadata.tags) ? p.metadata.tags : [];
                        const specStr = [...specEntries, ...specTags].join(' • ');

                        return (
                          <TableRow key={p.id} className="hover:bg-muted/30 transition-colors group">
                            <TableCell className="pl-5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <div className="font-semibold text-sm">{p.name}</div>
                                {p.purchase_status === 'to_order' && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0">
                                    <ShoppingCart size={9} /> To Order
                                  </span>
                                )}
                                {/* Stock source badge (accounting module) */}
                                {(p as any).stock_source === 'opening_balance' && (p.stock ?? 0) > 0 && (
                                  <span title="Opening balance stock — no purchase recorded" className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 shrink-0">
                                    <Archive size={8} /> OB
                                  </span>
                                )}
                                {(p as any).stock_source === 'purchased' && (
                                  <span title="Opening stock was recorded as a purchase" className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100/60 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 shrink-0">
                                    <CreditCard size={8} /> Paid
                                  </span>
                                )}
                              </div>
                              {p.barcode && (
                                <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{p.barcode}</div>
                              )}
                              {specStr && (
                                <div className="text-[10px] text-muted-foreground truncate max-w-[200px] mt-0.5 capitalize" title={specStr}>
                                  {specStr}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {p.category
                                ? <Badge variant="secondary" className="font-mono text-xs">{p.category}</Badge>
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              {p.unit
                                ? <Badge variant="outline" className="font-mono text-xs text-blue-600 border-blue-400/40">{p.unit}</Badge>
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground font-mono text-sm">
                              {p.purchase_price > 0 ? fmtPKR(p.purchase_price) : '—'}
                            </TableCell>
                            <TableCell className="text-right font-bold text-primary font-mono text-sm">
                              {fmtPKR(p.price)}
                            </TableCell>
                            <TableCell className="text-right">
                              {m ? (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'font-mono text-xs',
                                    Number(m) >= 20
                                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
                                      : 'bg-orange-500/10 text-orange-600 border-orange-500/25'
                                  )}
                                >
                                  {m}%
                                </Badge>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={isLow ? 'destructive' : 'secondary'}
                                className={cn('font-mono text-xs', !isLow && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20')}
                              >
                                {p.stock ?? 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right pr-5">
                              <div className="flex justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                {/* Mark to Order toggle */}
                                <Button
                                  variant="ghost" size="icon"
                                  title={p.purchase_status === 'to_order' ? 'Remove from order list' : 'Mark as "To Order"'}
                                  onClick={() => handleTogglePurchaseStatus(p)}
                                  className={cn(
                                    'h-8 w-8',
                                    p.purchase_status === 'to_order'
                                      ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 opacity-100'
                                      : 'text-muted-foreground/50 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                  )}
                                >
                                  <ShoppingCart size={13} />
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  onClick={() => openEdit(p)}
                                  className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                >
                                  <Pencil size={13} />
                                </Button>
                                {deleteConfirmId === p.id ? (
                                  <div className="flex items-center gap-1 bg-destructive/8 px-2 rounded-lg border border-destructive/20 animate-in fade-in">
                                    <span className="text-[11px] font-semibold text-destructive">Sure?</span>
                                    <Button variant="default" size="sm" onClick={() => handleDelete(p.id)} className="h-6 px-2 text-[10px] bg-destructive hover:bg-destructive/90">Yes</Button>
                                    <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)} className="h-6 px-2 text-[10px]">No</Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost" size="icon"
                                    onClick={() => setDeleteConfirmId(p.id!)}
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 size={13} />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>

            {displayCount < filtered.length && (
              <div className="p-5 border-t flex justify-center bg-muted/5">
                <Button
                  variant="outline"
                  onClick={() => setDisplayCount(prev => prev + 20)}
                  className="gap-2 text-sm"
                >
                  <ChevronDown size={14} />
                  Load 20 More
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Analytics Section ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}>
        <div
          className="flex items-center justify-between px-1 cursor-pointer group"
          onClick={() => setShowAnalytics(v => !v)}
        >
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl">
              <BarChart2 size={17} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold">Product Analytics</h2>
              <p className="text-xs text-muted-foreground">Stock valuation & performance insights</p>
            </div>
          </div>
          <div className={cn(
            'flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors',
            'bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-lg border border-border/40'
          )}>
            <ChevronDown
              size={14}
              className={cn('transition-transform duration-300', showAnalytics && 'rotate-180')}
            />
            {showAnalytics ? 'Hide' : 'Show'}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showAnalytics && analytics.length > 0 && (() => {
          const totalStockValue = analytics.reduce((s, a) => s + (a.stock_value || 0), 0);
          const totalRetailValue = analytics.reduce((s, a) => s + (a.retail_value || 0), 0);
          const totalProfit = analytics.reduce((s, a) => s + (a.total_profit || 0), 0);
          const topProfitable = [...analytics].sort((a, b) => b.total_profit - a.total_profit).slice(0, 5);
          const slowMovers = analytics.filter(a => a.total_sold === 0 || a.total_sold === null);
          const outOfStock = analytics.filter(a => (a.stock ?? 0) === 0);
          const catMap: Record<string, { value: number; retail: number; count: number }> = {};
          analytics.forEach(a => {
            const cat = a.category || 'Uncategorized';
            if (!catMap[cat]) catMap[cat] = { value: 0, retail: 0, count: 0 };
            catMap[cat].value += a.stock_value || 0;
            catMap[cat].retail += a.retail_value || 0;
            catMap[cat].count += 1;
          });
          const cats = Object.entries(catMap).sort((a, b) => b[1].value - a[1].value);

          return (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              className="flex flex-col gap-5 overflow-hidden"
            >
              {/* Analytics Summary Strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Stock Cost', value: fmtPKR(totalStockValue), color: 'text-cyan-600', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: Layers },
                  { label: 'Retail Value', value: fmtPKR(totalRetailValue), color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: TrendingUp },
                  { label: 'Potential Profit', value: fmtPKR(totalRetailValue - totalStockValue), color: 'text-green-600', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: TrendingUp },
                  { label: 'Realised Profit', value: fmtPKR(totalProfit), color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20', icon: BarChart2 },
                ].map((c, i) => (
                  <Card key={i} className={cn('border', c.border)}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{c.label}</p>
                        <div className={cn('p-1.5 rounded-lg', c.bg)}>
                          <c.icon className={cn('h-3.5 w-3.5', c.color)} />
                        </div>
                      </div>
                      <p className={cn('text-lg font-bold', c.color)}>{c.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Most Profitable */}
                <Card className="shadow-sm border-border/60">
                  <CardHeader className="border-b bg-emerald-500/5 py-4 px-5">
                    <CardTitle className="text-sm flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <TrendingUp size={15} /> Most Profitable Products
                    </CardTitle>
                    <CardDescription className="text-xs">Based on total profit from sales</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto custom-scrollbar">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="pl-5 text-xs">Product</TableHead>
                          <TableHead className="text-right text-xs">Sold</TableHead>
                          <TableHead className="text-right text-xs">Margin</TableHead>
                          <TableHead className="text-right pr-5 text-xs">Profit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topProfitable.map((p: any) => {
                          const mg = p.price > 0
                            ? (((p.price - p.purchase_price) / p.price) * 100).toFixed(0)
                            : null;
                          return (
                            <TableRow key={p.id} className="hover:bg-muted/30">
                              <TableCell className="font-semibold text-sm pl-5">{p.name}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="secondary" className="font-mono text-xs">{p.total_sold || 0}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {mg
                                  ? <Badge variant="outline" className="font-mono text-xs text-emerald-600 border-emerald-400/40 bg-emerald-500/10">{mg}%</Badge>
                                  : '—'}
                              </TableCell>
                              <TableCell className="text-right pr-5 font-bold text-emerald-600 font-mono text-sm">
                                {fmtPKR(p.total_profit || 0)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Slow Movers + Out of Stock */}
                <div className="flex flex-col gap-4">
                  <Card className="shadow-sm border-border/60">
                    <CardHeader className="border-b bg-orange-500/5 py-4 px-5">
                      <CardTitle className="text-sm flex items-center gap-2 text-orange-600">
                        <TrendingDown size={15} /> Slow Movers
                      </CardTitle>
                      <CardDescription className="text-xs">{slowMovers.length} products with zero sales</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 max-h-44 overflow-y-auto custom-scrollbar">
                      {slowMovers.length === 0 ? (
                        <div className="py-6 text-center text-muted-foreground text-sm">
                          <CheckCircle2 size={20} className="text-emerald-500 mx-auto mb-1.5" />
                          All products have been sold!
                        </div>
                      ) : (
                        <Table>
                          <TableBody>
                            {slowMovers.map((p: any) => (
                              <TableRow key={p.id} className="hover:bg-muted/30">
                                <TableCell className="font-semibold text-sm pl-5">{p.name}</TableCell>
                                <TableCell className="text-right text-muted-foreground text-xs">{p.category || '—'}</TableCell>
                                <TableCell className="text-right pr-5">
                                  <Badge variant="secondary" className="font-mono text-xs">Stock: {p.stock}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>

                  {outOfStock.length > 0 && (
                    <Card className="border-destructive/25 shadow-sm">
                      <CardHeader className="border-b bg-destructive/5 py-4 px-5">
                        <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                          <AlertCircle size={15} /> Out of Stock ({outOfStock.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-3 pb-4 px-5 flex flex-wrap gap-2">
                        {outOfStock.map((p: any) => (
                          <Badge key={p.id} variant="destructive" className="font-normal text-xs">{p.name}</Badge>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* Category Breakdown */}
              {cats.length > 0 && (
                <Card className="shadow-sm border-border/60">
                  <CardHeader className="border-b py-4 px-5">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Tag size={14} /> Stock Value by Category
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto custom-scrollbar">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="pl-5 text-xs">Category</TableHead>
                          <TableHead className="text-right text-xs">Products</TableHead>
                          <TableHead className="text-right text-xs">Cost Value</TableHead>
                          <TableHead className="text-right pr-5 text-xs">Retail Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cats.map(([cat, data]) => (
                          <TableRow key={cat} className="hover:bg-muted/30">
                            <TableCell className="pl-5">
                              <Badge variant="secondary" className="font-mono">{cat}</Badge>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground text-sm">{data.count}</TableCell>
                            <TableCell className="text-right font-semibold text-cyan-600 font-mono text-sm">{fmtPKR(data.value)}</TableCell>
                            <TableCell className="text-right pr-5 font-bold text-emerald-600 font-mono text-sm">{fmtPKR(data.retail)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── Add / Edit Dialog ── */}
      <ProductFormModal
        isOpen={showDialog}
        isEditing={isEditing}
        initialProduct={initialProduct}
        vendors={vendors}
        categories={categories}
        onClose={() => setShowDialog(false)}
        onSaved={load}
      />


      {/* ── Import Dialog ── */}
      {showImportDialog && createPortal(
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={closeImportDialog}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="w-full max-w-2xl bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Dialog Header */}
            <div
              className="relative p-6 border-b"
              style={{ background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 50%, #0f172a 100%)' }}
            >
              <div className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 rounded-full bg-emerald-500/10 blur-3xl" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/20 border border-emerald-400/30 p-2.5 rounded-xl">
                    <FileSpreadsheet size={20} className="text-emerald-300" />
                  </div>
                  <div>
                    <h2 className="text-white text-lg font-bold">Import Products from Excel</h2>
                    <p className="text-emerald-300/70 text-xs mt-0.5">
                      Bulk import or update inventory stock via spreadsheet
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeImportDialog}
                  className="text-white/50 hover:text-white/90 transition-colors p-1 rounded-lg hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Phase 1: File Upload */}
              {importRows.length === 0 && !importProgress && (
                <>
                  <div
                    onClick={() => importFileInputRef.current?.click()}
                    className="border-2 border-dashed border-border/50 hover:border-primary/50 rounded-xl p-10 text-center cursor-pointer transition-all duration-200 group hover:bg-muted/20"
                  >
                    <div className="bg-primary/8 group-hover:bg-primary/15 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-colors border border-primary/20">
                      <Upload size={24} className="text-primary" />
                    </div>
                    <p className="font-semibold text-sm mb-1">Click to upload Excel file</p>
                    <p className="text-xs text-muted-foreground">Supports .xlsx and .xls formats</p>
                    <input
                      ref={importFileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImportFile}
                      className="hidden"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/30">
                    <div>
                      <p className="text-sm font-semibold">Need a template?</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Download our pre-formatted Excel template with correct column headers</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 shrink-0 ml-4">
                      <Download size={13} />
                      Template
                    </Button>
                  </div>

                  <div className="p-4 bg-blue-500/5 border border-blue-500/15 rounded-xl">
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2.5">How Import Works</p>
                    <ul className="space-y-1.5">
                      {[
                        'Matches existing products by barcode first, then by name',
                        'Adds imported stock quantity to existing product stock',
                        'Creates new products for rows that don\'t match any existing product',
                        'Required columns: name, price — all others are optional',
                      ].map((tip, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <CheckCircle2 size={12} className="text-blue-500 mt-0.5 shrink-0" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {/* Phase 2: Preview */}
              {importRows.length > 0 && !importProgress && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">
                        <span className="text-emerald-600">{importRows.filter(r => r._valid).length} valid</span>
                        {importRows.filter(r => !r._valid).length > 0 && (
                          <span className="text-muted-foreground"> · {importRows.filter(r => !r._valid).length} with errors (will be skipped)</span>
                        )}
                        <span className="text-muted-foreground"> rows found</span>
                      </p>
                    </div>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => { setImportRows([]); setTimeout(() => importFileInputRef.current?.click(), 50); }}
                      className="gap-1.5 text-xs h-8"
                    >
                      <Upload size={12} /> Change file
                    </Button>
                  </div>

                  <div className="border border-border/50 rounded-xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="text-xs pl-4">Name</TableHead>
                          <TableHead className="text-xs text-right">Price</TableHead>
                          <TableHead className="text-xs text-right">Stock</TableHead>
                          <TableHead className="text-xs text-right pr-4">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importRows.map((row, i) => (
                          <TableRow key={i} className={cn(!row._valid && 'opacity-50 bg-destructive/5')}>
                            <TableCell className="text-xs font-medium pl-4">{row.name || '—'}</TableCell>
                            <TableCell className="text-xs text-right font-mono">
                              {row.price > 0 ? fmtPKR(row.price) : <span className="text-destructive">—</span>}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono">{row.stock}</TableCell>
                            <TableCell className="text-right pr-4">
                              {row._valid
                                ? <CheckCircle2 size={14} className="text-emerald-500 ml-auto" />
                                : (
                                  <div className="flex items-center gap-1 justify-end">
                                    <AlertCircle size={13} className="text-destructive shrink-0" />
                                    <span className="text-[10px] text-destructive">{row._errors[0]}</span>
                                  </div>
                                )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => { setImportRows([]); setImportProgress(null); }}>
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 gap-2"
                      disabled={importRows.filter(r => r._valid).length === 0 || isImporting}
                      onClick={executeImport}
                    >
                      <Upload size={14} />
                      Import {importRows.filter(r => r._valid).length} Products
                    </Button>
                  </div>
                </>
              )}

              {/* Phase 3: Progress */}
              {importProgress && (
                <div className="space-y-5 py-2">
                  <div className="text-center">
                    {isImporting ? (
                      <>
                        <div className="w-14 h-14 rounded-full border-2 border-primary/25 border-t-primary animate-spin mx-auto mb-4" />
                        <p className="font-semibold">Importing products...</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {importProgress.done} of {importProgress.total} done
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle2 size={26} className="text-emerald-500" />
                        </div>
                        <p className="font-bold text-base">Import Complete!</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {importProgress.done - importProgress.errors.length} products imported
                          {importProgress.errors.length > 0 && `, ${importProgress.errors.length} failed`}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-right">
                      {Math.round((importProgress.done / importProgress.total) * 100)}%
                    </p>
                  </div>

                  {importProgress.errors.length > 0 && !isImporting && (
                    <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 max-h-28 overflow-y-auto custom-scrollbar">
                      <p className="text-xs font-semibold text-destructive mb-1.5">Errors:</p>
                      {importProgress.errors.map((err, i) => (
                        <p key={i} className="text-xs text-muted-foreground">{err}</p>
                      ))}
                    </div>
                  )}

                  {!isImporting && (
                    <Button className="w-full" onClick={() => { setShowImportDialog(false); setImportRows([]); setImportProgress(null); }}>
                      Done
                    </Button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
}
