import { get } from './client';

export interface ExpiringLicense {
  instance_id: string;
  instance_name?: string;
  expires_at: string;
  days_left: number;
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
  expiringCritical: ExpiringLicense[];
  expiringWarning: ExpiringLicense[];
  expired: ExpiringLicense[];
}

export interface RevenueByInstance {
  instance_id: string;
  instance_name?: string;
  revenue: number;
}

export interface ActivityDistribution {
  label: string;
  count: number;
}

export interface PlanDistribution {
  plan: string;
  count: number;
}

export interface SalesByDay {
  date: string;
  total: number;
  count: number;
}

export interface TopProduct {
  product_id: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface ProfitLossEntry {
  date: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface RegistrationTrend {
  date: string;
  count: number;
}

export interface AccountStats {
  totalAdmins?: number;
  totalInstances?: number;
  [key: string]: unknown;
}

export interface AnalyticsTotals {
  revenue?: number;
  sales?: number;
  expenses?: number;
  profit?: number;
  [key: string]: unknown;
}

export interface AnalyticsData {
  revenueByInstance: RevenueByInstance[];
  activityDistribution: ActivityDistribution[];
  planDistribution: PlanDistribution[];
  salesByDay: SalesByDay[];
  topProducts: TopProduct[];
  totals: AnalyticsTotals;
  profitLossData: ProfitLossEntry[];
  registrationsTrend: RegistrationTrend[];
  accountStats: AccountStats;
}

export interface AnalyticsParams {
  date_from?: string;
  date_to?: string;
}

export function getStats(): Promise<DashboardStats> {
  return get<DashboardStats>('/api/admin/stats');
}

export function getAnalytics(params?: AnalyticsParams): Promise<AnalyticsData> {
  return get<AnalyticsData>('/api/admin/analytics', params as Record<string, unknown>);
}
