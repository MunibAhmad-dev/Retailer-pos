import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Undo2, Search, Filter, Calendar, ArrowRight, Package, User, Truck, RefreshCcw, MoreHorizontal, Eye, Printer, Plus, MessageCircle, X, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useNotifications } from '../components/NotificationProvider';
import { cn } from '../lib/utils';
import { useLocation } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';

const fmtPKR = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-PK');
const getReturnDate = (ret: any) => ret?.date_created || ret?.date_returned || ret?.date_added || null;
const formatReturnDate = (ret: any) => {
  const d = getReturnDate(ret);
  if (!d) return '-';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '-' : dt.toLocaleString();
};

export default function Returns() {
  const [saleReturns, setSaleReturns] = useState<any[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoreSales, setLoadingMoreSales] = useState(false);
  const [loadingMorePurchases, setLoadingMorePurchases] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [salesOffset, setSalesOffset] = useState(0);
  const [purchaseOffset, setPurchaseOffset] = useState(0);
  const [salesTotal, setSalesTotal] = useState(0);
  const [purchaseTotal, setPurchaseTotal] = useState(0);

  const { addNotification } = useNotifications();
  const PAGE_SIZE = 15;

  const location = useLocation();

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnSaleId, setReturnSaleId] = useState<number | null>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [returnQtys, setReturnQtys] = useState<Record<number, string>>({});
  const [returnReason, setReturnReason] = useState('Damaged / Defective');
  const [processingReturn, setProcessingReturn] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    loadReturns(true);

    // Check for sale_id in URL
    const params = new URLSearchParams(location.search);
    const saleId = params.get('sale_id');
    if (saleId) {
      handleInitiateReturn(Number(saleId));
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [location.search]);

  const handleInitiateReturn = async (saleId: number) => {
    setLoading(true);
    try {
      const res = await window.api.getSaleItems(saleId);
      if (res.success) {
        if (!isMountedRef.current) return;
        setReturnSaleId(saleId);
        setSaleItems(res.data);
        const initialQtys: Record<number, string> = {};
        res.data.forEach((item: any) => {
          initialQtys[item.id] = '';
        });
        setReturnQtys(initialQtys);
        setShowReturnModal(true);
      } else {
        addNotification("Error", "Could not load sale items", "error");
      }
    } catch (err) {
      addNotification("Error", "Failed to fetch sale details", "error");
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const submitReturn = async () => {
    const itemsToReturn = saleItems
      .map(item => {
        const rawQty = parseInt(String(returnQtys[item.id])) || 0;
        const qty = Math.min(item.quantity, rawQty);
        return {
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          price: item.price,
          return_qty: qty
        };
      })
      .filter(item => item.return_qty > 0);

    if (itemsToReturn.length === 0) {
      addNotification("Warning", "Please specify at least one item to return", "warning");
      return;
    }

    const totalRefunded = itemsToReturn.reduce((sum, item) => sum + (item.price * item.return_qty), 0);

    setProcessingReturn(true);
    try {
      const res = await window.api.createSaleReturn({
        sale_id: returnSaleId,
        items: itemsToReturn,
        total_returned: totalRefunded,
        reason: returnReason
      });

      if (res.success) {
        addNotification("Success", "Return processed successfully", "success");
        setShowReturnModal(false);
        loadReturns(true);
      } else {
        addNotification("Error", res.error || "Failed to process return", "error");
      }
    } catch (err) {
      addNotification("Error", "An unexpected error occurred", "error");
    } finally {
      setProcessingReturn(false);
    }
  };

  const loadReturns = async (fresh = false) => {
    if (fresh) {
      setLoading(true);
      setSalesOffset(0);
      setPurchaseOffset(0);
    }

    try {
      const sOff = fresh ? 0 : salesOffset;
      const pOff = fresh ? 0 : purchaseOffset;

      const [salesRes, purchaseRes] = await Promise.all([
        window.api.getSaleReturns({ limit: PAGE_SIZE, offset: sOff }),
        window.api.getPurchaseReturns({ limit: PAGE_SIZE, offset: pOff })
      ]);

      if (salesRes.success) {
        if (!isMountedRef.current) return;
        if (fresh) setSaleReturns(salesRes.data);
        else setSaleReturns(prev => [...prev, ...salesRes.data]);
        setSalesTotal(salesRes.total);
        setSalesOffset(sOff + PAGE_SIZE);
      }

      if (purchaseRes.success) {
        if (!isMountedRef.current) return;
        if (fresh) setPurchaseReturns(purchaseRes.data);
        else setPurchaseReturns(prev => [...prev, ...purchaseRes.data]);
        setPurchaseTotal(purchaseRes.total);
        setPurchaseOffset(pOff + PAGE_SIZE);
      }
    } catch (error) {
      addNotification("Error", "Failed to load returns history", "error");
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const loadMoreSales = async () => {
    setLoadingMoreSales(true);
    try {
      const res = await window.api.getSaleReturns({ limit: PAGE_SIZE, offset: salesOffset });
      if (res.success) {
        setSaleReturns(prev => [...prev, ...res.data]);
        setSalesTotal(res.total);
        setSalesOffset(prev => prev + PAGE_SIZE);
      }
    } finally {
      setLoadingMoreSales(false);
    }
  };

  const loadMorePurchases = async () => {
    setLoadingMorePurchases(true);
    try {
      const res = await window.api.getPurchaseReturns({ limit: PAGE_SIZE, offset: purchaseOffset });
      if (res.success) {
        setPurchaseReturns(prev => [...prev, ...res.data]);
        setPurchaseTotal(res.total);
        setPurchaseOffset(prev => prev + PAGE_SIZE);
      }
    } finally {
      setLoadingMorePurchases(false);
    }
  };

  const printReturn = async (ret: any, type: 'sale' | 'purchase') => {
    const isSale = type === 'sale';
    const partyLabel = isSale ? 'Customer' : 'Vendor';
    const partyName = isSale ? ret.customer_name : ret.vendor_name;
    const amount = isSale ? ret.total_refunded : ret.total_returned;
    const refLabel = isSale ? 'Sale ID' : 'Purchase ID';
    const refId = isSale ? ret.sale_id : ret.purchase_id;

    // Fetch items for this return
    const itemsRes = isSale
      ? await window.api.getSaleReturnItems(ret.id)
      : await window.api.getPurchaseReturnItems(ret.id);

    const items = itemsRes.success ? itemsRes.data : [];

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; max-width: 400px; margin: auto; border: 1px solid #eee;">
        <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
          <h2 style="margin: 0; text-transform: uppercase;">Return Receipt</h2>
          <p style="margin: 5px 0; font-size: 12px; color: #666;">Date: ${formatReturnDate(ret)}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <p style="margin: 5px 0;"><strong>Return ID:</strong> #${ret.id}</p>
          <p style="margin: 5px 0;"><strong>${refLabel}:</strong> #${refId}</p>
          <p style="margin: 5px 0;"><strong>${partyLabel}:</strong> ${partyName || 'N/A'}</p>
          <p style="margin: 5px 0; font-size: 11px; color: #666;"><strong>Orig. Purchase Total:</strong> PKR ${Math.round(ret.original_total).toLocaleString()}</p>
        </div>

        <div style="margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead style="border-bottom: 1px solid #eee;">
              <tr>
                <th style="text-align: left; padding: 5px 0;">Item</th>
                <th style="text-align: center; padding: 5px 0;">Qty</th>
                <th style="text-align: right; padding: 5px 0;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item: any) => `
                <tr>
                  <td style="padding: 5px 0;">${item.product_name}</td>
                  <td style="text-align: center; padding: 5px 0;">${item.quantity}</td>
                  <td style="text-align: right; padding: 5px 0;">PKR ${Math.round(item.price * item.quantity).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase; color: #888;">Total ${isSale ? 'Refunded' : 'Returned Value'}</p>
          <p style="margin: 0; font-size: 24px; font-weight: bold; color: ${isSale ? '#e11d48' : '#2563eb'};">PKR ${Math.round(amount).toLocaleString()}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <p style="margin: 0 0 5px 0; font-weight: bold;">Reason for Return:</p>
          <p style="margin: 0; font-style: italic; color: #555;">${ret.reason || 'No reason provided'}</p>
        </div>
        
        <div style="text-align: center; font-size: 10px; color: #aaa; margin-top: 30px; border-top: 1px dashed #ddd; pt-10;">
          <p>This is a computer-generated return receipt.</p>
        </div>
      </div>
    `;
    await window.api.printInvoice(html);
  };

  const shareOnWhatsApp = async (ret: any, type: 'sale' | 'purchase') => {
    const isSale = type === 'sale';
    const amount = isSale ? ret.total_refunded : ret.total_returned;
    const refId = isSale ? ret.sale_id : ret.purchase_id;
    const partyName = isSale ? ret.customer_name : ret.vendor_name;

    // Fetch items for this return
    const itemsRes = isSale
      ? await window.api.getSaleReturnItems(ret.id)
      : await window.api.getPurchaseReturnItems(ret.id);

    const items = itemsRes.success ? itemsRes.data : [];

    let itemsList = "";
    items.forEach((item: any) => {
      itemsList += `• ${item.product_name} (x${item.quantity})\n`;
    });

    const message = `*Return Receipt*\n\n` +
      `*Return ID:* #${ret.id}\n` +
      `*${isSale ? 'Sale' : 'Purchase'} Ref:* #${refId}\n` +
      `*Party:* ${partyName || 'N/A'}\n` +
      `*Date:* ${formatReturnDate(ret)}\n\n` +
      `*Items Returned:*\n${itemsList}\n` +
      `*Total ${isSale ? 'Refund' : 'Returned Value'}:* PKR ${Math.round(amount).toLocaleString()}\n` +
      `*Reason:* ${ret.reason || 'No reason provided'}\n\n` +
      `_Generated by Retailer POS_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredSales = useMemo(() => saleReturns.filter(r =>
    (r.customer_name || '').toLowerCase().includes(normalizedSearch) ||
    String(r.sale_id).includes(normalizedSearch) ||
    String(r.id).includes(normalizedSearch)
  ), [saleReturns, normalizedSearch]);

  const filteredPurchases = useMemo(() => purchaseReturns.filter(r =>
    (r.vendor_name || '').toLowerCase().includes(normalizedSearch) ||
    String(r.purchase_id).includes(normalizedSearch) ||
    String(r.id).includes(normalizedSearch)
  ), [purchaseReturns, normalizedSearch]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Returns Management</h1>
          <p className="text-muted-foreground mt-1 text-sm">Track and manage customer refunds and vendor returns</p>
        </div>
        <Button onClick={() => loadReturns(true)} variant="outline" className="gap-2 h-10 shadow-sm border-primary/20 hover:bg-primary/5">
          <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md overflow-hidden">
        <CardContent className="p-0">
          <Tabs defaultValue="sales" className="w-full">
            <div className="px-6 pt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <TabsList className="bg-muted/50 p-1">
                <TabsTrigger value="sales" className="gap-2 px-6">
                  <User size={14} /> Sales Returns
                </TabsTrigger>
                <TabsTrigger value="purchases" className="gap-2 px-6">
                  <Truck size={14} /> Purchase Returns
                </TabsTrigger>
              </TabsList>

              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} />
                <Input
                  placeholder="Search by ID or Name..."
                  className="pl-10 h-10 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <TabsContent value="sales" className="mt-4 animate-in slide-in-from-left-4 duration-300">
              <div className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 border-y hover:bg-muted/30">
                      <TableHead className="pl-6 py-4">Return ID</TableHead>
                      <TableHead>Sale Ref</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right pr-6">Refunded Amount</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                          <Undo2 size={40} className="mx-auto mb-3 opacity-20" />
                          No sale returns found
                        </TableCell>
                      </TableRow>
                    ) : filteredSales.map((ret) => (
                      <TableRow key={ret.id} className="group hover:bg-primary/5 transition-colors cursor-default">
                        <TableCell className="pl-6 font-mono font-bold text-primary">#{ret.id}</TableCell>
                        <TableCell className="font-medium">Sale #{ret.sale_id}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                              {ret.customer_name?.charAt(0) || 'W'}
                            </div>
                            {ret.customer_name || 'Walk-in'}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs italic">
                          {formatReturnDate(ret)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs italic text-muted-foreground">
                          {ret.reason || 'No reason provided'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-destructive">
                          {fmtPKR(ret.total_returned)}
                        </TableCell>
                        <TableCell className="text-center pr-6">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => printReturn(ret, 'sale')} title="Print Receipt">
                              <Printer size={15} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500" onClick={() => shareOnWhatsApp(ret, 'sale')} title="Share on WhatsApp">
                              <MessageCircle size={15} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                    {saleReturns.length < salesTotal && !searchTerm && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-6 text-center">
                          <Button variant="outline" onClick={loadMoreSales} disabled={loadingMoreSales} className="gap-2 border-primary/20 hover:bg-primary/5">
                            {loadingMoreSales ? <RefreshCcw size={16} className="animate-spin" /> : <Plus size={16} />}
                            Load More Sales Returns ({saleReturns.length} of {salesTotal})
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="purchases" className="mt-4 animate-in slide-in-from-right-4 duration-300">
              <div className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 border-y hover:bg-muted/30">
                      <TableHead className="pl-6 py-4">Return ID</TableHead>
                      <TableHead>Purchase Ref</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right pr-6">Returned Value</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPurchases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                          <Truck size={40} className="mx-auto mb-3 opacity-20" />
                          No purchase returns found
                        </TableCell>
                      </TableRow>
                    ) : filteredPurchases.map((ret) => (
                      <TableRow key={ret.id} className="group hover:bg-primary/5 transition-colors cursor-default">
                        <TableCell className="pl-6 font-mono font-bold text-primary">#{ret.id}</TableCell>
                        <TableCell className="font-medium">Purchase #{ret.purchase_id}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center text-[10px] font-bold text-blue-600">
                              {ret.vendor_name?.charAt(0)}
                            </div>
                            {ret.vendor_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs italic">
                          {formatReturnDate(ret)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs italic text-muted-foreground">
                          {ret.reason || 'No reason provided'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-600">
                          {fmtPKR(ret.total_returned)}
                        </TableCell>
                        <TableCell className="text-center pr-6">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => printReturn(ret, 'purchase')} title="Print Receipt">
                              <Printer size={15} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500" onClick={() => shareOnWhatsApp(ret, 'purchase')} title="Share on WhatsApp">
                              <MessageCircle size={15} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                    {purchaseReturns.length < purchaseTotal && !searchTerm && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-6 text-center">
                          <Button variant="outline" onClick={loadMorePurchases} disabled={loadingMorePurchases} className="gap-2 border-primary/20 hover:bg-primary/5">
                            {loadingMorePurchases ? <RefreshCcw size={16} className="animate-spin" /> : <Plus size={16} />}
                            Load More Purchase Returns ({purchaseReturns.length} of {purchaseTotal})
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Return Creation Modal */}
      <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
        <DialogContent className="max-w-2xl bg-card border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Undo2 className="text-destructive" size={24} />
              Process Sale Return
            </DialogTitle>
            <DialogDescription>
              Select items and quantities to return for Sale #{returnSaleId}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-center">Orig. Qty</TableHead>
                    <TableHead className="text-center">Price</TableHead>
                    <TableHead className="text-right">Return Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saleItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {fmtPKR(item.price)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            type="text"
                            className={cn(
                              "w-20 h-9 text-right font-bold transition-colors",
                              (parseInt(String(returnQtys[item.id])) || 0) > item.quantity
                                ? "border-red-500 bg-red-50 focus-visible:ring-red-500"
                                : "border-destructive/20 focus:border-destructive/50"
                            )}
                            value={returnQtys[item.id] || ''}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, '');
                              setReturnQtys(prev => ({ ...prev, [item.id]: raw }));
                            }}
                            onBlur={() => {
                              const raw = returnQtys[item.id];
                              if (!raw) return;
                              const val = Math.min(item.quantity, parseInt(String(raw)) || 0);
                              setReturnQtys(prev => ({ ...prev, [item.id]: String(val) }));
                            }}
                            placeholder="0"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-2 pt-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Reason for Return</Label>
              <select
                className="w-full h-11 rounded-xl bg-muted/30 border border-border/50 px-3 text-sm focus:ring-2 focus:ring-destructive outline-none transition-all"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
              >
                <option>Damaged / Defective</option>
                <option>Wrong Item Delivered</option>
                <option>Customer Dissatisfied</option>
                <option>Expired Product</option>
                <option>Other / Manual Correction</option>
              </select>
            </div>

            <div className="bg-destructive/5 rounded-xl p-4 flex items-center justify-between border border-destructive/10 mt-4">
              <div>
                <span className="text-xs text-destructive font-bold uppercase tracking-wider">Total Refund Amount</span>
                <p className="text-2xl font-black text-destructive">
                  {fmtPKR(saleItems.reduce((sum, item) => sum + (item.price * (parseInt(String(returnQtys[item.id])) || 0)), 0))}
                </p>
              </div>
              <div className="text-right text-[10px] text-muted-foreground uppercase font-medium">
                Affects stock &<br />financial records
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowReturnModal(false)} disabled={processingReturn}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="px-8 font-bold gap-2"
              onClick={submitReturn}
              disabled={processingReturn}
            >
              {processingReturn ? <RefreshCcw size={16} className="animate-spin" /> : <Undo2 size={18} />}
              Confirm Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
