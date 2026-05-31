/**
 * Inserts commas into a number string following Pakistani number grouping:
 * last 3 digits, then groups of 2 (e.g. 1,23,456).
 */
function insertPakistaniCommas(intStr: string): string {
  if (intStr.length <= 3) return intStr;

  // Last 3 digits
  const last3 = intStr.slice(-3);
  const rest = intStr.slice(0, -3);

  // Remaining digits grouped in 2s from right
  const parts: string[] = [];
  let i = rest.length;
  while (i > 0) {
    parts.unshift(rest.slice(Math.max(0, i - 2), i));
    i -= 2;
  }

  return [...parts, last3].join(',');
}

/**
 * Returns currency formatting functions for PKR.
 *
 * @example
 * const { formatPKR, fmtShort } = useFormatCurrency();
 * formatPKR(123456)  // → 'PKR 1,23,456'
 * fmtShort(1500000) // → 'PKR 1.5M'
 */
export function useFormatCurrency() {
  /**
   * Full format: 'PKR X,XX,XXX'
   */
  const formatPKR = (n: number): string => {
    if (!isFinite(n)) return 'PKR --';
    const isNegative = n < 0;
    const abs = Math.abs(Math.round(n));
    const intStr = abs.toString();
    const formatted = insertPakistaniCommas(intStr);
    return `${isNegative ? '-' : ''}PKR ${formatted}`;
  };

  /**
   * Compact format for large numbers: 'PKR 1.2M', 'PKR 45K'
   */
  const fmtShort = (n: number): string => {
    if (!isFinite(n)) return 'PKR --';
    const isNegative = n < 0;
    const abs = Math.abs(n);
    const prefix = isNegative ? '-PKR ' : 'PKR ';

    if (abs >= 1_000_000_000) {
      return `${prefix}${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
    }
    if (abs >= 1_000_000) {
      return `${prefix}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    }
    if (abs >= 1_000) {
      return `${prefix}${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    }
    return `${prefix}${abs}`;
  };

  return { formatPKR, fmtShort };
}
