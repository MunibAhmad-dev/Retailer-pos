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
      isSetupComplete: () => Promise<ApiResponse<{ complete: boolean }> & { complete?: boolean }>;
      getSyncStatus: () => Promise<ApiResponse<{ pending: number; failed: number; cloudConnected: boolean; lastSync: string | null }>>;
      enqueueSyncItem: (item: { entityType: string; operation: string; payload: any; error?: string }) => Promise<ApiResponse<void>>;

      // Cloud sync queue
      getPendingSyncItems: (limit?: number) => Promise<ApiResponse<Array<{ id: number; entity_type: string; operation: string; payload: string; attempts: number }>>>;
      markSyncItemsDone: (ids: number[]) => Promise<ApiResponse<void>>;
      markSyncItemFailed: (id: number, error: string) => Promise<ApiResponse<void>>;
      enqueueSaleSync: (saleId: number) => Promise<ApiResponse<void>>;

      // Sales
      createSale: (saleData: any) => Promise<ApiResponse<{ saleId: number }>>;
      getSales: (opts?: { limit?: number; offset?: number; search?: string; startDate?: string; endDate?: string }) => Promise<ApiResponse<Sale[]>>;
      getSaleItems: (saleId: number) => Promise<ApiResponse<any[]>>;
      updateSaleStatus: (saleId: number, status: string) => Promise<ApiResponse<void>>;

      // Data
      exportData: () => Promise<ApiResponse<any>>;
      importData: (data: any) => Promise<ApiResponse<void>>;
      importDb: (filePath: string) => Promise<ApiResponse<void>>;
      deleteAllData: () => Promise<ApiResponse<void>>;
      seedDatabase: () => Promise<ApiResponse<void>>;

      // POS Expansion Features
      getCustomers: () => Promise<ApiResponse<any[]>>;
      addCustomer: (customer: any) => Promise<ApiResponse<any>>;
      updateCustomer: (id: number, customer: any) => Promise<ApiResponse<any>>;
      deleteCustomer: (id: number) => Promise<ApiResponse<void>>;

      getVendors: () => Promise<ApiResponse<any[]>>;
      addVendor: (vendor: any) => Promise<ApiResponse<any>>;
      updateVendor: (id: number, vendor: any) => Promise<ApiResponse<any>>;
      deleteVendor: (id: number) => Promise<ApiResponse<void>>;
      getVendorDetails: (vendorId: number) => Promise<ApiResponse<any>>;
      getPurchaseItems: (purchaseId: number) => Promise<ApiResponse<any[]>>;
      addVendorPayment: (data: any) => Promise<ApiResponse<void>>;

      getPurchases: () => Promise<ApiResponse<any[]>>;
      createPurchase: (data: any) => Promise<ApiResponse<{ purchaseId: number }>>;

      getInventoryBatches: (productId?: number) => Promise<ApiResponse<any[]>>;
      getVendorPurchases: (vendorId?: number) => Promise<ApiResponse<any[]>>;
      getProductAnalytics: () => Promise<ApiResponse<any>>;
      getCustomerDetails: (customerId: number) => Promise<ApiResponse<any>>;
      addCustomerPayment: (data: any) => Promise<ApiResponse<void>>;
      deleteVendorPayment: (id: number) => Promise<ApiResponse<void>>;
      deleteCustomerPayment: (id: number) => Promise<ApiResponse<void>>;
      getProfitLossReport: (data?: any) => Promise<ApiResponse<any>>;
      getBalanceSheet: (data?: any) => Promise<ApiResponse<any>>;

      // Dashboard
      getDashboardStats: (args?: any) => Promise<ApiResponse<DashboardStats>>;

      // Reports
      getReport: (args: 'today' | 'week' | 'month' | { startDate: string; endDate?: string }) => Promise<ApiResponse<any>>;

      // Expenses
      getExpenses: (opts?: any) => Promise<ApiResponse<any[]>>;
      addExpense: (data: any) => Promise<ApiResponse<void>>;
      deleteExpense: (id: number) => Promise<ApiResponse<void>>;

      // Auth
      verifyPassword: (password: string) => Promise<boolean | ApiResponse<{ isValid: boolean }>>;

      // Printing
      printInvoice: (htmlContent: string) => Promise<ApiResponse<void>>;
      saveInvoicePdf: (htmlContent: string) => Promise<ApiResponse<{ path?: string; filePath?: string }>>;

      // Assets
      getLogo: () => Promise<ApiResponse<string>>;

      // Activation
      isActivated: () => Promise<ApiResponse<{ activated: boolean }>>;
      activateApp: (data: { businessName: string, activationKey: string }) => Promise<ApiResponse<void>>;

      // New Licensing System V2
      getFingerprint: () => Promise<ApiResponse<string>>;
      activateAppV2: (licenseKey: string) => Promise<ApiResponse<void>>;
      clearLocalLicense: () => Promise<ApiResponse<void>>;
      generateLicenseKey: (data: any) => Promise<ApiResponse<string>>;
      onToggleLicenseIssuer: (callback: () => void) => () => void;

      // Cash Register
      getCurrentRegister: () => Promise<ApiResponse<any>>;
      openRegister: (data: { openingBalance: number; openedBy?: string }) => Promise<ApiResponse<any>>;
      getRegisterSummary: (registerId: number) => Promise<ApiResponse<any>>;
      closeRegister: (data: { registerId: number; actualCash: number; closedBy?: string; notes?: string }) => Promise<ApiResponse<any>>;
      getRegisterHistory: (opts?: any) => Promise<ApiResponse<any[]>>;

      // Financials
      getFinancialTransactions: () => Promise<ApiResponse<any[]>>;
      addFinancialTransaction: (data: { type: string; category?: string; amount: number; description?: string; register_id?: number }) => Promise<ApiResponse<void>>;
      deleteFinancialTransaction: (id: number) => Promise<ApiResponse<void>>;

      // Auto-Export
      selectDirectory: () => Promise<ApiResponse<string>>;
      performAutoExport: () => Promise<ApiResponse<void>>;
      selectDbFile: () => Promise<ApiResponse<string>>;
      onAutoExportComplete: (callback: (data: any) => void) => () => void;

      // Google Drive Backup
      connectGoogleDrive: () => Promise<ApiResponse<void>>;
      getGoogleDriveStatus: () => Promise<ApiResponse<any>>;
      triggerGoogleDriveBackup: () => Promise<ApiResponse<void>>;
      getAvailableBackups: () => Promise<ApiResponse<any[]>>;
      restoreCloudBackup: (fileId: string) => Promise<ApiResponse<void>>;
      disconnectGoogleDrive: () => Promise<ApiResponse<void>>;
      onRestoreProgress: (callback: (data: { status: string; progress: number }) => void) => () => void;

      // Returns & Adjustments
      createSaleReturn: (data: any) => Promise<ApiResponse<any>>;
      createPurchaseReturn: (data: any) => Promise<ApiResponse<any>>;
      getSaleReturns: (opts?: any) => Promise<ApiResponse<any[]>>;
      getPurchaseReturns: (opts?: any) => Promise<ApiResponse<any[]>>;
      getSaleReturnItems: (returnId: number) => Promise<ApiResponse<any[]>>;
      getPurchaseReturnItems: (returnId: number) => Promise<ApiResponse<any[]>>;
      getAllPayments: (opts?: any) => Promise<ApiResponse<any[]>>;
      createStockAdjustment: (data: any) => Promise<ApiResponse<any>>;
      getStockAdjustments: (productId?: number) => Promise<ApiResponse<any[]>>;
      cancelSale: (id: number) => Promise<ApiResponse<void>>;
      cancelPurchase: (id: number) => Promise<ApiResponse<void>>;

      // Cloud sync queue
      getPendingSyncItems: (limit?: number) => Promise<ApiResponse<Array<{ id: number; entity_type: string; operation: string; payload: string; attempts: number }>>>;
      markSyncItemsDone: (ids: number[]) => Promise<ApiResponse<void>>;
      markSyncItemFailed: (id: number, error: string) => Promise<ApiResponse<void>>;
      enqueueSaleSync: (saleId: number) => Promise<ApiResponse<void>>;
      fullResync: () => Promise<ApiResponse<{ enqueued: number }>>;
    };
  }
}

export {};
