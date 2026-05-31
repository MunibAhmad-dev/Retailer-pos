import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Key, Plus, Download, RefreshCw, UserPlus, XCircle,
  AlertTriangle, CheckCircle2, Clock, Unlink, Search,
} from 'lucide-react';
import {
  cn, fmtDate, daysUntil, downloadJson, planColor,
} from '../lib/utils';
import {
  Spinner, Badge, StatCard, Modal, SearchInput,
  ActionButton, EmptyState, Tabs, CopyButton, PlanBadge,
} from '../components/ui';
import * as api from '../api';
import type { LicenseKey, Instance } from '../api';

// ─── Plan presets ──────────────────────────────────────────────────────────────

const PLAN_PRESETS = [
  { label: 'Monthly',   plan: 'monthly',   days: 30    },
  { label: 'Quarterly', plan: 'quarterly', days: 90    },
  { label: 'Yearly',    plan: 'yearly',    days: 365   },
  { label: 'Lifetime',  plan: 'lifetime',  days: 36500 },
  { label: 'Custom',    plan: 'custom',    days: 30    },
] as const;

type PlanPresetKey = typeof PLAN_PRESETS[number]['plan'];

// ─── Filter helpers ────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'active' | 'expiring' | 'expired' | 'unassigned';

function licenseStatus(lic: LicenseKey): 'active' | 'expiring' | 'expired' | 'inactive' {
  if (!lic.is_active) return 'inactive';
  const d = daysUntil(lic.expires_at);
  if (d <= 0) return 'expired';
  if (d <= 30) return 'expiring';
  return 'active';
}

function filterLicenses(licenses: LicenseKey[], tab: FilterTab, q: string): LicenseKey[] {
  let list = licenses;
  if (tab === 'active')     list = list.filter(l => licenseStatus(l) === 'active');
  if (tab === 'expiring')   list = list.filter(l => licenseStatus(l) === 'expiring');
  if (tab === 'expired')    list = list.filter(l => licenseStatus(l) === 'expired');
  if (tab === 'unassigned') list = list.filter(l => !l.instance_id);
  if (q.trim()) {
    const lq = q.toLowerCase();
    list = list.filter(l =>
      l.license_key.toLowerCase().includes(lq) ||
      (l.store_name ?? '').toLowerCase().includes(lq) ||
      (l.owner_mobile ?? '').includes(lq) ||
      (l.plan ?? '').toLowerCase().includes(lq) ||
      (l.notes ?? '').toLowerCase().includes(lq)
    );
  }
  return list;
}

// ─── Expiry display ────────────────────────────────────────────────────────────

function ExpiryCell({ expiresAt }: { expiresAt?: string }) {
  if (!expiresAt) return <span className="text-slate-400 dark:text-slate-600 text-xs">No expiry</span>;
  const d = daysUntil(expiresAt);
  const label = fmtDate(expiresAt);
  if (d <= 0)  return <span className="text-rose-400 text-xs font-medium">{label} (Expired)</span>;
  if (d <= 30) return <span className="text-amber-400 text-xs font-medium">{label} ({d}d left)</span>;
  return <span className="text-slate-600 dark:text-slate-300 text-xs">{label}</span>;
}

// ─── License key cell ─────────────────────────────────────────────────────────

function LicenseKeyCell({ value }: { value: string }) {
  const truncated = value.length > 16
    ? value.slice(0, 12) + '...' + value.slice(-4)
    : value;
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-xs text-slate-700 dark:text-slate-300 select-all">
        {truncated}
      </span>
      <CopyButton value={value} />
    </div>
  );
}

// ─── Generate License Modal ────────────────────────────────────────────────────

interface GenerateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  instances: Instance[];
}

function GenerateModal({ open, onClose, onCreated, instances }: GenerateModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<PlanPresetKey>('monthly');
  const [days, setDays]       = useState(30);
  const [notes, setNotes]     = useState('');
  const [instanceQ, setInstanceQ] = useState('');
  const [assignTo, setAssignTo]   = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (open) {
      setSelectedPreset('monthly');
      setDays(30);
      setNotes('');
      setInstanceQ('');
      setAssignTo(null);
      setError('');
    }
  }, [open]);

  const filteredInstances = useMemo(() => {
    if (!instanceQ.trim()) return instances.slice(0, 12);
    const lq = instanceQ.toLowerCase();
    return instances
      .filter(i =>
        i.store_name.toLowerCase().includes(lq) ||
        i.owner_mobile.includes(lq) ||
        i.instance_id.toLowerCase().includes(lq)
      )
      .slice(0, 12);
  }, [instances, instanceQ]);

  const selectedInstance = useMemo(
    () => instances.find(i => i.instance_id === assignTo),
    [instances, assignTo]
  );

  function handlePresetClick(p: typeof PLAN_PRESETS[number]) {
    setSelectedPreset(p.plan);
    if (p.plan !== 'custom') setDays(p.days);
  }

  async function handleGenerate() {
    setSaving(true);
    setError('');
    try {
      await api.createLicense({
        plan: selectedPreset,
        duration_days: days,
        notes: notes.trim() || undefined,
        instance_id: assignTo ?? null,
      });
      onCreated();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate license';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const inputClass = cn(
    'w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10',
    'rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white',
    'placeholder:text-slate-400 dark:placeholder:text-slate-600',
    'focus:outline-none focus:ring-2 focus:ring-blue-500/40'
  );

  return (
    <Modal open={open} onClose={onClose} title="Generate License Key" size="md">
      <div className="space-y-5">
        {/* Plan selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Plan
          </label>
          <div className="flex flex-wrap gap-2">
            {PLAN_PRESETS.map(p => (
              <button
                key={p.plan}
                type="button"
                onClick={() => handlePresetClick(p)}
                className={cn(
                  'px-3 py-1.5 rounded-xl border text-xs font-medium transition-all',
                  selectedPreset === p.plan
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/25'
                    : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-blue-500/50 hover:text-blue-500'
                )}
              >
                {p.label}
                {p.plan !== 'custom' && (
                  <span className="ml-1 opacity-60">({p.days}d)</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Duration (days)
          </label>
          <input
            type="number"
            min={1}
            value={days}
            onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 1))}
            className={inputClass}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Notes{' '}
            <span className="normal-case font-normal text-slate-400 dark:text-slate-600">(optional)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Trial for Ahmed Store, Peshawar"
            className={inputClass}
          />
        </div>

        {/* Assign to instance */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Assign to Instance{' '}
            <span className="normal-case font-normal text-slate-400 dark:text-slate-600">(optional)</span>
          </label>
          {assignTo && selectedInstance ? (
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
              <div>
                <p className="text-sm font-medium text-emerald-400">{selectedInstance.store_name}</p>
                <p className="text-xs text-emerald-500/70 mt-0.5">{selectedInstance.owner_mobile}</p>
              </div>
              <button
                type="button"
                onClick={() => { setAssignTo(null); setInstanceQ(''); }}
                className="text-emerald-400 hover:text-rose-400 transition-colors"
              >
                <XCircle size={16} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={instanceQ}
                  onChange={e => setInstanceQ(e.target.value)}
                  placeholder="Search store name or mobile…"
                  className={cn(inputClass, 'pl-9')}
                />
              </div>
              {filteredInstances.length > 0 && (
                <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                  {filteredInstances.map(inst => (
                    <button
                      key={inst.instance_id}
                      type="button"
                      onClick={() => { setAssignTo(inst.instance_id); setInstanceQ(''); }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-white/5 last:border-0 transition-colors"
                    >
                      <div>
                        <p className="text-sm text-slate-800 dark:text-slate-200">{inst.store_name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-600 mt-0.5">{inst.owner_mobile}</p>
                      </div>
                      <span className={cn('text-xs rounded-full border px-2 py-0.5', planColor(inst.license_plan ?? ''))}>
                        {inst.license_plan ?? 'none'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <ActionButton label="Cancel" variant="secondary" onClick={onClose} className="flex-1" />
          <ActionButton
            label="Generate License"
            icon={<Key size={14} />}
            onClick={handleGenerate}
            loading={saving}
            className="flex-1"
          />
        </div>
      </div>
    </Modal>
  );
}

// ─── Assign Modal ──────────────────────────────────────────────────────────────

interface AssignModalProps {
  open: boolean;
  licenseKey: string | null;
  onClose: () => void;
  onAssigned: () => void;
  instances: Instance[];
}

function AssignModal({ open, licenseKey, onClose, onAssigned, instances }: AssignModalProps) {
  const [q, setQ]               = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (open) { setQ(''); setSelected(null); setError(''); }
  }, [open]);

  const filtered = useMemo(() => {
    if (!q.trim()) return instances.filter(i => !i.license_key).slice(0, 15);
    const lq = q.toLowerCase();
    return instances
      .filter(i =>
        i.store_name.toLowerCase().includes(lq) ||
        i.owner_mobile.includes(lq)
      )
      .slice(0, 15);
  }, [instances, q]);

  async function handleAssign() {
    if (!licenseKey || !selected) return;
    setSaving(true);
    setError('');
    try {
      await api.assignLicense(licenseKey, selected);
      onAssigned();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to assign license');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = cn(
    'w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10',
    'rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white pl-9',
    'placeholder:text-slate-400 dark:placeholder:text-slate-600',
    'focus:outline-none focus:ring-2 focus:ring-blue-500/40'
  );

  return (
    <Modal open={open} onClose={onClose} title="Assign License to Instance" size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Select a store to assign this license key to.
        </p>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by store name or mobile…"
            className={inputClass}
          />
        </div>
        <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-600 text-center py-6">No instances found</p>
          ) : (
            filtered.map(inst => (
              <button
                key={inst.instance_id}
                type="button"
                onClick={() => setSelected(inst.instance_id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors',
                  'border-b border-slate-100 dark:border-white/5 last:border-0',
                  selected === inst.instance_id
                    ? 'bg-blue-500/10 dark:bg-blue-600/15'
                    : 'hover:bg-slate-50 dark:hover:bg-white/5'
                )}
              >
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{inst.store_name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-600 mt-0.5 font-mono">{inst.owner_mobile}</p>
                </div>
                <div className="flex items-center gap-2">
                  {inst.license_key && (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-1.5 py-0.5">
                      Has license
                    </span>
                  )}
                  {selected === inst.instance_id && (
                    <CheckCircle2 size={16} className="text-blue-500 shrink-0" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
        {error && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <ActionButton label="Cancel" variant="secondary" onClick={onClose} className="flex-1" />
          <ActionButton
            label="Assign License"
            icon={<UserPlus size={14} />}
            onClick={handleAssign}
            loading={saving}
            disabled={!selected}
            className="flex-1"
          />
        </div>
      </div>
    </Modal>
  );
}

// ─── Deactivate Confirm Modal ──────────────────────────────────────────────────

interface DeactivateModalProps {
  open: boolean;
  license: LicenseKey | null;
  onClose: () => void;
  onDeactivated: () => void;
}

function DeactivateModal({ open, license, onClose, onDeactivated }: DeactivateModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => { if (open) setError(''); }, [open]);

  async function handleConfirm() {
    if (!license) return;
    setSaving(true);
    setError('');
    try {
      await api.deleteLicense(license.license_key);
      onDeactivated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to deactivate license');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Deactivate License" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
          <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-400">
            This will deactivate the license and remove it from the assigned store. This action cannot be undone.
          </p>
        </div>
        {license && (
          <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">License Key</span>
              <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                {license.license_key.slice(0, 12)}…
              </span>
            </div>
            {license.store_name && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 dark:text-slate-400">Assigned To</span>
                <span className="text-xs text-slate-700 dark:text-slate-300">{license.store_name}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">Plan</span>
              <PlanBadge plan={license.plan} />
            </div>
          </div>
        )}
        {error && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <ActionButton label="Cancel" variant="secondary" onClick={onClose} className="flex-1" />
          <ActionButton
            label="Deactivate"
            icon={<XCircle size={14} />}
            variant="danger"
            onClick={handleConfirm}
            loading={saving}
            className="flex-1"
          />
        </div>
      </div>
    </Modal>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Licenses() {
  const [licenses, setLicenses]   = useState<LicenseKey[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<FilterTab>('all');
  const [search, setSearch]       = useState('');

  const [showGenerate, setShowGenerate]         = useState(false);
  const [assignTarget, setAssignTarget]         = useState<LicenseKey | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<LicenseKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lics, insts] = await Promise.all([
        api.getLicenses(),
        api.getInstances({ limit: 500, offset: 0 }).then(r => r.data),
      ]);
      setLicenses(lics);
      setInstances(insts);
    } catch {
      // display empty state on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── computed stats ──────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total      = licenses.length;
    const active     = licenses.filter(l => licenseStatus(l) === 'active').length;
    const assigned   = licenses.filter(l => !!l.instance_id).length;
    const unassigned = licenses.filter(l => !l.instance_id).length;
    const expiring   = licenses.filter(l => licenseStatus(l) === 'expiring').length;
    const expired    = licenses.filter(l => licenseStatus(l) === 'expired').length;
    return { total, active, assigned, unassigned, expiring, expired };
  }, [licenses]);

  const tabCounts: Record<FilterTab, number> = useMemo(() => ({
    all:        licenses.length,
    active:     stats.active,
    expiring:   stats.expiring,
    expired:    stats.expired,
    unassigned: stats.unassigned,
  }), [licenses, stats]);

  const TABS = [
    { key: 'all',        label: 'All',          count: tabCounts.all        },
    { key: 'active',     label: 'Active',        count: tabCounts.active     },
    { key: 'expiring',   label: 'Expiring Soon', count: tabCounts.expiring   },
    { key: 'expired',    label: 'Expired',       count: tabCounts.expired    },
    { key: 'unassigned', label: 'Unassigned',    count: tabCounts.unassigned },
  ];

  const visibleLicenses = useMemo(
    () => filterLicenses(licenses, tab, search),
    [licenses, tab, search]
  );

  function handleExport() {
    const date = new Date().toISOString().split('T')[0];
    downloadJson(visibleLicenses, `licenses_${date}.json`);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">License Keys</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {stats.total} total · {stats.assigned} assigned · {stats.unassigned} unassigned
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ActionButton
            label="Generate License"
            icon={<Plus size={15} />}
            onClick={() => setShowGenerate(true)}
          />
          <ActionButton
            label="Export JSON"
            icon={<Download size={15} />}
            variant="secondary"
            onClick={handleExport}
          />
          <ActionButton
            label="Refresh"
            icon={<RefreshCw size={15} />}
            variant="secondary"
            onClick={load}
            loading={loading}
          />
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Total Keys"    value={stats.total}      icon={<Key size={18} />}           color="blue"    />
        <StatCard title="Active"        value={stats.active}     icon={<CheckCircle2 size={18} />}  color="emerald" />
        <StatCard title="Assigned"      value={stats.assigned}   icon={<UserPlus size={18} />}      color="violet"  />
        <StatCard title="Unassigned"    value={stats.unassigned} icon={<Unlink size={18} />}        color="slate"   />
        <StatCard title="Expiring ≤30d" value={stats.expiring}   icon={<Clock size={18} />}         color="amber"   />
        <StatCard title="Expired"       value={stats.expired}    icon={<AlertTriangle size={18} />} color="rose"    />
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          tabs={TABS}
          active={tab}
          onChange={v => setTab(v as FilterTab)}
        />
        <div className="flex-1 min-w-[200px] max-w-xs">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search key, store, mobile…"
          />
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <Spinner className="h-7 w-7" />
          </div>
        ) : visibleLicenses.length === 0 ? (
          <EmptyState
            icon={<Key size={24} />}
            title="No license keys found"
            description={
              tab !== 'all'
                ? 'No licenses match the current filter. Try switching tabs or clearing the search.'
                : 'Generate your first license key to get started.'
            }
            action={{ label: 'Generate License', onClick: () => setShowGenerate(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
                  {[
                    { label: 'License Key', w: '220px' },
                    { label: 'Plan',        w: '100px' },
                    { label: 'Duration',    w: '90px'  },
                    { label: 'Assigned To', w: '200px' },
                    { label: 'Expires',     w: '160px' },
                    { label: 'Notes',       w: '180px' },
                    { label: 'Actions',     w: '130px', align: 'right' as const },
                  ].map(col => (
                    <th
                      key={col.label}
                      style={{ width: col.w }}
                      className={cn(
                        'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap',
                        col.align === 'right' ? 'text-right' : 'text-left'
                      )}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleLicenses.map(lic => (
                  <tr
                    key={lic.id}
                    className="border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {/* License Key */}
                    <td className="px-4 py-3">
                      <LicenseKeyCell value={lic.license_key} />
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-3">
                      <PlanBadge plan={lic.plan} />
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {lic.duration_days} days
                      </span>
                    </td>

                    {/* Assigned To */}
                    <td className="px-4 py-3">
                      {lic.instance_id && lic.store_name ? (
                        <div>
                          <p className="text-sm text-slate-800 dark:text-slate-200 leading-tight truncate max-w-[160px]">
                            {lic.store_name}
                          </p>
                          {lic.owner_mobile && (
                            <p className="text-xs text-slate-400 dark:text-slate-600 font-mono mt-0.5">
                              {lic.owner_mobile}
                            </p>
                          )}
                        </div>
                      ) : (
                        <Badge status="inactive">Unassigned</Badge>
                      )}
                    </td>

                    {/* Expires */}
                    <td className="px-4 py-3">
                      <ExpiryCell expiresAt={lic.expires_at} />
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3">
                      {lic.notes ? (
                        <span
                          className="text-xs text-slate-500 dark:text-slate-400 truncate block max-w-[160px]"
                          title={lic.notes}
                        >
                          {lic.notes}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700 text-xs">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <CopyButton value={lic.license_key} />

                        {!lic.instance_id && lic.is_active === 1 && (
                          <button
                            type="button"
                            onClick={() => setAssignTarget(lic)}
                            title="Assign to an instance"
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-500 hover:bg-blue-500/10 border border-blue-500/30 transition-all"
                          >
                            <UserPlus size={12} />
                            Assign
                          </button>
                        )}

                        {lic.is_active === 1 && (
                          <button
                            type="button"
                            onClick={() => setDeactivateTarget(lic)}
                            title="Deactivate this license"
                            className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                          >
                            <XCircle size={14} />
                          </button>
                        )}

                        {lic.is_active !== 1 && (
                          <span className="text-xs text-slate-400 dark:text-slate-600 italic">Inactive</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer count */}
        {!loading && visibleLicenses.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.015]">
            <p className="text-xs text-slate-400 dark:text-slate-600">
              Showing {visibleLicenses.length} of {licenses.length} license{licenses.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <GenerateModal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        onCreated={load}
        instances={instances}
      />

      <AssignModal
        open={!!assignTarget}
        licenseKey={assignTarget?.license_key ?? null}
        onClose={() => setAssignTarget(null)}
        onAssigned={load}
        instances={instances}
      />

      <DeactivateModal
        open={!!deactivateTarget}
        license={deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onDeactivated={load}
      />
    </div>
  );
}
