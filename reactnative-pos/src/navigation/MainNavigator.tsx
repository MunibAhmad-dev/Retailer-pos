/**
 * MainNavigator.tsx — Authenticated bottom-tab navigator
 *
 * Tab structure (5 tabs, each backed by its own native stack):
 *   Dashboard  → DashboardScreen  + NotificationsScreen
 *   Inventory  → InventoryScreen  + ProductDetailScreen
 *   CRM        → CRMTabScreen     + CustomersScreen, VendorsScreen, LoansScreen,
 *                                   CustomerDetailScreen, VendorDetailScreen
 *   Reports    → ReportsScreen
 *   Settings   → SettingsScreen   + PinSetupScreen, EditProfileScreen
 *
 * Tab bar:
 *   Floating pill, 70 px tall, 16 px from all sides, elevation 8,
 *   borderRadius 24, surface background. Active tab = filled Ionicons icon +
 *   primary colour. Inactive = outline icon + textMuted. Badge on Dashboard
 *   when unreadCount > 0.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Platform,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { DARK_COLORS, LIGHT_COLORS } from '@/theme/colors';
import { useNotificationStore } from '@/store/notificationStore';
import { useTranslation } from '@/i18n';
import { SCREENS } from './screens';

// ── Dashboard stack ────────────────────────────────────────────────────────────
import DashboardScreen from '@/screens/dashboard/DashboardScreen';
import NotificationsScreen from '@/screens/notifications/NotificationsScreen';

// ── Inventory stack ────────────────────────────────────────────────────────────
import InventoryScreen from '@/screens/inventory/InventoryScreen';
import ProductDetailScreen from '@/screens/inventory/ProductDetailScreen';

// ── CRM stack ──────────────────────────────────────────────────────────────────
import { CRMTabScreen } from '@/screens/crm/CRMTabScreen';
import CustomersScreen from '@/screens/crm/CustomersScreen';
import VendorsScreen from '@/screens/crm/VendorsScreen';
import LoansScreen from '@/screens/crm/LoansScreen';
import CustomerDetailScreen from '@/screens/crm/CustomerDetailScreen';
import VendorDetailScreen from '@/screens/crm/VendorDetailScreen';

// ── Reports stack ──────────────────────────────────────────────────────────────
import ReportsScreen from '@/screens/reports/ReportsScreen';

// ── Settings stack ─────────────────────────────────────────────────────────────
import SettingsScreen from '@/screens/settings/SettingsScreen';
import PinSetupScreen from '@/screens/settings/PinSetupScreen';
import EditProfileScreen from '@/screens/settings/EditProfileScreen';

// ---------------------------------------------------------------------------
// Stack param-list types (exported for use by screens)
// ---------------------------------------------------------------------------
export type DashboardStackParamList = {
  [SCREENS.DASHBOARD]: undefined;
  [SCREENS.NOTIFICATIONS]: undefined;
};

export type InventoryStackParamList = {
  [SCREENS.INVENTORY]: undefined;
  [SCREENS.PRODUCT_DETAIL]: {
    productId: string;
    product?: import('../api/instances').Product;
  };
};

export type CRMStackParamList = {
  [SCREENS.CRM_HOME]: undefined;
  [SCREENS.CUSTOMERS]: { instanceId?: string } | undefined;
  [SCREENS.CUSTOMER_DETAIL]: { customerId: string; instanceId: string };
  [SCREENS.VENDORS]: { instanceId?: string } | undefined;
  [SCREENS.VENDOR_DETAIL]: { vendorId: string; instanceId: string };
  [SCREENS.LOANS]: { instanceId?: string } | undefined;
};

export type ReportsStackParamList = {
  [SCREENS.REPORTS]: undefined;
};

export type SettingsStackParamList = {
  [SCREENS.SETTINGS]: undefined;
  [SCREENS.SECURITY_SETTINGS]: undefined;
  [SCREENS.PROFILE]: undefined;
};

export type MainTabParamList = {
  [SCREENS.TAB_DASHBOARD]: undefined;
  [SCREENS.TAB_INVENTORY]: undefined;
  [SCREENS.TAB_CRM]: undefined;
  [SCREENS.TAB_REPORTS]: undefined;
  [SCREENS.TAB_SETTINGS]: undefined;
};

// ---------------------------------------------------------------------------
// Shared stack screen-options factory
// ---------------------------------------------------------------------------
function makeStackOptions(C: typeof DARK_COLORS) {
  return {
    headerShown: false,
    contentStyle: { backgroundColor: C.bg },
    animation: 'slide_from_right' as const,
  };
}

// ---------------------------------------------------------------------------
// Individual tab stacks
// ---------------------------------------------------------------------------

const DashboardStack = createNativeStackNavigator<DashboardStackParamList>();
function DashboardStackScreen() {
  const isDark = useColorScheme() !== 'light';
  const C = isDark ? DARK_COLORS : LIGHT_COLORS;
  return (
    <DashboardStack.Navigator screenOptions={makeStackOptions(C)}>
      <DashboardStack.Screen name={SCREENS.DASHBOARD} component={DashboardScreen} />
      <DashboardStack.Screen name={SCREENS.NOTIFICATIONS} component={NotificationsScreen} />
    </DashboardStack.Navigator>
  );
}

const InventoryStack = createNativeStackNavigator<InventoryStackParamList>();
function InventoryStackScreen() {
  const isDark = useColorScheme() !== 'light';
  const C = isDark ? DARK_COLORS : LIGHT_COLORS;
  return (
    <InventoryStack.Navigator screenOptions={makeStackOptions(C)}>
      <InventoryStack.Screen name={SCREENS.INVENTORY} component={InventoryScreen} />
      <InventoryStack.Screen name={SCREENS.PRODUCT_DETAIL} component={ProductDetailScreen} />
    </InventoryStack.Navigator>
  );
}

const CRMStack = createNativeStackNavigator<CRMStackParamList>();
function CRMStackScreen() {
  const isDark = useColorScheme() !== 'light';
  const C = isDark ? DARK_COLORS : LIGHT_COLORS;
  return (
    <CRMStack.Navigator screenOptions={makeStackOptions(C)}>
      <CRMStack.Screen name={SCREENS.CRM_HOME} component={CRMTabScreen} />
      <CRMStack.Screen name={SCREENS.CUSTOMERS} component={CustomersScreen} />
      <CRMStack.Screen name={SCREENS.CUSTOMER_DETAIL} component={CustomerDetailScreen} />
      <CRMStack.Screen name={SCREENS.VENDORS} component={VendorsScreen} />
      <CRMStack.Screen name={SCREENS.VENDOR_DETAIL} component={VendorDetailScreen} />
      <CRMStack.Screen name={SCREENS.LOANS} component={LoansScreen} />
    </CRMStack.Navigator>
  );
}

const ReportsStack = createNativeStackNavigator<ReportsStackParamList>();
function ReportsStackScreen() {
  const isDark = useColorScheme() !== 'light';
  const C = isDark ? DARK_COLORS : LIGHT_COLORS;
  return (
    <ReportsStack.Navigator screenOptions={makeStackOptions(C)}>
      <ReportsStack.Screen name={SCREENS.REPORTS} component={ReportsScreen} />
    </ReportsStack.Navigator>
  );
}

const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
function SettingsStackScreen() {
  const isDark = useColorScheme() !== 'light';
  const C = isDark ? DARK_COLORS : LIGHT_COLORS;
  return (
    <SettingsStack.Navigator screenOptions={makeStackOptions(C)}>
      <SettingsStack.Screen name={SCREENS.SETTINGS} component={SettingsScreen} />
      <SettingsStack.Screen name={SCREENS.SECURITY_SETTINGS} component={PinSetupScreen} />
      <SettingsStack.Screen name={SCREENS.PROFILE} component={EditProfileScreen} />
    </SettingsStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Tab configuration
// ---------------------------------------------------------------------------
type TabConfig = {
  name: keyof MainTabParamList;
  label: string;
  icon: string;        // Ionicons outline name (inactive)
  iconActive: string;  // Ionicons filled name (active)
  component: React.ComponentType<any>;
};

function useTabConfig(): TabConfig[] {
  const { t } = useTranslation();
  return [
    {
      name: SCREENS.TAB_DASHBOARD,
      label: t('nav.dashboard'),
      icon: 'grid-outline',
      iconActive: 'grid',
      component: DashboardStackScreen,
    },
    {
      name: SCREENS.TAB_INVENTORY,
      label: t('nav.inventory'),
      icon: 'cube-outline',
      iconActive: 'cube',
      component: InventoryStackScreen,
    },
    {
      name: SCREENS.TAB_CRM,
      label: t('nav.crm'),
      icon: 'people-outline',
      iconActive: 'people',
      component: CRMStackScreen,
    },
    {
      name: SCREENS.TAB_REPORTS,
      label: t('nav.reports'),
      icon: 'bar-chart-outline',
      iconActive: 'bar-chart',
      component: ReportsStackScreen,
    },
    {
      name: SCREENS.TAB_SETTINGS,
      label: t('nav.settings'),
      icon: 'settings-outline',
      iconActive: 'settings',
      component: SettingsStackScreen,
    },
  ];
}

// ---------------------------------------------------------------------------
// Custom floating pill tab bar
// ---------------------------------------------------------------------------
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const isDark = useColorScheme() !== 'light';
  const C = isDark ? DARK_COLORS : LIGHT_COLORS;
  const insets = useSafeAreaInsets();
  const tabs = useTabConfig();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const s = makeTabBarStyles(C);

  return (
    <View
      style={[
        s.barWrapper,
        // Respect device home indicator; minimum 16 px from the very bottom
        { bottom: Math.max(insets.bottom, 16) },
      ]}
      pointerEvents="box-none">
      <View style={s.pill}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const tab = tabs[index];

          // Only show badge on the Dashboard tab
          const showBadge = index === 0 && unreadCount > 0;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? tab?.label}
              style={s.tabItem}>
              <View
                style={[
                  s.iconWrap,
                  isFocused && { backgroundColor: C.primary },
                ]}>
                <Icon
                  name={isFocused ? (tab?.iconActive ?? '') : (tab?.icon ?? '')}
                  size={22}
                  color={isFocused ? C.primaryFg : C.textMuted}
                />
                {showBadge && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>
                      {unreadCount > 99 ? '99+' : String(unreadCount)}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[s.label, { color: isFocused ? C.primary : C.textMuted }]}
                numberOfLines={1}>
                {tab?.label ?? ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles factory — recreated when colour scheme changes
// ---------------------------------------------------------------------------
function makeTabBarStyles(C: typeof DARK_COLORS) {
  return StyleSheet.create({
    barWrapper: {
      position: 'absolute',
      left: 16,
      right: 16,
      // 'bottom' is set inline to include safe-area inset
      height: 70,
      // Allow touches to fall through the transparent area outside the pill
      backgroundColor: 'transparent',
    },
    pill: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: C.surface,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: C.border,
      ...Platform.select({
        android: { elevation: 8 },
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
        },
      }),
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      top: 2,
      right: 2,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: C.danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: {
      color: '#ffffff',
      fontSize: 9,
      fontWeight: '700',
      lineHeight: 14,
    },
    label: {
      fontSize: 10,
      fontWeight: '500',
      letterSpacing: 0.2,
      fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
    },
  });
}

// ---------------------------------------------------------------------------
// MainNavigator
// ---------------------------------------------------------------------------
const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainNavigator() {
  const tabs = useTabConfig();

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{ tabBarLabel: tab.label }}
        />
      ))}
    </Tab.Navigator>
  );
}
