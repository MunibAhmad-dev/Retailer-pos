import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Trash2, Calendar, FileText, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useNotifications } from '../components/NotificationProvider';
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton } from '../components/Pagination';

interface Expense {
  id: number;
  title: string;
  category: string;
  amount: number;
  date_added: string;
  notes: string;
}

const fmtPKR = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-PK');

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [currentRegister, setCurrentRegister] = useState<any>(null);

  const { addNotification } = useNotifications();

  useEffect(() => {
    load();
    checkRegister();
  }, []);

  const checkRegister = async () => {
    try {
      const res = await window.api.getCurrentRegister();
      if (res.success) {
        setCurrentRegister(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await window.api.getExpenses();
      if (res?.success) setExpenses(res.data);
    } catch {
      addNotification("Error", "Could not load expenses.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt <= 0) return;

      const res = await window.api.addExpense({
        title,
        category,
        amount: amt,
        notes,
        register_id: currentRegister?.id || null
      });
      if (res.success) {
        addNotification("Expense Added", "Expense record was saved.", "success");
        setShowAdd(false);
        setTitle(''); setCategory(''); setAmount(''); setNotes('');
        load();
      }
    } catch {
      addNotification("Error", "Failed to add expense.", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this expense record?")) return;
    try {
      const res = await window.api.deleteExpense(id);
      if (res.success) {
        addNotification("Deleted", "Expense was removed.", "info");
        load();
      }
    } catch {
      addNotification("Error", "Failed to delete expense.", "error");
    }
  };

  const currentMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date_added);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((acc, e) => acc + e.amount, 0);

  const { visible: visibleExpenses, hasMore, loadMore, total: eTotal, showing } = usePagination(expenses, 10, 1);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shop Expenses</h1>
          <p className="text-muted-foreground text-sm mt-1">Track operational costs like rent, electricity, and salaries</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} className="gap-2 shadow-sm font-semibold">
          <Plus size={16} /> Add Expense
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="bg-red-500/10 p-2.5 rounded-lg border border-red-500/20 text-red-500"><Activity size={20} /></div>
            <div>
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">This Month</CardTitle>
              <div className="text-2xl font-bold font-mono tracking-tight mt-1">{fmtPKR(currentMonthExpenses)}</div>
            </div>
          </CardHeader>
        </Card>
        <Card className="shadow-sm border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="bg-orange-500/10 p-2.5 rounded-lg border border-orange-500/20 text-orange-500"><FileText size={20} /></div>
            <div>
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Records</CardTitle>
              <div className="text-2xl font-bold font-mono tracking-tight mt-1">{expenses.length}</div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {showAdd && (
        <Card className="border-red-500/30 shadow-md animate-in slide-in-from-top-4">
          <CardHeader className="bg-red-500/5 pb-4 border-b">
            <CardTitle className="text-lg text-red-600 flex items-center gap-2"><DollarSign size={18} /> Log New Expense</CardTitle>
            <CardDescription>This will be deducted from your Gross Profit in the P&L report.</CardDescription>
          </CardHeader>
          <form onSubmit={handleAdd}>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Expense Title <span className="text-destructive">*</span></label>
                  <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. November Rent" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Amount (PKR) <span className="text-destructive">*</span></label>
                  <Input type="number" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Category</label>
                  <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Utilities, Rent, Salary" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Notes</label>
                  <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional description" />
                </div>
              </div>
            </CardContent>
            <div className="p-4 border-t bg-muted/20 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700">Save Expense</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Date</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right pr-6">Amount</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground animate-pulse">Loading expenses...</TableCell></TableRow>
              ) : expenses.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No expenses recorded yet.</TableCell></TableRow>
              ) : visibleExpenses.map(e => (
                <TableRow key={e.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-xs">{new Date(e.date_added).toLocaleDateString()}</TableCell>
                  <TableCell className="font-bold">{e.title}</TableCell>
                  <TableCell><span className="text-xs bg-muted px-2 py-1 rounded-md">{e.category || 'Misc'}</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{e.notes || '—'}</TableCell>
                  <TableCell className="text-right pr-6 font-bold text-red-600">-{fmtPKR(e.amount)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(e.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <div className="px-4">
          <LoadMoreButton hasMore={hasMore} onLoadMore={loadMore} showing={showing} total={eTotal} />
        </div>
      </Card>
    </div>
  );
}
