import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { requireAdmin } from '../middleware/auth';
import { Instance, LicenseKey } from '../types';

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
    },
  });
});

// ─── Instances ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/instances
 * Returns all instances sorted by last_seen desc.
 * Query params: ?status=pending|approved|blocked&search=<text>&limit=50&offset=0
 */
router.get('/instances', (req: Request, res: Response) => {
  const { status, search, limit = '50', offset = '0' } = req.query as Record<string, string>;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (status) {
    where += ' AND approval_status = ?';
    params.push(status);
  }
  if (search) {
    where += ' AND (store_name LIKE ? OR owner_mobile LIKE ? OR owner_name LIKE ? OR business_name LIKE ?)';
    const pat = `%${search}%`;
    params.push(pat, pat, pat, pat);
  }

  const rows = db.prepare(`
    SELECT
      id, instance_id, store_name, owner_name, owner_mobile, owner_email,
      store_address, business_name, license_plan, license_expiry, license_key,
      approval_status, block_reason, last_seen, app_version,
      total_sales, total_revenue, total_customers, total_products,
      created_at, updated_at
    FROM instances ${where}
    ORDER BY last_seen DESC NULLS LAST
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset)) as Instance[];

  const countRow = db.prepare(`SELECT COUNT(*) as c FROM instances ${where}`).get(...params) as any;

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
 * Approve an instance so its POS can use cloud features.
 */
router.post('/instances/:id/approve', (req: Request, res: Response) => {
  const result = db.prepare(`
    UPDATE instances SET approval_status = 'approved', block_reason = '', updated_at = datetime('now')
    WHERE instance_id = ?
  `).run(req.params.id);

  if (result.changes === 0) {
    res.status(404).json({ success: false, error: 'Instance not found' });
    return;
  }
  res.json({ success: true, message: `Instance ${req.params.id} approved` });
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
  const { limit = '50', offset = '0' } = req.query as Record<string, string>;

  const sales = db.prepare(`
    SELECT * FROM instance_sales
    WHERE instance_id = ?
    ORDER BY date_created DESC NULLS LAST
    LIMIT ? OFFSET ?
  `).all(req.params.id, Number(limit), Number(offset));

  const countRow = db.prepare(
    'SELECT COUNT(*) as c FROM instance_sales WHERE instance_id = ?'
  ).get(req.params.id) as any;

  res.json({ success: true, data: sales, total: countRow.c });
});

/**
 * GET /api/admin/instances/:id/export
 * Full JSON export of all data for a given instance.
 * Response is a JSON object ready to save as a file from the dashboard.
 */
router.get('/instances/:id/export', (req: Request, res: Response) => {
  const instance = db
    .prepare('SELECT * FROM instances WHERE instance_id = ?')
    .get(req.params.id) as Instance | undefined;

  if (!instance) {
    res.status(404).json({ success: false, error: 'Instance not found' });
    return;
  }

  const sales = db
    .prepare('SELECT * FROM instance_sales WHERE instance_id = ? ORDER BY date_created')
    .all(req.params.id);

  const rawEvents = db
    .prepare('SELECT * FROM sync_events WHERE instance_id = ? ORDER BY id')
    .all(req.params.id);

  res.json({
    exported_at: new Date().toISOString(),
    instance,
    sales,
    raw_events: rawEvents,
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
  const license_key = `OSA-${plan.toUpperCase().slice(0, 3)}-${uuidv4().split('-')[0].toUpperCase()}-${uuidv4().split('-')[1].toUpperCase()}`;

  // Calculate expiry date
  const expiresAt = plan === 'lifetime'
    ? null
    : new Date(Date.now() + days * 86400000).toISOString();

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

  db.prepare(`
    UPDATE instances SET
      license_key    = ?,
      license_plan   = ?,
      license_expiry = ?,
      updated_at     = datetime('now')
    WHERE instance_id = ?
  `).run(req.params.key, lic.plan, lic.expires_at, instance_id);

  res.json({ success: true, message: `License ${req.params.key} assigned to ${instance_id}` });
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

export default router;
