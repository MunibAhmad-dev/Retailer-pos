/**
 * Centralised screen name constants.
 *
 * Import SCREENS anywhere you push/navigate so that typos become
 * compile-time errors rather than silent runtime bugs.
 */
export const SCREENS = {
  // ── Auth stack ────────────────────────────────────────────────────────────
  LOGIN: 'Login',
  FORGOT_PASSWORD: 'ForgotPassword',
  SERVER_CONFIG: 'ServerConfig',

  // ── Bottom tab roots (each is the name used in the Tab.Screen)  ──────────
  TAB_DASHBOARD: 'TabDashboard',
  TAB_INVENTORY: 'TabInventory',
  TAB_CRM: 'TabCRM',
  TAB_REPORTS: 'TabReports',
  TAB_SETTINGS: 'TabSettings',

  // ── Dashboard stack ───────────────────────────────────────────────────────
  DASHBOARD: 'Dashboard',
  NOTIFICATIONS: 'Notifications',

  // ── Inventory stack ───────────────────────────────────────────────────────
  INVENTORY: 'Inventory',
  PRODUCT_DETAIL: 'ProductDetail',
  ADD_PRODUCT: 'AddProduct',
  EDIT_PRODUCT: 'EditProduct',
  CATEGORIES: 'Categories',

  // ── CRM stack ─────────────────────────────────────────────────────────────
  CRM_HOME: 'CRMHome',
  CUSTOMERS: 'Customers',
  CUSTOMER_DETAIL: 'CustomerDetail',
  ADD_CUSTOMER: 'AddCustomer',
  VENDORS: 'Vendors',
  VENDOR_DETAIL: 'VendorDetail',
  ADD_VENDOR: 'AddVendor',
  LOANS: 'Loans',
  LOAN_DETAIL: 'LoanDetail',

  // ── Reports stack ─────────────────────────────────────────────────────────
  REPORTS: 'Reports',
  SALES_REPORT: 'SalesReport',
  PROFIT_REPORT: 'ProfitReport',
  EXPENSE_REPORT: 'ExpenseReport',
  PRODUCT_REPORT: 'ProductReport',

  // ── Settings stack ────────────────────────────────────────────────────────
  SETTINGS: 'Settings',
  PROFILE: 'Profile',
  BUSINESS_SETTINGS: 'BusinessSettings',
  SECURITY_SETTINGS: 'SecuritySettings',
  NOTIFICATION_SETTINGS: 'NotificationSettings',
  ABOUT: 'About',
} as const;

/** Union type of every screen name string */
export type ScreenName = (typeof SCREENS)[keyof typeof SCREENS];
