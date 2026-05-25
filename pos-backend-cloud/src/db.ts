// Use Node 24's built-in SQLite — zero native compilation needed.
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = process.env.DB_PATH || './pos_cloud.db';
const dbPath = path.resolve(process.cwd(), DB_PATH);

const db = new DatabaseSync(dbPath);

// Enable WAL mode for better concurrent read performance
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  -- Each retailer POS installation
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

  -- Raw log of every sync event received from POS instances
  CREATE TABLE IF NOT EXISTS sync_events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id   TEXT NOT NULL,
    entity_type   TEXT NOT NULL,
    operation     TEXT NOT NULL,
    payload       TEXT NOT NULL,
    received_at   TEXT DEFAULT (datetime('now'))
  );

  -- Flattened sales table for fast per-instance querying
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

  -- Admin users who can log into the dashboard
  CREATE TABLE IF NOT EXISTS admin_users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT DEFAULT 'admin',
    created_at    TEXT DEFAULT (datetime('now'))
  );

  -- License keys managed by admin; can be pre-generated and assigned
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

  -- Indexes for common queries
  CREATE INDEX IF NOT EXISTS idx_sync_events_instance ON sync_events(instance_id);
  CREATE INDEX IF NOT EXISTS idx_sync_events_type     ON sync_events(entity_type, operation);
  CREATE INDEX IF NOT EXISTS idx_sales_instance       ON instance_sales(instance_id);
  CREATE INDEX IF NOT EXISTS idx_instances_status     ON instances(approval_status);
  CREATE INDEX IF NOT EXISTS idx_instances_last_seen  ON instances(last_seen);
`);

console.log(`[DB] Connected to SQLite at ${dbPath}`);

export default db;
