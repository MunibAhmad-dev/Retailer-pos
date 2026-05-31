import React, { useState, useEffect, useRef } from 'react';
import { Search, Copy, Check, X, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../lib/utils';

// ============================================================================
// Spinner
// ============================================================================
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin text-blue-500', className ?? 'h-5 w-5')}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ============================================================================
// Badge
// ============================================================================
type BadgeStatus = 'pending' | 'approved' | 'blocked' | 'expired' | 'active' | 'inactive';
type BadgeVariant = 'status' | 'outline' | 'solid';

const STATUS_CLASSES: Record<BadgeStatus, string> = {
  pending:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  active:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  blocked:  'bg-rose-500/15 text-rose-400 border-rose-500/30',
  expired:  'bg-slate-500/15 text-slate-400 border-slate-500/30',
  inactive: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

export function Badge({
  status,
  children,
  variant = 'status',
}: {
  status?: BadgeStatus;
  children: React.ReactNode;
  variant?: BadgeVariant;
}) {
  const statusClass =
    status && variant === 'status'
      ? STATUS_CLASSES[status] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/30'
      : variant === 'solid'
      ? 'bg-blue-600 text-white border-transparent'
      : 'bg-transparent text-slate-400 border-slate-500/40';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-none',
        statusClass
      )}
    >
      {children}
    </span>
  );
}

// ============================================================================
// StatCard
// ============================================================================
type StatColor = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate';

const STAT_ACCENT: Record<StatColor, string> = {
  blue:    'from-blue-500/20 to-blue-600/5 border-blue-500/20',
  emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20',
  amber:   'from-amber-500/20 to-amber-600/5 border-amber-500/20',
  rose:    'from-rose-500/20 to-rose-600/5 border-rose-500/20',
  violet:  'from-violet-500/20 to-violet-600/5 border-violet-500/20',
  slate:   'from-slate-500/20 to-slate-600/5 border-slate-500/20',
};

const STAT_ICON_BG: Record<StatColor, string> = {
  blue:    'bg-blue-500/15 text-blue-400',
  emerald: 'bg-emerald-500/15 text-emerald-400',
  amber:   'bg-amber-500/15 text-amber-400',
  rose:    'bg-rose-500/15 text-rose-400',
  violet:  'bg-violet-500/15 text-violet-400',
  slate:   'bg-slate-500/15 text-slate-400',
};

export function StatCard({
  title,
  value,
  sub,
  icon,
  trend,
  color = 'blue',
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label?: string };
  color?: StatColor;
}) {
  const accent = STAT_ACCENT[color] ?? STAT_ACCENT.blue;
  const iconBg  = STAT_ICON_BG[color] ?? STAT_ICON_BG.blue;
  const trendUp = trend && trend.value >= 0;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5',
        'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/10',
        accent
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white leading-none">
            {value}
          </p>
          {sub && (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">{sub}</p>
          )}
          {trend && (
            <div
              className={cn(
                'mt-2 inline-flex items-center gap-1 text-xs font-medium',
                trendUp ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {trendUp ? (
                <TrendingUp size={12} />
              ) : (
                <TrendingDown size={12} />
              )}
              <span>
                {trendUp ? '+' : ''}
                {trend.value}%{trend.label ? ` ${trend.label}` : ''}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              iconBg
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// DataTable
// ============================================================================
export interface TableColumn<T = Record<string, unknown>> {
  key: string;
  header: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  loading = false,
  emptyText = 'No data found.',
}: {
  columns: TableColumn<T>[];
  rows: T[];
  loading?: boolean;
  emptyText?: string;
}) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap',
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left'
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                <div className="flex justify-center">
                  <Spinner />
                </div>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-sm text-slate-400 dark:text-slate-600"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-slate-700 dark:text-slate-300',
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    )}
                  >
                    {col.render
                      ? col.render(row[col.key], row)
                      : (row[col.key] as React.ReactNode) ?? <span className="text-slate-400">—</span>}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Modal
// ============================================================================
type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const MODAL_WIDTH: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: ModalSize;
}) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'relative z-10 w-full rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 shadow-xl',
          MODAL_WIDTH[size]
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ============================================================================
// SearchInput
// ============================================================================
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
      />
    </div>
  );
}

// ============================================================================
// DateRangePicker
// ============================================================================
type DatePreset = { label: string; from: string; to: string };

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  presets,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  presets?: DatePreset[];
}) {
  const inputClass =
    'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                onFromChange(p.from);
                onToChange(p.to);
              }}
              className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-all"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <input
        type="date"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
        className={inputClass}
        aria-label="From date"
      />
      <span className="text-xs text-slate-400">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onToChange(e.target.value)}
        className={inputClass}
        aria-label="To date"
      />
    </div>
  );
}

// ============================================================================
// ActionButton
// ============================================================================
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-sm shadow-blue-500/20',
  secondary:
    'bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10',
  danger:
    'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 border-rose-500/30',
  ghost:
    'bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 border-transparent',
};

export function ActionButton({
  label,
  icon,
  onClick,
  variant = 'primary',
  loading = false,
  disabled = false,
  type = 'button',
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        className
      )}
    >
      {loading ? (
        <Spinner className="h-3.5 w-3.5" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {label}
    </button>
  );
}

// ============================================================================
// EmptyState
// ============================================================================
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-600">
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-500 max-w-xs">{description}</p>
      </div>
      {action && (
        <ActionButton label={action.label} onClick={action.onClick} variant="primary" />
      )}
    </div>
  );
}

// ============================================================================
// Tabs
// ============================================================================
export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-white/5 p-1',
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150',
            active === tab.key
              ? 'bg-white dark:bg-blue-600/20 text-slate-900 dark:text-blue-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                active === tab.key
                  ? 'bg-blue-500/15 text-blue-500 dark:text-blue-400'
                  : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400'
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// CopyButton
// ============================================================================
export function CopyButton({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      className={cn(
        'inline-flex items-center justify-center h-7 w-7 rounded-lg transition-all',
        copied
          ? 'text-emerald-500 bg-emerald-500/10'
          : 'text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5',
        className
      )}
      aria-label={copied ? 'Copied' : 'Copy'}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

// ============================================================================
// PlanBadge
// ============================================================================
type PlanType = 'starter' | 'basic' | 'pro' | 'enterprise' | 'trial' | string;

const PLAN_COLORS: Record<string, string> = {
  starter:    'bg-slate-500/15 text-slate-400 border-slate-500/30',
  basic:      'bg-sky-500/15 text-sky-400 border-sky-500/30',
  pro:        'bg-blue-500/15 text-blue-400 border-blue-500/30',
  enterprise: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  trial:      'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

export function PlanBadge({ plan }: { plan: PlanType }) {
  const lower = plan?.toLowerCase() ?? '';
  const colorClass =
    PLAN_COLORS[lower] ?? 'bg-blue-500/15 text-blue-400 border-blue-500/30';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-none capitalize',
        colorClass
      )}
    >
      {plan}
    </span>
  );
}
