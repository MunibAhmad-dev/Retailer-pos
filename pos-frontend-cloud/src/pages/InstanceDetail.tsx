import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Store,
  ShoppingCart,
  DollarSign,
  Activity,
  Cpu,
  User,
  Phone,
  Mail,
  MapPin,
  GitBranch,
  Key,
  Eye,
  EyeOff,
  ChevronDown,
  Shield,
  ShieldOff,
  CheckCircle,
  XCircle,
  Download,
  Calendar,
  Zap,
} from 'lucide-react';

import { cn, fmt, fmtRs, fmtDate, fmtDateTime, timeAgo, statusColor, downloadCsv } from '../lib/utils';
import {
  Spinner,
  StatCard,
  DataTable,
  Modal,
  SearchInput,
  DateRangePicker,
  ActionButton,
  EmptyState,
  Tabs,
  CopyButton,
  PlanBadge,
} from '../components/ui';
import * as api from '../api';

// ─── Types ─────────────────────────────────────────────────────────────────────

type ApprovalStatus = 'pending' | 'approved' | 'blocked';
type TabKey = 'overview' | 'sales' | 'products' | 'customers' | 'vendors' | 'purchases' | 'expenses' | 'loans' | 'events';
type PlanOption = { label: string; value: string; days: number };

// ─── Constants ─────────────────────────────────────────────────────────────────

const PLAN_OPTIONS: PlanOption[] = [
  { label: 'Monthly',   value: 'monthly',   days: 30   },
  { label: 'Quarterly', value: 'quarterly', days: 90   },
  { label: 'Yearly',    value: 'yearly',    days: 365  },
  { label: 'Lifetime',  value: 'lifetime',  days: 9999 },
];

const TAB_LIST = [
  { key: 'overview',   label: 'Overview'   },
  { key: 'sales',      label: 'Sales'      },
  { key: 'products',   label: 'Products'   },
  { key: 'customers',  label: 'Customers'  },
  { key: 'vendors',    label: 'Vendors'    },
  { key: 'purchases',  label: 'Purchases'  },
  { key: 'expenses',   label: 'Expenses'   },
  { key: 'loans',      label: 'Loans'      },
  { key: 'events',     label: 'Events'     },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function weeksAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().slice(0, 10);
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

const SALES_PRESETS = [
  { label: 'Today', from: today(),      to: today()    },
  { label: 'Week',  from: weeksAgo(1),  to: today()    },
  { label: 'Month', from: monthsAgo(1), to: today()    },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div className="text-sm text-slate-900 dark:text-white">{children}</div>
    </div>
  );
}

function MonoField({ value, truncate = false }: { value: string; truncate?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span
        className={cn(
          'font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 rounded-lg px-2 py-1',
          truncate && 'truncate max-w-[200px]'
        )}
        title={value}
      >
        {value}
      </span>
      <CopyButton value={value} />
    </div>
  );
}

// ─── Approve Modal ─────────────────────────────────────────────────────────────

function ApproveModal({
  open,
  onClose,
  instanceId,
  initialPlan,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  initialPlan: PlanOption | null;
  onSuccess: () => void;
}) {
  const [plan, setPlan] = useState<PlanOption>(initialPlan ?? PLAN_OPTIONS[0]);
  const [days, setDays] = useState(initialPlan?.days ?? PLAN_OPTIONS[0].days);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialPlan) {
      setPlan(initialPlan);
      setDays(initialPlan.days);
    }
  }, [initialPlan]);

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      await api.approveInstance(instanceId, {
        plan: plan.value,
        duration_days: days,
        notes: notes.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to approve');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Approve Instance" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Plan
          </label>
          <div className="grid grid-cols-4 gap-2">
            {PLAN_OPTIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => { setPlan(p); setDays(p.days); }}
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm font-medium transition-all',
                  plan.value === p.value
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Duration (days)
          </label>
          <input
            type="number"
            value={days}
            min={1}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          {days === 9999 && (
            <p className="mt-1 text-xs text-amber-500">Lifetime license — never expires</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Notes (optional)
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Paid via bank transfer on 14 Jun 2025"
            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
          />
        </div>

        {error && (
          <p className="text-xs text-rose-500 bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <ActionButton label="Cancel" onClick={onClose} variant="secondary" />
          <ActionButton
            label="Confirm Approve"
            icon={<CheckCircle size={15} />}
            onClick={handleConfirm}
            loading={loading}
            variant="primary"
          />
        </div>
      </div>
    </Modal>
  );
}

// ─── Block Modal ───────────────────────────────────────────────────────────────

function BlockModal({
  open,
  onClose,
  title,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          This action will restrict access. You can reverse it later.
        </p>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Reason (optional)
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason for blocking..."
            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <ActionButton label="Cancel" onClick={onClose} variant="secondary" />
          <ActionButton
            label="Confirm Block"
            icon={<XCircle size={15} />}
            onClick={() => onConfirm(reason.trim())}
            loading={loading}
            variant="danger"
          />
        </div>
      </div>
    </Modal>
  );
}

// ─── Header Actions ────────────────────────────────────────────────────────────

function HeaderActions({
  instance,
  onAction,
}: {
  instance: api.Instance;
  onAction: (type: 'approve' | 'blockLicense' | 'blockInstance' | 'unblockLicense', plan?: PlanOption) => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const status = instance.approval_status as ApprovalStatus;

  if (status === 'pending') {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-all shadow-sm shadow-blue-500/20"
        >
          <CheckCircle size={15} />
          Approve
          <ChevronDown
            size={14}
            className={cn('transition-transform duration-150', dropdownOpen && 'rotate-180')}
          />
        </button>
        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 z-20 w-44 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 shadow-xl overflow-hidden">
            {PLAN_OPTIONS.map((plan) => (
              <button
                key={plan.value}
                type="button"
                onClick={() => { setDropdownOpen(false); onAction('approve', plan); }}
                className="flex items-center justify-between w-full px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                <span>{plan.label}</span>
                <span className="text-xs text-slate-400">
                  {plan.days === 9999 ? '∞' : `${plan.days}d`}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (status === 'approved') {
    return (
      <div className="flex items-center gap-2">
        <ActionButton
          label="Block License"
          icon={<Key size={15} />}
          onClick={() => onAction('blockLicense')}
          variant="danger"
        />
        <ActionButton
          label="Block Instance"
          icon={<ShieldOff size={15} />}
          onClick={() => onAction('blockInstance')}
          variant="danger"
        />
      </div>
    );
  }

  if (status === 'blocked') {
    return (
      <div className="flex items-center gap-2">
        <ActionButton
          label="Unblock License"
          icon={<Shield size={15} />}
          onClick={() => onAction('unblockLicense')}
          variant="secondary"
        />
        <ActionButton
          label="Approve Again"
          icon={<CheckCircle size={15} />}
          onClick={() => onAction('approve', PLAN_OPTIONS[0])}
          variant="primary"
        />
      </div>
    );
  }

  return null;
}

// ─── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ events }: { events: api.InstanceEvent[] }) {
  const cols = [
    {
      key: 'id',
      header: 'ID',
      width: '80px',
      render: (v: unknown) => (
        <span className="font-mono text-xs text-slate-500">{String(v)}</span>
      ),
    },
    {
      key: 'entity_type',
      header: 'Entity',
      render: (v: unknown) => (
        <span className="capitalize">{String(v).replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'operation',
      header: 'Operation',
      render: (v: unknown) => {
        const op = String(v).toLowerCase();
        const color =
          op === 'upsert' ? 'text-blue-400' :
          op === 'delete' ? 'text-rose-400' : 'text-slate-400';
        return (
          <span className={cn('text-xs font-semibold uppercase tracking-wider', color)}>
            {v as string}
          </span>
        );
      },
    },
    {
      key: 'received_at',
      header: 'Received',
      render: (v: unknown) => (
        <span className="text-slate-500 dark:text-slate-400 text-xs">
          {fmtDateTime(v as string)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Sync Events</h3>
        <span className="text-xs text-slate-500">Last 20</span>
      </div>
      <DataTable
        columns={cols as Parameters<typeof DataTable>[0]['columns']}
        rows={events as unknown as Record<string, unknown>[]}
        emptyText="No sync events yet."
      />
    </div>
  );
}

// ─── Tab: Sales ────────────────────────────────────────────────────────────────

function SalesTab({ instanceId }: { instanceId: string }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [rows, setRows]         = useState<unknown[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getInstanceSales(instanceId, {
        date_from: dateFrom || undefined,
        date_to:   dateTo   || undefined,
        limit: 200,
      });
      setRows(res.data);
      setTotal(res.total);
    } catch {
      setError('Failed to load sales data.');
    } finally {
      setLoading(false);
    }
  }, [instanceId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const cols = [
    { key: 'date_created',   header: 'Date',    render: (v: unknown) => fmtDateTime(v as string) },
    { key: 'total',          header: 'Total',   align: 'right' as const, render: (v: unknown) => fmtRs(Number(v) || 0) },
    { key: 'discount',       header: 'Discount',align: 'right' as const, render: (v: unknown) => v ? fmtRs(Number(v)) : '—' },
    { key: 'payment_method', header: 'Payment', render: (v: unknown) => <span className="capitalize">{(v as string) || '—'}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (v: unknown) => {
        const s = String(v || 'completed').toLowerCase();
        return (
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border capitalize', statusColor(s))}>
            {s}
          </span>
        );
      },
    },
    { key: 'items_summary', header: 'Items', render: (v: unknown) => <span className="text-slate-500 dark:text-slate-400 text-xs">{(v as string) || '—'}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
          presets={SALES_PRESETS}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{fmt(total)} records</span>
          <ActionButton
            label="Export CSV"
            icon={<Download size={14} />}
            onClick={() => downloadCsv(rows as Record<string, unknown>[], `sales-${instanceId}-${today()}`)}
            variant="secondary"
          />
        </div>
      </div>
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <DataTable
        columns={cols as Parameters<typeof DataTable>[0]['columns']}
        rows={rows as Record<string, unknown>[]}
        loading={loading}
        emptyText="No sales found for this date range."
      />
    </div>
  );
}

// ─── Tab: Products ─────────────────────────────────────────────────────────────

function ProductsTab({ instanceId }: { instanceId: string }) {
  const [allRows, setAllRows] = useState<unknown[]>([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.getInstanceProducts(instanceId)
      .then(setAllRows)
      .catch(() => setError('Failed to load products.'))
      .finally(() => setLoading(false));
  }, [instanceId]);

  const filtered = search.trim()
    ? (allRows as Record<string, unknown>[]).filter((r) =>
        Object.values(r).some((v) =>
          String(v ?? '').toLowerCase().includes(search.toLowerCase())
        )
      )
    : (allRows as Record<string, unknown>[]);

  const cols = [
    { key: 'name',           header: 'Name' },
    { key: 'category',       header: 'Category',   render: (v: unknown) => <span className="text-slate-500 dark:text-slate-400">{(v as string) || '—'}</span> },
    { key: 'price',          header: 'Sale Price', align: 'right' as const, render: (v: unknown) => fmtRs(Number(v) || 0) },
    { key: 'purchase_price', header: 'Cost',       align: 'right' as const, render: (v: unknown) => v ? fmtRs(Number(v)) : '—' },
    { key: 'stock',          header: 'Stock',      align: 'right' as const, render: (v: unknown) => fmt(Number(v) || 0) },
    { key: 'barcode',        header: 'Barcode',    render: (v: unknown) => v ? <span className="font-mono text-xs text-slate-500">{v as string}</span> : '—' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search products..." className="max-w-xs" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{fmt(filtered.length)} items</span>
          <ActionButton
            label="Export CSV"
            icon={<Download size={14} />}
            onClick={() => downloadCsv(allRows as Record<string, unknown>[], `products-${instanceId}-${today()}`)}
            variant="secondary"
          />
        </div>
      </div>
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <DataTable
        columns={cols as Parameters<typeof DataTable>[0]['columns']}
        rows={filtered}
        loading={loading}
        emptyText="No products found."
      />
    </div>
  );
}

// ─── Tab: Customers ────────────────────────────────────────────────────────────

function CustomersTab({ instanceId }: { instanceId: string }) {
  const [rows, setRows]       = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.getInstanceCustomers(instanceId)
      .then(setRows)
      .catch(() => setError('Failed to load customers.'))
      .finally(() => setLoading(false));
  }, [instanceId]);

  const cols = [
    { key: 'name',    header: 'Name' },
    { key: 'phone',   header: 'Phone', render: (v: unknown) => <span className="font-mono text-xs">{(v as string) || '—'}</span> },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right' as const,
      render: (v: unknown) => {
        const n = Number(v) || 0;
        return <span className={cn(n > 0 ? 'text-rose-400' : 'text-slate-400')}>{fmtRs(n)}</span>;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ActionButton
          label="Export CSV"
          icon={<Download size={14} />}
          onClick={() => downloadCsv(rows as Record<string, unknown>[], `customers-${instanceId}`)}
          variant="secondary"
        />
      </div>
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <DataTable
        columns={cols as Parameters<typeof DataTable>[0]['columns']}
        rows={rows as Record<string, unknown>[]}
        loading={loading}
        emptyText="No customers found."
      />
    </div>
  );
}

// ─── Tab: Vendors ──────────────────────────────────────────────────────────────

function VendorsTab({ instanceId }: { instanceId: string }) {
  const [rows, setRows]       = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.getInstanceVendors(instanceId)
      .then(setRows)
      .catch(() => setError('Failed to load vendors.'))
      .finally(() => setLoading(false));
  }, [instanceId]);

  const cols = [
    { key: 'name',    header: 'Name' },
    { key: 'phone',   header: 'Phone', render: (v: unknown) => <span className="font-mono text-xs">{(v as string) || '—'}</span> },
    {
      key: 'balance',
      header: 'Payable',
      align: 'right' as const,
      render: (v: unknown) => {
        const n = Number(v) || 0;
        return <span className={cn(n > 0 ? 'text-amber-400' : 'text-slate-400')}>{fmtRs(n)}</span>;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ActionButton
          label="Export CSV"
          icon={<Download size={14} />}
          onClick={() => downloadCsv(rows as Record<string, unknown>[], `vendors-${instanceId}`)}
          variant="secondary"
        />
      </div>
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <DataTable
        columns={cols as Parameters<typeof DataTable>[0]['columns']}
        rows={rows as Record<string, unknown>[]}
        loading={loading}
        emptyText="No vendors found."
      />
    </div>
  );
}

// ─── Tab: Purchases ────────────────────────────────────────────────────────────

function PurchasesTab({ instanceId }: { instanceId: string }) {
  const [rows, setRows]       = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.getInstancePurchases(instanceId)
      .then(setRows)
      .catch(() => setError('Failed to load purchases.'))
      .finally(() => setLoading(false));
  }, [instanceId]);

  const cols = [
    { key: 'date',        header: 'Date',   render: (v: unknown) => fmtDate(v as string) },
    { key: 'vendor_name', header: 'Vendor', render: (v: unknown) => <span>{(v as string) || '—'}</span> },
    { key: 'total',       header: 'Total',  align: 'right' as const, render: (v: unknown) => fmtRs(Number(v) || 0) },
    {
      key: 'status',
      header: 'Status',
      render: (v: unknown) => {
        const s = String(v || 'pending').toLowerCase();
        return (
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border capitalize', statusColor(s))}>
            {s}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ActionButton
          label="Export CSV"
          icon={<Download size={14} />}
          onClick={() => downloadCsv(rows as Record<string, unknown>[], `purchases-${instanceId}`)}
          variant="secondary"
        />
      </div>
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <DataTable
        columns={cols as Parameters<typeof DataTable>[0]['columns']}
        rows={rows as Record<string, unknown>[]}
        loading={loading}
        emptyText="No purchases found."
      />
    </div>
  );
}

// ─── Tab: Expenses ─────────────────────────────────────────────────────────────

function ExpensesTab({ instanceId }: { instanceId: string }) {
  const [rows, setRows]       = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.getInstanceExpenses(instanceId)
      .then(setRows)
      .catch(() => setError('Failed to load expenses.'))
      .finally(() => setLoading(false));
  }, [instanceId]);

  const cols = [
    {
      key: 'title',
      header: 'Title / Category',
      render: (v: unknown, row: Record<string, unknown>) => (
        <div>
          <div className="text-sm text-slate-900 dark:text-white">{(v as string) || '—'}</div>
          {row.category != null && <div className="text-xs text-slate-500">{String(row.category)}</div>}
        </div>
      ),
    },
    { key: 'amount', header: 'Amount', align: 'right' as const, render: (v: unknown) => fmtRs(Number(v) || 0) },
    { key: 'date',   header: 'Date',   render: (v: unknown) => fmtDate(v as string) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ActionButton
          label="Export CSV"
          icon={<Download size={14} />}
          onClick={() => downloadCsv(rows as Record<string, unknown>[], `expenses-${instanceId}`)}
          variant="secondary"
        />
      </div>
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <DataTable
        columns={cols as Parameters<typeof DataTable>[0]['columns']}
        rows={rows as Record<string, unknown>[]}
        loading={loading}
        emptyText="No expenses found."
      />
    </div>
  );
}

// ─── Tab: Loans ────────────────────────────────────────────────────────────────

function LoansTab({ instanceId }: { instanceId: string }) {
  const [data, setData]       = useState<api.LoanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.getInstanceLoans(instanceId)
      .then(setData)
      .catch(() => setError('Failed to load loan data.'))
      .finally(() => setLoading(false));
  }, [instanceId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) return <p className="text-sm text-rose-500">{error}</p>;
  if (!data)  return null;

  const customerCols = [
    { key: 'customer_name', header: 'Customer' },
    { key: 'total_amount',  header: 'Total',   align: 'right' as const, render: (v: unknown) => fmtRs(Number(v) || 0) },
    { key: 'paid_amount',   header: 'Paid',    align: 'right' as const, render: (v: unknown) => fmtRs(Number(v) || 0) },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right' as const,
      render: (v: unknown) => (
        <span className={cn(Number(v) > 0 ? 'text-rose-400 font-semibold' : 'text-slate-400')}>
          {fmtRs(Number(v) || 0)}
        </span>
      ),
    },
  ];

  const vendorCols = [
    { key: 'vendor_name',  header: 'Vendor' },
    { key: 'total_amount', header: 'Total',   align: 'right' as const, render: (v: unknown) => fmtRs(Number(v) || 0) },
    { key: 'paid_amount',  header: 'Paid',    align: 'right' as const, render: (v: unknown) => fmtRs(Number(v) || 0) },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right' as const,
      render: (v: unknown) => (
        <span className={cn(Number(v) > 0 ? 'text-amber-400 font-semibold' : 'text-slate-400')}>
          {fmtRs(Number(v) || 0)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Customer Receivables</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Total outstanding:</span>
            <span className="text-sm font-bold text-rose-400">{fmtRs(data.totalReceivable)}</span>
          </div>
        </div>
        <DataTable
          columns={customerCols as Parameters<typeof DataTable>[0]['columns']}
          rows={data.customerLoans as unknown as Record<string, unknown>[]}
          emptyText="No customer receivables."
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Vendor Payables</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Total payable:</span>
            <span className="text-sm font-bold text-amber-400">{fmtRs(data.totalPayable)}</span>
          </div>
        </div>
        <DataTable
          columns={vendorCols as Parameters<typeof DataTable>[0]['columns']}
          rows={data.vendorLoans as unknown as Record<string, unknown>[]}
          emptyText="No vendor payables."
        />
      </div>
    </div>
  );
}

// ─── Tab: Events ───────────────────────────────────────────────────────────────

function EventsTab({ events }: { events: api.InstanceEvent[] }) {
  const cols = [
    {
      key: 'id',
      header: 'ID',
      width: '80px',
      render: (v: unknown) => <span className="font-mono text-xs text-slate-500">{String(v)}</span>,
    },
    {
      key: 'entity_type',
      header: 'Entity',
      render: (v: unknown) => <span className="capitalize">{String(v).replace(/_/g, ' ')}</span>,
    },
    {
      key: 'operation',
      header: 'Operation',
      render: (v: unknown) => {
        const op = String(v).toLowerCase();
        const color =
          op === 'upsert' ? 'text-blue-400' :
          op === 'delete' ? 'text-rose-400' : 'text-slate-400';
        return (
          <span className={cn('text-xs font-semibold uppercase tracking-wider', color)}>
            {v as string}
          </span>
        );
      },
    },
    {
      key: 'received_at',
      header: 'Received',
      render: (v: unknown) => (
        <span className="text-slate-500 dark:text-slate-400 text-xs">{fmtDateTime(v as string)}</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={cols as Parameters<typeof DataTable>[0]['columns']}
      rows={events as unknown as Record<string, unknown>[]}
      emptyText="No sync events recorded yet."
    />
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function InstanceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail]   = useState<api.InstanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const [showApiKey, setShowApiKey] = useState(false);

  const [approveModal, setApproveModal]       = useState(false);
  const [selectedPlan, setSelectedPlan]       = useState<PlanOption | null>(null);
  const [blockLicenseModal, setBlockLicenseModal]   = useState(false);
  const [blockInstanceModal, setBlockInstanceModal] = useState(false);
  const [blockLoading, setBlockLoading]             = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getInstance(id);
      setDetail(data);
    } catch {
      setError('Failed to load instance details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  function handleAction(
    type: 'approve' | 'blockLicense' | 'blockInstance' | 'unblockLicense',
    plan?: PlanOption
  ) {
    if (type === 'approve') {
      setSelectedPlan(plan ?? PLAN_OPTIONS[0]);
      setApproveModal(true);
    } else if (type === 'blockLicense') {
      setBlockLicenseModal(true);
    } else if (type === 'blockInstance') {
      setBlockInstanceModal(true);
    } else if (type === 'unblockLicense') {
      handleUnblockLicense();
    }
  }

  async function handleUnblockLicense() {
    if (!id) return;
    setBlockLoading(true);
    try {
      await api.unblockLicense(id);
      await loadDetail();
    } catch {
      // silently fail
    } finally {
      setBlockLoading(false);
    }
  }

  async function handleBlockLicense(reason: string) {
    if (!id) return;
    setBlockLoading(true);
    try {
      await api.blockLicense(id, reason);
      setBlockLicenseModal(false);
      await loadDetail();
    } catch {
      // silently fail
    } finally {
      setBlockLoading(false);
    }
  }

  async function handleBlockInstance(reason: string) {
    if (!id) return;
    setBlockLoading(true);
    try {
      await api.blockInstance(id, reason);
      setBlockInstanceModal(false);
      await loadDetail();
    } catch {
      // silently fail
    } finally {
      setBlockLoading(false);
    }
  }

  // ── Loading / error states ──

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-[#0a0f1a]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-[#0a0f1a]">
        <EmptyState
          icon={<Store size={28} />}
          title="Instance not found"
          description={error || 'This instance could not be loaded.'}
          action={{ label: 'Go back', onClick: () => navigate('/instances') }}
        />
      </div>
    );
  }

  const { instance, recentEvents, salesStats } = detail;
  const status = instance.approval_status;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <button
            type="button"
            onClick={() => navigate('/instances')}
            className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={15} />
            Instances
          </button>
          <span>/</span>
          <span className="text-slate-900 dark:text-white font-medium truncate max-w-[240px]">
            {instance.store_name}
          </span>
        </div>

        {/* ── Header card ── */}
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
                <Store size={26} />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                  {instance.store_name}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
                      statusColor(status)
                    )}
                  >
                    {status}
                  </span>

                  {instance.license_plan && (
                    <PlanBadge plan={instance.license_plan} />
                  )}

                  {instance.last_seen && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2.5 py-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <Activity size={11} />
                      {timeAgo(instance.last_seen)}
                    </span>
                  )}

                  {instance.license_expiry && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2.5 py-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <Calendar size={11} />
                      Expires {fmtDate(instance.license_expiry)}
                    </span>
                  )}
                </div>

                {instance.block_reason && (
                  <p className="mt-2 text-xs text-rose-500 bg-rose-500/10 rounded-lg px-3 py-1.5 max-w-md">
                    Block reason: {instance.block_reason}
                  </p>
                )}
              </div>
            </div>

            {id && (
              <div className="shrink-0">
                <HeaderActions instance={instance} onAction={handleAction} />
              </div>
            )}
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Sales"
            value={fmt(salesStats.total_synced_sales)}
            icon={<ShoppingCart size={18} />}
            color="blue"
            sub="synced transactions"
          />
          <StatCard
            title="Total Revenue"
            value={fmtRs(salesStats.synced_revenue)}
            icon={<DollarSign size={18} />}
            color="emerald"
            sub={salesStats.last_sale_date ? `Last: ${fmtDate(salesStats.last_sale_date)}` : undefined}
          />
          <StatCard
            title="Last Activity"
            value={timeAgo(instance.last_seen)}
            icon={<Activity size={18} />}
            color="amber"
            sub={instance.last_seen ? fmtDateTime(instance.last_seen) : 'Never'}
          />
          <StatCard
            title="App Version"
            value={instance.app_version ?? '—'}
            icon={<Cpu size={18} />}
            color="violet"
            sub="installed version"
          />
        </div>

        {/* ── Info grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Owner info */}
          <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Owner Information
            </h2>
            <div className="space-y-3">
              <InfoRow label="Owner Name">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-slate-400 shrink-0" />
                  {instance.owner_name || '—'}
                </div>
              </InfoRow>

              <InfoRow label="Mobile">
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-slate-400 shrink-0" />
                  <span className="font-mono">{instance.owner_mobile || '—'}</span>
                </div>
              </InfoRow>

              {instance.owner_email && (
                <InfoRow label="Email">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-slate-400 shrink-0" />
                    {instance.owner_email}
                  </div>
                </InfoRow>
              )}

              {instance.store_address && (
                <InfoRow label="Address">
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <span>{instance.store_address}</span>
                  </div>
                </InfoRow>
              )}

              {instance.branch_name && (
                <InfoRow label="Branch">
                  <div className="flex items-center gap-2">
                    <GitBranch size={14} className="text-slate-400 shrink-0" />
                    {instance.branch_name}
                  </div>
                </InfoRow>
              )}

              {instance.business_name && (
                <InfoRow label="Business">
                  <div className="flex items-center gap-2">
                    <Store size={14} className="text-slate-400 shrink-0" />
                    {instance.business_name}
                  </div>
                </InfoRow>
              )}
            </div>
          </div>

          {/* Technical info */}
          <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Technical Details
            </h2>
            <div className="space-y-3">
              <InfoRow label="Instance ID">
                <MonoField value={instance.instance_id} />
              </InfoRow>

              {instance.device_fingerprint && (
                <InfoRow label="Device Fingerprint">
                  <MonoField value={instance.device_fingerprint} truncate />
                </InfoRow>
              )}

              <InfoRow label="Registered">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-slate-400 shrink-0" />
                  {fmtDate(instance.created_at)}
                </div>
              </InfoRow>

              {instance.license_key && (
                <InfoRow label="License Key">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        'font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 rounded-lg px-2 py-1 transition-all',
                        !showApiKey && 'blur-sm select-none pointer-events-none'
                      )}
                    >
                      {instance.license_key}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowApiKey((v) => !v)}
                      className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                      title={showApiKey ? 'Hide key' : 'Show key'}
                    >
                      {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    {showApiKey && <CopyButton value={instance.license_key} />}
                  </div>
                </InfoRow>
              )}

              <InfoRow label="Last Updated">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Zap size={12} />
                  {fmtDateTime(instance.updated_at)}
                </div>
              </InfoRow>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="border-b border-slate-200 dark:border-white/10 px-5 py-4 overflow-x-auto">
            <Tabs
              tabs={TAB_LIST}
              active={activeTab}
              onChange={(k) => setActiveTab(k as TabKey)}
            />
          </div>

          <div className="p-5">
            {activeTab === 'overview'  && <OverviewTab events={recentEvents} />}
            {activeTab === 'sales'     && id && <SalesTab instanceId={id} />}
            {activeTab === 'products'  && id && <ProductsTab instanceId={id} />}
            {activeTab === 'customers' && id && <CustomersTab instanceId={id} />}
            {activeTab === 'vendors'   && id && <VendorsTab instanceId={id} />}
            {activeTab === 'purchases' && id && <PurchasesTab instanceId={id} />}
            {activeTab === 'expenses'  && id && <ExpensesTab instanceId={id} />}
            {activeTab === 'loans'     && id && <LoansTab instanceId={id} />}
            {activeTab === 'events'    && <EventsTab events={recentEvents} />}
          </div>
        </div>
      </div>

      {/* ── Approve modal ── */}
      {id && (
        <ApproveModal
          open={approveModal}
          onClose={() => setApproveModal(false)}
          instanceId={id}
          initialPlan={selectedPlan}
          onSuccess={loadDetail}
        />
      )}

      {/* ── Block License modal ── */}
      <BlockModal
        open={blockLicenseModal}
        onClose={() => setBlockLicenseModal(false)}
        title="Block License"
        onConfirm={handleBlockLicense}
        loading={blockLoading}
      />

      {/* ── Block Instance modal ── */}
      <BlockModal
        open={blockInstanceModal}
        onClose={() => setBlockInstanceModal(false)}
        title="Block Instance"
        onConfirm={handleBlockInstance}
        loading={blockLoading}
      />
    </div>
  );
}
