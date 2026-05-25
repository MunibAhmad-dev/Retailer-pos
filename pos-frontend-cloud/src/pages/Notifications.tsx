import { useEffect, useState } from 'react';
import {
  Bell, Send, Trash2, Users, User, Loader2,
  CheckCircle2, AlertTriangle, RefreshCw, X, Download,
} from 'lucide-react';
import clsx from 'clsx';
import { notificationsApi, instancesApi, AdminNotification, Instance } from '../api';

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const days = Math.floor(h / 24);
  if (days > 0) return `${days}d ago`;
  if (h > 0)    return `${h}h ago`;
  if (m > 0)    return `${m}m ago`;
  return 'Just now';
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [instances, setInstances]         = useState<Instance[]>([]);
  const [loading, setLoading]             = useState(true);
  const [sending, setSending]             = useState(false);
  const [deletingId, setDeletingId]       = useState<number | null>(null);

  // Form state
  const [title, setTitle]                 = useState('');
  const [body, setBody]                   = useState('');
  const [target, setTarget]               = useState<'all' | 'single'>('all');
  const [instanceSearch, setSearch]       = useState('');
  const [selectedInstance, setSelected]   = useState<Instance | null>(null);

  // UI feedback
  const [successMsg, setSuccessMsg]       = useState('');
  const [errorMsg, setErrorMsg]           = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [notifs, inst] = await Promise.all([
        notificationsApi.list(),
        instancesApi.list({ limit: 200 }),
      ]);
      setNotifications(notifs);
      setInstances(inst.data.filter(i => i.approval_status === 'approved'));
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredInstances = instances.filter(i =>
    !instanceSearch ||
    i.owner_mobile.includes(instanceSearch) ||
    (i.store_name || '').toLowerCase().includes(instanceSearch.toLowerCase())
  );

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setErrorMsg('Title and message are required');
      return;
    }
    if (target === 'single' && !selectedInstance) {
      setErrorMsg('Select a target instance');
      return;
    }
    setSending(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await notificationsApi.create({
        title: title.trim(),
        body: body.trim(),
        instance_id: target === 'single' ? selectedInstance!.instance_id : undefined,
      });
      const targetLabel = target === 'all'
        ? 'all approved users'
        : `${selectedInstance!.store_name || selectedInstance!.instance_id}`;
      setSuccessMsg(`Notification sent to ${targetLabel}`);
      setTitle('');
      setBody('');
      setSelected(null);
      setSearch('');
      await load();
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await notificationsApi.delete(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notifications</h1>
          <p className="text-sm text-slate-500 dark:text-gray-500 mt-0.5">
            Push real-time messages to all POS instances or a specific user
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadJson(notifications, `notifications_${new Date().toISOString().slice(0,10)}.json`)}
            className="btn-ghost"
            title="Export notification history as JSON"
            disabled={notifications.length === 0}
          >
            <Download size={15} />
            Export JSON
          </button>
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* ── Send Form ── */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-5 h-fit">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
              <Send size={15} className="text-blue-500 dark:text-blue-400" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">New Notification</h2>
          </div>

          {/* Target selector */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Send To
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['all', 'single'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTarget(t); setSelected(null); setSearch(''); }}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
                    target === t
                      ? 'bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-300'
                      : 'bg-slate-50 dark:bg-gray-800/60 border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:border-slate-300 dark:hover:border-gray-600'
                  )}
                >
                  {t === 'all'
                    ? <><Users size={14} /> All Users</>
                    : <><User size={14} /> Specific User</>}
                </button>
              ))}
            </div>
          </div>

          {/* Instance search (single mode) */}
          {target === 'single' && (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Search Instance
              </label>
              {selectedInstance ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 truncate">
                      {selectedInstance.store_name || selectedInstance.instance_id}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-gray-500 font-mono">{selectedInstance.owner_mobile}</p>
                  </div>
                  <button
                    onClick={() => { setSelected(null); setSearch(''); }}
                    className="text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300 flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={instanceSearch}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by mobile or store name…"
                    className="input text-sm"
                  />
                  {instanceSearch && (
                    <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-slate-200/60 dark:divide-gray-700/60">
                      {filteredInstances.length === 0 ? (
                        <p className="px-3 py-2.5 text-xs text-slate-500 dark:text-gray-500">No approved instances found</p>
                      ) : (
                        filteredInstances.slice(0, 6).map(i => (
                          <button
                            key={i.instance_id}
                            type="button"
                            onClick={() => { setSelected(i); setSearch(''); }}
                            className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-gray-700/60 transition-colors"
                          >
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{i.store_name || i.instance_id}</p>
                            <p className="text-xs text-slate-500 dark:text-gray-500 font-mono">{i.owner_mobile}</p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. System Update Available"
              maxLength={80}
              className="input text-sm"
            />
          </div>

          {/* Body */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Message
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message here…"
              rows={4}
              maxLength={400}
              className="input text-sm resize-none"
              style={{ height: 'auto', minHeight: 96 }}
            />
            <p className="text-xs text-slate-400 dark:text-gray-600 mt-1 text-right">{body.length}/400</p>
          </div>

          {/* Feedback */}
          {errorMsg && (
            <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <AlertTriangle size={13} className="text-rose-500 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 dark:text-rose-300">{errorMsg}</p>
            </div>
          )}
          {successMsg && (
            <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 size={13} className="text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-700 dark:text-emerald-300">{successMsg}</p>
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !body.trim()}
            className="btn-primary w-full justify-center"
          >
            {sending
              ? <><Loader2 size={14} className="animate-spin" /> Sending…</>
              : <><Send size={14} />
                  {target === 'all' ? 'Broadcast to All Users' : `Send to ${selectedInstance?.store_name || 'Selected User'}`}
                </>}
          </button>

          {target === 'all' && (
            <p className="text-xs text-slate-400 dark:text-gray-600 text-center mt-2">
              {instances.length} approved instance{instances.length !== 1 ? 's' : ''} will receive this
            </p>
          )}
        </div>

        {/* ── Notification history ── */}
        <div className="xl:col-span-3 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Sent Notifications</h2>
              <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">{notifications.filter(n => n.is_active).length} active</p>
            </div>
            <Bell size={16} className="text-slate-400 dark:text-gray-600" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                <Bell size={22} className="text-slate-400 dark:text-gray-600" />
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-gray-400">No notifications sent yet</p>
              <p className="text-xs text-slate-400 dark:text-gray-600 mt-1">Use the form to send your first notification</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-gray-800/60 max-h-[600px] overflow-y-auto">
              {notifications.map(n => (
                <div
                  key={n.id}
                  className={clsx(
                    'px-5 py-4 transition-colors',
                    !n.is_active && 'opacity-40'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={clsx(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                      n.target_instance_id
                        ? 'bg-violet-500/15 border border-violet-500/25'
                        : 'bg-blue-500/15 border border-blue-500/25'
                    )}>
                      {n.target_instance_id
                        ? <User size={14} className="text-violet-500 dark:text-violet-400" />
                        : <Users size={14} className="text-blue-500 dark:text-blue-400" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">{n.title}</p>
                          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 leading-relaxed">{n.body}</p>
                        </div>
                        <button
                          onClick={() => handleDelete(n.id)}
                          disabled={deletingId === n.id}
                          className="text-slate-400 dark:text-gray-600 hover:text-rose-500 dark:hover:text-rose-400 transition-colors flex-shrink-0 mt-0.5"
                        >
                          {deletingId === n.id
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Trash2 size={13} />}
                        </button>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-xs text-slate-400 dark:text-gray-600">{timeAgo(n.sent_at)}</span>
                        <span className={clsx(
                          'text-xs px-2 py-0.5 rounded-full border',
                          n.target_instance_id
                            ? 'bg-violet-500/10 border-violet-500/25 text-violet-600 dark:text-violet-400'
                            : 'bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400'
                        )}>
                          {n.target_instance_id
                            ? `→ ${n.target_store_name || n.target_instance_id}`
                            : 'Broadcast'}
                        </span>
                        {n.is_active ? (
                          <span className="text-xs text-emerald-600 dark:text-emerald-500">
                            {n.read_count}/{n.target_count} read
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-gray-600">Deleted</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
