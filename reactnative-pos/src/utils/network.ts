import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// ── Online ref ────────────────────────────────────────────────────────────────

/**
 * Module-level flag that stays in sync with the device's actual connectivity.
 * It is updated via a NetInfo event listener that is registered once when this
 * module is first imported.
 */
let _isOnline = true;

/**
 * Current connectivity state. Updated automatically by a background listener.
 * Read this for a synchronous (best-effort) connectivity check.
 */
export let isOnline: boolean = _isOnline;

// Register a persistent NetInfo listener so `isOnline` stays current.
NetInfo.addEventListener((state: NetInfoState) => {
  _isOnline = !!(state.isConnected && state.isInternetReachable !== false);
  isOnline = _isOnline;
});

// ── Async check ───────────────────────────────────────────────────────────────

/**
 * Performs a fresh connectivity fetch via NetInfo.
 * Returns `true` if the device has an active internet connection.
 */
export async function checkConnection(): Promise<boolean> {
  const state = await NetInfo.fetch();
  const online = !!(state.isConnected && state.isInternetReachable !== false);
  isOnline = online;
  return online;
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────

/**
 * Calls `fn` up to `retries` times, waiting `delay` ms between attempts.
 * Throws the last error if all attempts fail.
 *
 * @param fn      Async function to retry.
 * @param retries Maximum number of attempts (default: 3).
 * @param delay   Milliseconds to wait between retries (default: 1000).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
