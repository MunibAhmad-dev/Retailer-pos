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
import { Vendor } from '../../types/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VendorCardProps {
  vendor: Vendor;
  onPress?: () => void;
  onCall?: () => void;
  onWhatsApp?: () => void;
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

function ActionBtn({
  label,
  bg,
  onPress,
}: {
  label: string;
  bg: string;
  onPress: () => void;
}) {
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

export function VendorCard({
  vendor,
  onPress,
  onCall,
  onWhatsApp,
  style,
}: VendorCardProps) {
  const { colors, typography, spacing, radius } = useTheme();

  const translateX = useRef(new Animated.Value(0)).current;
  const ACTION_WIDTH = 112;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dy) < Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) {
          translateX.setValue(Math.max(g.dx, -ACTION_WIDTH));
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

  const hasBalance = vendor.balance > 0;

  const handleWhatsApp = () => {
    if (onWhatsApp) { onWhatsApp(); return; }
    if (vendor.phone) {
      const phone = vendor.phone.replace(/\D/g, '');
      Linking.openURL(`whatsapp://send?phone=+92${phone.slice(-10)}`);
    }
  };

  const handleCall = () => {
    if (onCall) { onCall(); return; }
    if (vendor.phone) Linking.openURL(`tel:${vendor.phone}`);
  };

  return (
    <View style={[{ overflow: 'hidden', borderRadius: radius.lg }, style]}>
      {/* Hidden action buttons revealed on swipe */}
      <View style={styles.actionsContainer}>
        {vendor.phone && (
          <ActionBtn label="Call" bg={colors.success} onPress={handleCall} />
        )}
        {vendor.phone && (
          <ActionBtn label="WA" bg="#25D366" onPress={handleWhatsApp} />
        )}
      </View>

      <Animated.View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing[4],
          borderWidth: 1,
          borderColor: colors.border,
          transform: [{ translateX }],
        }}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          style={styles.row}
        >
          {/* Avatar — accent color for vendors */}
          <View
            style={[styles.avatar, { backgroundColor: colors.accent + '22' }]}
          >
            <Text
              style={{
                color: colors.accent,
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.bold,
              }}
            >
              {initials(vendor.name)}
            </Text>
          </View>

          <View style={{ flex: 1, marginLeft: spacing[3] }}>
            <Text
              style={{
                color: colors.text,
                fontSize: typography.sizes.base,
                fontWeight: typography.weights.semibold,
              }}
              numberOfLines={1}
            >
              {vendor.name}
            </Text>
            {vendor.phone ? (
              <Text
                style={{
                  color: colors.textSub,
                  fontSize: typography.sizes.sm,
                  marginTop: 2,
                }}
              >
                {vendor.phone}
              </Text>
            ) : null}
            <Text
              style={{
                color: colors.textMuted,
                fontSize: typography.sizes.xs,
                marginTop: 2,
              }}
            >
              Since {formatDate(vendor.createdAt)}
            </Text>
          </View>

          {/* Balance owed to vendor */}
          <View style={{ alignItems: 'flex-end' }}>
            {hasBalance ? (
              <>
                <Text
                  style={{
                    color: colors.warning,
                    fontSize: typography.sizes.sm,
                    fontWeight: typography.weights.bold,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  Rs {vendor.balance.toLocaleString()}
                </Text>
                <Text
                  style={{
                    color: colors.warning + 'aa',
                    fontSize: typography.sizes.xs,
                    marginTop: 2,
                  }}
                >
                  Payable
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
                Clear
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

export default VendorCard;
