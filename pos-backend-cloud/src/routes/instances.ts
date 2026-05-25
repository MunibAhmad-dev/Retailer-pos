import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { requireInstance } from '../middleware/instanceAuth';
import { Instance } from '../types';

const router = Router();

/**
 * POST /api/instances/register
 *
 * Called by the POS app on first launch (or any time it doesn't have a stored api_key).
 * Uses `owner_mobile` as the global unique identifier for the instance.
 *
 * If the instance already exists → returns the existing api_key (idempotent).
 * If new → creates with status 'pending' and returns a fresh api_key.
 *
 * Body:
 *   instance_id   - mobile number (required, used as unique key)
 *   store_name    - shop name
 *   owner_name    - owner's full name
 *   owner_mobile  - mobile number (same as instance_id)
 *   owner_email?  - optional email
 *   store_address?
 *   business_name?
 *   license_key?  - if the user already has a license key, validate it here
 *   app_version?
 */
router.post('/register', (req: Request, res: Response) => {
  const {
    instance_id,
    store_name,
    owner_name,
    owner_mobile,
    owner_email,
    store_address,
    business_name,
    license_key,
    fingerprint,
    app_version,
    branch_name,
  } = req.body as Record<string, string>;

  if (!instance_id || !owner_mobile) {
    res.status(400).json({ success: false, error: 'instance_id and owner_mobile are required' });
    return;
  }

  // Check if already registered
  const existing = db
    .prepare('SELECT * FROM instances WHERE instance_id = ?')
    .get(instance_id) as Instance | undefined;

  if (existing) {
    // Update store metadata on re-registration (shop may have renamed, etc.)
    db.prepare(`
      UPDATE instances SET
        store_name         = COALESCE(NULLIF(?, ''), store_name),
        owner_name         = COALESCE(NULLIF(?, ''), owner_name),
        owner_email        = COALESCE(NULLIF(?, ''), owner_email),
        store_address      = COALESCE(NULLIF(?, ''), store_address),
        business_name      = COALESCE(NULLIF(?, ''), business_name),
        device_fingerprint = COALESCE(NULLIF(?, ''), device_fingerprint),
        app_version        = COALESCE(NULLIF(?, ''), app_version),
        branch_name        = COALESCE(NULLIF(?, ''), branch_name),
        last_seen          = datetime('now'),
        updated_at         = datetime('now')
      WHERE instance_id = ?
    `).run(
      store_name    || '',
      owner_name    || '',
      owner_email   || '',
      store_address || '',
      business_name || '',
      fingerprint   || '',
      app_version   || '',
      branch_name   || '',
      instance_id,
    );

    return res.json({
      success: true,
      api_key: existing.api_key,
      approval_status: existing.approval_status,
      license_plan: existing.license_plan,
      license_expiry: existing.license_expiry,
      message: 'Instance already registered. api_key returned.',
    });
  }

  // New instance
  const api_key = uuidv4();

  // Resolve license info if a key was provided
  let license_plan = 'none';
  let license_expiry: string | null = null;
  if (license_key) {
    const lic = db
      .prepare('SELECT * FROM license_keys WHERE license_key = ? AND is_active = 1')
      .get(license_key) as any;
    if (lic) {
      license_plan = lic.plan;
      license_expiry = lic.expires_at;
      // Assign license to this instance
      db.prepare('UPDATE license_keys SET instance_id = ? WHERE license_key = ?')
        .run(instance_id, license_key);
    }
  }

  db.prepare(`
    INSERT INTO instances (
      instance_id, store_name, owner_name, owner_mobile, owner_email,
      store_address, business_name, api_key, license_key,
      license_plan, license_expiry, device_fingerprint, app_version, branch_name, approval_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    instance_id,
    store_name    || '',
    owner_name    || '',
    owner_mobile,
    owner_email   || '',
    store_address || '',
    business_name || '',
    api_key,
    license_key   || '',
    license_plan,
    license_expiry,
    fingerprint   || '',
    app_version   || '',
    branch_name   || 'Main Branch',
  );

  res.status(201).json({
    success: true,
    api_key,
    approval_status: 'pending',
    license_plan,
    license_expiry,
    message: 'Instance registered. Awaiting admin approval.',
  });
});

/**
 * GET /api/instances/status   [instanceAuth]
 *
 * Polled by the POS every few minutes to get the latest cloud status.
 * Returns approval_status, license info, and any block reason.
 */
router.get('/status', requireInstance, (req: Request, res: Response) => {
  const inst = req.instance!;
  res.json({
    success: true,
    instance_id:     inst.instance_id,
    approval_status: inst.approval_status,
    license_key:     inst.license_key || null,
    license_plan:    inst.license_plan,
    license_expiry:  inst.license_expiry,
    license_revoked: inst.license_revoked || 0,
    block_reason:    inst.block_reason || null,
    store_name:      inst.store_name,
  });
});

/**
 * POST /api/instances/heartbeat   [instanceAuth]
 *
 * Sent by POS periodically (every 5 min) to update last_seen and aggregate stats.
 * Also returns the latest approval/license status so the POS can react.
 *
 * Body: { store_name?, total_sales?, total_revenue?, total_customers?, total_products?, app_version? }
 */
router.post('/heartbeat', requireInstance, (req: Request, res: Response) => {
  const inst = req.instance!;
  const {
    store_name,
    total_sales,
    total_revenue,
    total_customers,
    total_products,
    app_version,
  } = req.body as Record<string, any>;

  db.prepare(`
    UPDATE instances SET
      last_seen       = datetime('now'),
      store_name      = COALESCE(NULLIF(?, ''), store_name),
      total_sales     = COALESCE(?, total_sales),
      total_revenue   = COALESCE(?, total_revenue),
      total_customers = COALESCE(?, total_customers),
      total_products  = COALESCE(?, total_products),
      app_version     = COALESCE(NULLIF(?, ''), app_version),
      updated_at      = datetime('now')
    WHERE instance_id = ?
  `).run(
    store_name || '',
    total_sales ?? null,
    total_revenue ?? null,
    total_customers ?? null,
    total_products ?? null,
    app_version || '',
    inst.instance_id,
  );

  // Return latest status so POS can update itself
  const updated = db
    .prepare('SELECT approval_status, license_plan, license_expiry, block_reason FROM instances WHERE instance_id = ?')
    .get(inst.instance_id) as any;

  res.json({
    success: true,
    approval_status: updated.approval_status,
    license_plan: updated.license_plan,
    license_expiry: updated.license_expiry,
    message: updated.approval_status === 'blocked'
      ? (updated.block_reason || 'Account blocked')
      : null,
  });
});

/**
 * GET /api/instances/notifications   [instanceAuth]
 *
 * Returns unread notifications for this instance (broadcast or targeted).
 * Automatically marks returned notifications as read so they are delivered once only.
 */
router.get('/notifications', requireInstance, (req: Request, res: Response) => {
  const instanceId = req.instance!.instance_id;

  const notifications = db.prepare(`
    SELECT n.id, n.title, n.body, n.sent_at
    FROM notifications n
    WHERE n.is_active = 1
      AND (n.target_instance_id IS NULL OR n.target_instance_id = ?)
      AND NOT EXISTS (
        SELECT 1 FROM notification_reads r
        WHERE r.notification_id = n.id AND r.instance_id = ?
      )
    ORDER BY n.sent_at DESC
    LIMIT 20
  `).all(instanceId, instanceId) as any[];

  // Mark all returned notifications as read for this instance
  if (notifications.length > 0) {
    const insertRead = db.prepare(
      'INSERT OR IGNORE INTO notification_reads (notification_id, instance_id) VALUES (?, ?)'
    );
    const markAll = db.transaction((notifs: any[]) => {
      for (const n of notifs) insertRead.run(n.id, instanceId);
    });
    markAll(notifications);
  }

  res.json({ success: true, data: notifications });
});

/**
 * GET /api/instances/export
 * Self-export — returns ALL synced data for THIS instance.
 * Authenticated with the instance's own Bearer api_key.
 * The response is POS-compatible and can be fed to window.api.importData().
 */
router.get('/export', requireInstance, (req: Request, res: Response) => {
  const instanceId = req.instance!.instance_id;

  const rawEvents = db
    .prepare('SELECT * FROM sync_events WHERE instance_id = ? ORDER BY id ASC')
    .all(instanceId) as any[];

  // Build a deduplicated entity map (latest state wins, deletes remove the entry)
  const entityMap: Record<string, Map<string, any>> = {};
  for (const event of rawEvents) {
    const type = event.entity_type as string;
    if (!entityMap[type]) entityMap[type] = new Map();
    let payload: any = null;
    try { payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload; }
    catch { continue; }
    if (!payload) continue;
    const key = String(payload?.id ?? payload?.barcode ?? event.id);
    if (event.operation === 'delete') entityMap[type].delete(key);
    else entityMap[type].set(key, payload);
  }

  const structured: Record<string, any[]> = {};
  for (const [type, items] of Object.entries(entityMap)) {
    structured[type] = Array.from(items.values());
  }

  // Fallback: if no sale events were synced, pull from instance_sales flat table
  const fallbackSales = structured.sales?.length
    ? []
    : db.prepare('SELECT * FROM instance_sales WHERE instance_id = ? ORDER BY date_created ASC').all(instanceId);

  res.json({
    exported_at:       new Date().toISOString(),
    instance: {
      store_name:      req.instance!.store_name,
      owner_name:      req.instance!.owner_name,
      owner_mobile:    req.instance!.owner_mobile,
      license_plan:    req.instance!.license_plan,
      approval_status: req.instance!.approval_status,
    },
    products:          structured.products          || [],
    customers:         structured.customers         || [],
    vendors:           structured.vendors           || [],
    purchases:         structured.purchases         || [],
    expenses:          structured.expenses          || [],
    sales:             structured.sales?.length ? structured.sales : fallbackSales,
    sale_items:        structured.sale_items        || [],
    inventory_batches: structured.inventory_batches || [],
    customer_payments: structured.customer_payments || [],
    raw_events_count:  rawEvents.length,
  });
});

export default router;
