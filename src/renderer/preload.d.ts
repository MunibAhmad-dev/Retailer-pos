// src/preload.d.ts
export interface Product {
  id?: number;
  name: string;
  price: number;
  category: string;
}

export interface Settings {
  store_name: string;
  store_phone: string;
  store_address: string;
  store_logo: string;
  receipt_footer: string;
  pos_password: string;
}

export interface Sale {
  id: number;
  customer_id?: number;
  total: number;
  date_created: string;
  payment_method: string;
  items_summary?: string;
}

export interface DashboardStats {
  totalSalesToday: number;
  totalSalesWeek: number;
  totalSalesMonth: number;
  totalTransactions: number;
  totalTransactionsToday: number;
  totalProducts: number;
  topProducts: Array<{ name: string; qty_sold: number; revenue: number }>;
}

export interface Report {
  period: string;
  startDate: string;
  sales: any[];
  revenue: number;
  totalSales: number;
  topProducts: any[];
  salesByHour: any[];
  paymentMethods: any[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

declare global {
  interface Window {
    api: {
      // Products
      getProducts: () => Promise<ApiResponse<Product[]>>;
      addProduct: (product: Omit<Product, 'id'>) => Promise<ApiResponse<Product>>;
      updateProduct: (id: number, product: Partial<Product>) => Promise<ApiResponse<Product>>;
      deleteProduct: (id: number) => Promise<ApiResponse<void>>;
      
      // Settings
      getSettings: () => Promise<ApiResponse<Settings>>;
      updateSettings: (settings: Partial<Settings>) => Promise<ApiResponse<Settings>>;
      
      // Sales
      createSale: (saleData: any) => Promise<ApiResponse<{ saleId: number }>>;
      getSales: () => Promise<ApiResponse<Sale[]>>;
      getSaleItems: (saleId: number) => Promise<ApiResponse<any[]>>;

      // POS Expansion Features
      getCustomers: () => Promise<ApiResponse<any[]>>;
      addCustomer: (customer: any) => Promise<ApiResponse<any>>;
      updateCustomer: (id: number, customer: any) => Promise<ApiResponse<any>>;
      deleteCustomer: (id: number) => Promise<ApiResponse<void>>;

      getVendors: () => Promise<ApiResponse<any[]>>;
      addVendor: (vendor: any) => Promise<ApiResponse<any>>;
      createPurchase: (data: any) => Promise<ApiResponse<{ purchaseId: number }>>;
      getInventoryBatches: (productId?: number) => Promise<ApiResponse<any[]>>;
      getCustomerDetails: (customerId: number) => Promise<ApiResponse<any>>;
      addCustomerPayment: (data: any) => Promise<ApiResponse<void>>;
      getProfitLossReport: (data?: any) => Promise<ApiResponse<any>>;
      
      // Dashboard
      getDashboardStats: () => Promise<ApiResponse<DashboardStats>>;
      
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
      
      // Assets
      getLogo: () => Promise<ApiResponse<string>>;

      // Activation
      isActivated: () => Promise<ApiResponse<{ activated: boolean }>>;
      activateApp: (data: { businessName: string, activationKey: string }) => Promise<ApiResponse<void>>;
    };
  }
}

export {};