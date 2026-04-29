import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Users, Pencil, Trash2, Mail, Phone, MessageCircle, DollarSign, ArrowRight, History, ShoppingBag, CreditCard, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { useNotifications } from '../components/NotificationProvider';
import { useNavigate } from 'react-router-dom';
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton, SearchSpinner } from '../components/Pagination';

interface Customer {
  id?: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [current, setCurrent] = useState<Customer>({ name: '', phone: '', email: '', address: '' });
  const [isEditing, setIsEditing] = useState(false);
  
  // Details view state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const res = await window.api.getCustomers();
      if (res.success) {
        setCustomers(res.data || []);
      } else {
        addNotification("Error", res.error || "Failed to load customers", "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadCustomerDetails = async (id: number) => {
    try {
      const res = await window.api.getCustomerDetails(id);
      if (res.success) {
        setCustomerDetails(res.data);
      } else {
        addNotification("Error", res.error || "Failed to load details", "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerDetails(null);
    if (c.id) loadCustomerDetails(c.id);
  };

  const closeCustomer = () => {
    setSelectedCustomer(null);
    setCustomerDetails(null);
    setPaymentAmount('');
  };

  const handleSearch = (v: string) => {
    setIsSearching(true);
    setSearchTerm(v);
    setTimeout(() => setIsSearching(false), 200);
  };

  const filteredCustomers = useMemo(() => customers.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || '').includes(searchTerm)
  ), [customers, searchTerm]);

  const { visible: visibleCustomers, hasMore, loadMore, total, showing } = usePagination(filteredCustomers, 10, 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current.name.trim()) {
       addNotification("Validation Error", "Customer name is required.", "warning");
       return;
    }

    if (isEditing && current.id) {
      const res = await window.api.updateCustomer(current.id, current);
      if (res.success) {
        addNotification("Customer updated", `${current.name} updated successfully.`, "success");
        loadCustomers();
        setShowDialog(false);
      }
    } else {
      const res = await window.api.addCustomer(current);
      if (res.success) {
        addNotification("Customer added", `${current.name} added to database.`, "success");
        loadCustomers();
        setShowDialog(false);
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (!id) return;
    if (confirm("Are you sure you want to delete this customer?")) {
      const res = await window.api.deleteCustomer(id);
      if (res.success) {
        addNotification("Customer deleted", "Customer record removed entirely.", "info");
        loadCustomers();
      }
    }
  };

  const handleAddPayment = async () => {
    if (!selectedCustomer?.id || !paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0) {
      addNotification("Validation", "Please enter a valid amount.", "warning");
      return;
    }
    setPaymentLoading(true);
    const res = await window.api.addCustomerPayment({
      customer_id: selectedCustomer.id,
      amount: Number(paymentAmount),
      notes: "Manual Payment"
    });
    if (res.success) {
      addNotification("Payment Added", `PKR ${paymentAmount} has been recorded.`, "success");
      setPaymentAmount('');
      loadCustomerDetails(selectedCustomer.id);
    } else {
      addNotification("Error", res.error || "Payment failed", "error");
    }
    setPaymentLoading(false);
  };

  const handleMarkAllPaid = async () => {
    if (!selectedCustomer?.id || !customerDetails?.balance) return;
    if (customerDetails.balance <= 0) {
      addNotification("Info", "Balance is already 0.", "info");
      return;
    }
    setPaymentLoading(true);
    const res = await window.api.addCustomerPayment({
      customer_id: selectedCustomer.id,
      amount: customerDetails.balance,
      notes: "Marked All as Paid"
    });
    if (res.success) {
      addNotification("Settled", `Customer balance settled.`, "success");
      loadCustomerDetails(selectedCustomer.id);
    }
    setPaymentLoading(false);
  };

  const sendWhatsApp = () => {
    if (!selectedCustomer?.phone) {
      addNotification("No Phone", "Customer doesn't have a phone number.", "warning");
      return;
    }
    let number = selectedCustomer.phone.replace(/[^0-9]/g, '');
    if (number.startsWith('0')) {
      number = '92' + number.substring(1);
    }
    const balance = customerDetails?.balance || 0;
    const msg = `Hello ${selectedCustomer.name},\nThis is a gentle reminder that your pending balance is PKR ${balance}. Please clear it at your earliest convenience. Thank you!`;
    const url = `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Combine sales and payments for history timeline
  let historyLogs: any[] = [];
  if (customerDetails) {
    const sales = (customerDetails.sales || []).map((s: any) => ({ ...s, type: 'SALE', date: s.date_created }));
    const payments = (customerDetails.payments || []).map((p: any) => ({ ...p, type: 'PAYMENT', date: p.date_added }));
    historyLogs = [...sales, ...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  return (
    <div className="flex gap-6 animate-in fade-in max-w-[1600px] h-full relative">
      <div className={`flex-1 transition-all duration-300 ${selectedCustomer ? 'hidden md:flex md:w-1/2 lg:w-2/3' : 'w-full'}`}>
        <div className="flex flex-col gap-6 w-full">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Customers & Credit</h1>
              <p className="text-muted-foreground text-sm mt-1">Manage customers, loans (Qaraz), and payments</p>
            </div>
            <Button onClick={() => { setCurrent({ name: '', phone: '', email: '', address: '' }); setIsEditing(false); setShowDialog(true); }} className="gap-2 shadow-sm">
              <Plus size={16} /> New Customer
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input 
              type="text" 
              placeholder="Search by name or phone..." 
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 pr-9 h-11 text-base shadow-sm bg-card"
            />
            <SearchSpinner visible={isSearching} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
            {filteredCustomers.length === 0 ? (
              <div className="col-span-full py-20 text-center flex flex-col items-center">
                <Users size={48} className="text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground font-medium">No customers found.</p>
              </div>
            ) : (
              visibleCustomers.map(c => (
                <Card key={c.id} className={`cursor-pointer hover:border-primary/50 transition-all shadow-sm ${selectedCustomer?.id === c.id ? 'border-primary ring-1 ring-primary/30' : ''}`} onClick={() => openCustomer(c)}>
                  <CardContent className="p-5 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-lg leading-tight line-clamp-1">{c.name}</div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-blue-500" onClick={(e) => { e.stopPropagation(); setCurrent({...c}); setIsEditing(true); setShowDialog(true); }}>
                          <Pencil size={12} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={(e) => handleDelete(e, c.id)}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                    {c.phone ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone size={14} className="opacity-70" /> {c.phone}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground/50 italic">No phone</div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <LoadMoreButton hasMore={hasMore} onLoadMore={loadMore} showing={showing} total={total} />
        </div>
      </div>

      {/* Customer Details Drawer / Sidebar */}
      {selectedCustomer && (
        <Card className="flex flex-col w-full md:w-1/2 lg:w-1/3 absolute md:relative right-0 h-[calc(100vh-100px)] shadow-2xl border-l md:border-l-0 z-10 bg-background/95 backdrop-blur-md animate-in slide-in-from-right-8">
          <CardHeader className="border-b bg-muted/20 pb-4 relative">
            <Button variant="ghost" size="icon" className="absolute right-4 top-4 rounded-full" onClick={closeCustomer}>
              <X size={18} />
            </Button>
            <CardTitle className="text-2xl font-bold pr-10">{selectedCustomer.name}</CardTitle>
            <CardDescription className="flex flex-col gap-1 mt-2">
              {selectedCustomer.phone && <span className="flex items-center gap-2"><Phone size={14}/> {selectedCustomer.phone}</span>}
              {selectedCustomer.address && <span className="text-xs">Address: {selectedCustomer.address}</span>}
            </CardDescription>
            
            <div className="flex gap-2 mt-4">
              <Button size="sm" className="flex-1 gap-2 bg-green-600 hover:bg-green-700" onClick={sendWhatsApp}>
                <MessageCircle size={16} /> WhatsApp
              </Button>
              <Button size="sm" variant="outline" className="flex-1 gap-2" onClick={() => navigate(`/sales?customer_id=${selectedCustomer.id}`)}>
                <ShoppingBag size={16} /> New Sale
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-0">
            {!customerDetails ? (
              <div className="p-8 text-center text-muted-foreground animate-pulse">Loading details...</div>
            ) : (
              <div className="flex flex-col">
                {/* Financial Overview */}
                <div className="grid grid-cols-2 gap-4 p-5 bg-card border-b">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Total Taken</span>
                    <span className="text-lg font-bold text-foreground">PKR {customerDetails.totalTaken?.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Total Paid</span>
                    <span className="text-lg font-bold text-emerald-600">PKR {customerDetails.totalPaid?.toLocaleString()}</span>
                  </div>
                  <div className="col-span-2 mt-2 pt-4 border-t flex items-center justify-between">
                    <span className="text-sm font-semibold uppercase">Remaining Balance</span>
                    <span className={`text-2xl font-black ${customerDetails.balance > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                      PKR {Math.abs(customerDetails.balance || 0).toLocaleString()} {customerDetails.balance < 0 ? '(Credit)' : ''}
                    </span>
                  </div>
                </div>

                {/* Payment Entry */}
                <div className="p-5 border-b bg-muted/10">
                  <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><CreditCard size={16}/> Record Payment</h4>
                  <div className="flex gap-2">
                    <Input 
                      type="number" 
                      placeholder="Amount to pay..." 
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="flex-1"
                    />
                    <Button disabled={paymentLoading} onClick={handleAddPayment}>Add</Button>
                  </div>
                  {customerDetails.balance > 0 && (
                    <Button variant="outline" className="w-full mt-2 text-primary" onClick={handleMarkAllPaid} disabled={paymentLoading}>
                      Mark All as Paid
                    </Button>
                  )}
                </div>

                {/* History Log */}
                <div className="p-5">
                  <h4 className="text-sm font-bold mb-4 flex items-center gap-2"><History size={16}/> Complete History</h4>
                  <div className="flex flex-col gap-4 relative before:absolute before:inset-y-0 before:left-[11px] before:w-px before:bg-border pb-10">
                    {historyLogs.length === 0 ? (
                      <div className="text-sm text-muted-foreground pl-8">No history found.</div>
                    ) : (
                      historyLogs.map((log, i) => (
                        <div key={i} className="relative pl-8">
                          <div className={`absolute left-0 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-background z-10 ${log.type === 'SALE' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {log.type === 'SALE' ? <ShoppingBag size={10} /> : <DollarSign size={10} />}
                          </div>
                          <div className="bg-card border rounded-lg p-3 shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-sm">{log.type === 'SALE' ? 'Purchase/Loan' : 'Payment Received'}</span>
                              <span className={`font-bold text-sm ${log.type === 'SALE' ? 'text-destructive' : 'text-emerald-600'}`}>
                                {log.type === 'SALE' ? '-' : '+'} PKR {(log.total || log.amount || 0).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-2">
                              <span>{new Date(log.date).toLocaleString()}</span>
                              {log.notes && <span>{log.notes}</span>}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog for Edit / Add */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl">
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>{isEditing ? 'Edit Customer' : 'Add New Customer'}</CardTitle>
                <CardDescription>Enter contact details below.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Full Name <span className="text-destructive">*</span></label>
                  <Input type="text" required value={current.name} onChange={(e) => setCurrent({ ...current, name: e.target.value })} placeholder="e.g. John Doe" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Phone Number</label>
                  <Input type="tel" value={current.phone || ''} onChange={(e) => setCurrent({ ...current, phone: e.target.value })} placeholder="0300 1234567" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Address</label>
                  <Input type="text" value={current.address || ''} onChange={(e) => setCurrent({ ...current, address: e.target.value })} placeholder="Shop 12, Main Bazar" />
                </div>
              </CardContent>
              <CardFooter className="flex gap-3 pt-4 border-t">
                <Button type="button" variant="outline" className="w-full" onClick={() => setShowDialog(false)}>Cancel</Button>
                <Button type="submit" className="w-full">{isEditing ? 'Save Changes' : 'Create Customer'}</Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
