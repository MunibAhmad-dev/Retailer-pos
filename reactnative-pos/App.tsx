/**
 * App.tsx — OsaTech POS React Native
 *
 * Provider stack (outermost → innermost):
 *   GestureHandlerRootView   — required by react-native-gesture-handler
 *   SafeAreaProvider         — safe-area insets
 *   PaperProvider            — MD3 theming for react-native-paper
 *   QueryClientProvider      — TanStack Query (MMKV-persisted)
 *   I18nextProvider          — i18n translations (en / ur)
 *   NavigationContainer      — React Navigation, themed to match Paper
 *     StatusBar              — translucent, colour-scheme aware
 *     AppNavigator           — auth gate → splash / auth stack / main tabs
 *   Toast                    — outside NavigationContainer so it renders above modals
 */

import React, { useEffect } from 'react';
import { useColorScheme, StatusBar } from 'react-native';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Provider as PaperProvider,
  MD3DarkTheme,
  MD3LightTheme,
  type MD3Theme,
  adaptNavigationTheme,
} from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import Toast, { ToastConfig, BaseToast, ErrorToast } from 'react-native-toast-message';

import i18n from '@/i18n';
import AppNavigator from '@/navigation';
import { queryClient } from '@/api/queryClient';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';

// ---------------------------------------------------------------------------
// Design tokens (kept in sync with src/theme/colors.ts)
// ---------------------------------------------------------------------------
const darkTokens = {
  bg: '#0a0a0f',
  surface: '#111118',
  elevated: '#1a1a24',
  border: '#2a2a3a',
  text: '#ffffff',
  textSub: '#8b8fa8',
  textMuted: '#4a4a5e',
  primary: '#6366f1',
  primaryFg: '#ffffff',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  accent: '#8b5cf6',
};

const lightTokens = {
  bg: '#f8f9fc',
  surface: '#ffffff',
  elevated: '#f0f2f8',
  border: '#e5e7f0',
  text: '#0a0a0f',
  textSub: '#64687a',
  textMuted: '#9ca3af',
  primary: '#4f46e5',
  primaryFg: '#ffffff',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  accent: '#7c3aed',
};

// ---------------------------------------------------------------------------
// Paper (MD3) theme factories
// ---------------------------------------------------------------------------
function buildPaperDark(): MD3Theme {
  const t = darkTokens;
  return {
    ...MD3DarkTheme,
    colors: {
      ...MD3DarkTheme.colors,
      primary: t.primary,
      onPrimary: t.primaryFg,
      primaryContainer: t.elevated,
      onPrimaryContainer: t.text,
      secondary: t.accent,
      onSecondary: t.primaryFg,
      secondaryContainer: t.elevated,
      onSecondaryContainer: t.text,
      tertiary: t.success,
      onTertiary: t.primaryFg,
      error: t.danger,
      onError: t.primaryFg,
      background: t.bg,
      onBackground: t.text,
      surface: t.surface,
      onSurface: t.text,
      surfaceVariant: t.elevated,
      onSurfaceVariant: t.textSub,
      outline: t.border,
      outlineVariant: t.border,
      inverseSurface: t.text,
      inverseOnSurface: t.bg,
      inversePrimary: t.primary,
      shadow: '#000000',
      scrim: '#000000',
      backdrop: 'rgba(0,0,0,0.6)',
    },
  };
}

function buildPaperLight(): MD3Theme {
  const t = lightTokens;
  return {
    ...MD3LightTheme,
    colors: {
      ...MD3LightTheme.colors,
      primary: t.primary,
      onPrimary: t.primaryFg,
      primaryContainer: t.elevated,
      onPrimaryContainer: t.text,
      secondary: t.accent,
      onSecondary: t.primaryFg,
      secondaryContainer: t.elevated,
      onSecondaryContainer: t.text,
      tertiary: t.success,
      onTertiary: t.primaryFg,
      error: t.danger,
      onError: t.primaryFg,
      background: t.bg,
      onBackground: t.text,
      surface: t.surface,
      onSurface: t.text,
      surfaceVariant: t.elevated,
      onSurfaceVariant: t.textSub,
      outline: t.border,
      outlineVariant: t.border,
      inverseSurface: t.text,
      inverseOnSurface: t.bg,
      inversePrimary: t.primary,
      shadow: '#000000',
      scrim: '#000000',
      backdrop: 'rgba(0,0,0,0.4)',
    },
  };
}

const paperDarkTheme = buildPaperDark();
const paperLightTheme = buildPaperLight();

// ---------------------------------------------------------------------------
// React Navigation themes (derived from Paper so nav chrome matches)
// ---------------------------------------------------------------------------
const { DarkTheme: navDarkBase, LightTheme: navLightBase } =
  adaptNavigationTheme({
    reactNavigationDark: {
      dark: true,
      colors: {
        primary: darkTokens.primary,
        background: darkTokens.bg,
        card: darkTokens.surface,
        text: darkTokens.text,
        border: 'transparent',
        notification: darkTokens.danger,
      },
    },
    reactNavigationLight: {
      dark: false,
      colors: {
        primary: lightTokens.primary,
        background: lightTokens.bg,
        card: lightTokens.surface,
        text: lightTokens.text,
        border: 'transparent',
        notification: lightTokens.danger,
      },
    },
  });

// ---------------------------------------------------------------------------
// Toast configuration — dark-style toasts that work on both schemes
// ---------------------------------------------------------------------------
const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: darkTokens.success,
        backgroundColor: darkTokens.surface,
        borderRadius: 12,
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ color: darkTokens.text, fontSize: 14, fontWeight: '600' }}
      text2Style={{ color: darkTokens.textSub, fontSize: 12 }}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={{
        borderLeftColor: darkTokens.danger,
        backgroundColor: darkTokens.surface,
        borderRadius: 12,
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ color: darkTokens.text, fontSize: 14, fontWeight: '600' }}
      text2Style={{ color: darkTokens.textSub, fontSize: 12 }}
    />
  ),
  info: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: darkTokens.primary,
        backgroundColor: darkTokens.surface,
        borderRadius: 12,
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ color: darkTokens.text, fontSize: 14, fontWeight: '600' }}
      text2Style={{ color: darkTokens.textSub, fontSize: 12 }}
    />
  ),
};

// ---------------------------------------------------------------------------
// Deep-link configuration
// ---------------------------------------------------------------------------
const linking = {
  prefixes: ['osatechpos://', 'https://osatechcloud.cloud'],
  config: {
    screens: {
      TabDashboard: {
        screens: {
          Dashboard: 'dashboard',
          Notifications: 'notifications',
        },
      },
      TabInventory: {
        screens: {
          Inventory: 'inventory',
          ProductDetail: 'inventory/:productId',
        },
      },
      TabCRM: {
        screens: {
          CRMHome: 'crm',
          Customers: 'crm/customers',
          Vendors: 'crm/vendors',
          Loans: 'crm/loans',
        },
      },
      TabReports: {
        screens: {
          Reports: 'reports',
        },
      },
      TabSettings: {
        screens: {
          Settings: 'settings',
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------
export default function App(): React.JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const paperTheme = isDark ? paperDarkTheme : paperLightTheme;
  const navTheme = isDark ? navDarkBase : navLightBase;

  // Kick off auth + settings hydration on first mount.
  // authStore.loadFromStorage() validates the persisted token with the server.
  // settingsStore is synchronously hydrated from MMKV on module load,
  // so we only need to ensure authStore is ready before the navigator renders.
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  // Accessing settingsStore here ensures it is initialised (it's synchronous).
  useSettingsStore((s) => s.theme);

  useEffect(() => {
    loadFromStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <QueryClientProvider client={queryClient}>
            <I18nextProvider i18n={i18n}>
              <NavigationContainer theme={navTheme} linking={linking}>
                <StatusBar
                  translucent
                  backgroundColor="transparent"
                  barStyle={isDark ? 'light-content' : 'dark-content'}
                />
                <AppNavigator />
              </NavigationContainer>
            </I18nextProvider>
          </QueryClientProvider>
        </PaperProvider>
      </SafeAreaProvider>
      {/* Toast must be outside NavigationContainer so it floats above modals */}
      <Toast config={toastConfig} />
    </GestureHandlerRootView>
  );
}
