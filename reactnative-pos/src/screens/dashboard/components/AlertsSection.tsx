/**
 * AlertsSection — Collapsible "Smart Alerts" panel for the Dashboard.
 *
 * Shows alert chips for:
 *   - Licenses expiring in 7 days (critical, red)
 *   - Licenses expiring soon (warning, amber)
 *   - Expired licenses (slate)
 *   - Stores pending approval (blue)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../../hooks/useTheme';
import { DashboardStats } from '../../../api/dashboard';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertChipType = 'expiringCritical' | 'expiringWarning' | 'expired' | 'pending';

interface AlertsProps {
  stats: DashboardStats | undefined;
  onNavigate: (screen: string) => void;
}

interface ChipConfig {
  type: AlertChipType;
  emoji: string;
  label: (count: number) => string;
  color: (colors: ReturnType<typeof useTheme>['colors']) => string;
  screen: string;
}

// ─── Chip definitions ─────────────────────────────────────────────────────────

const CHIP_CONFIGS: ChipConfig[] = [
  {
    type: 'expiringCritical',
    emoji: '🔴',
    label: (n) => `${n} license${n === 1 ? '' : 's'} expiring in 7 days`,
    color: (c) => c.danger,
    screen: 'Licenses',
  },
  {
    type: 'expiringWarning',
    emoji: '🟡',
    label: (n) => `${n} license${n === 1 ? '' : 's'} expiring soon`,
    color: (c) => c.warning,
    screen: 'Licenses',
  },
  {
    type: 'expired',
    emoji: '⚫',
    label: (n) => `${n} license${n === 1 ? '' : 's'} expired`,
    color: (c) => c.textSub,
    screen: 'Licenses',
  },
  {
    type: 'pending',
    emoji: '🔵',
    label: (n) => `${n} store${n === 1 ? '' : 's'} pending approval`,
    color: (c) => c.primary,
    screen: 'Instances',
  },
];

function countForType(type: AlertChipType, stats: DashboardStats | undefined): number {
  if (!stats) return 0;
  switch (type) {
    case 'expiringCritical': return stats.expiringCritical?.length ?? 0;
    case 'expiringWarning':  return stats.expiringWarning?.length ?? 0;
    case 'expired':          return stats.expired?.length ?? 0;
    case 'pending':          return stats.pending ?? 0;
  }
}

// ─── AlertChip ────────────────────────────────────────────────────────────────

interface AlertChipProps {
  config: ChipConfig;
  count: number;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
}

function AlertChip({ config, count, onPress, colors, typography }: AlertChipProps) {
  const color = config.color(colors);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.chip,
        {
          backgroundColor: color + '18',
          borderColor: color + '44',
        },
      ]}>
      <Text style={{ fontSize: 14 }}>{config.emoji}</Text>
      <Text
        style={{
          color,
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.semibold,
          fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
          flexShrink: 1,
        }}>
        {config.label(count)}
      </Text>
      <View style={[styles.countBubble, { backgroundColor: color }]}>
        <Text style={styles.countText}>
          {count > 99 ? '99+' : count}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AlertsSection({ stats, onNavigate }: AlertsProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const [open, setOpen] = useState(true);

  const counts = CHIP_CONFIGS.map(cfg => countForType(cfg.type, stats));
  const totalAlerts = counts.reduce((a, b) => a + b, 0);
  const visibleChips = CHIP_CONFIGS.filter((_, i) => counts[i] > 0);

  // Nothing to show
  if (stats && totalAlerts === 0) return null;

  const toggleOpen = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderColor: colors.border,
          marginBottom: spacing[6],
        },
      ]}>
      {/* Header row */}
      <TouchableOpacity
        onPress={toggleOpen}
        activeOpacity={0.75}
        style={[styles.header, { padding: spacing[4] }]}>
        <View style={styles.headerLeft}>
          <Icon name="alert-circle-outline" size={18} color={colors.warning} />
          <Text
            style={{
              color: colors.text,
              fontSize: typography.sizes.base,
              fontWeight: typography.weights.bold,
              fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
              marginLeft: spacing[2],
            }}>
            {stats ? `Alerts (${totalAlerts})` : 'Alerts'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {totalAlerts > 0 && (
            <View
              style={[styles.badge, { backgroundColor: colors.danger }]}>
              <Text style={styles.badgeText}>
                {totalAlerts > 99 ? '99+' : totalAlerts}
              </Text>
            </View>
          )}
          <Icon
            name={open ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
          />
        </View>
      </TouchableOpacity>

      {/* Chip list */}
      {open && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.chipScroll,
            { paddingHorizontal: spacing[4], paddingBottom: spacing[4] },
          ]}>
          {!stats
            ? // Loading skeleton chips
              [0, 1].map(i => (
                <View
                  key={i}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: colors.elevated,
                      borderColor: colors.border,
                      width: 180,
                    },
                  ]}
                />
              ))
            : visibleChips.map((cfg, i) => (
                <AlertChip
                  key={cfg.type}
                  config={cfg}
                  count={counts[CHIP_CONFIGS.indexOf(cfg)]}
                  onPress={() => onNavigate(cfg.screen)}
                  colors={colors}
                  typography={typography}
                />
              ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  chipScroll: {
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
  },
  countBubble: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default AlertsSection;
