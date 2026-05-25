import { Request, Response, NextFunction } from 'express';
import db from '../db';
import { Instance } from '../types';

/**
 * Authenticates POS instances via their API key.
 * Reads `Authorization: Bearer <api_key>`, looks up the instance in the DB,
 * and attaches `req.instance` for downstream handlers.
 *
 * Returns 403 (not 401) when the instance is blocked so the POS can distinguish
 * "wrong key" from "account blocked" and show an appropriate message.
 */
export function requireInstance(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing API key' });
    return;
  }

  const apiKey = authHeader.slice(7).trim();
  const instance = db
    .prepare('SELECT * FROM instances WHERE api_key = ?')
    .get(apiKey) as Instance | undefined;

  if (!instance) {
    res.status(401).json({ success: false, error: 'Invalid API key' });
    return;
  }

  if (instance.approval_status === 'blocked') {
    res.status(403).json({
      success: false,
      error: 'blocked',
      message: instance.block_reason || 'This POS instance has been blocked. Contact support.',
    });
    return;
  }

  req.instance = instance;
  next();
}
