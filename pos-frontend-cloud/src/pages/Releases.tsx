import { useState, useEffect } from 'react';
import {
  getReleases, createRelease, updateRelease, deleteRelease,
  type AppRelease,
} from '../api';

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtSize = (bytes: number) =>
  bytes === 0 ? '—' : bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const EMPTY: Partial<AppRelease> = {
  version: '', channel: 'stable', changelog: '', download_url: '',
  file_size: 0, is_mandatory: false, published: true,
};

export default function Releases() {
  const [releases,  setReleases]  = useState<AppRelease[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState<Partial<AppRelease>>(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try { setReleases(await getReleases()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.version?.trim())      { setError('Version is required (e.g. 2.1.0)'); return; }
    if (!form.download_url?.trim()) { setError('Download URL is required'); return; }
    setSaving(true); setError('');
    try {
      await createRelease(form);
      setShowForm(false);
      setForm(EMPTY);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to create release');
    } finally { setSaving(false); }
  };

  const togglePublish = async (r: AppRelease) => {
    await updateRelease(r.id, { published: !r.published });
    setReleases(prev => prev.map(x => x.id === r.id ? { ...x, published: !r.published } : x));
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this release? This cannot be undone.')) return;
    setDeletingId(id);
    try { await deleteRelease(id); setReleases(prev => prev.filter(r => r.id !== id)); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Software Releases</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage POS app update versions. The POS app polls
            <code className="mx-1 px-1.5 py-0.5 bg-slate-100 dark:bg-white/10 rounded text-xs font-mono">
              /api/updates/latest
            </code>
            on every "Check for Updates" click.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setForm(EMPTY); setError(''); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
        >
          <span className="text-lg leading-none">+</span> New Release
        </button>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/15 px-4 py-3 text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed space-y-1">
        <p className="font-bold text-sm">How to publish an update:</p>
        <p>1. Build the new <code>.exe</code> installer on your machine.</p>
        <p>2. Host it anywhere (GitHub Releases, Google Drive direct link, your VPS <code>/uploads/</code> folder, etc.).</p>
        <p>3. Paste the direct download URL below. The POS app will download and run it automatically.</p>
        <p>4. Toggle <strong>Published</strong> when ready — unpublished releases are invisible to the POS app.</p>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">New Release</h2>
          </div>
          <form onSubmit={handleSave} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  Version <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.version || ''}
                  onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                  placeholder="e.g. 2.1.0"
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Channel</label>
                <select
                  value={form.channel || 'stable'}
                  onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  <option value="stable">Stable</option>
                  <option value="beta">Beta</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                Download URL <span className="text-red-500">*</span>
              </label>
              <input
                value={form.download_url || ''}
                onChange={e => setForm(f => ({ ...f, download_url: e.target.value }))}
                placeholder="https://example.com/OsaTechPOS-2.1.0-Setup.exe"
                className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                required
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">
                Must be a direct download link to the .exe installer (no login required to download).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  File Size (bytes) <span className="text-slate-400 font-normal">— optional</span>
                </label>
                <input
                  type="number"
                  value={form.file_size || ''}
                  onChange={e => setForm(f => ({ ...f, file_size: parseInt(e.target.value) || 0 }))}
                  placeholder="e.g. 52428800 (= 50 MB)"
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
              <div className="flex items-end gap-4 pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form.is_mandatory}
                    onChange={e => setForm(f => ({ ...f, is_mandatory: e.target.checked }))}
                    className="w-4 h-4 accent-red-500 rounded" />
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    Mandatory update
                    <span className="block text-[10px] text-slate-400 font-normal">User cannot skip</span>
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.published !== false}
                    onChange={e => setForm(f => ({ ...f, published: e.target.checked }))}
                    className="w-4 h-4 accent-emerald-500 rounded" />
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    Published
                    <span className="block text-[10px] text-slate-400 font-normal">Visible to POS</span>
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Changelog</label>
              <textarea
                value={form.changelog || ''}
                onChange={e => setForm(f => ({ ...f, changelog: e.target.value }))}
                rows={4}
                placeholder={"• Fixed printing issue\n• Improved sync speed\n• Added barcode generator"}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                {saving ? 'Creating…' : 'Create Release'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-semibold transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Releases table */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">Loading…</div>
        ) : releases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-sm font-medium">No releases yet</p>
            <p className="text-xs mt-1">Create your first release to enable app updates.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
                {['Version', 'Channel', 'Size', 'Published', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {releases.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-black text-slate-900 dark:text-white font-mono">
                      v{r.version}
                    </div>
                    {r.is_mandatory && (
                      <span className="inline-block mt-0.5 text-[9px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                        REQUIRED
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      r.channel === 'beta'
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    }`}>
                      {r.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs font-mono">
                    {fmtSize(r.file_size)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[160px]" title={r.download_url}>
                      <a href={r.download_url} target="_blank" rel="noreferrer"
                        className="text-indigo-500 hover:underline truncate block">
                        {r.download_url.split('/').pop() || r.download_url}
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => togglePublish(r)}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                        r.published
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${r.published ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {r.published ? 'Live' : 'Draft'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {fmtDate(r.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      className="text-xs px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                    >
                      {deletingId === r.id ? '…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
