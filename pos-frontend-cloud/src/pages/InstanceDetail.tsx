import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Store, Phone, Mail, MapPin, Key,
  ShieldCheck, ShieldX, Download, Loader2,
  Activity, TrendingUp, Users, Package,
  AlertTriangle, Clock, CheckCircle2, Fingerprint,
  ChevronDown, Ban, Copy, Check, Truck, Receipt,
  CreditCard, Search, X, FileDown, Eye, RefreshCw, Banknote,
} from 'lucide-react';
import { instancesApi, InstanceDetail as IDetail } from '../api';
import clsx from 'clsx';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return Math.round(n ?? 0).toLocaleString('en-PK');
}
function fmtRs(n: number) { return 'PKR ' + Math.round(n ?? 0).toLocaleString('en-PK'); }

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days  > 0)  return `${days}d ago`;
  if (hours > 0)  return `${hours}h ago`;
  if (mins  > 0)  return `${mins}m ago`;
  return 'Just now';
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(rows: any[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = keys.map(escape).join(',');
  const body   = rows.map(r => keys.map(k => escape(r[k])).join(',')).join('\n');
  const blob   = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url    = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── TruncatedKey ─────────────────────────────────────────────────────────────

function TruncatedKey({ value }: { value?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-sm text-slate-400 dark:text-gray-600">—</span>;
  const display = value.length > 20 ? value.slice(0, 16) + '…' : value;
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  return (
    <div className="flex items-center gap-2 mt-0.5">
      <code className="text-xs font-mono text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 px-2 py-0.5 rounded truncate max-w-[180px]" title={value}>
        {display}
      </code>
      <button onClick={copy} className="text-slate-400 dark:text-gray-600 hover:text-blue-500 transition-colors flex-shrink-0">
        {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
      </button>
    </div>
  );
}

// ─── InfoRow ─────────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value, mono, keyValue }: {
  icon: React.ElementType; label: string; value?: string; mono?: boolean; keyValue?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-200 dark:border-gray-800 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={15} className="text-slate-500 dark:text-gray-400" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-gray-500">{label}</p>
        {keyValue !== undefined
          ? <TruncatedKey value={keyValue} />
          : <p className={clsx('text-sm text-slate-700 dark:text-gray-200 font-medium mt-0.5 break-words', mono && 'font-mono text-xs')}>{value || '—'}</p>
        }
      </div>
    </div>
  );
}

// ─── Plan options ─────────────────────────────────────────────────────────────

const PLANS = [
  { id: 'monthly',   label: 'Monthly',   days: 30,    badge: '30 days',  color: 'bg-sky-500/15 border-sky-500/30 text-sky-600 dark:text-sky-300' },
  { id: 'quarterly', label: 'Quarterly', days: 90,    badge: '90 days',  color: 'bg-violet-500/15 border-violet-500/30 text-violet-600 dark:text-violet-300' },
  { id: 'yearly',    label: 'Yearly',    days: 365,   badge: '365 days', color: 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-300' },
  { id: 'lifetime',  label: 'Lifetime',  days: 36500, badge: 'Forever',  color: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300' },
];

// ─── Approve Modal ────────────────────────────────────────────────────────────

function ApproveModal({ storeName, onConfirm, onCancel, loading }: {
  storeName: string; onConfirm: (plan: string, days: number) => void; onCancel: () => void; loading: boolean;
}) {
  const [selectedPlan, setPlan] = useState('monthly');
  const plan = PLANS.find((p) => p.id === selectedPlan)!;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <ShieldCheck size={18} className="text-emerald-500 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Approve & Issue License</h3>
            <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">For: <span className="text-slate-700 dark:text-gray-300 font-medium">{storeName}</span></p>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-gray-500 mb-4 leading-relaxed">
          Select a license plan. A unique license key will be generated, assigned to this instance, and the POS will receive it automatically on its next poll.
        </p>
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {PLANS.map((p) => (
            <button key={p.id} type="button" onClick={() => setPlan(p.id)}
              className={clsx('relative p-3 rounded-xl border text-left transition-all',
                selectedPlan === p.id ? 'border-blue-500/60 bg-blue-500/10' : 'border-slate-300 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/60 hover:border-slate-400 dark:hover:border-gray-600'
              )}>
              {selectedPlan === p.id && <CheckCircle2 size={12} className="absolute top-2.5 right-2.5 text-blue-500 dark:text-blue-400" />}
              <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{p.label}</p>
              <span className={clsx('text-xs px-1.5 py-0.5 rounded-full border', p.color)}>{p.badge}</span>
            </button>
          ))}
        </div>
        <div className="bg-slate-50 dark:bg-gray-800/60 border border-slate-200 dark:border-gray-700 rounded-xl px-4 py-3 mb-5 text-xs text-slate-500 dark:text-gray-400 flex items-start gap-2">
          <Key size={12} className="text-slate-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
          <span>An AES-256-GCM encrypted license key will be generated and auto-delivered to the POS on its next poll.</span>
        </div>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancel} disabled={loading} className="btn-ghost">Cancel</button>
          <button type="button" onClick={() => onConfirm(selectedPlan, plan.days)} disabled={loading} className="btn-success">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
            {loading ? 'Approving…' : `Approve — ${plan.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Block License Modal ──────────────────────────────────────────────────────

function BlockLicenseModal({ storeName, onConfirm, onCancel, loading }: {
  storeName: string; onConfirm: (reason: string) => void; onCancel: () => void; loading: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
            <Ban size={18} className="text-rose-500 dark:text-rose-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Block License</h3>
            <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">For: <span className="text-slate-700 dark:text-gray-300 font-medium">{storeName}</span></p>
          </div>
        </div>
        <p className="text-sm text-slate-500 dark:text-gray-400 mb-4 leading-relaxed">
          This will revoke the license key and block the POS from activating. The POS will detect this within 30 seconds.
        </p>
        <label className="block text-xs text-slate-500 dark:text-gray-400 mb-1.5">Reason (optional)</label>
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. License expired, Non-payment, Fraud…" className="input mb-5" />
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancel} disabled={loading} className="btn-ghost">Cancel</button>
          <button type="button" onClick={() => onConfirm(reason)} disabled={loading} className="btn-danger">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />}
            {loading ? 'Blocking…' : 'Block License'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab Search Bar ───────────────────────────────────────────────────────────

function TabSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-600" />
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Search…'}
        className="input pl-8 pr-8 py-1.5 text-xs h-8 w-52"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-600 hover:text-slate-700 dark:hover:text-gray-300">
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// ─── Date filter helpers ──────────────────────────────────────────────────────

function toYMD(d: Date) { return d.toISOString().split('T')[0]; }

type TabPreset = 'all' | 'week' | 'month' | 'custom';

function getTabPresetRange(preset: TabPreset): { from: string; to: string } | null {
  if (preset === 'all') return null;
  const now   = new Date();
  const today = toYMD(now);
  if (preset === 'week')  return { from: toYMD(new Date(now.getTime() - 6  * 86400000)), to: today };
  if (preset === 'month') return { from: toYMD(new Date(now.getTime() - 29 * 86400000)), to: today };
  return null; // custom — uses tabFrom/tabTo
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type ActiveTab = 'sales' | 'products' | 'customers' | 'vendors' | 'purchases' | 'expenses' | 'loans' | 'events';

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InstanceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail]         = useState<IDetail | null>(null);
  const [sales, setSales]           = useState<any[]>([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setAction]  = useState<'approve' | 'block' | 'blockLicense' | null>(null);

  const [blockReason, setBlockReason]       = useState('');
  const [showBlockModal, setBlockModal]     = useState(false);
  const [showBlockLicenseModal, setBlockLicenseModal] = useState(false);
  const [showApproveModal, setApproveModal] = useState(false);

  const [error, setError]           = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showExportMenu, setExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('sales');
  const [tabSearch, setTabSearch] = useState('');

  // Date filter for transactional tabs (sales, purchases, expenses)
  const [tabPreset, setTabPreset] = useState<TabPreset>('all');
  const [tabFrom,   setTabFrom]   = useState('');
  const [tabTo,     setTabTo]     = useState('');

  // Per-tab data
  const [products,  setProducts,  startProductsLoading]  = useLazyTab();
  const [customers, setCustomers, startCustomersLoading] = useLazyTab();
  const [vendors,   setVendors,   startVendorsLoading]   = useLazyTab();
  const [purchases, setPurchases, startPurchasesLoading] = useLazyTab();
  const [expenses,  setExpenses,  startExpensesLoading]  = useLazyTab();
  const [loansData, setLoansData] = useState<{
    customerLoans: any[]; vendorLoans: any[];
    totalReceivable: number; totalPayable: number;
    loading: boolean; fetched: boolean;
  }>({ customerLoans: [], vendorLoans: [], totalReceivable: 0, totalPayable: 0, loading: false, fetched: false });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const det = await instancesApi.get(id);
      setDetail(det);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load instance');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  // Load (or re-load) sales whenever the date filter changes
  const loadSales = async (from?: string, to?: string) => {
    if (!id) return;
    try {
      const sal = await instancesApi.sales(id, { limit: 500, date_from: from, date_to: to });
      setSales(sal.data);
      setSalesTotal(sal.total);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!id) return;
    const range = getTabPresetRange(tabPreset);
    const from  = range ? range.from : (tabPreset === 'custom' ? tabFrom : undefined);
    const to    = range ? range.to   : (tabPreset === 'custom' ? tabTo   : undefined);
    loadSales(from, to);
  }, [id, tabPreset, tabFrom, tabTo]);

  // Client-side date filtering for purchases and expenses
  const filteredPurchases = useMemo(() => {
    const range = getTabPresetRange(tabPreset);
    const from  = range?.from ?? (tabPreset === 'custom' ? tabFrom : '');
    const to    = range?.to   ?? (tabPreset === 'custom' ? tabTo   : '');
    if (!from || !to) return purchases.data;
    return purchases.data.filter((p: any) => {
      const d = (p.date_created || '').slice(0, 10);
      return d >= from && d <= to;
    });
  }, [purchases.data, tabPreset, tabFrom, tabTo]);

  const filteredExpenses = useMemo(() => {
    const range = getTabPresetRange(tabPreset);
    const from  = range?.from ?? (tabPreset === 'custom' ? tabFrom : '');
    const to    = range?.to   ?? (tabPreset === 'custom' ? tabTo   : '');
    if (!from || !to) return expenses.data;
    return expenses.data.filter((e: any) => {
      const d = (e.date_added || e.date_created || '').slice(0, 10);
      return d >= from && d <= to;
    });
  }, [expenses.data, tabPreset, tabFrom, tabTo]);

  // Lazy-load tab data — only fetches once per tab per page load
  useEffect(() => {
    if (!id) return;
    setTabSearch('');

    // Loans tab has different state shape — handle separately
    if (activeTab === 'loans') {
      if (loansData.fetched) return;
      setLoansData(prev => ({ ...prev, loading: true }));
      instancesApi.loans(id)
        .then(r => setLoansData({ ...r.data, loading: false, fetched: true }))
        .catch(() => setLoansData(prev => ({ ...prev, loading: false, fetched: true })));
      return;
    }

    // Don't re-fetch if already loaded
    const alreadyFetched: Partial<Record<ActiveTab, boolean>> = {
      products: products.fetched, customers: customers.fetched,
      vendors:  vendors.fetched,  purchases: purchases.fetched,
      expenses: expenses.fetched,
    };
    if (alreadyFetched[activeTab]) return;

    // Show spinner before the request
    const starters: Partial<Record<ActiveTab, () => void>> = {
      products:  startProductsLoading,
      customers: startCustomersLoading,
      vendors:   startVendorsLoading,
      purchases: startPurchasesLoading,
      expenses:  startExpensesLoading,
    };
    starters[activeTab]?.();

    const loaders: Partial<Record<ActiveTab, () => Promise<void>>> = {
      products:  () => instancesApi.products(id).then(r  => setProducts(r.data, r.total)),
      customers: () => instancesApi.customers(id).then(r => setCustomers(r.data, r.total)),
      vendors:   () => instancesApi.vendors(id).then(r   => setVendors(r.data, r.total)),
      purchases: () => instancesApi.purchases(id).then(r => setPurchases(r.data, r.total)),
      expenses:  () => instancesApi.expenses(id).then(r  => setExpenses(r.data, r.total)),
    };
    loaders[activeTab]?.();
  }, [activeTab, id]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleApprove = async (plan: string, duration_days: number) => {
    if (!id) return;
    setAction('approve'); setError(''); setSuccessMsg('');
    try {
      const result = await instancesApi.approve(id, { plan, duration_days });
      setApproveModal(false);
      setSuccessMsg(result.licenseKey
        ? `Approved! License issued (${plan}, expires: ${result.expiresAt ? fmtDate(result.expiresAt) : 'never'}). POS will receive it on next poll.`
        : 'Instance approved.');
      await load();
    } catch (e: any) { setError(e.response?.data?.error || 'Approve failed'); }
    finally { setAction(null); }
  };

  const handleBlock = async () => {
    if (!id) return;
    setAction('block'); setError(''); setSuccessMsg('');
    try {
      await instancesApi.block(id, blockReason || undefined);
      setBlockModal(false); setBlockReason(''); await load();
    } catch (e: any) { setError(e.response?.data?.error || 'Block failed'); }
    finally { setAction(null); }
  };

  // Unblock: calls unblock-license which restores the key if it exists,
  // or just re-approves if there's no previous key. Also resets license_revoked.
  const handleUnblock = async () => {
    if (!id) return;
    setAction('approve'); setError(''); setSuccessMsg('');
    try {
      const result = await instancesApi.unblockLicense(id);
      const msg = (result as any).license_key
        ? `Unblocked! License key restored. POS will re-activate on next sync.`
        : `Unblocked (no previous key found). Use "Approve & Issue License" to generate a new key.`;
      setSuccessMsg(msg);
      await load();
    } catch (e: any) { setError(e.response?.data?.error || 'Unblock failed'); }
    finally { setAction(null); }
  };

  // Restore license: called when instance is approved but has no license key
  const handleRestoreLicense = async () => {
    if (!id) return;
    setAction('approve'); setError(''); setSuccessMsg('');
    try {
      const result = await instancesApi.unblockLicense(id);
      const msg = (result as any).license_key
        ? `License restored. POS will receive it on next sync.`
        : `No previous license found in records. Use "Approve & Issue License" to generate a new key.`;
      setSuccessMsg(msg);
      await load();
    } catch (e: any) { setError(e.response?.data?.error || 'Restore failed'); }
    finally { setAction(null); }
  };

  const handleBlockLicense = async (reason: string) => {
    if (!id) return;
    setAction('blockLicense'); setError(''); setSuccessMsg('');
    try {
      await instancesApi.blockLicense(id, reason || undefined);
      setBlockLicenseModal(false);
      setSuccessMsg('License blocked. The POS will detect this within 30 seconds.');
      await load();
    } catch (e: any) { setError(e.response?.data?.error || 'Block license failed'); }
    finally { setAction(null); }
  };

  const handleExport = async (entity?: string) => {
    if (!id) return;
    setExportMenu(false);
    try {
      const data = await instancesApi.export(id, entity);
      const storeName = detail?.instance?.store_name || id;
      const safeStore = storeName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      downloadJson(data, `${safeStore}_${entity ?? 'all'}_${new Date().toISOString().slice(0, 10)}.json`);
    } catch { setError('Export failed'); }
  };

  // CSV export for active tab
  const handleTabCsv = () => {
    if (!detail) return;
    const storeName = (detail.instance.store_name || id!).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const tabDataMap: Partial<Record<ActiveTab, any[]>> = {
      sales: sales, products: products.data, customers: customers.data,
      vendors: vendors.data, purchases: purchases.data, expenses: expenses.data,
    };
    const rows = tabDataMap[activeTab] ?? [];
    downloadCsv(rows, `${storeName}_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // ─── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }
  if (error && !detail) {
    return (
      <div className="p-6">
        <Link to="/instances" className="btn-ghost mb-6 inline-flex"><ArrowLeft size={16} /> Back</Link>
        <p className="text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">{error}</p>
      </div>
    );
  }

  const inst = detail!.instance;
  const ss   = detail!.salesStats;
  const isBlocked  = inst.approval_status === 'blocked';
  const isApproved = inst.approval_status === 'approved';
  const isPending  = inst.approval_status === 'pending';

  // Tab definitions
  const TABS: { key: ActiveTab; label: string; icon: React.ElementType; count: number | null; highlight?: string }[] = [
    { key: 'sales',     label: 'Sales',     icon: Receipt,    count: salesTotal },
    { key: 'products',  label: 'Products',  icon: Package,    count: products.fetched  ? products.total  : null },
    { key: 'customers', label: 'Customers', icon: Users,      count: customers.fetched ? customers.total : null },
    { key: 'vendors',   label: 'Vendors',   icon: Truck,      count: vendors.fetched   ? vendors.total   : null },
    { key: 'purchases', label: 'Purchases', icon: CreditCard, count: purchases.fetched ? purchases.total : null },
    { key: 'expenses',  label: 'Expenses',  icon: TrendingUp, count: expenses.fetched  ? expenses.total  : null },
    { key: 'loans',     label: 'Loans',     icon: Banknote,   count: loansData.fetched ? (loansData.customerLoans.length + loansData.vendorLoans.length) : null, highlight: 'rose' },
    { key: 'events',    label: 'Sync Log',  icon: Activity,   count: detail!.recentEvents.length },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* ── Back + header ── */}
      <div className="flex items-start gap-4 mb-6">
        <button onClick={() => navigate('/instances')} className="btn-ghost mt-0.5">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">{inst.store_name || inst.instance_id}</h1>
            <span className={clsx(isApproved ? 'badge-approved' : isPending ? 'badge-pending' : 'badge-blocked')}>
              {inst.approval_status}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-gray-500 mt-0.5">ID: {inst.instance_id}</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          {isPending && (
            <button onClick={() => setApproveModal(true)} disabled={!!actionLoading} className="btn-success">
              {actionLoading === 'approve' ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
              Approve & Issue License
            </button>
          )}
          {isApproved && (
            <>
              {/* Show restore button when approved but license key is missing */}
              {!inst.license_key && (
                <button onClick={handleRestoreLicense} disabled={!!actionLoading} className="btn-primary">
                  {actionLoading === 'approve' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                  Restore License
                </button>
              )}
              <button onClick={() => setApproveModal(true)} disabled={!!actionLoading} className="btn-ghost">
                <Key size={15} /> Re-issue Key
              </button>
              <button onClick={() => setBlockModal(true)} disabled={!!actionLoading} className="btn-danger">
                <ShieldX size={15} /> Block
              </button>
            </>
          )}
          {isBlocked && (
            <>
              <button onClick={handleUnblock} disabled={!!actionLoading} className="btn-success">
                {actionLoading === 'approve' ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                Unblock
              </button>
              <button onClick={() => setBlockModal(true)} disabled={!!actionLoading} className="btn-danger">
                <ShieldX size={15} /> Re-block
              </button>
            </>
          )}
          {(isApproved || isBlocked) && (
            <button onClick={() => setBlockLicenseModal(true)} disabled={!!actionLoading} className="btn-danger">
              {actionLoading === 'blockLicense' ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />}
              Block License
            </button>
          )}

          {/* Export dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button onClick={() => setExportMenu(v => !v)} className="btn-ghost">
              <Download size={15} /> Export
              <ChevronDown size={13} className={clsx('transition-transform', showExportMenu && 'rotate-180')} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1.5 z-40 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl shadow-2xl py-1.5 min-w-[190px]">
                {[
                  { label: 'Export All (JSON)',       entity: undefined },
                  { label: 'Export Products',          entity: 'products' },
                  { label: 'Export Sales',             entity: 'sales' },
                  { label: 'Export Customers',         entity: 'customers' },
                  { label: 'Export Vendors',           entity: 'vendors' },
                  { label: 'Export Purchases',         entity: 'purchases' },
                  { label: 'Export Expenses',          entity: 'expenses' },
                ].map(({ label, entity }) => (
                  <button key={label} type="button" onClick={() => handleExport(entity)}
                    className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-2">
                    <Download size={13} className="text-slate-400 dark:text-gray-500" /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Banners */}
      {error && <p className="mb-4 text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}
      {successMsg && (
        <div className="mb-4 flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5">
          <CheckCircle2 size={14} className="text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">{successMsg}</p>
        </div>
      )}
      {isBlocked && inst.block_reason && (
        <div className="mb-5 flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
          <AlertTriangle size={16} className="text-rose-500 dark:text-rose-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-rose-700 dark:text-rose-300">Blocked: {inst.block_reason}</p>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Left: info cards */}
        <div className="xl:col-span-1 flex flex-col gap-5">
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Store Information</h3>
            <InfoRow icon={Store}  label="Store Name"  value={inst.store_name} />
            <InfoRow icon={Users}  label="Owner Name"  value={inst.owner_name} />
            <InfoRow icon={Phone}  label="Mobile / ID" value={inst.owner_mobile} mono />
            <InfoRow icon={Mail}   label="Email"       value={inst.owner_email} />
            <InfoRow icon={MapPin} label="Address"     value={inst.store_address} />
          </div>

          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">License</h3>
            <InfoRow icon={Key}         label="Plan"        value={inst.license_plan} />
            <InfoRow icon={Key}         label="Key"         keyValue={inst.license_key} />
            <InfoRow icon={Clock}       label="Expires"     value={fmtDate(inst.license_expiry)} />
            <InfoRow icon={Activity}    label="App Version" value={inst.app_version} />
            <InfoRow icon={Clock}       label="Registered"  value={fmtDate(inst.created_at)} />
            <InfoRow icon={Clock}       label="Last Seen"   value={timeAgo(inst.last_seen) + (inst.last_seen ? ' (' + fmtDateTime(inst.last_seen) + ')' : '')} />
            {inst.device_fingerprint && <InfoRow icon={Fingerprint} label="Device Fingerprint" value={inst.device_fingerprint} mono />}
          </div>
        </div>

        {/* Right: stats + tabs */}
        <div className="xl:col-span-2 flex flex-col gap-5">

          {/* Stat cards — click to jump to the corresponding tab */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {([
              { icon: TrendingUp, label: 'Revenue',   value: fmtRs(inst.total_revenue ?? 0), color: 'bg-violet-500/15 text-violet-500 dark:text-violet-400', tab: 'sales'     as ActiveTab },
              { icon: Receipt,    label: 'Sales',     value: fmt(inst.total_sales ?? 0),      color: 'bg-blue-500/15 text-blue-500 dark:text-blue-400',       tab: 'sales'     as ActiveTab },
              { icon: Users,      label: 'Customers', value: fmt(inst.total_customers ?? 0),  color: 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400', tab: 'customers' as ActiveTab },
              { icon: Package,    label: 'Products',  value: fmt(inst.total_products ?? 0),   color: 'bg-amber-500/15 text-amber-500 dark:text-amber-400',    tab: 'products'  as ActiveTab },
              { icon: Truck,      label: 'Vendors',   value: vendors.fetched ? fmt(vendors.total) : '—', color: 'bg-sky-500/15 text-sky-500 dark:text-sky-400', tab: 'vendors' as ActiveTab },
            ] as { icon: React.ElementType; label: string; value: string; color: string; tab: ActiveTab }[]).map(({ icon: Icon, label, value, color, tab }) => (
              <button
                key={label}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'stat-card text-left group relative transition-all hover:shadow-md hover:-translate-y-0.5',
                  activeTab === tab && 'ring-2 ring-blue-500/40'
                )}
                title={`View ${label}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', color)}><Icon size={17} /></div>
                  <Eye size={13} className="text-slate-300 dark:text-gray-700 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors mt-1" />
                </div>
                <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
                <p className="text-xs text-slate-500 dark:text-gray-500">{label}</p>
              </button>
            ))}
          </div>

          {/* Tabbed content */}
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden flex-1">

            {/* Tab bar */}
            <div className="flex items-center border-b border-slate-200 dark:border-gray-800 px-1 overflow-x-auto no-scrollbar">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3.5 py-3 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0',
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 dark:text-gray-500 hover:text-slate-800 dark:hover:text-gray-300'
                  )}
                >
                  <tab.icon size={13} />
                  {tab.label}
                  {tab.count !== null && (
                    <span className={clsx(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums',
                      activeTab === tab.key ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-600'
                    )}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab toolbar (date filter + search + CSV export) */}
            {activeTab !== 'events' && activeTab !== 'loans' && (
              <div className="border-b border-slate-100 dark:border-gray-800/60 bg-slate-50/50 dark:bg-gray-800/20">
                {/* Date filter row — only for transactional tabs */}
                {(activeTab === 'sales' || activeTab === 'purchases' || activeTab === 'expenses') && (
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100/80 dark:border-gray-800/40 flex-wrap">
                    <span className="text-[11px] text-slate-400 dark:text-gray-600 font-medium shrink-0">Filter:</span>
                    <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-gray-800 rounded-lg p-0.5">
                      {(['all', 'week', 'month', 'custom'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setTabPreset(p)}
                          className={clsx(
                            'px-2.5 py-1 rounded-md text-xs font-medium transition-all capitalize',
                            tabPreset === p
                              ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm'
                              : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
                          )}
                        >{p === 'all' ? 'All Time' : p === 'week' ? '7 Days' : p === 'month' ? '30 Days' : 'Custom'}</button>
                      ))}
                    </div>
                    {tabPreset === 'custom' && (
                      <div className="flex items-center gap-1.5">
                        <input type="date" value={tabFrom} onChange={e => setTabFrom(e.target.value)} className="input py-1 text-xs h-7 w-32" />
                        <span className="text-xs text-slate-400 dark:text-gray-600">→</span>
                        <input type="date" value={tabTo}   onChange={e => setTabTo(e.target.value)}   className="input py-1 text-xs h-7 w-32" />
                      </div>
                    )}
                    {tabPreset !== 'all' && tabPreset !== 'custom' && (
                      <span className="text-[11px] text-slate-400 dark:text-gray-600">
                        {(() => { const r = getTabPresetRange(tabPreset); return r ? `${r.from} → ${r.to}` : ''; })()}
                      </span>
                    )}
                  </div>
                )}
                {/* Search + export row */}
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <TabSearch
                    value={tabSearch}
                    onChange={setTabSearch}
                    placeholder={`Search ${activeTab}…`}
                  />
                  <button
                    onClick={handleTabCsv}
                    className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition-colors border border-slate-200 dark:border-gray-700 rounded-lg px-3 py-1.5 hover:border-slate-400 dark:hover:border-gray-500"
                  >
                    <FileDown size={13} /> Export CSV
                  </button>
                </div>
              </div>
            )}

            {/* ── Sales ── */}
            {activeTab === 'sales' && (
              <SalesTab
                sales={sales}
                salesTotal={salesTotal}
                syncedRevenue={ss?.synced_revenue ?? 0}
                search={tabSearch}
              />
            )}

            {/* ── Products ── */}
            {activeTab === 'products' && (
              <GenericTab loading={products.loading} data={products.data} search={tabSearch}
                emptyIcon={Package} emptyText="No products synced yet"
                columns={['Name', 'Barcode', 'Selling Price', 'Purchase Price', 'Stock', 'Category']}
                renderRow={(p: any, i) => (
                  <tr key={p.id ?? i} className="hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-2.5 text-slate-700 dark:text-gray-200 font-medium max-w-[180px] truncate" title={p.name}>{p.name || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-gray-400 font-mono text-xs">{p.barcode || '—'}</td>
                    {/* Selling price: POS stores as `price`, fallback to `sale_price` */}
                    <td className="px-4 py-2.5 text-slate-700 dark:text-gray-200 tabular-nums font-medium">
                      {p.price != null ? fmtRs(p.price) : p.sale_price != null ? fmtRs(p.sale_price) : '—'}
                    </td>
                    {/* Purchase/cost price: POS stores as `purchase_price`, fallback to `cost_price` */}
                    <td className="px-4 py-2.5 text-slate-500 dark:text-gray-400 tabular-nums">
                      {p.purchase_price != null ? fmtRs(p.purchase_price) : p.cost_price != null ? fmtRs(p.cost_price) : '—'}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      <span className={clsx('text-xs font-semibold',
                        (p.stock ?? p.quantity ?? 0) <= 0 ? 'text-rose-500 dark:text-rose-400' :
                        (p.stock ?? p.quantity ?? 0) < 10 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                        {p.stock ?? p.quantity ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {p.category ? <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400">{p.category}</span> : <span className="text-slate-400 dark:text-gray-600 text-xs">—</span>}
                    </td>
                  </tr>
                )}
                filterFn={(p: any, q) => (p.name || '').toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)}
              />
            )}

            {/* ── Customers ── */}
            {activeTab === 'customers' && (
              <GenericTab loading={customers.loading} data={customers.data} search={tabSearch}
                emptyIcon={Users} emptyText="No customers synced yet"
                columns={['Name', 'Phone', 'Balance / Qaraz', 'Added']}
                renderRow={(c: any, i) => (
                  <tr key={c.id ?? i} className="hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-2.5 text-slate-700 dark:text-gray-200 font-medium max-w-[180px] truncate">{c.name || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-gray-400 font-mono text-xs">{c.phone || '—'}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {c.balance != null
                        ? <span className={clsx('text-xs font-semibold', c.balance > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>{fmtRs(Math.abs(c.balance))}{c.balance > 0 ? ' owed' : ' credit'}</span>
                        : <span className="text-slate-400 dark:text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 dark:text-gray-500 text-xs">{fmtDate(c.date_added || c.created_at)}</td>
                  </tr>
                )}
                filterFn={(c: any, q) => (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q)}
              />
            )}

            {/* ── Vendors ── */}
            {activeTab === 'vendors' && (
              <GenericTab loading={vendors.loading} data={vendors.data} search={tabSearch}
                emptyIcon={Truck} emptyText="No vendors synced yet"
                columns={['Name', 'Phone', 'Company', 'Balance', 'Added']}
                renderRow={(v: any, i) => (
                  <tr key={v.id ?? i} className="hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-2.5 text-slate-700 dark:text-gray-200 font-medium max-w-[160px] truncate">{v.name || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-gray-400 font-mono text-xs">{v.phone || v.contact || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-gray-400 text-xs max-w-[120px] truncate">{v.company || v.business_name || '—'}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {v.balance != null
                        ? <span className={clsx('text-xs font-semibold', v.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>{fmtRs(Math.abs(v.balance))}</span>
                        : <span className="text-slate-400 dark:text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 dark:text-gray-500 text-xs">{fmtDate(v.date_added || v.created_at)}</td>
                  </tr>
                )}
                filterFn={(v: any, q) => (v.name || '').toLowerCase().includes(q) || (v.phone || v.contact || '').toLowerCase().includes(q) || (v.company || '').toLowerCase().includes(q)}
              />
            )}

            {/* ── Purchases ── */}
            {activeTab === 'purchases' && (
              <GenericTab loading={purchases.loading} data={filteredPurchases} search={tabSearch}
                emptyIcon={CreditCard} emptyText="No purchases synced yet"
                columns={['Purchase #', 'Vendor', 'Total', 'Paid', 'Status', 'Date']}
                renderRow={(p: any, i) => (
                  <tr key={p.id ?? i} className="hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-2.5 text-slate-500 dark:text-gray-400 font-mono text-xs">#{p.id}</td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-gray-200 max-w-[140px] truncate">{p.vendor_name || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-gray-200 tabular-nums font-medium">{p.total != null ? fmtRs(p.total) : '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-gray-400 tabular-nums">{p.amount_paid != null ? fmtRs(p.amount_paid) : '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full',
                        p.payment_status === 'Paid' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        p.payment_status === 'Partial' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                        'bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400')}>
                        {p.payment_status || 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 dark:text-gray-500 text-xs whitespace-nowrap">{fmtDate(p.date_created)}</td>
                  </tr>
                )}
                filterFn={(p: any, q) => (p.vendor_name || '').toLowerCase().includes(q) || String(p.id).includes(q)}
              />
            )}

            {/* ── Expenses ── */}
            {activeTab === 'expenses' && (
              <GenericTab loading={expenses.loading} data={filteredExpenses} search={tabSearch}
                emptyIcon={TrendingUp} emptyText="No expenses synced yet"
                columns={['Title', 'Category', 'Amount', 'Date', 'Notes']}
                renderRow={(e: any, i) => (
                  <tr key={e.id ?? i} className="hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-2.5 text-slate-700 dark:text-gray-200 font-medium max-w-[160px] truncate">{e.title || '—'}</td>
                    <td className="px-4 py-2.5">
                      {e.category ? <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 capitalize">{e.category}</span> : <span className="text-slate-400 dark:text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-rose-600 dark:text-rose-400 tabular-nums font-semibold">{e.amount != null ? fmtRs(e.amount) : '—'}</td>
                    <td className="px-4 py-2.5 text-slate-400 dark:text-gray-500 text-xs whitespace-nowrap">{fmtDate(e.date_added || e.created_at)}</td>
                    <td className="px-4 py-2.5 text-slate-400 dark:text-gray-500 text-xs max-w-[160px] truncate">{e.notes || '—'}</td>
                  </tr>
                )}
                filterFn={(e: any, q) => (e.title || '').toLowerCase().includes(q) || (e.category || '').toLowerCase().includes(q)}
              />
            )}

            {/* ── Loans / Udhaar ── */}
            {activeTab === 'loans' && (
              <div>
                {loansData.loading ? (
                  <div className="py-14 flex flex-col items-center gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
                    <p className="text-sm text-slate-500 dark:text-gray-500">Computing balances…</p>
                  </div>
                ) : !loansData.fetched || (loansData.customerLoans.length === 0 && loansData.vendorLoans.length === 0) ? (
                  <div className="py-14 text-center">
                    <Banknote className="w-9 h-9 text-slate-300 dark:text-gray-700 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 dark:text-gray-500">No outstanding loans or payables</p>
                    <p className="text-xs text-slate-400 dark:text-gray-600 mt-1">All balances are settled!</p>
                  </div>
                ) : (
                  <div className="p-5 space-y-6">
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-rose-500/8 border border-rose-500/20 rounded-xl p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-rose-500 dark:text-rose-400 mb-1.5 flex items-center gap-1.5">
                          <Users size={11} /> Customer Udhaar (Receivable)
                        </p>
                        <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">{fmtRs(loansData.totalReceivable)}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">
                          {loansData.customerLoans.length} customer{loansData.customerLoans.length !== 1 ? 's' : ''} with outstanding dues
                        </p>
                      </div>
                      <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                          <Truck size={11} /> Vendor Payables (You Owe)
                        </p>
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{fmtRs(loansData.totalPayable)}</p>
                        <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">
                          {loansData.vendorLoans.length} vendor{loansData.vendorLoans.length !== 1 ? 's' : ''} with pending payments
                        </p>
                      </div>
                    </div>

                    {/* Customer Udhaar table */}
                    {loansData.customerLoans.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-500 mb-2.5 flex items-center gap-1.5">
                          <Users size={11} /> Customer Udhaar
                        </h4>
                        <div className="rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-gray-800/60">
                              <tr>
                                {['#', 'Customer', 'Phone', 'Udhaar Amount'].map(col => (
                                  <th key={col} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-gray-800/60">
                              {loansData.customerLoans.map((c: any, i: number) => (
                                <tr key={c.id ?? i} className="hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors">
                                  <td className="px-4 py-2.5 text-slate-400 dark:text-gray-600 text-xs">{i + 1}</td>
                                  <td className="px-4 py-2.5 text-slate-700 dark:text-gray-200 font-medium">{c.name || '—'}</td>
                                  <td className="px-4 py-2.5 text-slate-500 dark:text-gray-400 font-mono text-xs">{c.phone || '—'}</td>
                                  <td className="px-4 py-2.5 tabular-nums">
                                    <span className="text-sm font-bold text-rose-500 dark:text-rose-400">{fmtRs(c.balance)}</span>
                                    <span className="text-[10px] text-rose-400 dark:text-rose-500 ml-1">owed</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Vendor Payables table */}
                    {loansData.vendorLoans.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-500 mb-2.5 flex items-center gap-1.5">
                          <Truck size={11} /> Vendor Payables
                        </h4>
                        <div className="rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-gray-800/60">
                              <tr>
                                {['#', 'Vendor', 'Phone', 'Amount Owed'].map(col => (
                                  <th key={col} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-gray-800/60">
                              {loansData.vendorLoans.map((v: any, i: number) => (
                                <tr key={v.id ?? i} className="hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors">
                                  <td className="px-4 py-2.5 text-slate-400 dark:text-gray-600 text-xs">{i + 1}</td>
                                  <td className="px-4 py-2.5 text-slate-700 dark:text-gray-200 font-medium">{v.name || '—'}</td>
                                  <td className="px-4 py-2.5 text-slate-500 dark:text-gray-400 font-mono text-xs">{v.phone || v.contact || '—'}</td>
                                  <td className="px-4 py-2.5 tabular-nums">
                                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{fmtRs(v.balance)}</span>
                                    <span className="text-[10px] text-amber-500 dark:text-amber-600 ml-1">payable</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Sync Events ── */}
            {activeTab === 'events' && (
              detail!.recentEvents.length === 0 ? (
                <div className="py-14 text-center">
                  <Activity className="w-9 h-9 text-slate-300 dark:text-gray-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 dark:text-gray-500">No sync events recorded</p>
                </div>
              ) : (
                <div className="max-h-[480px] overflow-y-auto divide-y divide-slate-200 dark:divide-gray-800/60">
                  {detail!.recentEvents.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-3 px-5 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 capitalize font-mono">
                        {ev.entity_type}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-gray-500 capitalize">{ev.operation}</span>
                      <span className="text-xs text-slate-400 dark:text-gray-600 ml-auto">{fmtDateTime(ev.received_at)}</span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {showApproveModal && (
        <ApproveModal storeName={inst.store_name || inst.instance_id}
          onConfirm={handleApprove} onCancel={() => setApproveModal(false)} loading={actionLoading === 'approve'} />
      )}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Block Instance</h3>
            <p className="text-sm text-slate-500 dark:text-gray-500 mb-4">
              This will block <strong className="text-slate-700 dark:text-gray-200">{inst.store_name || inst.instance_id}</strong>. The POS will detect this within 30 seconds.
            </p>
            <label className="block text-xs text-slate-500 dark:text-gray-400 mb-1.5">Reason (optional)</label>
            <input type="text" value={blockReason} onChange={(e) => setBlockReason(e.target.value)}
              placeholder="e.g. License expired, Non-payment…" className="input mb-5" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setBlockModal(false); setBlockReason(''); }} className="btn-ghost">Cancel</button>
              <button onClick={handleBlock} disabled={actionLoading === 'block'} className="btn-danger">
                {actionLoading === 'block' ? <Loader2 size={15} className="animate-spin" /> : <ShieldX size={15} />}
                Block Instance
              </button>
            </div>
          </div>
        </div>
      )}
      {showBlockLicenseModal && (
        <BlockLicenseModal storeName={inst.store_name || inst.instance_id}
          onConfirm={handleBlockLicense} onCancel={() => setBlockLicenseModal(false)} loading={actionLoading === 'blockLicense'} />
      )}
    </div>
  );
}

// ─── useLazyTab hook ──────────────────────────────────────────────────────────

function useLazyTab(): [
  { data: any[]; total: number; loading: boolean; fetched: boolean },
  (data: any[], total?: number) => void,
  () => void,
] {
  const [state, setState] = useState({ data: [] as any[], total: 0, loading: false, fetched: false });

  const setData = (data: any[], total?: number) => {
    setState({ data, total: total ?? data.length, loading: false, fetched: true });
  };

  // Show loading spinner before the API call
  const startLoading = () => {
    setState(prev => ({ ...prev, loading: true }));
  };

  return [state, setData, startLoading];
}

// ─── SalesTab ─────────────────────────────────────────────────────────────────

function SalesTab({ sales, salesTotal, syncedRevenue, search }: {
  sales: any[]; salesTotal: number; syncedRevenue: number; search: string;
}) {
  function fmtRs2(n: number) { return 'PKR ' + Math.round(n ?? 0).toLocaleString('en-PK'); }

  const filtered = useMemo(() => {
    if (!search) return sales;
    const q = search.toLowerCase();
    return sales.filter(s =>
      String(s.id).includes(q) || (s.payment_method || '').toLowerCase().includes(q) ||
      (s.status || '').toLowerCase().includes(q) || (s.items_summary || '').toLowerCase().includes(q)
    );
  }, [sales, search]);

  return (
    <>
      <div className="px-5 py-3 flex items-center justify-between border-b border-slate-200/60 dark:border-gray-800/60">
        <p className="text-xs text-slate-500 dark:text-gray-500">
          {salesTotal} total · showing {filtered.length}{search ? ` matching "${search}"` : ` of ${sales.length} loaded`}
        </p>
        <div className="text-right">
          <p className="text-xs text-slate-500 dark:text-gray-500">Synced revenue</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{fmtRs2(syncedRevenue)}</p>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="py-14 text-center">
          <TrendingUp className="w-9 h-9 text-slate-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-gray-500">{search ? 'No matching sales' : 'No sales synced yet'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-gray-900 z-10">
              <tr className="border-b border-slate-200 dark:border-gray-800">
                {['Sale ID', 'Date', 'Total', 'Payment', 'Items', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-gray-800/60">
              {filtered.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-2.5 text-slate-500 dark:text-gray-400 font-mono text-xs">#{s.local_id ?? s.id}</td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-gray-400 text-xs whitespace-nowrap">{fmtDate(s.date_created)}</td>
                  <td className="px-4 py-2.5 text-slate-700 dark:text-gray-200 font-medium tabular-nums">{fmtRs2(s.total ?? 0)}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 capitalize">
                      {s.payment_method || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 dark:text-gray-500 text-xs">{s.items_count ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full',
                      s.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      s.status === 'Returned'  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                      'bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400')}>
                      {s.status || 'Completed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── GenericTab ───────────────────────────────────────────────────────────────

function GenericTab({ loading, data, search, emptyIcon: EmptyIcon, emptyText, columns, renderRow, filterFn }: {
  loading: boolean;
  data: any[];
  search: string;
  emptyIcon: React.ElementType;
  emptyText: string;
  columns: string[];
  renderRow: (row: any, i: number) => React.ReactNode;
  filterFn: (row: any, q: string) => boolean;
}) {
  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(r => filterFn(r, q));
  }, [data, search]);

  if (loading) {
    return <div className="py-14 flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-blue-500" /></div>;
  }
  if (filtered.length === 0) {
    return (
      <div className="py-14 text-center">
        <EmptyIcon className="w-9 h-9 text-slate-300 dark:text-gray-700 mx-auto mb-3" />
        <p className="text-sm text-slate-500 dark:text-gray-500">{search ? `No results for "${search}"` : emptyText}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white dark:bg-gray-900 z-10">
          <tr className="border-b border-slate-200 dark:border-gray-800">
            {columns.map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-gray-800/60">
          {filtered.map((row, i) => renderRow(row, i))}
        </tbody>
      </table>
      <div className="px-4 py-2 border-t border-slate-100 dark:border-gray-800/40 text-xs text-slate-400 dark:text-gray-600">
        {filtered.length}{search ? ` of ${data.length}` : ''} record{filtered.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
