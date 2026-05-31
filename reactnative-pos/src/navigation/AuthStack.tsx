/**
 * AuthStack.tsx — Unauthenticated navigation stack
 *
 * Screens:
 *   Login        → LoginScreen       (no header, full-screen)
 *   ServerConfig → ServerConfigScreen (modal slide-up, "Server Settings" header)
 *
 * The ForgotPassword screen has been intentionally kept in the stack even
 * though the spec does not list it as a required screen, so existing deep-links
 * and navigation calls from LoginScreen continue to work without breakage.
 */

import React from 'react';
import { TouchableOpacity, useColorScheme } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';

import { DARK_COLORS, LIGHT_COLORS } from '@/theme/colors';
import { SCREENS } from './screens';

// ── Auth screens ──────────────────────────────────────────────────────────────
import LoginScreen from '@/screens/auth/LoginScreen';
import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';
import ServerConfigScreen from '@/screens/auth/ServerConfigScreen';

// ── Stack param list ──────────────────────────────────────────────────────────
export type AuthStackParamList = {
  [SCREENS.LOGIN]: undefined;
  [SCREENS.FORGOT_PASSWORD]: undefined;
  [SCREENS.SERVER_CONFIG]: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

// ── Custom header back button ─────────────────────────────────────────────────
function BackButton({ onPress, color }: { onPress: () => void; color: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel="Go back">
      <Icon name="arrow-back" size={22} color={color} />
    </TouchableOpacity>
  );
}

// ── AuthStack ─────────────────────────────────────────────────────────────────
export default function AuthStack() {
  const isDark = useColorScheme() !== 'light';
  const C = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: C.bg },
        animation: 'slide_from_right',
      }}>
      {/* Login — no header, entry point for unauthenticated users */}
      <Stack.Screen
        name={SCREENS.LOGIN}
        component={LoginScreen}
      />

      {/* Forgot Password — minimal header with Ionicons back arrow */}
      <Stack.Screen
        name={SCREENS.FORGOT_PASSWORD}
        component={ForgotPasswordScreen}
        options={({ navigation }) => ({
          headerShown: true,
          title: '',
          headerStyle: { backgroundColor: C.bg },
          headerShadowVisible: false,
          headerLeft: () => (
            <BackButton
              color={C.text}
              onPress={() => navigation.goBack()}
            />
          ),
        })}
      />

      {/* Server Config — modal slide-up with a visible header title */}
      <Stack.Screen
        name={SCREENS.SERVER_CONFIG}
        component={ServerConfigScreen}
        options={({ navigation }) => ({
          headerShown: true,
          title: 'Server Settings',
          headerStyle: { backgroundColor: C.surface },
          headerTitleStyle: { color: C.text, fontWeight: '600' },
          headerShadowVisible: false,
          headerLeft: () => (
            <BackButton
              color={C.text}
              onPress={() => navigation.goBack()}
            />
          ),
          animation: 'slide_from_bottom',
          presentation: 'modal',
          contentStyle: { backgroundColor: C.bg },
        })}
      />
    </Stack.Navigator>
  );
}
