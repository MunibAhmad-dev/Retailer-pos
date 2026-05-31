import { useEffect, useState, useCallback } from 'react';
import {
  Bell, Send, Trash2, Users, User, RefreshCw,
  CheckCircle2, AlertTriangle, Radio, BarChart3,
} from 'lucide-react';
import { cn, timeAgo, fmt } from '../lib/utils';
import {
  Spinner, StatCard, Modal, SearchInput, ActionButton, EmptyState,
} from '../components/ui';
import * as api from '../api';
import type { AdminNotification, Instance } from '../api';

// ─── helpers ─────────────────────────────────────────────────────────────────

function Toast({
  type,
  message,
  onDismiss,
}: {
  type: 'success' | 'error';
  message: string;
  onDismiss: () => void;
}) {
  const isSuccess = type === 'success';
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm',
        isSuccess
          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
          : 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300'
      )}
    >
      {isSuccess ? (
        <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle size={15} className="text-rose-500 shrink-0 mt-0.5" />
      )}
      <p className="flex-1">{message}</p>
      <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity text-xs font-medium">
        Dismiss
      </button>
    </div>
  );
}

// ─── Send notification modal ──────────────────────────────────────────────────

function SendModal({
  open,
  onClose,
  instances,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  instances: Instance[];
  onSent: () => void;
}) {
  const [target, setTarget] = useState<'all' | 'single'>('all');
  const [instanceSearch, setSearch] = useState('');
  const [selectedInstance, setSelected] = useState<Instance | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const BODY_MAX = 500;

  const resetForm = () => {
    setTarget('all');
    setSearch('');
    setSelected(null);
    setTitle('');
    setBody('');
    setError('');
    setSuccess('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const filteredInstances = instances.filter(
    (i) =>
      !instanceSearch ||
      i.owner_mobile.includes(instanceSearch) ||
      (i.store_name || '').toLowerCase().includes(instanceSearch.toLowerCase())
  );

  const handleSend = async () => {
    setError('');
    setSuccess('');
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!body.trim())  { setError('Message is required.'); return; }
    if (target === 'single' && !selectedInstance) { setError('Select a target instance.'); return; }

    setSending(true);
    try {
      await api.createNotification({
        title: title.trim(),
        body: body.trim(),
        instance_id: target === 'single' ? selectedInstance!.instance_id : null,
      });
      const label =
        target === 'all'
          ? 'all approved users'
          : selectedInstance!.store_name || selectedInstance!.instance_id;
      setSuccess(`Notification sent to ${label}.`);
      onSent();
      // auto-close after a beat
      setTimeout(handleClose, 1800);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to send.';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const inputClass =
    'w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40';

  return (
    <Modal open={open} onClose={handleClose} title="Send Notification" size="md">
      <div className="space-y-4">

        {/* Target radio */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Target
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(['all', 'single'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTarget(t); setSelected(null); setSearch(''); }}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
                  target === t
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-300'
                    : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20'
                )}
              >
                {t === 'all' ? <Users size={14} /> : <User size={14} />}
                {t === 'all' ? 'All Instances' : 'Specific Instance'}
              </button>
            ))}
          </div>
        </div>

        {/* Instance search (single mode) */}
        {target === 'single' && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Select Instance
            </p>
            {selectedInstance ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 truncate">
                    {selectedInstance.store_name || selectedInstance.instance_id}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {selectedInstance.owner_mobile}
                  </p>
                </div>
                <button
                  onClick={() => { setSelected(null); setSearch(''); }}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors shrink-0"
                  aria-label="Clear selection"
                >
                  &times;
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <SearchInput
                  value={instanceSearch}
                  onChange={setSearch}
                  placeholder="Search by store name or mobile..."
                />
                {instanceSearch && (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f172a] divide-y divide-slate-100 dark:divide-white/5">
                    {filteredInstances.length === 0 ? (
                      <p className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                        No instances found
                      </p>
                    ) : (
                      filteredInstances.slice(0, 8).map((i) => (
                        <button
                          key={i.instance_id}
                          type="button"
                          onClick={() => { setSelected(i); setSearch(''); }}
                          className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {i.store_name || i.instance_id}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {i.owner_mobile}
                          </p>
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
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Title <span className="text-rose-400">*</span>
          </p>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. System Update Available"
            maxLength={80}
            className={inputClass}
          />
        </div>

        {/* Message */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Message <span className="text-rose-400">*</span>
            </p>
            <span className={cn('text-xs', body.length >= BODY_MAX ? 'text-rose-400' : 'text-slate-400 dark:text-slate-600')}>
              {body.length}/{BODY_MAX}
            </span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
            placeholder="Write your notification message here..."
            rows={4}
            className={cn(inputClass, 'resize-none')}
          />
        </div>

        {/* Feedback */}
        {error && <Toast type="error" message={error} onDismiss={() => setError('')} />}
        {success && <Toast type="success" message={success} onDismiss={() => setSuccess('')} />}

        {/* Send button */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {target === 'all' && (
            <p className="text-xs text-slate-400 dark:text-slate-600">
              {instances.length} approved instance{instances.length !== 1 ? 's' : ''} will receive this
            </p>
          )}
          <div className="flex gap-2 ml-auto">
            <ActionButton label="Cancel" variant="secondary" onClick={handleClose} disabled={sending} />
            <ActionButton
              label={sending ? 'Sending...' : 'Send'}
              icon={<Send size={14} />}
              loading={sending}
              onClick={handleSend}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Notification row ─────────────────────────────────────────────────────────

function NotifRow({
  n,
  onDelete,
  deleting,
}: {
  n: AdminNotification;
  onDelete: (id: number) => void;
  deleting: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isBroadcast = n.target_instance_id === null;

  return (
    <tr className="border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
      {/* Title */}
      <td className="px-4 py-3 text-slate-900 dark:text-white text-sm font-medium max-w-[160px]">
        <span className="truncate block">{n.title}</span>
      </td>
      {/* Message */}
      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-sm max-w-[220px]">
        <span className="truncate block">
          {n.body.length > 60 ? n.body.slice(0, 60) + '…' : n.body}
        </span>
      </td>
      {/* Target */}
      <td className="px-4 py-3">
        {isBroadcast ? (
          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400">
            <Users size={10} /> All
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border bg-violet-500/10 border-violet-500/25 text-violet-600 dark:text-violet-400 max-w-[120px] truncate"
            title={n.target_store_name || n.target_instance_id || ''}
          >
            <User size={10} />
            {n.target_store_name || n.target_instance_id}
          </span>
        )}
      </td>
      {/* Sent */}
      <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs whitespace-nowrap">
        {timeAgo(n.sent_at)}
      </td>
      {/* Read/Total */}
      <td className="px-4 py-3 text-sm tabular-nums text-slate-600 dark:text-slate-300">
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{fmt(n.read_count)}</span>
        <span className="text-slate-400 dark:text-slate-600"> / {fmt(n.target_count)}</span>
      </td>
      {/* Actions */}
      <td className="px-4 py-3">
        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { onDelete(n.id); setConfirmDelete(false); }}
              disabled={deleting}
              className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 transition-colors"
            >
              {deleting ? 'Deleting...' : 'Confirm'}
            </button>
            <span className="text-slate-400">·</span>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            title="Delete notification"
            className="text-slate-400 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 transition-colors p-1 rounded-lg hover:bg-rose-500/10"
          >
            {deleting ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 size={14} />}
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Notifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [instances, setInstances]         = useState<Instance[]>([]);
  const [loading, setLoading]             = useState(true);
  const [deletingId, setDeletingId]       = useState<number | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [notifs, inst] = await Promise.all([
        api.getNotifications(),
        api.getInstances({ limit: 300 }),
      ]);
      setNotifications(notifs);
      setInstances(inst.data.filter((i) => i.approval_status === 'approved'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await api.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  // Stats
  const total      = notifications.length;
  const broadcasts = notifications.filter((n) => n.target_instance_id === null).length;
  const targeted   = notifications.filter((n) => n.target_instance_id !== null).length;

  // Table columns header labels
  const headers = ['Title', 'Message', 'Target', 'Sent', 'Read / Total', 'Actions'];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Notifications &amp; Broadcasts
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Send real-time messages to all POS instances or a specific store
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ActionButton
            label="Refresh"
            icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
            variant="secondary"
            onClick={load}
            loading={loading}
          />
          <ActionButton
            label="Send Notification"
            icon={<Send size={14} />}
            onClick={() => setShowSendModal(true)}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Sent"
          value={fmt(total)}
          icon={<Bell size={18} />}
          color="blue"
        />
        <StatCard
          title="Broadcasts"
          value={fmt(broadcasts)}
          sub="Sent to all instances"
          icon={<Radio size={18} />}
          color="violet"
        />
        <StatCard
          title="Targeted"
          value={fmt(targeted)}
          sub="Sent to specific stores"
          icon={<User size={18} />}
          color="emerald"
        />
      </div>

      {/* Notifications table */}
      <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Sent Notifications</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sorted by most recent first
            </p>
          </div>
          <BarChart3 size={16} className="text-slate-400 dark:text-slate-600" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="h-7 w-7" />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell size={24} />}
            title="No notifications sent yet"
            description="Use the Send Notification button to push a message to your POS instances."
            action={{ label: 'Send First Notification', onClick: () => setShowSendModal(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...notifications]
                  .sort(
                    (a, b) =>
                      new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
                  )
                  .map((n) => (
                    <NotifRow
                      key={n.id}
                      n={n}
                      onDelete={handleDelete}
                      deleting={deletingId === n.id}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Send modal */}
      <SendModal
        open={showSendModal}
        onClose={() => setShowSendModal(false)}
        instances={instances}
        onSent={load}
      />
    </div>
  );
}
