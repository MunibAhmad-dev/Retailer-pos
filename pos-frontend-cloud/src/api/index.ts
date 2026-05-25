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
  block_reason?: string;
  last_seen?: string;
  app_version?: string;
  total_sales: number;
  total_revenue: number;
  total_customers: number;
  total_products: number;
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
  }) => {
    const { data } = await client.get('/admin/instances', { params });
    return data as { success: boolean; data: Instance[]; total: number };
  },

  get: async (instanceId: string): Promise<InstanceDetail> => {
    const { data } = await client.get(`/admin/instances/${instanceId}`);
    return data.data as InstanceDetail;
  },

  approve: async (instanceId: string) => {
    const { data } = await client.post(`/admin/instances/${instanceId}/approve`);
    return data;
  },

  block: async (instanceId: string, reason?: string) => {
    const { data } = await client.post(`/admin/instances/${instanceId}/block`, { reason });
    return data;
  },

  sales: async (instanceId: string, params?: { limit?: number; offset?: number }) => {
    const { data } = await client.get(`/admin/instances/${instanceId}/sales`, { params });
    return data as { success: boolean; data: any[]; total: number };
  },

  export: async (instanceId: string) => {
    const { data } = await client.get(`/admin/instances/${instanceId}/export`);
    return data;
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
