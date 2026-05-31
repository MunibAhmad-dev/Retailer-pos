import { NavigatorScreenParams } from '@react-navigation/native';

// ─── Auth Stack ───────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

// ─── CRM Stack ────────────────────────────────────────────────────────────────

export type CRMStackParamList = {
  CustomerList: undefined;
  CustomerDetail: { customerId: number };
  VendorList: undefined;
  VendorDetail: { vendorId: number };
  Loans: { tab?: 'customer' | 'vendor' };
};

// ─── Inventory Stack ──────────────────────────────────────────────────────────

export type InventoryStackParamList = {
  ProductList: undefined;
  ProductDetail: { productId: number };
};

// ─── Settings Stack ───────────────────────────────────────────────────────────

export type SettingsStackParamList = {
  Settings: undefined;
  Profile: undefined;
  Security: undefined;
  Language: undefined;
  Theme: undefined;
  Notifications: undefined;
};

// ─── Main Bottom Tabs ─────────────────────────────────────────────────────────

export type MainTabParamList = {
  Dashboard: undefined;
  Inventory: NavigatorScreenParams<InventoryStackParamList>;
  CRM: NavigatorScreenParams<CRMStackParamList>;
  Reports: undefined;
  Settings: NavigatorScreenParams<SettingsStackParamList>;
};

// ─── Root Navigator ───────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};
