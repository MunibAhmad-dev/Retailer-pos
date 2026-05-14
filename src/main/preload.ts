// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Products
  getProducts: () => ipcRenderer.invoke('get-products'),
  addProduct: (product: any) => ipcRenderer.invoke('add-product', product),
  updateProduct: (id: number, product: any) => ipcRenderer.invoke('update-product', id, product),
  deleteProduct: (id: number) => ipcRenderer.invoke('delete-product', id),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: any) => ipcRenderer.invoke('update-settings', settings),

  // Sales
  createSale: (saleData: any) => ipcRenderer.invoke('create-sale', saleData),
  getSales: (opts?: { limit?: number; offset?: number; search?: string }) => ipcRenderer.invoke('get-sales', opts ?? {}),
  getSaleItems: (saleId: number) => ipcRenderer.invoke('get-sale-items', saleId),
  updateSaleStatus: (saleId: number, status: string) => ipcRenderer.invoke('update-sale-status', saleId, status),

  // Data
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: (data: any) => ipcRenderer.invoke('import-data', data),
  importDb: (filePath: string) => ipcRenderer.invoke('import-db', filePath),
  deleteAllData: () => ipcRenderer.invoke('delete-all-data'),
  seedDatabase: () => ipcRenderer.invoke('seed-database'),

  // POS Expansion Features
  getCustomers: () => ipcRenderer.invoke('get-customers'),
  addCustomer: (customer: any) => ipcRenderer.invoke('add-customer', customer),
  updateCustomer: (id: number, customer: any) => ipcRenderer.invoke('update-customer', id, customer),
  deleteCustomer: (id: number) => ipcRenderer.invoke('delete-customer', id),

  getVendors: () => ipcRenderer.invoke('get-vendors'),
  addVendor: (vendor: any) => ipcRenderer.invoke('add-vendor', vendor),
  updateVendor: (id: number, vendor: any) => ipcRenderer.invoke('update-vendor', id, vendor),
  deleteVendor: (id: number) => ipcRenderer.invoke('delete-vendor', id),
  getVendorDetails: (vendorId: number) => ipcRenderer.invoke('get-vendor-details', vendorId),
  getPurchaseItems: (purchaseId: number) => ipcRenderer.invoke('get-purchase-items', purchaseId),
  addVendorPayment: (data: any) => ipcRenderer.invoke('add-vendor-payment', data),
  
  getPurchases: () => ipcRenderer.invoke('get-purchases'),
  createPurchase: (data: any) => ipcRenderer.invoke('create-purchase', data),
  
  getInventoryBatches: (productId?: number) => ipcRenderer.invoke('get-inventory-batches', productId),
  getVendorPurchases: (vendorId?: number) => ipcRenderer.invoke('get-vendor-purchases', vendorId),
  getProductAnalytics: () => ipcRenderer.invoke('get-product-analytics'),
  getCustomerDetails: (customerId: number) => ipcRenderer.invoke('get-customer-details', customerId),
  addCustomerPayment: (data: any) => ipcRenderer.invoke('add-customer-payment', data),
  deleteVendorPayment: (id: number) => ipcRenderer.invoke('delete-vendor-payment', id),
  deleteCustomerPayment: (id: number) => ipcRenderer.invoke('delete-customer-payment', id),
  getProfitLossReport: (data?: any) => ipcRenderer.invoke('get-profit-loss-report', data),
  getBalanceSheet: (data?: any) => ipcRenderer.invoke('get-balance-sheet', data),

  // Dashboard
  getDashboardStats: (args?: any) => ipcRenderer.invoke('get-dashboard-stats', args),

  // Reports
  getReport: (args: any) => ipcRenderer.invoke('get-report', args),

  // Expenses
  getExpenses: () => ipcRenderer.invoke('get-expenses'),
  addExpense: (data: any) => ipcRenderer.invoke('add-expense', data),
  deleteExpense: (id: number) => ipcRenderer.invoke('delete-expense', id),

  // Auth
  verifyPassword: (password: string) => ipcRenderer.invoke('verify-password', password),

  // Printing
  printInvoice: (htmlContent: string) => ipcRenderer.invoke('print-invoice', htmlContent),
  saveInvoicePdf: (html: string) => ipcRenderer.invoke('save-invoice-pdf', html),

  // Assets
  getLogo: () => ipcRenderer.invoke('get-logo'),

  // Activation
  isActivated: () => ipcRenderer.invoke('is-activated'),
  activateApp: (data: { businessName: string, activationKey: string }) => ipcRenderer.invoke('activate-app', data),
  
  // New Licensing System V2
  getFingerprint: () => ipcRenderer.invoke('get-fingerprint'),
  activateAppV2: (licenseKey: string) => ipcRenderer.invoke('activate-app-v2', licenseKey),
  generateLicenseKey: (data: any) => ipcRenderer.invoke('generate-license-key', data),
  onToggleLicenseIssuer: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on('toggle-license-issuer', subscription);
    return () => ipcRenderer.removeListener('toggle-license-issuer', subscription);
  },

  // Cash Register
  getCurrentRegister: () => ipcRenderer.invoke('get-current-register'),
  openRegister: (data: { openingBalance: number; openedBy?: string }) => ipcRenderer.invoke('open-register', data),
  getRegisterSummary: (registerId: number) => ipcRenderer.invoke('get-register-summary', registerId),
  closeRegister: (data: { registerId: number; actualCash: number; closedBy?: string; notes?: string }) => ipcRenderer.invoke('close-register', data),
  getRegisterHistory: () => ipcRenderer.invoke('get-register-history'),

  // Financials
  getFinancialTransactions: () => ipcRenderer.invoke('get-financial-transactions'),
  addFinancialTransaction: (data: { type: string; category?: string; amount: number; description?: string; register_id?: number }) => ipcRenderer.invoke('add-financial-transaction', data),
  deleteFinancialTransaction: (id: number) => ipcRenderer.invoke('delete-financial-transaction', id),

  // Auto-Export
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  performAutoExport: () => ipcRenderer.invoke('perform-auto-export'),
  selectDbFile: () => ipcRenderer.invoke('select-db-file'),
  onAutoExportComplete: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('auto-export-complete', subscription);
    return () => ipcRenderer.removeListener('auto-export-complete', subscription);
  },

  // Google Drive Backup
  connectGoogleDrive: () => ipcRenderer.invoke('connect-google-drive'),
  getGoogleDriveStatus: () => ipcRenderer.invoke('get-google-drive-status'),
  triggerGoogleDriveBackup: () => ipcRenderer.invoke('trigger-google-drive-backup'),
  getAvailableBackups: () => ipcRenderer.invoke('get-available-backups'),
  restoreCloudBackup: (fileId: string) => ipcRenderer.invoke('restore-cloud-backup', fileId),
  onRestoreProgress: (callback: (data: { status: string, progress: number }) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('restore-progress', subscription);
    return () => ipcRenderer.removeListener('restore-progress', subscription);
  },

  // Returns & Adjustments
  createSaleReturn: (data: any) => ipcRenderer.invoke('create-sale-return', data),
  createPurchaseReturn: (data: any) => ipcRenderer.invoke('create-purchase-return', data),
  getSaleReturns: (opts?: any) => ipcRenderer.invoke('get-sale-returns', opts),
  getPurchaseReturns: (opts?: any) => ipcRenderer.invoke('get-purchase-returns', opts),
  getSaleReturnItems: (returnId: number) => ipcRenderer.invoke('get-sale-return-items', returnId),
  getPurchaseReturnItems: (returnId: number) => ipcRenderer.invoke('get-purchase-return-items', returnId),
  getAllPayments: (opts?: any) => ipcRenderer.invoke('get-all-payments', opts),
  createStockAdjustment: (data: any) => ipcRenderer.invoke('create-stock-adjustment', data),
  getStockAdjustments: (productId?: number) => ipcRenderer.invoke('get-stock-adjustments', productId),
  cancelSale: (id: number) => ipcRenderer.invoke('cancel-sale', id),
  cancelPurchase: (id: number) => ipcRenderer.invoke('cancel-purchase', id)
};

contextBridge.exposeInMainWorld('api', api);
