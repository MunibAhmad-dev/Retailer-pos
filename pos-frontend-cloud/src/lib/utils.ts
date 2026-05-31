import { clsx, type ClassValue } from 'clsx';

// ─── Tailwind class merger ─────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

// ─── Number formatting ─────────────────────────────────────────────────────────

/** Locale-formatted number: 1234567 → "1,234,567" */
export function fmt(n: number): string {
  if (n == null || isNaN(n)) return '0';
  return n.toLocaleString('en-PK');
}

/** Rupee-prefixed: 1500 → "Rs. 1,500" */
export function fmtRs(n: number): string {
  return 'Rs. ' + fmt(n);
}

/** Compact notation: 1200 → "1.2k", 3400000 → "3.4M" */
export function fmtShort(n: number): string {
  if (n == null || isNaN(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (abs >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

// ─── Date formatting ───────────────────────────────────────────────────────────

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "14 Jun 2025" */
export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

/** "14 Jun 2025 09:45" */
export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()} ${hh}:${mm}`;
}

/** "2h ago" | "3d ago" | "Just now" | "Never" */
export function timeAgo(d: string | Date | null | undefined): string {
  if (!d) return 'Never';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return 'Never';
  const diffMs = Date.now() - dt.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMo = Math.floor(diffDay / 30);
  if (diffMo < 12) return `${diffMo}mo ago`;
  return `${Math.floor(diffMo / 12)}y ago`;
}

/**
 * Number of whole days until a future date.
 * Returns a negative number if the date is in the past.
 * Returns Number.NEGATIVE_INFINITY when the input is null/invalid.
 */
export function daysUntil(dateStr: string | null | undefined): number {
  if (!dateStr) return Number.NEGATIVE_INFINITY;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return Number.NEGATIVE_INFINITY;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

// ─── Color helpers ─────────────────────────────────────────────────────────────

/** Tailwind badge classes for license plan */
export function planColor(plan: string): string {
  switch ((plan ?? '').toLowerCase()) {
    case 'trial':
      return 'bg-sky-500/15 text-sky-400 border border-sky-500/30';
    case 'basic':
      return 'bg-violet-500/15 text-violet-400 border border-violet-500/30';
    case 'pro':
      return 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
    case 'enterprise':
      return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    default:
      return 'bg-slate-500/15 text-slate-400 border border-slate-500/30';
  }
}

/** Tailwind badge classes for approval / license status */
export function statusColor(status: string): string {
  switch ((status ?? '').toLowerCase()) {
    case 'pending':
      return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    case 'approved':
    case 'active':
      return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    case 'blocked':
    case 'revoked':
      return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
    case 'expired':
    default:
      return 'bg-slate-500/15 text-slate-400 border border-slate-500/30';
  }
}

// ─── File downloads ────────────────────────────────────────────────────────────

/** Triggers a browser JSON file download */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  _triggerDownload(blob, filename.endsWith('.json') ? filename : filename + '.json');
}

/**
 * Converts an array of flat objects to CSV and triggers a browser download.
 * Values containing commas, quotes, or newlines are properly quoted.
 */
export function downloadCsv(rows: Record<string, unknown>[], filename: string): void {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = keys.map(escape).join(',');
  const body = rows.map((r) => keys.map((k) => escape(r[k])).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  _triggerDownload(blob, filename.endsWith('.csv') ? filename : filename + '.csv');
}

function _triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
