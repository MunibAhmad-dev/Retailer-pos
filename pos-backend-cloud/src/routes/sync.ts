import { Router, Request, Response } from 'express';
import db from '../db';
import { requireInstance } from '../middleware/instanceAuth';

const router = Router();

interface SyncItem {
  entity_type: string;
  operation: string;
  payload: Record<string, any>;
  local_id?: number;   // POS queue row ID — echoed back so POS can mark it done
}

/**
 * POST /api/sync   [instanceAuth]
 *
 * The main data ingestion endpoint. The POS sends batches of queued items here.
 * Each item is stored as a raw event. Sale items are also flattened into instance_sales.
 *
 * Body: { items: SyncItem[] }
 * Returns: { success, synced, results: [{ local_id, success, error? }] }
 */
router.post('/', requireInstance, (req: Request, res: Response) => {
  const inst = req.instance!;
  const { items } = req.body as { items?: SyncItem[] };

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ success: false, error: 'items array is required and must not be empty' });
    return;
  }

  if (items.length > 100) {
    res.status(400).json({ success: false, error: 'Maximum 100 items per sync batch' });
    return;
  }

  const results: Array<{ local_id?: number; success: boolean; error?: string }> = [];
  let synced = 0;
  let newSalesRevenue = 0;
  let newSalesCount = 0;

  const processAll = db.transaction(() => {
    for (const item of items) {
      try {
        const payloadStr = JSON.stringify(item.payload || {});

        // Always store the raw event
        db.prepare(`
          INSERT INTO sync_events (instance_id, entity_type, operation, payload)
          VALUES (?, ?, ?, ?)
        `).run(inst.instance_id, item.entity_type, item.operation, payloadStr);

        // Additional processing for specific entity types
        if (item.entity_type === 'sale' && item.operation === 'create') {
          const p = item.payload;
          const saleId = p.id ?? p.sale_id;
          if (saleId) {
            db.prepare(`
              INSERT OR REPLACE INTO instance_sales
                (instance_id, pos_sale_id, total, discount, payment_method,
                 payment_status, status, items_count, items_summary, date_created)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              inst.instance_id,
              saleId,
              Number(p.total || 0),
              Number(p.discount || 0),
              p.payment_method || 'cash',
              p.payment_status || 'Paid',
              p.status || 'Completed',
              Number(p.item_count || p.items_count || 0),
              p.items_summary || '',
              p.date_created || null,
            );

            if ((p.status || 'Completed') === 'Completed') {
              newSalesRevenue += Number(p.total || 0);
              newSalesCount += 1;
            }
          }
        }

        results.push({ local_id: item.local_id, success: true });
        synced++;
      } catch (err: any) {
        results.push({ local_id: item.local_id, success: false, error: err.message });
      }
    }

    // Update instance aggregates
    if (newSalesCount > 0) {
      db.prepare(`
        UPDATE instances SET
          total_sales   = total_sales + ?,
          total_revenue = total_revenue + ?,
          last_seen     = datetime('now'),
          updated_at    = datetime('now')
        WHERE instance_id = ?
      `).run(newSalesCount, newSalesRevenue, inst.instance_id);
    } else {
      db.prepare(`
        UPDATE instances SET last_seen = datetime('now'), updated_at = datetime('now')
        WHERE instance_id = ?
      `).run(inst.instance_id);
    }
  });

  processAll();

  res.json({ success: true, synced, total: items.length, results });
});

export default router;
