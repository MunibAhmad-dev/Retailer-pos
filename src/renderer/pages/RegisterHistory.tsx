import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Wallet, Calendar, User, ArrowRight, Download, Search, Filter, Clock, CheckCircle2, XCircle, ShieldAlert, Activity } from 'lucide-react';
import { Input } from '../components/ui/input';
import { useNotifications } from '../components/NotificationProvider';
import { cn } from '../lib/utils';

const fmtPKR = (n: number) => 'Rs. ' + Math.round(n || 0).toLocaleString('en-PK');

export default function RegisterHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { addNotification } = useNotifications();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await window.api.getRegisterHistory();
      if (res.success) {
        setHistory(res.data);
      } else {
        addNotification("Error", res.error || "Could not load register history", "error");
      }
    } catch (err: any) {
      addNotification("Error", err.message || "Could not load register history", "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter(h => 
    h.opened_by.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (h.closed_by && h.closed_by.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Register History</h1>
          <p className="text-muted-foreground text-sm mt-1">Review past cash register sessions and shift summaries</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input 
              placeholder="Search by employee..." 
              className="pl-10 h-10" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={loadHistory} className="h-10 gap-2">
             <Clock size={16} /> Refresh
          </Button>
        </div>
      </div>

      <Card className="shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-12 text-center">ID</TableHead>
                <TableHead>Session Period</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Sales (Cash/Other)</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="h-32 text-center text-muted-foreground animate-pulse">Loading history...</TableCell></TableRow>
              ) : filteredHistory.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="h-32 text-center text-muted-foreground">No register history found.</TableCell></TableRow>
              ) : filteredHistory.map((h) => {
                const diff = (h.closing_balance_actual || 0) - (h.closing_balance_expected || 0);
                const isShort = diff < 0;
                const isOver = diff > 0;
                const isPerfect = diff === 0;

                return (
                  <TableRow key={h.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">#{h.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm flex items-center gap-1">
                          <Calendar size={12} className="text-muted-foreground" /> {new Date(h.opened_at).toLocaleDateString()}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock size={10} /> {new Date(h.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {h.closed_at ? new Date(h.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ongoing'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm flex items-center gap-1">
                          <User size={12} className="text-primary" /> {h.opened_by}
                        </span>
                        {h.closed_by && h.closed_by !== h.opened_by && (
                          <span className="text-[10px] text-muted-foreground">Closed by: {h.closed_by}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtPKR(h.opening_balance)}</TableCell>
                    <TableCell className="text-right">
                       <div className="flex flex-col items-end">
                          <span className="text-sm font-bold text-emerald-600">+{fmtPKR(h.cash_sales)}</span>
                          <span className="text-[10px] text-blue-500">Other: {fmtPKR(h.other_sales)}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-red-500">-{fmtPKR(h.total_expenses)}</TableCell>
                    <TableCell className="text-right font-black text-slate-700">{fmtPKR(h.closing_balance_expected)}</TableCell>
                    <TableCell className="text-right">
                       {h.status === 'Open' ? (
                         <span className="text-muted-foreground text-xs italic">Active...</span>
                       ) : (
                         <div className="flex flex-col items-end">
                            <span className="font-black text-primary">{fmtPKR(h.closing_balance_actual)}</span>
                            {h.status === 'Closed' && (
                              <span className={cn(
                                "text-[10px] font-bold px-1.5 rounded-sm",
                                isPerfect ? "text-emerald-600 bg-emerald-50" : 
                                isShort ? "text-red-600 bg-red-50" : "text-amber-600 bg-amber-50"
                              )}>
                                {isPerfect ? 'Balanced' : `${isShort ? 'Short' : 'Over'}: ${fmtPKR(Math.abs(diff))}`}
                              </span>
                            )}
                         </div>
                       )}
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge className={cn(
                         "font-bold text-[10px] uppercase tracking-wider",
                         h.status === 'Open' ? "bg-emerald-500 animate-pulse" : "bg-slate-500"
                       )}>
                         {h.status}
                       </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
