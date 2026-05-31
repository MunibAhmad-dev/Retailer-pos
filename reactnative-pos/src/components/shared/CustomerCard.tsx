import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Linking,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Customer } from '../../types/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomerCardProps {
  customer: Customer;
  onPress?: () => void;
  onCall?: () => void;
  onWhatsApp?: () => void;
  onMessage?: () => void;
  style?: ViewStyle;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Swipe action button ───────────────────────────────────────────────────────

interface ActionBtnProps {
  label: string;
  bg: string;
  onPress: () => void;
}

function ActionBtn({ label, bg, onPress }: ActionBtnProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.actionBtn, { backgroundColor: bg }]}
    >
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomerCard({
  customer,
  onPress,
  onCall,
  onWhatsApp,
  onMessage,
  style,
}: CustomerCardProps) {
  const { colors, typography, spacing, radius } = useTheme();

  // Swipe-to-reveal action buttons
  const translateX = useRef(new Animated.Value(0)).current;
  const ACTION_WIDTH = 160;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dy) < Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) {
          translateX.setValue(Math.max(g.dx, -ACTION_WIDTH));
        } else if (g.dx > 0) {
          translateX.setValue(Math.min(g.dx + (translateX as any)._value, 0));
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -ACTION_WIDTH / 2) {
          Animated.spring(translateX, {
            toValue: -ACTION_WIDTH,
            useNativeDriver: true,
          }).start();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const hasDebt = customer.balance > 0;

  const handleWhatsApp = () => {
    if (onWhatsApp) {
      onWhatsApp();
      return;
    }
    if (customer.phone) {
      const phone = customer.phone.replace(/\D/g, '');
      Linking.openURL(`whatsapp://send?phone=+92${phone.slice(-10)}`);
    }
  };

  const handleCall = () => {
    if (onCall) {
      onCall();
      return;
    }
    if (customer.phone) {
      Linking.openURL(`tel:${customer.phone}`);
    }
  };

  return (
    <View style={[{ overflow: 'hidden', borderRadius: radius.lg }, style]}>
      {/* Swipe action background */}
      <View style={styles.actionsContainer}>
        {customer.phone && (
          <ActionBtn label="Call" bg={colors.success} onPress={handleCall} />
        )}
        {customer.phone && (
          <ActionBtn label="WA" bg="#25D366" onPress={handleWhatsApp} />
        )}
        {onMessage && (
          <ActionBtn label="Msg" bg={colors.primary} onPress={onMessage} />
        )}
      </View>

      {/* Card content */}
      <Animated.View
        style={[
          {
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            padding: spacing[4],
            borderWidth: 1,
            borderColor: colors.border,
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          style={styles.row}
        >
          {/* Avatar */}
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.primary + '22' },
            ]}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.bold,
              }}
            >
              {initials(customer.name)}
            </Text>
          </View>

          {/* Info */}
          <View style={{ flex: 1, marginLeft: spacing[3] }}>
            <Text
              style={{
                color: colors.text,
                fontSize: typography.sizes.base,
                fontWeight: typography.weights.semibold,
              }}
              numberOfLines={1}
            >
              {customer.name}
            </Text>
            {customer.phone ? (
              <Text
                style={{
                  color: colors.textSub,
                  fontSize: typography.sizes.sm,
                  marginTop: 2,
                }}
              >
                {customer.phone}
              </Text>
            ) : null}
            <Text
              style={{
                color: colors.textMuted,
                fontSize: typography.sizes.xs,
                marginTop: 2,
              }}
            >
              Last: {formatDate(customer.updatedAt)}
            </Text>
          </View>

          {/* Balance */}
          <View style={{ alignItems: 'flex-end' }}>
            {hasDebt ? (
              <>
                <Text
                  style={{
                    color: colors.danger,
                    fontSize: typography.sizes.sm,
                    fontWeight: typography.weights.bold,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  Rs {customer.balance.toLocaleString()}
                </Text>
                <Text
                  style={{
                    color: colors.danger + 'aa',
                    fontSize: typography.sizes.xs,
                    marginTop: 2,
                  }}
                >
                  Owed
                </Text>
              </>
            ) : (
              <Text
                style={{
                  color: colors.success,
                  fontSize: typography.sizes.xs,
                  fontWeight: typography.weights.medium,
                }}
              >
                Settled
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    width: 56,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default CustomerCard;
