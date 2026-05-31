import {
  format,
  formatDistance,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from 'date-fns';

/**
 * Format a date as '14 Jun 2025'
 */
export function formatDate(d: Date | string | number): string {
  return format(new Date(d), 'd MMM yyyy');
}

/**
 * Format a date as '14 Jun 2025 2:30 PM'
 */
export function formatDateTime(d: Date | string | number): string {
  return format(new Date(d), 'd MMM yyyy h:mm a');
}

/**
 * Returns a human-readable relative time string.
 * Examples: 'Just now', '2h ago', '3d ago'
 */
export function timeAgo(d: Date | string | number): string {
  const date = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
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

  const diffYr = Math.floor(diffMo / 12);
  return `${diffYr}y ago`;
}

export type DatePreset = 'today' | 'week' | 'month' | 'year';

/**
 * Returns ISO date strings { from, to } for common presets.
 */
export function getDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  let from: Date;
  let to: Date;

  switch (preset) {
    case 'today':
      from = startOfDay(now);
      to = endOfDay(now);
      break;
    case 'week':
      from = startOfWeek(now, { weekStartsOn: 1 });
      to = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case 'month':
      from = startOfMonth(now);
      to = endOfMonth(now);
      break;
    case 'year':
      from = startOfYear(now);
      to = endOfYear(now);
      break;
  }

  return {
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
  };
}
