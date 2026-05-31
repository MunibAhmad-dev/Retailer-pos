/**
 * ForgotPasswordScreen.tsx
 *
 * Placeholder — Admin password resets are handled out-of-band
 * (contact OsaTech support or reset via the VPS directly).
 *
 * This screen simply displays the support message and a back button.
 * The header back-arrow is already rendered by AuthStack.
 */

import React from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {DARK_COLORS, LIGHT_COLORS} from '@/theme/colors';
import {spacing, radius} from '@/theme/spacing';
import {FontSizes, FontWeights} from '@/theme/typography';
import type {AuthStackParamList} from '@/navigation/AuthStack';
import {SCREENS} from '@/navigation/screens';

type Props = NativeStackScreenProps<
  AuthStackParamList,
  typeof SCREENS.FORGOT_PASSWORD
>;

export default function ForgotPasswordScreen({navigation}: Props) {
  const isDark = useColorScheme() !== 'light';
  const C = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <View style={[styles.root, {backgroundColor: C.bg}]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={C.bg}
      />

      <Animated.View
        entering={FadeInDown.duration(500).delay(80)}
        style={[
          styles.card,
          {
            backgroundColor: isDark
              ? 'rgba(17, 17, 24, 0.90)'
              : 'rgba(255, 255, 255, 0.95)',
            borderColor: C.border,
          },
        ]}>

        {/* Icon */}
        <View style={[styles.iconBadge, {backgroundColor: C.elevated}]}>
          <Icon name="lock-reset" size={32} color={C.primary} />
        </View>

        <Text style={[styles.title, {color: C.text}]}>
          Password Reset
        </Text>
        <Text style={[styles.body, {color: C.textSub}]}>
          Admin account password resets are handled by your OsaTech support
          team or directly on the server via the CLI seed tool.{'\n\n'}
          Contact <Text style={{color: C.primary}}>support@osatechcloud.cloud</Text>{' '}
          or reset using the VPS admin panel.
        </Text>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[
            styles.backBtn,
            {backgroundColor: C.elevated, borderColor: C.border},
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back to login">
          <Icon name="arrow-left" size={18} color={C.textSub} />
          <Text style={[styles.backBtnText, {color: C.textSub}]}>
            {' '}Back to Login
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.s6,
  },

  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.s6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
  },

  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.s5,
  },

  title: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    letterSpacing: -0.3,
    marginBottom: spacing.s3,
    textAlign: 'center',
  },

  body: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.regular,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.s6,
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.s5,
    alignSelf: 'stretch',
  },
  backBtnText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
});
