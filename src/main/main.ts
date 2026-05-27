import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
// Triggering rebuild to fix SQL column error
import path from 'path';
import Database from 'better-sqlite3';
import fs from 'fs';
import crypto from 'crypto';
import { googleAuthService } from './googleDrive/googleAuth';
import { driveService } from './googleDrive/driveService';
import { backupService } from './googleDrive/backupService';
import { restoreService } from './googleDrive/restoreService';
import MenuBuilder from './menu';
import { LicenseManager } from './license_manager';


const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let db: Database.Database | null = null;
let licenseManager: LicenseManager | null = null;


// Enhanced logging for production
const logToFile = (level: string, args: any[]) => {
  try {
    const logPath = path.join(app.getPath('userData'), 'pos-app.log');
    const msg = `[${level}] ${new Date().toISOString()} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
    fs.appendFileSync(logPath, msg);
  } catch (e) {
    console.error('Failed to write to log file', e);
  }
};

const logger = {
  info: (...args: any[]) => { console.log('[INFO]', new Date().toISOString(), ...args); logToFile('INFO', args); },
  error: (...args: any[]) => { console.error('[ERROR]', new Date().toISOString(), ...args); logToFile('ERROR', args); },
  warn: (...args: any[]) => { console.warn('[WARN]', new Date().toISOString(), ...args); logToFile('WARN', args); },
  debug: (...args: any[]) => {
    if (isDev) { console.debug('[DEBUG]', new Date().toISOString(), ...args); logToFile('DEBUG', args); }
  },
};

const getLocalSqliteDate = (isoString?: string) => {
  if (!isoString) return new Date().toISOString().replace('T', ' ').substring(0, 19);
  // If it's already a local-style string (YYYY-MM-DD HH:mm:ss), just return it
  if (isoString.includes(' ') && !isoString.includes('T')) return isoString;

  const d = new Date(isoString);
  const offset = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - offset);
  return local.toISOString().replace('T', ' ').substring(0, 19);
};

const logEntityHistory = (
  database: Database.Database,
  entry: {
    entityType: 'vendor' | 'customer';
    entityId: number;
    historyType: string;
    amount?: number;
    relatedRecordId?: number | null;
    relatedRecordType?: string | null;
    notes?: string;
    actionStatus?: string;
  }
) => {
  try {
    database.prepare(`
      INSERT INTO entity_history (
        entity_type, entity_id, history_type, amount, related_record_id, related_record_type, notes, action_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `).run(
      entry.entityType,
      entry.entityId,
      entry.historyType,
      Number(entry.amount) || 0,
      entry.relatedRecordId ?? null,
      entry.relatedRecordType ?? null,
      entry.notes || '',
      entry.actionStatus || 'COMPLETED'
    );
  } catch (error: any) {
    logger.warn('Failed to write entity history:', error?.message || error);
  }
};

// Global Crash Handlers to prevent complete app shutdown
process.on('uncaughtException', (err) => {
  logger.error('FATAL UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('UNHANDLED REJECTION:', reason);
});

// Comprehensive migration and schema repair system
function checkDatabaseSchema(database: Database.Database) {
  try {
    // Robust Schema Repair (Runs every startup to ensure structural integrity)
    logger.info('Performing structural schema verification...');
    const repairs = [
      ["registers", "opened_at", "DATETIME"],
      ["registers", "closed_at", "DATETIME"],
      ["registers", "status", "TEXT DEFAULT 'open'"],
      ["registers", "closed_by", "TEXT"],
      ["registers", "notes", "TEXT"],
      ["registers", "actual_cash", "REAL DEFAULT 0"],
      ["registers", "opening_time", "DATETIME"],
      ["sales", "date_created", "DATETIME"],
      ["sale_items", "product_name", "TEXT"],
      ["sale_returns", "total_returned", "REAL DEFAULT 0"],
      ["sale_returns", "date_created", "DATETIME"],
      ["sale_returns", "notes", "TEXT"],
      ["sale_returns", "reason", "TEXT"],
      ["sale_return_items", "product_name", "TEXT"],
      ["sale_return_items", "price", "REAL NOT NULL DEFAULT 0"],
      ["purchases", "date_created", "DATETIME"],
      ["purchases", "register_id", "INTEGER"],
      ["purchases", "status", "TEXT DEFAULT 'Completed'"],
      ["purchase_returns", "date_created", "DATETIME"],
      ["purchase_returns", "total_returned", "REAL DEFAULT 0"],
      ["purchase_returns", "notes", "TEXT"],
      ["purchase_returns", "reason", "TEXT"],
      ["purchase_return_items", "product_name", "TEXT"],
      ["purchase_return_items", "purchase_price", "REAL NOT NULL DEFAULT 0"],
      ["vendor_payments", "date_created", "DATETIME"],
      ["vendor_payments", "amount", "REAL"],
      ["vendor_payments", "purchase_id", "INTEGER REFERENCES purchases(id) ON DELETE SET NULL"],
      ["customer_payments", "sale_id", "INTEGER REFERENCES sales(id) ON DELETE SET NULL"],
      ["financial_transactions", "date_created", "DATETIME"],
      ["financial_transactions", "type", "TEXT"],
      ["financial_transactions", "amount", "REAL"],
      ["products", "product_type", "TEXT DEFAULT 'general'"],
      ["products", "metadata", "TEXT DEFAULT '{}'"],
      ["stock_adjustments", "date_created", "DATETIME"],
      ["inventory_batches", "notes", "TEXT DEFAULT ''"],
      ["settings", "owner_full_name", "TEXT DEFAULT ''"],
      ["settings", "owner_mobile", "TEXT DEFAULT ''"],
      ["settings", "owner_email", "TEXT DEFAULT ''"],
      ["settings", "owner_username", "TEXT DEFAULT 'admin'"],
      ["settings", "owner_password", "TEXT DEFAULT ''"],
      ["settings", "license_mode", "TEXT DEFAULT 'offline'"],
      ["settings", "approval_status", "TEXT DEFAULT 'approved'"],
      ["settings", "last_online_check", "DATETIME"],
      ["settings", "cloud_backend_url", "TEXT DEFAULT ''"],
      ["settings", "cloud_backend_token", "TEXT DEFAULT ''"],
      ["settings", "cloud_last_sync", "DATETIME"],
      ["settings", "cloud_connected", "INTEGER DEFAULT 0"],
      ["settings", "setup_completed", "INTEGER DEFAULT 0"],
      ["settings", "invoice_style", "TEXT DEFAULT 'thermal'"],
      ["settings", "invoice_notes", "TEXT DEFAULT ''"]];
    for (const [table, col, def] of repairs) {
      try {
        const tableInfo = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND LOWER(name)=LOWER(?)").get(table) as any;
        if (tableInfo) {
          const actualTableName = tableInfo.name;
          const colCheck = database.prepare(`PRAGMA table_info(${actualTableName})`).all() as any[];
          const colNames = colCheck.map(c => c.name.toLowerCase());

          if (actualTableName.toLowerCase() === 'purchase_returns') {
            logger.info(`Columns in purchase_returns: ${colNames.join(', ')}`);
          }

          if (!colNames.includes(col.toLowerCase())) {
            database.exec(`ALTER TABLE ${actualTableName} ADD COLUMN ${col} ${def}`);
            logger.info(`Injected missing column ${col} into ${actualTableName}`);
          }
        }
      } catch (e: any) {
        logger.error(`Repair failed for ${table}.${col}: ${e.message}`);
      }
    }

    // Fill in default values for newly injected date columns (since ALTER TABLE can't use dynamic defaults)
    try {
      database.exec("UPDATE sales SET date_created = datetime('now', 'localtime') WHERE date_created IS NULL");
      database.exec("UPDATE purchases SET date_created = datetime('now', 'localtime') WHERE date_created IS NULL");
      database.exec("UPDATE sale_returns SET date_created = datetime('now', 'localtime') WHERE date_created IS NULL");
      database.exec("UPDATE purchase_returns SET date_created = datetime('now', 'localtime') WHERE date_created IS NULL");
      database.exec("UPDATE registers SET opened_at = datetime('now', 'localtime') WHERE opened_at IS NULL");
      database.exec("UPDATE vendor_payments SET date_created = datetime('now', 'localtime') WHERE date_created IS NULL");
    } catch (e: any) {
      logger.error('Failed to fill null dates:', e.message);
    }

    logger.info('Schema verification completed.');
    logger.info('Performing core table verification...');
    logger.info('All core tables verified.');

    // Create stock_adjustments table if not exists
    database.exec(`
      CREATE TABLE IF NOT EXISTS stock_adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        type TEXT NOT NULL,
        reason TEXT,
        date_created DATETIME,
        FOREIGN KEY(product_id) REFERENCES products(id)
      )
    `);

    return true;
  } catch (e) {
    logger.error('Schema verification failed:', e);
    return false;
  }
}

// Fixed migration system
function migrate(database: Database.Database) {
  try {
    const { user_version: ver } = database.prepare('PRAGMA user_version').get() as { user_version: number };
    logger.info(`Current database version: ${ver}`);

    // Migration 1: Add settings columns
    if (ver < 1) {
      logger.info('Running migration 1 - Adding settings columns...');
      const migrations = [
        `ALTER TABLE settings ADD COLUMN store_address TEXT DEFAULT ''`,
        `ALTER TABLE settings ADD COLUMN receipt_footer TEXT DEFAULT 'Thank you for visiting!'`,
        `ALTER TABLE settings ADD COLUMN pos_password TEXT DEFAULT '1234'`,
      ];
      for (const sql of migrations) {
        try { database.exec(sql); } catch (e) { logger.warn(`Migration 1 warning: ${e}`); }
      }
      database.exec('PRAGMA user_version = 1');
    }

    // Migration 2: Enhance sale_items table
    if (ver < 2) {
      logger.info('Running migration 2 - Enhancing sale_items table...');
      database.exec(`PRAGMA foreign_keys = OFF`);
      try {
        database.exec(`ALTER TABLE sale_items RENAME TO _sale_items_old`);
        database.exec(`
          CREATE TABLE sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            product_id INTEGER,
            product_name TEXT NOT NULL DEFAULT '',
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            is_custom INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE,
            FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
          )
        `);
        database.exec(`
          INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, price, is_custom)
          SELECT id, sale_id, product_id,
            COALESCE(product_name, ''),
            quantity, price,
            COALESCE(is_custom, 0)
          FROM _sale_items_old
        `);
        database.exec(`DROP TABLE _sale_items_old`);

        // Create indexes
        database.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)`);
        database.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id)`);
      } catch (e) {
        logger.error('Migration 2 error:', e);
        throw e;
      }
      database.exec(`PRAGMA foreign_keys = ON`);
      database.exec('PRAGMA user_version = 2');
    }

    // Migration 3: Enhance products table with unique constraint and timestamps
    if (ver < 3) {
      logger.info('Running migration 3 - Enhancing products table...');
      database.exec(`PRAGMA foreign_keys = OFF`);
      try {
        database.exec(`ALTER TABLE products RENAME TO _products_old`);
        database.exec(`
          CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            price REAL NOT NULL CHECK(price > 0),
            category TEXT DEFAULT '',
            created_at DATETIME DEFAULT (datetime('now', 'localtime')),
            updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
          )
        `);
        database.exec(`
          INSERT INTO products (id, name, price, category, created_at, updated_at)
          SELECT id, name, price, COALESCE(category, ''), (datetime('now', 'localtime')), (datetime('now', 'localtime')) 
          FROM _products_old
        `);
        database.exec(`DROP TABLE _products_old`);

        // Create indexes for better performance
        database.exec(`CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`);
        database.exec(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`);
      } catch (e) {
        logger.error('Migration 3 error:', e);
        throw e;
      }
      database.exec(`PRAGMA foreign_keys = ON`);
      database.exec('PRAGMA user_version = 3');
    }

    // Migration 4: Add indexes to sales table
    if (ver < 4) {
      logger.info('Running migration 4 - Adding indexes to sales table...');
      try {
        database.exec(`CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date_created)`);
        database.exec(`CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id)`);
      } catch (e) {
        logger.error('Migration 4 error:', e);
      }
      database.exec('PRAGMA user_version = 4');
    }

    // Migration 5: Add customers table indexes
    if (ver < 5) {
      logger.info('Running migration 5 - Adding customers indexes...');
      try {
        database.exec(`CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)`);
        database.exec(`CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)`);
      } catch (e) {
        logger.error('Migration 5 error:', e);
      }
      database.exec('PRAGMA user_version = 5');
    }

    // Migration 6: Ensure created_at / updated_at exist in all tables if previously bypassed
    if (ver < 6) {
      logger.info('Running migration 6 - Fixing missing columns...');
      const statements = [
        `ALTER TABLE products ADD COLUMN created_at DATETIME DEFAULT (datetime('now', 'localtime'))`,
        `ALTER TABLE products ADD COLUMN updated_at DATETIME DEFAULT (datetime('now', 'localtime'))`,
        `ALTER TABLE sale_items ADD COLUMN created_at DATETIME DEFAULT (datetime('now', 'localtime'))`,
        `ALTER TABLE customers ADD COLUMN created_at DATETIME DEFAULT (datetime('now', 'localtime'))`,
        `ALTER TABLE customers ADD COLUMN updated_at DATETIME DEFAULT (datetime('now', 'localtime'))`,
        `ALTER TABLE sales ADD COLUMN discount REAL DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN tax REAL DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN subtotal REAL DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN payment_status TEXT DEFAULT 'completed'`,
        `ALTER TABLE sales ADD COLUMN notes TEXT`
      ];
      for (const sql of statements) {
        try { database.exec(sql); } catch (e) { /* IGNORE IF COLUMN ALREADY EXISTS */ }
      }
      database.exec('PRAGMA user_version = 6');
    }

    // Migration 7: Add additional missing columns to sales table if bypassed previously
    if (ver < 7) {
      logger.info('Running migration 7 - Adding sales columns...');
      const statements = [
        `ALTER TABLE sales ADD COLUMN discount REAL DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN tax REAL DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN subtotal REAL DEFAULT 0`,
        `ALTER TABLE sales ADD COLUMN payment_status TEXT DEFAULT 'completed'`,
        `ALTER TABLE sales ADD COLUMN notes TEXT`
      ];
      for (const sql of statements) {
        try { database.exec(sql); } catch (e) { /* IGNORE */ }
      }
      database.exec('PRAGMA user_version = 7');
    }

    // Migration 8: Add invoice status
    if (ver < 8) {
      logger.info('Running migration 8 - Adding invoice status...');
      try { database.exec(`ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'Completed'`); } catch (e) { /* IGNORE */ }
      database.exec('PRAGMA user_version = 8');
    }

    // Migration 9: Add updated_at to settings
    if (ver < 9) {
      logger.info('Running migration 9 - Adding updated_at to settings...');
      try { database.exec(`ALTER TABLE settings ADD COLUMN updated_at DATETIME DEFAULT (datetime('now', 'localtime'))`); } catch (e) { /* IGNORE */ }
      database.exec('PRAGMA user_version = 9');
    }

    // Migration 10: Super-Failsafe Column Injection (Products, Sales, Sale Items, Customers)
    if (ver < 10) {
      logger.info('Running migration 10 - Final schema sync...');
      const checks = [
        ["products", "created_at", "DATETIME DEFAULT (datetime('now', 'localtime'))"],
        ["products", "updated_at", "DATETIME DEFAULT (datetime('now', 'localtime'))"],
        ["products", "category", "TEXT DEFAULT ''"],
        ["sales", "subtotal", "REAL DEFAULT 0"],
        ["sales", "discount", "REAL DEFAULT 0"],
        ["sales", "tax", "REAL DEFAULT 0"],
        ["sales", "payment_status", "TEXT DEFAULT 'completed'"],
        ["sales", "notes", "TEXT"],
        ["sales", "status", "TEXT DEFAULT 'Completed'"],
        ["sale_items", "created_at", "DATETIME DEFAULT (datetime('now', 'localtime'))"],
        ["sale_items", "is_custom", "INTEGER DEFAULT 0"],
        ["customers", "created_at", "DATETIME DEFAULT (datetime('now', 'localtime'))"],
        ["customers", "updated_at", "DATETIME DEFAULT (datetime('now', 'localtime'))"]
      ];
      for (const [table, col, def] of checks) {
        try { database.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch (e) { /* Already exists */ }
      }
      database.exec('PRAGMA user_version = 10');
    }

    // Migration 11: REPAIR BROKEN FOREIGN KEYS (Fix for "no such table: main._products_old")
    if (ver < 11) {
      logger.info('Running migration 11 - Repairing broken foreign keys...');
      database.exec('PRAGMA foreign_keys = OFF');
      try {
        // Drop any leftover temporary tables that might cause FK issues
        database.exec(`DROP TABLE IF EXISTS _products_old`);
        database.exec(`DROP TABLE IF EXISTS _sale_items_old`);
        database.exec(`DROP TABLE IF EXISTS _sales_old`);
        database.exec(`DROP TABLE IF EXISTS main_products_old`);

        // Recreate sale_items to ensure its foreign keys to 'products' and 'sales' point to current tables
        database.exec(`ALTER TABLE sale_items RENAME TO _sale_items_repair`);
        database.exec(`
          CREATE TABLE sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            product_id INTEGER,
            product_name TEXT NOT NULL DEFAULT '',
            quantity INTEGER NOT NULL CHECK(quantity > 0),
            price REAL NOT NULL CHECK(price >= 0),
            is_custom INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE,
            FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
          )
        `);
        database.exec(`
          INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, price, is_custom, created_at)
          SELECT id, sale_id, product_id, product_name, quantity, price, is_custom, 
                 COALESCE(created_at, (datetime('now', 'localtime')))
          FROM _sale_items_repair
        `);
        database.exec(`DROP TABLE _sale_items_repair`);

        // Restore indexes
        database.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)`);
        database.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id)`);

        logger.info('Migration 11 completed: sale_items foreign keys repaired.');
      } catch (e) {
        logger.error('Migration 11 failed:', e);
        throw e;
      }
      database.exec('PRAGMA foreign_keys = ON');
      database.exec('PRAGMA user_version = 11');
    }

    // Migration 12: Final Schema Cleanup & Index Verification
    if (ver < 12) {
      logger.info('Running migration 12 - Final schema cleanup...');
      const cleanupStmt = [
        `VACUUM`,
        `ANALYZE`,
        `PRAGMA main.integrity_check`,
        `DROP TABLE IF EXISTS _products_old`,
        `DROP TABLE IF EXISTS _sale_items_old`,
        `DROP TABLE IF EXISTS _sales_old`,
        `DROP TABLE IF EXISTS main_products_old`
      ];
      for (const sql of cleanupStmt) {
        try { database.exec(sql); } catch (e) { logger.warn(`Cleanup notice: ${sql} - ${e}`); }
      }
      database.exec('PRAGMA user_version = 12');
    }

    // Migration 13: Safely ensure updated_at exists on settings
    if (ver < 13) {
      logger.info('Running migration 13 - Final settings fix for updated_at...');
      try { database.exec(`ALTER TABLE settings ADD COLUMN updated_at DATETIME DEFAULT (datetime('now', 'localtime'))`); } catch (e) { /* IGNORE */ }
      database.exec('PRAGMA user_version = 13');
    }

    // Migration 14: Ensure legacy customers have email and address columns
    if (ver < 14) {
      logger.info('Running migration 14 - Injecting missing customer fields...');
      try { database.exec(`ALTER TABLE customers ADD COLUMN email TEXT`); } catch (e) { /* IGNORE */ }
      try { database.exec(`ALTER TABLE customers ADD COLUMN address TEXT`); } catch (e) { /* IGNORE */ }
      database.exec('PRAGMA user_version = 14');
    }

    // Migration 15: Add activation system
    if (ver < 15) {
      logger.info('Running migration 15 - Adding activation system...');
      const settingsCols = [
        ["activation_key", "TEXT DEFAULT ''"],
        ["business_name", "TEXT DEFAULT ''"],
        ["updated_at", "DATETIME DEFAULT (datetime('now', 'localtime'))"]
      ];
      for (const [col, def] of settingsCols) {
        try { database.exec(`ALTER TABLE settings ADD COLUMN ${col} ${def}`); } catch (e) { /* Already exists */ }
      }
      database.exec('PRAGMA user_version = 15');
    }

    // Migration 16: POS Expansion Features
    if (ver < 16) {
      logger.info('Running migration 16 - POS Expansion...');
      try { database.exec(`ALTER TABLE sale_items ADD COLUMN purchase_price REAL DEFAULT 0`); } catch (e) { /* IGNORE */ }
      try {
        database.exec(`
          CREATE TABLE IF NOT EXISTS vendors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            created_at DATETIME DEFAULT (datetime('now', 'localtime'))
          )
        `);
        database.exec(`
          CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id INTEGER,
            total REAL NOT NULL DEFAULT 0,
            date_created DATETIME DEFAULT (datetime('now', 'localtime')),
            status TEXT DEFAULT 'Completed',
            FOREIGN KEY(vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
          )
        `);
        database.exec(`
          CREATE TABLE IF NOT EXISTS inventory_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            vendor_id INTEGER,
            purchase_id INTEGER,
            quantity_added INTEGER NOT NULL,
            quantity_remaining INTEGER NOT NULL,
            purchase_price REAL NOT NULL,
            date_added DATETIME DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY(vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
            FOREIGN KEY(purchase_id) REFERENCES purchases(id) ON DELETE SET NULL
          )
        `);
        database.exec(`
          CREATE TABLE IF NOT EXISTS customer_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            date_added DATETIME DEFAULT (datetime('now', 'localtime')),
            notes TEXT,
            FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
          )
        `);
      } catch (e) { logger.error('Migration 16 error:', e); }
      database.exec('PRAGMA user_version = 16');
    }

    // Migration 17: Add expenses & low_stock_threshold
    if (ver < 17) {
      logger.info('Running migration 17 - Adding expenses & low stock threshold...');
      try {
        database.exec(`
          CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT,
            amount REAL NOT NULL,
            date_added DATETIME DEFAULT (datetime('now', 'localtime')),
            notes TEXT
          )
        `);
        try { database.exec('ALTER TABLE settings ADD COLUMN low_stock_threshold INTEGER DEFAULT 10'); } catch (e) { }
      } catch (e) { logger.error('Migration 17 error:', e); }
      database.exec('PRAGMA user_version = 17');
    }

    // Migration 18: Add purchase_price, stock, and barcode to products
    if (ver < 18) {
      logger.info('Running migration 18 - Adding product details...');
      try { database.exec('ALTER TABLE products ADD COLUMN purchase_price REAL DEFAULT 0'); } catch (e) { }
      try { database.exec('ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0'); } catch (e) { }
      try { database.exec('ALTER TABLE products ADD COLUMN barcode TEXT DEFAULT ""'); } catch (e) { }
      database.exec('PRAGMA user_version = 18');
    }

    // Migration 19: Add receipt_size setting
    if (ver < 19) {
      logger.info('Running migration 19 - Adding receipt_size to settings...');
      try { database.exec(`ALTER TABLE settings ADD COLUMN receipt_size TEXT DEFAULT 'thermal'`); } catch (e) { }
      try { database.exec(`ALTER TABLE settings ADD COLUMN low_stock_threshold INTEGER DEFAULT 10`); } catch (e) { }
      database.exec('PRAGMA user_version = 19');
    }

    // Migration 20: Add unit field to products (e.g. kg, pcs, box)
    if (ver < 20) {
      logger.info('Running migration 20 - Adding unit column to products...');
      try { database.exec(`ALTER TABLE products ADD COLUMN unit TEXT DEFAULT ''`); } catch (e) { }
      database.exec('PRAGMA user_version = 20');
    }

    // Migration 21: Additive Subscription System
    if (ver < 21) {
      logger.info('Running migration 21 - Additive Subscriptions...');
      const settingsCols = [
        ["expiry_date", "TEXT DEFAULT ''"],
        ["used_license_ids", "TEXT DEFAULT '[]'"]
      ];
      for (const [col, def] of settingsCols) {
        try { database.exec(`ALTER TABLE settings ADD COLUMN ${col} ${def}`); } catch (e) { /* Already exists */ }
      }
      database.exec('PRAGMA user_version = 21');
    }

    // Migration 22: Auto-Export Settings
    if (ver < 22) {
      logger.info('Running migration 22 - Adding auto_export_path to settings...');
      try { database.exec(`ALTER TABLE settings ADD COLUMN auto_export_path TEXT DEFAULT ''`); } catch (e) { }
      try { database.exec(`ALTER TABLE settings ADD COLUMN auto_export_enabled INTEGER DEFAULT 0`); } catch (e) { }
      database.exec('PRAGMA user_version = 22');
    }

    // Migration 23: Add last_auto_export to settings
    if (ver < 23) {
      logger.info('Running migration 23 - Adding last_auto_export to settings...');
      try { database.exec(`ALTER TABLE settings ADD COLUMN last_auto_export DATETIME`); } catch (e) { }
      database.exec('PRAGMA user_version = 23');
    }

    // Migration 24: Add bill-to-bill tracking columns
    if (ver < 24) {
      logger.info('Running migration 24 - Adding bill-to-bill tracking columns...');
      try { database.exec(`ALTER TABLE customer_payments ADD COLUMN sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL`); } catch (e) { }
      try { database.exec(`ALTER TABLE vendor_payments ADD COLUMN purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL`); } catch (e) { }
      database.exec('PRAGMA user_version = 24');
    }

    // Migration 25: Nuclear ghost table cleanup
    if (ver < 25) {
      logger.info('Running migration 25 - Nuclear ghost cleanup...');
      try {
        database.exec('PRAGMA foreign_keys = OFF');
        const ghosts = ['_products_old', '_sale_items_old', '_sales_old', '_sale_items_repair', '_sale_return_items_old', 'main._products_old'];
        for (const ghost of ghosts) {
          try { database.exec(`DROP TABLE IF EXISTS "${ghost}"`); } catch (e) { }
        }
        // Rebuild sale_items indexes fresh
        try {
          database.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id)`);
          database.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id)`);
        } catch (e) { }
        database.exec('PRAGMA foreign_keys = ON');
        database.exec('PRAGMA integrity_check');
        database.exec('PRAGMA user_version = 25');
      } catch (e) {
        logger.error('Migration 25 error:', e);
      }
    }

    // Migration 26: Add invoice_style and invoice_notes to settings
    if (ver < 26) {
      logger.info('Running migration 26 - Adding invoice_style and invoice_notes to settings...');
      try { database.exec(`ALTER TABLE settings ADD COLUMN invoice_style TEXT DEFAULT 'thermal'`); } catch (e) { /* Already exists */ }
      try { database.exec(`ALTER TABLE settings ADD COLUMN invoice_notes TEXT DEFAULT ''`); } catch (e) { /* Already exists */ }
      database.exec('PRAGMA user_version = 26');
    }

    // Migration 27: Accounts module (cash in hand, bank accounts, cash flow tracking)
    if (ver < 27) {
      logger.info('Running migration 27 - Adding accounts module...');
      try {
        database.exec(`
          CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT DEFAULT 'cash',
            opening_balance REAL DEFAULT 0,
            current_balance REAL DEFAULT 0,
            bank_name TEXT DEFAULT '',
            account_number TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            is_default INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT (datetime('now', 'localtime'))
          )
        `);
        database.exec(`
          CREATE TABLE IF NOT EXISTS account_txns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT DEFAULT '',
            note TEXT DEFAULT '',
            date_created DATETIME DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
          )
        `);
        // Create default Cash in Hand account (idempotent)
        database.prepare(`
          INSERT OR IGNORE INTO accounts (id, name, type, opening_balance, current_balance, is_default)
          VALUES (1, 'Cash in Hand', 'cash', 0, 0, 1)
        `).run();
      } catch (e: any) { logger.error('Migration 27 error:', e.message); }
      database.exec('PRAGMA user_version = 27');
    }

    // Migration 28: Bakery module + module feature flags
    if (ver < 28) {
      logger.info('Running migration 28 - Adding bakery module support...');
      const m28 = [
        `ALTER TABLE settings ADD COLUMN bakery_module_enabled INTEGER DEFAULT 0`,
        `ALTER TABLE settings ADD COLUMN accounting_module_enabled INTEGER DEFAULT 0`,
        `ALTER TABLE products ADD COLUMN is_bakery INTEGER DEFAULT 0`,
        `ALTER TABLE products ADD COLUMN production_date TEXT DEFAULT NULL`,
        `ALTER TABLE products ADD COLUMN expiry_date TEXT DEFAULT NULL`,
        `ALTER TABLE products ADD COLUMN weight_value REAL DEFAULT NULL`,
        `ALTER TABLE products ADD COLUMN unit_type TEXT DEFAULT 'piece'`,
        `ALTER TABLE products ADD COLUMN price_per_kg REAL DEFAULT NULL`,
        `ALTER TABLE products ADD COLUMN auto_price_by_weight INTEGER DEFAULT 0`,
      ];
      for (const sql of m28) {
        try { database.exec(sql); } catch (e) { logger.warn(`Migration 28: ${e}`); }
      }
      database.exec('PRAGMA user_version = 28');
    }

    logger.info(`Database migration completed. Current version: ${database.pragma('user_version', { simple: true })}`);
  } catch (error) {
    logger.error('Migration system failed:', error);
    throw error;
  }
}

function repairGhostForeignKeys(database: Database.Database) {
  const tablesToRepair = [
    {
      name: 'inventory_batches',
      createSql: `
        CREATE TABLE inventory_batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL,
          vendor_id INTEGER,
          purchase_id INTEGER,
          quantity_added INTEGER NOT NULL,
          quantity_remaining INTEGER NOT NULL,
          purchase_price REAL NOT NULL,
          date_added DATETIME DEFAULT (datetime('now', 'localtime')),
          notes TEXT DEFAULT '',
          FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
          FOREIGN KEY(vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
          FOREIGN KEY(purchase_id) REFERENCES purchases(id) ON DELETE SET NULL
        )
      `
    },
    {
      name: 'sale_return_items',
      createSql: `
        CREATE TABLE sale_return_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          return_id INTEGER NOT NULL,
          sale_item_id INTEGER,
          product_id INTEGER,
          product_name TEXT,
          quantity INTEGER NOT NULL,
          price REAL NOT NULL,
          FOREIGN KEY(return_id) REFERENCES sale_returns(id) ON DELETE CASCADE,
          FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
        )
      `
    },
    {
      name: 'purchase_return_items',
      createSql: `
        CREATE TABLE purchase_return_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          return_id INTEGER NOT NULL,
          product_id INTEGER,
          product_name TEXT,
          quantity INTEGER NOT NULL,
          purchase_price REAL NOT NULL,
          FOREIGN KEY(return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
          FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
        )
      `
    }
  ];

  for (const t of tablesToRepair) {
    try {
      const fks = database.prepare(`PRAGMA foreign_key_list("${t.name}")`).all() as any[];
      const hasGhostRef = fks.some((fk) => String(fk.table || '').toLowerCase().includes('_products_old'));
      if (!hasGhostRef) continue;

      logger.warn(`Detected ghost FK in ${t.name}. Rebuilding table...`);
      database.exec('PRAGMA foreign_keys = OFF');

      const backupName = `__${t.name}_fix_old`;
      database.exec(`ALTER TABLE "${t.name}" RENAME TO "${backupName}"`);
      database.exec(t.createSql);

      const cols = (database.prepare(`PRAGMA table_info("${backupName}")`).all() as any[]).map((c) => c.name);
      if (cols.length > 0) {
        const colCsv = cols.map((c) => `"${c}"`).join(',');
        database.exec(`INSERT INTO "${t.name}" (${colCsv}) SELECT ${colCsv} FROM "${backupName}"`);
      }

      database.exec(`DROP TABLE "${backupName}"`);
      database.exec('PRAGMA foreign_keys = ON');
      logger.info(`Rebuilt ${t.name} successfully to remove ghost FK refs.`);
    } catch (err) {
      logger.error(`Failed FK ghost repair for table ${t.name}:`, err);
      try { database.exec('PRAGMA foreign_keys = ON'); } catch { }
    }
  }
}

function initializeDatabase() {
  try {
    const dbPath = path.join(app.getPath('userData'), 'pos.db');
    logger.info(`Initializing database at: ${dbPath}`);

    // Ensure the directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(dbPath);

    // Optimize database settings
    db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
    db.pragma('synchronous = NORMAL'); // Good balance between safety and performance
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.pragma('cache_size = -64000'); // 64MB cache
    db.pragma('temp_store = MEMORY');

    // Self-healing / Maintenance
    try {
      // Force drop ALL ghost tables
      const ghostTables = ['_products_old', '_sale_items_old', '_sales_old', 'main._products_old', '_sale_return_items_old', '_sale_items_repair'];
      for (const ghost of ghostTables) {
        try { db!.exec(`DROP TABLE IF EXISTS "${ghost}"`); } catch (e) { }
      }

      // Drop any views or triggers referencing ghost tables
      const brokenObjects = db!.prepare(`
        SELECT name, type FROM sqlite_master 
        WHERE type IN ('trigger', 'view') 
        AND (sql LIKE '%_products_old%' OR sql LIKE '%_sale_items_old%')
      `).all() as any[];
      for (const obj of brokenObjects) {
        try { db!.exec(`DROP ${obj.type.toUpperCase()} IF EXISTS "${obj.name}"`); } catch (e) { }
      }

      // Rebuild tables that have ghost references in their SQL
      const tablesToRebuild = ['inventory_batches', 'sale_return_items', 'purchase_return_items', 'sale_items'];
      for (const tableName of tablesToRebuild) {
        const t = db!.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(tableName) as any;
        if (t && t.sql && t.sql.includes('_products_old')) {
          logger.info(`Rebuilding table ${tableName} to fix ghost reference...`);
          try {
            db!.exec('PRAGMA foreign_keys = OFF');
            // 1. Get existing data
            const data = db!.prepare(`SELECT * FROM ${tableName}`).all() as any[];
            // 2. Drop old table
            db!.exec(`DROP TABLE "${tableName}"`);
            // 3. Create fresh table with correct SQL (this will use the CREATE TABLE from initializeDatabase later, 
            // but for now we just run the correct CREATE here to be safe)
            let newSql = t.sql.replace(/"_products_old"/g, 'products').replace(/_products_old/g, 'products');
            db!.exec(newSql);
            // 4. Restore data
            if (data.length > 0) {
              const columns = Object.keys(data[0]);
              const placeholders = columns.map(() => '?').join(',');
              const insertStmt = db!.prepare(`INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`);
              for (const row of data) {
                insertStmt.run(Object.values(row));
              }
            }
            db!.exec('PRAGMA foreign_keys = ON');
            logger.info(`Table ${tableName} rebuilt successfully.`);
          } catch (err) {
            logger.error(`Failed to rebuild ${tableName}:`, err);
            db!.exec('PRAGMA foreign_keys = ON');
          }
        }
      }

      db!.exec("VACUUM");
      db!.exec("REINDEX");
    } catch (e) {
      logger.warn('Maintenance tasks skipped:', e);
    }

    logger.info('Database pragmas configured');

    // Structural migrations that need to run regardless of version
    try { db!.prepare("ALTER TABLE sale_return_items ADD COLUMN sale_item_id INTEGER").run(); } catch (e) { }
    try { db!.prepare("ALTER TABLE sales ADD COLUMN register_id INTEGER").run(); } catch (e) { }
    try { db!.prepare("CREATE INDEX IF NOT EXISTS idx_sale_return_items_sid ON sale_return_items(sale_item_id)").run(); } catch (e) { }

    // Check current version
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        store_name TEXT DEFAULT 'Retailer Shop',
        store_phone TEXT DEFAULT '',
        store_address TEXT DEFAULT '',
        store_logo TEXT DEFAULT '',
        owner_full_name TEXT DEFAULT '',
        owner_mobile TEXT DEFAULT '',
        owner_email TEXT DEFAULT '',
        owner_username TEXT DEFAULT 'admin',
        owner_password TEXT DEFAULT '',
        license_mode TEXT DEFAULT 'offline',
        approval_status TEXT DEFAULT 'approved',
        last_online_check DATETIME,
        cloud_backend_url TEXT DEFAULT '',
        cloud_backend_token TEXT DEFAULT '',
        cloud_last_sync DATETIME,
        cloud_connected INTEGER DEFAULT 0,
        setup_completed INTEGER DEFAULT 0,
        receipt_footer TEXT DEFAULT 'Thank you for visiting!',
        pos_password TEXT DEFAULT '1234',
        activation_key TEXT DEFAULT '',
        business_name TEXT DEFAULT '',
        auto_export_path TEXT DEFAULT '',
        auto_export_enabled INTEGER DEFAULT 0,
        last_auto_export DATETIME,
        updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );
      INSERT OR IGNORE INTO settings (id) VALUES (1);

      CREATE TABLE IF NOT EXISTS cloud_sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT DEFAULT '',
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        price REAL NOT NULL CHECK(price > 0),
        purchase_price REAL DEFAULT 0,
        stock INTEGER DEFAULT 0,
        barcode TEXT DEFAULT '',
        category TEXT DEFAULT '',
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        total REAL NOT NULL CHECK(total >= 0),
        discount REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        subtotal REAL DEFAULT 0,
        date_created DATETIME DEFAULT (datetime('now', 'localtime')),
        payment_method TEXT DEFAULT 'cash',
        payment_status TEXT DEFAULT 'completed',
        status TEXT DEFAULT 'Completed',
        notes TEXT,
        register_id INTEGER,
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name TEXT NOT NULL DEFAULT '',
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        price REAL NOT NULL CHECK(price >= 0),
        purchase_price REAL DEFAULT 0,
        is_custom INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS vendors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS vendor_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        date_created DATETIME DEFAULT (datetime('now', 'localtime')),
        notes TEXT,
        FOREIGN KEY(vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_id INTEGER,
        total REAL NOT NULL DEFAULT 0,
        date_created DATETIME DEFAULT (datetime('now', 'localtime')),
        status TEXT DEFAULT 'Completed',
        register_id INTEGER,
        FOREIGN KEY(vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS inventory_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        vendor_id INTEGER,
        purchase_id INTEGER,
        quantity_added INTEGER NOT NULL,
        quantity_remaining INTEGER NOT NULL,
        purchase_price REAL NOT NULL,
        date_added DATETIME DEFAULT (datetime('now', 'localtime')),
        notes TEXT DEFAULT '',
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY(vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
        FOREIGN KEY(purchase_id) REFERENCES purchases(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS customer_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        date_added DATETIME DEFAULT (datetime('now', 'localtime')),
        notes TEXT,
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS registers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opened_at DATETIME DEFAULT (datetime('now', 'localtime')),
        closed_at DATETIME,
        opening_balance REAL DEFAULT 0,
        actual_cash REAL DEFAULT 0,
        status TEXT DEFAULT 'open',
        opened_by TEXT,
        closed_by TEXT,
        notes TEXT,
        opening_time DATETIME
      );

      CREATE TABLE IF NOT EXISTS financial_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        category TEXT,
        amount REAL,
        description TEXT,
        register_id INTEGER,
        date_created DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(register_id) REFERENCES registers(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS sale_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        total_returned REAL DEFAULT 0,
        reason TEXT,
        notes TEXT,
        date_created DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sale_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER NOT NULL,
        sale_item_id INTEGER,
        product_id INTEGER,
        product_name TEXT,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY(return_id) REFERENCES sale_returns(id) ON DELETE CASCADE,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS purchase_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER NOT NULL,
        total_returned REAL DEFAULT 0,
        reason TEXT,
        notes TEXT,
        date_created DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS purchase_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name TEXT,
        quantity INTEGER NOT NULL,
        purchase_price REAL NOT NULL,
        FOREIGN KEY(return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT,
        amount REAL NOT NULL,
        date_added DATETIME DEFAULT (datetime('now', 'localtime')),
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS entity_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        history_type TEXT NOT NULL,
        amount REAL DEFAULT 0,
        related_record_id INTEGER,
        related_record_type TEXT,
        notes TEXT,
        action_status TEXT DEFAULT 'COMPLETED',
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );
      
      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date_created);
      CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
      CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
      CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
      CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
      CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
      CREATE INDEX IF NOT EXISTS idx_entity_history_entity ON entity_history(entity_type, entity_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_customer_payments_date ON customer_payments(date_added);
      CREATE INDEX IF NOT EXISTS idx_vendor_payments_date ON vendor_payments(date_created);
      CREATE INDEX IF NOT EXISTS idx_purchase_returns_date ON purchase_returns(date_created);
      CREATE INDEX IF NOT EXISTS idx_sale_returns_date ON sale_returns(date_created);
      CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date_created);

      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'cash',
        opening_balance REAL DEFAULT 0,
        current_balance REAL DEFAULT 0,
        bank_name TEXT DEFAULT '',
        account_number TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS account_txns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT DEFAULT '',
        note TEXT DEFAULT '',
        date_created DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_account_txns_account ON account_txns(account_id, date_created);
      CREATE INDEX IF NOT EXISTS idx_account_txns_date ON account_txns(date_created);
    `);

    // Run migrations
    db.exec('PRAGMA foreign_keys = OFF');
    migrate(db);
    db.exec('PRAGMA foreign_keys = ON');

    // Extra repair pass for hidden FK metadata that can still reference _products_old
    repairGhostForeignKeys(db);

    // Final integrity check
    if (!checkDatabaseSchema(db)) {
      throw new Error('Database schema verification failed after migrations');
    }

    logger.info('Database initialized and verified successfully');

    // Initialize License Manager using the shared DB connection
    licenseManager = new LicenseManager(db!);
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}
function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('Looking for preload at:', preloadPath);
  console.log('Preload exists:', require('fs').existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window loaded');
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        shell.openExternal(url);
      }
    } catch {
      logger.warn('Blocked invalid external URL');
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!mainWindow) return;
    const current = mainWindow.webContents.getURL();
    if (url !== current) {
      event.preventDefault();
    }
  });

  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    logger.info('Window ready and shown');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // --- THIS WAS THE MISSING BRACE ---
  mainWindow?.webContents.on('render-process-gone', (event: any, details: any) => {
    logger.error('Render process gone:', details);
  });
}

async function triggerAutoExport(force = false) {
  if (!db) return;
  try {
    const settings = db.prepare('SELECT auto_export_path, auto_export_enabled FROM settings WHERE id = 1').get() as any;
    if (!force && (!settings?.auto_export_enabled || !settings?.auto_export_path)) return;
    if (force && !settings?.auto_export_path) throw new Error('No backup path configured');

    if (!fs.existsSync(settings.auto_export_path)) {
      logger.warn(`Auto-export path does not exist: ${settings.auto_export_path}`);
      return;
    }

    const data = {
      settings: db.prepare('SELECT * FROM settings').all(),
      products: db.prepare('SELECT * FROM products').all(),
      customers: db.prepare('SELECT * FROM customers').all(),
      sales: db.prepare('SELECT * FROM sales').all(),
      sale_items: db.prepare('SELECT * FROM sale_items').all(),
      vendors: db.prepare('SELECT * FROM vendors').all(),
      purchases: db.prepare('SELECT * FROM purchases').all(),
      inventory_batches: db.prepare('SELECT * FROM inventory_batches').all(),
      customer_payments: db.prepare('SELECT * FROM customer_payments').all(),
      expenses: db.prepare('SELECT * FROM expenses').all(),
      registers: db.prepare('SELECT * FROM registers').all(),
      sale_returns: db.prepare('SELECT * FROM sale_returns').all(),
      sale_return_items: db.prepare('SELECT * FROM sale_return_items').all(),
      purchase_returns: db.prepare('SELECT * FROM purchase_returns').all(),
      purchase_return_items: db.prepare('SELECT * FROM purchase_return_items').all(),
      vendor_payments: db.prepare('SELECT * FROM vendor_payments').all(),
      financial_transactions: db.prepare('SELECT * FROM financial_transactions').all(),
      export_date: new Date().toISOString(),
      version: '1.2'
    };

    const exportFilePath = path.join(settings.auto_export_path, 'pos_auto_backup.json');
    fs.writeFileSync(exportFilePath, JSON.stringify(data, null, 2), 'utf8');
    logger.info(`Auto-export completed to: ${exportFilePath}`);

    if (mainWindow) {
      mainWindow.webContents.send('auto-export-complete', { success: true, path: exportFilePath });
    }

    db.prepare("UPDATE settings SET last_auto_export = datetime('now', 'localtime') WHERE id = 1").run();
  } catch (error) {
    logger.error('Auto-export failed:', error);
  }
}

// ============= BACKGROUND TASKS =============

function startBackgroundTasks() {
  try {
    const dbPath = path.join(app.getPath('userData'), 'pos.db');
    backupService.scheduleWeeklyBackup(dbPath);
    backupService.processQueue();

    // Check for auto-export every 30 minutes
    setInterval(async () => {
      if (!db) return;
      try {
        const settings = db.prepare('SELECT auto_export_path, auto_export_enabled, last_auto_export FROM settings WHERE id = 1').get() as any;
        if (!settings?.auto_export_enabled || !settings?.auto_export_path) return;

        const lastExport = settings.last_auto_export ? new Date(settings.last_auto_export) : new Date(0);
        const fiveHoursInMs = 5 * 60 * 60 * 1000;
        const now = new Date();

        if (now.getTime() - lastExport.getTime() >= fiveHoursInMs) {
          logger.info('Starting scheduled 5-hour auto-backup...');
          await triggerAutoExport();
        }
      } catch (err) {
        logger.error('Background auto-export check failed:', err);
      }
    }, 30 * 60 * 1000); // 30 minutes check
  } catch (error) {
    logger.error('Failed to start background tasks:', error);
  }
}

// ============= EVENT LISTENERS =============

// --- ACTIVATION LOGIC ---
// License Format: Base64 JSON { businessName, plan, durationDays, licenseId }
function verifyActivationKey(name: string, key: string): { valid: boolean, license: any } {
  if (!name || !key) return { valid: false, license: null };
  try {
    const decoded = Buffer.from(key, 'base64').toString('utf8');
    const license = JSON.parse(decoded);

    // New JSON System Validation
    if (license.businessName && license.businessName.toLowerCase() === name.toLowerCase() && license.durationDays) {
      return { valid: true, license };
    } else {
      logger.warn('License name mismatch or missing duration: Expected ' + name + ', Got ' + license.businessName + '. Duration: ' + license.durationDays);
    }

    return { valid: false, license: null };
  } catch (e) {
    logger.debug('Key is not valid JSON Base64, trying legacy MD5 fallback...');
    // If JSON parsing fails, try old MD5 method as fallback
    try {
      const cleanName = name.trim().toLowerCase();
      const firstName = cleanName.split(/\s+/)[0].replace(/[^a-z0-9]/g, '');
      const parts = key.split('-');
      if (parts.length === 3) {
        const year = parts[1];
        const hash = crypto.createHash('md5').update(cleanName).digest('hex').substring(0, 4);
        if (key === (firstName + '-' + year + '-' + hash)) {
          logger.info('Legacy MD5 license verified.');
          return { valid: true, license: { plan: 'lifetime', isLegacy: true } };
        }
      }
    } catch { return { valid: false, license: null }; }
    return { valid: false, license: null };
  }
}

ipcMain.handle('is-activated', async () => {
  try {
    if (!db || !licenseManager) {
      logger.error('is-activated: Systems not initialized');
      throw new Error('Systems not initialized');
    }

    // Check V2 system first
    const v2Result = await licenseManager.validateLocalLicense();
    if (v2Result.valid) {
      logger.info('is-activated: V2 license valid');
      return { success: true, activated: true, license: v2Result.data };
    } else {
      logger.info('is-activated: V2 license invalid. Reason: ' + v2Result.reason);
    }

    // Fallback to legacy check
    const settings = db.prepare('SELECT activation_key, business_name, expiry_date FROM settings WHERE id = 1').get() as any;

    if (!settings || !settings.activation_key || !settings.business_name) {
      logger.info('is-activated: No legacy license found in settings');
      return { success: true, activated: false, license: null };
    }

    const { valid, license } = verifyActivationKey(settings.business_name, settings.activation_key);

    if (valid && license && !license.isLegacy) {
      if (settings.expiry_date) {
        license.expiry = settings.expiry_date;
      }
    }

    logger.info('is-activated: Legacy check result: ' + valid);
    return { success: true, activated: valid, license };
  } catch (error: any) {
    logger.error('is-activated: Failed with error: ' + error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('activate-app', async (_, { businessName, activationKey }: { businessName: string, activationKey: string }) => {
  try {
    if (!db) throw new Error('Database not initialized');

    const { valid, license } = verifyActivationKey(businessName, activationKey);
    if (!valid) {
      throw new Error('Invalid activation key for this business name');
    }

    const settings = db.prepare('SELECT expiry_date, used_license_ids FROM settings WHERE id = 1').get() as any;

    if (license.isLegacy) {
      db.prepare('UPDATE settings SET business_name = ?, activation_key = ? WHERE id = 1')
        .run(businessName, activationKey);
      logger.info('Legacy app activated for: ' + businessName);
      return { success: true };
    }

    // Additive logic for new JSON keys
    let usedIds: string[] = [];
    try { usedIds = JSON.parse(settings.used_license_ids || '[]'); } catch (e) { }

    if (usedIds.includes(license.licenseId)) {
      throw new Error('This license key has already been used.');
    }

    usedIds.push(license.licenseId);

    const now = new Date();
    let currentExpiry: Date;

    if (!settings.expiry_date || settings.expiry_date === 'lifetime') {
      currentExpiry = now;
    } else {
      currentExpiry = new Date(settings.expiry_date);
      if (isNaN(currentExpiry.getTime()) || currentExpiry < now) {
        currentExpiry = now;
      }
    }

    currentExpiry.setDate(currentExpiry.getDate() + license.durationDays);
    const newExpiryIso = currentExpiry.toISOString();

    db.prepare('UPDATE settings SET business_name = ?, activation_key = ?, expiry_date = ?, used_license_ids = ? WHERE id = 1')
      .run(businessName, activationKey, newExpiryIso, JSON.stringify(usedIds));

    logger.info('App activated for: ' + businessName + '. Added ' + license.durationDays + ' days. New expiry: ' + newExpiryIso);
    return { success: true };
  } catch (error: any) {
    logger.error('Activation failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-fingerprint', async () => {
  try {
    if (!licenseManager) throw new Error('License manager not initialized');
    const fingerprint = await licenseManager.getDeviceFingerprint();
    return { success: true, data: fingerprint };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('activate-app-v2', async (_, licenseKey: string) => {
  try {
    if (!licenseManager) throw new Error('License manager not initialized');
    logger.info('activate-app-v2: Attempting activation...');
    const result = await licenseManager.activateLicense(licenseKey);
    if (result.success) {
      logger.info('activate-app-v2: Activation successful');
    } else {
      logger.error('activate-app-v2: Activation failed. Error: ' + result.error);
    }
    return result;
  } catch (error: any) {
    logger.error('activate-app-v2: Fatal error: ' + error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-local-license', async () => {
  try {
    if (!licenseManager) throw new Error('License manager not initialized');
    licenseManager.clearLicense();
    logger.info('clear-local-license: local license cleared by cloud revocation');
    return { success: true };
  } catch (error: any) {
    logger.error('clear-local-license: ' + error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('generate-license-key', async (_, data: any) => {
  try {
    if (!licenseManager) throw new Error('License manager not initialized');
    const license = licenseManager.buildLicense({
      issuedTo: data?.issuedTo || data?.businessName || '',
      issuedForFingerprint: data?.issuedForFingerprint || data?.fingerprint || '',
      durationValue: Number(data?.durationValue || 1),
      durationUnit: data?.durationUnit || 'days',
      maxDevices: Number(data?.maxDevices || 1)
    });
    const licenseKey = licenseManager.encryptLicense(license);
    return { success: true, data: licenseKey };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ============= PRODUCT HANDLERS =============

ipcMain.handle('get-products', async () => {
  try {
    if (!db) throw new Error('Database not initialized');
    const products = db.prepare('SELECT * FROM products ORDER BY name').all().map((p: any) => {
      try {
        if (p.metadata && typeof p.metadata === 'string') {
          p.metadata = JSON.parse(p.metadata);
        }
      } catch (e) {
        p.metadata = {};
      }
      return p;
    });
    logger.debug(`Retrieved ${products.length} products`);
    return { success: true, data: products };
  } catch (error: any) {
    logger.error('Failed to get products:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-product', async (_, product: { name: string; price: number; category?: string; purchase_price?: number; stock?: number; barcode?: string; unit?: string }) => {
  try {
    if (!db) throw new Error('Database not initialized');

    if (!product.name?.trim()) throw new Error('Product name is required');
    const price = Number(product.price);
    if (isNaN(price) || price <= 0) throw new Error('Price must be a positive number');
    if (price > 9999999) throw new Error('Price is too high');

    const existing = db.prepare('SELECT id FROM products WHERE name = ?').get(product.name.trim());
    if (existing) throw new Error(`Product "${product.name}" already exists`);

    const stmt = db.prepare(`
      INSERT INTO products (name, price, category, purchase_price, stock, barcode, unit, product_type, metadata,
        is_bakery, production_date, expiry_date, weight_value, unit_type, price_per_kg, auto_price_by_weight,
        created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (datetime('now', 'localtime')), (datetime('now', 'localtime')))
    `);
    const info = stmt.run(
      product.name.trim(),
      price,
      product.category?.trim() || '',
      product.purchase_price || 0,
      product.stock || 0,
      product.barcode?.trim() || '',
      product.unit?.trim() || '',
      (product as any).product_type || 'general',
      typeof (product as any).metadata === 'object' ? JSON.stringify((product as any).metadata) : ((product as any).metadata || '{}'),
      (product as any).is_bakery ? 1 : 0,
      (product as any).production_date || null,
      (product as any).expiry_date || null,
      (product as any).weight_value != null ? Number((product as any).weight_value) : null,
      (product as any).unit_type || 'piece',
      (product as any).price_per_kg != null ? Number((product as any).price_per_kg) : null,
      (product as any).auto_price_by_weight ? 1 : 0,
    );

    const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
    logger.info(`Product added: ${product.name} (ID: ${info.lastInsertRowid})`);

    // Enqueue for cloud sync
    try {
      db.prepare(`INSERT INTO cloud_sync_queue (entity_type, operation, payload, status) VALUES ('product', 'create', ?, 'pending')`).run(JSON.stringify(newProduct));
    } catch (syncErr: any) { logger.warn('Sync enqueue (add-product) failed:', syncErr.message); }

    return { success: true, data: newProduct };
  } catch (error: any) {
    logger.error('Failed to add product:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-product', async (_, id: number, product: { name: string; price: number; category?: string; purchase_price?: number; stock?: number; barcode?: string; unit?: string }) => {
  try {
    if (!db) throw new Error('Database not initialized');
    if (!id || id <= 0) throw new Error('Invalid product ID');

    if (!product.name?.trim()) throw new Error('Product name is required');
    const price = Number(product.price);
    if (isNaN(price) || price <= 0) throw new Error('Price must be a positive number');

    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!existing) throw new Error('Product not found');

    const duplicate = db.prepare('SELECT id FROM products WHERE name = ? AND id != ?').get(product.name.trim(), id);
    if (duplicate) throw new Error(`Product "${product.name}" already exists`);

    const stmt = db.prepare(`
      UPDATE products
      SET name = ?, price = ?, category = ?, purchase_price = ?, stock = ?, barcode = ?, unit = ?, product_type = ?, metadata = ?,
          is_bakery = ?, production_date = ?, expiry_date = ?, weight_value = ?, unit_type = ?, price_per_kg = ?, auto_price_by_weight = ?,
          updated_at = (datetime('now', 'localtime'))
      WHERE id = ?
    `);
    stmt.run(
      product.name.trim(),
      price,
      product.category?.trim() || '',
      product.purchase_price || 0,
      product.stock || 0,
      product.barcode?.trim() || '',
      product.unit?.trim() || '',
      (product as any).product_type || 'general',
      typeof (product as any).metadata === 'object' ? JSON.stringify((product as any).metadata) : ((product as any).metadata || '{}'),
      (product as any).is_bakery ? 1 : 0,
      (product as any).production_date || null,
      (product as any).expiry_date || null,
      (product as any).weight_value != null ? Number((product as any).weight_value) : null,
      (product as any).unit_type || 'piece',
      (product as any).price_per_kg != null ? Number((product as any).price_per_kg) : null,
      (product as any).auto_price_by_weight ? 1 : 0,
      id
    );

    const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    logger.info(`Product updated: ${product.name} (ID: ${id})`);

    // Enqueue for cloud sync
    try {
      db.prepare(`INSERT INTO cloud_sync_queue (entity_type, operation, payload, status) VALUES ('product', 'update', ?, 'pending')`).run(JSON.stringify(updatedProduct));
    } catch (syncErr: any) { logger.warn('Sync enqueue (update-product) failed:', syncErr.message); }

    return { success: true, data: updatedProduct };
  } catch (error: any) {
    logger.error('Failed to update product:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-product', async (_, id: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    if (!id || id <= 0) throw new Error('Invalid product ID');

    const product = db.prepare('SELECT name FROM products WHERE id = ?').get(id);
    if (!product) throw new Error('Product not found');

    const usage = db.prepare('SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?').get(id) as any;
    if (usage.count > 0) {
      throw new Error(`Cannot delete product "${(product as any).name}" as it's used in ${usage.count} sale(s)`);
    }

    const stmt = db.prepare('DELETE FROM products WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) throw new Error('Product not found or already deleted');

    logger.info(`Product deleted: ${(product as any).name} (ID: ${id})`);

    // Enqueue for cloud sync
    try {
      db.prepare(`INSERT INTO cloud_sync_queue (entity_type, operation, payload, status) VALUES ('product', 'delete', ?, 'pending')`).run(JSON.stringify({ id }));
    } catch (syncErr: any) { logger.warn('Sync enqueue (delete-product) failed:', syncErr.message); }

    return { success: true };
  } catch (error: any) {
    logger.error('Failed to delete product:', error);
    return { success: false, error: error.message };
  }
});

// ============= SETTINGS HANDLERS =============

ipcMain.handle('get-settings', async () => {
  try {
    if (!db) throw new Error('Database not initialized');
    db.prepare(`
      UPDATE settings
      SET
        owner_full_name = COALESCE(owner_full_name, ''),
          owner_mobile = COALESCE(owner_mobile, ''),
          owner_email = COALESCE(owner_email, ''),
          owner_username = COALESCE(NULLIF(owner_username, ''), 'admin'),
          owner_password = COALESCE(owner_password, ''),
          license_mode = COALESCE(NULLIF(license_mode, ''), 'offline'),
          approval_status = COALESCE(NULLIF(approval_status, ''), 'approved'),
          cloud_backend_url = COALESCE(cloud_backend_url, ''),
          cloud_backend_token = COALESCE(cloud_backend_token, ''),
          cloud_connected = COALESCE(cloud_connected, 0),
          setup_completed = COALESCE(setup_completed, 0),
          store_name = COALESCE(NULLIF(store_name, ''), 'Retailer Shop'),
          store_phone = COALESCE(store_phone, ''),
          store_address = COALESCE(store_address, ''),
          invoice_style = COALESCE(NULLIF(invoice_style, ''), 'thermal'),
          invoice_notes = COALESCE(invoice_notes, ''),
          bakery_module_enabled    = COALESCE(bakery_module_enabled, 0),
          accounting_module_enabled = COALESCE(accounting_module_enabled, 0)
      WHERE id = 1
    `).run();
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    return { success: true, data: settings };
  } catch (error: any) {
    logger.error('Failed to get settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-settings', async (_, settings: any) => {
  try {
    if (!db) throw new Error('Database not initialized');

    const stmt = db.prepare(`
      UPDATE settings 
      SET store_name = ?, 
          store_phone = ?, 
          store_address = ?, 
          store_logo = ?, 
          receipt_footer = ?, 
          pos_password = ?,
          receipt_size = ?,
          low_stock_threshold = ?,
          auto_export_path = ?,
          auto_export_enabled = ?,
          owner_full_name = ?,
          owner_mobile = ?,
          owner_email = ?,
          owner_password = ?,
          license_mode = ?,
          approval_status = ?,
          last_online_check = ?,
          cloud_backend_url = ?,
          cloud_backend_token = ?,
          cloud_last_sync = ?,
          cloud_connected = ?,
          setup_completed = ?,
          business_name = ?,
          activation_key = ?,
          invoice_style = ?,
          invoice_notes = ?
      WHERE id = 1
    `);

    const existing = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;

    stmt.run(
      settings.store_name ?? existing?.store_name ?? 'Retailer Shop',
      settings.store_phone ?? existing?.store_phone ?? '',
      settings.store_address ?? existing?.store_address ?? '',
      settings.store_logo ?? existing?.store_logo ?? '',
      settings.receipt_footer ?? existing?.receipt_footer ?? 'Thank you for visiting!',
      settings.pos_password ?? existing?.pos_password ?? '1234',
      settings.receipt_size ?? existing?.receipt_size ?? 'thermal',
      settings.low_stock_threshold ?? existing?.low_stock_threshold ?? 10,
      settings.auto_export_path ?? existing?.auto_export_path ?? '',
      settings.auto_export_enabled !== undefined ? (settings.auto_export_enabled ? 1 : 0) : (existing?.auto_export_enabled ? 1 : 0),
      settings.owner_full_name ?? existing?.owner_full_name ?? '',
      settings.owner_mobile ?? existing?.owner_mobile ?? '',
      settings.owner_email ?? existing?.owner_email ?? '',
      settings.owner_password ?? existing?.owner_password ?? '',
      settings.license_mode ?? existing?.license_mode ?? 'offline',
      settings.approval_status ?? existing?.approval_status ?? 'approved',
      settings.last_online_check ?? existing?.last_online_check ?? null,
      settings.cloud_backend_url ?? existing?.cloud_backend_url ?? '',
      settings.cloud_backend_token ?? existing?.cloud_backend_token ?? '',
      settings.cloud_last_sync ?? existing?.cloud_last_sync ?? null,
      settings.cloud_connected !== undefined ? (settings.cloud_connected ? 1 : 0) : (existing?.cloud_connected ? 1 : 0),
      settings.setup_completed !== undefined ? (settings.setup_completed ? 1 : 0) : (existing?.setup_completed ? 1 : 0),
      settings.business_name ?? settings.store_name ?? existing?.business_name ?? existing?.store_name ?? 'Retailer Shop',
      settings.activation_key ?? existing?.activation_key ?? '',
      settings.invoice_style ?? existing?.invoice_style ?? 'thermal',
      settings.invoice_notes ?? existing?.invoice_notes ?? ''
    );

    // Save module flags separately (optional booleans, not in the main settings form)
    if (settings.bakery_module_enabled !== undefined || settings.accounting_module_enabled !== undefined) {
      db.prepare(`
        UPDATE settings
        SET bakery_module_enabled    = COALESCE(?, bakery_module_enabled),
            accounting_module_enabled = COALESCE(?, accounting_module_enabled)
        WHERE id = 1
      `).run(
        settings.bakery_module_enabled !== undefined ? (settings.bakery_module_enabled ? 1 : 0) : null,
        settings.accounting_module_enabled !== undefined ? (settings.accounting_module_enabled ? 1 : 0) : null,
      );
    }

    // Username is intentionally immutable from settings screen.
    if (!existing?.owner_username) {
      db.prepare("UPDATE settings SET owner_username = 'admin' WHERE id = 1").run();
    }

    const updatedSettings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    logger.info('Settings updated');

    if (settings.auto_export_enabled && settings.auto_export_path) {
      triggerAutoExport();
    }

    return { success: true, data: updatedSettings };
  } catch (error: any) {
    logger.error('Failed to update settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('is-setup-complete', async () => {
  try {
    if (!db) throw new Error('Database not initialized');
    const row = db.prepare('SELECT setup_completed FROM settings WHERE id = 1').get() as any;
    return { success: true, complete: !!row?.setup_completed };
  } catch (error: any) {
    logger.error('Failed to check setup state:', error);
    return { success: false, complete: false, error: error.message };
  }
});

ipcMain.handle('get-sync-status', async () => {
  try {
    if (!db) throw new Error('Database not initialized');
    const pending = db.prepare("SELECT COUNT(*) as count FROM cloud_sync_queue WHERE status = 'pending'").get() as any;
    const failed = db.prepare("SELECT COUNT(*) as count FROM cloud_sync_queue WHERE status = 'failed'").get() as any;
    const settings = db.prepare('SELECT cloud_connected, cloud_last_sync FROM settings WHERE id = 1').get() as any;
    return {
      success: true,
      data: {
        pending: Number(pending?.count || 0),
        failed: Number(failed?.count || 0),
        cloudConnected: !!settings?.cloud_connected,
        lastSync: settings?.cloud_last_sync || null
      }
    };
  } catch (error: any) {
    logger.error('Failed to read sync status:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('enqueue-sync-item', async (_, item: { entityType: string; operation: string; payload: any; error?: string }) => {
  try {
    if (!db) throw new Error('Database not initialized');
    db.prepare(`
      INSERT INTO cloud_sync_queue (entity_type, operation, payload, status, last_error)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(item.entityType, item.operation, JSON.stringify(item.payload ?? {}), item.error || '');
    return { success: true };
  } catch (error: any) {
    logger.error('Failed to enqueue sync item:', error);
    return { success: false, error: error.message };
  }
});

// ─── Cloud Sync Queue Handlers ────────────────────────────────────────────────

// Get pending sync queue items (up to N), skipping items that have exhausted retries
ipcMain.handle('get-pending-sync-items', async (_, limit = 20) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const items = db.prepare(`
      SELECT id, entity_type, operation, payload, attempts
      FROM cloud_sync_queue
      WHERE status = 'pending' AND attempts < 5
      ORDER BY id ASC
      LIMIT ?
    `).all(limit);
    return { success: true, data: items };
  } catch (e: any) {
    logger.error('get-pending-sync-items failed:', e);
    return { success: false, error: e.message };
  }
});

// Mark multiple sync items as successfully synced
ipcMain.handle('mark-sync-items-done', async (_, ids: number[]) => {
  try {
    if (!db) throw new Error('Database not initialized');
    if (!Array.isArray(ids) || ids.length === 0) return { success: true };
    const stmt = db.prepare(`
      UPDATE cloud_sync_queue
      SET status = 'synced', updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `);
    const run = db.transaction((idList: number[]) => {
      for (const id of idList) stmt.run(id);
    });
    run(ids);
    return { success: true };
  } catch (e: any) {
    logger.error('mark-sync-items-done failed:', e);
    return { success: false, error: e.message };
  }
});

// Mark one sync item as failed; bump attempt count; auto-fail after 5 attempts
ipcMain.handle('mark-sync-item-failed', async (_, id: number, error: string) => {
  try {
    if (!db) throw new Error('Database not initialized');
    db.prepare(`
      UPDATE cloud_sync_queue
      SET attempts   = attempts + 1,
          last_error = ?,
          status     = CASE WHEN attempts + 1 >= 5 THEN 'failed' ELSE 'pending' END,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(error || '', id);
    return { success: true };
  } catch (e: any) {
    logger.error('mark-sync-item-failed failed:', e);
    return { success: false, error: e.message };
  }
});

// Enqueue a sale for cloud sync by its local sale ID (reads sale + items from DB)
ipcMain.handle('enqueue-sale-sync', async (_, saleId: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const sale = db.prepare(`
      SELECT s.*,
             GROUP_CONCAT(si.product_name || ' (x' || si.quantity || ')') AS items_summary,
             COUNT(si.id) AS items_count
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE s.id = ?
      GROUP BY s.id
    `).get(saleId) as any;
    if (!sale) return { success: false, error: 'Sale not found' };
    db.prepare(`
      INSERT INTO cloud_sync_queue (entity_type, operation, payload, status)
      VALUES ('sale', 'create', ?, 'pending')
    `).run(JSON.stringify(sale));
    return { success: true };
  } catch (e: any) {
    logger.error('enqueue-sale-sync failed:', e);
    return { success: false, error: e.message };
  }
});

// Full re-sync: dumps ALL existing records into the cloud_sync_queue.
// Useful for disaster recovery — admin can then see all customer balances, products, etc.
// Skips items already queued (deduplicates via INSERT OR IGNORE on a unique index is not guaranteed,
// so we simply truncate 'pending'/'failed' items first and re-insert everything).
ipcMain.handle('full-resync', async () => {
  try {
    if (!db) throw new Error('Database not initialized');

    let enqueued = 0;

    const enqueue = (entity_type: string, operation: string, row: any) => {
      db!.prepare(`INSERT INTO cloud_sync_queue (entity_type, operation, payload, status) VALUES (?, ?, ?, 'pending')`).run(entity_type, operation, JSON.stringify(row));
      enqueued++;
    };

    // Products
    const products = db.prepare('SELECT * FROM products').all();
    for (const row of products) enqueue('product', 'create', row);

    // Customers
    const customers = db.prepare('SELECT * FROM customers').all();
    for (const row of customers) enqueue('customer', 'create', row);

    // Vendors
    const vendors = db.prepare('SELECT * FROM vendors').all();
    for (const row of vendors) enqueue('vendor', 'create', row);

    // Purchases with their inventory batch items
    const purchases = db.prepare('SELECT * FROM purchases').all() as any[];
    for (const pur of purchases) {
      const items = db.prepare('SELECT * FROM inventory_batches WHERE purchase_id = ?').all(pur.id);
      enqueue('purchase', 'create', { ...pur, items });
    }

    // Customer payments (loans / dues) — most critical for recovery
    const customerPayments = db.prepare('SELECT * FROM customer_payments').all();
    for (const row of customerPayments) enqueue('customer_payment', 'create', row);

    // Vendor payments
    const vendorPayments = db.prepare('SELECT * FROM vendor_payments').all();
    for (const row of vendorPayments) enqueue('vendor_payment', 'create', row);

    // Expenses
    const expenses = db.prepare('SELECT * FROM expenses').all();
    for (const row of expenses) enqueue('expense', 'create', row);

    // Accounts
    const accountsList = db.prepare('SELECT * FROM accounts').all();
    for (const row of accountsList) enqueue('account', 'create', row);

    // Account transactions
    const accountTxnsList = db.prepare('SELECT * FROM account_txns').all();
    for (const row of accountTxnsList) enqueue('account_txn', 'create', row);

    // Sales with sale_items
    const sales = db.prepare(`
      SELECT s.*, GROUP_CONCAT(si.product_name || ' (x' || si.quantity || ')') AS items_summary,
             COUNT(si.id) AS items_count
      FROM sales s LEFT JOIN sale_items si ON s.id = si.sale_id
      GROUP BY s.id
    `).all() as any[];
    for (const sale of sales) enqueue('sale', 'create', sale);

    logger.info(`full-resync: enqueued ${enqueued} records for cloud sync`);
    return { success: true, data: { enqueued } };
  } catch (error: any) {
    logger.error('full-resync failed:', error);
    return { success: false, error: error.message };
  }
});

// ============= SALES HANDLERS =============

ipcMain.handle('create-sale', async (_, data: {
  customer_id?: number;
  items: Array<{
    product_id?: number;
    product_name: string;
    quantity: number;
    price: number;
    is_custom?: boolean;
  }>;
  total: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  payment_method: string;
  payment_status?: string;
  amount_paid?: number;
  notes?: string;
  register_id?: number;
  account_id?: number;
}) => {
  try {
    if (!db) throw new Error('Database not initialized');

    // Safety: kill any ghost table references before each sale
    try {
      db.exec(`DROP TABLE IF EXISTS _products_old`);
      db.exec(`DROP TABLE IF EXISTS _sale_items_old`);
    } catch (e) { }

    // Strict validation for data integrity
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) throw new Error('Sale must have at least one valid item');
    if (typeof data.total !== 'number' || isNaN(data.total) || data.total < 0) throw new Error('Sale total must be a valid positive number');
    if (data.subtotal !== undefined && (typeof data.subtotal !== 'number' || isNaN(data.subtotal) || data.subtotal < 0)) throw new Error('Invalid subtotal');
    if (data.discount !== undefined && (typeof data.discount !== 'number' || isNaN(data.discount) || data.discount < 0)) throw new Error('Invalid discount');
    if (data.amount_paid !== undefined && (typeof data.amount_paid !== 'number' || isNaN(data.amount_paid) || data.amount_paid < 0)) throw new Error('Invalid amount paid');
    if (data.amount_paid !== undefined && data.amount_paid > data.total) throw new Error('Amount paid cannot exceed sale total');

    for (const item of data.items) {
      if (typeof item.quantity !== 'number' || isNaN(item.quantity) || item.quantity <= 0) throw new Error(`Invalid quantity for product: ${item.product_name}`);
      if (typeof item.price !== 'number' || isNaN(item.price) || item.price < 0) throw new Error(`Invalid price for product: ${item.product_name}`);
    }

    const transaction = db.transaction(() => {
      try {
        // Insert sale
        const saleStmt = db!.prepare(`
          INSERT INTO sales (customer_id, total, subtotal, discount, tax, payment_method, payment_status, notes, date_created, register_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), ?)
        `);

        const determinedStatus = (data.amount_paid || 0) >= data.total ? 'Paid' : (data.amount_paid || 0) > 0 ? 'Partial' : 'Pending';

        const saleInfo = saleStmt.run(
          data.customer_id || null,
          data.total,
          data.subtotal || data.total,
          data.discount || 0,
          data.tax || 0,
          data.payment_method || 'cash',
          data.payment_status || determinedStatus,
          data.notes || null,
          data.register_id || null
        );

        const saleId = saleInfo.lastInsertRowid;

        // Record partial payment if explicitly provided and there's a customer
        if (data.customer_id && data.amount_paid && data.amount_paid > 0) {
          db!.prepare("INSERT INTO customer_payments (customer_id, amount, notes, sale_id, date_added) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))").run(
            data.customer_id, data.amount_paid, `Payment for Sale #${saleId}`, saleId
          );
        }

        // ── Account cash-flow recording ──
        if (data.account_id && data.amount_paid && data.amount_paid > 0 && data.payment_method !== 'credit') {
          db!.prepare(`
            INSERT INTO account_txns (account_id, type, amount, category, note, date_created)
            VALUES (?, 'in', ?, 'sale', ?, datetime('now', 'localtime'))
          `).run(
            data.account_id,
            data.amount_paid,
            `Sale payment received — Sale #${saleId}`
          );
          recomputeAccountBalance(db!, data.account_id);
        }

        // Insert sale items
        const itemStmt = db!.prepare(`
          INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price, purchase_price, is_custom)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of data.items) {
          if (item.product_id && !item.is_custom) {
            let qtyRemainingToSell = item.quantity;
            const batches = db!.prepare(`
              SELECT id, quantity_remaining, purchase_price 
              FROM inventory_batches 
              WHERE product_id = ? AND quantity_remaining > 0
              ORDER BY date_added ASC
            `).all(item.product_id) as any[];

            for (const batch of batches) {
              if (qtyRemainingToSell <= 0) break;
              const deduct = Math.min(qtyRemainingToSell, batch.quantity_remaining);

              db!.prepare('UPDATE inventory_batches SET quantity_remaining = quantity_remaining - ? WHERE id = ?').run(deduct, batch.id);

              itemStmt.run(
                saleId,
                item.product_id,
                item.product_name,
                deduct,
                item.price,
                batch.purchase_price,
                0
              );

              qtyRemainingToSell -= deduct;
            }

            if (qtyRemainingToSell > 0) {
              itemStmt.run(
                saleId,
                item.product_id,
                item.product_name,
                qtyRemainingToSell,
                item.price,
                0,
                0
              );
            }

            // Subtract from global stock cache
            db!.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.product_id);
          } else {
            itemStmt.run(
              saleId,
              item.product_id || null,
              item.product_name,
              item.quantity,
              item.price,
              0,
              item.is_custom ? 1 : 0
            );
          }
        }

        return saleId;
      } catch (innerError: any) {
        logger.error('Transaction failure:', innerError);
        // Specialized error handling for missing tables or foreign key errors
        if (innerError.message.includes('no such table')) {
          throw new Error(`Database structure error: ${innerError.message}. Please restart the app to run repairs.`);
        }
        throw innerError;
      }
    });

    const saleId = transaction();
    logger.info(`Sale created: ID ${saleId}, Total: ${data.total}`);

    // Trigger auto-export after a successful sale
    triggerAutoExport();

    // Auto-enqueue this sale for cloud sync (fire-and-forget, non-blocking)
    try {
      const saleRow = db.prepare(`
        SELECT s.*, GROUP_CONCAT(si.product_name || ' (x' || si.quantity || ')') AS items_summary, COUNT(si.id) AS items_count
        FROM sales s LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE s.id = ? GROUP BY s.id
      `).get(saleId as number) as any;
      if (saleRow) {
        db.prepare(`INSERT INTO cloud_sync_queue (entity_type, operation, payload, status) VALUES ('sale', 'create', ?, 'pending')`)
          .run(JSON.stringify(saleRow));
      }
    } catch (syncErr: any) {
      logger.warn('Auto-enqueue sale sync failed (non-fatal):', syncErr.message);
    }

    return { success: true, data: { saleId } };
  } catch (error: any) {
    logger.error('Failed to create sale:', error);
    // Be very descriptive about the error for the frontend
    let userFriendlyError = error.message;
    if (error.message.includes('main._products_old')) {
      userFriendlyError = "Database integrity issue detected (_products_old reference). Automatic repair will run on next restart.";
    }
    return { success: false, error: userFriendlyError };
  }
});

ipcMain.handle('get-sales', async (_, opts: { limit?: number; offset?: number; search?: string; startDate?: string; endDate?: string } = {}) => {
  try {
    if (!db) throw new Error('Database not initialized');

    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const search = opts.search?.trim() ?? '';

    let whereClause = '';
    const dateParams: any[] = [];

    if (opts.startDate && opts.endDate) {
      whereClause = ' WHERE s.date_created >= ? AND s.date_created <= ? ';
      dateParams.push(getLocalSqliteDate(opts.startDate), getLocalSqliteDate(opts.endDate));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      const queryParams = [...dateParams, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, limit, offset];
      const countParams = [...dateParams, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];

      const sales = db.prepare(`
        SELECT s.*,
               c.name as customer_name,
               COUNT(si.id) as item_count,
               COALESCE((SELECT SUM(amount) FROM customer_payments WHERE sale_id = s.id), 0) as amount_paid,
               COALESCE((SELECT SUM(total_returned) FROM sale_returns WHERE sale_id = s.id), 0) as total_returned,
               CASE WHEN s.status = 'Cancelled' THEN 0 ELSE (s.total - COALESCE((SELECT SUM(amount) FROM customer_payments WHERE sale_id = s.id), 0) - COALESCE((SELECT SUM(total_returned) FROM sale_returns WHERE sale_id = s.id), 0)) END as remaining,
               GROUP_CONCAT(DISTINCT si.product_name || ' (x' || si.quantity || ')') as items_summary
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN sale_items si ON s.id = si.sale_id
        ${whereClause}
        GROUP BY s.id
        HAVING CAST(s.id AS TEXT) LIKE ? OR s.payment_method LIKE ? OR items_summary LIKE ? OR replace(substr(s.date_created, 1, 10), '-', '') LIKE ? OR ('INV-' || replace(substr(s.date_created, 1, 10), '-', '') || '-' || printf('%05d', s.id)) LIKE ?
        ORDER BY s.date_created DESC
        LIMIT ? OFFSET ?
      `).all(...queryParams);

      const countRow = db.prepare(`
        SELECT COUNT(*) as total FROM (
          SELECT s.id, GROUP_CONCAT(DISTINCT si.product_name) as items_summary
          FROM sales s
          LEFT JOIN sale_items si ON s.id = si.sale_id
          ${whereClause}
          GROUP BY s.id
          HAVING CAST(s.id AS TEXT) LIKE ? OR s.payment_method LIKE ? 
              OR items_summary LIKE ?
              OR replace(substr(s.date_created, 1, 10), '-', '') LIKE ?
              OR ('INV-' || replace(substr(s.date_created, 1, 10), '-', '') || '-' || printf('%05d', s.id)) LIKE ?
        )
      `).get(...countParams) as any;

      return { success: true, data: sales, total: countRow?.total ?? 0 };
    }

    const queryParams = [...dateParams, limit, offset];

    const sales = db.prepare(`
      SELECT s.*,
             c.name as customer_name,
             COUNT(si.id) as item_count,
             COALESCE((SELECT SUM(amount) FROM customer_payments WHERE sale_id = s.id), 0) as amount_paid,
             COALESCE((SELECT SUM(total_returned) FROM sale_returns WHERE sale_id = s.id), 0) as total_returned,
             CASE WHEN s.status = 'Cancelled' THEN 0 ELSE (s.total - COALESCE((SELECT SUM(amount) FROM customer_payments WHERE sale_id = s.id), 0) - COALESCE((SELECT SUM(total_returned) FROM sale_returns WHERE sale_id = s.id), 0)) END as remaining,
             GROUP_CONCAT(DISTINCT si.product_name || ' (x' || si.quantity || ')') as items_summary
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      ${whereClause}
      GROUP BY s.id
      ORDER BY s.date_created DESC
      LIMIT ? OFFSET ?
    `).all(...queryParams);

    const countRow = db.prepare(`
      SELECT COUNT(*) as total 
      FROM sales s
      ${whereClause}
    `).get(...dateParams) as any;

    return { success: true, data: sales, total: countRow?.total ?? 0 };
  } catch (error: any) {
    logger.error('Failed to get sales:', error);
    return { success: false, error: error.message };
  }
});


ipcMain.handle('get-sale-items', async (_, saleId: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    if (!saleId || saleId <= 0) throw new Error('Invalid sale ID');

    const items = db.prepare(`
      SELECT si.*, p.name as product_name, p.category,
      (SELECT COALESCE(SUM(quantity), 0) FROM sale_return_items WHERE sale_item_id = si.id) as quantity_returned
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `).all(saleId);

    return { success: true, data: items };
  } catch (error: any) {
    logger.error('Failed to get sale items:', error);
    return { success: false, error: error.message };
  }
});

// ============= DASHBOARD HANDLERS =============

ipcMain.handle('get-dashboard-stats', async (_, args?: { startDate?: string; endDate?: string }) => {
  try {
    if (!db) throw new Error('Database not initialized');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const sqlStart = (args && args.startDate) ? getLocalSqliteDate(args.startDate) : null;
    const sqlEnd = (args && args.endDate) ? getLocalSqliteDate(args.endDate) : null;

    // Helper functions
    const sumSince = (since: string) => {
      const result = db!.prepare("SELECT COALESCE(SUM(total), 0) as total FROM sales WHERE date_created >= ? AND LOWER(COALESCE(status, '')) IN ('completed', 'paid', 'partial')").get(since) as any;
      return result.total;
    };

    const countSince = (since: string) => {
      const result = db!.prepare("SELECT COUNT(*) as count FROM sales WHERE date_created >= ? AND LOWER(COALESCE(status, '')) IN ('completed', 'paid', 'partial')").get(since) as any;
      return result.count;
    };

    const profitSince = (since: string) => {
      const result = db!.prepare(`
        SELECT COALESCE(SUM(
          si.quantity * (
            si.price - COALESCE(NULLIF(si.purchase_price, 0), NULLIF(p.purchase_price, 0), 0)
          )
        ), 0) as profit
        FROM sale_items si
        INNER JOIN sales s ON si.sale_id = s.id
        LEFT JOIN products p ON (p.id = si.product_id OR (si.product_id IS NULL AND p.name = si.product_name))
        WHERE s.date_created >= ? AND LOWER(COALESCE(s.status, '')) IN ('completed', 'paid', 'partial')
      `).get(since) as any;
      return Number(result?.profit || 0);
    };

    let periodQuery = '';
    let periodParams: any[] = [];
    if (sqlStart && sqlEnd) {
      periodQuery = ' AND date_created >= ? AND date_created <= ? ';
      periodParams = [sqlStart, sqlEnd];
    } else if (sqlStart) {
      periodQuery = ' AND date_created >= ? ';
      periodParams = [sqlStart];
    }

    const filteredRevenue = (db.prepare(`SELECT COALESCE(SUM(total), 0) as total FROM sales WHERE LOWER(COALESCE(status, '')) IN ('completed', 'paid', 'partial') ${periodQuery}`).get(...periodParams) as any).total;
    const filteredCount = (db.prepare(`SELECT COUNT(*) as count FROM sales WHERE LOWER(COALESCE(status, '')) IN ('completed', 'paid', 'partial') ${periodQuery}`).get(...periodParams) as any).count;

    let periodQueryS = periodQuery ? periodQuery.replace(/date_created/g, 's.date_created') : '';

    const filteredProfit = (db.prepare(`
      SELECT COALESCE(SUM(
        si.quantity * (
          si.price - COALESCE(NULLIF(si.purchase_price, 0), NULLIF(p.purchase_price, 0), 0)
        )
      ), 0) as profit
      FROM sale_items si
      INNER JOIN sales s ON si.sale_id = s.id
      LEFT JOIN products p ON (p.id = si.product_id OR (si.product_id IS NULL AND p.name = si.product_name))
      WHERE LOWER(COALESCE(s.status, '')) IN ('completed', 'paid', 'partial') ${periodQueryS}
    `).get(...periodParams) as any).profit;

    const productSalesWindows = db.prepare(`
      SELECT
        p.id,
        p.name,
        p.stock,
        COALESCE(SUM(CASE WHEN s.date_created >= ? THEN si.quantity ELSE 0 END), 0) as qty_week,
        COALESCE(SUM(CASE WHEN s.date_created >= ? THEN si.quantity * si.price ELSE 0 END), 0) as amount_week,
        COALESCE(SUM(CASE WHEN s.date_created >= ? THEN si.quantity ELSE 0 END), 0) as qty_month,
        COALESCE(SUM(CASE WHEN s.date_created >= ? THEN si.quantity * si.price ELSE 0 END), 0) as amount_month,
        MAX(s.date_created) as last_sold_at
      FROM products p
      LEFT JOIN sale_items si ON si.product_name = p.name
      LEFT JOIN sales s ON s.id = si.sale_id AND LOWER(COALESCE(s.status, '')) IN ('completed', 'paid', 'partial')
      GROUP BY p.id, p.name, p.stock
      ORDER BY amount_month DESC, qty_month DESC, p.name ASC
    `).all(weekStart, weekStart, monthStart, monthStart) as any[];

    const monthlyMatrixRows = db.prepare(`
      SELECT
        si.product_name as product_name,
        strftime('%Y-%m', s.date_created) as ym,
        COALESCE(SUM(si.quantity), 0) as qty,
        COALESCE(SUM(si.quantity * si.price), 0) as amount
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE LOWER(COALESCE(s.status, '')) IN ('completed', 'paid', 'partial')
        AND s.date_created >= datetime('now', '-12 months')
      GROUP BY si.product_name, ym
      ORDER BY si.product_name ASC, ym ASC
    `).all() as any[];

    const bestMonthByProduct = new Map<string, any>();
    for (const row of monthlyMatrixRows) {
      const key = row.product_name;
      const curr = bestMonthByProduct.get(key);
      if (!curr || Number(row.amount) > Number(curr.amount)) {
        bestMonthByProduct.set(key, row);
      }
    }

    const deadProducts = productSalesWindows
      .filter((p) => Number(p.qty_month || 0) === 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        stock: Number(p.stock || 0),
        lastSoldAt: p.last_sold_at || null
      }))
      .slice(0, 100);

    const stats = {
      totalSalesToday: sumSince(todayStart),
      totalSalesWeek: sumSince(weekStart),
      totalSalesMonth: sumSince(monthStart),
      totalActualRevenueToday: profitSince(todayStart),
      totalActualRevenueWeek: profitSince(weekStart),
      totalActualRevenueMonth: profitSince(monthStart),
      totalTransactions: (db.prepare('SELECT COUNT(*) as count FROM sales').get() as any).count,
      totalTransactionsToday: countSince(todayStart),
      totalProducts: (db.prepare('SELECT COUNT(*) as count FROM products').get() as any).count,
      totalCustomers: (db.prepare('SELECT COUNT(*) as count FROM customers').get() as any).count,
      filteredRevenue,
      filteredCount,
      filteredProfit,
      topProducts: db.prepare(`
        SELECT 
          si.product_name as name, 
          SUM(si.quantity) as qty_sold, 
          SUM(si.quantity * si.price) as revenue,
          COUNT(DISTINCT si.sale_id) as times_sold
        FROM sale_items si
        INNER JOIN sales s ON si.sale_id = s.id
        WHERE LOWER(COALESCE(s.status, '')) IN ('completed', 'paid', 'partial') ${periodQueryS}
        GROUP BY si.product_name
        ORDER BY qty_sold DESC
        LIMIT 5
      `).all(...periodParams),
      recentSales: db.prepare(`
        SELECT s.*, COUNT(si.id) as item_count
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE 1=1 ${periodQueryS}
        GROUP BY s.id
        ORDER BY s.date_created DESC
        LIMIT 10
      `).all(...periodParams),
      paymentStats: db.prepare(`
        SELECT 
          payment_method,
          SUM(total) as revenue,
          COUNT(*) as count
        FROM sales
        WHERE LOWER(COALESCE(status, '')) IN ('completed', 'paid', 'partial') ${periodQuery}
        GROUP BY payment_method
      `).all(...periodParams),
      // ---- Inventory Analytics (Global Snapshot) ----
      totalStockValue: (db.prepare(`
        SELECT COALESCE(SUM(stock * purchase_price), 0) as val FROM products
      `).get() as any).val,
      totalRetailValue: (db.prepare(`
        SELECT COALESCE(SUM(stock * price), 0) as val FROM products
      `).get() as any).val,
      lowStockProducts: (() => {
        const threshold = (db!.prepare('SELECT COALESCE(low_stock_threshold,10) as t FROM settings WHERE id=1').get() as any)?.t ?? 10;
        return db!.prepare(`SELECT id, name, stock, price, barcode, category FROM products WHERE stock <= ? ORDER BY stock ASC LIMIT 20`).all(threshold);
      })(),
      productSalesWindows,
      monthlyItemSales: monthlyMatrixRows,
      bestMonthByProduct: Array.from(bestMonthByProduct.values()),
      deadProducts,
      // ---- Loan / Qaraz Analytics (Period Aware) ----
      totalOutstandingLoans: (db.prepare(`
        SELECT COALESCE(SUM(bal), 0) as total FROM (
          SELECT c.id,
            COALESCE((SELECT SUM(CAST(s.total AS REAL)) FROM sales s WHERE s.customer_id = c.id AND (s.status IS NULL OR LOWER(s.status) != 'cancelled') ${periodQuery}),0) -
            COALESCE((SELECT SUM(CAST(p.amount AS REAL)) FROM customer_payments p WHERE p.customer_id = c.id ${periodQuery.replace(/date_created/g, 'p.date_added')}),0) -
            COALESCE((SELECT SUM(CAST(sr.total_returned AS REAL)) FROM sale_returns sr JOIN sales s ON sr.sale_id = s.id WHERE s.customer_id = c.id ${periodQuery.replace(/date_created/g, 'sr.date_created')}),0) as bal
          FROM customers c
        ) WHERE bal > 0.5
      `).get(...[...periodParams, ...periodParams, ...periodParams]) as any).total,
      customersInDebt: (db.prepare(`
        SELECT COUNT(*) as count FROM (
          SELECT c.id,
            COALESCE((SELECT SUM(CAST(s.total AS REAL)) FROM sales s WHERE s.customer_id = c.id AND (s.status IS NULL OR LOWER(s.status) != 'cancelled') ${periodQuery}),0) -
            COALESCE((SELECT SUM(CAST(p.amount AS REAL)) FROM customer_payments p WHERE p.customer_id = c.id ${periodQuery.replace(/date_created/g, 'p.date_added')}),0) -
            COALESCE((SELECT SUM(CAST(sr.total_returned AS REAL)) FROM sale_returns sr JOIN sales s ON sr.sale_id = s.id WHERE s.customer_id = c.id ${periodQuery.replace(/date_created/g, 'sr.date_created')}),0) as bal
          FROM customers c
        ) WHERE bal > 0.5
      `).get(...[...periodParams, ...periodParams, ...periodParams]) as any).count,
      totalOutstandingPayables: (db.prepare(`
        SELECT SUM(remaining) FROM (
          SELECT CAST(p.total AS REAL) - 
                 COALESCE((SELECT SUM(CAST(amount AS REAL)) FROM vendor_payments WHERE purchase_id = p.id), 0) -
                 COALESCE((SELECT SUM(CAST(total_returned AS REAL)) FROM purchase_returns WHERE purchase_id = p.id), 0) as remaining
          FROM purchases p 
          WHERE (p.status IS NULL OR LOWER(p.status) != 'cancelled') ${periodQuery}
        ) WHERE remaining > 0.5
      `).get(...periodParams) as any)['SUM(remaining)'] || 0,
      vendorsWithDebt: (db.prepare(`
        SELECT COUNT(DISTINCT vendor_id) as count FROM (
          SELECT vendor_id,
                 CAST(total AS REAL) - 
                 COALESCE((SELECT SUM(CAST(amount AS REAL)) FROM vendor_payments WHERE purchase_id = p.id), 0) -
                 COALESCE((SELECT SUM(CAST(total_returned AS REAL)) FROM purchase_returns WHERE purchase_id = p.id), 0) as remaining
          FROM purchases p
          WHERE (p.status IS NULL OR LOWER(p.status) != 'cancelled') ${periodQuery}
        ) WHERE remaining > 0.5
      `).get(...periodParams) as any).count,
      topDebtors: db.prepare(`
        SELECT id, name, phone, balance FROM (
          SELECT c.id, c.name, c.phone,
                 (SELECT SUM(rem) FROM (
                    SELECT CAST(s.total AS REAL) - 
                           COALESCE((SELECT SUM(CAST(amount AS REAL)) FROM customer_payments WHERE sale_id = s.id), 0) -
                           COALESCE((SELECT SUM(CAST(total_returned AS REAL)) FROM sale_returns WHERE sale_id = s.id), 0) as rem
                    FROM sales s WHERE CAST(s.customer_id AS INTEGER) = c.id AND (s.status IS NULL OR LOWER(s.status) != 'cancelled')
                 ) WHERE rem > 0.5) as balance
          FROM customers c
        ) WHERE balance > 0.5
        ORDER BY balance DESC LIMIT 5
      `).all(),
      topPayableVendors: db.prepare(`
        SELECT id, name, phone, balance FROM (
          SELECT v.id, v.name, v.phone,
                 (SELECT SUM(rem) FROM (
                    SELECT CAST(p.total AS REAL) - 
                           COALESCE((SELECT SUM(CAST(amount AS REAL)) FROM vendor_payments WHERE purchase_id = p.id), 0) -
                           COALESCE((SELECT SUM(CAST(total_returned AS REAL)) FROM purchase_returns WHERE purchase_id = p.id), 0) as rem
                    FROM purchases p WHERE CAST(p.vendor_id AS INTEGER) = v.id AND (p.status IS NULL OR LOWER(p.status) != 'cancelled')
                 ) WHERE rem > 0.5) as balance
          FROM vendors v
        ) WHERE balance > 0.5
        ORDER BY balance DESC LIMIT 5
      `).all(),
      salesTrend: db.prepare(`
        SELECT date(date_created) as date, SUM(CAST(total AS REAL)) as revenue
        FROM sales
        WHERE LOWER(COALESCE(status, '')) IN ('completed', 'paid', 'partial') AND date_created >= date('now', '-30 days')
        GROUP BY date(date_created)
        ORDER BY date ASC
      `).all(),
      // ── Multi-level P&L trend (last 30 days) ─────────────────────────────
      plTrend: (() => {
        const revCogs = (db!.prepare(`
          SELECT
            date(s.date_created) as day,
            COALESCE(SUM(CAST(s.total AS REAL)), 0) as revenue,
            COALESCE(SUM(
              si.quantity * COALESCE(
                NULLIF(CAST(si.purchase_price AS REAL), 0),
                NULLIF(CAST(p.purchase_price  AS REAL), 0), 0)
            ), 0) as cogs
          FROM sales s
          LEFT JOIN sale_items si ON si.sale_id = s.id
          LEFT JOIN products p ON (
            p.id = si.product_id OR
            (si.product_id IS NULL AND p.name = si.product_name)
          )
          WHERE LOWER(COALESCE(s.status, '')) IN ('completed', 'paid', 'partial')
            AND s.date_created >= date('now', '-30 days')
          GROUP BY day ORDER BY day
        `).all()) as Array<{ day: string; revenue: number; cogs: number }>;

        const expRows = (db!.prepare(`
          SELECT date(date_added) as day,
                 COALESCE(SUM(CAST(amount AS REAL)), 0) as expenses
          FROM expenses
          WHERE date_added >= date('now', '-30 days')
          GROUP BY day ORDER BY day
        `).all()) as Array<{ day: string; expenses: number }>;

        const expMap = new Map(expRows.map(e => [e.day, Number(e.expenses)]));

        return revCogs.map(d => {
          const expenses    = expMap.get(d.day) ?? 0;
          const revenue     = Math.round(Number(d.revenue));
          const cogs        = Math.round(Number(d.cogs));
          const grossProfit = revenue - cogs;
          const netProfit   = grossProfit - Math.round(expenses);
          return { day: d.day, revenue, cogs, expenses: Math.round(expenses), grossProfit, netProfit };
        });
      })(),
    };

    logger.debug('Dashboard stats retrieved');
    return { success: true, data: stats };
  } catch (error: any) {
    logger.error('Failed to get dashboard stats:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-bakery-dashboard', async () => {
  try {
    if (!db) throw new Error('Database not initialized');

    const today     = new Date().toISOString().slice(0, 10);
    const in7Days   = new Date(Date.now() +  7 * 86_400_000).toISOString().slice(0, 10);
    const in30Days  = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

    const expiredProducts = db.prepare(`
      SELECT id, name, category, stock, unit_type, weight_value, expiry_date, production_date
      FROM products WHERE is_bakery = 1 AND expiry_date IS NOT NULL AND expiry_date < ?
      ORDER BY expiry_date ASC
    `).all(today);

    const expiringToday = db.prepare(`
      SELECT id, name, category, stock, unit_type, weight_value, expiry_date, production_date
      FROM products WHERE is_bakery = 1 AND expiry_date = ?
      ORDER BY name ASC
    `).all(today);

    const expiringSoon = db.prepare(`
      SELECT id, name, category, stock, unit_type, weight_value, expiry_date, production_date,
             CAST(julianday(expiry_date) - julianday('now') AS INTEGER) as days_left
      FROM products WHERE is_bakery = 1 AND expiry_date > ? AND expiry_date <= ?
      ORDER BY expiry_date ASC
    `).all(today, in7Days);

    const expiringThisMonth = db.prepare(`
      SELECT id, name, category, stock, unit_type, weight_value, expiry_date, production_date,
             CAST(julianday(expiry_date) - julianday('now') AS INTEGER) as days_left
      FROM products WHERE is_bakery = 1 AND expiry_date > ? AND expiry_date <= ?
      ORDER BY expiry_date ASC
    `).all(in7Days, in30Days);

    const allBakeryProducts = db.prepare(`
      SELECT id, name, category, price, purchase_price, stock, unit_type,
             weight_value, price_per_kg, auto_price_by_weight, expiry_date, production_date
      FROM products WHERE is_bakery = 1 ORDER BY name ASC
    `).all();

    const weightSalesSummary = db.prepare(`
      SELECT
        si.product_name as name, p.unit_type,
        COALESCE(SUM(si.quantity), 0) as total_qty,
        COALESCE(SUM(si.quantity * si.price), 0) as total_revenue,
        COALESCE(SUM(si.quantity * (si.price - COALESCE(NULLIF(CAST(si.purchase_price AS REAL),0),
          NULLIF(CAST(p.purchase_price AS REAL),0), 0))), 0) as total_profit
      FROM sale_items si
      JOIN products p ON (p.id = si.product_id OR (si.product_id IS NULL AND p.name = si.product_name))
      JOIN sales s ON s.id = si.sale_id
      WHERE p.is_bakery = 1
        AND LOWER(COALESCE(s.status,'')) IN ('completed','paid','partial')
        AND date(s.date_created) >= date('now', '-30 days')
      GROUP BY si.product_name, p.unit_type
      ORDER BY total_revenue DESC
    `).all();

    return {
      success: true,
      data: {
        expiredProducts,
        expiringToday,
        expiringSoon,
        expiringThisMonth,
        allBakeryProducts,
        weightSalesSummary,
        summary: {
          totalBakeryProducts: allBakeryProducts.length,
          totalExpired:        expiredProducts.length,
          totalExpiringToday:  expiringToday.length,
          totalExpiringSoon:   expiringSoon.length,
        },
      },
    };
  } catch (error: any) {
    logger.error('Failed to get bakery dashboard:', error);
    return { success: false, error: error.message };
  }
});

// ============= REPORT HANDLERS =============

ipcMain.handle('get-report', async (_, args: any) => {
  try {
    if (!db) throw new Error('Database not initialized');

    let startDate: string = '';
    let endDate: string = '';
    let period = 'custom';

    if (typeof args === 'string') {
      period = args;
      const now = new Date();
      endDate = new Date().toISOString();
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          break;
        case 'week':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString();
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      }
    } else if (args && args.startDate) {
      startDate = args.startDate;
      endDate = args.endDate || new Date().toISOString();
    }

    // Convert to SQLite local format YYYY-MM-DD HH:MM:SS
    const sqlStart = getLocalSqliteDate(startDate);
    const sqlEnd = getLocalSqliteDate(endDate);

    const report = {
      period,
      startDate,
      sales: db.prepare(`
        SELECT s.*, c.name as customer_name, COUNT(si.id) as item_count
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE s.date_created >= ? AND s.date_created <= ?
        GROUP BY s.id
        ORDER BY s.date_created DESC
      `).all(sqlStart, sqlEnd),
      revenue: (db.prepare(`
        SELECT COALESCE(SUM(CAST(total AS REAL)), 0) as total 
        FROM sales 
        WHERE date_created >= ? AND date_created <= ? AND LOWER(status) = 'completed'
      `).get(sqlStart, sqlEnd) as any).total,
      totalSales: (db.prepare(`
        SELECT COUNT(*) as count 
        FROM sales 
        WHERE date_created >= ? AND date_created <= ? AND LOWER(status) = 'completed'
      `).get(sqlStart, sqlEnd) as any).count,
      topProducts: db.prepare(`
        SELECT 
          si.product_name as name, 
          SUM(si.quantity) as qty_sold, 
          SUM(si.quantity * CAST(si.price AS REAL)) as revenue,
          AVG(CAST(si.price AS REAL)) as avg_price
        FROM sale_items si
        INNER JOIN sales s ON si.sale_id = s.id
        WHERE s.date_created >= ? AND s.date_created <= ?
        GROUP BY si.product_name
        ORDER BY qty_sold DESC
      `).all(sqlStart, sqlEnd),
      salesByHour: db.prepare(`
        SELECT 
          strftime('%H', date_created) as hour,
          COUNT(*) as count,
          SUM(CAST(total AS REAL)) as total
        FROM sales
        WHERE date_created >= ? AND date_created <= ?
        GROUP BY hour
        ORDER BY hour
      `).all(sqlStart, sqlEnd),
      paymentMethods: db.prepare(`
        SELECT 
          payment_method,
          COUNT(*) as count,
          SUM(CAST(total AS REAL)) as total
        FROM sales
        WHERE date_created >= ? AND date_created <= ?
        GROUP BY payment_method
      `).all(sqlStart, sqlEnd),
    };

    logger.info(`Report generated for period: ${period}`);
    return { success: true, data: report };
  } catch (error: any) {
    logger.error('Failed to generate report:', error);
    return { success: false, error: error.message };
  }
});

// ============= CUSTOMER HANDLERS =============

ipcMain.handle('get-customers', async () => {
  try {
    if (!db) throw new Error('Database not initialized');
    const customers = db.prepare(`
      SELECT c.*, 
             COUNT(s.id) as total_sales, 
             COALESCE(SUM(CASE WHEN (s.status IS NULL OR LOWER(s.status) != 'cancelled') THEN CAST(s.total AS REAL) ELSE 0 END), 0) as total_spent,
             (
               SELECT MAX(dt) FROM (
                 SELECT s2.date_created as dt FROM sales s2 WHERE s2.customer_id = c.id
                 UNION ALL
                 SELECT cp.date_added as dt FROM customer_payments cp WHERE cp.customer_id = c.id
                 UNION ALL
                 SELECT sr.date_created as dt
                 FROM sale_returns sr
                 JOIN sales s3 ON sr.sale_id = s3.id
                 WHERE s3.customer_id = c.id
               )
             ) as last_activity,
             COALESCE((
               SELECT SUM(rem) FROM (
                 SELECT CAST(s.total AS REAL) - 
                        COALESCE((SELECT SUM(CAST(amount AS REAL)) FROM customer_payments cp WHERE cp.sale_id = s.id), 0) -
                        COALESCE((SELECT SUM(CAST(total_returned AS REAL)) FROM sale_returns sr WHERE sr.sale_id = s.id), 0) as rem
                 FROM sales s 
                 WHERE CAST(s.customer_id AS INTEGER) = c.id AND (s.status IS NULL OR LOWER(s.status) != 'cancelled')
               ) WHERE rem > 0.5
             ), 0) as balance
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id
      GROUP BY c.id
      ORDER BY balance DESC, c.name ASC
    `).all();
    return { success: true, data: customers };
  } catch (error: any) {
    logger.error('Failed to get customers:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-customer', async (_, customer: { name: string; phone?: string; email?: string; address?: string }) => {
  try {
    if (!db) throw new Error('Database not initialized');
    if (!customer.name?.trim()) throw new Error('Customer name is required');

    const stmt = db.prepare(`
      INSERT INTO customers (name, phone, email, address, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `);
    const info = stmt.run(
      customer.name.trim(),
      customer.phone || null,
      customer.email || null,
      customer.address || null
    );

    const newCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid);
    logger.info(`Customer added: ${customer.name} (ID: ${info.lastInsertRowid})`);

    // Enqueue for cloud sync
    try {
      db.prepare(`INSERT INTO cloud_sync_queue (entity_type, operation, payload, status) VALUES ('customer', 'create', ?, 'pending')`).run(JSON.stringify(newCustomer));
    } catch (syncErr: any) { logger.warn('Sync enqueue (add-customer) failed:', syncErr.message); }

    return { success: true, data: newCustomer };
  } catch (error: any) {
    logger.error('Failed to add customer:', error);
    return { success: false, error: error.message };
  }
});
// ============= AUTH HANDLERS =============

// Add this to your main.ts file, replacing the existing verify-password handler

ipcMain.handle('verify-password', async (_, password: string) => {
  try {
    if (!db) {
      console.error('Database not initialized');
      return false;
    }

    // Get the stored password
    const row = db.prepare('SELECT pos_password FROM settings WHERE id = 1').get() as any;

    // Check if password matches (fallback to '1234')
    const storedPassword = row?.pos_password || '1234';
    const isValid = String(storedPassword).trim() === String(password).trim();

    // Log for debugging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Password verification: Input: "${password}", Stored: "${row?.pos_password}", Valid: ${isValid}`);
    }

    return isValid;
  } catch (error: any) {
    console.error('Password verification error:', error);
    return false;
  }
});
// ============= PRINTING HELPERS =============
function buildReceiptHtml(content: string): string {
  if (content.trim().toLowerCase().startsWith('<!doctype html')) {
    return content;
  }
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8"/>
    <style>
      @page {
        margin: 0 !important;
        padding: 0 !important;
        size: 72mm auto;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html {
        width: 72mm;
        margin: 0 !important;
        padding: 0 !important;
      }
      body {
        font-family: 'Courier New', Courier, monospace;
        font-size: 12px;
        line-height: 1.5;
        width: 72mm;
        margin: 0 !important;
        padding: 6px 8px 20px 8px;
        background: white;
        color: #000;
        position: absolute;
        top: 0;
        left: 0;
      }
      h2 { text-align: center; font-size: 14px; margin-bottom: 2px; }
      p { margin: 1px 0; }
      .center { text-align: center; }
      .divider {
        display: block;
        border-bottom: 1px dashed #000;
        margin: 5px 0;
        width: 100%;
      }
      .item {
        display: flex;
        justify-content: space-between;
        margin: 2px 0;
        gap: 4px;
      }
      .item span:first-child { flex: 1; word-break: break-word; }
      .total-row {
        display: flex;
        justify-content: space-between;
        font-weight: bold;
        font-size: 13px;
        margin-top: 4px;
      }
      .footer {
        text-align: center;
        margin-top: 10px;
        font-size: 11px;
        padding-bottom: 8px;
      }
      img {
        display: block;
        margin: 0 auto 6px;
        max-height: 48px;
        max-width: 256px;
        object-fit: contain;
      }
    </style>
  </head>
  <body>${content}</body>
</html>`;
}
// ============= PRINTING HELPERS =============
const PX_TO_MICRONS = 25400 / 96;
const RECEIPT_WIDTH_MICRONS = 72000; // 72mm thermal paper

/** Load HTML in a hidden window via temp file, wait for full render. */
async function loadHtmlWindow(html: string, width: number): Promise<BrowserWindow> {
  const tmpFile = path.join(app.getPath('temp'), `receipt_${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html, 'utf-8');

  // Position the window off the visible area so it can be "shown" (required for
  // the system print dialog to surface) without the user seeing the raw HTML.
  const win = new BrowserWindow({
    show: false,
    x: -99999,
    y: -99999,
    width,
    height: 1200,
    useContentSize: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  await new Promise<void>((resolve, reject) => {
    win.webContents.once('did-finish-load', () => resolve());
    win.webContents.once('did-fail-load', (_e, code, desc) =>
      reject(new Error(`Failed to load receipt: ${code} ${desc}`))
    );
    win.loadFile(tmpFile);
  });

  await new Promise(resolve => setTimeout(resolve, 800));
  try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  return win;
}

/** A4-friendly receipt template for PDF saving (renders nicely in any PDF viewer). */
function buildReceiptPdfHtml(content: string): string {
  if (content.trim().toLowerCase().startsWith('<!doctype html')) {
    return content;
  }
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8"/>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body {
        width: 100%;
        margin: 0;
        padding: 0;
        background: white;
        color: #000;
      }
      body {
        font-family: 'Courier New', Courier, monospace;
        font-size: 13px;
        line-height: 1.6;
        padding: 30px 0;
        display: flex;
        justify-content: center;
      }
      .receipt {
        width: 340px;
        padding: 0 10px;
      }
      h2 { text-align: center; font-size: 18px; margin-bottom: 4px; }
      p { margin: 2px 0; font-size: 13px; }
      .center { text-align: center; }
      .divider {
        border-bottom: 1px dashed #000;
        margin: 8px 0;
        width: 100%;
      }
      .item {
        display: flex;
        justify-content: space-between;
        margin: 4px 0;
        gap: 8px;
      }
      .item span:first-child { flex: 1; word-break: break-word; }
      .total-row {
        display: flex;
        justify-content: space-between;
        font-weight: bold;
        font-size: 15px;
        margin-top: 6px;
      }
      .footer {
        text-align: center;
        margin-top: 16px;
        font-size: 12px;
        padding-bottom: 10px;
      }
      img {
        display: block;
        margin: 0 auto 8px;
        max-height: 64px;
        max-width: 300px;
        object-fit: contain;
      }
    </style>
  </head>
  <body><div class="receipt">${content}</div></body>
</html>`;
}

// ============= PRINTING HANDLERS =============
ipcMain.handle('print-invoice', async (_, htmlContent: string) => {
  try {
    if (!mainWindow) throw new Error('No main window available');
    if (typeof htmlContent !== 'string' || htmlContent.length === 0) {
      throw new Error('Invalid print payload');
    }
    if (htmlContent.length > 500_000) {
      throw new Error('Print payload too large');
    }

    let receiptSize = 'thermal';
    let invoiceStyle = 'thermal';
    if (db) {
      try {
        const settingsRow = db.prepare('SELECT receipt_size, invoice_style FROM settings LIMIT 1').get() as any;
        if (settingsRow) {
          receiptSize = settingsRow.receipt_size || 'thermal';
          invoiceStyle = settingsRow.invoice_style || 'thermal';
        }
      } catch (e) {
        logger.warn('Failed to read print settings:', e);
      }
    }

    const isFullHtml = htmlContent.trim().toLowerCase().startsWith('<!doctype html');
    let targetSize = receiptSize;
    if (isFullHtml) {
      if (htmlContent.includes('width: 210mm') || htmlContent.includes('210mm')) {
        targetSize = 'a4';
      } else if (htmlContent.includes('width: 148mm') || htmlContent.includes('148mm')) {
        targetSize = 'a5';
      } else if (invoiceStyle === 'formal') {
        targetSize = 'a4';
      }
    } else {
      if (invoiceStyle === 'formal' || receiptSize === 'a4') {
        targetSize = 'a4';
      } else if (receiptSize === 'a5') {
        targetSize = 'a5';
      }
    }

    let winWidth = 272; // default thermal
    if (targetSize === 'a4') winWidth = 794;
    else if (targetSize === 'a5') winWidth = 561;

    const printWindow = await loadHtmlWindow(buildReceiptHtml(htmlContent), winWidth);

    let printOptions: any = {
      silent: false,
      printBackground: true,
    };

    if (targetSize === 'thermal') {
      const contentHeightPx: number = await printWindow.webContents.executeJavaScript(
        'document.body.offsetHeight'
      );
      const heightMicrons = Math.ceil(contentHeightPx * PX_TO_MICRONS) + 2000;
      printOptions.pageSize = { width: RECEIPT_WIDTH_MICRONS, height: heightMicrons };
      printOptions.margins = { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 };
      printOptions.scaleFactor = 100;
    } else if (targetSize === 'a5') {
      printOptions.pageSize = 'A5';
      printOptions.margins = { marginType: 'default' };
    } else {
      printOptions.pageSize = 'A4';
      printOptions.margins = { marginType: 'default' };
    }

    // Show the window briefly so the system print dialog surfaces on top of
    // the main window — without this, on some machines the dialog appears
    // behind the app or in the background taskbar entry.
    printWindow.setAlwaysOnTop(true, 'screen-saver');
    printWindow.show();

    return new Promise((resolve) => {
      printWindow.webContents.print(
        printOptions,
        (success, reason) => {
          printWindow.setAlwaysOnTop(false);
          printWindow.close();
          if (success) {
            logger.info('Invoice printed successfully');
            resolve({ success: true });
          } else {
            logger.error('Print failed:', reason);
            resolve({ success: false, error: reason });
          }
        }
      );
    });
  } catch (error: any) {
    logger.error('Failed to print invoice:', error);
    return { success: false, error: error.message };
  }
});

// â”€â”€ Save receipt as A4 PDF â”€â”€
ipcMain.handle('save-invoice-pdf', async (_, htmlContent: string) => {
  try {
    if (typeof htmlContent !== 'string' || htmlContent.length === 0) {
      throw new Error('Invalid PDF payload');
    }
    if (htmlContent.length > 500_000) {
      throw new Error('PDF payload too large');
    }
    const isStatement = htmlContent.includes('ACCOUNT STATEMENT');

    // Always parent the dialog to mainWindow so it appears on top of the app
    // and isn't hidden behind it (critical on secondary machines / multi-monitor).
    const saveDialogTarget = mainWindow ?? undefined;
    const { filePath, canceled } = await dialog.showSaveDialog(saveDialogTarget as any, {
      title: isStatement ? 'Save Statement as PDF' : 'Save Receipt as PDF',
      defaultPath: `${isStatement ? 'statement' : 'receipt'}-${Date.now()}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) return { success: false, error: 'Cancelled' };

    let receiptSize = 'thermal';
    let invoiceStyle = 'thermal';
    if (db) {
      try {
        const settingsRow = db.prepare('SELECT receipt_size, invoice_style FROM settings LIMIT 1').get() as any;
        if (settingsRow) {
          receiptSize = settingsRow.receipt_size || 'thermal';
          invoiceStyle = settingsRow.invoice_style || 'thermal';
        }
      } catch (e) {
        logger.warn('Failed to read print settings for PDF:', e);
      }
    }

    const isFullHtml = htmlContent.trim().toLowerCase().startsWith('<!doctype html');
    let targetSize = receiptSize;
    if (isFullHtml) {
      if (htmlContent.includes('210mm')) targetSize = 'a4';
      else if (htmlContent.includes('148mm')) targetSize = 'a5';
      else if (invoiceStyle === 'formal') targetSize = 'a4';
    } else {
      if (invoiceStyle === 'formal' || receiptSize === 'a4') targetSize = 'a4';
      else if (receiptSize === 'a5') targetSize = 'a5';
    }

    let winWidth = 595;
    if (targetSize === 'thermal') winWidth = 340;
    else if (targetSize === 'a5') winWidth = 420;

    const printWindow = await loadHtmlWindow(buildReceiptPdfHtml(htmlContent), winWidth);

    let pdfPageSize: any = 'A4';
    let pdfMargins: any = { marginType: 'default' };
    if (targetSize === 'thermal') {
      const contentHeightPx: number = await printWindow.webContents.executeJavaScript(
        'Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)'
      );
      const heightMicrons = Math.max(50000, Math.ceil(contentHeightPx * PX_TO_MICRONS) + 6000);
      pdfPageSize = { width: 80000, height: heightMicrons };
      pdfMargins = { marginType: 'none' };
    } else if (targetSize === 'a5') {
      pdfPageSize = 'A5';
      pdfMargins = { marginType: 'default' };
    }

    const pdfBuffer = await printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: pdfPageSize,
      margins: pdfMargins,
    });

    printWindow.close();
    fs.writeFileSync(filePath, pdfBuffer);
    logger.info(`Receipt PDF saved: ${filePath}`);

    shell.openPath(filePath);

    return { success: true, path: filePath };

  } catch (error: any) {
    logger.error('Failed to save PDF:', error);
    return { success: false, error: error.message };
  }
});
// ============= UTILITY HANDLERS =============

ipcMain.handle('backup-database', async () => {
  try {
    if (!db) throw new Error('Database not initialized');

    const backupPath = path.join(app.getPath('userData'), `backup_${Date.now()}.db`);

    // Fix: Pass the path string directly and await the promise
    await (db as any).backup(backupPath);

    logger.info(`Database backed up to: ${backupPath}`);
    return { success: true, path: backupPath };
  } catch (error: any) {
    logger.error('Backup failed:', error);
    return { success: false, error: error.message };
  }
});

// ============= NEW HANDLERS =============

ipcMain.handle('update-sale-status', async (_, saleId: number, status: string) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const validStatuses = ['Completed', 'Returned', 'Cancelled'];
    if (!validStatuses.includes(status)) throw new Error('Invalid status');

    db.prepare('UPDATE sales SET status = ? WHERE id = ?').run(status, saleId);
    logger.info(`Sale ${saleId} status updated to ${status}`);
    return { success: true };
  } catch (error: any) {
    logger.error('Failed to update sale status:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-all-data', async () => {
  try {
    if (!db) throw new Error('Database not initialized');
    db.prepare('PRAGMA foreign_keys = OFF').run();
    db.prepare('DELETE FROM sale_items').run();
    db.prepare('DELETE FROM sales').run();
    db.prepare('DELETE FROM customers').run();
    db.prepare('DELETE FROM products').run();

    // Reset Settings dynamically without dropping so the app doesn't crash
    db.prepare("UPDATE settings SET store_name = 'Retailer Shop', store_phone = '', store_address = '', store_logo = '', receipt_footer = 'Thank you for visiting!', pos_password = '1234' WHERE id = 1").run();

    db.prepare('DELETE FROM sqlite_sequence').run(); // Reset AI counters
    db.prepare('PRAGMA foreign_keys = ON').run();
    logger.info('All data deleted successfully and settings factory reset');
    return { success: true };
  } catch (error: any) {
    logger.error('Failed to delete all data:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('seed-database', async () => {
  try {
    if (!db) throw new Error('Database not initialized');

    const categories = ['Groceries', 'Electronics', 'Clothing', 'Snacks', 'Beverages', 'Personal Care', 'Home & Kitchen', 'Stationery'];
    const productPrefixes = ['Premium', 'Organic', 'Global', 'Smart', 'Elite', 'Eco', 'Super', 'Pure'];
    const productTypes = ['Water', 'Milk', 'Bread', 'Phone', 'Shirt', 'Chips', 'Soda', 'Soap', 'Pan', 'Pen', 'Chocolate', 'Rice', 'Oil'];
    const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'Ahmed', 'Ali', 'Fatima', 'Zainab', 'Omar', 'Ayesha'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Khan', 'Ahmed', 'Malik', 'Butt', 'Sheikh'];
    const vendorTypes = ['Supplies Ltd', 'Trading Co', 'Distribution', 'Wholesale', 'Enterprises', 'Logistics', 'Foods Group'];

    db.transaction(() => {
      // 1. Seed Vendors (150)
      const insertVendor = db!.prepare("INSERT INTO vendors (name, phone, address, created_at) VALUES (?, ?, ?, datetime('now', 'localtime'))");
      for (let i = 0; i < 150; i++) {
        const name = `${productPrefixes[i % 8]} ${lastNames[i % 12]} ${vendorTypes[i % 7]} ${i + 1}`;
        const phone = `03${Math.floor(100000000 + Math.random() * 900000000)}`;
        const address = `${Math.floor(Math.random() * 500)} Street, Area ${i % 10}, City Center`;
        insertVendor.run(name, phone, address);
      }

      // 2. Seed Products (200)
      const insertProduct = db!.prepare("INSERT INTO products (name, price, purchase_price, stock, barcode, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))");
      const productIds: any[] = [];
      for (let i = 0; i < 200; i++) {
        const category = categories[i % categories.length];
        const name = `${productPrefixes[i % 8]} ${productTypes[i % 13]} ${i + 1} (${Math.random().toString(36).substring(7)})`;
        const purchasePrice = Math.floor(Math.random() * 1000) + 50;
        const retailPrice = Math.floor(purchasePrice * 1.25);
        const stock = Math.floor(Math.random() * 100) + 10;
        const barcode = `890${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        try {
          const info = insertProduct.run(name, retailPrice, purchasePrice, stock, barcode, category);
          productIds.push({ id: info.lastInsertRowid, name, price: retailPrice, purchase_price: purchasePrice });
        } catch (e) { }
      }

      // 3. Seed Customers (100)
      const insertCustomer = db!.prepare("INSERT INTO customers (name, phone, email, address, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))");
      const customerIds: any[] = [];
      for (let i = 0; i < 100; i++) {
        const name = `${firstNames[i % 16]} ${lastNames[i % 12]} ${i + 1}`;
        const phone = `03${Math.floor(100000000 + Math.random() * 900000000)}`;
        const email = `${name.toLowerCase().replace(/ /g, '.')}@example.com`;
        const address = `Block ${String.fromCharCode(65 + (i % 6))}, House ${i + 1}`;
        const info = insertCustomer.run(name, phone, email, address);
        customerIds.push(info.lastInsertRowid);
      }

      // 4. Seed Sales (500)
      const insertSale = db!.prepare("INSERT INTO sales (customer_id, total, subtotal, discount, tax, payment_method, payment_status, date_created) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime', ?))");
      const insertSaleItem = db!.prepare("INSERT INTO sale_items (sale_id, product_id, product_name, quantity, price, purchase_price, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime', ?))");

      for (let i = 0; i < 500; i++) {
        const customer_id = Math.random() > 0.2 ? customerIds[Math.floor(Math.random() * customerIds.length)] : null;
        const numItems = Math.floor(Math.random() * 3) + 1;
        const saleItems: any[] = [];
        let subtotal = 0;
        for (let j = 0; j < numItems; j++) {
          const p = productIds[Math.floor(Math.random() * productIds.length)];
          if (!p) continue;
          const qty = Math.floor(Math.random() * 2) + 1;
          saleItems.push({ ...p, quantity: qty });
          subtotal += p.price * qty;
        }
        const total = subtotal;
        const daysOffset = `-${Math.floor(Math.random() * 60)} days`;
        const saleInfo = insertSale.run(customer_id, total, subtotal, 0, 0, 'cash', 'Paid', daysOffset);
        for (const item of saleItems) {
          insertSaleItem.run(saleInfo.lastInsertRowid, item.id, item.name, item.quantity, item.price, item.purchase_price, daysOffset);
        }
      }

      // 5. Seed Payments (100)
      const insertPayment = db!.prepare("INSERT INTO customer_payments (customer_id, amount, notes, date_added) VALUES (?, ?, ?, datetime('now', 'localtime', ?))");
      for (let i = 0; i < 100; i++) {
        const cid = customerIds[Math.floor(Math.random() * customerIds.length)];
        const offset = `-${Math.floor(Math.random() * 15)} days`;
        insertPayment.run(cid, Math.floor(Math.random() * 2000) + 100, 'Seed Payment', offset);
      }
    })();

    return { success: true };
  } catch (error: any) {
    logger.error('Seed failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-data', async () => {
  try {
    if (!db) throw new Error('Database not initialized');
    const tableRows = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
    `).all() as Array<{ name: string }>;

    const tables: Record<string, any[]> = {};
    for (const t of tableRows) {
      const tableName = t.name;
      tables[tableName] = db.prepare(`SELECT * FROM "${tableName}"`).all();
    }

    // Keep top-level table keys for backward compatibility with existing UI.
    const data = {
      __format: 'pos_full_backup_v2',
      exportedAt: new Date().toISOString(),
      tables,
      ...tables
    };
    logger.info('Data exported successfully');
    return { success: true, data };
  } catch (error: any) {
    logger.error('Failed to export data:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-data', async (_, data: any) => {
  try {
    if (!db) throw new Error('Database not initialized');
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid or corrupted import data format');
    }

    const importTables: Record<string, any[]> =
      data.tables && typeof data.tables === 'object'
        ? data.tables
        : data;

    if (!importTables || Object.keys(importTables).length === 0) {
      throw new Error('No table data found in backup payload');
    }

    const importedProducts = Array.isArray(importTables.products) ? importTables.products : [];
    const backupIncludesProductStock = importedProducts.some((row: any) =>
      row && typeof row === 'object' && Object.prototype.hasOwnProperty.call(row, 'stock')
    );

    // Attempt backup before import
    try {
      const backupPath = path.join(app.getPath('userData'), `backup_before_import_${Date.now()}.db`);
      await (db as any).backup(backupPath);
      logger.info(`Pre-import backup saved to: ${backupPath}`);
    } catch (e) {
      logger.warn('Failed to create pre-import backup:', e);
    }

    db.transaction(() => {
      db!.prepare('PRAGMA foreign_keys = OFF').run();

      const existingTableRows = db!.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
      `).all() as Array<{ name: string }>;
      const existingTables = new Set(existingTableRows.map((r) => r.name));

      // Clear existing data
      for (const t of existingTableRows) {
        db!.prepare(`DELETE FROM "${t.name}"`).run();
      }

      const preferredOrder = [
        'settings',
        'products',
        'customers',
        'vendors',
        'accounts',
        'sales',
        'sale_items',
        'purchases',
        'inventory_batches',
        'account_txns',
        'customer_payments',
        'vendor_payments',
        'sale_returns',
        'sale_return_items',
        'purchase_returns',
        'purchase_return_items',
        'expenses',
        'registers',
        'financial_transactions',
        'entity_history'
      ];

      const inputTableNames = Object.keys(importTables).filter((k) => existingTables.has(k) && Array.isArray(importTables[k]));
      const orderedTables = [
        ...preferredOrder.filter((k) => inputTableNames.includes(k)),
        ...inputTableNames.filter((k) => !preferredOrder.includes(k)).sort()
      ];

      for (const tableName of orderedTables) {
        const rows = importTables[tableName];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        const cols = (db!.prepare(`PRAGMA table_info("${tableName}")`).all() as any[]).map((c) => c.name);
        if (cols.length === 0) continue;
        const colSet = new Set(cols);

        for (const rawRow of rows) {
          if (!rawRow || typeof rawRow !== 'object') continue;
          const keys = Object.keys(rawRow).filter((k) => colSet.has(k));
          if (keys.length === 0) continue;

          const placeholders = keys.map(() => '?').join(',');
          const sql = `INSERT OR REPLACE INTO "${tableName}" (${keys.map((k) => `"${k}"`).join(',')}) VALUES (${placeholders})`;
          db!.prepare(sql).run(...keys.map((k) => (rawRow as any)[k]));
        }
      }

      // Rebuild product stock from batches only for legacy backups that do not include products.stock.
      if (!backupIncludesProductStock && existingTables.has('inventory_batches') && existingTables.has('products')) {
        db!.prepare(`
          UPDATE products
          SET stock = COALESCE((
            SELECT SUM(CAST(quantity_remaining AS REAL))
            FROM inventory_batches b
            WHERE b.product_id = products.id
          ), stock)
          WHERE id IN (
            SELECT DISTINCT product_id
            FROM inventory_batches
            WHERE product_id IS NOT NULL
          )
        `).run();
      }

      if (existingTables.has('settings')) {
        db!.prepare(`INSERT OR IGNORE INTO settings (id) VALUES (1)`).run();
        db!.prepare(`
          UPDATE settings
          SET
            store_name = COALESCE(NULLIF(store_name, ''), 'Retailer Shop'),
            store_phone = COALESCE(store_phone, ''),
            store_address = COALESCE(store_address, ''),
            store_logo = COALESCE(store_logo, ''),
            receipt_footer = COALESCE(NULLIF(receipt_footer, ''), 'Thank you for visiting!'),
            pos_password = COALESCE(NULLIF(pos_password, ''), '1234')
          WHERE id = 1
        `).run();
      }

      db!.prepare('PRAGMA foreign_keys = ON').run();
    })();

    logger.info('Data imported successfully');
    return { success: true };
  } catch (error: any) {
    logger.error('Failed to import data:', error);
    return { success: false, error: 'Import failed: ' + error.message };
  }
});

// ============= VENDOR HANDLERS =============
ipcMain.handle('get-vendors', async () => {
  try {
    if (!db) throw new Error('Database not initialized');

    const vendors = db.prepare(`
      SELECT v.*,
             (
               SELECT MAX(dt) FROM (
                 SELECT p2.date_created as dt FROM purchases p2 WHERE p2.vendor_id = v.id
                 UNION ALL
                 SELECT vp.date_created as dt FROM vendor_payments vp WHERE vp.vendor_id = v.id
                 UNION ALL
                 SELECT pr.date_created as dt
                 FROM purchase_returns pr
                 JOIN purchases p3 ON pr.purchase_id = p3.id
                 WHERE p3.vendor_id = v.id
               )
             ) as last_activity,
             COALESCE((
               SELECT SUM(rem) FROM (
                 SELECT CAST(p.total AS REAL) - 
                        COALESCE((SELECT SUM(CAST(vp.amount AS REAL)) FROM vendor_payments vp WHERE vp.purchase_id = p.id), 0) -
                        COALESCE((SELECT SUM(CAST(pr.total_returned AS REAL)) FROM purchase_returns pr WHERE pr.purchase_id = p.id), 0) as rem
                 FROM purchases p 
                 WHERE CAST(p.vendor_id AS INTEGER) = v.id AND (p.status IS NULL OR LOWER(p.status) != 'cancelled')
               ) WHERE rem > 0.5
             ), 0) as balance
      FROM vendors v
      ORDER BY balance DESC, v.name ASC
    `).all();
    return { success: true, data: vendors };
  } catch (error: any) {
    logger.error('Failed to get vendors:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-vendor-details', async (_, vendorId: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(vendorId);
    if (!vendor) throw new Error('Vendor not found');

    const purchases = db.prepare('SELECT * FROM purchases WHERE vendor_id = ? ORDER BY date_created DESC').all(vendorId);
    const payments = db.prepare('SELECT * FROM vendor_payments WHERE vendor_id = ? ORDER BY date_created DESC').all(vendorId);
    const returns = db.prepare(`
      SELECT pr.*, p.date_created as purchase_date
      FROM purchase_returns pr
      JOIN purchases p ON pr.purchase_id = p.id
      WHERE p.vendor_id = ?
      ORDER BY pr.date_created DESC
    `).all(vendorId);
    const historyRows = db.prepare(`
      SELECT *
      FROM entity_history
      WHERE entity_type = 'vendor' AND entity_id = ?
      ORDER BY created_at DESC, id DESC
    `).all(vendorId) as any[];

    const purchaseItemsAll = db.prepare(`
      SELECT ib.*, p.name as product_name
      FROM inventory_batches ib
      JOIN products p ON ib.product_id = p.id
      JOIN purchases pur ON ib.purchase_id = pur.id
      WHERE pur.vendor_id = ?
    `).all(vendorId);

    // Link payments and returns to specific purchases
    const enhancedPurchases = purchases.map((p: any) => {
      const linkedPayments = payments.filter((pay: any) => pay.purchase_id === p.id);
      const linkedReturns = returns.filter((ret: any) => ret.purchase_id === p.id);
      const linkedItems = purchaseItemsAll.filter((item: any) => item.purchase_id === p.id);

      const amountPaid: number = linkedPayments.reduce((acc: number, pay: any) => acc + (Number(pay.amount) || 0), 0);
      const amountReturned: number = linkedReturns.reduce((acc: number, ret: any) => acc + (Number(ret.total_returned) || 0), 0);

      return {
        ...p,
        amountPaid,
        amountReturned,
        remaining: (p.status === 'Cancelled' ? 0 : (Number(p.total) || 0)) - amountPaid - amountReturned,
        linkedPayments,
        linkedReturns,
        items: linkedItems
      };
    });

    const totalPurchased = purchases.filter((p: any) => p.status !== 'Cancelled').reduce((acc: number, p: any) => acc + (Number(p.total) || 0), 0);
    const totalPaid = payments.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
    const totalReturned = returns.reduce((acc: number, r: any) => acc + (Number(r.total_returned) || 0), 0);
    const unpaidBalance = enhancedPurchases.reduce((acc: number, p: any) => {
      return acc + Math.max(0, Number(p.remaining) || 0);
    }, 0);

    const history = historyRows.map((h: any) => ({
      id: h.id,
      type: h.history_type,
      amount: Number(h.amount) || 0,
      relatedId: h.related_record_id,
      relatedType: h.related_record_type,
      notes: h.notes || '',
      status: h.action_status || 'COMPLETED',
      date: h.created_at
    }));

    return {
      success: true,
      data: {
        vendor,
        purchases: enhancedPurchases,
        payments,
        returns,
        history,
        totalPurchased,
        totalPaid,
        totalReturned,
        balance: unpaidBalance
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-vendor-payment', async (_, data: { vendor_id: number; amount: number; notes?: string; purchase_id?: number }) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare('INSERT INTO vendor_payments (vendor_id, amount, notes, purchase_id, date_created) VALUES (?, ?, ?, ?, datetime(\'now\', \'localtime\'))');
    const info = stmt.run(data.vendor_id, data.amount, data.notes || '', data.purchase_id || null);
    logEntityHistory(db, {
      entityType: 'vendor',
      entityId: data.vendor_id,
      historyType: 'PAYMENT_ADDED',
      amount: data.amount,
      relatedRecordId: Number(info.lastInsertRowid),
      relatedRecordType: 'vendor_payment',
      notes: data.notes || (data.purchase_id ? `Payment for purchase #${data.purchase_id}` : 'Manual payment recorded'),
      actionStatus: 'COMPLETED'
    });

    // Enqueue for cloud sync
    try {
      const paymentRow = db.prepare('SELECT * FROM vendor_payments WHERE id = ?').get(info.lastInsertRowid);
      db.prepare(`INSERT INTO cloud_sync_queue (entity_type, operation, payload, status) VALUES ('vendor_payment', 'create', ?, 'pending')`).run(JSON.stringify(paymentRow));
    } catch (syncErr: any) { logger.warn('Sync enqueue (add-vendor-payment) failed:', syncErr.message); }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-vendor-payment', async (_, paymentId: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const payment = db.prepare('SELECT * FROM vendor_payments WHERE id = ?').get(paymentId) as any;
    if (!payment) throw new Error('Payment not found');
    logEntityHistory(db, {
      entityType: 'vendor',
      entityId: payment.vendor_id,
      historyType: 'PAYMENT_DELETED',
      amount: payment.amount,
      relatedRecordId: payment.id,
      relatedRecordType: 'vendor_payment',
      notes: payment.notes || 'Deleted by user',
      actionStatus: 'DELETED'
    });
    db.prepare('DELETE FROM vendor_payments WHERE id = ?').run(paymentId);

    // Enqueue for cloud sync
    try {
      db.prepare(`INSERT INTO cloud_sync_queue (entity_type, operation, payload, status) VALUES ('vendor_payment', 'delete', ?, 'pending')`).run(JSON.stringify({ id: paymentId, vendor_id: payment.vendor_id }));
    } catch (syncErr: any) { logger.warn('Sync enqueue (delete-vendor-payment) failed:', syncErr.message); }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cancel-purchase', async (_, purchaseId: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const purchase = db.prepare('SELECT id, vendor_id FROM purchases WHERE id = ?').get(purchaseId) as any;
    if (!purchase) throw new Error('Purchase not found');
    db.prepare("UPDATE purchases SET status = 'Cancelled' WHERE id = ?").run(purchaseId);
    logEntityHistory(db, {
      entityType: 'vendor',
      entityId: purchase.vendor_id,
      historyType: 'PURCHASE_CANCELLED',
      amount: 0,
      relatedRecordId: purchase.id,
      relatedRecordType: 'purchase',
      notes: `Purchase #${purchase.id} cancelled`,
      actionStatus: 'CANCELLED'
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-vendor', async (_, vendor: { name: string; phone?: string; address?: string }) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare('INSERT INTO vendors (name, phone, address) VALUES (?, ?, ?)');
    const info = stmt.run(vendor.name.trim(), vendor.phone || '', vendor.address || '');
    const newVendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(info.lastInsertRowid);

    // Enqueue for cloud sync
    try {
      db.prepare(`INSERT INTO cloud_sync_queue (entity_type, operation, payload, status) VALUES ('vendor', 'create', ?, 'pending')`).run(JSON.stringify(newVendor));
    } catch (syncErr: any) { logger.warn('Sync enqueue (add-vendor) failed:', syncErr.message); }

    return { success: true, data: newVendor };
  } catch (error: any) {
    logger.error('Failed to add vendor:', error);
    return { success: false, error: error.message };
  }
});

// ============= PURCHASES / INVENTORY BATCHES =============
ipcMain.handle('create-purchase', async (_, data: { vendor_id: number; items: any[]; total: number; amount_paid?: number; account_id?: number }) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const transaction = db.transaction(() => {
      // Get current register if any
      const reg = db!.prepare("SELECT id FROM registers WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1").get() as any;
      const determinedStatus = (data.amount_paid || 0) >= data.total ? 'Completed' : (data.amount_paid || 0) > 0 ? 'Partial' : 'Pending';
      const purchaseStmt = db!.prepare("INSERT INTO purchases (vendor_id, total, status, date_created, register_id) VALUES (?, ?, ?, datetime('now', 'localtime'), ?)");
      const info = purchaseStmt.run(data.vendor_id, data.total, determinedStatus, reg?.id || null);
      const purchaseId = info.lastInsertRowid;

      const batchStmt = db!.prepare(`
        INSERT INTO inventory_batches (product_id, vendor_id, purchase_id, quantity_added, quantity_remaining, purchase_price, date_added)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      `);

      for (const item of data.items) {
        batchStmt.run(item.product_id, data.vendor_id, purchaseId, item.quantity, item.quantity, item.purchase_price);

        // Update WAC, stock and Selling Price in products table
        if (item.product_id) {
          const p = db!.prepare('SELECT stock, purchase_price, price FROM products WHERE id = ?').get(item.product_id) as any;
          if (p) {
            const oldStock = p.stock || 0;
            const oldPrice = p.purchase_price || 0;
            const newStock = oldStock + item.quantity;
            let newWAC = item.purchase_price;
            // Use provided selling_price or keep the current one
            const finalSellingPrice = item.selling_price || p.price;

            // Update the product's master record with NEW stock and the LATEST purchase price
            db!.prepare('UPDATE products SET stock = ?, purchase_price = ?, price = ? WHERE id = ?')
              .run(newStock, item.purchase_price, finalSellingPrice, item.product_id);
          }
        }
      }

      // Record initial payment if provided
      if (data.amount_paid && data.amount_paid > 0) {
        db!.prepare(`
          INSERT INTO vendor_payments (vendor_id, amount, notes, purchase_id, date_created)
          VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
        `).run(data.vendor_id, data.amount_paid, `Initial Payment for PO #${purchaseId}`, purchaseId);
      }

      // ── Account cash-flow recording ──
      if (data.account_id && data.amount_paid && data.amount_paid > 0) {
        db!.prepare(`
          INSERT INTO account_txns (account_id, type, amount, category, note, date_created)
          VALUES (?, 'out', ?, 'purchase', ?, datetime('now', 'localtime'))
        `).run(
          data.account_id,
          data.amount_paid,
          `Purchase payment — PO #${purchaseId}`
        );
        recomputeAccountBalance(db!, data.account_id);
      }

      return purchaseId;
    });
    const purchaseId = transaction();

    // Trigger auto-export after a successful purchase
    triggerAutoExport();

    // Enqueue purchase + its items for cloud sync
    try {
      const purchaseRow = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId as number) as any;
      const purchaseItems = db.prepare('SELECT * FROM inventory_batches WHERE purchase_id = ?').all(purchaseId as number);
      if (purchaseRow) {
        db.prepare(`INSERT INTO cloud_sync_queue (entity_type, operation, payload, status) VALUES ('purchase', 'create', ?, 'pending')`).run(JSON.stringify({ ...purchaseRow, items: purchaseItems }));
      }
    } catch (syncErr: any) { logger.warn('Sync enqueue (create-purchase) failed:', syncErr.message); }

    return { success: true, data: { purchaseId } };
  } catch (error: any) {
    logger.error('Failed to create purchase:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-inventory-batches', async (_, productId?: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    let query = 'SELECT b.*, v.name as vendor_name FROM inventory_batches b LEFT JOIN vendors v ON b.vendor_id = v.id WHERE b.quantity_remaining > 0';
    let params: any[] = [];
    if (productId) {
      query += ' AND b.product_id = ?';
      params.push(productId);
    }
    query += ' ORDER BY b.date_added ASC';
    const batches = db.prepare(query).all(...params);
    return { success: true, data: batches };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-purchase-items', async (_, purchaseId: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const items = db.prepare(`
      SELECT ib.*, p.name as product_name,
      (SELECT COALESCE(SUM(quantity), 0) FROM purchase_return_items WHERE product_id = ib.product_id AND return_id IN (SELECT id FROM purchase_returns WHERE purchase_id = ib.purchase_id)) as quantity_returned
      FROM inventory_batches ib
      LEFT JOIN products p ON ib.product_id = p.id
      WHERE ib.purchase_id = ?
    `).all(purchaseId);
    return { success: true, data: items };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Get all purchases for a vendor (with line items), for printing vendor invoices
ipcMain.handle('get-vendor-purchases', async (_, vendorId?: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    let query = `
      SELECT p.*, v.name as vendor_name, v.phone as vendor_phone
      FROM purchases p
      LEFT JOIN vendors v ON p.vendor_id = v.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (vendorId) { query += ' AND p.vendor_id = ?'; params.push(vendorId); }
    query += ' ORDER BY p.date_created DESC LIMIT 50';
    const purchases = db.prepare(query).all(...params) as any[];

    // Attach line items to each purchase
    const itemStmt = db.prepare(`
      SELECT ib.*, p.name as product_name
      FROM inventory_batches ib
      LEFT JOIN products p ON ib.product_id = p.id
      WHERE ib.purchase_id = ?
    `);
    const result = purchases.map(pur => ({
      ...pur,
      items: itemStmt.all(pur.id),
    }));
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Product analytics - per product stats
ipcMain.handle('get-product-analytics', async () => {
  try {
    if (!db) throw new Error('Database not initialized');
    const data = db.prepare(`
      SELECT
        p.id, p.name, p.price, p.purchase_price, p.stock, p.category, p.created_at,
        COALESCE(SUM(si.quantity), 0) as total_sold,
        COALESCE(SUM(si.quantity * si.price), 0) as total_revenue,
        COALESCE(SUM(si.quantity * p.purchase_price), 0) as total_cogs,
        COALESCE(SUM(si.quantity * (si.price - p.purchase_price)), 0) as total_profit,
        (p.stock * p.purchase_price) as stock_value,
        (p.stock * p.price) as retail_value
      FROM products p
      LEFT JOIN sale_items si ON si.product_name = p.name
      LEFT JOIN sales s ON si.sale_id = s.id AND s.status = 'Completed'
      GROUP BY p.id
      ORDER BY total_profit DESC
    `).all();
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-stock-adjustment', async (_, data: { product_id: number; quantity: number; type: string; reason: string }) => {
  try {
    if (!db) throw new Error('Database not initialized');

    const { product_id, quantity, type, reason } = data;
    const isReduction = quantity < 0;
    const absQty = Math.abs(quantity);

    const transaction = db.transaction(() => {
      // 1. Log the adjustment as a financial transaction for auditing
      // Use average purchase price for cost calculation if it's a reduction
      const product = db!.prepare("SELECT name, purchase_price FROM products WHERE id = ?").get(product_id) as any;
      if (!product) throw new Error("Product not found");

      const costValue = absQty * (product.purchase_price || 0);

      db!.prepare(`
        INSERT INTO financial_transactions (type, category, amount, description, date_created)
        VALUES (?, 'Adjustment', ?, ?, datetime('now', 'localtime'))
      `).run(isReduction ? 'Expense' : 'Income', costValue, `${type}: ${reason || 'Manual Correction'} (${absQty} units of ${product.name})`);

      // 2. Adjust Batches
      if (isReduction) {
        // FIFO: Deduct from oldest available batches
        const batches = db!.prepare(`
          SELECT * FROM inventory_batches 
          WHERE product_id = ? AND quantity_remaining > 0 
          ORDER BY date_added ASC
        `).all(product_id) as any[];

        let remainingToDeduct = absQty;
        for (const batch of batches) {
          if (remainingToDeduct <= 0) break;
          const deduct = Math.min(batch.quantity_remaining, remainingToDeduct);

          db!.prepare("UPDATE inventory_batches SET quantity_remaining = quantity_remaining - ? WHERE id = ?")
            .run(deduct, batch.id);

          remainingToDeduct -= deduct;
        }

        if (remainingToDeduct > 0) {
          throw new Error(`Insufficient stock to deduct ${absQty} units. Shortage: ${remainingToDeduct}`);
        }
      } else {
        // Increase: Create a new correction batch
        db!.prepare(`
          INSERT INTO inventory_batches (product_id, quantity_added, quantity_remaining, purchase_price, date_added)
          VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
        `).run(product_id, absQty, absQty, product.purchase_price || 0);
      }

      // 3. Update master product stock count
      db!.prepare("UPDATE products SET stock = (SELECT COALESCE(SUM(quantity_remaining), 0) FROM inventory_batches WHERE product_id = ?) WHERE id = ?")
        .run(product_id, product_id);

      // 4. Log to stock_adjustments for history
      db!.prepare(`
        INSERT INTO stock_adjustments (product_id, quantity, type, reason, date_created)
        VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
      `).run(product_id, quantity, type, reason);

      return true;
    });

    transaction();
    return { success: true };
  } catch (error: any) {
    logger.error('Stock adjustment failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-stock-adjustments', async (_, productId?: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    let query = 'SELECT * FROM stock_adjustments';
    let params: any[] = [];
    if (productId) {
      query += ' WHERE product_id = ?';
      params.push(productId);
    }
    query += ' ORDER BY date_created DESC';
    const adjustments = db.prepare(query).all(...params);
    return { success: true, data: adjustments };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ============= CUSTOMER HANDLERS =============

ipcMain.handle('update-customer', async (_, id: number, customer: { name: string; phone?: string; email?: string; address?: string }) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare('UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?');
    stmt.run(customer.name.trim(), customer.phone || '', customer.email || '', customer.address || '', id);
    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);

    // Enqueue for cloud sync
    try {
      db.prepare(`INSERT INTO cloud_sync_queue (entity_type, operation, payload, status) VALUES ('customer', 'update', ?, 'pending')`).run(JSON.stringify(updated));
    } catch (syncErr: any) { logger.warn('Sync enqueue (update-customer) failed:', syncErr.message); }

    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-customer', async (_, id: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);

    // Enqueue for cloud sync
    try {
      db.prepare(`INSERT INTO cloud_sync_queue (entity_type, operation, payload, status) VALUES ('customer', 'delete', ?, 'pending')`).run(JSON.stringify({ id }));
    } catch (syncErr: any) { logger.warn('Sync enqueue (delete-customer) failed:', syncErr.message); }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ============= CUSTOMER PAYMENTS / HISTORY =============
ipcMain.handle('get-customer-details', async (_, customerId: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    if (!customerId || customerId <= 0) {
      return { success: true, data: { customer: { name: 'Walk-in Customer' }, sales: [], payments: [], totalTaken: 0, totalPaid: 0, balance: 0 } };
    }
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!customer) throw new Error('Customer not found');

    const sales = db.prepare('SELECT * FROM sales WHERE customer_id = ? ORDER BY date_created DESC').all(customerId);
    const payments = db.prepare('SELECT * FROM customer_payments WHERE customer_id = ? ORDER BY date_added DESC').all(customerId);
    const returns = db.prepare(`
      SELECT sr.*, s.date_created as sale_date 
      FROM sale_returns sr
      JOIN sales s ON sr.sale_id = s.id
      WHERE s.customer_id = ?
      ORDER BY sr.date_created DESC
    `).all(customerId);
    const historyRows = db.prepare(`
      SELECT *
      FROM entity_history
      WHERE entity_type = 'customer' AND entity_id = ?
      ORDER BY created_at DESC, id DESC
    `).all(customerId) as any[];

    const saleItemsAll = db.prepare(`
      SELECT si.*, s.customer_id
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.customer_id = ?
    `).all(customerId);

    // Link payments and returns to specific sales
    const enhancedSales = sales.map((s: any) => {
      const linkedPayments = payments.filter((pay: any) => pay.sale_id === s.id);
      const linkedReturns = returns.filter((ret: any) => ret.sale_id === s.id);
      const linkedItems = saleItemsAll.filter((item: any) => item.sale_id === s.id);

      const amountPaid: number = linkedPayments.reduce((acc: number, pay: any) => acc + (Number(pay.amount) || 0), 0);
      const amountReturned: number = linkedReturns.reduce((acc: number, ret: any) => acc + (Number(ret.total_returned) || 0), 0);

      return {
        ...s,
        amountPaid,
        amountReturned,
        remaining: (s.status === 'Cancelled' ? 0 : (Number(s.total) || 0)) - amountPaid - amountReturned,
        linkedPayments,
        linkedReturns,
        items: linkedItems
      };
    });

    // Calculate totals
    const totalTaken = sales.filter((s: any) => s.status !== 'Cancelled').reduce((acc: number, s: any) => acc + (Number(s.total) || 0), 0);
    const totalPaid = payments.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
    const totalReturned = returns.reduce((acc: number, r: any) => acc + (Number(r.total_returned) || 0), 0);
    const unpaidBalance = enhancedSales.reduce((acc: number, s: any) => {
      return acc + Math.max(0, Number(s.remaining) || 0);
    }, 0);
    const history = historyRows.map((h: any) => ({
      id: h.id,
      type: h.history_type,
      amount: Number(h.amount) || 0,
      relatedId: h.related_record_id,
      relatedType: h.related_record_type,
      notes: h.notes || '',
      status: h.action_status || 'COMPLETED',
      date: h.created_at
    }));

    return { success: true, data: { customer, sales: enhancedSales, payments, returns, history, totalTaken, totalPaid, totalReturned, balance: unpaidBalance } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-customer-payment', async (_, data: { customer_id: number; amount: number; notes?: string; sale_id?: number }) => {
  try {
    if (!db) throw new Error('Database not initialized');
    if (typeof data.amount !== 'number' || isNaN(data.amount) || data.amount <= 0) {
      throw new Error('Payment amount must be a valid positive number');
    }
    if (data.sale_id) {
      const sale = db.prepare("SELECT id, total, status FROM sales WHERE id = ?").get(data.sale_id) as any;
      if (!sale) throw new Error('Sale not found');
      if (sale.status === 'Cancelled') throw new Error('Cannot add payment to a cancelled sale');

      const alreadyPaid = Number((db.prepare("SELECT COALESCE(SUM(amount), 0) AS paid FROM customer_payments WHERE sale_id = ?").get(data.sale_id) as any)?.paid) || 0;
      const totalReturned = Number((db.prepare("SELECT COALESCE(SUM(total_returned), 0) AS returned FROM sale_returns WHERE sale_id = ?").get(data.sale_id) as any)?.returned) || 0;
      const remaining = Math.max(0, (Number(sale.total) || 0) - alreadyPaid - totalReturned);

      if (data.amount > remaining) {
        throw new Error(`Payment exceeds remaining balance. Remaining: ${remaining}`);
      }
    }
    const stmt = db.prepare('INSERT INTO customer_payments (customer_id, amount, notes, sale_id, date_added) VALUES (?, ?, ?, ?, datetime(\'now\', \'localtime\'))');
    const info = stmt.run(data.customer_id, data.amount, data.notes || '', data.sale_id || null);
    logEntityHistory(db, {
      entityType: 'customer',
      entityId: data.customer_id,
      historyType: 'PAYMENT_ADDED',
      amount: data.amount,
      relatedRecordId: Number(info.lastInsertRowid),
      relatedRecordType: 'customer_payment',
      notes: data.notes || (data.sale_id ? `Payment for sale #${data.sale_id}` : 'Manual payment recorded'),
      actionStatus: 'COMPLETED'
    });

    // Enqueue for cloud sync — critical for loan/dues recovery
    try {
      const paymentRow = db.prepare('SELECT * FROM customer_payments WHERE id = ?').get(info.lastInsertRowid);
      db.prepare(`INSERT INTO cloud_sync_queue (entity_type, operation, payload, status) VALUES ('customer_payment', 'create', ?, 'pending')`).run(JSON.stringify(paymentRow));
    } catch (syncErr: any) { logger.warn('Sync enqueue (add-customer-payment) failed:', syncErr.message); }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-customer-payment', async (_, paymentId: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const payment = db.prepare('SELECT * FROM customer_payments WHERE id = ?').get(paymentId) as any;
    if (!payment) throw new Error('Payment not found');
    logEntityHistory(db, {
      entityType: 'customer',
      entityId: payment.customer_id,
      historyType: 'PAYMENT_DELETED',
      amount: payment.amount,
      relatedRecordId: payment.id,
      relatedRecordType: 'customer_payment',
      notes: payment.notes || 'Deleted by user',
      actionStatus: 'DELETED'
    });
    db.prepare('DELETE FROM customer_payments WHERE id = ?').run(paymentId);

    // Enqueue for cloud sync
    try {
      db.prepare(`INSERT INTO cloud_sync_queue (entity_type, operation, payload, status) VALUES ('customer_payment', 'delete', ?, 'pending')`).run(JSON.stringify({ id: paymentId, customer_id: payment.customer_id }));
    } catch (syncErr: any) { logger.warn('Sync enqueue (delete-customer-payment) failed:', syncErr.message); }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cancel-sale', async (_, saleId: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const sale = db.prepare('SELECT id, customer_id FROM sales WHERE id = ?').get(saleId) as any;
    if (!sale) throw new Error('Sale not found');
    db.prepare("UPDATE sales SET status = 'Cancelled' WHERE id = ?").run(saleId);
    logEntityHistory(db, {
      entityType: 'customer',
      entityId: sale.customer_id,
      historyType: 'SALE_CANCELLED',
      amount: 0,
      relatedRecordId: sale.id,
      relatedRecordType: 'sale',
      notes: `Sale #${sale.id} cancelled`,
      actionStatus: 'CANCELLED'
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ============= PROFIT/LOSS REPORT =============
ipcMain.handle('get-profit-loss-report', async (_, data: { startDate?: string; endDate?: string } = {}) => {
  try {
    if (!db) throw new Error('Database not initialized');
    let query = `
      SELECT 
        SUM(s.total) as total_revenue,
        SUM(si.purchase_price * si.quantity) as total_cogs
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      WHERE 1=1
    `;
    let params: any[] = [];

    const sqlStart = data.startDate ? data.startDate.replace('T', ' ').substring(0, 19) : null;
    const sqlEnd = data.endDate ? data.endDate.replace('T', ' ').substring(0, 19) : null;

    if (sqlStart) {
      query += ' AND s.date_created >= ?';
      params.push(sqlStart);
    }
    if (sqlEnd) {
      query += ' AND s.date_created <= ?';
      params.push(sqlEnd);
    }
    const row = db.prepare(query).get(...params) as any;
    const revenue = row?.total_revenue || 0;
    const cogs = row?.total_cogs || 0;

    // Get Expenses
    let expQuery = 'SELECT SUM(amount) as total_expenses FROM expenses WHERE 1=1';
    let expParams: any[] = [];
    if (sqlStart) { expQuery += ' AND date_added >= ?'; expParams.push(sqlStart); }
    if (sqlEnd) { expQuery += ' AND date_added <= ?'; expParams.push(sqlEnd); }
    const expRow = db.prepare(expQuery).get(...expParams) as any;
    const expenses = expRow?.total_expenses || 0;

    const profit = revenue - cogs - expenses;

    return { success: true, data: { revenue, cogs, expenses, profit } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ============= EXPENSES HANDLERS =============
ipcMain.handle('get-expenses', async (_, opts: any = {}) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const dateFilter = String(opts.dateFilter || 'weekly');
    const startDate = opts.startDate ? getLocalSqliteDate(opts.startDate) : null;
    const endDate = opts.endDate ? getLocalSqliteDate(opts.endDate) : null;
    const whereParts: string[] = [];
    const params: any[] = [];

    if (dateFilter === 'today') {
      whereParts.push(`date(date_added) = date('now', 'localtime')`);
    } else if (dateFilter === 'weekly') {
      whereParts.push(`date(date_added) >= date('now', 'localtime', '-6 days')`);
    } else if (dateFilter === 'monthly') {
      whereParts.push(`date(date_added) >= date('now', 'localtime', '-29 days')`);
    } else if (dateFilter === 'custom') {
      if (startDate) {
        whereParts.push(`date_added >= ?`);
        params.push(startDate);
      }
      if (endDate) {
        whereParts.push(`date_added <= ?`);
        params.push(endDate);
      }
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const expenses = db.prepare(`SELECT * FROM expenses ${whereSql} ORDER BY date_added DESC`).all(...params);
    return { success: true, data: expenses };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-expense', async (_, data: { title: string; category?: string; amount: number; notes?: string; account_id?: number }) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare('INSERT INTO expenses (title, category, amount, date_added, notes) VALUES (?, ?, ?, datetime(\'now\', \'localtime\'), ?)');
    const info = stmt.run(data.title.trim(), data.category || '', data.amount, data.notes || '');

    // If account_id provided, record outgoing transaction
    if (data.account_id) {
      const acc = db.prepare('SELECT id FROM accounts WHERE id = ?').get(data.account_id);
      if (acc) {
        db.prepare(`INSERT INTO account_txns (account_id, type, amount, category, note, date_created)
          VALUES (?, 'out', ?, 'expense', ?, datetime('now', 'localtime'))`
        ).run(data.account_id, data.amount, `Expense: ${data.title.trim()}`);
        recomputeAccountBalance(db, data.account_id);
      }
    }

    // Enqueue for cloud sync
    try {
      const expenseRow = db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid);
      db.prepare(`INSERT INTO cloud_sync_queue (entity_type, operation, payload, status) VALUES ('expense', 'create', ?, 'pending')`).run(JSON.stringify(expenseRow));
    } catch (syncErr: any) { logger.warn('Sync enqueue (add-expense) failed:', syncErr.message); }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-expense', async (_, id: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);

    // Enqueue for cloud sync
    try {
      db.prepare(`INSERT INTO cloud_sync_queue (entity_type, operation, payload, status) VALUES ('expense', 'delete', ?, 'pending')`).run(JSON.stringify({ id }));
    } catch (syncErr: any) { logger.warn('Sync enqueue (delete-expense) failed:', syncErr.message); }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ============= ACCOUNTS MODULE HANDLERS =============

/** Recompute and persist an account's current_balance from all its txns */
function recomputeAccountBalance(database: Database.Database, accountId: number) {
  const result = database.prepare(`
    SELECT ROUND(a.opening_balance + COALESCE(SUM(
      CASE WHEN t.type='in' THEN t.amount WHEN t.type='out' THEN -t.amount ELSE 0 END
    ), 0), 2) as bal
    FROM accounts a
    LEFT JOIN account_txns t ON t.account_id = a.id
    WHERE a.id = ?
    GROUP BY a.id
  `).get(accountId) as any;
  database.prepare('UPDATE accounts SET current_balance = ? WHERE id = ?')
    .run(result?.bal ?? 0, accountId);
}

ipcMain.handle('get-accounts', async () => {
  try {
    if (!db) throw new Error('Database not initialized');

    // Ensure default Cash in Hand account exists
    const existing = db.prepare('SELECT id FROM accounts WHERE id = 1').get();
    if (!existing) {
      db.prepare(`INSERT OR IGNORE INTO accounts (id, name, type, opening_balance, current_balance, is_default)
        VALUES (1, 'Cash in Hand', 'cash', 0, 0, 1)`).run();
    }

    const accounts = db.prepare(`
      SELECT a.id, a.name, a.type, a.opening_balance, a.bank_name, a.account_number,
             a.notes, a.is_default, a.created_at,
             ROUND(a.opening_balance + COALESCE(SUM(
               CASE WHEN t.type='in' THEN t.amount WHEN t.type='out' THEN -t.amount ELSE 0 END
             ), 0), 2) as current_balance,
             ROUND(COALESCE(SUM(CASE WHEN t.type='in' THEN t.amount ELSE 0 END), 0), 2) as total_in,
             ROUND(COALESCE(SUM(CASE WHEN t.type='out' THEN t.amount ELSE 0 END), 0), 2) as total_out
      FROM accounts a
      LEFT JOIN account_txns t ON t.account_id = a.id
      GROUP BY a.id
      ORDER BY a.is_default DESC, a.type ASC, a.name ASC
    `).all() as any[];

    const chartData = db.prepare(`
      SELECT
        date(date_created, 'localtime') as day,
        ROUND(SUM(CASE WHEN type='in' THEN amount ELSE 0 END), 2) as total_in,
        ROUND(SUM(CASE WHEN type='out' THEN amount ELSE 0 END), 2) as total_out
      FROM account_txns
      WHERE date_created >= datetime('now', '-30 days', 'localtime')
      GROUP BY date(date_created, 'localtime')
      ORDER BY day ASC
    `).all() as any[];

    return { success: true, data: { accounts, chartData } };
  } catch (error: any) {
    logger.error('get-accounts failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-account', async (_, data: {
  name: string; type?: string; opening_balance?: number;
  bank_name?: string; account_number?: string; notes?: string;
}) => {
  try {
    if (!db) throw new Error('Database not initialized');
    if (!data.name?.trim()) throw new Error('Account name is required');
    const openBal = Number(data.opening_balance || 0);

    const info = db.prepare(`
      INSERT INTO accounts (name, type, opening_balance, current_balance, bank_name, account_number, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.name.trim(), data.type || 'cash', openBal, openBal,
      data.bank_name || '', data.account_number || '', data.notes || ''
    );

    const accountId = info.lastInsertRowid as number;

    if (openBal > 0) {
      db.prepare(`INSERT INTO account_txns (account_id, type, amount, category, note, date_created)
        VALUES (?, 'in', ?, 'opening', 'Opening Balance', datetime('now', 'localtime'))`).run(accountId, openBal);
    }

    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
    return { success: true, data: account };
  } catch (error: any) {
    logger.error('add-account failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-account', async (_, id: number, data: {
  name?: string; bank_name?: string; account_number?: string; notes?: string;
}) => {
  try {
    if (!db) throw new Error('Database not initialized');
    db.prepare(`UPDATE accounts SET
      name = CASE WHEN ? != '' THEN ? ELSE name END,
      bank_name = COALESCE(?, bank_name),
      account_number = COALESCE(?, account_number),
      notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(data.name || '', data.name || null, data.bank_name ?? null, data.account_number ?? null, data.notes ?? null, id);
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    return { success: true, data: account };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-account', async (_, id: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any;
    if (!acc) throw new Error('Account not found');
    if (acc.is_default) throw new Error('Cannot delete the default Cash in Hand account');
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-account-txns', async (_, opts: {
  account_id?: number; date_from?: string; date_to?: string;
  limit?: number; offset?: number;
} = {}) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const limit = opts.limit ?? 150;
    const offset = opts.offset ?? 0;

    let where = '1=1';
    const params: any[] = [];

    if (opts.account_id) { where += ' AND t.account_id = ?'; params.push(opts.account_id); }
    if (opts.date_from)  { where += ' AND date(t.date_created) >= ?'; params.push(opts.date_from); }
    if (opts.date_to)    { where += ' AND date(t.date_created) <= ?'; params.push(opts.date_to); }

    const txns = db.prepare(`
      SELECT t.*, a.name as account_name, a.type as account_type
      FROM account_txns t
      JOIN accounts a ON a.id = t.account_id
      WHERE ${where}
      ORDER BY t.date_created DESC, t.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as any[];

    const countRow = db.prepare(
      `SELECT COUNT(*) as total FROM account_txns t WHERE ${where}`
    ).get(...params) as any;

    return { success: true, data: txns, total: countRow?.total ?? 0 };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-account-txn', async (_, data: {
  account_id: number; type: 'in' | 'out'; amount: number;
  category?: string; note?: string; date_created?: string;
}) => {
  try {
    if (!db) throw new Error('Database not initialized');
    if (!data.account_id) throw new Error('Account is required');
    const amount = Number(data.amount);
    if (isNaN(amount) || amount <= 0) throw new Error('Amount must be a positive number');
    if (data.type !== 'in' && data.type !== 'out') throw new Error('Type must be "in" or "out"');

    const acc = db.prepare('SELECT id FROM accounts WHERE id = ?').get(data.account_id);
    if (!acc) throw new Error('Account not found');

    db.prepare(`INSERT INTO account_txns (account_id, type, amount, category, note, date_created)
      VALUES (?, ?, ?, ?, ?, COALESCE(NULLIF(?, ''), datetime('now', 'localtime')))`
    ).run(data.account_id, data.type, amount, data.category || 'manual', data.note || '', data.date_created || '');

    recomputeAccountBalance(db, data.account_id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-account-txn', async (_, id: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const txn = db.prepare('SELECT account_id FROM account_txns WHERE id = ?').get(id) as any;
    if (!txn) throw new Error('Transaction not found');
    db.prepare('DELETE FROM account_txns WHERE id = ?').run(id);
    recomputeAccountBalance(db, txn.account_id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('transfer-between-accounts', async (_, data: {
  from_account_id: number; to_account_id: number; amount: number; note?: string;
}) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const amount = Number(data.amount);
    if (isNaN(amount) || amount <= 0) throw new Error('Amount must be positive');
    if (data.from_account_id === data.to_account_id) throw new Error('Cannot transfer to the same account');

    const tx = db.transaction(() => {
      const note = data.note || 'Internal Transfer';
      db!.prepare(`INSERT INTO account_txns (account_id, type, amount, category, note, date_created) VALUES (?, 'out', ?, 'transfer', ?, datetime('now', 'localtime'))`).run(data.from_account_id, amount, note);
      db!.prepare(`INSERT INTO account_txns (account_id, type, amount, category, note, date_created) VALUES (?, 'in', ?, 'transfer', ?, datetime('now', 'localtime'))`).run(data.to_account_id, amount, note);
      recomputeAccountBalance(db!, data.from_account_id);
      recomputeAccountBalance(db!, data.to_account_id);
    });
    tx();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ============= CASH REGISTER HANDLERS =============

ipcMain.handle('get-current-register', async () => {
  try {
    if (!db) throw new Error('Database not initialized');
    const register = db.prepare("SELECT * FROM registers WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1").get();
    return { success: true, data: register };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-register', async (_, data: { openingBalance: number; openedBy?: string }) => {
  try {
    if (!db) throw new Error('Database not initialized');

    // Ensure no other register is open
    const open = db.prepare("SELECT id FROM registers WHERE status = 'open'").get();
    if (open) throw new Error('A register is already open. Close it first.');

    const stmt = db.prepare(`
      INSERT INTO registers (opening_balance, opened_by, status, opened_at, opening_time)
      VALUES (?, ?, 'open', datetime('now', 'localtime'), datetime('now', 'localtime'))
    `);
    const info = stmt.run(data.openingBalance, data.openedBy || 'Admin');

    return { success: true, data: { id: info.lastInsertRowid } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-register-summary', async (_, registerId: number) => {
  try {
    if (!db) throw new Error('Database not initialized');

    const reg = db.prepare('SELECT * FROM registers WHERE id = ?').get(registerId) as any;
    if (!reg) throw new Error('Register not found');

    const sales = db.prepare(`
      SELECT 
        COUNT(*) as count, 
        SUM(total) as total,
        SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END) as cash_total,
        SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END) as card_total
      FROM sales 
      WHERE date_created >= ? AND date_created <= ?
    `).get(reg.opened_at, reg.closed_at || '9999-12-31 23:59:59') as any;

    const returns = db.prepare(`
      SELECT COALESCE(SUM(total_returned), 0) as total 
      FROM sale_returns 
      WHERE date_created >= ? AND date_created <= ?
    `).get(reg.opened_at, reg.closed_at || '9999-12-31 23:59:59') as any;

    const expenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM expenses 
      WHERE date_added >= ? AND date_added <= ?
    `).get(reg.opened_at, reg.closed_at || '9999-12-31 23:59:59') as any;

    return {
      success: true,
      data: {
        ...reg,
        salesCount: sales.count,
        salesTotal: sales.total,
        cashSales: sales.cash_total,
        cardSales: sales.card_total,
        returnsTotal: returns.total,
        expensesTotal: expenses.total,
        expectedCash: reg.opening_balance + sales.cash_total - returns.total - expenses.total
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('close-register', async (_, data: { registerId: number; actualCash: number; closedBy?: string; notes?: string }) => {
  try {
    if (!db) throw new Error('Database not initialized');

    const stmt = db.prepare(`
      UPDATE registers 
      SET status = 'closed', 
          closed_at = datetime('now', 'localtime'), 
          actual_cash = ?, 
          closed_by = ?, 
          notes = ?
      WHERE id = ?
    `);
    stmt.run(data.actualCash, data.closedBy || 'Admin', data.notes || '', data.registerId);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-register-history', async (_, opts: any = {}) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const dateFilter = String(opts.dateFilter || 'weekly');
    const startDate = opts.startDate ? getLocalSqliteDate(opts.startDate) : null;
    const endDate = opts.endDate ? getLocalSqliteDate(opts.endDate) : null;
    const whereParts: string[] = [];
    const whereParams: any[] = [];
    if (dateFilter === 'today') {
      whereParts.push(`date(r.opened_at) = date('now', 'localtime')`);
    } else if (dateFilter === 'weekly') {
      whereParts.push(`date(r.opened_at) >= date('now', 'localtime', '-6 days')`);
    } else if (dateFilter === 'monthly') {
      whereParts.push(`date(r.opened_at) >= date('now', 'localtime', '-29 days')`);
    } else if (dateFilter === 'custom') {
      if (startDate) {
        whereParts.push(`r.opened_at >= ?`);
        whereParams.push(startDate);
      }
      if (endDate) {
        whereParts.push(`r.opened_at <= ?`);
        whereParams.push(endDate);
      }
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const history = db.prepare(`
      SELECT
        r.*,
        COALESCE(s.cash_sales, 0) as cash_sales,
        COALESCE(s.other_sales, 0) as other_sales,
        COALESCE(rt.total_returns, 0) as total_returns,
        COALESCE(e.total_expenses, 0) as total_expenses,
        (COALESCE(r.opening_balance, 0) + COALESCE(s.cash_sales, 0) - COALESCE(rt.total_returns, 0) - COALESCE(e.total_expenses, 0)) as closing_balance_expected,
        COALESCE(r.actual_cash, 0) as closing_balance_actual,
        CASE WHEN LOWER(COALESCE(r.status, 'open')) = 'open' THEN 'Open' ELSE 'Closed' END as status
        FROM registers r
      LEFT JOIN (
        SELECT
          rg.id as register_id,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(s.payment_method, 'cash')) = 'cash' THEN COALESCE(s.total, 0) ELSE 0 END), 0) as cash_sales,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(s.payment_method, 'cash')) <> 'cash' THEN COALESCE(s.total, 0) ELSE 0 END), 0) as other_sales
        FROM registers rg
        LEFT JOIN sales s ON s.date_created >= rg.opened_at AND s.date_created <= COALESCE(rg.closed_at, datetime('now', 'localtime'))
        GROUP BY rg.id
      ) s ON s.register_id = r.id
      LEFT JOIN (
        SELECT
          rg.id as register_id,
          COALESCE(SUM(COALESCE(sr.total_returned, 0)), 0) as total_returns
        FROM registers rg
        LEFT JOIN sale_returns sr ON sr.date_created >= rg.opened_at AND sr.date_created <= COALESCE(rg.closed_at, datetime('now', 'localtime'))
        GROUP BY rg.id
      ) rt ON rt.register_id = r.id
      LEFT JOIN (
        SELECT
          rg.id as register_id,
          COALESCE(SUM(COALESCE(e.amount, 0)), 0) as total_expenses
        FROM registers rg
        LEFT JOIN expenses e ON e.date_added >= rg.opened_at AND e.date_added <= COALESCE(rg.closed_at, datetime('now', 'localtime'))
        GROUP BY rg.id
      ) e ON e.register_id = r.id
        ${whereSql}
        ORDER BY r.opened_at DESC
        LIMIT 50
      `).all(...whereParams);
    return { success: true, data: history };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ============= FINANCIALS HANDLERS =============

ipcMain.handle('get-financial-transactions', async () => {
  try {
    if (!db) throw new Error('Database not initialized');
    const txs = db.prepare("SELECT * FROM financial_transactions ORDER BY date_created DESC LIMIT 100").all();
    return { success: true, data: txs };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-financial-transaction', async (_, data: { type: string; category?: string; amount: number; description?: string; register_id?: number }) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare(`
      INSERT INTO financial_transactions (type, category, amount, description, register_id, date_created)
      VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);
    stmt.run(data.type, data.category || 'General', data.amount, data.description || '', data.register_id || null);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ============= RETURNS HANDLERS =============

ipcMain.handle('create-sale-return', async (_, data: { sale_id: number; items: any[]; total_returned: number; reason?: string; notes?: string }) => {
  try {
    if (!db) throw new Error('Database not initialized');

    // Safety: kill any ghost table references before each return
    try {
      db.exec(`DROP TABLE IF EXISTS _products_old`);
      db.exec(`DROP TABLE IF EXISTS _sale_items_old`);
    } catch (e) { }

    const transaction = db.transaction(() => {
      // 1. Create return record
      const retStmt = db!.prepare(`
        INSERT INTO sale_returns (sale_id, total_returned, reason, notes, date_created)
        VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
      `);
      const info = retStmt.run(data.sale_id, data.total_returned, data.reason || 'General Return', data.notes || '');
      const returnId = info.lastInsertRowid;
      const saleForHistory = db!.prepare("SELECT id, customer_id FROM sales WHERE id = ?").get(data.sale_id) as any;

      // 2. Update items and stock
      const itemStmt = db!.prepare(`
        INSERT INTO sale_return_items (return_id, sale_item_id, product_id, product_name, quantity, price)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of data.items) {
        const qty = parseInt(String(item.quantity)) || 0;
        if (qty <= 0) continue;

        // Validation: Check if return quantity exceeds available FOR THIS SPECIFIC ITEM
        const currentItem = db!.prepare(`
          SELECT 
            quantity, 
            (SELECT COALESCE(SUM(quantity), 0) FROM sale_return_items WHERE sale_item_id = si.id) as returned 
          FROM sale_items si 
          WHERE id = ?
        `).get(item.sale_item_id) as any;

        if (currentItem && (qty + currentItem.returned > currentItem.quantity)) {
          throw new Error(`Cannot return ${qty} of ${item.product_name}. Total returned (${qty + currentItem.returned}) would exceed original quantity (${currentItem.quantity}).`);
        }

        itemStmt.run(returnId, item.sale_item_id, item.product_id, item.product_name || 'Unknown Product', qty, item.price);

        // Return stock to product if it's a tracked product
        if (item.product_id) {
          db!.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(qty, item.product_id);
        }
      }

      // 3. Mark sale as returned (partial or full)
      db!.prepare("UPDATE sales SET status = 'Returned' WHERE id = ?").run(data.sale_id);

      // 4. Log financial transaction (negative income)
      const sale = db!.prepare("SELECT register_id FROM sales WHERE id = ?").get(data.sale_id) as any;
      db!.prepare(`
        INSERT INTO financial_transactions (type, category, amount, description, register_id, date_created)
        VALUES ('Income', 'Sales Return', ?, ?, ?, datetime('now', 'localtime'))
      `).run(-data.total_returned, `Return for Sale #${data.sale_id}${data.reason ? ': ' + data.reason : ''}`, sale?.register_id || null);

      if (saleForHistory?.customer_id) {
        logEntityHistory(db!, {
          entityType: 'customer',
          entityId: saleForHistory.customer_id,
          historyType: 'SALE_RETURN',
          amount: data.total_returned,
          relatedRecordId: Number(returnId),
          relatedRecordType: 'sale_return',
          notes: data.reason || data.notes || `Return for sale #${data.sale_id}`,
          actionStatus: 'COMPLETED'
        });
      }

      return returnId;
    });

    const returnId = transaction();
    return { success: true, data: { returnId } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-sale-return-items', async (_, returnId: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const items = db.prepare(`
      SELECT sri.*, p.name as product_name
      FROM sale_return_items sri
      LEFT JOIN products p ON sri.product_id = p.id
      WHERE sri.return_id = ?
    `).all(returnId);
    return { success: true, data: items };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-sale-returns', async (_, opts: any = {}) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const limit = opts.limit || 50;
    const offset = opts.offset || 0;
    const dateFilter = String(opts.dateFilter || 'weekly');
    const startDate = opts.startDate ? getLocalSqliteDate(opts.startDate) : null;
    const endDate = opts.endDate ? getLocalSqliteDate(opts.endDate) : null;
    const whereParts: string[] = [];
    const params: any[] = [];

    if (dateFilter === 'today') {
      whereParts.push(`date(sr.date_created) = date('now', 'localtime')`);
    } else if (dateFilter === 'weekly') {
      whereParts.push(`date(sr.date_created) >= date('now', 'localtime', '-6 days')`);
    } else if (dateFilter === 'monthly') {
      whereParts.push(`date(sr.date_created) >= date('now', 'localtime', '-29 days')`);
    } else if (dateFilter === 'custom') {
      if (startDate) {
        whereParts.push(`sr.date_created >= ?`);
        params.push(startDate);
      }
      if (endDate) {
        whereParts.push(`sr.date_created <= ?`);
        params.push(endDate);
      }
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const data = db.prepare(`
      SELECT sr.*, s.total as original_total, c.name as customer_name
      FROM sale_returns sr
      JOIN sales s ON sr.sale_id = s.id
      LEFT JOIN customers c ON s.customer_id = c.id
      ${whereSql}
      ORDER BY sr.date_created DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const total = (db.prepare(`SELECT COUNT(*) as count FROM sale_returns sr ${whereSql}`).get(...params) as any).count;

    return { success: true, data, total };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-purchase-return', async (_, data: { purchase_id: number; items: any[]; total_returned: number; reason?: string; notes?: string }) => {
  try {
    if (!db) throw new Error('Database not initialized');

    const transaction = db.transaction(() => {
      // 1. Create return record
      const retStmt = db!.prepare(`
        INSERT INTO purchase_returns (purchase_id, total_returned, reason, notes, date_created)
        VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
      `);
      const info = retStmt.run(data.purchase_id, data.total_returned, data.reason || 'General Return', data.notes || '');
      const returnId = info.lastInsertRowid;
      const purchaseForHistory = db!.prepare("SELECT id, vendor_id FROM purchases WHERE id = ?").get(data.purchase_id) as any;

      // 2. Update items and stock
      const itemStmt = db!.prepare(`
        INSERT INTO purchase_return_items (return_id, product_id, product_name, quantity, purchase_price)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const item of data.items) {
        const qty = parseInt(String(item.quantity)) || 0;
        if (qty <= 0) continue;

        // Validation: Check if return quantity exceeds available in batch
        const batch = db!.prepare("SELECT quantity_added, quantity_remaining FROM inventory_batches WHERE id = ?").get(item.id) as any;
        if (!batch) throw new Error(`Inventory batch #${item.id} not found.`);
        if (qty > batch.quantity_remaining) {
          throw new Error(`Cannot return ${qty} items. Only ${batch.quantity_remaining} available in batch #${item.id}.`);
        }

        itemStmt.run(returnId, item.product_id, item.product_name || 'Unknown Product', qty, item.purchase_price || 0);

        // Update batch remaining quantity to prevent re-returning
        db!.prepare("UPDATE inventory_batches SET quantity_remaining = quantity_remaining - ? WHERE id = ?").run(qty, item.id);

        // Remove stock from product (since we are returning it to vendor)
        if (item.product_id) {
          db!.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run(qty, item.product_id);
        }
      }

      // 3. Log financial transaction (outflow reduction / income-like)
      let purchase: any = null;
      try {
        purchase = db!.prepare("SELECT register_id FROM purchases WHERE id = ?").get(data.purchase_id);
      } catch (e) {
        logger.warn("Purchase table missing register_id column, ignoring for return log");
      }
      db!.prepare(`
        INSERT INTO financial_transactions (type, category, amount, description, register_id, date_created)
        VALUES ('Income', 'Purchase Return', ?, ?, ?, datetime('now', 'localtime'))
      `).run(data.total_returned, `Return for Purchase #${data.purchase_id}${data.reason ? ': ' + data.reason : ''}`, purchase?.register_id || null);

      if (purchaseForHistory?.vendor_id) {
        logEntityHistory(db!, {
          entityType: 'vendor',
          entityId: purchaseForHistory.vendor_id,
          historyType: 'PURCHASE_RETURN',
          amount: data.total_returned,
          relatedRecordId: Number(returnId),
          relatedRecordType: 'purchase_return',
          notes: data.reason || data.notes || `Return for purchase #${data.purchase_id}`,
          actionStatus: 'COMPLETED'
        });
      }

      return returnId;
    });

    const returnId = transaction();
    return { success: true, data: { returnId } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-purchase-returns', async (_, opts: any = {}) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const limit = opts.limit || 50;
    const offset = opts.offset || 0;
    const dateFilter = String(opts.dateFilter || 'weekly');
    const startDate = opts.startDate ? getLocalSqliteDate(opts.startDate) : null;
    const endDate = opts.endDate ? getLocalSqliteDate(opts.endDate) : null;
    const whereParts: string[] = [];
    const params: any[] = [];

    if (dateFilter === 'today') {
      whereParts.push(`date(pr.date_created) = date('now', 'localtime')`);
    } else if (dateFilter === 'weekly') {
      whereParts.push(`date(pr.date_created) >= date('now', 'localtime', '-6 days')`);
    } else if (dateFilter === 'monthly') {
      whereParts.push(`date(pr.date_created) >= date('now', 'localtime', '-29 days')`);
    } else if (dateFilter === 'custom') {
      if (startDate) {
        whereParts.push(`pr.date_created >= ?`);
        params.push(startDate);
      }
      if (endDate) {
        whereParts.push(`pr.date_created <= ?`);
        params.push(endDate);
      }
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const data = db.prepare(`
      SELECT pr.*, p.total as original_total, v.name as vendor_name
      FROM purchase_returns pr
      JOIN purchases p ON pr.purchase_id = p.id
      LEFT JOIN vendors v ON p.vendor_id = v.id
      ${whereSql}
      ORDER BY pr.date_created DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const total = (db.prepare(`SELECT COUNT(*) as count FROM purchase_returns pr ${whereSql}`).get(...params) as any).count;

    return { success: true, data, total };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-purchase-return-items', async (_, returnId: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const items = db.prepare(`
      SELECT pri.*, p.name as product_name
      FROM purchase_return_items pri
      LEFT JOIN products p ON pri.product_id = p.id
      WHERE pri.return_id = ?
    `).all(returnId);
    return { success: true, data: items };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});


// ============= FINANCIAL AUDIT HANDLERS =============

ipcMain.handle('get-balance-sheet', async (_, args: { startDate?: string; endDate?: string } = {}) => {
  try {
    if (!db) throw new Error('Database not initialized');

    const sqlStart = args.startDate ? getLocalSqliteDate(args.startDate) : null;
    const sqlEnd = args.endDate ? getLocalSqliteDate(args.endDate) : null;

    // Build separate param arrays for each table's date column
    const salesParams: any[] = [];
    let salesDateFilter = "1=1";
    if (sqlStart) { salesDateFilter += " AND date_created >= ?"; salesParams.push(sqlStart); }
    if (sqlEnd) { salesDateFilter += " AND date_created <= ?"; salesParams.push(sqlEnd); }

    const expenseParams: any[] = [];
    let expenseDateFilter = "1=1";
    if (sqlStart) { expenseDateFilter += " AND date_added >= ?"; expenseParams.push(sqlStart); }
    if (sqlEnd) { expenseDateFilter += " AND date_added <= ?"; expenseParams.push(sqlEnd); }

    const purchaseParams: any[] = [];
    let purchaseDateFilter = "1=1";
    if (sqlStart) { purchaseDateFilter += " AND date_created >= ?"; purchaseParams.push(sqlStart); }
    if (sqlEnd) { purchaseDateFilter += " AND date_created <= ?"; purchaseParams.push(sqlEnd); }

    // Inventory Value (at cost) - no date filter needed
    const inventoryValue = (db.prepare("SELECT COALESCE(SUM(stock * purchase_price), 0) as total FROM products").get() as any).total;

    // Receivables (customer-level net outstanding)
    // This avoids false balances when payments are recorded without sale_id links.
    const receivables = (db.prepare(`
      SELECT COALESCE(SUM(bal), 0) as total FROM (
        SELECT c.id,
          COALESCE((
            SELECT SUM(CAST(s.total AS REAL))
            FROM sales s
            WHERE s.customer_id = c.id
              AND (s.status IS NULL OR LOWER(s.status) != 'cancelled')
          ), 0)
          -
          COALESCE((
            SELECT SUM(CAST(p.amount AS REAL))
            FROM customer_payments p
            WHERE p.customer_id = c.id
          ), 0)
          -
          COALESCE((
            SELECT SUM(CAST(sr.total_returned AS REAL))
            FROM sale_returns sr
            JOIN sales s2 ON sr.sale_id = s2.id
            WHERE s2.customer_id = c.id
          ), 0) as bal
        FROM customers c
      ) WHERE bal > 0.5
    `).get() as any).total || 0;

    // Payables (AP)
    const payables = (db.prepare(`
        SELECT SUM(remaining) FROM (
          SELECT CAST(p.total AS REAL) - 
                 COALESCE((SELECT SUM(CAST(amount AS REAL)) FROM vendor_payments WHERE purchase_id = p.id), 0) -
                 COALESCE((SELECT SUM(CAST(total_returned AS REAL)) FROM purchase_returns WHERE purchase_id = p.id), 0) as remaining
          FROM purchases p 
          WHERE (p.status IS NULL OR LOWER(p.status) != 'cancelled')
        ) WHERE remaining > 0.5
    `).get() as any)['SUM(remaining)'] || 0;

    // Revenue
    const revenue = (db.prepare(`SELECT COALESCE(SUM(total), 0) as total FROM sales WHERE status = 'Completed' AND ${salesDateFilter}`).get(...salesParams) as any).total;

    // COGS
    const cogs = (db.prepare(`
      SELECT COALESCE(SUM(
        COALESCE(NULLIF(si.purchase_price, 0), NULLIF(p.purchase_price, 0), 0) * si.quantity
      ), 0) as total 
      FROM sale_items si 
      JOIN sales s ON si.sale_id = s.id 
      LEFT JOIN products p ON (p.id = si.product_id OR (si.product_id IS NULL AND p.name = si.product_name))
      WHERE s.status = 'Completed' AND ${salesDateFilter.replace(/date_created/g, 's.date_created')}
    `).get(...salesParams) as any).total;

    // Expenses
    const expenses = (db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE ${expenseDateFilter}`).get(...expenseParams) as any).total;

    // Vendor Outflow (purchases)
    const vendorOutflow = (db.prepare(`SELECT COALESCE(SUM(total), 0) as total FROM purchases WHERE ${purchaseDateFilter}`).get(...purchaseParams) as any).total;

    // Payment Stats
    const paymentStats = db.prepare(`
      SELECT payment_method, SUM(total) as revenue, COUNT(*) as count 
      FROM sales 
      WHERE status = 'Completed' AND ${salesDateFilter}
      GROUP BY payment_method
    `).all(...salesParams) as any[];

    // Recent Transactions - union across tables with their correct date columns
    const recentTransactions = db.prepare(`
      SELECT 'sale' as type, id, total as amount, date_created as date, 'Sale' as description FROM sales
      WHERE ${salesDateFilter}
      UNION ALL
      SELECT 'purchase' as type, id, total as amount, date_created as date, 'Purchase' as description FROM purchases
      WHERE ${purchaseDateFilter}
      UNION ALL
      SELECT 'expense' as type, id, amount, date_added as date, COALESCE(category, 'Expense') as description FROM expenses
      WHERE ${expenseDateFilter}
      ORDER BY date DESC LIMIT 20
    `).all(...salesParams, ...purchaseParams, ...expenseParams);

    return {
      success: true,
      data: {
        inventoryValue,
        receivables,
        payables,
        zakatRate: 0.025,
        zakatableAssetsGross: inventoryValue + receivables,
        zakatableAssetsNet: Math.max(0, inventoryValue + receivables - payables),
        revenue,
        cogs,
        expenses,
        vendorOutflow,
        netProfit: revenue - cogs - expenses,
        paymentStats: paymentStats || [],
        recentTransactions: recentTransactions || [],
        period: { start: args.startDate || null, end: args.endDate || null }
      }
    };
  } catch (error: any) {
    logger.error('Failed to get balance sheet:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-all-payments', async (_, opts: any = {}) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const limit = opts.limit || 50;
    const offset = opts.offset || 0;
    const search = String(opts.search || '').trim().toLowerCase();
    const dateFilter = String(opts.dateFilter || 'weekly');
    const startDate = opts.startDate ? getLocalSqliteDate(opts.startDate) : null;
    const endDate = opts.endDate ? getLocalSqliteDate(opts.endDate) : null;

    const whereParts: string[] = [];
    const whereParams: any[] = [];

    if (search) {
      whereParts.push(`(
        LOWER(COALESCE(type, '')) LIKE ? OR
        LOWER(COALESCE(party_name, '')) LIKE ? OR
        LOWER(COALESCE(notes, '')) LIKE ? OR
        CAST(id AS TEXT) LIKE ? OR
        CAST(amount AS TEXT) LIKE ?
      )`);
      const s = `%${search}%`;
      whereParams.push(s, s, s, s, s);
    }

    if (dateFilter === 'today') {
      whereParts.push(`date(date_added) = date('now', 'localtime')`);
    } else if (dateFilter === 'weekly') {
      whereParts.push(`date(date_added) >= date('now', 'localtime', '-6 days')`);
    } else if (dateFilter === 'monthly') {
      whereParts.push(`date(date_added) >= date('now', 'localtime', '-29 days')`);
    } else if (dateFilter === 'custom') {
      if (startDate) {
        whereParts.push(`date_added >= ?`);
        whereParams.push(startDate);
      }
      if (endDate) {
        whereParts.push(`date_added <= ?`);
        whereParams.push(endDate);
      }
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    // Aggregate customer payments, vendor payments, and returns into a single audit ledger
    // We map types to match the frontend badges: 'Customer Payment', 'Vendor Payment', 'Sale Refund', 'Purchase Return'
    const ledgerBase = `
      SELECT 'Customer Payment' as type, cp.amount, COALESCE(cp.date_added, (datetime('now', 'localtime'))) as date_added, c.name as party_name, cp.notes, cp.id
      FROM customer_payments cp
      LEFT JOIN customers c ON cp.customer_id = c.id
      UNION ALL
      SELECT 'Vendor Payment' as type, p.total as amount, COALESCE(p.date_created, (datetime('now', 'localtime'))) as date_added, v.name as party_name, p.status as notes, p.id
      FROM purchases p
      LEFT JOIN vendors v ON p.vendor_id = v.id
      UNION ALL
      SELECT 'Sale Refund' as type, sr.total_returned as amount, COALESCE(sr.date_created, (datetime('now', 'localtime'))) as date_added, c.name as party_name, sr.notes, sr.id
      FROM sale_returns sr
      JOIN sales s ON sr.sale_id = s.id
      LEFT JOIN customers c ON s.customer_id = c.id
      UNION ALL
      SELECT 'Purchase Return' as type, pr.total_returned as amount, COALESCE(pr.date_created, (datetime('now', 'localtime'))) as date_added, v.name as party_name, pr.notes, pr.id
      FROM purchase_returns pr
      JOIN purchases p ON pr.purchase_id = p.id
      LEFT JOIN vendors v ON p.vendor_id = v.id
    `;

    const ledger = db.prepare(`
      SELECT *
      FROM (${ledgerBase}) l
      ${whereSql}
      ORDER BY date_added DESC
      LIMIT ? OFFSET ?
    `).all(...whereParams, limit, offset);

    // Calculate summary totals on filtered result-set for consistent UI
    const stats = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN type IN ('Customer Payment', 'Purchase Return') THEN amount ELSE 0 END), 0) as total_incoming,
        COALESCE(SUM(CASE WHEN type IN ('Vendor Payment', 'Sale Refund') THEN amount ELSE 0 END), 0) as total_outgoing
      FROM (${ledgerBase}) l
      ${whereSql}
    `).get(...whereParams) as any;

    const total = db.prepare(`
      SELECT COUNT(*) as count
      FROM (${ledgerBase}) l
      ${whereSql}
    `).get(...whereParams) as any;

    return {
      success: true,
      data: ledger,
      total: total.count,
      totalIncoming: Number(stats.total_incoming) || 0,
      totalOutgoing: Number(stats.total_outgoing) || 0
    };
  } catch (error: any) {
    logger.error('Failed to get all payments:', error);
    return { success: false, error: error.message };
  }
});

// ============= GOOGLE DRIVE HANDLERS =============
ipcMain.handle('connect-google-drive', async () => {
  try {
    return await googleAuthService.connect();
  } catch (error: any) {
    logger.error('Google Drive connection failed:', error);
    return false;
  }
});

ipcMain.handle('get-google-drive-status', async () => {
  try {
    return {
      connected: googleAuthService.isConnected(),
      lastBackup: backupService.getLastBackupTime()
    };
  } catch (error: any) {
    return { connected: false, lastBackup: null };
  }
});

ipcMain.handle('trigger-google-drive-backup', async () => {
  try {
    if (!db) throw new Error('Database not initialized');
    const tempBackupPath = path.join(app.getPath('temp'), `pos_cloud_snapshot_${Date.now()}.db`);
    try {
      // Create a consistent SQLite snapshot (WAL-safe) before uploading.
      await (db as any).backup(tempBackupPath);
      return await backupService.triggerBackup(tempBackupPath);
    } finally {
      try {
        if (fs.existsSync(tempBackupPath)) fs.unlinkSync(tempBackupPath);
      } catch (cleanupErr) {
        logger.warn('Failed to clean temp cloud snapshot:', cleanupErr);
      }
    }
  } catch (error: any) {
    if (error?.message?.includes('invalid_grant') || error?.cause?.message?.includes('invalid_grant')) {
      googleAuthService.disconnect();
      return { success: false, message: 'Google session expired. Please reconnect.', auth_expired: true };
    }
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-available-backups', async () => {
  try {
    const backups = await restoreService.getAvailableBackups();
    return { success: true, backups };
  } catch (error: any) {
    logger.error('Failed to get available backups:', error);
    // Detect expired / revoked refresh token
    if (error?.message?.includes('invalid_grant') || error?.cause?.message?.includes('invalid_grant')) {
      googleAuthService.disconnect();
      return { success: false, message: 'Google session expired. Please reconnect your Google Drive account.', auth_expired: true };
    }
    return { success: false, message: error.message };
  }
});

ipcMain.handle('disconnect-google-drive', async () => {
  try {
    googleAuthService.disconnect();
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('restore-cloud-backup', async (event, fileId: string) => {
  try {
    if (!fileId || typeof fileId !== 'string') {
      throw new Error('Invalid backup file id');
    }

    const tempPath = path.join(app.getPath('temp'), `restore_${Date.now()}.db`);
    const dbPath = path.join(app.getPath('userData'), 'pos.db');
    const bakPath = path.join(app.getPath('userData'), `pos_pre_restore_${Date.now()}.db.bak`);

    event.sender.send('restore-progress', { status: 'downloading', progress: 0 });
    await driveService.downloadFile(fileId, tempPath, (progress) => {
      event.sender.send('restore-progress', { status: 'downloading', progress });
    });

    event.sender.send('restore-progress', { status: 'restoring', progress: 100 });

    if (db) {
      db.close();
      db = null;
    }

    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, bakPath);
    }

    fs.copyFileSync(tempPath, dbPath);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

    await initializeDatabase();
    return { success: true, message: 'Restore completed. App will now reload.' };
  } catch (error: any) {
    logger.error('Failed to restore cloud backup:', error);
    try {
      if (!db) await initializeDatabase();
    } catch (e) {
      logger.error('Failed to re-initialize DB after restore error:', e);
    }
    return { success: false, message: error.message };
  }
});

// ============= LOGO HANDLER =============
ipcMain.handle('get-logo', async () => {
  try {
    const logoFileName = 'softwarelogo.png';
    // Support loading logo from resources path (when packaged) or current dir (in dev)
    const logoRootPath = app.isPackaged ? process.resourcesPath : app.getAppPath();
    const logoFilePath = path.join(logoRootPath, logoFileName);

    if (fs.existsSync(logoFilePath)) {
      const bitmap = fs.readFileSync(logoFilePath);
      const base64Str = Buffer.from(bitmap).toString('base64');
      return { success: true, data: `data:image/png;base64,${base64Str}` };
    }

    return { success: false, error: 'Logo not found' };
  } catch (error: any) {
    logger.error('Failed to get logo:', error);
    return { success: false, error: error.message };
  }
});
// ============= APP LIFECYCLE =============

app.whenReady().then(async () => {
  try {
    await initializeDatabase();

    await createWindow();

    const menuBuilder = new MenuBuilder(mainWindow!);
    menuBuilder.buildMenu();

    // Hidden shortcut for License Issuer: Ctrl+Shift+L
    mainWindow?.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === 'l') {
        mainWindow?.webContents.send('toggle-license-issuer');
        event.preventDefault();
      }
    });


    startBackgroundTasks();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    logger.info('Application started successfully');
  } catch (error) {
    logger.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (db) {
    logger.info('Closing database connection...');
    db.close();
    logger.info('Database connection closed');
  }
});

ipcMain.handle('select-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('select-db-file', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select POS Database File',
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    properties: ['openFile']
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('import-db', async (_, sourcePath: string) => {
  try {
    if (typeof sourcePath !== 'string' || sourcePath.trim().length === 0) {
      throw new Error('Invalid database path');
    }
    const resolvedSource = path.resolve(sourcePath);
    if (path.extname(resolvedSource).toLowerCase() !== '.db') {
      throw new Error('Only .db database files are allowed');
    }
    if (!fs.existsSync(resolvedSource)) {
      throw new Error('Selected database file does not exist');
    }
    const destPath = path.join(app.getPath('userData'), 'pos.db');

    // Backup existing
    if (fs.existsSync(destPath)) {
      fs.copyFileSync(destPath, `${destPath}.bak_${Date.now()}`);
    }

    // Close current connection
    if (db) {
      db.close();
      db = null;
    }

    // Use SQLite backup API from source DB for safer restore semantics
    // (applies pending WAL content when present and creates a consistent destination file).
    const sourceDb = new Database(resolvedSource, { readonly: true, fileMustExist: true });
    try {
      await (sourceDb as any).backup(destPath);
    } finally {
      sourceDb.close();
    }

    // Re-initialize
    await initializeDatabase();

    return { success: true };
  } catch (error: any) {
    logger.error('Failed to import database:', error);
    // Re-initialize if possible even if copy failed
    if (!db) await initializeDatabase();
    return { success: false, error: error.message };
  }
});

ipcMain.handle('perform-auto-export', async () => {
  try {
    await triggerAutoExport(true);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
})
