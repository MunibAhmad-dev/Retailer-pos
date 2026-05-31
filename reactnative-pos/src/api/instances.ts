import { get } from './client';

// ─── Core Types ───────────────────────────────────────────────────────────────

export interface Instance {
  id: string;
  name: string;
  status: 'pending' | 'approved' | 'blocked';
  plan?: string;
  owner_name?: string;
  owner_phone?: string;
  created_at: string;
  last_active?: string;
  expires_at?: string;
}

export interface RecentEvent {
  id: number;
  event_type: string;
  description?: string;
  created_at: string;
}

export interface SalesStats {
  total_sales: number;
  total_revenue: number;
  average_sale?: number;
}

export interface InstanceDetail {
  instance: Instance;
  recentEvents: RecentEvent[];
  salesStats: SalesStats;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

export interface InstancesParams {
  status?: 'pending' | 'approved' | 'blocked';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface Sale {
  id: string | number;
  total: number;
  items_count?: number;
  created_at: string;
  customer_name?: string;
}

export interface Product {
  id: string | number;
  name: string;
  price: number;
  stock?: number;
  category?: string;
  created_at?: string;
}

export interface Customer {
  id: string | number;
  name: string;
  phone?: string;
  balance: number;
  created_at?: string;
}

export interface Vendor {
  id: string | number;
  name: string;
  phone?: string;
  balance: number;
  created_at?: string;
}

export interface LoanEntry {
  id: string | number;
  name: string;
  phone?: string;
  amount: number;
  type?: string;
}

export interface LoanData {
  customerLoans: LoanEntry[];
  vendorLoans: LoanEntry[];
  totalReceivable: number;
  totalPayable: number;
}

export interface Expense {
  id: string | number;
  category?: string;
  amount: number;
  note?: string;
  created_at: string;
}

export interface Purchase {
  id: string | number;
  vendor_name?: string;
  total: number;
  created_at: string;
}

// ─── API Functions ────────────────────────────────────────────────────────────

export function getInstances(
  params?: InstancesParams,
): Promise<PaginatedResponse<Instance>> {
  return get<PaginatedResponse<Instance>>(
    '/api/admin/instances',
    params as Record<string, unknown>,
  );
}

export function getInstance(id: string): Promise<InstanceDetail> {
  return get<InstanceDetail>(`/api/admin/instances/${id}`);
}

export function getInstanceSales(
  id: string,
  params?: Record<string, unknown>,
): Promise<Sale[]> {
  return get<Sale[]>(`/api/admin/instances/${id}/sales`, params);
}

export function getInstanceProducts(id: string): Promise<Product[]> {
  return get<Product[]>(`/api/admin/instances/${id}/products`);
}

export function getInstanceCustomers(id: string): Promise<Customer[]> {
  return get<Customer[]>(`/api/admin/instances/${id}/customers`);
}

export function getInstanceVendors(id: string): Promise<Vendor[]> {
  return get<Vendor[]>(`/api/admin/instances/${id}/vendors`);
}

export function getInstanceLoans(id: string): Promise<LoanData> {
  return get<LoanData>(`/api/admin/instances/${id}/loans`);
}

export function getInstanceExpenses(id: string): Promise<Expense[]> {
  return get<Expense[]>(`/api/admin/instances/${id}/expenses`);
}

export function getInstancePurchases(id: string): Promise<Purchase[]> {
  return get<Purchase[]>(`/api/admin/instances/${id}/purchases`);
}
