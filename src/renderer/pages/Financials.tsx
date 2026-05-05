import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Plus, Trash2, Calendar, FileText, 
  ArrowUpCircle, ArrowDownCircle, Wallet, History,
  TrendingUp, TrendingDown, Landmark, PieChart, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { useNotifications } from '../components/NotificationProvider';
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton } from '../components/Pagination';
import { cn } from '../lib/utils';

interface FinancialTransaction {
  id: number;
  type: 'Income' | 'Expense';
  category: string;
  amount: number;
  description: string;
  register_id: number | null;
  date_created: string;
}

const fmtPKR = (n: number) => 'Rs. ' + Math.round(n || 0).toLocaleString('en-PK');

export default function Financials() {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRegister, setCurrentRegister] = useState<any>(null);
  
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState<'Income' | 'Expense'>('Income');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const { addNotification } = useNotifications();

  useEffect(() => { 
    load();
    checkRegister();
  }, []);

  const checkRegister = async () => {
    try {
      const res = await window.api.getCurrentRegister();
      if (res.success) setCurrentRegister(res.data);
    } catch (err) { console.error(err); }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await window.api.getFinancialTransactions();
      if (res?.success) {
        setTransactions(res.data);
      } else {
        addNotification("Error", res?.error || "Could not load transactions.", "error");
      }
    } catch (err: any) {
      addNotification("Error", err.message || "Could not load transactions.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt <= 0) return;

      const res = await window.api.addFinancialTransaction({ 
        type, 
        category, 
        amount: amt, 
        description,
        register_id: currentRegister?.id || null
      });
      if (res.success) {
        addNotification("Transaction Recorded", "The financial entry has been saved.", "success");
        setShowAdd(false);
        setCategory(''); setAmount(''); setDescription('');
        load();
      } else {
        addNotification("Error", res.error || "Failed to save transaction.", "error");
      }
    } catch (err: any) {
      addNotification("Error", err.message || "Failed to save transaction.", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this financial record?")) return;
    try {
      const res = await window.api.deleteFinancialTransaction(id);
      if (res.success) {
        addNotification("Deleted", "Record was removed.", "info");
        load();
      }
    } catch {
      addNotification("Error", "Failed to delete record.", "error");
    }
  };

  const totals = transactions.reduce((acc, t) => {
    if (t.type === 'Income') acc.income += t.amount;
    else acc.expense += t.amount;
    return acc;
  }, { income: 0, expense: 0 });

  const { visible: visibleItems, hasMore, loadMore, total: tTotal, showing } = usePagination(transactions, 10, 1);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage cash injections, drawings, and miscellaneous business finance</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} className="gap-2 shadow-sm font-semibold">
          <Plus size={16} /> Add Transaction
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="bg-emerald-500/10 p-2.5 rounded-lg text-emerald-600"><ArrowUpCircle size={20} /></div>
            <div>
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Misc Income</CardTitle>
              <div className="text-2xl font-bold text-emerald-600">{fmtPKR(totals.income)}</div>
            </div>
          </CardHeader>
        </Card>
        <Card className="bg-red-500/5 border-red-500/20">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="bg-red-500/10 p-2.5 rounded-lg text-red-600"><ArrowDownCircle size={20} /></div>
            <div>
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Misc Expenses</CardTitle>
              <div className="text-2xl font-bold text-red-600">{fmtPKR(totals.expense)}</div>
            </div>
          </CardHeader>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="bg-primary/10 p-2.5 rounded-lg text-primary"><Wallet size={20} /></div>
            <div>
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Net Cash Flow</CardTitle>
              <div className="text-2xl font-bold text-primary">{fmtPKR(totals.income - totals.expense)}</div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {showAdd && (
        <Card className="border-primary/30 shadow-md animate-in slide-in-from-top-4">
          <CardHeader className="bg-primary/5 pb-4 border-b">
            <CardTitle className="text-lg flex items-center gap-2"><DollarSign size={18}/> New Financial Entry</CardTitle>
            <CardDescription>Log non-operational income or expenses here.</CardDescription>
          </CardHeader>
          <form onSubmit={handleAdd}>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                   <label className="text-sm font-semibold">Transaction Type</label>
                   <div className="flex gap-2">
                      <Button 
                        type="button"
                        variant={type === 'Income' ? 'default' : 'outline'}
                        className={cn("flex-1 gap-2", type === 'Income' && "bg-emerald-600 hover:bg-emerald-700")}
                        onClick={() => setType('Income')}
                      >
                        <ArrowUpCircle size={16} /> Income
                      </Button>
                      <Button 
                        type="button"
                        variant={type === 'Expense' ? 'default' : 'outline'}
                        className={cn("flex-1 gap-2", type === 'Expense' && "bg-red-600 hover:bg-red-700")}
                        onClick={() => setType('Expense')}
                      >
                        <ArrowDownCircle size={16} /> Expense
                      </Button>
                   </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Amount (PKR) <span className="text-destructive">*</span></label>
                  <Input type="number" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" autoFocus />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Category</label>
                  <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Capital Injection, Drawing, Refund" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Description</label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Who, why, what..." />
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t bg-muted/20 flex justify-end gap-3 p-4">
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" className="font-bold">Record Entry</Button>
            </CardFooter>
          </form>
        </Card>
      )}

      <Card className="shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Shift</TableHead>
                <TableHead className="text-right pr-6">Amount</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground animate-pulse">Loading data...</TableCell></TableRow>
              ) : visibleItems.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No financial records found.</TableCell></TableRow>
              ) : visibleItems.map(item => (
                <TableRow key={item.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {new Date(item.date_created).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "font-bold text-[10px]",
                      item.type === 'Income' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                    )}>
                      {item.type.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{item.category}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">{item.description || '—'}</TableCell>
                  <TableCell className="text-center">
                    {item.register_id ? (
                      <Badge variant="ghost" className="text-[10px] bg-slate-100">#{item.register_id}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-[10px]">Manual</span>
                    )}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right pr-6 font-bold",
                    item.type === 'Income' ? "text-emerald-600" : "text-red-600"
                  )}>
                    {item.type === 'Income' ? '+' : '-'}{fmtPKR(item.amount)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(item.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <div className="px-4">
          <LoadMoreButton hasMore={hasMore} onLoadMore={loadMore} showing={showing} total={tTotal} />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <Card className="border-blue-500/20 bg-blue-500/5 shadow-none">
            <CardHeader className="pb-3">
               <CardTitle className="text-base flex items-center gap-2"><Landmark size={18} className="text-blue-600"/> Financial Advice</CardTitle>
            </CardHeader>
            <CardContent>
               <p className="text-xs text-blue-900/70 leading-relaxed">
                  Regularly record all <strong>Cash Injections</strong> (Owner Investments) and <strong>Drawings</strong> (Owner Withdrawals) to keep your Balance Sheet accurate. These entries are automatically linked to your current open shift for easy daily auditing.
               </p>
            </CardContent>
         </Card>
         <Card className="border-amber-500/20 bg-amber-500/5 shadow-none">
            <CardHeader className="pb-3">
               <CardTitle className="text-base flex items-center gap-2"><Info size={18} className="text-amber-600"/> Note</CardTitle>
            </CardHeader>
            <CardContent>
               <p className="text-xs text-amber-900/70 leading-relaxed">
                  The transactions listed here represent "Non-Operating" cash flow. For day-to-day operational costs like utilities and rent, use the <strong>Expenses</strong> module instead.
               </p>
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
