import { useEffect, useState } from 'react';
import {
  Key, Plus, Trash2, Link2, Loader2,
  Copy, Check, RefreshCw, ShieldCheck, Download,
} from 'lucide-react';
import { licensesApi, instancesApi, LicenseKey, Instance } from '../api';
import clsx from 'clsx';

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const PLANS = ['monthly', 'quarterly', 'yearly', 'lifetime'];

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isExpired(d?: string | null) {
  if (!d) return false;
  return new Date(d) < new Date();
}

export default function Licenses() {
  const [keys, setKeys]               = useState<LicenseKey[]>([]);
  const [instances, setInstances]     = useState<Instance[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [showAssign, setShowAssign]   = useState<LicenseKey | null>(null);
  const [copiedKey, setCopied]        = useState('');

  // Create form
  const [plan, setPlan]               = useState('monthly');
  const [days, setDays]               = useState('30');
  const [notes, setNotes]             = useState('');
  const [assignToId, setAssignToId]   = useState('');
  const [creating, setCreating]       = useState(false);
  const [createErr, setCreateErr]     = useState('');

  // Assign form
  const [assignId, setAssignId]       = useState('');
  const [assigning, setAssigning]     = useState(false);
  const [assignErr, setAssignErr]     = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [ks, inst] = await Promise.all([
        licensesApi.list(),
        instancesApi.list({ limit: 200 }),
      ]);
      setKeys(ks);
      setInstances(inst.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCopy = (k: string) => {
    navigator.clipboard.writeText(k).then(() => {
      setCopied(k);
      setTimeout(() => setCopied(''), 1800);
    });
  };

  const handleCreate = async () => {
    setCreateErr('');
    setCreating(true);
    try {
      await licensesApi.create({
        plan,
        duration_days: Number(days),
        notes: notes || undefined,
        instance_id: assignToId || undefined,
      });
      setShowCreate(false);
      setPlan('monthly'); setDays('30'); setNotes(''); setAssignToId('');
      await load();
    } catch (e: any) {
      setCreateErr(e.response?.data?.error || 'Create failed');
    } finally { setCreating(false); }
  };

  const handleAssign = async () => {
    if (!showAssign || !assignId) return;
    setAssignErr('');
    setAssigning(true);
    try {
      await licensesApi.assign(showAssign.license_key, assignId);
      setShowAssign(null); setAssignId('');
      await load();
    } catch (e: any) {
      setAssignErr(e.response?.data?.error || 'Assign failed');
    } finally { setAssigning(false); }
  };

  const handleDeactivate = async (key: string) => {
    if (!confirm(`Deactivate license?`)) return;
    try {
      await licensesApi.deactivate(key);
      await load();
    } catch { /* ignore */ }
  };

  const active   = keys.filter((k) => k.is_active);
  const inactive = keys.filter((k) => !k.is_active);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">License Keys</h1>
          <p className="text-sm text-slate-500 dark:text-gray-500 mt-0.5">
            {active.length} active · {inactive.length} inactive
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost">
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => downloadJson(keys, `licenses_${new Date().toISOString().slice(0,10)}.json`)}
            className="btn-ghost"
            title="Export all licenses as JSON"
            disabled={keys.length === 0}
          >
            <Download size={15} />
            Export JSON
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={15} />
            Generate Key
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* Active keys */}
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden mb-5">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Active Keys ({active.length})</h2>
            </div>

            {active.length === 0 ? (
              <div className="py-14 text-center">
                <Key className="w-9 h-9 text-slate-300 dark:text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500 dark:text-gray-500">No active licenses yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-gray-800">
                      {['License Key', 'Plan', 'Assigned To', 'Expires', 'Notes', ''].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-medium text-slate-500 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-gray-800/60">
                    {active.map((k) => {
                      const expired = isExpired(k.expires_at) && k.plan !== 'lifetime';
                      return (
                        <tr key={k.license_key} className="hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <code
                                className="font-mono text-xs text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 px-2 py-1 rounded truncate max-w-[140px]"
                                title={k.license_key}
                              >
                                {k.license_key.length > 18 ? k.license_key.slice(0, 14) + '…' : k.license_key}
                              </code>
                              <button
                                onClick={() => handleCopy(k.license_key)}
                                className="text-slate-400 dark:text-gray-600 hover:text-blue-500 transition-colors flex-shrink-0"
                              >
                                {copiedKey === k.license_key
                                  ? <Check size={13} className="text-emerald-500" />
                                  : <Copy size={13} />}
                              </button>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 capitalize">
                              {k.plan}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {k.instance_id ? (
                              <div>
                                <p className="text-xs text-slate-700 dark:text-gray-300">{k.store_name || k.instance_id}</p>
                                <p className="text-xs text-slate-400 dark:text-gray-600 font-mono">{k.owner_mobile}</p>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setShowAssign(k); setAssignId(''); }}
                                className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
                              >
                                <Link2 size={12} /> Assign
                              </button>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={clsx('text-xs', expired ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-gray-400')}>
                              {k.plan === 'lifetime' ? '∞ Lifetime' : fmtDate(k.expires_at)}
                              {expired && <span className="ml-1 text-rose-500">(expired)</span>}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-gray-500 max-w-[180px] truncate">
                            {k.notes || '—'}
                          </td>
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => handleDeactivate(k.license_key)}
                              className="text-slate-400 dark:text-gray-600 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                              title="Deactivate"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Inactive keys */}
          {inactive.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-slate-500 dark:text-gray-500">Inactive Keys ({inactive.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-gray-800">
                      {['License Key', 'Plan', 'Assigned To', 'Deactivated'].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-medium text-slate-400 dark:text-gray-600 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-gray-800/60">
                    {inactive.map((k) => (
                      <tr key={k.license_key} className="opacity-50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <code
                              className="font-mono text-xs text-slate-500 dark:text-gray-400 line-through truncate max-w-[140px]"
                              title={k.license_key}
                            >
                              {k.license_key.length > 18 ? k.license_key.slice(0, 14) + '…' : k.license_key}
                            </code>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500 dark:text-gray-500 capitalize">{k.plan}</td>
                        <td className="px-5 py-3 text-xs text-slate-500 dark:text-gray-500">{k.store_name || k.instance_id || '—'}</td>
                        <td className="px-5 py-3 text-xs text-slate-400 dark:text-gray-600">{fmtDate(k.issued_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Generate License Key</h3>
            <p className="text-sm text-slate-500 dark:text-gray-500 mb-5">Create a new license key for a POS instance.</p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-slate-500 dark:text-gray-400 mb-1.5">Plan</label>
                <select
                  value={plan}
                  onChange={(e) => {
                    const p = e.target.value;
                    setPlan(p);
                    if (p === 'lifetime') setDays('36500');
                    else if (p === 'yearly')   setDays('365');
                    else if (p === 'quarterly') setDays('90');
                    else setDays('30');
                  }}
                  className="select w-full capitalize"
                >
                  {PLANS.map((p) => (
                    <option key={p} value={p} className="capitalize">{p}</option>
                  ))}
                </select>
              </div>

              {plan !== 'lifetime' && (
                <div>
                  <label className="block text-xs text-slate-500 dark:text-gray-400 mb-1.5">Duration (days)</label>
                  <input
                    type="number"
                    min="1"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className="input"
                    placeholder="30"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-500 dark:text-gray-400 mb-1.5">Assign to Instance (optional)</label>
                <select
                  value={assignToId}
                  onChange={(e) => setAssignToId(e.target.value)}
                  className="select w-full"
                >
                  <option value="">— Unassigned —</option>
                  {instances.map((inst) => (
                    <option key={inst.instance_id} value={inst.instance_id}>
                      {inst.store_name || inst.instance_id} ({inst.owner_mobile})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-500 dark:text-gray-400 mb-1.5">Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input"
                  placeholder="e.g. Ahmed Electronics, Lahore"
                />
              </div>

              {createErr && (
                <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {createErr}
                </p>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleCreate} disabled={creating} className="btn-primary">
                {creating ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Assign License</h3>
            <p className="text-sm text-slate-500 dark:text-gray-500 mb-1">Key:</p>
            <div className="flex items-center gap-2 mb-4">
              <code
                className="font-mono text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded truncate max-w-[280px]"
                title={showAssign.license_key}
              >
                {showAssign.license_key.length > 20 ? showAssign.license_key.slice(0, 16) + '…' : showAssign.license_key}
              </code>
              <button
                onClick={() => handleCopy(showAssign.license_key)}
                className="text-slate-400 dark:text-gray-600 hover:text-blue-500 transition-colors flex-shrink-0"
              >
                {copiedKey === showAssign.license_key ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              </button>
            </div>

            <label className="block text-xs text-slate-500 dark:text-gray-400 mb-1.5">Select POS Instance</label>
            <select
              value={assignId}
              onChange={(e) => setAssignId(e.target.value)}
              className="select w-full mb-4"
            >
              <option value="">— Select instance —</option>
              {instances.filter((i) => !i.license_key).map((inst) => (
                <option key={inst.instance_id} value={inst.instance_id}>
                  {inst.store_name || inst.instance_id} ({inst.owner_mobile})
                </option>
              ))}
            </select>

            {assignErr && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-4">
                {assignErr}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAssign(null)} className="btn-ghost">Cancel</button>
              <button onClick={handleAssign} disabled={assigning || !assignId} className="btn-primary">
                {assigning ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
