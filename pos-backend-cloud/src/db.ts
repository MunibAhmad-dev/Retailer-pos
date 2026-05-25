import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = process.env.DB_PATH || './pos_cloud.db';
const dbPath = path.resolve(process.cwd(), DB_PATH);

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS instances (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id       TEXT UNIQUE NOT NULL,
    store_name        TEXT DEFAULT '',
    owner_name        TEXT DEFAULT '',
    owner_mobile      TEXT NOT NULL,
    owner_email       TEXT DEFAULT '',
    store_address     TEXT DEFAULT '',
    business_name     TEXT DEFAULT '',
    api_key           TEXT UNIQUE NOT NULL,
    license_key       TEXT DEFAULT '',
    license_plan      TEXT DEFAULT 'none',
    license_expiry    TEXT DEFAULT NULL,
    approval_status   TEXT DEFAULT 'pending',
    block_reason      TEXT DEFAULT '',
    last_seen         TEXT DEFAULT NULL,
    app_version       TEXT DEFAULT '',
    total_sales       INTEGER DEFAULT 0,
    total_revenue     REAL DEFAULT 0,
    total_customers   INTEGER DEFAULT 0,
    total_products    INTEGER DEFAULT 0,
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sync_events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id   TEXT NOT NULL,
    entity_type   TEXT NOT NULL,
    operation     TEXT NOT NULL,
    payload       TEXT NOT NULL,
    received_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS instance_sales (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id     TEXT NOT NULL,
    pos_sale_id     INTEGER NOT NULL,
    total           REAL DEFAULT 0,
    discount        REAL DEFAULT 0,
    payment_method  TEXT DEFAULT 'cash',
    payment_status  TEXT DEFAULT 'Paid',
    status          TEXT DEFAULT 'Completed',
    items_count     INTEGER DEFAULT 0,
    items_summary   TEXT DEFAULT '',
    date_created    TEXT DEFAULT NULL,
    synced_at       TEXT DEFAULT (datetime('now')),
    UNIQUE(instance_id, pos_sale_id)
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT DEFAULT 'admin',
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS license_keys (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key   TEXT UNIQUE NOT NULL,
    instance_id   TEXT DEFAULT NULL,
    plan          TEXT NOT NULL DEFAULT 'monthly',
    duration_days INTEGER DEFAULT 30,
    issued_at     TEXT DEFAULT (datetime('now')),
    expires_at    TEXT DEFAULT NULL,
    is_active     INTEGER DEFAULT 1,
    notes         TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    title              TEXT NOT NULL,
    body               TEXT NOT NULL,
    target_instance_id TEXT DEFAULT NULL,
    sent_at            TEXT DEFAULT (datetime('now')),
    is_active          INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS notification_reads (
    notification_id INTEGER NOT NULL,
    instance_id     TEXT NOT NULL,
    read_at         TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (notification_id, instance_id)
  );

  CREATE INDEX IF NOT EXISTS idx_sync_events_instance ON sync_events(instance_id);
  CREATE INDEX IF NOT EXISTS idx_sync_events_type     ON sync_events(entity_type, operation);
  CREATE INDEX IF NOT EXISTS idx_sales_instance       ON instance_sales(instance_id);
  CREATE INDEX IF NOT EXISTS idx_instances_status     ON instances(approval_status);
  CREATE INDEX IF NOT EXISTS idx_instances_last_seen  ON instances(last_seen);
  CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_instance_id);
`);

// ── Migrations (safe — catch "duplicate column" errors) ──────────────────────
try {
  db.exec(`ALTER TABLE instances ADD COLUMN device_fingerprint TEXT DEFAULT ''`);
  console.log('[DB] Migration: added device_fingerprint column');
} catch { /* column already exists */ }

try {
  db.exec(`ALTER TABLE instances ADD COLUMN license_revoked INTEGER DEFAULT 0`);
  console.log('[DB] Migration: added license_revoked column');
} catch { /* column already exists */ }

try {
  db.exec(`ALTER TABLE instances ADD COLUMN branch_name TEXT DEFAULT 'Main Branch'`);
  console.log('[DB] Migration: added branch_name column');
} catch { /* column already exists */ }

console.log(`[DB] Connected to SQLite at ${dbPath}`);

export default db;