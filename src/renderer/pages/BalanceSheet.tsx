
import React, { useState, useEffect, useMemo } from 'react';
import {
   BarChart3, Download, Printer, Calendar, TrendingUp,
   TrendingDown, DollarSign, Package, Users, Wallet,
   ArrowUpRight, ArrowDownRight, Activity, Filter, Plus, ShoppingCart, ShoppingBag, Receipt, AlertCircle, Info, X, Truck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useLanguage } from '../components/LanguageProvider';
import { cn } from '../lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Input } from '../components/ui/input';
import { 
   Select, 
   SelectContent, 
   SelectItem, 
   SelectTrigger, 
   SelectValue 
} from "../components/ui/select";
import { Search, Loader2 } from 'lucide-react';
import dayjs from 'dayjs';

interface BalanceSheetData {
   inventoryValue: number;
   receivables: number;
   payables: number;
   revenue: number;
   cogs: number;
   expenses: number;
   vendorOutflow: number;
   netProfit: number;
   paymentStats: { payment_method: string; revenue: number; count: number }[];
   recentTransactions: any[];
   period: { start: string | null; end: string | null };
}

export default function BalanceSheet() {
   const { t, language } = useLanguage();
   const [data, setData] = useState<BalanceSheetData | null>(null);
   const [loading, setLoading] = useState(true);
   const [range, setRange] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');

   // Zakat Logic
   const [showZakat, setShowZakat] = useState(false);
   const [nisab, setNisab] = useState(100000); // Default Nisab threshold in PKR

   // Invoice Preview
   const [previewInvoice, setPreviewInvoice] = useState<any>(null);

   // Full Report Preview
   const [showReportPreview, setShowReportPreview] = useState(false);

   // Quick Creator Logic
   const [showCreator, setShowCreator] = useState(false);
   const [creatorType, setCreatorType] = useState<'sale' | 'purchase' | 'expense'>('sale');
   const [creatorLoading, setCreatorLoading] = useState(false);
   const [creatorData, setCreatorData] = useState({
      party_id: '',
      amount: '',
      description: '',
      items_count: '1'
   });

   // Search & Filter for Recent Activity
   const [activitySearch, setActivitySearch] = useState('');
   const [activityFilter, setActivityFilter] = useState<'all' | 'sale' | 'purchase' | 'expense'>('all');

   useEffect(() => {
      fetchData();
   }, [range]);

   const fetchData = async () => {
      setLoading(true);
      try {
         let startDate: string | undefined;
         let endDate: string = dayjs().endOf('day').toISOString();

         const fmtDate = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD HH:mm:ss');

         if (range === 'today') startDate = fmtDate(dayjs().startOf('day'));
         else if (range === 'week') startDate = fmtDate(dayjs().subtract(7, 'day').startOf('day'));
         else if (range === 'month') startDate = fmtDate(dayjs().subtract(30, 'day').startOf('day'));
         else if (range === 'year') startDate = fmtDate(dayjs().subtract(365, 'day').startOf('day'));
         else startDate = undefined;

         const res = await window.api.getBalanceSheet({ startDate, endDate });
         if (res.success) {
            setData(res.data);
         }
      } catch (error) {
         console.error("Failed to fetch balance sheet", error);
      } finally {
         setLoading(false);
      }
   };

   const fmt = (n: number) => 'Rs. ' + Math.round(n).toLocaleString();

   const handleQuickCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!creatorData.amount) return;
      setCreatorLoading(true);
      try {
         let res;
         if (creatorType === 'sale') {
            res = await window.api.createSale({
               customer_id: creatorData.party_id ? Number(creatorData.party_id) : undefined,
               items: [{ name: creatorData.description || 'General Item', price: Number(creatorData.amount), quantity: Number(creatorData.items_count) }],
               total: Number(creatorData.amount),
               payment_method: 'cash'
            });
         } else if (creatorType === 'purchase') {
            res = await window.api.createPurchase({
               vendor_id: creatorData.party_id ? Number(creatorData.party_id) : 1, 
               items: [{ product_id: 1, quantity: Number(creatorData.items_count), purchase_price: Number(creatorData.amount) / Number(creatorData.items_count) }],
               total: Number(creatorData.amount)
            });
         } else {
            res = await window.api.addExpense({
               category: creatorData.description || 'General Expense',
               amount: Number(creatorData.amount),
               date_added: new Date().toISOString()
            });
         }

         if (res.success) {
            setShowCreator(false);
            setCreatorData({ party_id: '', amount: '', description: '', items_count: '1' });
            fetchData();
         }
      } catch (err) {
         console.error(err);
      } finally {
         setCreatorLoading(false);
      }
   };

   const [visibleActivityCount, setVisibleActivityCount] = useState(10);

   const filteredTransactions = useMemo(() => {
      if (!data) return [];
      return (data.recentTransactions || []).filter(txn => {
         const matchesSearch = 
            (txn.customer_name || '').toLowerCase().includes(activitySearch.toLowerCase()) ||
            (txn.vendor_name || '').toLowerCase().includes(activitySearch.toLowerCase()) ||
            (txn.category || '').toLowerCase().includes(activitySearch.toLowerCase()) ||
            (txn.id?.toString() || '').includes(activitySearch);
         
         const matchesFilter = activityFilter === 'all' || txn.type === activityFilter;
         
         return matchesSearch && matchesFilter;
      });
   }, [data, activitySearch, activityFilter]);

    if (loading || !data) {
       return (
          <div className="flex items-center justify-center h-[60vh]">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
       );
    }

    const grossProfit = data.revenue - data.cogs;

    return (
       <div className="space-y-6 animate-in print:bg-white print:p-0">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              .print-hidden { display: none !important; }
              body { background: white !important; }
              .card { border: none !important; shadow: none !important; }
              .animate-in { animation: none !important; }
              @page { margin: 1cm; }
            }
          `}} />
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
            <div>
               <h1 className="text-3xl font-bold tracking-tight">{t('balance_sheet')}</h1>
               <p className="text-muted-foreground text-sm mt-1">Comprehensive financial health summary</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 bg-muted/30 p-1 rounded-lg border border-border/50">
               <div className="flex items-center gap-1">
                  {(['today', 'week', 'month', 'year', 'all'] as const).map((r) => (
                     <Button
                        key={r}
                        variant={range === r ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setRange(r)}
                        className="capitalize text-xs h-8 px-3"
                     >
                        {r}
                     </Button>
                  ))}
               </div>
               <div className="w-px h-4 bg-border mx-1" />
               <Button variant="outline" size="sm" onClick={() => setShowZakat(true)} className="h-8 gap-2 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20">
                  <DollarSign size={14} /> {t('calculate_zakat')}
               </Button>
               <Button variant="outline" size="sm" onClick={() => setShowReportPreview(true)} className="h-8 gap-2">
                  <Printer size={14} /> {t('print_report')}
               </Button>
            </div>
         </div>

         {/* Quick Action Dashboard */}
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
            <Button onClick={() => { setCreatorType('sale'); setShowCreator(true); }} className="h-14 gap-3 font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
               <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Plus size={18} />
               </div>
               Quick Sale
            </Button>
            <Button onClick={() => { setCreatorType('purchase'); setShowCreator(true); }} variant="secondary" className="h-14 gap-3 font-bold border-border hover:bg-muted/50">
               <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Plus size={18} />
               </div>
               Quick Purchase
            </Button>
            <Button onClick={() => { setCreatorType('expense'); setShowCreator(true); }} variant="outline" className="h-14 gap-3 font-bold border-dashed">
               <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <TrendingDown size={18} className="text-red-500" />
               </div>
               Record Expense
            </Button>
            <Button onClick={() => window.location.hash = '#/reports'} variant="ghost" className="h-14 gap-3 font-bold">
               <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <BarChart3 size={18} className="text-blue-500" />
               </div>
               Full Reports
            </Button>
         </div>

         {/* Header Info for Printing */}
         <div className="hidden print:block mb-8 text-center border-b pb-6">
            <h1 className="text-3xl font-black uppercase tracking-tighter mb-1">Business Balance Sheet</h1>
            <p className="text-lg text-muted-foreground">Period: {data.period.start ? dayjs(data.period.start).format('DD MMM YYYY') : 'All Time'} - {data.period.end ? dayjs(data.period.end).format('DD MMM YYYY') : 'Now'}</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Assets Card */}
            <Card className="md:col-span-1 border-primary/20 bg-primary/5 shadow-none overflow-hidden relative group">
               <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                  <Wallet size={80} />
               </div>
               <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                     <TrendingUp className="text-emerald-500" size={18} /> Business Assets
                  </CardTitle>
                  <CardDescription>Current value owned by the business</CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-primary/10">
                     <span className="text-sm text-muted-foreground flex items-center gap-2"><Package size={14} /> {t('inventory_value')}</span>
                     <span className="font-bold text-lg">{fmt(data.inventoryValue)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-primary/10">
                     <span className="text-sm text-muted-foreground flex items-center gap-2"><Users size={14} /> {t('receivables')}</span>
                     <span className="font-bold text-lg text-amber-600 dark:text-amber-400">{fmt(data.receivables)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-primary/10">
                     <span className="text-sm text-muted-foreground flex items-center gap-2"><Truck size={14} /> Accounts Payable</span>
                     <span className="font-bold text-lg text-red-600">{fmt(data.payables)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                     <span className="font-black text-sm uppercase">Net Assets</span>
                     <span className="font-black text-2xl text-primary">{fmt(data.inventoryValue + data.receivables - data.payables)}</span>
                  </div>
               </CardContent>
            </Card>

            {/* P&L Performance */}
            <Card className="md:col-span-2 shadow-sm">
               <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                     <Activity className="text-primary" size={18} /> {t('reports')} Performance
                  </CardTitle>
                  <CardDescription>Income and expenditure analysis for the selected period</CardDescription>
               </CardHeader>
               <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                     <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{t('revenue')}</p>
                        <p className="text-lg font-black">{fmt(data.revenue)}</p>
                        <Badge variant="outline" className="mt-2 bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">INCOME</Badge>
                     </div>
                     <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{t('cogs')}</p>
                        <p className="text-lg font-black">{fmt(data.cogs)}</p>
                        <Badge variant="outline" className="mt-2 bg-orange-50 text-orange-700 border-orange-200 text-[9px]">STOCK COST</Badge>
                     </div>
                     <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{t('expenses')}</p>
                        <p className="text-lg font-black">{fmt(data.expenses)}</p>
                        <Badge variant="outline" className="mt-2 bg-red-50 text-red-700 border-red-200 text-[9px]">OPERATIONAL</Badge>
                     </div>
                     <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                        <p className="text-[10px] uppercase font-bold text-primary mb-1">{t('net_profit')}</p>
                        <p className={cn("text-xl font-black", data.netProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
                           {fmt(data.netProfit)}
                        </p>
                        <div className="flex items-center gap-1 mt-2">
                           {data.netProfit >= 0 ? <ArrowUpRight size={14} className="text-emerald-500" /> : <ArrowDownRight size={14} className="text-red-500" />}
                           <span className="text-[9px] font-bold uppercase">{data.netProfit >= 0 ? 'Surplus' : 'Deficit'}</span>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-3">
                     <div className="flex justify-between items-center p-3 rounded-lg border border-border/40 bg-muted/10">
                        <span className="text-sm">{t('gross_profit')} (Revenue - COGS)</span>
                        <span className="font-bold text-emerald-600">{fmt(grossProfit)}</span>
                     </div>
                     <div className="flex justify-between items-center p-3 rounded-lg border border-border/40 bg-muted/10">
                        <span className="text-sm">Operating Profit (Gross - Expenses)</span>
                        <span className="font-bold">{fmt(data.netProfit)}</span>
                     </div>
                     <div className="flex justify-between items-center p-3 rounded-lg border-2 border-primary/20 bg-primary/5">
                        <span className="font-bold">Final Net Position</span>
                        <span className={cn("font-black text-lg", data.netProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
                           {fmt(data.netProfit)}
                        </span>
                     </div>
                  </div>
               </CardContent>
            </Card>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cash Flow Summary */}
            <Card className="shadow-sm">
               <CardHeader>
                  <CardTitle className="text-base">Payment Methods Distribution</CardTitle>
                  <CardDescription>Where your revenue is coming from</CardDescription>
               </CardHeader>
               <CardContent>
                  <div className="space-y-4">
                     {data.paymentStats.map((stat, i) => (
                        <div key={i} className="flex items-center justify-between group">
                           <div className="flex items-center gap-3">
                              <div className={cn(
                                 "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                                 stat.payment_method === 'cash' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                              )}>
                                 {stat.payment_method[0].toUpperCase()}
                              </div>
                              <div>
                                 <p className="text-sm font-medium capitalize">{stat.payment_method}</p>
                                 <p className="text-[10px] text-muted-foreground">{stat.count} Transactions</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="text-sm font-bold">{fmt(stat.revenue)}</p>
                              <p className="text-[10px] text-muted-foreground">{Math.round((stat.revenue / data.revenue) * 100) || 0}% of total</p>
                           </div>
                        </div>
                     ))}
                     {data.paymentStats.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm italic">No sales data for this period</div>
                     )}
                  </div>
               </CardContent>
            </Card>

            {/* Financial Health Tips */}
            <Card className="shadow-md border-amber-200 bg-amber-50 print:bg-white print:border-none">
               <CardHeader className="pb-3">
                  <CardTitle className="text-base text-amber-800 flex items-center gap-2">
                     <Activity size={18} /> Financial Insights
                  </CardTitle>
               </CardHeader>
               <CardContent className="space-y-3">
                  <div className="flex gap-3 items-start">
                     <div className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
                        <Filter size={12} className="text-amber-800" />
                     </div>
                     <p className="text-xs leading-relaxed text-amber-900/80">
                        Your <strong>{t('receivables')}</strong> represent money owed by customers. Excessive high values can lead to cash-flow issues.
                     </p>
                  </div>
                  <div className="flex gap-3 items-start">
                     <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center shrink-0">
                        <TrendingUp size={12} className="text-blue-800" />
                     </div>
                     <p className="text-xs leading-relaxed text-blue-900/80">
                        <strong>Net Profit</strong> is your true take-home after all costs. A healthy business should aim for at least 15-20% margin.
                     </p>
                  </div>
               </CardContent>
            </Card>
         </div>

      {/* Recent Activity Table with Preview */}
      <Card className="shadow-sm border-border/40 print:hidden">
         <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
               <CardTitle className="text-lg">Recent Financial Activity</CardTitle>
               <CardDescription>Latest transactions across all departments</CardDescription>
            </div>
            <div className="flex items-center gap-2">
               <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                     placeholder="Search activities..." 
                     className="h-9 pl-9 w-[200px] text-xs" 
                     value={activitySearch}
                     onChange={(e) => setActivitySearch(e.target.value)}
                  />
               </div>
               <Select value={activityFilter} onValueChange={(v: any) => setActivityFilter(v)}>
                  <SelectTrigger className="h-9 w-[120px] text-xs">
                     <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="all">All Types</SelectItem>
                     <SelectItem value="sale">Sales</SelectItem>
                     <SelectItem value="purchase">Purchases</SelectItem>
                     <SelectItem value="expense">Expenses</SelectItem>
                  </SelectContent>
               </Select>
            </div>
         </CardHeader>
         <CardContent className="p-0">
            <Table>
               <TableHeader className="bg-muted/30">
                  <TableRow>
                     <TableHead className="w-[120px]">Type</TableHead>
                     <TableHead>Description</TableHead>
                     <TableHead className="text-center">Date</TableHead>
                     <TableHead className="text-right">Amount</TableHead>
                     <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
               </TableHeader>
                <TableBody>
                   {filteredTransactions.slice(0, visibleActivityCount).map((txn, i) => (
                      <TableRow key={i} className="hover:bg-muted/20">
                         <TableCell>
                            <Badge 
                               variant="secondary" 
                               className={cn(
                                  "text-[10px] font-black uppercase tracking-tighter",
                                  txn.type === 'sale' ? "bg-emerald-100 text-emerald-700" :
                                  txn.type === 'purchase' ? "bg-blue-100 text-blue-700" :
                                  "bg-red-100 text-red-700"
                               )}
                            >
                               {txn.type}
                            </Badge>
                         </TableCell>
                         <TableCell className="font-medium text-sm">
                            {txn.type === 'sale' ? `Sale to ${txn.customer_name || 'Walk-in'}` :
                             txn.type === 'purchase' ? `Purchase from ${txn.vendor_name || 'Generic'}` :
                             txn.category || 'Expense'}
                         </TableCell>
                         <TableCell className="text-center text-xs text-muted-foreground">
                            {dayjs(txn.date).format('DD MMM, hh:mm A')}
                         </TableCell>
                         <TableCell className={cn(
                            "text-right font-bold",
                            txn.type === 'sale' ? "text-emerald-600" : "text-red-600"
                         )}>
                            {fmt(txn.amount)}
                         </TableCell>
                         <TableCell className="text-right flex justify-end gap-2">
                            {(txn.type === 'sale' || txn.type === 'purchase') && (
                               <>
                                  <Button 
                                     size="sm" 
                                     variant="outline" 
                                     className="h-8 gap-1.5 text-primary border-primary/20 hover:bg-primary/10 font-bold px-3"
                                     onClick={() => setPreviewInvoice({ ...txn, items: txn.items || [] })}
                                  >
                                     <Receipt size={14} /> Preview
                                  </Button>
                                  <Button 
                                     size="icon" 
                                     variant="ghost" 
                                     className="h-8 w-8 text-muted-foreground" 
                                     title="Print" 
                                     onClick={() => setPreviewInvoice({ ...txn, items: txn.items || [] })}
                                  >
                                     <Printer size={16} />
                                  </Button>
                               </>
                            )}
                         </TableCell>
                      </TableRow>
                   ))}
                   {filteredTransactions.length > visibleActivityCount && (
                      <TableRow>
                         <TableCell colSpan={5} className="text-center py-4">
                            <Button variant="ghost" className="text-xs font-bold gap-2 text-primary" onClick={() => setVisibleActivityCount(prev => prev + 10)}>
                               Show More Activity <Plus size={14} />
                            </Button>
                         </TableCell>
                      </TableRow>
                   )}
                   {filteredTransactions.length === 0 && (
                      <TableRow>
                         <TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">
                            No transactions found matching your search.
                         </TableCell>
                      </TableRow>
                   )}
                </TableBody>
            </Table>
         </CardContent>
      </Card>

         {showZakat && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
               <Card className="w-full max-w-lg shadow-2xl border-emerald-500/20 overflow-hidden">
                  <CardHeader className="bg-emerald-500/10 border-b relative">
                     <Button variant="ghost" size="icon" className="absolute right-4 top-4 rounded-full" onClick={() => setShowZakat(false)}>
                        <X size={18} />
                     </Button>
                     <CardTitle className="text-2xl font-black text-emerald-700 flex items-center gap-2">
                        <Wallet className="text-emerald-600" /> {t('zakat_calculator')}
                     </CardTitle>
                     <CardDescription className="text-emerald-900/60 font-medium">Annual Islamic Charity Calculation (2.5%)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                     <div className="grid grid-cols-1 gap-4">
                        <div className="p-4 rounded-xl border-2 border-emerald-100 bg-emerald-50/30">
                           <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-bold uppercase text-emerald-800">Threshold (Nisab)</span>
                              <span className="text-[10px] text-emerald-600 italic">Adjustable</span>
                           </div>
                           <div className="flex items-center gap-3">
                              <DollarSign size={18} className="text-emerald-500" />
                              <input
                                 type="number"
                                 value={nisab}
                                 onChange={(e) => setNisab(Number(e.target.value))}
                                 className="w-full bg-transparent border-none text-xl font-black focus:ring-0 p-0 text-emerald-900"
                              />
                           </div>
                        </div>

                        <div className="space-y-3">
                           <div className="flex justify-between text-sm py-2 border-b border-emerald-100">
                              <span className="text-muted-foreground flex items-center gap-2"><Package size={14} /> Stock-in-trade Value</span>
                              <span className="font-bold">{fmt(data.inventoryValue)}</span>
                           </div>
                           <div className="flex justify-between text-sm py-2 border-b border-emerald-100">
                              <span className="text-muted-foreground flex items-center gap-2"><Users size={14} /> Total Receivables</span>
                              <span className="font-bold">{fmt(data.receivables)}</span>
                           </div>
                           <div className="flex justify-between text-sm py-2 border-b-2 border-emerald-200">
                              <span className="text-emerald-800 font-bold flex items-center gap-2"><TrendingUp size={14} /> Total Zakatable Assets</span>
                              <span className="font-black text-emerald-900">{fmt(data.inventoryValue + data.receivables)}</span>
                           </div>
                        </div>

                        {(data.inventoryValue + data.receivables) >= nisab ? (
                           <div className="p-6 rounded-2xl bg-emerald-600 text-white shadow-xl shadow-emerald-600/30 animate-in zoom-in-95">
                              <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-80 text-emerald-100">Payable Zakat (2.5%)</p>
                              <h3 className="text-3xl font-black">{fmt((data.inventoryValue + data.receivables) * 0.025)}</h3>
                              <p className="text-xs mt-3 opacity-90 leading-relaxed font-medium">
                                 Your zakatable assets exceed the Nisab threshold. This amount is due annually on wealth held for one lunar year.
                              </p>
                           </div>
                        ) : (
                           <div className="p-6 rounded-2xl bg-slate-100 text-slate-600 border border-slate-200">
                              <p className="text-sm font-bold flex items-center gap-2"><Info size={16} /> Below Nisab Threshold</p>
                              <p className="text-xs mt-2 opacity-80 font-medium">
                                 Your current zakatable assets are below the specified Nisab threshold. Zakat is not mandatory at this time.
                              </p>
                           </div>
                        )}
                     </div>
                  </CardContent>
                  <CardFooter className="bg-muted/20 border-t p-4 flex justify-end">
                     <Button onClick={() => setShowZakat(false)} className="bg-emerald-600 hover:bg-emerald-700">Done</Button>
                  </CardFooter>
               </Card>
            </div>
         )}

         {/* Invoice Preview Modal (Universal) */}
         {previewInvoice && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
               <Card className="w-full max-w-2xl shadow-2xl overflow-hidden border-primary/20 animate-in zoom-in-95 duration-200">
                  <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between py-4">
                     <div>
                        <CardTitle className="text-xl font-bold flex items-center gap-2 text-primary">
                           <Receipt size={20} /> {previewInvoice.type === 'sale' ? 'Sales Invoice' : 'Purchase Invoice'} Preview
                        </CardTitle>
                        <CardDescription>Transaction #{previewInvoice.id}</CardDescription>
                     </div>
                     <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => setPreviewInvoice(null)}>
                        <X size={18} />
                     </Button>
                  </CardHeader>
                  <CardContent className="p-0 max-h-[70vh] overflow-y-auto">
                     <div className="p-8 bg-white text-slate-950 min-h-[400px]">
                        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
                           <div>
                              <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">
                                 {previewInvoice.type === 'sale' ? 'Sales Invoice' : 'Purchase Invoice'}
                              </h2>
                              <p className="text-sm text-slate-500 font-medium">#INV-{String(previewInvoice.id).padStart(5, '0')}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] font-black uppercase text-slate-400">Date Issued</p>
                              <p className="text-sm font-black">{dayjs(previewInvoice.date).format('DD MMMM YYYY')}</p>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 mb-8">
                           <div>
                              <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Party Details</h4>
                              <p className="font-black text-slate-800">
                                 {previewInvoice.type === 'sale' ? (previewInvoice.customer_name || 'Walk-in Customer') : (previewInvoice.vendor_name || 'Generic Vendor')}
                              </p>
                           </div>
                           <div className="text-right">
                              <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Transaction Info</h4>
                              <p className="text-sm text-slate-600"><span className="font-bold">Status:</span> Finalized</p>
                              <p className="text-sm text-slate-600"><span className="font-bold">ID:</span> {previewInvoice.id}</p>
                           </div>
                        </div>

                        <table className="w-full text-left mb-8">
                           <thead>
                              <tr className="border-b-2 border-slate-200">
                                 <th className="py-2 text-[10px] font-black uppercase text-slate-400">Item Description</th>
                                 <th className="py-2 text-[10px] font-black uppercase text-slate-400 text-right">Qty</th>
                                 <th className="py-2 text-[10px] font-black uppercase text-slate-400 text-right">Amount</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {(previewInvoice.items || []).map((item: any, idx: number) => (
                                 <tr key={idx}>
                                    <td className="py-3 text-sm font-bold text-slate-800">{item.product_name || item.name}</td>
                                    <td className="py-3 text-sm text-right font-medium">{item.quantity || item.quantity_added}</td>
                                    <td className="py-3 text-sm text-right font-black">PKR {Math.round((item.quantity || item.quantity_added) * (item.price || item.purchase_price)).toLocaleString()}</td>
                                 </tr>
                              ))}
                           </tbody>
                           <tfoot>
                              <tr className="border-t-2 border-slate-900">
                                 <td colSpan={2} className="py-4 text-sm font-black uppercase tracking-widest">Grand Total</td>
                                 <td className="py-4 text-lg text-right font-black text-slate-900 underline underline-offset-4 decoration-2">PKR {Math.round(previewInvoice.total || previewInvoice.amount).toLocaleString()}</td>
                              </tr>
                           </tfoot>
                        </table>
                     </div>
                  </CardContent>
                  <CardFooter className="bg-muted/30 border-t p-4 flex gap-3">
                     <Button variant="outline" className="flex-1 font-bold" onClick={() => setPreviewInvoice(null)}>Close Preview</Button>
                     <Button className="flex-1 font-black gap-2 h-11 text-lg shadow-lg shadow-primary/20" onClick={() => window.print()}>
                        <Printer size={18} /> PRINT INVOICE
                     </Button>
                  </CardFooter>
               </Card>
            </div>
          )}

      {/* Full Report Preview Modal */}
      {showReportPreview && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <Card className="w-full max-w-3xl shadow-2xl overflow-hidden border-primary/20 animate-in zoom-in-95 duration-200">
               <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between py-4">
                  <div>
                     <CardTitle className="text-xl font-bold flex items-center gap-2 text-primary">
                        <BarChart3 size={20} /> Financial Report Preview
                     </CardTitle>
                     <CardDescription>Consolidated Balance Sheet & Performance</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => setShowReportPreview(false)}>
                     <X size={18} />
                  </Button>
               </CardHeader>
               <CardContent className="p-0 max-h-[80vh] overflow-y-auto bg-white">
                  <div className="p-8 md:p-12 text-slate-900" id="printable-report">
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-4 border-slate-900 pb-6 mb-8 gap-4">
                        <div>
                           <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none">Financial Statement</h1>
                           <p className="text-slate-500 font-bold tracking-widest mt-2 text-[10px] md:text-xs">RETAILER POS SYSTEM - OFFICIAL REPORT</p>
                        </div>
                        <div className="text-left md:text-right">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report Period</p>
                           <p className="text-lg font-black capitalize text-primary">{range}</p>
                           <p className="text-[10px] text-slate-400 font-bold">{dayjs(data.period.start || new Date()).format('MMM DD, YYYY')} — {dayjs(data.period.end || new Date()).format('MMM DD, YYYY')}</p>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 mb-10">
                        <div className="space-y-4">
                           <h3 className="text-sm font-black border-b-2 border-slate-900/10 pb-2 flex items-center gap-2 text-slate-400">
                              <Package size={16} /> ASSETS SUMMARY
                           </h3>
                           <div className="space-y-3">
                              <div className="flex justify-between items-center group">
                                 <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Inventory Value</span>
                                 <span className="text-base font-black text-slate-900">{fmt(data.inventoryValue)}</span>
                              </div>
                              <div className="flex justify-between items-center group">
                                 <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Accounts Receivable</span>
                                 <span className="text-base font-black text-slate-900">{fmt(data.receivables)}</span>
                              </div>
                              <div className="pt-3 border-t-2 border-dashed border-slate-100 flex justify-between items-center">
                                 <span className="text-sm font-black text-slate-900 uppercase">Total Business Assets</span>
                                 <span className="text-xl font-black text-primary underline decoration-2 underline-offset-4">{fmt(data.inventoryValue + data.receivables)}</span>
                              </div>
                           </div>
                        </div>

                        <div className="space-y-4">
                           <h3 className="text-sm font-black border-b-2 border-slate-900/10 pb-2 flex items-center gap-2 text-slate-400">
                              <TrendingUp size={16} /> P&L PERFORMANCE
                           </h3>
                           <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                 <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Gross Revenue</span>
                                 <span className="text-base font-black text-emerald-600">+{fmt(data.revenue)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                 <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Stock Cost (COGS)</span>
                                 <span className="text-base font-black text-red-500">-{fmt(data.cogs)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                 <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Operational Expenses</span>
                                 <span className="text-base font-black text-red-500">-{fmt(data.expenses)}</span>
                              </div>
                              <div className={cn("pt-3 border-t-2 border-dashed border-slate-100 flex justify-between items-center", data.netProfit >= 0 ? "text-emerald-700" : "text-red-700")}>
                                 <span className="text-sm font-black uppercase">Net Profit / Loss</span>
                                 <span className="text-xl font-black border-b-4 border-double border-current leading-none pb-0.5">{fmt(data.netProfit)}</span>
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="bg-slate-900 text-white p-6 md:p-8 rounded-xl mb-10 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Final Net Position</p>
                           <h2 className="text-3xl md:text-4xl font-black">{fmt(data.netProfit)}</h2>
                        </div>
                        <div className="text-center md:text-right">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Performance Status</p>
                           <Badge className={cn("text-lg px-6 py-1.5 font-black rounded-lg shadow-lg", data.netProfit >= 0 ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600")}>
                              {data.netProfit >= 0 ? 'PROFITABLE' : 'DEFICIT'}
                           </Badge>
                        </div>
                     </div>

                     <div className="border-t border-slate-100 pt-8 flex flex-col md:flex-row justify-between gap-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        <div className="flex items-center gap-4">
                           <p>Generated: {dayjs().format('DD MMM YYYY, HH:mm')}</p>
                           <span className="opacity-30">|</span>
                           <p>System ID: {Math.random().toString(36).substring(7).toUpperCase()}</p>
                        </div>
                        <p>Retailer POS - Official Financial Record</p>
                     </div>
                  </div>
               </CardContent>
               <CardFooter className="bg-muted/30 border-t p-4 flex gap-3">
                  <Button variant="outline" className="flex-1 font-bold" onClick={() => setShowReportPreview(false)}>Cancel</Button>
                  <Button className="flex-1 font-black gap-2 h-11 text-lg shadow-lg shadow-primary/20" onClick={() => window.print()}>
                     <Printer size={18} /> GENERATE PHYSICAL REPORT
                  </Button>
               </CardFooter>
            </Card>
         </div>
      )}

      {/* Quick Creator Dialog */}
      {showCreator && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in zoom-in-95">
            <Card className="w-full max-w-md shadow-2xl border-primary/20 overflow-hidden">
               <CardHeader className="bg-primary/5 border-b relative">
                  <Button variant="ghost" size="icon" className="absolute right-4 top-4 rounded-full" onClick={() => setShowCreator(false)}>
                     <X size={18} />
                  </Button>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                     {creatorType === 'sale' ? <ShoppingCart className="text-emerald-600" /> : 
                      creatorType === 'purchase' ? <ShoppingBag className="text-blue-600" /> : 
                      <TrendingDown className="text-red-600" />}
                     Quick {creatorType.charAt(0).toUpperCase() + creatorType.slice(1)}
                  </CardTitle>
                  <CardDescription>Instant record entry for the Balance Sheet</CardDescription>
               </CardHeader>
               <form onSubmit={handleQuickCreate}>
                  <CardContent className="space-y-4 pt-6">
                     <div className="space-y-2">
                        <label className="text-sm font-bold uppercase text-muted-foreground">Amount (PKR)</label>
                        <div className="relative">
                           <DollarSign size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                           <Input 
                              type="number" 
                              required 
                              autoFocus
                              placeholder="0.00" 
                              className="pl-10 h-12 text-xl font-black border-2 border-primary/10 focus:border-primary/40"
                              value={creatorData.amount}
                              onChange={(e) => setCreatorData({...creatorData, amount: e.target.value})}
                           />
                        </div>
                     </div>
                     
                     <div className="space-y-2">
                        <label className="text-sm font-bold uppercase text-muted-foreground">
                           {creatorType === 'sale' ? 'Customer Name' : creatorType === 'purchase' ? 'Vendor Name' : 'Expense Description'}
                        </label>
                        <Input 
                           placeholder={creatorType === 'expense' ? "e.g. Electricity Bill" : "Optional name"} 
                           value={creatorData.description}
                           onChange={(e) => setCreatorData({...creatorData, description: e.target.value})}
                        />
                     </div>

                     {creatorType !== 'expense' && (
                        <div className="space-y-2">
                           <label className="text-sm font-bold uppercase text-muted-foreground">Quantity / Items</label>
                           <Input 
                              type="number" 
                              value={creatorData.items_count}
                              onChange={(e) => setCreatorData({...creatorData, items_count: e.target.value})}
                           />
                        </div>
                     )}
                  </CardContent>
                  <CardFooter className="bg-muted/30 border-t p-4 flex gap-3">
                     <Button type="button" variant="outline" className="w-full" onClick={() => setShowCreator(false)}>Cancel</Button>
                     <Button type="submit" className="w-full font-bold" disabled={creatorLoading}>
                        {creatorLoading ? <Loader2 className="animate-spin" /> : `Record ${creatorType}`}
                     </Button>
                  </CardFooter>
               </form>
            </Card>
         </div>
      )}


         <div className="hidden print:block mt-12 pt-8 border-t text-center text-xs text-muted-foreground">
            <p>Generated by Retailer POS System on {dayjs().format('DD MMMM YYYY [at] hh:mm A')}</p>
            <p className="mt-1 italic">This is a system generated report and does not require a signature.</p>
         </div>
      </div>
   );
}
