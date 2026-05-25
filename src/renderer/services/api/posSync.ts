/**
 * posSync.ts — OsaTech POS Cloud Sync Worker
 *
 * Responsibilities:
 *  1. Register this POS instance with the cloud backend (once, on first run)
 *  2. Process the local SQLite sync queue — send batches to the backend
 *  3. Send a heartbeat every 5 minutes with store stats
 *  4. Poll the instance status every 5 minutes and update local settings
 *     if approval_status changes (e.g. blocked by admin)
 *
 * The worker runs entirely in the renderer process using setInterval.
 * All DB access goes through the existing window.api IPC bridge.
 * HTTP calls use the existing axios-based apiClient.
 */

import axios from 'axios';

// ─── Config ──────────────────────────────────────────────────────────────────

const SYNC_INTERVAL_MS      = 30_000;   // Process queue every 30 seconds
const HEARTBEAT_INTERVAL_MS = 300_000;  // Heartbeat every 5 minutes
const STATUS_POLL_MS        = 300_000;  // Status check every 5 minutes
const BATCH_SIZE            = 20;       // Items per sync batch

// ─── State ───────────────────────────────────────────────────────────────────

let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
let statusIntervalId: ReturnType<typeof setInterval> | null = null;
let isRegistered = false;
let lastBackoffUntil = 0;   // Timestamp — skip syncs until this time after errors

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/** Build axios instance configured from POS settings */
function buildClient(backendUrl: string, apiKey: string) {
  return axios.create({
    baseURL: backendUrl.replace(/\/$/, ''),
    timeout: 12_000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Registers this POS instance with the cloud backend.
 * Uses owner_mobile as the unique instance_id.
 * Stores the returned api_key in local settings.
 *
 * Safe to call multiple times — the backend is idempotent.
 */
export async function registerInstance(): Promise<boolean> {
  try {
    const settingsRes = await window.api.getSettings();
    if (!settingsRes?.success || !settingsRes.data) return false;

    const s = settingsRes.data;
    const backendUrl: string = s.cloud_backend_url || '';
    if (!backendUrl) return false;

    // Use owner_mobile as the unique ID; fall back to generated ID stored in settings
    const mobile: string = (s.owner_mobile || '').trim();
    const instanceId = mobile || `instance_${Date.now()}`;

    const payload = {
      instance_id:   instanceId,
      store_name:    s.store_name    || '',
      owner_name:    s.owner_full_name || '',
      owner_mobile:  mobile,
      owner_email:   s.owner_email   || '',
      store_address: s.store_address || '',
      business_name: s.business_name || '',
      license_key:   s.activation_key || '',
      app_version:   '1.0',
    };

    const res = await axios.post(`${backendUrl.replace(/\/$/, '')}/api/instances/register`, payload, {
      timeout: 15_000,
    });

    if (res.data?.success && res.data?.api_key) {
      // Persist the api_key and cloud status to local settings
      await window.api.updateSettings({
        cloud_backend_token: res.data.api_key,
        cloud_connected:     1,
        approval_status:     res.data.approval_status || 'pending',
      });
      isRegistered = true;
      console.log('[PosSync] Instance registered. Status:', res.data.approval_status);
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn('[PosSync] Registration failed:', err.message);
    return false;
  }
}

// ─── Queue processing ─────────────────────────────────────────────────────────

/**
 * Reads pending items from cloud_sync_queue, sends them in a batch,
 * then marks each as done or failed.
 */
export async function processSyncQueue(): Promise<{ synced: number; failed: number }> {
  if (!isOnline()) return { synced: 0, failed: 0 };
  if (Date.now() < lastBackoffUntil) return { synced: 0, failed: 0 };

  const settingsRes = await window.api.getSettings();
  if (!settingsRes?.success || !settingsRes.data) return { synced: 0, failed: 0 };

  const s = settingsRes.data;
  const backendUrl: string  = s.cloud_backend_url   || '';
  const apiKey: string      = s.cloud_backend_token || '';

  if (!backendUrl || !apiKey) return { synced: 0, failed: 0 };

  // Auto-register if not yet done
  if (!isRegistered && !(s.cloud_backend_token)) {
    await registerInstance();
    return { synced: 0, failed: 0 };
  }

  // Load pending items
  const queueRes = await window.api.getPendingSyncItems(BATCH_SIZE);
  if (!queueRes?.success || !queueRes.data?.length) return { synced: 0, failed: 0 };

  const items = queueRes.data as Array<{
    id: number;
    entity_type: string;
    operation: string;
    payload: string;
    attempts: number;
  }>;

  const client = buildClient(backendUrl, apiKey);

  // Build batch payload
  const batchItems = items.map(item => ({
    entity_type: item.entity_type,
    operation:   item.operation,
    payload:     (() => { try { return JSON.parse(item.payload); } catch { return {}; } })(),
    local_id:    item.id,
  }));

  let synced = 0;
  let failed = 0;

  try {
    const res = await client.post('/api/sync', { items: batchItems });
    const results: Array<{ local_id?: number; success: boolean; error?: string }> =
      res.data?.results || [];

    const doneIds: number[] = [];
    const failIds: Array<{ id: number; error: string }> = [];

    for (const r of results) {
      if (r.local_id === undefined) continue;
      if (r.success) {
        doneIds.push(r.local_id);
        synced++;
      } else {
        failIds.push({ id: r.local_id, error: r.error || 'unknown error' });
        failed++;
      }
    }

    if (doneIds.length > 0) await window.api.markSyncItemsDone(doneIds);
    for (const f of failIds) await window.api.markSyncItemFailed(f.id, f.error);

  } catch (err: any) {
    // Network error — mark all as failed and back off for 2 minutes
    for (const item of items) {
      await window.api.markSyncItemFailed(item.id, err.message || 'network error');
    }
    failed = items.length;
    lastBackoffUntil = Date.now() + 120_000;
    console.warn('[PosSync] Sync failed, backing off 2 min:', err.message);
  }

  return { synced, failed };
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

/**
 * Sends a heartbeat to the backend with current store stats.
 * This keeps last_seen fresh so the admin dashboard shows the shop as active.
 */
export async function sendHeartbeat(): Promise<void> {
  if (!isOnline()) return;

  const settingsRes = await window.api.getSettings();
  if (!settingsRes?.success || !settingsRes.data) return;

  const s = settingsRes.data;
  const backendUrl: string = s.cloud_backend_url   || '';
  const apiKey: string     = s.cloud_backend_token || '';
  if (!backendUrl || !apiKey) return;

  try {
    // Get fresh stats from the dashboard API (reuse existing IPC)
    const statsRes = await window.api.getDashboardStats?.();
    const stats = statsRes?.success ? statsRes.data : null;

    const client = buildClient(backendUrl, apiKey);
    await client.post('/api/instances/heartbeat', {
      store_name:      s.store_name    || '',
      total_sales:     stats?.total_sales_today ?? null,
      total_revenue:   stats?.revenue_today     ?? null,
      total_customers: stats?.total_customers   ?? null,
      total_products:  stats?.total_products    ?? null,
      app_version:     '1.0',
    });
  } catch (err: any) {
    console.warn('[PosSync] Heartbeat failed:', err.message);
  }
}

// ─── Status poll ──────────────────────────────────────────────────────────────

/**
 * Polls /api/instances/status and updates local settings when the cloud status changes.
 * If the admin has blocked this instance, the local approval_status is updated
 * so SubscriptionService picks it up on next check.
 */
export async function checkInstanceStatus(): Promise<void> {
  if (!isOnline()) return;

  const settingsRes = await window.api.getSettings();
  if (!settingsRes?.success || !settingsRes.data) return;

  const s = settingsRes.data;
  const backendUrl: string = s.cloud_backend_url   || '';
  const apiKey: string     = s.cloud_backend_token || '';
  if (!backendUrl || !apiKey) return;

  try {
    const client = buildClient(backendUrl, apiKey);
    const res = await client.get('/api/instances/status');

    if (res.data?.success) {
      const { approval_status, license_plan, license_expiry } = res.data;

      // Only update if something changed (avoid unnecessary DB writes)
      if (
        approval_status !== s.approval_status ||
        license_plan    !== s.license_plan    ||
        license_expiry  !== s.license_expiry
      ) {
        await window.api.updateSettings({
          approval_status,
          cloud_connected: 1,
          cloud_last_sync: new Date().toISOString(),
        });
        console.log('[PosSync] Status updated from cloud:', approval_status);
      }
    }
  } catch (err: any) {
    // 403 = blocked
    if (axios.isAxiosError(err) && err.response?.status === 403) {
      await window.api.updateSettings({ approval_status: 'blocked' });
      console.warn('[PosSync] Instance blocked by admin');
    } else {
      console.warn('[PosSync] Status poll failed:', err.message);
    }
  }
}

// ─── Init / Teardown ─────────────────────────────────────────────────────────

/**
 * Call once from App.tsx (or root component) to start the sync worker.
 * Safe to call multiple times — will skip if already running.
 */
export async function initPosSync(): Promise<void> {
  if (syncIntervalId) return;   // Already running

  console.log('[PosSync] Starting sync worker...');

  // Try to register / verify registration immediately
  const settingsRes = await window.api.getSettings().catch(() => null);
  const s = settingsRes?.data;

  if (s?.cloud_backend_url) {
    if (!s.cloud_backend_token) {
      // No API key stored → register now
      await registerInstance();
    } else {
      isRegistered = true;
    }

    // Run an immediate sync + status check
    processSyncQueue().catch(() => {});
    checkInstanceStatus().catch(() => {});
  }

  // Set up recurring intervals
  syncIntervalId = setInterval(async () => {
    if (!isOnline()) return;
    processSyncQueue().catch(e => console.warn('[PosSync] Queue error:', e.message));
  }, SYNC_INTERVAL_MS);

  heartbeatIntervalId = setInterval(async () => {
    if (!isOnline()) return;
    sendHeartbeat().catch(e => console.warn('[PosSync] Heartbeat error:', e.message));
  }, HEARTBEAT_INTERVAL_MS);

  statusIntervalId = setInterval(async () => {
    if (!isOnline()) return;
    checkInstanceStatus().catch(e => console.warn('[PosSync] Status error:', e.message));
  }, STATUS_POLL_MS);

  console.log('[PosSync] Sync worker running. Queue interval: 30s | Heartbeat: 5m | Status poll: 5m');
}

/**
 * Stop all sync intervals (call on app unmount / logout).
 */
export function stopPosSync(): void {
  if (syncIntervalId)      { clearInterval(syncIntervalId);      syncIntervalId      = null; }
  if (heartbeatIntervalId) { clearInterval(heartbeatIntervalId); heartbeatIntervalId = null; }
  if (statusIntervalId)    { clearInterval(statusIntervalId);    statusIntervalId    = null; }
  isRegistered = false;
  console.log('[PosSync] Sync worker stopped.');
}
