import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertType =
  | 'lowStock'
  | 'expiring'
  | 'expired'
  | 'overdueCustomer'
  | 'overdueVendor'
  | 'licenseExpiry';

interface AlertItemProps {
  type: AlertType;
  title: string;
  message: string;
  count?: number;
  onPress?: () => void;
  style?: ViewStyle;
}

// ─── Icon + color map ─────────────────────────────────────────────────────────

const ALERT_CONFIG: Record<
  AlertType,
  { icon: string; colorKey: 'danger' | 'warning' | 'success' | 'primary' | 'accent' }
> = {
  lowStock:        { icon: '📦', colorKey: 'warning' },
  expiring:        { icon: '⏳', colorKey: 'warning' },
  expired:         { icon: '🚫', colorKey: 'danger' },
  overdueCustomer: { icon: '👤', colorKey: 'danger' },
  overdueVendor:   { icon: '🏢', colorKey: 'warning' },
  licenseExpiry:   { icon: '🔑', colorKey: 'accent' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AlertItem({
  type,
  title,
  message,
  count,
  onPress,
  style,
}: AlertItemProps) {
  const { colors, typography, spacing, radius } = useTheme();

  const config = ALERT_CONFIG[type];
  const accentColor = colors[config.colorKey];

  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress
    ? { onPress, activeOpacity: 0.75 }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing[4],
          borderWidth: 1,
          borderColor: colors.border,
          borderLeftWidth: 3,
          borderLeftColor: accentColor,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[3],
        },
        style,
      ]}
    >
      {/* Icon */}
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: accentColor + '1a' },
        ]}
      >
        <Text style={{ fontSize: 18 }}>{config.icon}</Text>
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.semibold,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={{
            color: colors.textSub,
            fontSize: typography.sizes.xs,
            marginTop: 2,
          }}
          numberOfLines={2}
        >
          {message}
        </Text>
      </View>

      {/* Count badge */}
      {count !== undefined && count > 0 ? (
        <View
          style={[
            styles.countBadge,
            { backgroundColor: accentColor },
          ]}
        >
          <Text
            style={{
              color: '#ffffff',
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.bold,
            }}
          >
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}

      {/* Chevron */}
      {onPress ? (
        <Text style={{ color: colors.textMuted, fontSize: typography.sizes.lg }}>
          ›
        </Text>
      ) : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});

export default AlertItem;
