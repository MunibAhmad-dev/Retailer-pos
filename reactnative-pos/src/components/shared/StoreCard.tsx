import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { Instance, InstanceStatus, InstancePlan } from '../../types/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoreCardProps {
  instance: Instance;
  style?: ViewStyle;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function statusColor(
  status: InstanceStatus,
  colors: ReturnType<typeof useTheme>['colors'],
): string {
  switch (status) {
    case 'active': return colors.success;
    case 'suspended': return colors.danger;
    case 'expired': return colors.warning;
    case 'pending': return colors.textSub;
    default: return colors.textMuted;
  }
}

function planLabel(plan: InstancePlan): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function planAccent(
  plan: InstancePlan,
  colors: ReturnType<typeof useTheme>['colors'],
): string {
  switch (plan) {
    case 'enterprise': return colors.accent;
    case 'premium': return colors.primary;
    case 'standard': return colors.success;
    case 'basic': return colors.textSub;
    default: return colors.textMuted;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StoreCard({ instance, style }: StoreCardProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const navigation = useNavigation<any>();

  const sColor = statusColor(instance.status, colors);
  const pColor = planAccent(instance.plan, colors);

  return (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate('InstanceDetail', { instanceId: instance.instanceId })
      }
      activeOpacity={0.75}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing[4],
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {/* Top row: name + status badge */}
      <View style={styles.row}>
        <Text
          style={{
            flex: 1,
            color: colors.text,
            fontSize: typography.sizes.base,
            fontWeight: typography.weights.semibold,
          }}
          numberOfLines={1}
        >
          {instance.businessName}
        </Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: sColor + '22', borderColor: sColor + '44' },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: sColor }]} />
          <Text
            style={{
              color: sColor,
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.semibold,
              textTransform: 'capitalize',
            }}
          >
            {instance.status}
          </Text>
        </View>
      </View>

      {/* Owner */}
      <Text
        style={{
          color: colors.textSub,
          fontSize: typography.sizes.sm,
          marginTop: 2,
        }}
        numberOfLines={1}
      >
        {instance.ownerName}
      </Text>

      {/* Divider */}
      <View
        style={{
          height: 1,
          backgroundColor: colors.border,
          marginVertical: spacing[3],
        }}
      />

      {/* Bottom row: last seen + plan + total sales */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textMuted, fontSize: typography.sizes.xs }}>
            Last seen
          </Text>
          <Text
            style={{
              color: colors.textSub,
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.medium,
              marginTop: 2,
            }}
          >
            {timeAgo(instance.lastSync)}
          </Text>
        </View>

        {/* Plan badge */}
        <View
          style={[
            styles.badge,
            {
              backgroundColor: pColor + '22',
              borderColor: pColor + '44',
              marginHorizontal: spacing[2],
            },
          ]}
        >
          <Text
            style={{
              color: pColor,
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.bold,
            }}
          >
            {planLabel(instance.plan)}
          </Text>
        </View>

        {/* Chevron */}
        <Text style={{ color: colors.textMuted, fontSize: typography.sizes.lg }}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default StoreCard;
