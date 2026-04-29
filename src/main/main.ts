import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
// Triggering rebuild to fix SQL column error
import path from 'path';
import Database from 'better-sqlite3';
import fs from 'fs';
import crypto from 'crypto';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let db: Database.Database | null = null;

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
  const d = isoString ? new Date(isoString) : new Date();
  const offset = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - offset);
  return local.toISOString().replace('T', ' ').substring(0, 19);
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
    logger.info('Performing schema verification...');
    const tables = ['settings', 'products', 'customers', 'sales', 'sale_items', 'vendors', 'purchases', 'inventory_batches', 'customer_payments'];
    for (const table of tables) {
      const exists = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
      if (!exists) {
        logger.error(`CRITICAL: Table ${table} is missing! Database might be corrupt.`);
        return false;
      }
    }
    logger.info('All core tables verified.');
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
        try { database.exec('ALTER TABLE settings ADD COLUMN low_stock_threshold INTEGER DEFAULT 10'); } catch(e){}
      } catch (e) { logger.error('Migration 17 error:', e); }
      database.exec('PRAGMA user_version = 17');
    }

    // Migration 18: Add purchase_price, stock, and barcode to products
    if (ver < 18) {
      logger.info('Running migration 18 - Adding product details...');
      try { database.exec('ALTER TABLE products ADD COLUMN purchase_price REAL DEFAULT 0'); } catch(e){}
      try { database.exec('ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0'); } catch(e){}
      try { database.exec('ALTER TABLE products ADD COLUMN barcode TEXT DEFAULT ""'); } catch(e){}
      database.exec('PRAGMA user_version = 18');
    }

    // Migration 19: Add receipt_size setting
    if (ver < 19) {
      logger.info('Running migration 19 - Adding receipt_size to settings...');
      try { database.exec(`ALTER TABLE settings ADD COLUMN receipt_size TEXT DEFAULT 'thermal'`); } catch(e){}
      try { database.exec(`ALTER TABLE settings ADD COLUMN low_stock_threshold INTEGER DEFAULT 10`); } catch(e){}
      database.exec('PRAGMA user_version = 19');
    }

    // Migration 20: Add unit field to products (e.g. kg, pcs, box)
    if (ver < 20) {
      logger.info('Running migration 20 - Adding unit column to products...');
      try { database.exec(`ALTER TABLE products ADD COLUMN unit TEXT DEFAULT ''`); } catch(e){}
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
      try { database.exec(`ALTER TABLE settings ADD COLUMN auto_export_path TEXT DEFAULT ''`); } catch(e){}
      try { database.exec(`ALTER TABLE settings ADD COLUMN auto_export_enabled INTEGER DEFAULT 0`); } catch(e){}
      database.exec('PRAGMA user_version = 22');
    }

    // Migration 23: Add last_auto_export to settings
    if (ver < 23) {
      logger.info('Running migration 23 - Adding last_auto_export to settings...');
      try { database.exec(`ALTER TABLE settings ADD COLUMN last_auto_export DATETIME`); } catch(e){}
      database.exec('PRAGMA user_version = 23');
    }

    logger.info(`Database migration completed. Current version: ${database.pragma('user_version', { simple: true })}`);
  } catch (error) {
    logger.error('Migration system failed:', error);
    throw error;
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
    db.pragma('cache_size = -64000'); // 64MB cache
    db.pragma('temp_store = MEMORY');

    logger.info('Database pragmas configured');

    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        store_name TEXT DEFAULT 'My Restaurant',
        store_phone TEXT DEFAULT '',
        store_address TEXT DEFAULT '',
        store_logo TEXT DEFAULT '',
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

      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendor_id INTEGER,
        total REAL NOT NULL DEFAULT 0,
        date_created DATETIME DEFAULT (datetime('now', 'localtime')),
        status TEXT DEFAULT 'Completed',
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

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT,
        amount REAL NOT NULL,
        date_added DATETIME DEFAULT (datetime('now', 'localtime')),
        notes TEXT
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
    `);

    // Run migrations
    db.exec('PRAGMA foreign_keys = OFF');
    migrate(db);
    db.exec('PRAGMA foreign_keys = ON');

    // Final integrity check
    if (!checkDatabaseSchema(db)) {
      throw new Error('Database schema verification failed after migrations');
    }

    logger.info('Database initialized and verified successfully');
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
    },
    show: false,
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window loaded');
    mainWindow?.webContents.executeJavaScript(`
      console.log('API available:', !!window.api);
      if (window.api) {
        console.log('API methods:', Object.keys(window.api));
      }
    `);
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
      export_date: new Date().toISOString(),
      version: '1.1'
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
      logger.warn(`License name mismatch or missing duration: Expected "${name}", Got "${license.businessName}". Duration: ${license.durationDays}`);
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
         if (key === `${firstName}-${year}-${hash}`) {
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
    if (!db) throw new Error('Database not initialized');
    const settings = db.prepare('SELECT activation_key, business_name, expiry_date FROM settings WHERE id = 1').get() as any;
    
    if (!settings || !settings.activation_key || !settings.business_name) {
      return { success: true, activated: false, license: null };
    }
    
    const { valid, license } = verifyActivationKey(settings.business_name, settings.activation_key);
    
    // For additive system, return the DB expiry_date instead of relying on token
    if (valid && license && !license.isLegacy) {
      if (settings.expiry_date) {
        license.expiry = settings.expiry_date;
      }
    }

    return { success: true, activated: valid, license };
  } catch (error: any) {
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
        logger.info(`Legacy app activated for: ${businessName}`);
        return { success: true };
    }

    // Additive logic for new JSON keys
    let usedIds: string[] = [];
    try { usedIds = JSON.parse(settings.used_license_ids || '[]'); } catch (e) {}

    if (usedIds.includes(license.licenseId)) {
        throw new Error('This license key has already been used.');
    }
    
    // If we're activating a new JSON key, we always overwrite the old one
    // even if the old one was "lifetime". The user is explicitly renewing/changing.
    usedIds.push(license.licenseId);
    
    // Calculate new expiry
    const now = new Date();
    let currentExpiry: Date;
    
    // If switching from legacy MD5 (which has no expiry_date) or expired, start from today
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
    
    logger.info(`App activated for: ${businessName}. Added ${license.durationDays} days. New expiry: ${newExpiryIso}`);
    return { success: true };
  } catch (error: any) {
    logger.error('Activation failed:', error);
    return { success: false, error: error.message };
  }
});

// ============= PRODUCT HANDLERS =============

ipcMain.handle('get-products', async () => {
  try {
    if (!db) throw new Error('Database not initialized');
    const products = db.prepare('SELECT * FROM products ORDER BY name').all();
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
      INSERT INTO products (name, price, category, purchase_price, stock, barcode, unit, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, (datetime('now', 'localtime')), (datetime('now', 'localtime')))
    `);
    const info = stmt.run(
      product.name.trim(), 
      price, 
      product.category?.trim() || '',
      product.purchase_price || 0,
      product.stock || 0,
      product.barcode?.trim() || '',
      product.unit?.trim() || ''
    );

    const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
    logger.info(`Product added: ${product.name} (ID: ${info.lastInsertRowid})`);

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
      SET name = ?, price = ?, category = ?, purchase_price = ?, stock = ?, barcode = ?, unit = ?, updated_at = (datetime('now', 'localtime')) 
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
      id
    );

    const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    logger.info(`Product updated: ${product.name} (ID: ${id})`);

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
          auto_export_enabled = ?
      WHERE id = 1
    `);

    stmt.run(
      settings.store_name || 'My Restaurant',
      settings.store_phone || '',
      settings.store_address || '',
      settings.store_logo || '',
      settings.receipt_footer || 'Thank you for visiting!',
      settings.pos_password || '1234',
      settings.receipt_size || 'thermal',
      settings.low_stock_threshold ?? 10,
      settings.auto_export_path || '',
      settings.auto_export_enabled ? 1 : 0
    );

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
}) => {
  try {
    if (!db) throw new Error('Database not initialized');

    // Strict validation for data integrity
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) throw new Error('Sale must have at least one valid item');
    if (typeof data.total !== 'number' || isNaN(data.total) || data.total < 0) throw new Error('Sale total must be a valid positive number');
    if (data.subtotal !== undefined && (typeof data.subtotal !== 'number' || isNaN(data.subtotal) || data.subtotal < 0)) throw new Error('Invalid subtotal');
    if (data.discount !== undefined && (typeof data.discount !== 'number' || isNaN(data.discount) || data.discount < 0)) throw new Error('Invalid discount');
    if (data.amount_paid !== undefined && (typeof data.amount_paid !== 'number' || isNaN(data.amount_paid) || data.amount_paid < 0)) throw new Error('Invalid amount paid');

    for (const item of data.items) {
      if (typeof item.quantity !== 'number' || isNaN(item.quantity) || item.quantity <= 0) throw new Error(`Invalid quantity for product: ${item.product_name}`);
      if (typeof item.price !== 'number' || isNaN(item.price) || item.price < 0) throw new Error(`Invalid price for product: ${item.product_name}`);
    }

    const transaction = db.transaction(() => {
      try {
        // Insert sale
        const saleStmt = db!.prepare(`
          INSERT INTO sales (customer_id, total, subtotal, discount, tax, payment_method, payment_status, notes, date_created)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
        `);

        const saleInfo = saleStmt.run(
          data.customer_id || null,
          data.total,
          data.subtotal || data.total,
          data.discount || 0,
          data.tax || 0,
          data.payment_method || 'cash',
          data.payment_status || 'Paid',
          data.notes || null
        );

        const saleId = saleInfo.lastInsertRowid;

        // Record partial payment if explicitly provided and there's a customer
        if (data.customer_id && data.amount_paid && data.amount_paid > 0) {
          db!.prepare("INSERT INTO customer_payments (customer_id, amount, notes, date_added) VALUES (?, ?, ?, datetime('now', 'localtime'))").run(
            data.customer_id, data.amount_paid, `Payment for Sale #${saleId}`
          );
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

ipcMain.handle('get-sales', async (_, opts: { limit?: number; offset?: number; search?: string } = {}) => {
  try {
    if (!db) throw new Error('Database not initialized');

    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const search = opts.search?.trim() ?? '';

    let whereClause = '';
    const params: any[] = [];

    if (search) {
      whereClause = `WHERE (CAST(s.id AS TEXT) LIKE ? OR s.payment_method LIKE ? OR GROUP_CONCAT(DISTINCT si.product_name) LIKE ?)`;
      // Use a subquery approach â€” simpler and avoids HAVING
      const searchPattern = `%${search}%`;

      const sales = db.prepare(`
        SELECT s.*,
               c.name as customer_name,
               COUNT(si.id) as item_count,
               GROUP_CONCAT(DISTINCT si.product_name || ' (x' || si.quantity || ')') as items_summary
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN sale_items si ON s.id = si.sale_id
        GROUP BY s.id
        HAVING CAST(s.id AS TEXT) LIKE ? OR s.payment_method LIKE ? OR items_summary LIKE ?
        ORDER BY s.date_created DESC
        LIMIT ? OFFSET ?
      `).all(searchPattern, searchPattern, searchPattern, limit, offset);

      const countRow = db.prepare(`
        SELECT COUNT(*) as total FROM (
          SELECT s.id
          FROM sales s
          LEFT JOIN sale_items si ON s.id = si.sale_id
          GROUP BY s.id
          HAVING CAST(s.id AS TEXT) LIKE ? OR s.payment_method LIKE ? 
              OR GROUP_CONCAT(DISTINCT si.product_name) LIKE ?
        )
      `).get(searchPattern, searchPattern, searchPattern) as any;

      return { success: true, data: sales, total: countRow?.total ?? 0 };
    }

    const sales = db.prepare(`
      SELECT s.*,
             c.name as customer_name,
             COUNT(si.id) as item_count,
             GROUP_CONCAT(DISTINCT si.product_name || ' (x' || si.quantity || ')') as items_summary
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      GROUP BY s.id
      ORDER BY s.date_created DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const countRow = db.prepare('SELECT COUNT(*) as total FROM sales').get() as any;

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
      SELECT * FROM sale_items 
      WHERE sale_id = ? 
      ORDER BY id
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

    const sqlStart = args?.startDate ? getLocalSqliteDate(args.startDate) : null;
    const sqlEnd = args?.endDate ? getLocalSqliteDate(args.endDate) : null;

    // Helper functions
    const sumSince = (since: string) => {
      const result = db!.prepare("SELECT COALESCE(SUM(total), 0) as total FROM sales WHERE date_created >= ? AND status = 'Completed'").get(since) as any;
      return result.total;
    };

    const countSince = (since: string) => {
      const result = db!.prepare('SELECT COUNT(*) as count FROM sales WHERE date_created >= ?').get(since) as any;
      return result.count;
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

    const filteredRevenue = (db.prepare(`SELECT COALESCE(SUM(total), 0) as total FROM sales WHERE status = 'Completed' ${periodQuery}`).get(...periodParams) as any).total;
    const filteredCount = (db.prepare(`SELECT COUNT(*) as count FROM sales WHERE status = 'Completed' ${periodQuery}`).get(...periodParams) as any).count;

    let periodQueryS = periodQuery ? periodQuery.replace(/date_created/g, 's.date_created') : '';

    const stats = {
      totalSalesToday: sumSince(todayStart),
      totalSalesWeek: sumSince(weekStart),
      totalSalesMonth: sumSince(monthStart),
      totalTransactions: (db.prepare('SELECT COUNT(*) as count FROM sales').get() as any).count,
      totalTransactionsToday: countSince(todayStart),
      totalProducts: (db.prepare('SELECT COUNT(*) as count FROM products').get() as any).count,
      totalCustomers: (db.prepare('SELECT COUNT(*) as count FROM customers').get() as any).count,
      filteredRevenue,
      filteredCount,
      topProducts: db.prepare(`
        SELECT 
          si.product_name as name, 
          SUM(si.quantity) as qty_sold, 
          SUM(si.quantity * si.price) as revenue,
          COUNT(DISTINCT si.sale_id) as times_sold
        FROM sale_items si
        INNER JOIN sales s ON si.sale_id = s.id
        WHERE s.status = 'Completed' ${periodQueryS}
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
        WHERE status = 'Completed' ${periodQuery}
        GROUP BY payment_method
      `).all(...periodParams),
      // ---- Inventory Analytics ----
      totalStockValue: (db.prepare(`
        SELECT COALESCE(SUM(stock * purchase_price), 0) as val FROM products
      `).get() as any).val,
      totalRetailValue: (db.prepare(`
        SELECT COALESCE(SUM(stock * price), 0) as val FROM products
      `).get() as any).val,
      lowStockProducts: db.prepare(`
        SELECT id, name, stock, price FROM products WHERE stock <= 10 ORDER BY stock ASC LIMIT 8
      `).all(),
      // ---- Loan / Qaraz Analytics ----
      totalOutstandingLoans: (db.prepare(`
        SELECT COALESCE(
          (SELECT COALESCE(SUM(s.total),0) FROM sales s) -
          (SELECT COALESCE(SUM(cp.amount),0) FROM customer_payments cp),
        0) as total
      `).get() as any).total,
      customersInDebt: (db.prepare(`
        SELECT COUNT(*) as count FROM (
          SELECT c.id,
            COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.customer_id = c.id),0) -
            COALESCE((SELECT SUM(p.amount) FROM customer_payments p WHERE p.customer_id = c.id),0) as bal
          FROM customers c
        ) WHERE bal > 0
      `).get() as any).count,
    };

    logger.debug('Dashboard stats retrieved');
    return { success: true, data: stats };
  } catch (error: any) {
    logger.error('Failed to get dashboard stats:', error);
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
        SELECT COALESCE(SUM(total), 0) as total 
        FROM sales 
        WHERE date_created >= ? AND date_created <= ? AND status = 'Completed'
      `).get(sqlStart, sqlEnd) as any).total,
      totalSales: (db.prepare(`
        SELECT COUNT(*) as count 
        FROM sales 
        WHERE date_created >= ? AND date_created <= ? AND status = 'Completed'
      `).get(sqlStart, sqlEnd) as any).count,
      topProducts: db.prepare(`
        SELECT 
          si.product_name as name, 
          SUM(si.quantity) as qty_sold, 
          SUM(si.quantity * si.price) as revenue,
          AVG(si.price) as avg_price
        FROM sale_items si
        INNER JOIN sales s ON si.sale_id = s.id
        WHERE s.date_created >= ? AND s.date_created <= ?
        GROUP BY si.product_name
        ORDER BY qty_sold DESC
        LIMIT 10
      `).all(sqlStart, sqlEnd),
      salesByHour: db.prepare(`
        SELECT 
          strftime('%H', date_created) as hour,
          COUNT(*) as count,
          SUM(total) as total
        FROM sales
        WHERE date_created >= ? AND date_created <= ?
        GROUP BY hour
        ORDER BY hour
      `).all(startDate, endDate),
      paymentMethods: db.prepare(`
        SELECT 
          payment_method,
          COUNT(*) as count,
          SUM(total) as total
        FROM sales
        WHERE date_created >= ? AND date_created <= ?
        GROUP BY payment_method
      `).all(startDate, endDate),
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
             COALESCE(SUM(s.total), 0) as total_spent,
             (COALESCE(SUM(s.total), 0) - COALESCE((SELECT SUM(amount) FROM customer_payments cp WHERE cp.customer_id = c.id), 0)) as balance
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

  const win = new BrowserWindow({
    show: false,
    width,
    height: 800,
    useContentSize: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  await new Promise<void>((resolve, reject) => {
    win.webContents.once('did-finish-load', () => resolve());
    win.webContents.once('did-fail-load', (_e, code, desc) =>
      reject(new Error(`Failed to load receipt: ${code} ${desc}`))
    );
    win.loadFile(tmpFile);
  });

  await new Promise(resolve => setTimeout(resolve, 400));
  try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  return win;
}

/** A4-friendly receipt template for PDF saving (renders nicely in any PDF viewer). */
function buildReceiptPdfHtml(content: string): string {
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

    const printWindow = await loadHtmlWindow(buildReceiptHtml(htmlContent), 272);

    const contentHeightPx: number = await printWindow.webContents.executeJavaScript(
      'document.body.offsetHeight'
    );
    const heightMicrons = Math.ceil(contentHeightPx * PX_TO_MICRONS) + 2000;

    return new Promise((resolve) => {
      printWindow.webContents.print(
  {
    silent: false,
    printBackground: true,
    pageSize: { width: RECEIPT_WIDTH_MICRONS, height: heightMicrons },
    margins: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 },
    scaleFactor: 100,
  },
  (success, reason) => {
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
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Save Receipt as PDF',
      defaultPath: `receipt-${Date.now()}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) return { success: false, error: 'Cancelled' };

    const printWindow = await loadHtmlWindow(buildReceiptPdfHtml(htmlContent), 595);

    const pdfBuffer = await printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'none' },
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
    db.prepare("UPDATE settings SET store_name = 'My Restaurant', store_phone = '', store_address = '', store_logo = '', receipt_footer = 'Thank you for visiting!', pos_password = '1234' WHERE id = 1").run();
    
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
        } catch (e) {}
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
    if (!data || !data.settings || !data.products || !data.customers || !data.sales || !data.sale_items) {
      throw new Error('Invalid or corrupted import data format');
    }

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

      // Clear existing
      db!.prepare('DELETE FROM inventory_batches').run();
      db!.prepare('DELETE FROM purchases').run();
      db!.prepare('DELETE FROM vendors').run();
      db!.prepare('DELETE FROM customer_payments').run();
      db!.prepare('DELETE FROM expenses').run();
      db!.prepare('DELETE FROM sale_items').run();
      db!.prepare('DELETE FROM sales').run();
      db!.prepare('DELETE FROM customers').run();
      db!.prepare('DELETE FROM products').run();
      db!.prepare('DELETE FROM settings').run();

      const now = new Date().toISOString();

      // Insert Settings
      const insertSetting = db!.prepare('INSERT OR REPLACE INTO settings (id, store_name, store_phone, store_address, store_logo, receipt_footer, pos_password) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const s of data.settings) {
        insertSetting.run(s.id, s.store_name, s.store_phone, s.store_address, s.store_logo, s.receipt_footer, s.pos_password);
      }

      // Insert Products
      const insertProduct = db!.prepare('INSERT OR REPLACE INTO products (id, name, price, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
      for (const p of data.products) {
        insertProduct.run(p.id, p.name, p.price, p.category, p.created_at || now, p.updated_at || now);
      }

      // Insert Customers
      const insertCustomer = db!.prepare('INSERT OR REPLACE INTO customers (id, name, phone, email, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const c of data.customers) {
        insertCustomer.run(c.id, c.name, c.phone, c.email, c.address, c.created_at || now, c.updated_at || now);
      }

      // Insert Sales
      const insertSale = db!.prepare('INSERT OR REPLACE INTO sales (id, customer_id, total, discount, tax, subtotal, date_created, payment_method, payment_status, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const s of data.sales) {
        insertSale.run(s.id, s.customer_id, s.total, s.discount || 0, s.tax || 0, s.subtotal || s.total, s.date_created || now, s.payment_method, s.payment_status, s.status || 'Completed', s.notes);
      }

      // Insert Sale Items
      const insertSaleItem = db!.prepare('INSERT OR REPLACE INTO sale_items (id, sale_id, product_id, product_name, quantity, price, purchase_price, is_custom, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const si of data.sale_items) {
        insertSaleItem.run(si.id, si.sale_id, si.product_id, si.product_name, si.quantity, si.price, si.purchase_price || 0, si.is_custom, si.created_at || now);
      }

      // POS Expansion Tables
      if (data.vendors) {
        const insertVendor = db!.prepare('INSERT OR REPLACE INTO vendors (id, name, phone, address, created_at) VALUES (?, ?, ?, ?, ?)');
        for (const v of data.vendors) insertVendor.run(v.id, v.name, v.phone, v.address, v.created_at || now);
      }
      if (data.purchases) {
        const insertPurchase = db!.prepare('INSERT OR REPLACE INTO purchases (id, vendor_id, total, date_created) VALUES (?, ?, ?, ?)');
        for (const p of data.purchases) insertPurchase.run(p.id, p.vendor_id, p.total, p.date_created || now);
      }
      if (data.inventory_batches) {
        const insertBatch = db!.prepare('INSERT OR REPLACE INTO inventory_batches (id, product_id, vendor_id, purchase_id, quantity_added, quantity_remaining, purchase_price, date_added) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        for (const b of data.inventory_batches) insertBatch.run(b.id, b.product_id, b.vendor_id, b.purchase_id, b.quantity_added, b.quantity_remaining, b.purchase_price, b.date_added || now);
      }
      if (data.customer_payments) {
        const insertCP = db!.prepare('INSERT OR REPLACE INTO customer_payments (id, customer_id, amount, notes, date_added) VALUES (?, ?, ?, ?, ?)');
        for (const cp of data.customer_payments) insertCP.run(cp.id, cp.customer_id, cp.amount, cp.notes, cp.date_added || now);
      }
      if (data.expenses) {
        const insertExpense = db!.prepare('INSERT OR REPLACE INTO expenses (id, title, category, amount, date_added, notes) VALUES (?, ?, ?, ?, ?, ?)');
        for (const e of data.expenses) insertExpense.run(e.id, e.title, e.category, e.amount, e.date_added || now, e.notes);
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
    const vendors = db.prepare('SELECT * FROM vendors ORDER BY name').all();
    return { success: true, data: vendors };
  } catch (error: any) {
    logger.error('Failed to get vendors:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-vendor', async (_, vendor: { name: string; phone?: string; address?: string }) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare('INSERT INTO vendors (name, phone, address) VALUES (?, ?, ?)');
    const info = stmt.run(vendor.name.trim(), vendor.phone || '', vendor.address || '');
    const newVendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(info.lastInsertRowid);
    return { success: true, data: newVendor };
  } catch (error: any) {
    logger.error('Failed to add vendor:', error);
    return { success: false, error: error.message };
  }
});

// ============= PURCHASES / INVENTORY BATCHES =============
ipcMain.handle('create-purchase', async (_, data: { vendor_id: number; items: any[]; total: number }) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const transaction = db.transaction(() => {
      const purchaseStmt = db!.prepare("INSERT INTO purchases (vendor_id, total, date_created) VALUES (?, ?, datetime('now', 'localtime'))");
      const info = purchaseStmt.run(data.vendor_id, data.total);
      const purchaseId = info.lastInsertRowid;
      
      const batchStmt = db!.prepare(`
        INSERT INTO inventory_batches (product_id, vendor_id, purchase_id, quantity_added, quantity_remaining, purchase_price, date_added)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      `);
      
      for (const item of data.items) {
        batchStmt.run(item.product_id, data.vendor_id, purchaseId, item.quantity, item.quantity, item.purchase_price);

        // Update WAC and stock in products table
        if (item.product_id) {
          const p = db!.prepare('SELECT stock, purchase_price FROM products WHERE id = ?').get(item.product_id) as any;
          if (p) {
             const oldStock = p.stock || 0;
             const oldPrice = p.purchase_price || 0;
             const newStock = oldStock + item.quantity;
             let newWAC = item.purchase_price;
             if (newStock > 0) {
               newWAC = ((oldStock * oldPrice) + (item.quantity * item.purchase_price)) / newStock;
             }
             db!.prepare('UPDATE products SET stock = ?, purchase_price = ? WHERE id = ?').run(newStock, newWAC, item.product_id);
          }
        }
      }
      return purchaseId;
    });
    const purchaseId = transaction();
    
    // Trigger auto-export after a successful purchase
    triggerAutoExport();

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

// ============= CUSTOMER HANDLERS =============

ipcMain.handle('update-customer', async (_, id: number, customer: { name: string; phone?: string; email?: string; address?: string }) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare('UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?');
    stmt.run(customer.name.trim(), customer.phone || '', customer.email || '', customer.address || '', id);
    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-customer', async (_, id: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
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
    
    // Calculate totals
    const totalTaken = sales.reduce((acc: number, s: any) => acc + (s.total || 0), 0);
    const totalPaid = payments.reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
    const balance = totalTaken - totalPaid;
    
    return { success: true, data: { customer, sales, payments, totalTaken, totalPaid, balance } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-customer-payment', async (_, data: { customer_id: number; amount: number; notes?: string }) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare('INSERT INTO customer_payments (customer_id, amount, notes) VALUES (?, ?, ?)');
    stmt.run(data.customer_id, data.amount, data.notes || '');
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
ipcMain.handle('get-expenses', async () => {
  try {
    if (!db) throw new Error('Database not initialized');
    const expenses = db.prepare('SELECT * FROM expenses ORDER BY date_added DESC').all();
    return { success: true, data: expenses };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-expense', async (_, data: { title: string; category?: string; amount: number; notes?: string }) => {
  try {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare('INSERT INTO expenses (title, category, amount, date_added, notes) VALUES (?, ?, ?, datetime(\'now\', \'localtime\'), ?)');
    stmt.run(data.title.trim(), data.category || '', data.amount, data.notes || '');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-expense', async (_, id: number) => {
  try {
    if (!db) throw new Error('Database not initialized');
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
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
