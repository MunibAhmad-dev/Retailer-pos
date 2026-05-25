import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db';
import { requireAdmin, signAdminToken } from '../middleware/auth';
import { AdminUser } from '../types';

const router = Router();

/**
 * POST /api/auth/setup
 * Creates the very first admin account. Protected by the ADMIN_SETUP_KEY
 * environment variable so it can't be called again once an admin exists.
 *
 * Body: { username, password }
 * Header: x-setup-key: <ADMIN_SETUP_KEY>
 */
router.post('/setup', async (req: Request, res: Response) => {
  const setupKey = req.headers['x-setup-key'];
  const expectedKey = process.env.ADMIN_SETUP_KEY || 'setup_osatech_2025';

  if (setupKey !== expectedKey) {
    res.status(403).json({ success: false, error: 'Invalid setup key' });
    return;
  }

  // Only allow if no admin exists yet
  const existing = db.prepare('SELECT id FROM admin_users LIMIT 1').get();
  if (existing) {
    res.status(409).json({ success: false, error: 'Admin already exists. Use /login instead.' });
    return;
  }

  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ success: false, error: 'username and password are required' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const result = db
    .prepare("INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, 'super_admin')")
    .run(username.trim().toLowerCase(), hash);

  const token = signAdminToken({ id: Number(result.lastInsertRowid), username, role: 'super_admin' });
  res.status(201).json({ success: true, message: 'Admin created', token });
});

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { token, expiresIn, admin: { id, username, role } }
 */
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ success: false, error: 'username and password are required' });
    return;
  }

  const admin = db
    .prepare('SELECT * FROM admin_users WHERE username = ?')
    .get(username.trim().toLowerCase()) as AdminUser | undefined;

  if (!admin) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
    return;
  }

  const payload = { id: admin.id, username: admin.username, role: admin.role };
  const token = signAdminToken(payload);
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  res.json({ success: true, token, expiresIn, admin: payload });
});

/**
 * GET /api/auth/me
 * Returns the current admin's info. Requires JWT.
 */
router.get('/me', requireAdmin, (req: Request, res: Response) => {
  res.json({ success: true, admin: req.admin });
});

export default router;
