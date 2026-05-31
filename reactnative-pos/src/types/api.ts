// ─── Generic Wrappers ─────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: 'super_admin' | 'admin' | 'support';
  createdAt: string;
  updatedAt: string;
}

// ─── Instances ────────────────────────────────────────────────────────────────

export type InstanceStatus = 'active' | 'suspended' | 'pending' | 'expired';
export type InstancePlan = 'basic' | 'standard' | 'premium' | 'enterprise';

export interface Instance {
  id: number;
  instanceId: string;
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  plan: InstancePlan;
  status: InstanceStatus;
  licenseKey: string;
  expiresAt: string | null;
  lastSync: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstanceDetail extends Instance {
  totalProducts: number;
  totalCustomers: number;
  totalVendors: number;
  totalSales: number;
  totalRevenue: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: number;
  type: 'sale' | 'product_add' | 'customer_add' | 'vendor_add' | 'sync';
  description: string;
  timestamp: string;
}

// ─── License Keys ─────────────────────────────────────────────────────────────

export type LicenseStatus = 'active' | 'used' | 'expired' | 'revoked';

export interface LicenseKey {
  id: number;
  key: string;
  plan: InstancePlan;
  status: LicenseStatus;
  instanceId: string | null;
  generatedBy: number;
  expiresAt: string | null;
  activatedAt: string | null;
  createdAt: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType = 'info' | 'warning' | 'error' | 'success';
export type NotificationTarget = 'all' | 'instance' | 'plan';

export interface AdminNotification {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  target: NotificationTarget;
  targetValue: string | null;
  isRead: boolean;
  createdAt: string;
}

// ─── Dashboard & Analytics ────────────────────────────────────────────────────

export interface DashboardStats {
  totalInstances: number;
  activeInstances: number;
  suspendedInstances: number;
  pendingInstances: number;
  totalRevenue: number;
  revenueThisMonth: number;
  newInstancesThisMonth: number;
  totalLicenses: number;
  activeLicenses: number;
}

export interface SalesDay {
  date: string;
  revenue: number;
  transactions: number;
}

export interface TopProduct {
  productId: number;
  name: string;
  totalSold: number;
  totalRevenue: number;
}

export interface PlanDistribution {
  plan: InstancePlan;
  count: number;
  percentage: number;
}

export interface ActivityDistribution {
  type: string;
  count: number;
  percentage: number;
}

export interface AnalyticsData {
  salesByDay: SalesDay[];
  topProducts: TopProduct[];
  planDistribution: PlanDistribution[];
  activityDistribution: ActivityDistribution[];
  periodStart: string;
  periodEnd: string;
}

// ─── Loans ────────────────────────────────────────────────────────────────────

export type LoanType = 'customer' | 'vendor';
export type LoanStatus = 'open' | 'partial' | 'paid' | 'overdue';

export interface Loan {
  id: number;
  instanceId: string;
  type: LoanType;
  partyId: number;
  partyName: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: LoanStatus;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerLoan extends Loan {
  type: 'customer';
  customerId: number;
}

export interface VendorLoan extends Loan {
  type: 'vendor';
  vendorId: number;
}

export interface LoanData {
  customerLoans: CustomerLoan[];
  vendorLoans: VendorLoan[];
  totalCustomerBalance: number;
  totalVendorBalance: number;
  totalOutstanding: number;
}

// ─── Instance Data Models ──────────────────────────────────────────────────────
// Fields match actual backend snake_case response.
// camelCase aliases also added for convenience.

export interface Product {
  id: number;
  instance_id?: string;
  name: string;
  barcode?: string | null;
  sku?: string | null;
  category?: string | null;
  // Backend field names (snake_case)
  purchase_price?: number;
  price?: number;
  stock?: number;
  unit?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  // Camel-case aliases (used internally after transforms)
  costPrice?: number;
  salePrice?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Extra fields from POS backend
  product_type?: string;
  metadata?: Record<string, unknown>;
}

export interface Customer {
  id: number;
  instance_id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  balance?: number;
  totalPurchases?: number;
  total_purchases?: number;
  last_purchase?: string | null;
  created_at?: string;
  updated_at?: string;
  // camelCase aliases
  createdAt?: string;
  updatedAt?: string;
}

export interface Vendor {
  id: number;
  instance_id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  balance?: number;
  totalPurchases?: number;
  total_purchases?: number;
  created_at?: string;
  updated_at?: string;
  // camelCase aliases
  createdAt?: string;
  updatedAt?: string;
}

// Also export the actual backend Instance shape (snake_case)
export interface BackendInstance {
  id: number;
  instance_id: string;
  store_name: string;
  owner_name: string;
  owner_mobile: string;
  owner_email: string;
  store_address: string;
  business_name: string;
  api_key: string;
  license_key: string;
  license_plan: string;
  license_expiry: string | null;
  approval_status: 'pending' | 'approved' | 'blocked';
  block_reason: string;
  last_seen: string | null;
  app_version: string;
  total_sales: number;
  total_revenue: number;
  total_customers: number;
  total_products: number;
  device_fingerprint: string;
  license_revoked: number;
  branch_name: string;
  created_at: string;
  updated_at: string;
}
