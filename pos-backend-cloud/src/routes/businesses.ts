import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';

const router = Router();

/**
 * POST /api/register-business   (PUBLIC — no auth)
 *
 * Called from the POS Setup page when the user chooses "Online Verify".
 * Creates an instance with approval_status = 'pending' and returns the api_key.
 * Uses mobile number as instance_id (same convention as /api/instances/register).
 * Idempotent — returns existing api_key if already registered.
 */
router.post('/register-business', (req: Request, res: Response) => {
  const { businessName, ownerName, mobile, email, address, fingerprint, branchName } = req.body as Record<string, string>;

  if (!mobile) {
    res.status(400).json({ success: false, error: 'mobile is required' });
    return;
  }

  const branch = (branchName || 'Main Branch').trim();

  try {
    // Check if same mobile + branch already registered (idempotent per branch)
    const existing = db
      .prepare('SELECT * FROM instances WHERE owner_mobile = ? AND branch_name = ?')
      .get(mobile.trim(), branch) as any;

    if (existing) {
      if (fingerprint && fingerprint !== existing.device_fingerprint) {
        db.prepare("UPDATE instances SET device_fingerprint = ?, updated_at = datetime('now') WHERE instance_id = ?")
          .run(fingerprint.trim(), existing.instance_id);
      }
      res.json({
        success: true,
        instance_id: existing.instance_id,
        api_key: existing.api_key,
        approval_status: existing.approval_status,
        message: 'Already registered',
      });
      return;
    }

    // New branch — generate a fresh UUID so multiple branches per mobile are possible
    const instance_id = uuidv4();
    const api_key     = uuidv4();

    db.prepare(`
      INSERT INTO instances
        (instance_id, api_key, owner_mobile, business_name, owner_name,
         owner_email, store_address, store_name, device_fingerprint, branch_name, approval_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      instance_id,
      api_key,
      mobile.trim(),
      businessName || '',
      ownerName    || '',
      email        || '',
      address      || '',
      businessName || '',
      fingerprint  || '',
      branch,
    );

    res.status(201).json({
      success: true,
      instance_id,   // ← UUID returned so POS can poll by it
      api_key,
      approval_status: 'pending',
      message: 'Registration received. Awaiting admin approval.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/approval-status?mobile=xxx   (PUBLIC — no auth)
 *
 * Polled by the POS Setup "waiting" screen every 5 seconds.
 * Returns { success, status } where status is:
 *   'pending'        — registered, not yet approved
 *   'approved'       — admin approved
 *   'blocked'        — admin blocked
 *   'not_registered' — no record found (safe to keep polling)
 */
router.get('/approval-status', (req: Request, res: Response) => {
  // Prefer instance_id (UUID) — returned by register-business for new flow
  // Fall back to mobile for backward compat with older POS versions
  const instanceId = ((req.query.instance_id as string) || '').trim();
  const mobile     = ((req.query.mobile      as string) || '').trim();

  if (!instanceId && !mobile) {
    res.status(400).json({ success: false, error: 'instance_id or mobile is required' });
    return;
  }

  try {
    let row: any;
    if (instanceId) {
      row = db.prepare(
        'SELECT approval_status, license_key, block_reason FROM instances WHERE instance_id = ?'
      ).get(instanceId);
    } else {
      // Mobile-based lookup — returns most recently registered instance for that mobile
      row = db.prepare(
        'SELECT approval_status, license_key, block_reason FROM instances WHERE owner_mobile = ? ORDER BY created_at DESC LIMIT 1'
      ).get(mobile);
    }

    if (!row) {
      res.json({ success: true, status: 'not_registered' });
      return;
    }

    res.json({
      success: true,
      status: row.approval_status,
      licenseKey:  row.license_key  || undefined,
      blockReason: row.block_reason || undefined,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
