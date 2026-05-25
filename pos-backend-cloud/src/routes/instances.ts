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
    app_version,
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
        store_name    = COALESCE(NULLIF(?, ''), store_name),
        owner_name    = COALESCE(NULLIF(?, ''), owner_name),
        owner_email   = COALESCE(NULLIF(?, ''), owner_email),
        store_address = COALESCE(NULLIF(?, ''), store_address),
        business_name = COALESCE(NULLIF(?, ''), business_name),
        app_version   = COALESCE(NULLIF(?, ''), app_version),
        last_seen     = datetime('now'),
        updated_at    = datetime('now')
      WHERE instance_id = ?
    `).run(
      store_name || '',
      owner_name || '',
      owner_email || '',
      store_address || '',
      business_name || '',
      app_version || '',
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
      license_plan, license_expiry, app_version, approval_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    instance_id,
    store_name || '',
    owner_name || '',
    owner_mobile,
    owner_email || '',
    store_address || '',
    business_name || '',
    api_key,
    license_key || '',
    license_plan,
    license_expiry,
    app_version || '',
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
    instance_id: inst.instance_id,
    approval_status: inst.approval_status,
    license_plan: inst.license_plan,
    license_expiry: inst.license_expiry,
    block_reason: inst.block_reason || null,
    store_name: inst.store_name,
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

export default router;
