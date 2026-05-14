import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Printer, RefreshCw, ChevronDown, Download, Receipt, Loader2, Undo2, X, AlertCircle } from 'lucide-react';
import dayjs from 'dayjs';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import { useNotifications } from '../components/NotificationProvider';
import { LoadMoreButton } from '../components/Pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

interface Sale {
  id: number;
  subtotal: number;
  discount: number;
  total: number;
  date_created: string;
  payment_method: string;
  items_summary: string;
  status: 'Completed' | 'Returned' | 'Cancelled';
}

interface Settings {
  store_name: string;
  store_phone: string;
  store_address: string;
  receipt_footer: string;
  store_logo: string;
}

const PAGE_SIZE = 50;
const fmtPKR = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-PK');

export default function Transactions() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [settings, setSettings] = useState<Settings>({ store_name: 'Restaurant', store_phone: '', store_address: '', receipt_footer: 'Thank you!', store_logo: '' });
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  const [returnReason, setReturnReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const { addNotification } = useNotifications();

  // Sentinel ref for IntersectionObserver
  const sentinelRef = useRef<HTMLTableRowElement>(null);
  // Search debounce timer
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the search input - 400ms after user stops typing
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchTerm]);

  // Reset and reload when search changes
  useEffect(() => {
    setSales([]);
    setOffset(0);
    setHasMore(true);
    loadPage(0, debouncedSearch, true);
  }, [debouncedSearch]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadPage = useCallback(async (pageOffset: number, search: string, isReset = false) => {
    if (isReset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await window.api.getSales({ limit: PAGE_SIZE, offset: pageOffset, search: search || undefined });
      if (res?.success && res.data) {
        const newRows = res.data as Sale[];
        setSales(prev => isReset ? newRows : [...prev, ...newRows]);
        setTotal(res.total ?? 0);
        setOffset(pageOffset + newRows.length);
        setHasMore(newRows.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // IntersectionObserver: when the sentinel row enters the viewport, load next page
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadPage(offset, debouncedSearch);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, offset, debouncedSearch, loadPage]);

  const loadSettings = async () => {
    try {
      const res = await window.api.getSettings();
      if (res?.success && res.data) setSettings(res.data);
    } catch { }
  };

  const handleRefresh = () => {
    addNotification('Refreshing', 'Fetching latest transactions', 'info');
    setSales([]);
    setOffset(0);
    setHasMore(true);
    loadPage(0, debouncedSearch, true);
  };

  const handleStatusUpdate = async (saleId: number, newStatus: string) => {
    try {
      const res = await window.api.updateSaleStatus(saleId, newStatus);
      if (res.success) {
        // Update locally without full reload
        setSales(prev => prev.map(s => s.id === saleId ? { ...s, status: newStatus as Sale['status'] } : s));
        addNotification('Status Updated', `Sale #${saleId} marked as ${newStatus}.`, 'success');
      } else {
        addNotification('Update Failed', res.error || 'Failed to update status', 'error');
      }
    } catch {
      addNotification('Error', 'Critical error updating status', 'error');
    }
  };

  const buildReceiptHtml = (sale: Sale, items: any[]) => {
    const itemsHtml = items.map((item: any) => `
      <div class="item">
        <span>${item.product_name} x${item.quantity}</span>
        <span>${fmtPKR(item.price * item.quantity)}</span>
      </div>
    `).join('');

    return `
      ${settings.store_logo ? `<img src="${settings.store_logo}" style="max-height:48px;display:block;margin:0 auto 6px"/>` : ''}
      <h2>${settings.store_name}</h2>
      ${settings.store_address ? `<p class="center">${settings.store_address}</p>` : ''}
      ${settings.store_phone ? `<p class="center">Tel: ${settings.store_phone}</p>` : ''}
      <div class="divider"></div>
      <p class="center" style="font-weight:bold;font-size:12px;">Receipt #${sale.id}</p>
      <p class="center" style="font-size:10px;margin-top:2px;color:#555;">${dayjs(sale.date_created.replace(' ', 'T')).format('DD MMM YYYY hh:mm A')}</p>
      <div class="divider"></div>
      ${itemsHtml}
      <div class="divider"></div>
      <div class="total-row" style="font-weight:normal;font-size:11px"><span>Subtotal</span><span>${fmtPKR(sale.subtotal || sale.total)}</span></div>
      ${(sale.discount || 0) > 0 ? `<div class="total-row" style="font-weight:normal;font-size:11px;color:red"><span>Discount</span><span>-${fmtPKR(sale.discount)}</span></div>` : ''}
      <div class="total-row"><span>Total</span><span>${fmtPKR(sale.total)}</span></div>
      <div class="total-row" style="font-weight:normal;font-size:10px;margin-top:2px">
        <span>Payment</span><span>${sale.payment_method === 'online' ? 'ONLINE PAYMENT' : (sale.payment_method || 'cash').toUpperCase()}</span>
      </div>
      <div class="divider"></div>
      <div style="text-align: center; margin-top: 6px;">
        <div style="font-size: 11px; font-weight: bold;">${settings.receipt_footer}</div>
        <div style="font-size: 9px; margin-top: 6px; color: #555;">Software made by +923298748232</div>
      </div>
    `;
  };

  const reprintReceipt = async (sale: Sale) => {
    const res = await window.api.getSaleItems(sale.id);
    const items = (res?.success && res.data) ? res.data : [];
    await window.api.printInvoice(buildReceiptHtml(sale, items));
    addNotification('Printed', 'Receipt queued to printer.', 'success');
  };

  const saveReceiptPdf = async (sale: Sale) => {
    const res = await window.api.getSaleItems(sale.id);
    const items = res?.success && res.data ? res.data : [];
    await window.api.saveInvoicePdf(buildReceiptHtml(sale, items));
    addNotification('PDF Saved', 'Receipt PDF created successfully.', 'success');
  };
  const openReturnModal = async (sale: Sale) => {
    setSelectedSale(sale);
    setLoading(true);
    try {
      const res = await window.api.getSaleItems(sale.id);
      if (res.success) {
        setSaleItems(res.data);
        const initialQtys: Record<number, number> = {};
        res.data.forEach((item: any) => { initialQtys[item.id] = 0; });
        setReturnQuantities(initialQtys);
        setReturnModalOpen(true);
      }
    } catch (err) {
      addNotification("Error", "Could not load sale items", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReturnSubmit = async () => {
    if (!selectedSale) return;

    const itemsToReturn = saleItems
      .filter(item => returnQuantities[item.id] > 0)
      .map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: returnQuantities[item.id],
        price: item.price
      }));

    if (itemsToReturn.length === 0) {
      addNotification("Warning", "Please select at least one item to return", "warning");
      return;
    }

    const totalRefunded = itemsToReturn.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    setIsSubmittingReturn(true);
    try {
      const res = await window.api.createSaleReturn({
        sale_id: selectedSale.id,
        items: itemsToReturn,
        reason: returnReason,
        total_returned: totalRefunded
      });

      if (res.success) {
        addNotification("Success", "Return processed successfully", "success");
        setReturnModalOpen(false);
        handleRefresh();
      } else {
        addNotification("Error", res.error || "Failed to process return", "error");
      }
    } catch (err) {
      addNotification("Error", "Critical error processing return", "error");
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in max-w-[1400px]">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total > 0 ? (
              <span>Showing <strong>{sales.length}</strong> of <strong>{total.toLocaleString()}</strong> transactions</span>
            ) : (
              'Complete history of all point of sale transactions'
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={handleRefresh} className="h-12 w-12 rounded-xl border-border bg-card">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="p-4 border-b bg-muted/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
            <Input
              type="text"
              placeholder="Search by ID, payment method, or item name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 w-full md:max-w-md bg-background"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-24">Sale #</TableHead>
                <TableHead className="w-32">Date &amp; Time</TableHead>
                <TableHead className="max-w-[200px]">Items</TableHead>
                <TableHead className="w-24">Method</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right font-bold text-foreground">Total</TableHead>
                <TableHead className="text-right pr-6 w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={24} className="animate-spin text-primary opacity-50" />
                      <p>Loading transactions...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <Receipt size={40} className="opacity-20" />
                      <p>No transactions found{searchTerm ? ` for "${searchTerm}"` : ''}.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {sales.map((s) => (
                    <TableRow key={s.id} className="group">
                      <TableCell className="font-bold">#{s.id}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{dayjs(s.date_created).format('DD MMM YYYY')}</span>
                          <span className="text-xs text-muted-foreground">{dayjs(s.date_created).format('hh:mm A')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px]">
                        <p className="truncate text-xs leading-relaxed" title={s.items_summary}>{s.items_summary || '-'}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.payment_method === 'online' ? 'secondary' : 'default'} className="uppercase text-[10px]">
                          {s.payment_method === 'online' ? 'Online' : s.payment_method}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={s.status || 'Completed'}
                          onValueChange={(val) => handleStatusUpdate(s.id, val)}
                        >
                          <SelectTrigger className={cn(
                            "h-8 w-[130px] rounded-full text-[11px] font-black uppercase tracking-tighter border-2 shadow-sm transition-all duration-200",
                            s.status === 'Returned'
                              ? 'bg-amber-400 text-black border-amber-600 hover:bg-amber-500 dark:bg-amber-600 dark:text-white dark:border-amber-500'
                              : s.status === 'Cancelled'
                                ? 'bg-red-500 text-white border-red-600 hover:bg-red-600 dark:bg-red-600 dark:text-white dark:border-red-500'
                                : 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 dark:bg-emerald-600 dark:text-white dark:border-emerald-500'
                          )}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Completed" className="text-xs font-bold text-emerald-600">✅ Completed</SelectItem>
                            <SelectItem value="Returned" className="text-xs font-bold text-amber-600">⏪ Returned</SelectItem>
                            <SelectItem value="Cancelled" className="text-xs font-bold text-red-600">❌ Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">{fmtPKR(s.subtotal || s.total)}</TableCell>
                      <TableCell className="text-right text-destructive text-xs">{s.discount > 0 ? `-${fmtPKR(s.discount)}` : '-'}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{fmtPKR(s.total)}</TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => reprintReceipt(s)} className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Reprint Receipt">
                            <Printer size={15} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => saveReceiptPdf(s)} className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" title="Download PDF">
                            <Download size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openReturnModal(s)}
                            className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                            title="Return Items"
                            disabled={s.status === 'Returned'}
                          >
                            <Undo2 size={15} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Load more button - explicit click trigger */}
                  {hasMore && (
                    <TableRow className="pointer-events-auto">
                      <TableCell colSpan={9} className="py-2 text-center">
                        <LoadMoreButton
                          hasMore={hasMore}
                          onLoadMore={() => loadPage(offset, debouncedSearch)}
                          showing={sales.length}
                          total={total}
                        />
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Sentinel row — IntersectionObserver watches this to trigger next page load */}
                  <TableRow ref={sentinelRef} className="pointer-events-none">
                    <TableCell colSpan={9} className="py-2 text-center">
                      {loadingMore && (
                        <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs py-2">
                          <Loader2 size={14} className="animate-spin" />
                          <span>Loading more transactions...</span>
                        </div>
                      )}
                      {!hasMore && sales.length > 0 && (
                        <p className="text-muted-foreground/50 text-xs py-2">
                          All {total.toLocaleString()} transactions loaded.
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Return Modal */}
      {returnModalOpen && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <Card className="w-full max-w-2xl shadow-2xl border-none overflow-hidden animate-in zoom-in-95 duration-300">
            <CardHeader className="bg-primary text-primary-foreground p-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Undo2 size={24} /> Return Items for Sale #{selectedSale.id}
                </CardTitle>
                <CardDescription className="text-primary-foreground/70">
                  Select items and quantities to return to stock.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10" onClick={() => setReturnModalOpen(false)}>
                <X size={20} />
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="rounded-xl border bg-muted/20 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>Product Name</TableHead>
                      <TableHead className="text-center">Sold</TableHead>
                      <TableHead className="text-center">Prev. Returned</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right w-32">Qty to Return</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saleItems.map((item) => {
                      const availableToReturn = item.quantity - (item.quantity_returned || 0);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-center text-amber-600 font-bold">{item.quantity_returned || 0}</TableCell>
                          <TableCell className="text-right">{fmtPKR(item.price)}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="text"
                              className={cn(
                                "h-8 text-right font-bold border-primary/20",
                                availableToReturn === 0 && "opacity-50 cursor-not-allowed bg-muted"
                              )}
                              value={returnQuantities[item.id] || ''}
                              disabled={availableToReturn <= 0}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9]/g, '');
                                const val = Math.min(availableToReturn, parseInt(raw) || 0);
                                setReturnQuantities({
                                  ...returnQuantities,
                                  [item.id]: val
                                });
                              }}
                            />
                            {availableToReturn > 0 && (
                              <p className="text-[10px] text-muted-foreground mt-1">Max: {availableToReturn}</p>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <AlertCircle size={14} className="text-amber-500" /> Reason for Return
                </label>
                <Input
                  placeholder="e.g. Damaged item, customer change of mind..."
                  className="bg-muted/20"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
                <div className="text-left">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Refund Amount</p>
                  <p className="text-2xl font-black text-primary">
                    {fmtPKR(saleItems.reduce((sum, item) => sum + (item.price * (returnQuantities[item.id] || 0)), 0))}
                  </p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setReturnModalOpen(false)}>Cancel</Button>
                  <Button
                    className="flex-1 sm:flex-none gap-2"
                    onClick={handleReturnSubmit}
                    disabled={isSubmittingReturn || saleItems.reduce((sum, item) => sum + (returnQuantities[item.id] || 0), 0) === 0}
                  >
                    {isSubmittingReturn ? <Loader2 className="animate-spin" size={16} /> : <Undo2 size={16} />}
                    Process Return
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


