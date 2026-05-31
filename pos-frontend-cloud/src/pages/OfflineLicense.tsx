import { useEffect, useState, useCallback } from 'react';
import {
  WifiOff,
  Key,
  Copy,
  Check,
  Download,
  RefreshCw,
  Trash2,
  Plus,
  ShieldCheck,
  FileText,
  ClipboardList,
  Info,
} from 'lucide-react';
import * as api from '../api';
import type { LicenseKey } from '../api';
import {
  cn,
  fmtDate,
  fmtDateTime,
  downloadJson,
  statusColor,
  planColor,
  daysUntil,
} from '../lib/utils';
import {
  Spinner,
  Badge,
  DataTable,
  SearchInput,
  ActionButton,
  EmptyState,
  CopyButton,
  PlanBadge,
} from '../components/ui';
import type { TableColumn } from '../components/ui';

// ─── Types ──────────────────────────────────────────────────────────────────

type PlanOption = {
  label: string;
  value: string;
  days: number;
};

const PLAN_OPTIONS: PlanOption[] = [
  { label: 'Monthly (30 days)', value: 'monthly', days: 30 },
  { label: 'Quarterly (90 days)', value: 'quarterly', days: 90 },
  { label: 'Yearly (365 days)', value: 'yearly', days: 365 },
  { label: 'Lifetime', value: 'lifetime', days: 36500 },
  { label: 'Custom', value: 'custom', days: 0 },
];

interface FormState {
  businessName: string;
  deviceFingerprint: string;
  plan: string;
  customDays: string;
  notes: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcExpiry(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function truncateKey(key: string, show = 12): string {
  if (key.length <= show * 2 + 3) return key;
  return key.slice(0, show) + '…' + key.slice(-show);
}

function downloadTxt(key: string, meta: { plan: string; expires_at?: string; notes?: string; issued_at: string }) {
  const lines = [
    '=== OsaTech POS — Offline License Key ===',
    '',
    `License Key : ${key}`,
    `Plan        : ${meta.plan}`,
    `Issued      : ${fmtDate(meta.issued_at)}`,
    `Expires     : ${meta.expires_at ? fmtDate(meta.expires_at) : 'Never (Lifetime)'}`,
    meta.notes ? `Notes       : ${meta.notes}` : '',
    '',
    'Keep this key confidential.',
    '=========================================',
  ]
    .filter((l) => l !== null)
    .join('\n');

  const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `license_${key.slice(0, 8)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function isExpiredKey(k: LicenseKey): boolean {
  if (!k.expires_at) return false;
  if (k.plan === 'lifetime') return false;
  return new Date(k.expires_at) < new Date();
}

function licenseStatus(k: LicenseKey): string {
  if (!k.is_active) return 'revoked';
  if (isExpiredKey(k)) return 'expired';
  return 'active';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </label>
      {children}
      {hint && (
        <p className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-600">
          <Info size={11} className="shrink-0" />
          {hint}
        </p>
      )}
    </div>
  );
}

const INPUT_CLS =
  'w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all';

const SELECT_CLS =
  'w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all appearance-none';

// ─── Result Panel ────────────────────────────────────────────────────────────

function ResultPanel({
  license,
  onGenerateAnother,
}: {
  license: LicenseKey | null;
  onGenerateAnother: () => void;
}) {
  if (!license) {
    return (
      <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl h-full">
        <EmptyState
          icon={<Key size={24} />}
          title="No key generated yet"
          description="Fill the form on the left and click Generate License Key to create an encrypted offline key."
        />
      </div>
    );
  }

  const isLifetime = license.plan === 'lifetime';
  const expiry = isLifetime ? null : license.expires_at;
  const days = expiry ? daysUntil(expiry) : null;
  const expired = days !== null && days < 0;

  return (
    <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <ShieldCheck size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
              Key Generated
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
              Ready for offline delivery
            </p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-none',
            'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
          )}
        >
          Success
        </span>
      </div>

      <div className="p-5 flex flex-col gap-5 flex-1">
        {/* Key display */}
        <div className="rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 p-4">
          <div className="flex items-start justify-between gap-3 mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600">
              License Key
            </p>
            <CopyButton value={license.license_key} />
          </div>
          <code
            className="block font-mono text-xs text-blue-600 dark:text-blue-400 break-all leading-relaxed"
            title={license.license_key}
          >
            {truncateKey(license.license_key, 18)}
          </code>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600 mb-1.5">
              Plan
            </p>
            <PlanBadge plan={license.plan} />
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600 mb-1.5">
              Duration
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {isLifetime ? 'Lifetime' : `${license.duration_days}d`}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600 mb-1">
              Issued
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {fmtDate(license.issued_at)}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600 mb-1">
              Expires
            </p>
            {isLifetime ? (
              <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-400">Never</p>
            ) : (
              <p className={cn('text-sm', expired ? 'text-rose-500 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300')}>
                {fmtDate(license.expires_at)}
                {!expired && days !== null && days <= 30 && (
                  <span className="ml-1 text-amber-400 text-xs">({days}d)</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Notes */}
        {license.notes && (
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600 mb-1">
              Notes
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300">{license.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1 mt-auto">
          <CopyButton value={license.license_key} className="hidden" />
          <button
            onClick={() => navigator.clipboard.writeText(license.license_key)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition-all"
          >
            <Copy size={14} />
            Copy Key
          </button>
          <button
            onClick={() =>
              downloadTxt(license.license_key, {
                plan: license.plan,
                expires_at: license.expires_at,
                notes: license.notes,
                issued_at: license.issued_at,
              })
            }
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition-all"
          >
            <Download size={14} />
            Download .txt
          </button>
          <button
            onClick={onGenerateAnother}
            className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-blue-600 hover:bg-blue-700 px-3 py-2 text-sm font-medium text-white transition-all shadow-sm shadow-blue-500/20"
          >
            <Plus size={14} />
            Generate Another
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function OfflineLicense() {
  // ── form state
  const [form, setForm] = useState<FormState>({
    businessName: '',
    deviceFingerprint: '',
    plan: 'monthly',
    customDays: '30',
    notes: '',
  });
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── result
  const [generatedKey, setGeneratedKey] = useState<LicenseKey | null>(null);

  // ── history table
  const [licenses, setLicenses] = useState<LicenseKey[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deactivating, setDeactivating] = useState<string | null>(null);

  // ─── Load history ────────────────────────────────────────────────────────

  const loadLicenses = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await api.getLicenses();
      setLicenses(data);
    } catch {
      // swallow
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLicenses();
  }, [loadLicenses]);

  // ─── Derived form values ─────────────────────────────────────────────────

  const selectedPlan = PLAN_OPTIONS.find((p) => p.value === form.plan) ?? PLAN_OPTIONS[0];
  const isCustom = form.plan === 'custom';
  const isLifetime = form.plan === 'lifetime';
  const effectiveDays = isLifetime
    ? 36500
    : isCustom
    ? parseInt(form.customDays || '0', 10)
    : selectedPlan.days;

  // ─── Handlers ────────────────────────────────────────────────────────────

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handlePlanChange(val: string) {
    const opt = PLAN_OPTIONS.find((p) => p.value === val);
    setField('plan', val);
    if (opt && val !== 'custom') {
      setField('customDays', String(opt.days));
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenError('');
    setSuccessMsg('');

    if (!isLifetime && effectiveDays < 1) {
      setGenError('Duration must be at least 1 day.');
      return;
    }

    setGenerating(true);
    try {
      // Build notes: prepend business name / device fingerprint if provided
      const notesParts: string[] = [];
      if (form.businessName.trim()) notesParts.push(`Issued to: ${form.businessName.trim()}`);
      if (form.deviceFingerprint.trim()) notesParts.push(`HW ID: ${form.deviceFingerprint.trim()}`);
      if (form.notes.trim()) notesParts.push(form.notes.trim());

      const created = await api.createLicense({
        plan: form.plan === 'custom' ? 'custom' : form.plan,
        duration_days: effectiveDays,
        notes: notesParts.join(' | ') || undefined,
        instance_id: null,
      });

      setGeneratedKey(created);
      setSuccessMsg('License key generated successfully.');
      // Reset form
      setForm({
        businessName: '',
        deviceFingerprint: '',
        plan: 'monthly',
        customDays: '30',
        notes: '',
      });
      // Refresh history
      void loadLicenses();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setGenError(axiosErr?.response?.data?.error ?? 'Failed to generate license key. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeactivate(licenseKey: string) {
    if (!confirm('Deactivate this license key? This cannot be undone.')) return;
    setDeactivating(licenseKey);
    try {
      await api.deleteLicense(licenseKey);
      void loadLicenses();
      // If it was the generated key shown in result panel, clear it
      if (generatedKey?.license_key === licenseKey) setGeneratedKey(null);
    } catch {
      // swallow
    } finally {
      setDeactivating(null);
    }
  }

  // ─── Table columns ────────────────────────────────────────────────────────

  const filteredLicenses = licenses.filter((k) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      k.license_key.toLowerCase().includes(q) ||
      (k.notes ?? '').toLowerCase().includes(q) ||
      k.plan.toLowerCase().includes(q) ||
      (k.store_name ?? '').toLowerCase().includes(q)
    );
  });

  const columns: TableColumn<Record<string, unknown>>[] = [
    {
      key: 'license_key',
      header: 'Key',
      width: '240px',
      render: (val) => {
        const key = val as string;
        return (
          <div className="flex items-center gap-2 min-w-0">
            <code
              className="font-mono text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded truncate max-w-[160px]"
              title={key}
            >
              {truncateKey(key, 10)}
            </code>
            <CopyButton value={key} />
          </div>
        );
      },
    },
    {
      key: 'plan',
      header: 'Plan',
      width: '100px',
      render: (val) => <PlanBadge plan={val as string} />,
    },
    {
      key: 'duration_days',
      header: 'Duration',
      width: '90px',
      render: (val, row) => {
        const plan = row.plan as string;
        return (
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {plan === 'lifetime' ? '∞' : `${val}d`}
          </span>
        );
      },
    },
    {
      key: 'expires_at',
      header: 'Expires',
      width: '120px',
      render: (val, row) => {
        const plan = row.plan as string;
        const exp = val as string | undefined;
        if (plan === 'lifetime') {
          return <span className="text-xs text-emerald-500 dark:text-emerald-400 font-medium">Never</span>;
        }
        const expired = exp && new Date(exp) < new Date();
        return (
          <span className={cn('text-xs', expired ? 'text-rose-500 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400')}>
            {fmtDate(exp)}
          </span>
        );
      },
    },
    {
      key: 'is_active',
      header: 'Status',
      width: '100px',
      render: (_val, row) => {
        const k = row as unknown as LicenseKey;
        const s = licenseStatus(k);
        const unassigned = !k.instance_id;
        return (
          <div className="flex flex-col gap-1">
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none capitalize',
                statusColor(s)
              )}
            >
              {s}
            </span>
            {unassigned && s === 'active' && (
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none bg-amber-500/15 text-amber-400 border-amber-500/30">
                unassigned
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'instance_id',
      header: 'Assigned To',
      render: (val, row) => {
        const storeName = row.store_name as string | undefined;
        const mobile = row.owner_mobile as string | undefined;
        if (!val) {
          return <span className="text-xs text-slate-400 dark:text-slate-600">— unassigned</span>;
        }
        return (
          <div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{storeName || (val as string)}</p>
            {mobile && <p className="text-[11px] text-slate-400 dark:text-slate-600 font-mono">{mobile}</p>}
          </div>
        );
      },
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (val) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] truncate block" title={val as string}>
          {(val as string) || '—'}
        </span>
      ),
    },
    {
      key: 'issued_at',
      header: 'Issued',
      width: '120px',
      render: (val) => <span className="text-xs text-slate-500 dark:text-slate-400">{fmtDate(val as string)}</span>,
    },
    {
      key: '_actions',
      header: '',
      width: '60px',
      align: 'right',
      render: (_val, row) => {
        const k = row as unknown as LicenseKey;
        const isActive = !!k.is_active;
        const isDel = deactivating === k.license_key;
        if (!isActive) return <span className="text-xs text-slate-400 dark:text-slate-600">—</span>;
        return (
          <button
            onClick={() => handleDeactivate(k.license_key)}
            disabled={isDel}
            title="Deactivate"
            className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 disabled:opacity-40 transition-all"
          >
            {isDel ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 size={14} />}
          </button>
        );
      },
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  const unassignedCount = licenses.filter((k) => !k.instance_id && k.is_active).length;
  const activeCount = licenses.filter((k) => k.is_active).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600/15 text-blue-400">
            <WifiOff size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
              Offline License Generator
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Generate encrypted license keys for offline delivery
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {activeCount} active &nbsp;·&nbsp; {unassignedCount} unassigned
          </span>
        </div>
      </div>

      {/* Success notification */}
      {successMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <Check size={16} className="shrink-0" />
          <span>{successMsg}</span>
          <button
            onClick={() => setSuccessMsg('')}
            className="ml-auto text-emerald-400/60 hover:text-emerald-400 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Two-column: form + result */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Left: Generate Form */}
        <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 px-5 py-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
              <Key size={14} />
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Generate New License</h2>
          </div>

          <form onSubmit={handleGenerate} className="p-5 flex flex-col gap-4">

            {/* Business Name */}
            <FormField label="Business Name" hint="Who this license is issued to">
              <input
                type="text"
                className={INPUT_CLS}
                placeholder="e.g. Ahmed Electronics, Lahore"
                value={form.businessName}
                onChange={(e) => setField('businessName', e.target.value)}
              />
            </FormField>

            {/* Device Fingerprint */}
            <FormField
              label="Device Fingerprint / Hardware ID"
              hint="Leave blank to create a device-independent license"
            >
              <input
                type="text"
                className={cn(INPUT_CLS, 'font-mono text-xs tracking-wide')}
                placeholder="e.g. A1B2C3D4-E5F6-..."
                value={form.deviceFingerprint}
                onChange={(e) => setField('deviceFingerprint', e.target.value)}
              />
            </FormField>

            {/* License Plan */}
            <FormField label="License Plan">
              <select
                className={SELECT_CLS}
                value={form.plan}
                onChange={(e) => handlePlanChange(e.target.value)}
              >
                {PLAN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Custom Duration — only shown when Custom is selected */}
            {isCustom && (
              <FormField label="Custom Duration (days)">
                <input
                  type="number"
                  min="1"
                  max="36500"
                  className={INPUT_CLS}
                  placeholder="e.g. 60"
                  value={form.customDays}
                  onChange={(e) => setField('customDays', e.target.value)}
                />
              </FormField>
            )}

            {/* Notes */}
            <FormField label="Notes (optional)">
              <textarea
                className={cn(INPUT_CLS, 'resize-none h-20')}
                placeholder="Internal notes about this license..."
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
              />
            </FormField>

            {/* Preview line */}
            {!isLifetime && effectiveDays > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] px-3 py-2.5 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Key will expire on</span>
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  {fmtDate(calcExpiry(effectiveDays))}
                </span>
              </div>
            )}
            {isLifetime && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  Lifetime license — never expires
                </span>
              </div>
            )}

            {/* Error */}
            {genError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-500 dark:text-rose-400">
                {genError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={generating}
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white transition-all shadow-sm shadow-blue-500/20"
            >
              {generating ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <ShieldCheck size={15} />
              )}
              {generating ? 'Generating…' : 'Generate License Key'}
            </button>
          </form>
        </div>

        {/* Right: Result Panel */}
        <ResultPanel
          license={generatedKey}
          onGenerateAnother={() => setGeneratedKey(null)}
        />
      </div>

      {/* Bottom: License History */}
      <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl">
        {/* Table header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-500/15 text-slate-400">
              <ClipboardList size={14} />
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">All License Keys</h2>
            <span className="rounded-full bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {filteredLicenses.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by key, notes, plan..."
              className="w-56"
            />
            <button
              onClick={() => void loadLicenses()}
              disabled={historyLoading}
              title="Refresh"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-40"
            >
              <RefreshCw size={14} className={historyLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() =>
                downloadJson(
                  filteredLicenses,
                  `licenses_${new Date().toISOString().slice(0, 10)}.json`
                )
              }
              disabled={filteredLicenses.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-40"
            >
              <Download size={13} />
              Export JSON
            </button>
          </div>
        </div>

        {/* DataTable */}
        <div className="p-5">
          <DataTable<Record<string, unknown>>
            columns={columns}
            rows={filteredLicenses.map((k) => ({ ...k, _actions: null }) as Record<string, unknown>)}
            loading={historyLoading}
            emptyText={
              search
                ? `No licenses match "${search}"`
                : 'No license keys generated yet.'
            }
          />
        </div>

        {/* Unassigned highlight */}
        {!historyLoading && unassignedCount > 0 && (
          <div className="flex items-center gap-2 border-t border-slate-200 dark:border-white/10 px-5 py-3">
            <Info size={13} className="text-amber-400 shrink-0" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-amber-500 dark:text-amber-400">{unassignedCount} unassigned</span>
              {' '}active {unassignedCount === 1 ? 'key' : 'keys'} — deliver these to customers or assign via the Licenses page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
