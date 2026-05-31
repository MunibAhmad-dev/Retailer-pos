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

interface LoanRowProps {
  name: string;
  balance: number;
  phone?: string;
  daysOverdue?: number;
  type: 'customer' | 'vendor';
  onPress?: () => void;
  onMessage?: () => void;
  style?: ViewStyle;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LoanRow({
  name,
  balance,
  phone,
  daysOverdue,
  type,
  onPress,
  onMessage,
  style,
}: LoanRowProps) {
  const { colors, typography, spacing, radius } = useTheme();

  const isCustomer = type === 'customer';
  const avatarColor = isCustomer ? colors.primary : colors.accent;

  // Balance color: red if overdue, orange if vendor payable, normal otherwise
  const balanceColor =
    daysOverdue && daysOverdue > 0
      ? colors.danger
      : isCustomer
      ? colors.danger
      : colors.warning;

  // Overdue indicator
  const overdueLabel =
    daysOverdue && daysOverdue > 0
      ? daysOverdue > 30
        ? `${daysOverdue}d overdue`
        : `${daysOverdue}d due`
      : null;

  const ini = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing[3],
          borderWidth: 1,
          borderColor: colors.border,
          gap: spacing[3],
        },
        style,
      ]}
    >
      {/* Avatar */}
      <View
        style={[
          styles.avatar,
          { backgroundColor: avatarColor + '22' },
        ]}
      >
        <Text
          style={{
            color: avatarColor,
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.bold,
          }}
        >
          {ini}
        </Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.semibold,
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
        <View style={[styles.row, { marginTop: 2, gap: 6 }]}>
          {phone ? (
            <Text
              style={{
                color: colors.textMuted,
                fontSize: typography.sizes.xs,
              }}
            >
              {phone}
            </Text>
          ) : null}
          {overdueLabel ? (
            <View
              style={[
                styles.overdueTag,
                { backgroundColor: colors.danger + '1a' },
              ]}
            >
              <Text
                style={{
                  color: colors.danger,
                  fontSize: typography.sizes.xs,
                  fontWeight: typography.weights.semibold,
                }}
              >
                {overdueLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Balance */}
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={{
            color: balanceColor,
            fontSize: typography.sizes.base,
            fontWeight: typography.weights.bold,
            fontVariant: ['tabular-nums'],
          }}
        >
          Rs {balance.toLocaleString()}
        </Text>
        <Text
          style={{
            color: balanceColor + 'aa',
            fontSize: typography.sizes.xs,
            marginTop: 1,
          }}
        >
          {isCustomer ? 'Receivable' : 'Payable'}
        </Text>
      </View>

      {/* Message shortcut */}
      {onMessage ? (
        <TouchableOpacity
          onPress={onMessage}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            styles.msgBtn,
            { backgroundColor: '#25D366' + '22' },
          ]}
        >
          <Text style={{ fontSize: 14 }}>💬</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overdueTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  msgBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LoanRow;
