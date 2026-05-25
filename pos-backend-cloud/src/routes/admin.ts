import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import db from '../db';
import { requireAdmin } from '../middleware/auth';
import { Instance, LicenseKey } from '../types';

// ─── Keygen — same algorithm as keygen.js / license_manager.ts ───────────────
// MUST stay in sync with src/main/license_manager.ts → SECRET_KEY + IV_LENGTH
const LICENSE_SECRET = Buffer.from(
  '4a616e75617279203173742c2032303236204c6963656e736520536563726574',
  'hex',
); // 32 bytes
const IV_LENGTH = 12;

interface LicensePayload {
  id: string;
  issuedTo: string;
  issuedForFingerprint: string; // '' = any device (cloud-approved online licenses)
  durationDays: number;
  maxDevices: number;
  issuedAt: string;
  expiresAt: string;
}

/**
 * Build + encrypt a POS license key — identical output to keygen.js.
 * fingerprint = '' means the license works on any device (server is the gate).
 */
function generateLicenseKey(params: {
  issuedTo: string;
  fingerprint: string;  // pass '' for online cloud-approved licenses
  plan: string;         // 'monthly' | 'quarterly' | 'yearly' | 'lifetime'
  durationDays?: number;
}): { licenseKey: string; expiresAt: string | null } {
  const planDays: Record<string, number> = {
    monthly: 30, quarterly: 90, yearly: 365, lifetime: 36500,
  };
  const days = params.durationDays || planDays[params.plan] || 30;

  const now = new Date();
  const expires = new Date(now.getTime() + days * 86_400_000);
  const expiresAt = params.plan === 'lifetime' ? null : expires.toISOString();
  const actualExpires = params.plan === 'lifetime' ? expires : expires; // always set

  const payload: LicensePayload = {
    id:                   uuidv4(),
    issuedTo:             params.issuedTo?.trim() || 'Unknown Business',
    issuedForFingerprint: params.fingerprint ?? '',
    durationDays:         days,
    maxDevices:           1,
    issuedAt:             now.toISOString(),
    expiresAt:            actualExpires.toISOString(),
  };

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', LICENSE_SECRET, iv);
  const json = JSON.stringify(payload);
  let encrypted = cipher.update(json, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  const licenseKey = `${iv.toString('hex')}:${authTag}:${encrypted}`;
  return { licenseKey, expiresAt };
}

const router = Router();

// All admin routes require JWT
router.use(requireAdmin);

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

/**
 * GET /api/admin/stats
 * High-level numbers for the admin dashboard overview.
 */
router.get('/stats', (_req: Request, res: Response) => {
  const totalInstances = (db.prepare('SELECT COUNT(*) as c FROM instances').get() as any).c;
  const pending        = (db.prepare("SELECT COUNT(*) as c FROM instances WHERE approval_status = 'pending'").get() as any).c;
  const blocked        = (db.prepare("SELECT COUNT(*) as c FROM instances WHERE approval_status = 'blocked'").get() as any).c;
  const approved       = (db.prepare("SELECT COUNT(*) as c FROM instances WHERE approval_status = 'approved'").get() as any).c;

  // Active today = last_seen within last 24 hours
  const activeToday = (db.prepare(`
    SELECT COUNT(*) as c FROM instances
    WHERE last_seen >= datetime('now', '-1 day')
  `).get() as any).c;

  // Active this week
  const activeWeek = (db.prepare(`
    SELECT COUNT(*) as c FROM instances
    WHERE last_seen >= datetime('now', '-7 days')
  `).get() as any).c;

  const totalRevRow   = db.prepare('SELECT SUM(total_revenue) as r FROM instances').get() as any;
  const totalSalesRow = db.prepare('SELECT SUM(total_sales) as s FROM instances').get() as any;
  const totalRevenue  = Number(totalRevRow?.r || 0);
  const totalSales    = Number(totalSalesRow?.s || 0);

  const licensesIssued = (db.prepare('SELECT COUNT(*) as c FROM license_keys WHERE is_active = 1').get() as any).c;
  const licensesAssigned = (db.prepare('SELECT COUNT(*) as c FROM license_keys WHERE instance_id IS NOT NULL').get() as any).c;

  // Instances expiring within 7 days (critical)
  const expiringCritical = db.prepare(`
    SELECT instance_id, store_name, owner_mobile, license_plan, license_expiry,
           CAST((julianday(license_expiry) - julianday('now')) AS INTEGER) as days_left
    FROM instances
    WHERE approval_status = 'approved'
      AND license_expiry IS NOT NULL
      AND license_expiry != ''
      AND julianday(license_expiry) >= julianday('now')
      AND julianday(license_expiry) <= julianday('now', '+7 days')
    ORDER BY license_expiry ASC
  `).all() as any[];

  // Instances expiring within 8–30 days (warning)
  const expiringWarning = db.prepare(`
    SELECT instance_id, store_name, owner_mobile, license_plan, license_expiry,
           CAST((julianday(license_expiry) - julianday('now')) AS INTEGER) as days_left
    FROM instances
    WHERE approval_status = 'approved'
      AND license_expiry IS NOT NULL
      AND license_expiry != ''
      AND julianday(license_expiry) > julianday('now', '+7 days')
      AND julianday(license_expiry) <= julianday('now', '+30 days')
    ORDER BY license_expiry ASC
  `).all() as any[];

  // Already expired (but still 'approved' — admin may not have noticed)
  const expired = db.prepare(`
    SELECT instance_id, store_name, owner_mobile, license_plan, license_expiry,
           CAST((julianday('now') - julianday(license_expiry)) AS INTEGER) as days_overdue
    FROM instances
    WHERE approval_status = 'approved'
      AND license_expiry IS NOT NULL
      AND license_expiry != ''
      AND julianday(license_expiry) < julianday('now')
    ORDER BY license_expiry ASC
  `).all() as any[];

  res.json({
    success: true,
    data: {
      totalInstances,
      pending,
      blocked,
      approved,
      activeToday,
      activeWeek,
      totalRevenue,
      totalSales,
      licensesIssued,
      licensesAssigned,
      expiringCritical,
      expiringWarning,
      expired,
    },
  });
});

// ─── Instances ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/instances
 * Returns all instances sorted by last_seen desc.
 * Query params: ?status=&search=&limit=50&offset=0&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
 * When date_from/date_to are provided, total_sales/total_revenue reflect that period only
 * (joined from instance_sales). Otherwise lifetime cumulative stats are returned.
 */
router.get('/instances', (req: Request, res: Response) => {
  const { status, search, limit = '50', offset = '0', date_from, date_to } = req.query as Record<string, string>;

  const whereClauses: string[] = [];
  const whereParams:  any[]    = [];

  if (status) {
    whereClauses.push('i.approval_status = ?');
    whereParams.push(status);
  }
  if (search) {
    whereClauses.push('(i.store_name LIKE ? OR i.owner_mobile LIKE ? OR i.owner_name LIKE ? OR i.business_name LIKE ?)');
    const pat = `%${search}%`;
    whereParams.push(pat, pat, pat, pat);
  }

  const whereClause = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const hasDateFilter = !!(date_from && date_to);
  const joinParams:   any[] = [];
  let salesJoin    = '';
  let salesColumns = 'i.total_sales, i.total_revenue';

  if (hasDateFilter) {
    salesJoin = `
      LEFT JOIN (
        SELECT instance_id,
               COUNT(*)                            AS period_sales,
               COALESCE(ROUND(SUM(total), 0), 0)  AS period_revenue
        FROM instance_sales
        WHERE date_created >= ? AND date_created <= ?
        GROUP BY instance_id
      ) ps ON ps.instance_id = i.instance_id
    `;
    salesColumns = 'COALESCE(ps.period_sales, 0) AS total_sales, COALESCE(ps.period_revenue, 0) AS total_revenue';
    joinParams.push(date_from, date_to + ' 23:59:59');
  }

  const rows = db.prepare(`
    SELECT
      i.id, i.instance_id, i.store_name, i.owner_name, i.owner_mobile, i.owner_email,
      i.store_address, i.business_name, i.license_plan, i.license_expiry, i.license_key,
      i.approval_status, i.block_reason, i.last_seen, i.app_version,
      i.branch_name,
      ${salesColumns},
      i.total_customers, i.total_products,
      i.device_fingerprint,
      i.created_at, i.updated_at
    FROM instances i
    ${salesJoin}
    ${whereClause}
    ORDER BY
      CASE WHEN i.approval_status = 'pending' THEN 0 ELSE 1 END ASC,
      i.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...joinParams, ...whereParams, Number(limit), Number(offset)) as Instance[];

  // Count query doesn't need the date join — just count matching instances
  const countWhere = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
  const countRow = db.prepare(`SELECT COUNT(*) as c FROM instances ${countWhere}`).get(...whereParams) as any;

  res.json({ success: true, data: rows, total: countRow.c });
});

/**
 * GET /api/admin/instances/:id
 * Full detail for one instance including recent sync events.
 */

router.get('/instances/:id', (req: Request, res: Response) => {
  const instance = db
    .prepare('SELECT * FROM instances WHERE instance_id = ?')
    .get(req.params.id) as Instance | undefined;

  if (!instance) {
    res.status(404).json({ success: false, error: 'Instance not found' });
    return;
  }

  // Recent sync events (last 100)
  const recentEvents = db.prepare(`
    SELECT id, entity_type, operation, received_at
    FROM sync_events
    WHERE instance_id = ?
    ORDER BY id DESC LIMIT 100
  `).all(req.params.id);

  // Sales summary
  const salesStats = db.prepare(`
    SELECT
      COUNT(*) as total_synced_sales,
      SUM(total) as synced_revenue,
      MAX(date_created) as last_sale_date
    FROM instance_sales WHERE instance_id = ?
  `).get(req.params.id) as any;

  res.json({
    success: true,
    data: {
      instance,
      recentEvents,
      salesStats,
    },
  });
});

/**
 * POST /api/admin/instances/:id/approve
 * Approve an instance and optionally issue a license key.
 * Body: { plan?: 'monthly'|'quarterly'|'yearly'|'lifetime', duration_days?: number, notes?: string }
 * If plan is supplied a license key is generated, recorded in license_keys,
 * and written to the instance row so the POS receives it on the next poll.
 */
router.post('/instances/:id/approve', (req: Request, res: Response) => {
  const { plan, duration_days, notes } = req.body as {
    plan?: string;
    duration_days?: number;
    notes?: string;
  };

  const instanceId = req.params.id;

  // Verify instance exists
  const existing = db.prepare('SELECT * FROM instances WHERE instance_id = ?').get(instanceId) as any;
  if (!existing) {
    res.status(404).json({ success: false, error: 'Instance not found' });
    return;
  }

  let licenseKey: string | null = null;
  let expiresAt: string | null = null;
  let resolvedPlan = plan || null;

  if (plan) {
    const defaultDays: Record<string, number> = {
      monthly: 30, quarterly: 90, yearly: 365, lifetime: 36500,
    };
    const days = Number(duration_days) || defaultDays[plan] || 30;

    // Generate proper AES-256-GCM key (same algorithm as keygen.js / license_manager.ts)
    // fingerprint = '' so the online license works on any device; server controls access
    const issuedTo = (existing.store_name || existing.business_name || '').trim() || 'Unknown Business';
    const generated = generateLicenseKey({ issuedTo, fingerprint: '', plan, durationDays: days });
    licenseKey = generated.licenseKey;
    expiresAt  = generated.expiresAt;

    // Record in license_keys table
    db.prepare(`
      INSERT INTO license_keys (license_key, instance_id, plan, duration_days, expires_at, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(licenseKey, instanceId, plan, days, expiresAt, notes || '');
  }

  // Update instance: set approved + reset license_revoked + optionally update license fields
  db.prepare(`
    UPDATE instances SET
      approval_status = 'approved',
      block_reason    = '',
      license_revoked = 0,
      license_key     = CASE WHEN ? IS NOT NULL THEN ? ELSE license_key END,
      license_plan    = CASE WHEN ? IS NOT NULL THEN ? ELSE license_plan END,
      license_expiry  = CASE WHEN ? IS NOT NULL THEN ? ELSE license_expiry END,
      updated_at      = datetime('now')
    WHERE instance_id = ?
  `).run(
    licenseKey, licenseKey,
    resolvedPlan, resolvedPlan,
    licenseKey, expiresAt,   // only update expiry when key was generated
    instanceId,
  );

  res.json({
    success: true,
    message: `Instance ${instanceId} approved`,
    licenseKey,
    plan: resolvedPlan,
    expiresAt,
  });
});

/**
 * POST /api/admin/instances/:id/block-license
 * Block the license for this instance separately from blocking cloud sync.
 * Sets license_revoked = 1 so the POS will clear its local license on next poll.
 * The app becomes unusable even if the user goes offline afterward.
 * Body: { reason? }
 */
router.post('/instances/:id/block-license', (req: Request, res: Response) => {
  const { reason } = req.body as { reason?: string };
  const inst = db.prepare('SELECT * FROM instances WHERE instance_id = ?').get(req.params.id) as any;
  if (!inst) { res.status(404).json({ success: false, error: 'Instance not found' }); return; }

  // Deactivate license key in license_keys table
  if (inst.license_key) {
    db.prepare('UPDATE license_keys SET is_active = 0 WHERE license_key = ?').run(inst.license_key);
  }

  db.prepare(`
    UPDATE instances SET
      approval_status = 'blocked',
      license_revoked = 1,
      license_key     = '',
      license_plan    = 'none',
      license_expiry  = NULL,
      block_reason    = ?,
      updated_at      = datetime('now')
    WHERE instance_id = ?
  `).run(reason || 'License revoked by admin', req.params.id);

  res.json({ success: true, message: 'License revoked — POS will clear local license on next sync' });
});

/**
 * POST /api/admin/instances/:id/unblock-license
 * Re-enable a previously revoked license.
 * Sets approval_status back to 'approved' so the POS can poll /status successfully.
 * Also tries to restore the most-recently assigned license key from license_keys table.
 */
router.post('/instances/:id/unblock-license', (req: Request, res: Response) => {
  const inst = db.prepare('SELECT * FROM instances WHERE instance_id = ?').get(req.params.id) as any;
  if (!inst) { res.status(404).json({ success: false, error: 'Instance not found' }); return; }

  // Try to restore the most recent license key that was assigned to this instance
  const restoredKey = db.prepare(`
    SELECT license_key, plan, expires_at
    FROM license_keys
    WHERE instance_id = ? AND is_active = 0
    ORDER BY issued_at DESC
    LIMIT 1
  `).get(req.params.id) as any;

  if (restoredKey) {
    // Re-activate the key and restore it on the instance
    db.prepare('UPDATE license_keys SET is_active = 1 WHERE license_key = ?').run(restoredKey.license_key);
    db.prepare(`
      UPDATE instances SET
        approval_status = 'approved',
        license_revoked = 0,
        block_reason    = '',
        license_key     = ?,
        license_plan    = ?,
        license_expiry  = ?,
        updated_at      = datetime('now')
      WHERE instance_id = ?
    `).run(restoredKey.license_key, restoredKey.plan || 'standard', restoredKey.expires_at || null, req.params.id);

    res.json({
      success: true,
      message: 'License unblocked and restored. The POS will re-activate the key on next sync.',
      license_key: restoredKey.license_key,
      license_plan: restoredKey.plan,
    });
  } else {
    // No previous key to restore — still unblock, admin should re-approve to issue new key
    db.prepare(`
      UPDATE instances SET
        approval_status = 'approved',
        license_revoked = 0,
        block_reason    = '',
        updated_at      = datetime('now')
      WHERE instance_id = ?
    `).run(req.params.id);

    res.json({
      success: true,
      message: 'License unblocked (no previous key to restore). Use Approve to issue a new license key.',
    });
  }
});

/**
 * POST /api/admin/instances/:id/block
 * Block an instance. The next time it calls any authenticated endpoint it gets a 403.
 * Body: { reason? }
 */
router.post('/instances/:id/block', (req: Request, res: Response) => {
  const { reason } = req.body as { reason?: string };
  const result = db.prepare(`
    UPDATE instances
    SET approval_status = 'blocked',
        block_reason    = ?,
        updated_at      = datetime('now')
    WHERE instance_id = ?
  `).run(reason || 'Blocked by admin', req.params.id);

  if (result.changes === 0) {
    res.status(404).json({ success: false, error: 'Instance not found' });
    return;
  }
  res.json({ success: true, message: `Instance ${req.params.id} blocked` });
});

/**
 * GET /api/admin/instances/:id/sales
 * Paginated list of synced sales for a specific instance.
 * Query: ?limit=50&offset=0
 */
router.get('/instances/:id/sales', (req: Request, res: Response) => {
  const { limit = '500', offset = '0', date_from, date_to } = req.query as Record<string, string>;
  const hasDateFilter = !!(date_from && date_to);

  const whereDate = hasDateFilter ? 'AND date(date_created) BETWEEN ? AND ?' : '';
  const baseParams: any[] = [req.params.id];
  const dateParams: any[] = hasDateFilter ? [date_from, date_to] : [];

  const sales = db.prepare(`
    SELECT * FROM instance_sales
    WHERE instance_id = ? ${whereDate}
    ORDER BY date_created DESC NULLS LAST
    LIMIT ? OFFSET ?
  `).all(...baseParams, ...dateParams, Number(limit), Number(offset));

  const countRow = db.prepare(
    `SELECT COUNT(*) as c FROM instance_sales WHERE instance_id = ? ${whereDate}`
  ).get(...baseParams, ...dateParams) as any;

  res.json({ success: true, data: sales, total: countRow.c });
});

/**
 * GET /api/admin/instances/:id/export
 * Full JSON export — structured for POS import compatibility.
 * Parses sync_events by entity_type so the file can be imported directly
 * into the POS via Settings > Restore JSON Backup.
 */
router.get('/instances/:id/export', (req: Request, res: Response) => {
  const instance = db
    .prepare('SELECT * FROM instances WHERE instance_id = ?')
    .get(req.params.id) as Instance | undefined;

  if (!instance) {
    res.status(404).json({ success: false, error: 'Instance not found' });
    return;
  }

  // Parse all sync events, building a deduplicated map per entity_type
  const rawEvents = db
    .prepare('SELECT * FROM sync_events WHERE instance_id = ? ORDER BY id ASC')
    .all(req.params.id) as any[];

  const entityMap: Record<string, Map<string, any>> = {};

  for (const event of rawEvents) {
    const type = event.entity_type as string;
    if (!entityMap[type]) entityMap[type] = new Map();

    let payload: any = null;
    try {
      payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
    } catch { continue; }

    if (!payload) continue;

    // Use payload.id as the stable key; fall back to sync event id
    const key = String(payload?.id ?? payload?.barcode ?? event.id);

    if (event.operation === 'delete') {
      entityMap[type].delete(key);
    } else {
      entityMap[type].set(key, payload);
    }
  }

  // Convert maps to arrays
  const structured: Record<string, any[]> = {};
  for (const [type, items] of Object.entries(entityMap)) {
    structured[type] = Array.from(items.values());
  }

  // If no synced sales, fall back to instance_sales table
  const fallbackSales = structured.sales?.length
    ? []
    : db.prepare('SELECT * FROM instance_sales WHERE instance_id = ? ORDER BY date_created').all(req.params.id);

  res.json({
    exported_at: new Date().toISOString(),
    instance: {
      store_name:    instance.store_name,
      owner_name:    instance.owner_name,
      owner_mobile:  instance.owner_mobile,
      license_plan:  instance.license_plan,
      approval_status: instance.approval_status,
    },
    // POS-compatible keys (matches window.api.importData expected structure)
    products:          structured.products          || [],
    customers:         structured.customers         || [],
    vendors:           structured.vendors           || [],
    purchases:         structured.purchases         || [],
    expenses:          structured.expenses          || [],
    sales:             structured.sales?.length ? structured.sales : fallbackSales,
    sale_items:        structured.sale_items        || [],
    inventory_batches: structured.inventory_batches || [],
    customer_payments: structured.customer_payments || [],
    // Meta
    raw_events_count: rawEvents.length,
  });
});

/**
 * GET /api/admin/export-all
 * Export all instances with their structured data (one JSON file).
 * Query: ?status=approved|pending|blocked  (optional filter)
 * Each entry contains the same POS-compatible keys as the per-instance export.
 */
router.get('/export-all', (req: Request, res: Response) => {
  const { status } = req.query as { status?: string };

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (status) { where += ' AND approval_status = ?'; params.push(status); }

  const instances = db
    .prepare(`SELECT * FROM instances ${where} ORDER BY created_at DESC`)
    .all(...params) as Instance[];

  const exportData = instances.map(inst => {
    const rawEvents = db
      .prepare('SELECT * FROM sync_events WHERE instance_id = ? ORDER BY id ASC')
      .all(inst.instance_id) as any[];

    const entityMap: Record<string, Map<string, any>> = {};
    for (const event of rawEvents) {
      const type = event.entity_type as string;
      if (!entityMap[type]) entityMap[type] = new Map();
      let payload: any = null;
      try { payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload; } catch { continue; }
      if (!payload) continue;
      const key = String(payload?.id ?? payload?.barcode ?? event.id);
      if (event.operation === 'delete') entityMap[type].delete(key);
      else entityMap[type].set(key, payload);
    }

    const structured: Record<string, any[]> = {};
    for (const [type, items] of Object.entries(entityMap)) structured[type] = Array.from(items.values());

    const fallbackSales = structured.sales?.length
      ? []
      : db.prepare('SELECT * FROM instance_sales WHERE instance_id = ? ORDER BY date_created').all(inst.instance_id);

    return {
      instance: {
        instance_id:     inst.instance_id,
        store_name:      inst.store_name,
        owner_name:      inst.owner_name,
        owner_mobile:    inst.owner_mobile,
        license_plan:    inst.license_plan,
        license_expiry:  inst.license_expiry,
        approval_status: inst.approval_status,
        total_sales:     inst.total_sales,
        total_revenue:   inst.total_revenue,
        total_customers: inst.total_customers,
        total_products:  inst.total_products,
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
    };
  });

  res.json({
    exported_at:      new Date().toISOString(),
    total_instances:  instances.length,
    instances:        exportData,
  });
});

/**
 * GET /api/admin/instances/:id/products
 * Parsed product list from sync_events for this instance.
 * Deduplicates by product ID, shows latest state for each product.
 */
router.get('/instances/:id/products', (req: Request, res: Response) => {
  const exists = db.prepare('SELECT 1 FROM instances WHERE instance_id = ?').get(req.params.id);
  if (!exists) { res.status(404).json({ success: false, error: 'Instance not found' }); return; }

  const events = db.prepare(`
    SELECT operation, payload FROM sync_events
    WHERE instance_id = ? AND entity_type = 'product'
    ORDER BY id ASC
  `).all(req.params.id) as any[];

  const productMap = new Map<string, any>();
  for (const event of events) {
    try {
      const p = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
      const key = String(p?.id ?? p?.barcode ?? '');
      if (!key) continue;
      if (event.operation === 'delete') productMap.delete(key);
      else productMap.set(key, p);
    } catch { continue; }
  }

  const products = Array.from(productMap.values())
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  res.json({ success: true, data: products, total: products.length });
});

// ─── Generic helper: parse sync_events for a given entity_type ───────────────

function parseEntityFromSync(instanceId: string, entityType: string): any[] {
  const events = db.prepare(`
    SELECT operation, payload FROM sync_events
    WHERE instance_id = ? AND entity_type = ?
    ORDER BY id ASC
  `).all(instanceId, entityType) as any[];

  const map = new Map<string, any>();
  for (const ev of events) {
    let p: any;
    try { p = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload; } catch { continue; }
    if (!p) continue;
    const key = String(p?.id ?? p?.barcode ?? Math.random());
    if (ev.operation === 'delete') map.delete(key);
    else map.set(key, p);
  }
  return Array.from(map.values());
}

/**
 * GET /api/admin/instances/:id/customers
 */
router.get('/instances/:id/customers', (req: Request, res: Response) => {
  const exists = db.prepare('SELECT 1 FROM instances WHERE instance_id = ?').get(req.params.id);
  if (!exists) { res.status(404).json({ success: false, error: 'Instance not found' }); return; }

  const customers = parseEntityFromSync(req.params.id, 'customer');
  const sales     = parseEntityFromSync(req.params.id, 'sale');
  const payments  = parseEntityFromSync(req.params.id, 'customer_payment');

  // Sum sales per customer
  const salesMap = new Map<string, number>();
  for (const s of sales) {
    const cid = String(s.customer_id ?? '');
    if (!cid || cid === 'null' || cid === '0') continue;
    if (s.status === 'Cancelled' || s.status === 'cancelled') continue;
    salesMap.set(cid, (salesMap.get(cid) ?? 0) + (parseFloat(s.total) || 0));
  }
  // Sum payments per customer
  const payMap = new Map<string, number>();
  for (const p of payments) {
    const cid = String(p.customer_id ?? '');
    if (!cid || cid === 'null') continue;
    payMap.set(cid, (payMap.get(cid) ?? 0) + (parseFloat(p.amount) || 0));
  }

  const items = customers.map((c: any) => {
    const cid = String(c.id ?? '');
    const balance = Math.max(0, (salesMap.get(cid) ?? 0) - (payMap.get(cid) ?? 0));
    return { ...c, balance: Math.round(balance * 100) / 100 };
  }).sort((a: any, b: any) => (b.balance - a.balance) || (a.name || '').localeCompare(b.name || ''));

  res.json({ success: true, data: items, total: items.length });
});

/**
 * GET /api/admin/instances/:id/vendors
 */
router.get('/instances/:id/vendors', (req: Request, res: Response) => {
  const exists = db.prepare('SELECT 1 FROM instances WHERE instance_id = ?').get(req.params.id);
  if (!exists) { res.status(404).json({ success: false, error: 'Instance not found' }); return; }

  const vendors   = parseEntityFromSync(req.params.id, 'vendor');
  const purchases = parseEntityFromSync(req.params.id, 'purchase');
  const payments  = parseEntityFromSync(req.params.id, 'vendor_payment');

  // Sum purchases per vendor
  const purchMap = new Map<string, number>();
  for (const p of purchases) {
    const vid = String(p.vendor_id ?? '');
    if (!vid || vid === 'null' || vid === '0') continue;
    purchMap.set(vid, (purchMap.get(vid) ?? 0) + (parseFloat(p.total) || 0));
  }
  // Sum payments per vendor
  const payMap = new Map<string, number>();
  for (const p of payments) {
    const vid = String(p.vendor_id ?? '');
    if (!vid || vid === 'null') continue;
    payMap.set(vid, (payMap.get(vid) ?? 0) + (parseFloat(p.amount) || 0));
  }

  const items = vendors.map((v: any) => {
    const vid = String(v.id ?? '');
    const balance = Math.max(0, (purchMap.get(vid) ?? 0) - (payMap.get(vid) ?? 0));
    return { ...v, balance: Math.round(balance * 100) / 100 };
  }).sort((a: any, b: any) => (b.balance - a.balance) || (a.name || '').localeCompare(b.name || ''));

  res.json({ success: true, data: items, total: items.length });
});

/**
 * GET /api/admin/instances/:id/purchases
 */
router.get('/instances/:id/purchases', (req: Request, res: Response) => {
  const exists = db.prepare('SELECT 1 FROM instances WHERE instance_id = ?').get(req.params.id);
  if (!exists) { res.status(404).json({ success: false, error: 'Instance not found' }); return; }

  const items = parseEntityFromSync(req.params.id, 'purchase')
    .sort((a: any, b: any) => (b.date_created || '').localeCompare(a.date_created || ''));

  res.json({ success: true, data: items, total: items.length });
});

/**
 * GET /api/admin/instances/:id/expenses
 */
router.get('/instances/:id/expenses', (req: Request, res: Response) => {
  const exists = db.prepare('SELECT 1 FROM instances WHERE instance_id = ?').get(req.params.id);
  if (!exists) { res.status(404).json({ success: false, error: 'Instance not found' }); return; }

  const items = parseEntityFromSync(req.params.id, 'expense')
    .sort((a: any, b: any) => (b.date_added || b.date_created || '').localeCompare(a.date_added || a.date_created || ''));

  res.json({ success: true, data: items, total: items.length });
});

/**
 * GET /api/admin/instances/:id/loans
 * Returns customers with outstanding balances (receivables) and vendors with
 * pending payables, computed from synced sales / purchases / payments.
 */
router.get('/instances/:id/loans', (req: Request, res: Response) => {
  const exists = db.prepare('SELECT 1 FROM instances WHERE instance_id = ?').get(req.params.id);
  if (!exists) { res.status(404).json({ success: false, error: 'Instance not found' }); return; }

  const instanceId = req.params.id;

  // ── Customer receivables (Udhaar) ────────────────────────────────────────────
  const customers        = parseEntityFromSync(instanceId, 'customer');
  const sales            = parseEntityFromSync(instanceId, 'sale');
  const customerPayments = parseEntityFromSync(instanceId, 'customer_payment');

  const salesByCustomer = new Map<string, number>();
  for (const s of sales) {
    const cid = String(s.customer_id ?? '');
    if (!cid || cid === 'null' || cid === '0') continue;
    if (s.status === 'Cancelled' || s.status === 'cancelled') continue;
    salesByCustomer.set(cid, (salesByCustomer.get(cid) ?? 0) + (parseFloat(s.total) || 0));
  }
  const cpByCustomer = new Map<string, number>();
  for (const p of customerPayments) {
    const cid = String(p.customer_id ?? '');
    if (!cid || cid === 'null') continue;
    cpByCustomer.set(cid, (cpByCustomer.get(cid) ?? 0) + (parseFloat(p.amount) || 0));
  }
  const customerLoans = customers
    .map((c: any) => {
      const cid = String(c.id ?? '');
      const balance = Math.max(0, (salesByCustomer.get(cid) ?? 0) - (cpByCustomer.get(cid) ?? 0));
      return { ...c, balance: Math.round(balance * 100) / 100 };
    })
    .filter((c: any) => c.balance > 0)
    .sort((a: any, b: any) => b.balance - a.balance);

  // ── Vendor payables ──────────────────────────────────────────────────────────
  const vendors        = parseEntityFromSync(instanceId, 'vendor');
  const purchases      = parseEntityFromSync(instanceId, 'purchase');
  const vendorPayments = parseEntityFromSync(instanceId, 'vendor_payment');

  const purchByVendor = new Map<string, number>();
  for (const p of purchases) {
    const vid = String(p.vendor_id ?? '');
    if (!vid || vid === 'null' || vid === '0') continue;
    purchByVendor.set(vid, (purchByVendor.get(vid) ?? 0) + (parseFloat(p.total) || 0));
  }
  const vpByVendor = new Map<string, number>();
  for (const p of vendorPayments) {
    const vid = String(p.vendor_id ?? '');
    if (!vid || vid === 'null') continue;
    vpByVendor.set(vid, (vpByVendor.get(vid) ?? 0) + (parseFloat(p.amount) || 0));
  }
  const vendorLoans = vendors
    .map((v: any) => {
      const vid = String(v.id ?? '');
      const balance = Math.max(0, (purchByVendor.get(vid) ?? 0) - (vpByVendor.get(vid) ?? 0));
      return { ...v, balance: Math.round(balance * 100) / 100 };
    })
    .filter((v: any) => v.balance > 0)
    .sort((a: any, b: any) => b.balance - a.balance);

  const totalReceivable = Math.round(customerLoans.reduce((s: number, c: any) => s + c.balance, 0) * 100) / 100;
  const totalPayable    = Math.round(vendorLoans.reduce((s: number, v: any) => s + v.balance, 0) * 100) / 100;

  res.json({
    success: true,
    data: { customerLoans, vendorLoans, totalReceivable, totalPayable },
  });
});

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/analytics
 * Aggregated analytics for the admin dashboard.
 * Returns revenue by instance, activity distribution, plan distribution,
 * status distribution, and 30-day sales trend.
 */
router.get('/analytics', (req: Request, res: Response) => {
  const { date_from, date_to } = req.query as Record<string, string>;
  const hasDateRange = !!(date_from && date_to);

  // Top 10 instances by revenue — period-filtered when dates provided, all-time otherwise
  let revenueByInstance: any[];
  if (hasDateRange) {
    revenueByInstance = db.prepare(`
      SELECT i.instance_id, i.store_name, i.owner_mobile,
             COALESCE(s.total_revenue, 0) AS total_revenue,
             COALESCE(s.total_sales, 0)   AS total_sales,
             i.total_customers, i.total_products
      FROM instances i
      LEFT JOIN (
        SELECT instance_id,
               SUM(total)  AS total_revenue,
               COUNT(*)    AS total_sales
        FROM instance_sales
        WHERE date(date_created) BETWEEN ? AND ?
        GROUP BY instance_id
      ) s ON s.instance_id = i.instance_id
      WHERE i.approval_status = 'approved'
      ORDER BY COALESCE(s.total_revenue, 0) DESC
      LIMIT 10
    `).all(date_from, date_to);
  } else {
    revenueByInstance = db.prepare(`
      SELECT instance_id, store_name, owner_mobile,
             total_revenue, total_sales, total_customers, total_products
      FROM instances
      WHERE approval_status = 'approved'
      ORDER BY total_revenue DESC
      LIMIT 10
    `).all();
  }

  // Activity — how recently was each instance last seen
  const activityDistribution = db.prepare(`
    SELECT
      CASE
        WHEN last_seen >= datetime('now', '-1 day')   THEN 'Today'
        WHEN last_seen >= datetime('now', '-7 days')  THEN 'This Week'
        WHEN last_seen >= datetime('now', '-30 days') THEN 'This Month'
        WHEN last_seen IS NOT NULL                    THEN 'Older'
        ELSE 'Never'
      END AS period,
      COUNT(*) AS count
    FROM instances
    GROUP BY period
    ORDER BY CASE period
      WHEN 'Today'      THEN 1
      WHEN 'This Week'  THEN 2
      WHEN 'This Month' THEN 3
      WHEN 'Older'      THEN 4
      ELSE 5 END
  `).all();

  // License plan mix (approved instances)
  const planDistribution = db.prepare(`
    SELECT COALESCE(NULLIF(license_plan,''),'none') AS plan, COUNT(*) AS count
    FROM instances WHERE approval_status = 'approved'
    GROUP BY plan
    ORDER BY count DESC
  `).all();

  // Status counts
  const statusDistribution = db.prepare(`
    SELECT approval_status AS status, COUNT(*) AS count
    FROM instances GROUP BY approval_status
  `).all();

  // Sales trend — period-filtered when dates provided, last 30 days otherwise
  const salesByDayQuery = db.prepare(`
    SELECT
      strftime('%Y-%m-%d', date_created) as day,
      COUNT(*) as sales_count,
      COALESCE(SUM(total), 0) as revenue,
      COUNT(DISTINCT instance_id) as active_stores
    FROM instance_sales
    WHERE ${hasDateRange ? "date(date_created) BETWEEN ? AND ?" : "date_created >= datetime('now', '-30 days')"}
    GROUP BY day
    ORDER BY day
  `);
  const salesByDay = hasDateRange
    ? salesByDayQuery.all(date_from, date_to)
    : salesByDayQuery.all();

  // Top selling products across all instances (by entity_type counts in sync_events)
  const topEntityTypes = db.prepare(`
    SELECT entity_type, COUNT(*) AS event_count
    FROM sync_events
    GROUP BY entity_type
    ORDER BY event_count DESC
  `).all();

  // Top-selling products — parse items_summary from instance_sales (last 30 days)
  // Format: "Product A (x2), Product B (x1)"
  const recentSummaries = db.prepare(`
    SELECT items_summary FROM instance_sales
    WHERE items_summary != '' AND items_summary IS NOT NULL
      AND date_created >= datetime('now', '-30 days')
  `).all() as Array<{ items_summary: string }>;

  const productQtyMap = new Map<string, number>();
  for (const row of recentSummaries) {
    if (!row.items_summary) continue;
    const parts = row.items_summary.split(',');
    for (const part of parts) {
      const match = part.trim().match(/^(.+?)\s*\(x(\d+)\)$/);
      if (match) {
        const name = match[1].trim();
        const qty  = parseInt(match[2], 10) || 1;
        productQtyMap.set(name, (productQtyMap.get(name) ?? 0) + qty);
      }
    }
  }
  const topProducts = Array.from(productQtyMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, qty]) => ({ name, qty }));

  // Summary totals across all approved instances
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(total_customers), 0) AS total_customers,
      COALESCE(SUM(total_products),  0) AS total_products,
      COALESCE(SUM(total_sales),     0) AS total_sales,
      COALESCE(SUM(total_revenue),   0) AS total_revenue
    FROM instances WHERE approval_status = 'approved'
  `).get() as { total_customers: number; total_products: number; total_sales: number; total_revenue: number };

  // Vendor count (from sync_events entity_type='vendor' — distinct by instance)
  const vendorTotal = (db.prepare(`
    SELECT COUNT(DISTINCT json_extract(payload, '$.id') || instance_id) AS cnt
    FROM sync_events
    WHERE entity_type = 'vendor' AND operation = 'create'
  `).get() as any)?.cnt ?? 0;

  res.json({
    success: true,
    data: {
      revenueByInstance,
      activityDistribution,
      planDistribution,
      statusDistribution,
      salesByDay,
      topEntityTypes,
      topProducts,
      totals: { ...totals, total_vendors: vendorTotal },
    },
  });
});

// ─── License Keys ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/licenses
 * List all license keys (with assignment info).
 */
router.get('/licenses', (_req: Request, res: Response) => {
  const keys = db.prepare(`
    SELECT l.*, i.store_name, i.owner_mobile
    FROM license_keys l
    LEFT JOIN instances i ON l.instance_id = i.instance_id
    ORDER BY l.issued_at DESC
  `).all();

  res.json({ success: true, data: keys });
});

/**
 * POST /api/admin/licenses
 * Generate a new license key.
 * Body: { plan, duration_days, notes?, instance_id? }
 */
router.post('/licenses', (req: Request, res: Response) => {
  const { plan, duration_days, notes, instance_id } = req.body as {
    plan: string;
    duration_days?: number;
    notes?: string;
    instance_id?: string;
  };

  if (!plan) {
    res.status(400).json({ success: false, error: 'plan is required' });
    return;
  }

  const days = Number(duration_days) || 30;

  // Generate proper AES-256-GCM key; fingerprint='' → any device (offline delivery path)
  const generated = generateLicenseKey({ issuedTo: 'Unknown Business', fingerprint: '', plan, durationDays: days });
  const license_key = generated.licenseKey;
  const expiresAt   = generated.expiresAt;

  const result = db.prepare(`
    INSERT INTO license_keys (license_key, instance_id, plan, duration_days, expires_at, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(license_key, instance_id || null, plan, days, expiresAt, notes || '');

  // If assigned immediately, also update the instance's license info
  if (instance_id) {
    db.prepare(`
      UPDATE instances SET
        license_key    = ?,
        license_plan   = ?,
        license_expiry = ?,
        updated_at     = datetime('now')
      WHERE instance_id = ?
    `).run(license_key, plan, expiresAt, instance_id);
  }

  res.status(201).json({
    success: true,
    data: { id: result.lastInsertRowid, license_key, plan, duration_days: days, expires_at: expiresAt },
  });
});

/**
 * POST /api/admin/licenses/:key/assign
 * Assign an existing license key to an instance.
 * Body: { instance_id }
 */
router.post('/licenses/:key/assign', (req: Request, res: Response) => {
  const { instance_id } = req.body as { instance_id?: string };
  if (!instance_id) {
    res.status(400).json({ success: false, error: 'instance_id is required' });
    return;
  }

  const lic = db
    .prepare('SELECT * FROM license_keys WHERE license_key = ? AND is_active = 1')
    .get(req.params.key) as LicenseKey | undefined;

  if (!lic) {
    res.status(404).json({ success: false, error: 'License key not found or inactive' });
    return;
  }

  // Assign license to instance
  db.prepare('UPDATE license_keys SET instance_id = ? WHERE license_key = ?')
    .run(instance_id, req.params.key);

  // Assign license AND approve/unblock the instance so the POS can immediately authenticate
  db.prepare(`
    UPDATE instances SET
      approval_status = 'approved',
      license_revoked = 0,
      block_reason    = '',
      license_key     = ?,
      license_plan    = ?,
      license_expiry  = ?,
      updated_at      = datetime('now')
    WHERE instance_id = ?
  `).run(req.params.key, lic.plan, lic.expires_at, instance_id);

  res.json({ success: true, message: `License ${req.params.key} assigned and instance approved` });
});

/**
 * DELETE /api/admin/licenses/:key
 * Deactivate a license key.
 */
router.delete('/licenses/:key', (req: Request, res: Response) => {
  const result = db
    .prepare('UPDATE license_keys SET is_active = 0 WHERE license_key = ?')
    .run(req.params.key);

  if (result.changes === 0) {
    res.status(404).json({ success: false, error: 'License key not found' });
    return;
  }
  res.json({ success: true, message: 'License deactivated' });
});

// ─── Notifications ────────────────────────────────────────────────────────────

/**
 * GET /api/admin/notifications
 * List all notifications with read-count per notification.
 */
router.get('/notifications', (_req: Request, res: Response) => {
  const notifications = db.prepare(`
    SELECT
      n.*,
      (SELECT COUNT(*) FROM notification_reads r WHERE r.notification_id = n.id) AS read_count,
      CASE
        WHEN n.target_instance_id IS NULL
          THEN (SELECT COUNT(*) FROM instances WHERE approval_status = 'approved')
        ELSE 1
      END AS target_count,
      i.store_name AS target_store_name
    FROM notifications n
    LEFT JOIN instances i ON n.target_instance_id = i.instance_id
    ORDER BY n.sent_at DESC
    LIMIT 200
  `).all();

  res.json({ success: true, data: notifications });
});

/**
 * POST /api/admin/notifications
 * Send a notification to all instances (instance_id omitted) or a specific one.
 * Body: { title, body, instance_id? }
 */
router.post('/notifications', (req: Request, res: Response) => {
  const { title, body, instance_id } = req.body as {
    title: string;
    body: string;
    instance_id?: string;
  };

  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ success: false, error: 'title and body are required' });
    return;
  }

  // Verify target instance exists if specified
  if (instance_id) {
    const exists = db.prepare('SELECT 1 FROM instances WHERE instance_id = ?').get(instance_id);
    if (!exists) {
      res.status(404).json({ success: false, error: 'Target instance not found' });
      return;
    }
  }

  const result = db.prepare(`
    INSERT INTO notifications (title, body, target_instance_id)
    VALUES (?, ?, ?)
  `).run(title.trim(), body.trim(), instance_id || null);

  res.status(201).json({
    success: true,
    data: {
      id: result.lastInsertRowid,
      title: title.trim(),
      body: body.trim(),
      target_instance_id: instance_id || null,
    },
  });
});

/**
 * DELETE /api/admin/notifications/:id
 * Deactivate (soft-delete) a notification so it is no longer delivered.
 */
router.delete('/notifications/:id', (req: Request, res: Response) => {
  const result = db
    .prepare('UPDATE notifications SET is_active = 0 WHERE id = ?')
    .run(req.params.id);

  if (result.changes === 0) {
    res.status(404).json({ success: false, error: 'Notification not found' });
    return;
  }
  res.json({ success: true, message: 'Notification deleted' });
});

export default router;
