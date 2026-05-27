import client from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  license_revoked?: number;   // 1 = revoked, 0 = active
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

export interface InstanceDetail {
  instance: Instance;
  recentEvents: Array<{
    id: number;
    entity_type: string;
    operation: string;
    received_at: string;
  }>;
  salesStats: {
    total_synced_sales: number;
    synced_revenue: number;
    last_sale_date?: string;
  };
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

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (username: string, password: string) => {
    const { data } = await client.post('/auth/login', { username, password });
    return data as { success: boolean; token: string };
  },
  me: async () => {
    const { data } = await client.get('/auth/me');
    return data;
  },
};

// ─── Admin Stats ──────────────────────────────────────────────────────────────

export const statsApi = {
  get: async (): Promise<DashboardStats> => {
    const { data } = await client.get('/admin/stats');
    return data.data as DashboardStats;
  },
};

// ─── Instances ────────────────────────────────────────────────────────────────

export const instancesApi = {
  list: async (params?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
    date_from?: string;
    date_to?: string;
  }) => {
    const { data } = await client.get('/admin/instances', { params });
    return data as { success: boolean; data: Instance[]; total: number };
  },

  get: async (instanceId: string): Promise<InstanceDetail> => {
    const { data } = await client.get(`/admin/instances/${instanceId}`);
    return data.data as InstanceDetail;
  },

  approve: async (instanceId: string, payload?: { plan?: string; duration_days?: number; notes?: string }) => {
    const { data } = await client.post(`/admin/instances/${instanceId}/approve`, payload ?? {});
    return data as { success: boolean; licenseKey?: string; plan?: string; expiresAt?: string };
  },

  block: async (instanceId: string, reason?: string) => {
    const { data } = await client.post(`/admin/instances/${instanceId}/block`, { reason });
    return data;
  },

  blockLicense: async (instanceId: string, reason?: string) => {
    const { data } = await client.post(`/admin/instances/${instanceId}/block-license`, { reason });
    return data;
  },

  unblockLicense: async (instanceId: string) => {
    const { data } = await client.post(`/admin/instances/${instanceId}/unblock-license`);
    return data;
  },

  sales: async (instanceId: string, params?: { limit?: number; offset?: number; date_from?: string; date_to?: string }) => {
    const { data } = await client.get(`/admin/instances/${instanceId}/sales`, { params });
    return data as { success: boolean; data: any[]; total: number };
  },

  products: async (instanceId: string) => {
    const { data } = await client.get(`/admin/instances/${instanceId}/products`);
    return data as { success: boolean; data: any[]; total: number };
  },

  customers: async (instanceId: string) => {
    const { data } = await client.get(`/admin/instances/${instanceId}/customers`);
    return data as { success: boolean; data: any[]; total: number };
  },

  vendors: async (instanceId: string) => {
    const { data } = await client.get(`/admin/instances/${instanceId}/vendors`);
    return data as { success: boolean; data: any[]; total: number };
  },

  purchases: async (instanceId: string) => {
    const { data } = await client.get(`/admin/instances/${instanceId}/purchases`);
    return data as { success: boolean; data: any[]; total: number };
  },

  expenses: async (instanceId: string) => {
    const { data } = await client.get(`/admin/instances/${instanceId}/expenses`);
    return data as { success: boolean; data: any[]; total: number };
  },

  loans: async (instanceId: string) => {
    const { data } = await client.get(`/admin/instances/${instanceId}/loans`);
    return data as {
      success: boolean;
      data: {
        customerLoans: any[];
        vendorLoans: any[];
        totalReceivable: number;
        totalPayable: number;
      };
    };
  },

  export: async (instanceId: string, entity?: string) => {
    const { data } = await client.get(`/admin/instances/${instanceId}/export`, {
      params: entity ? { entity } : undefined,
    });
    return data;
  },

  exportAll: async (params?: { status?: string }) => {
    const { data } = await client.get('/admin/export-all', { params });
    return data;
  },
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsData {
  revenueByInstance: Array<{
    instance_id: string; store_name: string; owner_mobile: string;
    total_revenue: number; total_sales: number; total_customers: number; total_products: number;
  }>;
  activityDistribution: Array<{ period: string; count: number }>;
  planDistribution: Array<{ plan: string; count: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
  salesByDay: Array<{ day: string; sales_count: number; revenue: number; active_stores: number }>;
  topEntityTypes: Array<{ entity_type: string; event_count: number }>;
  topProducts: Array<{ name: string; qty: number }>;
  totals: {
    total_customers: number;
    total_products: number;
    total_sales: number;
    total_revenue: number;
    total_vendors: number;
  };
  // New chart data
  profitLossData: Array<{ month: string; revenue: number; expenses: number; profit: number }>;
  registrationsTrend: Array<{ month: string; newStores: number; total: number }>;
  accountStats: {
    typeDist: Array<{ account_type: string; count: number; total_balance: number }>;
    txnVolume: Array<{ txn_type: string; count: number; total_amount: number }>;
    totalBalance: number;
    totalTxns: number;
  };
}

export const analyticsApi = {
  get: async (params?: { date_from?: string; date_to?: string }): Promise<AnalyticsData> => {
    const { data } = await client.get('/admin/analytics', { params });
    return data.data as AnalyticsData;
  },
};

// ─── Licenses ─────────────────────────────────────────────────────────────────

export const licensesApi = {
  list: async () => {
    const { data } = await client.get('/admin/licenses');
    return data.data as LicenseKey[];
  },

  create: async (payload: {
    plan: string;
    duration_days?: number;
    notes?: string;
    instance_id?: string;
  }) => {
    const { data } = await client.post('/admin/licenses', payload);
    return data.data;
  },

  assign: async (key: string, instance_id: string) => {
    const { data } = await client.post(`/admin/licenses/${key}/assign`, { instance_id });
    return data;
  },

  deactivate: async (key: string) => {
    const { data } = await client.delete(`/admin/licenses/${key}`);
    return data;
  },
};

// ─── Notifications ─────────────────────────────────────────────────────────────

export const notificationsApi = {
  list: async () => {
    const { data } = await client.get('/admin/notifications');
    return data.data as AdminNotification[];
  },

  create: async (payload: { title: string; body: string; instance_id?: string }) => {
    const { data } = await client.post('/admin/notifications', payload);
    return data as { success: boolean; data: AdminNotification };
  },

  delete: async (id: number) => {
    const { data } = await client.delete(`/admin/notifications/${id}`);
    return data;
  },
};
