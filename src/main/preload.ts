// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

console.log('Preload script is loading...');

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
  deleteAllData: () => ipcRenderer.invoke('delete-all-data'),
  seedDatabase: () => ipcRenderer.invoke('seed-database'),

  // POS Expansion Features
  getCustomers: () => ipcRenderer.invoke('get-customers'),
  addCustomer: (customer: any) => ipcRenderer.invoke('add-customer', customer),
  updateCustomer: (id: number, customer: any) => ipcRenderer.invoke('update-customer', id, customer),
  deleteCustomer: (id: number) => ipcRenderer.invoke('delete-customer', id),

  getVendors: () => ipcRenderer.invoke('get-vendors'),
  addVendor: (vendor: any) => ipcRenderer.invoke('add-vendor', vendor),
  createPurchase: (data: any) => ipcRenderer.invoke('create-purchase', data),
  getInventoryBatches: (productId?: number) => ipcRenderer.invoke('get-inventory-batches', productId),
  getVendorPurchases: (vendorId?: number) => ipcRenderer.invoke('get-vendor-purchases', vendorId),
  getProductAnalytics: () => ipcRenderer.invoke('get-product-analytics'),
  getCustomerDetails: (customerId: number) => ipcRenderer.invoke('get-customer-details', customerId),
  addCustomerPayment: (data: any) => ipcRenderer.invoke('add-customer-payment', data),
  getProfitLossReport: (data?: any) => ipcRenderer.invoke('get-profit-loss-report', data),

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
  // In preload.ts — add this line next to printInvoice
  saveInvoicePdf: (html: string) => ipcRenderer.invoke('save-invoice-pdf', html),

  // Assets
  getLogo: () => ipcRenderer.invoke('get-logo'),

  // Activation
  isActivated: () => ipcRenderer.invoke('is-activated'),
  activateApp: (data: { businessName: string, activationKey: string }) => ipcRenderer.invoke('activate-app', data),

  // Auto-Export
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  performAutoExport: () => ipcRenderer.invoke('perform-auto-export'),
  onAutoExportComplete: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('auto-export-complete', subscription);
    return () => ipcRenderer.removeListener('auto-export-complete', subscription);
  }
};

// Expose the API
contextBridge.exposeInMainWorld('api', api);

console.log('Preload script loaded, API exposed with methods:', Object.keys(api));