import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Monitor, Clock, ShieldX, ShieldCheck,
  Activity, TrendingUp, Key, Loader2,
  ArrowRight, Wifi,
} from 'lucide-react';
import { statsApi, instancesApi, DashboardStats, Instance } from '../api';
import clsx from 'clsx';

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtRs(n: number) {
  return 'Rs ' + fmt(n);
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

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}

function StatCard({ label, value, icon: Icon, color, sub }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mb-3', color)}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: Instance['approval_status'] }) {
  return (
    <span className={clsx(
      status === 'approved' ? 'badge-approved' :
      status === 'pending'  ? 'badge-pending'  : 'badge-blocked'
    )}>
      {status}
    </span>
  );
}

export default function Dashboard() {
  const [stats, setStats]         = useState<DashboardStats | null>(null);
  const [recent, setRecent]       = useState<Instance[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      statsApi.get(),
      instancesApi.list({ limit: 8 }),
    ]).then(([s, inst]) => {
      setStats(s);
      setRecent(inst.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">OsaTech POS Cloud — live overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Instances"
          value={stats?.totalInstances ?? 0}
          icon={Monitor}
          color="bg-blue-500/15 text-blue-400"
        />
        <StatCard
          label="Active Today"
          value={stats?.activeToday ?? 0}
          icon={Wifi}
          color="bg-emerald-500/15 text-emerald-400"
          sub={`${stats?.activeWeek ?? 0} this week`}
        />
        <StatCard
          label="Pending Approval"
          value={stats?.pending ?? 0}
          icon={Clock}
          color="bg-amber-500/15 text-amber-400"
        />
        <StatCard
          label="Blocked"
          value={stats?.blocked ?? 0}
          icon={ShieldX}
          color="bg-rose-500/15 text-rose-400"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Approved"
          value={stats?.approved ?? 0}
          icon={ShieldCheck}
          color="bg-emerald-500/15 text-emerald-400"
        />
        <StatCard
          label="Total Revenue"
          value={fmtRs(stats?.totalRevenue ?? 0)}
          icon={TrendingUp}
          color="bg-violet-500/15 text-violet-400"
          sub={`${fmt(stats?.totalSales ?? 0)} sales synced`}
        />
        <StatCard
          label="Licenses Issued"
          value={stats?.licensesIssued ?? 0}
          icon={Key}
          color="bg-sky-500/15 text-sky-400"
          sub={`${stats?.licensesAssigned ?? 0} assigned`}
        />
        <StatCard
          label="Online Rate"
          value={stats && stats.totalInstances > 0
            ? Math.round((stats.activeWeek / stats.totalInstances) * 100) + '%'
            : '0%'}
          icon={Activity}
          color="bg-teal-500/15 text-teal-400"
          sub="weekly active"
        />
      </div>

      {/* Recent instances table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-white">Recent POS Instances</h2>
            <p className="text-xs text-gray-500 mt-0.5">Sorted by last seen</p>
          </div>
          <Link to="/instances" className="btn-ghost text-xs py-1.5 px-3">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="py-16 text-center">
            <Monitor className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No instances registered yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Store</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {recent.map((inst) => (
                  <tr key={inst.instance_id} className="table-row-hover">
                    <td className="px-5 py-3.5">
                      <Link to={`/instances/${inst.instance_id}`} className="hover:text-blue-400 transition-colors">
                        <p className="font-medium text-gray-100">{inst.store_name || '—'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{inst.owner_name || inst.instance_id}</p>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">{inst.owner_mobile}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={inst.approval_status} /></td>
                    <td className="px-5 py-3.5 text-gray-300">
                      {fmtRs(inst.total_revenue ?? 0)}
                      <span className="text-xs text-gray-600 ml-1">({fmt(inst.total_sales ?? 0)} sales)</span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{timeAgo(inst.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
