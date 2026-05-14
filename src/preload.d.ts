export interface Product {
  id?: number;
  name: string;
  price: number;
  category: string;
}

export interface Settings {
  id: number;
  store_name: string;
  store_phone: string;
  store_address: string;
  store_logo: string;
  receipt_footer: string;
  pos_password?: string;
  updated_at: string;
}

export interface SaleItem {
  product_id?: number;
  product_name: string;
  quantity: number;
  price: number;
  is_custom?: boolean;
}

export interface SaleData {
  customer_id?: number;
  items: SaleItem[];
  total: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  payment_method: string;
  notes?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface POSApi {
  // Products
  getProducts: () => Promise<ApiResponse<Product[]>>;
  addProduct: (product: Product) => Promise<ApiResponse<Product>>;
  updateProduct: (id: number, product: Product) => Promise<ApiResponse<Product>>;
  deleteProduct: (id: number) => Promise<ApiResponse<void>>;

  // Settings
  getSettings: () => Promise<ApiResponse<Settings>>;
  updateSettings: (settings: Partial<Settings>) => Promise<ApiResponse<Settings>>;

  // Sales
  createSale: (saleData: SaleData) => Promise<ApiResponse<{ saleId: number }>>;
  getSales: () => Promise<ApiResponse<any[]>>;
  getSaleItems: (saleId: number) => Promise<ApiResponse<any[]>>;
  updateSaleStatus: (saleId: number, status: string) => Promise<ApiResponse<void>>;

  // Data Management
  exportData: () => Promise<ApiResponse<any>>;
  importData: (data: any) => Promise<ApiResponse<void>>;
  deleteAllData: () => Promise<ApiResponse<void>>;

  // POS Expansion Features
  getCustomers: () => Promise<ApiResponse<any[]>>;
  addCustomer: (customer: any) => Promise<ApiResponse<any>>;
  updateCustomer: (id: number, customer: any) => Promise<ApiResponse<any>>;
  deleteCustomer: (id: number) => Promise<ApiResponse<void>>;

  getVendors: () => Promise<ApiResponse<any[]>>;
  addVendor: (vendor: any) => Promise<ApiResponse<any>>;
  createPurchase: (data: any) => Promise<ApiResponse<{ purchaseId: number }>>;
  getInventoryBatches: (productId?: number) => Promise<ApiResponse<any[]>>;
  getVendorPurchases: (vendorId?: number) => Promise<ApiResponse<any[]>>;
  getProductAnalytics: () => Promise<ApiResponse<any[]>>;
  getCustomerDetails: (customerId: number) => Promise<ApiResponse<any>>;
  addCustomerPayment: (data: any) => Promise<ApiResponse<void>>;
  getProfitLossReport: (data?: any) => Promise<ApiResponse<any>>;

  // Dashboard
  getDashboardStats: (args?: { startDate?: string; endDate?: string }) => Promise<ApiResponse<any>>;

  // Reports
  getReport: (args: 'today' | 'week' | 'month' | { startDate: string; endDate?: string }) => Promise<ApiResponse<any>>;

  // Expenses
  getExpenses: () => Promise<ApiResponse<any[]>>;
  addExpense: (data: any) => Promise<ApiResponse<void>>;
  deleteExpense: (id: number) => Promise<ApiResponse<void>>;

  // Auth
  verifyPassword: (password: string) => Promise<boolean | ApiResponse<{ isValid: boolean }>>;

  // Printing
  printInvoice: (htmlContent: string) => Promise<ApiResponse<void>>;
  saveInvoicePdf: (htmlContent: string) => Promise<ApiResponse<{ success: boolean; filePath?: string }>>;
  
  // Assets
  getLogo: () => Promise<ApiResponse<string>>;

  // Activation
  isActivated: () => Promise<ApiResponse<{ activated: boolean }>>;
  activateApp: (data: { businessName: string, activationKey: string }) => Promise<ApiResponse<void>>;
  getFingerprint: () => Promise<ApiResponse<string>>;
  activateAppV2: (licenseKey: string) => Promise<ApiResponse<void>>;
  generateLicenseKey: (data: any) => Promise<ApiResponse<string>>;
  onToggleLicenseIssuer: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    api: POSApi;
  }
}
