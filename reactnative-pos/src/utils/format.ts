// ── Currency ──────────────────────────────────────────────────────────────────

/**
 * Formats a number as Pakistani Rupees with standard Western comma grouping.
 * Example: 1234 → 'PKR 1,234'
 */
export function formatPKR(n: number): string {
  if (!isFinite(n)) return 'PKR --';
  const rounded = Math.round(n);
  return `PKR ${rounded.toLocaleString('en-US')}`;
}

/**
 * Compact currency format.
 * Examples: 1200 → '1.2k'  |  1500000 → '1.5M'
 */
export function formatShort(n: number): string {
  if (!isFinite(n)) return '--';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${sign}${abs}`;
}

// ── Percentage ────────────────────────────────────────────────────────────────

/**
 * Formats a number as a percentage string.
 * Example: formatPercent(15.3) → '15.3%'
 */
export function formatPercent(n: number, decimals = 1): string {
  if (!isFinite(n)) return '--%';
  return `${n.toFixed(decimals)}%`;
}

// ── Date / Time ───────────────────────────────────────────────────────────────

/**
 * Formats a date as a human-readable string: '14 Jun 2025'.
 */
export function formatDate(d: string | Date): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Returns a relative time string such as 'Just now', '2h ago', '3d ago'.
 */
export function formatTimeAgo(d: string | Date): string {
  const date = d instanceof Date ? d : new Date(d);
  const diffMs = Date.now() - date.getTime();
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

// ── Stock status ──────────────────────────────────────────────────────────────

const LOW_STOCK_THRESHOLD = 10;

export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

/**
 * Returns a stock status label based on quantity.
 *   0          → 'out-of-stock'
 *   1 – 10     → 'low-stock'
 *   > 10       → 'in-stock'
 */
export function formatStockStatus(stock: number): StockStatus {
  if (stock <= 0) return 'out-of-stock';
  if (stock <= LOW_STOCK_THRESHOLD) return 'low-stock';
  return 'in-stock';
}

/**
 * Returns the theme color appropriate for the given stock level.
 * Expects a theme object with a `colors` map that has `success`, `warning`, and `danger` keys.
 */
export function getStockColor(
  stock: number,
  theme: { colors: { success: string; warning: string; danger: string } },
): string {
  const status = formatStockStatus(stock);
  switch (status) {
    case 'out-of-stock':
      return theme.colors.danger;
    case 'low-stock':
      return theme.colors.warning;
    case 'in-stock':
    default:
      return theme.colors.success;
  }
}
