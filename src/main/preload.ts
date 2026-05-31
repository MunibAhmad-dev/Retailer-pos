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
  isSetupComplete: () => ipcRenderer.invoke('is-setup-complete'),
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
  enqueueSyncItem: (item: any) => ipcRenderer.invoke('enqueue-sync-item', item),

  // Sales
  createSale: (saleData: any) => ipcRenderer.invoke('create-sale', saleData),
  getSales: (opts?: { limit?: number; offset?: number; search?: string; startDate?: string; endDate?: string }) => ipcRenderer.invoke('get-sales', opts ?? {}),
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
  writeOffSaleBalance: (saleId: number, amount: number) => ipcRenderer.invoke('write-off-sale-balance', saleId, amount),
  setProductPurchaseStatus: (id: number, status: string) => ipcRenderer.invoke('set-product-purchase-status', id, status),
  deleteVendorPayment: (id: number) => ipcRenderer.invoke('delete-vendor-payment', id),
  deleteCustomerPayment: (id: number) => ipcRenderer.invoke('delete-customer-payment', id),
  getProfitLossReport: (data?: any) => ipcRenderer.invoke('get-profit-loss-report', data),
  getBalanceSheet: (data?: any) => ipcRenderer.invoke('get-balance-sheet', data),

  // Dashboard
  getDashboardStats: (args?: any) => ipcRenderer.invoke('get-dashboard-stats', args),
  getBakeryDashboard: () => ipcRenderer.invoke('get-bakery-dashboard'),

  // Reports
  getReport: (args: any) => ipcRenderer.invoke('get-report', args),

  // Expenses
  getExpenses: (opts?: any) => ipcRenderer.invoke('get-expenses', opts),
  addExpense: (data: any) => ipcRenderer.invoke('add-expense', data),
  deleteExpense: (id: number) => ipcRenderer.invoke('delete-expense', id),

  // Auth
  verifyPassword: (password: string) => ipcRenderer.invoke('verify-password', password),

  // Software Update
  getAppVersion:    () => ipcRenderer.invoke('get-app-version'),
  checkForUpdate:   () => ipcRenderer.invoke('check-for-update'),
  downloadUpdate:   (url: string, fileName: string) => ipcRenderer.invoke('download-update', url, fileName),
  installUpdate:    (filePath: string) => ipcRenderer.invoke('install-update', filePath),
  onUpdateProgress: (cb: (data: { percent: number; downloaded: number; total: number }) => void) => {
    const sub = (_: any, data: any) => cb(data);
    ipcRenderer.on('update-download-progress', sub);
    return () => ipcRenderer.removeListener('update-download-progress', sub);
  },

  // Printing
  printInvoice: (htmlContent: string) => ipcRenderer.invoke('print-invoice', htmlContent),
  saveInvoicePdf: (html: string) => ipcRenderer.invoke('save-invoice-pdf', html),
  printViaBrowser: (htmlContent: string) => ipcRenderer.invoke('print-via-browser', htmlContent),
  getPrinters: () => ipcRenderer.invoke('get-printers'),

  // Assets
  getLogo: () => ipcRenderer.invoke('get-logo'),

  // Activation
  isActivated: () => ipcRenderer.invoke('is-activated'),
  activateApp: (data: { businessName: string, activationKey: string }) => ipcRenderer.invoke('activate-app', data),
  
  // New Licensing System V2
  getFingerprint: () => ipcRenderer.invoke('get-fingerprint'),
  activateAppV2: (licenseKey: string) => ipcRenderer.invoke('activate-app-v2', licenseKey),
  clearLocalLicense: () => ipcRenderer.invoke('clear-local-license'),
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
  getRegisterHistory: (opts?: any) => ipcRenderer.invoke('get-register-history', opts),

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
  disconnectGoogleDrive: () => ipcRenderer.invoke('disconnect-google-drive'),
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
  cancelPurchase: (id: number) => ipcRenderer.invoke('cancel-purchase', id),

  // Employees / Payroll
  getEmployees: () => ipcRenderer.invoke('get-employees'),
  addEmployee: (data: any) => ipcRenderer.invoke('add-employee', data),
  updateEmployee: (id: number, data: any) => ipcRenderer.invoke('update-employee', id, data),
  deleteEmployee: (id: number) => ipcRenderer.invoke('delete-employee', id),

  // Shell
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),

  // Accounts module
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  addAccount: (data: any) => ipcRenderer.invoke('add-account', data),
  updateAccount: (id: number, data: any) => ipcRenderer.invoke('update-account', id, data),
  deleteAccount: (id: number) => ipcRenderer.invoke('delete-account', id),
  getAccountTxns: (opts?: any) => ipcRenderer.invoke('get-account-txns', opts),
  addAccountTxn: (data: any) => ipcRenderer.invoke('add-account-txn', data),
  deleteAccountTxn: (id: number) => ipcRenderer.invoke('delete-account-txn', id),
  transferBetweenAccounts: (data: any) => ipcRenderer.invoke('transfer-between-accounts', data),

  // Cloud sync queue
  getPendingSyncItems: (limit?: number) => ipcRenderer.invoke('get-pending-sync-items', limit ?? 20),
  markSyncItemsDone: (ids: number[]) => ipcRenderer.invoke('mark-sync-items-done', ids),
  markSyncItemFailed: (id: number, error: string) => ipcRenderer.invoke('mark-sync-item-failed', id, error),
  enqueueSaleSync: (saleId: number) => ipcRenderer.invoke('enqueue-sale-sync', saleId),
  fullResync: () => ipcRenderer.invoke('full-resync'),
};

contextBridge.exposeInMainWorld('api', api);
