import { useState } from 'react';
import {
  User, Shield, Server, Database, Download,
  Layers, AlertTriangle, CheckCircle2, Loader2, Eye, EyeOff,
} from 'lucide-react';
import { cn, downloadJson } from '../lib/utils';
import { Modal, ActionButton, Spinner } from '../components/ui';
import * as api from '../api';

// ─── helpers / sub-components ─────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
      {children}
    </p>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl p-5',
        className
      )}
    >
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-white/5 last:border-0">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

function StatusBanner({
  type,
  message,
}: {
  type: 'success' | 'error' | 'info';
  message: string;
}) {
  const styles = {
    success: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300',
    error:   'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300',
    info:    'bg-blue-500/10 border-blue-500/25 text-blue-700 dark:text-blue-300',
  };
  const Icon =
    type === 'success'
      ? CheckCircle2
      : type === 'error'
      ? AlertTriangle
      : Loader2;

  return (
    <div className={cn('flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm', styles[type])}>
      <Icon size={15} className="shrink-0 mt-0.5" />
      <p>{message}</p>
    </div>
  );
}

// ─── Change Password modal ─────────────────────────────────────────────────────

function ChangePasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const inputClass =
    'w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 pr-10';

  return (
    <Modal open={open} onClose={onClose} title="Change Password" size="sm">
      <div className="space-y-4">
        {/* Coming soon notice */}
        <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
            <Shield size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Feature Coming Soon
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-xs">
              Password management will be available in a future update. For now, please contact your system administrator to change your password.
            </p>
          </div>
        </div>
        {/* Disabled form (visual reference) */}
        <div className="space-y-3 opacity-40 pointer-events-none select-none" aria-hidden="true">
          <div className="relative">
            <input type="password" placeholder="Current password" className={inputClass} disabled />
            <Eye size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          <div className="relative">
            <input type="password" placeholder="New password" className={inputClass} disabled />
            <EyeOff size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          <div className="relative">
            <input type="password" placeholder="Confirm new password" className={inputClass} disabled />
            <EyeOff size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
        <ActionButton
          label="Close"
          variant="secondary"
          onClick={onClose}
          className="w-full justify-center"
        />
      </div>
    </Modal>
  );
}

// ─── Export Instances modal ────────────────────────────────────────────────────

type StatusFilter = 'all' | 'approved' | 'pending' | 'blocked';

function ExportInstancesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [exporting, setExporting]       = useState(false);
  const [error, setError]               = useState('');

  const handleExport = async () => {
    setError('');
    setExporting(true);
    try {
      const data = await api.exportAll(statusFilter === 'all' ? undefined : statusFilter);
      downloadJson(data, `instances_export_${statusFilter}_${new Date().toISOString().slice(0, 10)}.json`);
      onClose();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Export failed.';
      setError(msg);
    } finally {
      setExporting(false);
    }
  };

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'approved', label: 'Approved' },
    { key: 'pending',  label: 'Pending' },
    { key: 'blocked',  label: 'Blocked' },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Export Instances" size="sm">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Status Filter
          </p>
          <div className="grid grid-cols-2 gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  'px-3 py-2 rounded-xl border text-sm font-medium transition-all',
                  statusFilter === f.key
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-300'
                    : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {error && <StatusBanner type="error" message={error} />}
        <div className="flex gap-2 pt-1">
          <ActionButton label="Cancel" variant="secondary" onClick={onClose} disabled={exporting} className="flex-1 justify-center" />
          <ActionButton
            label={exporting ? 'Exporting...' : 'Export JSON'}
            icon={<Download size={14} />}
            loading={exporting}
            onClick={handleExport}
            className="flex-1 justify-center"
          />
        </div>
      </div>
    </Modal>
  );
}

// ─── Seed confirm modal ───────────────────────────────────────────────────────

function SeedConfirmModal({
  open,
  onClose,
  onConfirm,
  seeding,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  seeding: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Seed Demo Data" size="sm">
      <div className="space-y-4">
        <StatusBanner
          type="info"
          message="This will populate the database with demo instances, sales, and products for testing. Existing data will not be deleted."
        />
        <div className="flex gap-2 pt-1">
          <ActionButton label="Cancel" variant="secondary" onClick={onClose} disabled={seeding} className="flex-1 justify-center" />
          <ActionButton
            label={seeding ? 'Seeding...' : 'Confirm & Seed'}
            loading={seeding}
            onClick={onConfirm}
            className="flex-1 justify-center"
          />
        </div>
      </div>
    </Modal>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [showPasswordModal,  setShowPasswordModal]  = useState(false);
  const [showExportModal,    setShowExportModal]     = useState(false);
  const [showSeedModal,      setShowSeedModal]       = useState(false);

  const [seeding,   setSeeding]   = useState(false);
  const [seedMsg,   setSeedMsg]   = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // System info
  const backendUrl = (import.meta.env.VITE_API_URL as string | undefined) || '/api (proxied)';

  const handleSeedConfirm = async () => {
    setSeeding(true);
    setSeedMsg(null);
    try {
      await api.seedDemo();
      setSeedMsg({ type: 'success', text: 'Demo data seeded successfully.' });
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Seeding failed.';
      setSeedMsg({ type: 'error', text: msg });
    } finally {
      setSeeding(false);
      setShowSeedModal(false);
    }
  };

  const handleExportAll = async () => {
    setExporting(true);
    setExportMsg(null);
    try {
      const data = await api.exportAll();
      downloadJson(data, `full_export_${new Date().toISOString().slice(0, 10)}.json`);
      setExportMsg({ type: 'success', text: 'Export downloaded.' });
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Export failed.';
      setExportMsg({ type: 'error', text: msg });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Manage your account, system information, and data.
        </p>
      </div>

      {/* Section 1: Account */}
      <div>
        <SectionTitle>Account</SectionTitle>
        <Card>
          <div className="flex items-start gap-4 mb-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
              <User size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Administrator</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Logged in as the platform admin
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/5 mb-4">
            <InfoRow label="Username" value="admin" />
            <InfoRow
              label="Role"
              value={
                <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-500/15 text-blue-400 border-blue-500/30">
                  <Shield size={11} /> Admin
                </span>
              }
            />
          </div>
          <ActionButton
            label="Change Password"
            variant="secondary"
            icon={<Shield size={14} />}
            onClick={() => setShowPasswordModal(true)}
          />
        </Card>
      </div>

      {/* Section 2: System */}
      <div>
        <SectionTitle>System</SectionTitle>
        <Card>
          <div className="flex items-start gap-4 mb-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-500/15 text-slate-400">
              <Server size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">System Info</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Read-only environment details
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            <InfoRow
              label="Backend URL"
              value={
                <span className="font-mono text-xs text-slate-600 dark:text-slate-300 truncate max-w-[200px] block text-right">
                  {backendUrl}
                </span>
              }
            />
            <InfoRow label="App Version" value="1.0.0" />
            <InfoRow
              label="Database"
              value={
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <Database size={12} />
                  PostgreSQL (VPS)
                </span>
              }
            />
          </div>
        </Card>
      </div>

      {/* Section 3: Data Management */}
      <div>
        <SectionTitle>Data Management</SectionTitle>
        <div className="space-y-3">

          {/* Seed demo data */}
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
                    <Layers size={15} />
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Seed Demo Data
                  </p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 ml-10">
                  Populate the database with sample instances and sales data for testing.
                </p>
              </div>
              <ActionButton
                label={seeding ? 'Seeding...' : 'Seed Demo Data'}
                icon={seeding ? <Spinner className="h-3.5 w-3.5" /> : <Layers size={14} />}
                variant="secondary"
                onClick={() => setShowSeedModal(true)}
                disabled={seeding}
                className="shrink-0"
              />
            </div>
            {seedMsg && (
              <div className="mt-3">
                <StatusBanner type={seedMsg.type} message={seedMsg.text} />
              </div>
            )}
          </Card>

          {/* Export all data */}
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                    <Download size={15} />
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Export All Data
                  </p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 ml-10">
                  Download all instances and related data as a JSON file.
                </p>
              </div>
              <ActionButton
                label={exporting ? 'Exporting...' : 'Export All Data'}
                icon={<Download size={14} />}
                variant="secondary"
                loading={exporting}
                onClick={handleExportAll}
                className="shrink-0"
              />
            </div>
            {exportMsg && (
              <div className="mt-3">
                <StatusBanner type={exportMsg.type} message={exportMsg.text} />
              </div>
            )}
          </Card>

          {/* Export instances with filter */}
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                    <Download size={15} />
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Export All Instances
                  </p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 ml-10">
                  Filter by status (All / Approved / Pending / Blocked) before exporting.
                </p>
              </div>
              <ActionButton
                label="Choose & Export"
                icon={<Download size={14} />}
                variant="secondary"
                onClick={() => setShowExportModal(true)}
                className="shrink-0"
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Section 4: Danger Zone */}
      <div>
        <SectionTitle>Danger Zone</SectionTitle>
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                These actions are irreversible. Proceed with caution.
              </p>
              <p className="text-xs text-rose-600/80 dark:text-rose-500/70 mt-0.5">
                Make sure you have a recent backup before performing any of these operations.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-white/60 dark:bg-white/[0.03] border border-rose-500/20">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Export Full Backup
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Download a complete JSON backup of all platform data including instances, licenses, notifications, and analytics.
                </p>
              </div>
              <button
                onClick={handleExportAll}
                disabled={exporting}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all shrink-0',
                  'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30',
                  exporting && 'opacity-50 cursor-not-allowed'
                )}
              >
                {exporting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                {exporting ? 'Exporting...' : 'Export Full Backup'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ChangePasswordModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
      <ExportInstancesModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
      <SeedConfirmModal
        open={showSeedModal}
        onClose={() => setShowSeedModal(false)}
        onConfirm={handleSeedConfirm}
        seeding={seeding}
      />
    </div>
  );
}
