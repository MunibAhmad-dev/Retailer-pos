# Retailer POS + Supabase Integration Blueprint

This document is your end-to-end technical guide to convert this local Electron POS into a cloud-managed, admin-controlled SaaS-style product using Supabase.

It is written so you can manually code everything with clear structure, table design, API contracts, and implementation order.

---

## 1) Current App Snapshot (What you already have)

Your app is:
- Electron + React renderer
- SQLite local database (`pos.db`)
- IPC bridge through `src/main/preload.ts`
- Business modules already implemented:
  - products, sales, sale_items
  - customers, vendors, purchases
  - returns, payments, expenses
  - dashboard analytics, reports
  - local settings, subscription/license state
  - Google Drive backup hooks

Important existing IPC handlers are in `src/main/main.ts` and already expose all core CRUD/report functionality.

---

## 2) Target Architecture (After Supabase)

You should run a **hybrid architecture**:

1. Local-first (SQLite still primary for POS speed/offline)
2. Cloud sync to Supabase for:
   - central management
   - multi-device oversight
   - analytics and audits
   - admin actions (approve/block/plan/license)
3. Admin dashboard (web app) connected directly to Supabase
4. POS app periodically pulls admin decisions and pushes local data changes

Flow:
- POS user signs up / registers device
- Admin sees pending tenant in dashboard
- Admin approves + assigns plan + license policy
- POS app receives status on next sync and unlocks/blocks accordingly

---

## 3) Supabase Services You Will Use

Use all of these:
- `Supabase Auth`: sign-up/sign-in for tenants/admins
- `Postgres`: central data
- `Row Level Security (RLS)`: data isolation tenant-by-tenant
- `Storage`: backup files (`.db`, `.json`)
- `Edge Functions`: secure server-side jobs (plan checks, notifications, admin workflows)
- `Realtime` (optional but useful): push admin status changes instantly
- `Cron` (via pg_cron/Edge scheduling): periodic checks and reminders

---

## 4) Multi-Tenant Model (Critical)

Every row for business data must contain:
- `tenant_id uuid not null`

Admin and POS users are linked to tenant(s) using membership tables.

Never trust renderer-sent tenant IDs blindly. Resolve tenant context from authenticated user/session in main process or secure API layer.

---

## 5) Recommended Supabase Schema

## 5.1 Core Identity and Access

### `profiles`
- `id uuid pk` (same as auth.users.id)
- `full_name text`
- `role text check in ('super_admin','tenant_admin','staff')`
- `created_at timestamptz`

### `tenants`
- `id uuid pk`
- `business_name text`
- `status text check in ('pending','approved','blocked')`
- `created_by uuid` (auth user)
- `approved_by uuid null`
- `approved_at timestamptz null`
- `blocked_reason text null`
- `created_at timestamptz`

### `tenant_members`
- `id uuid pk`
- `tenant_id uuid fk`
- `user_id uuid fk`
- `role text check in ('owner','manager','cashier','viewer')`
- `is_active boolean`
- `created_at timestamptz`
- unique (`tenant_id`,`user_id`)

## 5.2 Subscription / Plans / License

### `plans`
- `id uuid pk`
- `code text unique` (`weekly`, `monthly`, `yearly`, `custom`)
- `name text`
- `duration_days int`
- `price numeric`
- `features jsonb`

### `tenant_subscriptions`
- `id uuid pk`
- `tenant_id uuid fk`
- `plan_id uuid fk`
- `starts_at timestamptz`
- `expires_at timestamptz`
- `status text check in ('active','expired','blocked','cancelled')`
- `assigned_by uuid`
- `created_at timestamptz`

### `devices`
- `id uuid pk`
- `tenant_id uuid fk`
- `fingerprint text`
- `device_name text`
- `is_active boolean`
- `last_seen_at timestamptz`
- unique (`tenant_id`,`fingerprint`)

### `license_keys` (if you keep key-based model)
- `id uuid pk`
- `tenant_id uuid fk`
- `plan_id uuid fk`
- `key_hash text` (store hash, not plain key)
- `max_devices int`
- `issued_at timestamptz`
- `expires_at timestamptz`
- `status text check in ('issued','activated','revoked','expired')`
- `issued_for_fingerprint text null`

## 5.3 POS Business Data (Cloud Mirror)

Mirror your local entities with tenant scope:
- `products`
- `customers`
- `vendors`
- `sales`
- `sale_items`
- `purchases`
- `purchase_items`
- `customer_payments`
- `vendor_payments`
- `expenses`
- `inventory_batches`
- `stock_adjustments`
- `sale_returns`
- `sale_return_items`
- `purchase_returns`
- `purchase_return_items`
- `register_sessions`
- `financial_transactions`

For each table add:
- `tenant_id uuid`
- `cloud_id uuid default gen_random_uuid()` (optional)
- `created_at timestamptz`
- `updated_at timestamptz`
- `deleted_at timestamptz null` (for soft delete sync)
- `local_row_version bigint default 1` (optional conflict helper)

## 5.4 Sync Tracking and Audit

### `sync_checkpoints`
- `id uuid pk`
- `tenant_id uuid`
- `device_id uuid`
- `last_push_at timestamptz`
- `last_pull_at timestamptz`
- `last_pushed_change_seq bigint`
- `last_pulled_server_seq bigint`

### `change_log` (server-side normalized event log)
- `id bigint generated always as identity pk`
- `tenant_id uuid`
- `entity text`
- `entity_id text`
- `op text check in ('insert','update','delete')`
- `payload jsonb`
- `source text check in ('pos','admin','system')`
- `created_at timestamptz`

### `notifications`
- `id uuid pk`
- `tenant_id uuid`
- `type text`
- `title text`
- `body text`
- `severity text`
- `is_read boolean`
- `target_user_id uuid null`
- `created_at timestamptz`

### `backup_jobs`
- `id uuid pk`
- `tenant_id uuid`
- `requested_by uuid`
- `source_device_id uuid null`
- `status text check in ('queued','running','success','failed')`
- `storage_path text null`
- `error text null`
- `created_at timestamptz`
- `finished_at timestamptz null`

---

## 6) Row Level Security (RLS) Policies

Enable RLS on all tenant tables.

Base policy pattern:
- User can access rows only where:
  - they are member of same `tenant_id`
  - and membership is active

Admin policy pattern:
- `super_admin` can read/write all rows.
- `tenant_admin` can manage within own tenant.

Example rule logic:
- SELECT allowed if `exists tenant_members where tenant_members.user_id = auth.uid() and tenant_members.tenant_id = row.tenant_id and is_active=true`
- INSERT/UPDATE/DELETE same tenant restriction.

---

## 7) Auth + Approval Flow

## 7.1 POS Sign-Up

1. User signs up with email/password (Supabase Auth).
2. POS creates:
   - `profiles` row
   - `tenants` row with `status='pending'`
   - `tenant_members` with role `owner`
3. POS enters limited mode (`pending approval` screen).

## 7.2 Admin Approval

In admin dashboard:
1. View pending tenants.
2. Approve tenant.
3. Assign plan (`tenant_subscriptions` row).
4. Optionally register initial device/license rules.

## 7.3 POS Activation by Cloud State

POS periodic check (or realtime):
- fetch tenant status + active subscription + block flags
- if approved and active plan => full access
- if blocked/expired => lock features per policy

This should gradually replace local-only activation flows (`activate-app` / `activate-app-v2`) or run in dual mode during migration.

---

## 8) License Strategy (Recommended)

You currently have encrypted local license keys. Keep compatibility but add cloud authority.

Recommended hierarchy:
1. Cloud status is source of truth (tenant + subscription + device state)
2. Local key accepted only if cloud unreachable and within grace window
3. Device fingerprint still validated against allowed devices

Add in settings:
- `license_mode`: `offline` or `online` (already exists)
- grace days when no internet check-in
- last successful cloud verification timestamp

---

## 9) Sync Design (Local SQLite <-> Supabase)

Use **outbox/inbox** model.

## 9.1 Local Tables to Add

### `sync_outbox`
- `id integer pk autoincrement`
- `entity text`
- `entity_pk text`
- `op text` (`insert`,`update`,`delete`)
- `payload text/json`
- `created_at`
- `attempts int`
- `status text` (`pending`,`sent`,`failed`)

### `sync_inbox`
- `id integer pk autoincrement`
- `server_event_id bigint`
- `entity text`
- `payload text/json`
- `applied_at`

## 9.2 Write Path

When local change happens (create sale, update stock, etc):
1. Write to normal local table
2. Append event to `sync_outbox` in same transaction

## 9.3 Push Job

Background job every N seconds:
1. Read pending outbox batch
2. Upsert to Supabase
3. Mark sent on success
4. Retry with backoff on failure

## 9.4 Pull Job

1. Request server changes after `last_pulled_server_seq`
2. Apply to local db in transactions
3. Record in `sync_inbox`

## 9.5 Conflict Policy

Start simple:
- Last write wins using `updated_at`
- Keep audit trail in `change_log`

Later improve:
- Entity-specific merge rules (inventory and payments need strict rules)

---

## 10) API Contracts You Should Build

You can use either:
- direct Supabase client in Electron main process, or
- your own backend/Edge Functions (recommended for sensitive admin actions).

Recommended secure endpoints/functions:

1. `POST /tenant/register`
- Input: business profile + owner info + device fingerprint
- Output: pending tenant record

2. `POST /admin/tenant/:id/approve`
- Assign plan, set status approved

3. `POST /admin/tenant/:id/block`
- Block tenant + reason

4. `POST /admin/tenant/:id/assign-plan`
- start/expiry, plan details

5. `POST /sync/push`
- batch changes from device

6. `GET /sync/pull?since=...`
- returns server-side changes

7. `POST /license/verify-device`
- Validate tenant/device/subscription/license state

8. `POST /admin/backup/request`
- create backup job + trigger snapshot workflow

9. `POST /notifications/send`
- send tenant/user notifications

10. `GET /tenant/state`
- returns combined state for POS: status, plan, expiry, flags, required actions

---

## 11) Mapping to Your Existing IPC Surface

Keep existing renderer API stable and implement cloud sync in main process behind it.

Examples:
- `create-sale`:
  - keep local insert logic
  - append outbox event
- `add-product`, `update-product`, `delete-product`:
  - same outbox pattern
- `update-settings`:
  - include cloud fields (`cloud_backend_url`, `cloud_backend_token`, `cloud_connected`)

Existing handlers you already have and should extend:
- `is-activated`, `activate-app-v2`, `get-fingerprint`
- `get-settings`, `update-settings`
- `export-data`, `import-data`, `import-db`
- Google Drive backup handlers

---

## 12) Admin Dashboard Scope

Build admin web panel (can be Next.js + Supabase):

Core pages:
1. Pending Signups
2. Tenants list
3. Tenant detail:
   - status
   - current plan
   - device list
   - sync health
   - backup history
4. Plan management
5. License/device management
6. Notifications center
7. Manual backup trigger + restore metadata

Actions:
- approve/reject tenant
- assign/change plan
- block/unblock
- force logout or revoke device
- send in-app notice

---

## 13) Backup Design

You currently support local export and Google Drive backup. Add Supabase storage backup too.

Suggested backup artifacts:
- encrypted SQLite snapshot (`.db.enc`) or raw `.db` if encryption later
- JSON export for portability

Storage path convention:
- `backups/{tenant_id}/{yyyy}/{mm}/{dd}/{timestamp}_{device_id}.db`

Metadata in `backup_jobs`:
- status transitions
- who requested
- size/hash
- retention rule

Retention example:
- keep daily 30 days
- keep weekly 12 weeks
- keep monthly 12 months

---

## 14) Notifications Strategy

Two channels:
1. In-app notifications table (`notifications`)
2. Optional email/WhatsApp webhook integration

Use cases:
- signup approved/rejected
- plan expiring in X days
- tenant blocked/unblocked
- backup failed
- long no-sync warning

Renderer can poll unread notifications or subscribe via realtime.

---

## 15) Security Checklist

1. Never use service role key in renderer.
2. Keep privileged operations in:
   - Electron main process only, or
   - Edge Functions/backend only.
3. Enable RLS on every tenant table.
4. Hash sensitive keys (license keys), don’t store plaintext.
5. Encrypt backup files before cloud upload (recommended).
6. Add rate limits for auth and activation endpoints.
7. Log audit events for admin actions.

---

## 16) Migration Plan (Phased)

## Phase 1: Foundation
- create Supabase project
- create base schema + RLS
- add auth signup/login in POS
- create tenant pending flow

## Phase 2: Admin Control
- build admin dashboard for approvals/plans/blocking
- tenant state endpoint/function
- POS polling for approval/subscription state

## Phase 3: Data Sync
- add local `sync_outbox`/`sync_inbox`
- implement push/pull jobs
- sync products/sales/payments first

## Phase 4: Full Module Sync
- add remaining entities: returns, purchases, inventory, expenses, register
- conflict handling hardening

## Phase 5: Backup + Notifications
- Supabase Storage backup pipeline
- admin-triggered backup
- in-app notification sync/realtime

## Phase 6: License Unification
- cloud-first verification
- keep offline fallback grace
- deprecate fully local-only licensing later

---

## 17) Concrete “Do This Next” Task List

1. Create Supabase schema migration SQL for:
   - `profiles`, `tenants`, `tenant_members`, `plans`, `tenant_subscriptions`, `devices`, `notifications`, `backup_jobs`, `change_log`, `sync_checkpoints`
2. Add POS auth screen (sign up/sign in) and store session securely.
3. Add pending approval screen in renderer.
4. Create admin dashboard with:
   - pending list
   - approve + assign plan
   - block/unblock
5. Add local sync tables in SQLite and outbox writes in key IPC handlers.
6. Implement `sync push/pull` in main process background interval.
7. Add cloud verification in `is-activated` flow (online mode).
8. Add backup upload to Supabase Storage and metadata row in `backup_jobs`.
9. Add notification fetch/realtime in renderer.
10. Add observability: sync logs, failure counters, last sync timestamp.

---

## 18) Suggested File-Level Changes in This Repo

1. `src/main/main.ts`
- add Supabase client bootstrap in main process
- add auth/session handlers
- extend `is-activated` to consult cloud state
- add sync scheduler startup

2. `src/main/preload.ts`
- expose new APIs:
  - `signUp`, `signIn`, `signOut`
  - `getTenantState`
  - `syncNow`
  - `getNotifications`
  - `requestCloudBackup`

3. `src/renderer/pages/Activation.tsx` and `src/renderer/pages/Subscription.tsx`
- evolve into cloud-aware states (pending/approved/blocked/expired)

4. `src/renderer/services/subscription.ts`
- source plan/status from cloud state in online mode
- preserve offline grace behavior

5. `src/renderer/pages/Settings.tsx`
- add cloud account state, sync controls, backup to cloud controls

6. New files (recommended):
- `src/main/cloud/supabaseClient.ts`
- `src/main/cloud/syncEngine.ts`
- `src/main/cloud/licenseGuard.ts`
- `src/main/cloud/backupManager.ts`
- `src/main/cloud/adminState.ts`

---

## 19) Minimal API Payload Examples

## 19.1 Sync Push
```json
{
  "tenant_id": "uuid",
  "device_id": "uuid",
  "changes": [
    {
      "entity": "sales",
      "entity_pk": "12345",
      "op": "insert",
      "updated_at": "2026-05-14T10:00:00Z",
      "payload": { "id": 12345, "total": 4500, "customer_id": 33 }
    }
  ]
}
```

## 19.2 Tenant State Response
```json
{
  "tenant_id": "uuid",
  "status": "approved",
  "blocked": false,
  "subscription": {
    "plan": "monthly",
    "expires_at": "2026-06-01T00:00:00Z",
    "days_remaining": 18
  },
  "device": {
    "allowed": true,
    "last_seen_at": "2026-05-14T09:59:20Z"
  }
}
```

---

## 20) Final Notes

- Keep local POS operations instant and robust; cloud should enhance control, not slow billing.
- Do not migrate all modules at once. Start with auth + approval + sales sync.
- Keep backward compatibility for current users while rolling out cloud mode.
- Build feature flags in settings (`cloud_connected`, `license_mode`) to switch safely.

If you follow this blueprint step-by-step, you can implement the full Supabase-powered admin + sync + licensing system without losing your current stable POS foundation.

