import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Store, Phone, Mail, MapPin, Key,
  ShieldCheck, ShieldX, Download, Loader2,
  Activity, TrendingUp, Users, Package,
  AlertTriangle, Clock,
} from 'lucide-react';
import { instancesApi, InstanceDetail as IDetail } from '../api';
import clsx from 'clsx';

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n ?? 0);
}
function fmtRs(n: number) { return 'Rs ' + fmt(n); }

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

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-800 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={15} className="text-gray-400" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-200 font-medium mt-0.5 break-words">{value || '—'}</p>
      </div>
    </div>
  );
}

export default function InstanceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail]         = useState<IDetail | null>(null);
  const [sales, setSales]           = useState<any[]>([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setAction]  = useState<'approve' | 'block' | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [showBlockModal, setBlockModal] = useState(false);
  const [error, setError]           = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [det, sal] = await Promise.all([
        instancesApi.get(id),
        instancesApi.sales(id, { limit: 50 }),
      ]);
      setDetail(det);
      setSales(sal.data);
      setSalesTotal(sal.total);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load instance');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleApprove = async () => {
    if (!id) return;
    setAction('approve');
    try {
      await instancesApi.approve(id);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Approve failed');
    } finally { setAction(null); }
  };

  const handleBlock = async () => {
    if (!id) return;
    setAction('block');
    try {
      await instancesApi.block(id, blockReason || undefined);
      setBlockModal(false);
      setBlockReason('');
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Block failed');
    } finally { setAction(null); }
  };

  const handleExport = async () => {
    if (!id) return;
    try {
      const data = await instancesApi.export(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `${id}_export.json`; a.click();
      URL.revokeObjectURL(url);
    } catch { setError('Export failed'); }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="p-6">
        <Link to="/instances" className="btn-ghost mb-6 inline-flex">
          <ArrowLeft size={16} /> Back
        </Link>
        <p className="text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">{error}</p>
      </div>
    );
  }

  const inst = detail!.instance;
  const ss   = detail!.salesStats;
  const isBlocked  = inst.approval_status === 'blocked';
  const isApproved = inst.approval_status === 'approved';
  const isPending  = inst.approval_status === 'pending';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Back + header */}
      <div className="flex items-start gap-4 mb-6">
        <button onClick={() => navigate('/instances')} className="btn-ghost mt-0.5">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white truncate">{inst.store_name || inst.instance_id}</h1>
            <span className={clsx(
              isApproved ? 'badge-approved' :
              isPending  ? 'badge-pending'  : 'badge-blocked'
            )}>
              {inst.approval_status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Instance ID: {inst.instance_id}</p>
        </div>
        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          {!isApproved && (
            <button
              onClick={handleApprove}
              disabled={!!actionLoading}
              className="btn-success"
            >
              {actionLoading === 'approve' ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
              Approve
            </button>
          )}
          {!isBlocked && (
            <button
              onClick={() => setBlockModal(true)}
              disabled={!!actionLoading}
              className="btn-danger"
            >
              <ShieldX size={15} />
              Block
            </button>
          )}
          {isBlocked && (
            <button
              onClick={handleApprove}
              disabled={!!actionLoading}
              className="btn-success"
            >
              {actionLoading === 'approve' ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
              Unblock
            </button>
          )}
          <button onClick={handleExport} className="btn-ghost">
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {isBlocked && inst.block_reason && (
        <div className="mb-5 flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
          <AlertTriangle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-rose-300">Blocked: {inst.block_reason}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left col */}
        <div className="xl:col-span-1 flex flex-col gap-5">
          {/* Store info */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Store Information</h3>
            <InfoRow icon={Store}  label="Store Name"   value={inst.store_name} />
            <InfoRow icon={Users}  label="Owner Name"   value={inst.owner_name} />
            <InfoRow icon={Phone}  label="Mobile"       value={inst.owner_mobile} />
            <InfoRow icon={Mail}   label="Email"        value={inst.owner_email} />
            <InfoRow icon={MapPin} label="Address"      value={inst.store_address} />
          </div>

          {/* License info */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">License</h3>
            <InfoRow icon={Key}      label="Plan"         value={inst.license_plan} />
            <InfoRow icon={Key}      label="Key"          value={inst.license_key} />
            <InfoRow icon={Clock}    label="Expires"      value={fmtDate(inst.license_expiry)} />
            <InfoRow icon={Activity} label="App Version"  value={inst.app_version} />
            <InfoRow icon={Clock}    label="Registered"   value={fmtDate(inst.created_at)} />
            <InfoRow icon={Clock}    label="Last Seen"    value={timeAgo(inst.last_seen) + (inst.last_seen ? ' (' + fmtDateTime(inst.last_seen) + ')' : '')} />
          </div>
        </div>

        {/* Right col */}
        <div className="xl:col-span-2 flex flex-col gap-5">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: TrendingUp, label: 'Revenue',  value: fmtRs(inst.total_revenue ?? 0), color: 'bg-violet-500/15 text-violet-400' },
              { icon: Activity,   label: 'Sales',    value: fmt(inst.total_sales ?? 0),      color: 'bg-blue-500/15 text-blue-400' },
              { icon: Users,      label: 'Customers',value: fmt(inst.total_customers ?? 0),  color: 'bg-emerald-500/15 text-emerald-400' },
              { icon: Package,    label: 'Products', value: fmt(inst.total_products ?? 0),   color: 'bg-amber-500/15 text-amber-400' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="stat-card">
                <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center mb-2', color)}>
                  <Icon size={17} />
                </div>
                <p className="text-xl font-bold text-white tabular-nums">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>

          {/* Synced sales table */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex-1">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Synced Sales</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {salesTotal} total · showing {sales.length} most recent
                </p>
              </div>
              {ss && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Synced revenue</p>
                  <p className="text-sm font-semibold text-white">{fmtRs(ss.synced_revenue ?? 0)}</p>
                </div>
              )}
            </div>

            {sales.length === 0 ? (
              <div className="py-14 text-center">
                <TrendingUp className="w-9 h-9 text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No sales synced yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {['Sale ID', 'Date', 'Total', 'Payment', 'Items', 'Status'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {sales.map((s: any) => (
                      <tr key={s.id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{s.local_id ?? s.id}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDate(s.date_created)}</td>
                        <td className="px-4 py-3 text-gray-200 font-medium tabular-nums">{fmtRs(s.total ?? 0)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-800 border border-gray-700 text-gray-400 capitalize">
                            {s.payment_method || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{s.items_count ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            'text-xs px-2 py-0.5 rounded-full',
                            s.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' :
                            s.status === 'Returned'  ? 'bg-amber-500/10 text-amber-400' :
                            'bg-gray-700 text-gray-400'
                          )}>
                            {s.status || 'Completed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent sync events */}
          {detail!.recentEvents.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <h3 className="text-sm font-semibold text-white">Recent Sync Events</h3>
                <p className="text-xs text-gray-500 mt-0.5">Last {detail!.recentEvents.length} events</p>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-800/60">
                {detail!.recentEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-400 capitalize font-mono">
                      {ev.entity_type}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">{ev.operation}</span>
                    <span className="text-xs text-gray-600 ml-auto">{fmtDateTime(ev.received_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Block Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-1">Block Instance</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will block <strong className="text-gray-200">{inst.store_name || inst.instance_id}</strong>. The POS will detect this within 5 minutes.
            </p>
            <label className="block text-xs text-gray-400 mb-1.5">Reason (optional)</label>
            <input
              type="text"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="e.g. License expired, Non-payment…"
              className="input mb-5"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setBlockModal(false); setBlockReason(''); }}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={handleBlock}
                disabled={actionLoading === 'block'}
                className="btn-danger"
              >
                {actionLoading === 'block' ? <Loader2 size={15} className="animate-spin" /> : <ShieldX size={15} />}
                Block Instance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
