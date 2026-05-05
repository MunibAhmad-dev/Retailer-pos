import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, Search, UserCheck, Activity, ArrowRight, Wallet, History, AlertTriangle, FileText, Download, MessageCircle, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useNotifications } from '../components/NotificationProvider';
import { useNavigate } from 'react-router-dom';
import { usePagination } from '../hooks/usePagination';
import { LoadMoreButton, SearchSpinner } from '../components/Pagination';
import { cn } from '../lib/utils';

interface AccountEntity {
  id: number;
  name: string;
  phone?: string;
  balance: number;
}

export default function Loans() {
  const [customers, setCustomers] = useState<AccountEntity[]>([]);
  const [vendors, setVendors] = useState<AccountEntity[]>([]);
  const [activeTab, setActiveTab] = useState<'receivables' | 'payables'>('receivables');
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
      const [cusRes, venRes] = await Promise.all([
        window.api.getCustomers(),
        window.api.getVendors()
      ]);

      if (cusRes.success) {
        setCustomers((cusRes.data || []).filter((c: any) => Math.abs(c.balance || 0) > 0.5));
      }
      if (venRes.success) {
        setVendors((venRes.data || []).filter((v: any) => Math.abs(v.balance || 0) > 0.5));
      }
    } catch (e) {
      console.error(e);
      addNotification("Error", "Failed to load financial data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (v: string) => {
    setIsSearching(true);
    setSearchTerm(v);
    setTimeout(() => setIsSearching(false), 200);
  };

  const currentData = activeTab === 'receivables' ? customers : vendors;

  const filteredData = useMemo(() => currentData.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.phone && item.phone.includes(searchTerm))
  ), [currentData, searchTerm]);

  const { visible: visibleItems, hasMore, loadMore, total: pTotal, showing } = usePagination(filteredData, 10, 1);

  const totalReceivable = customers.reduce((acc, c) => acc + Math.max(0, c.balance || 0), 0);
  const totalPayable = vendors.reduce((acc, v) => acc + Math.max(0, v.balance || 0), 0);

  const fmt = (n: number) => 'PKR ' + Math.round(n).toLocaleString('en-PK');

  const printBalanceSheet = async () => {
    const isReceivable = activeTab === 'receivables';
    const title = isReceivable ? 'Accounts Receivable (Customers)' : 'Accounts Payable (Vendors)';
    const total = isReceivable ? totalReceivable : totalPayable;
    const items = isReceivable ? customers : vendors;

    if (items.length === 0) {
      addNotification('Warning', 'No records to print.', 'warning');
      return;
    }

    const rowsHtml = items.map((item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.phone || '-'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; text-align: right;">PKR ${Math.round(item.balance || 0).toLocaleString('en-PK')}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: sans-serif; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0;">Financial Ledger</h1>
          <h3 style="color: #666; margin-top: 5px;">${title}</h3>
          <p style="color: #888; font-size: 12px;">Generated on ${new Date().toLocaleString()}</p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="text-align: left; padding: 12px; border-bottom: 2px solid #ddd;">Name</th>
              <th style="text-align: left; padding: 12px; border-bottom: 2px solid #ddd;">Phone</th>
              <th style="text-align: right; padding: 12px; border-bottom: 2px solid #ddd;">Due Balance</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="text-align: right; padding: 15px; font-weight: bold; font-size: 18px;">Total Outstanding:</td>
              <td style="text-align: right; padding: 15px; font-weight: bold; font-size: 18px; color: ${isReceivable ? '#ef4444' : '#eab308'};">PKR ${Math.round(total).toLocaleString('en-PK')}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    addNotification("Generating", "Preparing PDF...", "info");
    try {
      const res = await window.api.saveInvoicePdf(html);
      if (res.success) {
        addNotification('Success', 'PDF generated and opened successfully!', 'success');
      } else {
        addNotification('Error', res.error, 'error');
      }
    } catch (e: any) {
      addNotification('Error', e.message, 'error');
    }
  };

  const printSingleLedger = async (item: AccountEntity) => {
    addNotification("Generating", "Fetching ledger details...", "info");
    try {
      const isReceivable = activeTab === 'receivables';
      let details;

      if (isReceivable) {
        const res = await window.api.getCustomerDetails(item.id);
        if (!res.success) throw new Error(res.error || 'Failed to fetch details');
        details = res.data;
      } else {
        const res = await window.api.getVendorDetails(item.id);
        if (!res.success) throw new Error(res.error || 'Failed to fetch details');
        details = res.data;
      }

      let logs: any[] = [];
      if (isReceivable) {
        const sales = (details.sales || []).map((s: any) => ({ ...s, type: 'SALE', date: s.date_created, amount: s.total }));
        const payments = (details.payments || []).map((p: any) => ({ ...p, type: 'PAYMENT', date: p.date_added, amount: p.amount }));
        logs = [...sales, ...payments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      } else {
        const purchases = (details.purchases || []).map((p: any) => ({
          ...p, type: 'PURCHASE', date: p.date_created, amount: p.total
        }));
        const payments = (details.payments || []).map((p: any) => ({
          ...p, type: 'PAYMENT', date: p.date_created, amount: p.amount  // vendor_payments uses date_created
        }));
        const returns = (details.returns || []).map((r: any) => ({
          ...r, type: 'RETURN', date: r.date_created, amount: r.total_returned
        }));
        logs = [...purchases, ...payments, ...returns].sort((a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
      }

      let runningBalance = 0;
      const rowsHtml = logs.map(log => {
        let debit = 0;
        let credit = 0;

        if (isReceivable) {
          if (log.type === 'SALE') { debit = log.amount; runningBalance += debit; }
          else { credit = log.amount; runningBalance -= credit; }
        } else {
          if (log.type === 'PURCHASE') { credit = log.amount; runningBalance += credit; }
          else if (log.type === 'RETURN') { debit = log.amount; runningBalance -= debit; }  // return reduces what we owe
          else { debit = log.amount; runningBalance -= debit; }  // PAYMENT
        }

        return `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${new Date(log.date).toLocaleString()}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${log.type} ${log.notes ? `(${log.notes})` : ''}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: ${debit > 0 ? '#ef4444' : 'inherit'};">${debit > 0 ? Math.round(debit).toLocaleString() : '-'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: ${credit > 0 ? '#10b981' : 'inherit'};">${credit > 0 ? Math.round(credit).toLocaleString() : '-'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; text-align: right;">${Math.round(runningBalance).toLocaleString()}</td>
          </tr>
        `;
      }).join('');

      const html = `
        <div style="font-family: sans-serif; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0;">Statement of Account</h1>
            <h3 style="color: #666; margin-top: 5px;">${item.name} ${item.phone ? `(${item.phone})` : ''}</h3>
            <p style="color: #888; font-size: 12px;">Generated on ${new Date().toLocaleString()}</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="text-align: left; padding: 12px; border-bottom: 2px solid #ddd;">Date</th>
                <th style="text-align: left; padding: 12px; border-bottom: 2px solid #ddd;">Description</th>
                <th style="text-align: right; padding: 12px; border-bottom: 2px solid #ddd;">Debit (PKR)</th>
                <th style="text-align: right; padding: 12px; border-bottom: 2px solid #ddd;">Credit (PKR)</th>
                <th style="text-align: right; padding: 12px; border-bottom: 2px solid #ddd;">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colspan="5" style="text-align: center; padding: 20px;">No transactions found.</td></tr>'}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" style="text-align: right; padding: 15px; font-weight: bold; font-size: 18px;">Closing Balance:</td>
                <td style="text-align: right; padding: 15px; font-weight: bold; font-size: 18px; color: ${runningBalance > 0 ? (isReceivable ? '#ef4444' : '#eab308') : '#10b981'};">PKR ${Math.round(runningBalance).toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;

      const res = await window.api.saveInvoicePdf(html);
      if (res.success) {
        addNotification('Success', 'Ledger PDF generated successfully!', 'success');
      } else {
        addNotification('Error', res.error, 'error');
      }
    } catch (e: any) {
      addNotification('Error', e.message, 'error');
    }
  };

  const sendWhatsApp = (item: AccountEntity) => {
    if (!item.phone) {
      addNotification("No Phone", "This contact doesn't have a phone number.", "warning");
      return;
    }
    const cleanPhone = item.phone.replace(/[^0-9]/g, '');
    let finalPhone = cleanPhone;
    if (cleanPhone.startsWith('0')) {
      finalPhone = '92' + cleanPhone.substring(1);
    }

    const isReceivable = activeTab === 'receivables';
    const balanceStr = Math.round(item.balance).toLocaleString('en-PK');

    let msg = '';
    if (isReceivable) {
      msg = `Hello ${item.name},\nThis is a gentle reminder that your pending balance is PKR ${balanceStr}. Please clear it at your earliest convenience. Thank you!\n\nالسلام علیکم ${item.name}،\nیہ یاد دہانی ہے کہ آپ کا بقایا بیلنس ${balanceStr} روپے ہے۔ براہ کرم جلد از جلد ادا کریں۔ شکریہ!`;
    } else {
      msg = `Hello ${item.name},\nThis is to inform you that our pending payable balance to you is PKR ${balanceStr}. We will clear it soon. Thank you!\n\nالسلام علیکم ${item.name}،\nہم آپ کو مطلع کرنا چاہتے ہیں کہ ہمارا آپ کی طرف بقایا بیلنس ${balanceStr} روپے ہے۔ ہم اسے جلد ادا کر دیں گے۔ شکریہ!`;
    }

    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10 animate-in fade-in">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wallet size={28} className="text-primary" /> Financial Accounts
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Manage accounts payable and receivable ledgers</p>
        </div>

        <Button onClick={printBalanceSheet} variant="outline" className="gap-2 shadow-sm border-primary/20 hover:bg-primary/5">
          <FileText size={16} className="text-primary" />
          Export {activeTab === 'receivables' ? 'AR' : 'AP'} Ledger (PDF)
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className={cn("shadow-md transition-colors", activeTab === 'receivables' ? "bg-destructive/10 border-destructive/20" : "bg-card border-border")}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className={cn("font-medium uppercase text-xs tracking-wider", activeTab === 'receivables' ? "text-destructive" : "text-muted-foreground")}>
              Total Receivable (Customers Owe You)
            </CardTitle>
            <AlertTriangle size={20} className={activeTab === 'receivables' ? "text-destructive" : "text-muted-foreground"} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-3xl font-bold tracking-tight", activeTab === 'receivables' ? "text-destructive" : "text-foreground")}>{fmt(totalReceivable)}</div>
            <p className="text-sm mt-1 opacity-80">Across {customers.length} customers</p>
          </CardContent>
        </Card>

        <Card className={cn("shadow-md transition-colors", activeTab === 'payables' ? "bg-amber-500/10 border-amber-500/20" : "bg-card border-border")}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className={cn("font-medium uppercase text-xs tracking-wider", activeTab === 'payables' ? "text-amber-600" : "text-muted-foreground")}>
              Total Payable (You Owe Vendors)
            </CardTitle>
            <AlertTriangle size={20} className={activeTab === 'payables' ? "text-amber-600" : "text-muted-foreground"} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-3xl font-bold tracking-tight", activeTab === 'payables' ? "text-amber-600" : "text-foreground")}>{fmt(totalPayable)}</div>
            <p className="text-sm mt-1 opacity-80">Across {vendors.length} vendors</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-border/50">
        <CardHeader className="border-b bg-muted/20 pb-0 pt-4 px-4">
          <div className="w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div className="flex bg-muted p-1 rounded-lg w-full sm:w-[400px]">
                <button
                  onClick={() => { setActiveTab('receivables'); setSearchTerm(''); }}
                  className={cn(
                    "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                    activeTab === 'receivables' ? "bg-destructive text-white shadow" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                >
                  Receivables (AR)
                </button>
                <button
                  onClick={() => { setActiveTab('payables'); setSearchTerm(''); }}
                  className={cn(
                    "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                    activeTab === 'payables' ? "bg-amber-500 text-white shadow" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                >
                  Payables (AP)
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9 bg-background h-9 shadow-sm"
                />
                <SearchSpinner visible={isSearching} />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-20 text-muted-foreground">
              <Activity size={32} className="animate-spin text-primary opacity-50" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col justify-center items-center py-20 text-muted-foreground">
              <UserCheck size={48} className="opacity-20 mb-4" />
              <p className="text-lg font-medium text-foreground">All Clear!</p>
              <p className="text-sm">No outstanding balances found in this category.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {visibleItems.map(item => (
                <div key={item.id} className="flex flex-col sm:flex-row items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4 w-full sm:w-auto mb-4 sm:mb-0">
                    <div className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg",
                      activeTab === 'receivables' ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"
                    )}>
                      {item.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">{item.name}</h4>
                      <p className="text-sm text-muted-foreground">{item.phone || 'No phone'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Due Balance</p>
                      <p className={cn("font-bold text-lg", activeTab === 'receivables' ? "text-destructive" : "text-amber-600")}>
                        {fmt(item.balance)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => sendWhatsApp(item)}
                        variant="outline"
                        size="sm"
                        className="gap-2 text-green-600 border-green-200 hover:bg-green-50 shadow-sm"
                      >
                        <MessageCircle size={16} />
                      </Button>
                      <Button
                        onClick={() => printSingleLedger(item)}
                        variant="outline"
                        size="sm"
                        className="gap-2 shadow-sm text-primary hover:text-primary"
                      >
                        <Eye size={16} /> Ledger
                      </Button>
                      <Button
                        onClick={() => navigate(activeTab === 'receivables' ? `/customers?customer_id=${item.id}` : `/vendors`)}
                        variant="secondary"
                        size="sm"
                        className="gap-2 shadow-sm whitespace-nowrap"
                      >
                        Settle <ArrowRight size={16} />
                      </Button>
                    </div>
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
