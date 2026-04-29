import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, Search, UserCheck, Activity, ArrowRight, Wallet, History, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { useNotifications } from '../components/NotificationProvider';
import { useNavigate } from 'react-router-dom';
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton, SearchSpinner } from '../components/Pagination';

interface CustomerLoan {
  id: number;
  name: string;
  phone?: string;
  balance: number;
  total_spent: number;
}

export default function Loans() {
  const [customers, setCustomers] = useState<CustomerLoan[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await window.api.getCustomers();
      if (res.success) {
        // Filter only those who have an active loan/debt (balance > 0)
        const inDebt = (res.data || []).filter((c: any) => c.balance > 0);
        setCustomers(inDebt);
      } else {
        addNotification("Error", "Failed to load loan data", "error");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (v: string) => {
    setIsSearching(true);
    setSearchTerm(v);
    setTimeout(() => setIsSearching(false), 200);
  };

  const filteredCustomers = useMemo(() => customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone && c.phone.includes(searchTerm))
  ), [customers, searchTerm]);

  const { visible: visibleCustomers, hasMore, loadMore, total: pTotal, showing } = usePagination(filteredCustomers, 10, 1);

  const totalOutstanding = customers.reduce((acc, c) => acc + (c.balance || 0), 0);

  const fmt = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-PK');

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10 animate-in fade-in">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-destructive flex items-center gap-2">
            <Wallet size={28} /> Loan Tracking (Qaraz)
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Monitor outstanding customer balances</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-destructive/10 border-destructive/20 shadow-md">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-destructive font-medium uppercase text-xs tracking-wider">Total Outstanding Debt</CardTitle>
            <AlertTriangle size={20} className="text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-destructive tracking-tight">{fmt(totalOutstanding)}</div>
            <p className="text-sm text-destructive/80 mt-1">Across {customers.length} customers</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Search Records</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 pr-9 bg-card h-12 shadow-sm"
              />
              <SearchSpinner visible={isSearching} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-border/50">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2">
             <History size={18} /> Active Debtors
          </CardTitle>
          <CardDescription>Customers with pending payments</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
             <div className="flex justify-center items-center py-20 text-muted-foreground">
               <Activity size={32} className="animate-spin text-primary opacity-50" />
             </div>
          ) : filteredCustomers.length === 0 ? (
             <div className="flex flex-col justify-center items-center py-20 text-muted-foreground">
               <UserCheck size={48} className="opacity-20 mb-4" />
               <p className="text-lg font-medium text-foreground">All Clear!</p>
               <p className="text-sm">No outstanding loans found.</p>
             </div>
          ) : (
            <div className="divide-y divide-border">
              {visibleCustomers.map(customer => (
                <div key={customer.id} className="flex flex-col sm:flex-row items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                   <div className="flex items-center gap-4 w-full sm:w-auto mb-4 sm:mb-0">
                      <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center font-bold text-lg">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                         <h4 className="font-semibold text-lg">{customer.name}</h4>
                         <p className="text-sm text-muted-foreground">{customer.phone || 'No phone'}</p>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                         <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Due Balance</p>
                         <p className="font-bold text-lg text-destructive">{fmt(customer.balance)}</p>
                      </div>
                      
                      <Button 
                        onClick={() => navigate(`/customers?customer_id=${customer.id}`)} 
                        variant="secondary"
                        className="gap-2 shadow-sm whitespace-nowrap"
                      >
                         Settle <ArrowRight size={16} />
                      </Button>
                   </div>
                </div>
              ))}
              <div className="px-4">
                <LoadMoreButton hasMore={hasMore} onLoadMore={loadMore} showing={showing} total={pTotal} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
