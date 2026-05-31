import client from './client';

// ─── Shared param shapes ───────────────────────────────────────────────────────

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface DateRangeParams {
  date_from?: string;
  date_to?: string;
}

export interface InstancesParams extends PaginationParams, DateRangeParams {
  status?: string;
  search?: string;
}

export interface ApproveBody {
  plan?: string;
  duration_days?: number;
  notes?: string;
}

export interface CreateLicenseBody {
  plan: string;
  duration_days?: number;
  notes?: string;
  instance_id?: string | null;
}

// ─── Domain types ──────────────────────────────────────────────────────────────

export interface Instance {
  id: number;
  instance_id: string;
  store_name: string;
  owner_name: string;
  owner_mobile: string;
  owner_email?: string;
  store_address?: string;
  business_name?: string;
  license_plan?: string;
  license_expiry?: string;
  license_key?: string;
  approval_status: 'pending' | 'approved' | 'blocked';
  /** 1 = revoked, 0 = active */
  license_revoked?: number;
  branch_name?: string;
  block_reason?: string;
  last_seen?: string;
  app_version?: string;
  total_sales: number;
  total_revenue: number;
  total_customers: number;
  total_products: number;
  device_fingerprint?: string;
  created_at: string;
  updated_at: string;
}

export interface InstanceEvent {
  id: number;
  entity_type: string;
  operation: string;
  received_at: string;
}

export interface InstanceSalesStats {
  total_synced_sales: number;
  synced_revenue: number;
  last_sale_date?: string;
}

export interface InstanceDetail {
  instance: Instance;
  recentEvents: InstanceEvent[];
  salesStats: InstanceSalesStats;
}

export interface LicenseKey {
  id: number;
  license_key: string;
  instance_id?: string;
  plan: string;
  duration_days: number;
  expires_at?: string;
  is_active: number;
  notes?: string;
  issued_at: string;
  store_name?: string;
  owner_mobile?: string;
}

export interface AdminNotification {
  id: number;
  title: string;
  body: string;
  target_instance_id: string | null;
  target_store_name?: string;
  sent_at: string;
  is_active: number;
  read_count: number;
  target_count: number;
}

export interface ExpiringInstance {
  instance_id: string;
  store_name: string;
  owner_mobile: string;
  license_plan: string;
  license_expiry: string;
  days_left?: number;
  days_overdue?: number;
}

export interface DashboardStats {
  totalInstances: number;
  pending: number;
  blocked: number;
  approved: number;
  activeToday: number;
  activeWeek: number;
  totalRevenue: number;
  totalSales: number;
  licensesIssued: number;
  licensesAssigned: number;
  expiringCritical: ExpiringInstance[];
  expiringWarning: ExpiringInstance[];
  expired: ExpiringInstance[];
}

export interface RevenueByInstance {
  instance_id: string;
  store_name: string;
  owner_mobile: string;
  total_revenue: number;
  total_sales: number;
  total_customers: number;
  total_products: number;
}

export interface SalesByDay {
  day: string;
  sales_count: number;
  revenue: number;
  active_stores: number;
}

export interface ProfitLossEntry {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface RegistrationTrendEntry {
  month: string;
  newStores: number;
  total: number;
}

export interface AccountStats {
  typeDist: Array<{ account_type: string; count: number; total_balance: number }>;
  txnVolume: Array<{ txn_type: string; count: number; total_amount: number }>;
  totalBalance: number;
  totalTxns: number;
}

export interface AnalyticsTotals {
  total_customers: number;
  total_products: number;
  total_sales: number;
  total_revenue: number;
  total_vendors: number;
}

export interface AnalyticsData {
  revenueByInstance: RevenueByInstance[];
  activityDistribution: Array<{ period: string; count: number }>;
  planDistribution: Array<{ plan: string; count: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
  salesByDay: SalesByDay[];
  topEntityTypes: Array<{ entity_type: string; event_count: number }>;
  topProducts: Array<{ name: string; qty: number }>;
  totals: AnalyticsTotals;
  profitLossData: ProfitLossEntry[];
  registrationsTrend: RegistrationTrendEntry[];
  accountStats: AccountStats;
}

export interface LoanData {
  customerLoans: Array<{
    customer_name?: string;
    customer_id?: number;
    total_amount?: number;
    paid_amount?: number;
    balance?: number;
    [key: string]: unknown;
  }>;
  vendorLoans: Array<{
    vendor_name?: string;
    vendor_id?: number;
    total_amount?: number;
    paid_amount?: number;
    balance?: number;
    [key: string]: unknown;
  }>;
  totalReceivable: number;
  totalPayable: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
}

// ─── Dashboard stats ───────────────────────────────────────────────────────────

export async function getStats(): Promise<DashboardStats> {
  const { data } = await client.get('/admin/stats');
  return data.data as DashboardStats;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getAnalytics(params?: DateRangeParams): Promise<AnalyticsData> {
  const { data } = await client.get('/admin/analytics', { params });
  return data.data as AnalyticsData;
}

// ─── Instances ────────────────────────────────────────────────────────────────

export async function getInstances(
  params: InstancesParams
): Promise<{ data: Instance[]; total: number }> {
  const { data } = await client.get('/admin/instances', { params });
  return { data: data.data as Instance[], total: data.total as number };
}

export async function getInstance(id: string): Promise<InstanceDetail> {
  const { data } = await client.get(`/admin/instances/${id}`);
  return data.data as InstanceDetail;
}

export async function approveInstance(id: string, body: ApproveBody = {}): Promise<{
  success: boolean;
  licenseKey?: string;
  plan?: string;
  expiresAt?: string;
}> {
  const { data } = await client.post(`/admin/instances/${id}/approve`, body);
  return data;
}

export async function blockInstance(id: string, reason?: string): Promise<unknown> {
  const { data } = await client.post(`/admin/instances/${id}/block`, { reason });
  return data;
}

export async function blockLicense(id: string, reason?: string): Promise<unknown> {
  const { data } = await client.post(`/admin/instances/${id}/block-license`, { reason });
  return data;
}

export async function unblockLicense(id: string): Promise<unknown> {
  const { data } = await client.post(`/admin/instances/${id}/unblock-license`);
  return data;
}

export async function getInstanceSales(
  id: string,
  params?: PaginationParams & DateRangeParams
): Promise<{ data: unknown[]; total: number }> {
  const { data } = await client.get(`/admin/instances/${id}/sales`, { params });
  return { data: data.data, total: data.total };
}

export async function getInstanceProducts(id: string): Promise<unknown[]> {
  const { data } = await client.get(`/admin/instances/${id}/products`);
  return data.data;
}

export async function getInstanceCustomers(id: string): Promise<unknown[]> {
  const { data } = await client.get(`/admin/instances/${id}/customers`);
  return data.data;
}

export async function getInstanceVendors(id: string): Promise<unknown[]> {
  const { data } = await client.get(`/admin/instances/${id}/vendors`);
  return data.data;
}

export async function getInstancePurchases(id: string): Promise<unknown[]> {
  const { data } = await client.get(`/admin/instances/${id}/purchases`);
  return data.data;
}

export async function getInstanceExpenses(id: string): Promise<unknown[]> {
  const { data } = await client.get(`/admin/instances/${id}/expenses`);
  return data.data;
}

export async function getInstanceLoans(id: string): Promise<LoanData> {
  const { data } = await client.get(`/admin/instances/${id}/loans`);
  return data.data as LoanData;
}

export async function exportInstance(id: string): Promise<unknown> {
  const { data } = await client.get(`/admin/instances/${id}/export`);
  return data;
}

export async function exportAll(status?: string): Promise<unknown> {
  const { data } = await client.get('/admin/export-all', {
    params: status ? { status } : undefined,
  });
  return data;
}

// ─── Licenses ─────────────────────────────────────────────────────────────────

export async function getLicenses(): Promise<LicenseKey[]> {
  const { data } = await client.get('/admin/licenses');
  return data.data as LicenseKey[];
}

export async function createLicense(body: CreateLicenseBody): Promise<LicenseKey> {
  const { data } = await client.post('/admin/licenses', body);
  return data.data as LicenseKey;
}

export async function assignLicense(key: string, instanceId: string): Promise<unknown> {
  const { data } = await client.post(`/admin/licenses/${key}/assign`, {
    instance_id: instanceId,
  });
  return data;
}

export async function deleteLicense(key: string): Promise<unknown> {
  const { data } = await client.delete(`/admin/licenses/${key}`);
  return data;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getNotifications(): Promise<AdminNotification[]> {
  const { data } = await client.get('/admin/notifications');
  return data.data as AdminNotification[];
}

export async function createNotification(body: {
  title: string;
  body: string;
  instance_id?: string | null;
}): Promise<AdminNotification> {
  const { data } = await client.post('/admin/notifications', body);
  return data.data as AdminNotification;
}

export async function deleteNotification(id: number): Promise<unknown> {
  const { data } = await client.delete(`/admin/notifications/${id}`);
  return data;
}

// ─── Dev / seeding ────────────────────────────────────────────────────────────

export async function seedDemo(): Promise<unknown> {
  const { data } = await client.post('/admin/seed-demo');
  return data;
}

// ─── Releases (Software Update management) ────────────────────────────────────

export interface AppRelease {
  id: number;
  version: string;
  channel: string;
  changelog: string;
  download_url: string;
  file_size: number;
  is_mandatory: boolean;
  published: boolean;
  created_at: string;
  published_by: string;
}

export async function getReleases(): Promise<AppRelease[]> {
  const { data } = await client.get('/admin/releases');
  return (data.data ?? []) as AppRelease[];
}

export async function createRelease(body: Partial<AppRelease>): Promise<AppRelease> {
  const { data } = await client.post('/admin/releases', body);
  return data.data as AppRelease;
}

export async function updateRelease(id: number, body: Partial<AppRelease>): Promise<AppRelease> {
  const { data } = await client.patch(`/admin/releases/${id}`, body);
  return data.data as AppRelease;
}

export async function deleteRelease(id: number): Promise<void> {
  await client.delete(`/admin/releases/${id}`);
}

// ─── Auth (convenience re-export used by Login page) ──────────────────────────

export const authApi = {
  login: async (username: string, password: string): Promise<{ success: boolean; token: string }> => {
    const { data } = await client.post('/auth/login', { username, password });
    return data as { success: boolean; token: string };
  },
  me: async (): Promise<unknown> => {
    const { data } = await client.get('/auth/me');
    return data;
  },
};

// ─── Namespace objects (for pages that prefer grouped imports) ─────────────────

export const statsApi = {
  get: getStats,
};

export const analyticsApi = {
  get: getAnalytics,
};

export const instancesApi = {
  list: getInstances,
  get: getInstance,
  approve: approveInstance,
  block: blockInstance,
  blockLicense,
  unblockLicense,
  sales: getInstanceSales,
  products: getInstanceProducts,
  customers: getInstanceCustomers,
  vendors: getInstanceVendors,
  purchases: getInstancePurchases,
  expenses: getInstanceExpenses,
  loans: getInstanceLoans,
  export: exportInstance,
  exportAll,
};

export const licensesApi = {
  list: getLicenses,
  create: createLicense,
  assign: assignLicense,
  deactivate: deleteLicense,
};

export const notificationsApi = {
  list: getNotifications,
  create: createNotification,
  delete: deleteNotification,
};
