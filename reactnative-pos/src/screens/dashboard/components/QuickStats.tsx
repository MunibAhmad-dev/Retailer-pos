/**
 * QuickStats — 2x3 grid of key dashboard metrics.
 *
 * Metrics:
 *   Row 1: Total Stores | Active Today | Pending
 *   Row 2: Total Revenue | Total Sales | Licenses Issued
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../../hooks/useTheme';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { DashboardStats } from '../../../api/dashboard';
import { Skeleton } from '../../../components/ui/Skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuickStatsProps {
  stats: DashboardStats | undefined;
  isLoading: boolean;
  onNavigate: (screen: string) => void;
}

interface StatCardDef {
  label: string;
  getValue: (stats: DashboardStats, fmtShort: (n: number) => string) => string;
  icon: string;
  iconColorKey: 'primary' | 'success' | 'warning' | 'accent' | 'danger';
  screen?: string;
}

// ─── Stat definitions ─────────────────────────────────────────────────────────

const STATS: StatCardDef[] = [
  {
    label: 'Total Stores',
    getValue: (s) => String(s.totalInstances ?? 0),
    icon: 'store-outline',
    iconColorKey: 'primary',
    screen: 'Instances',
  },
  {
    label: 'Active Today',
    getValue: (s) => String(s.activeToday ?? 0),
    icon: 'lightning-bolt',
    iconColorKey: 'success',
  },
  {
    label: 'Pending',
    getValue: (s) => String(s.pending ?? 0),
    icon: 'clock-outline',
    iconColorKey: 'warning',
    screen: 'Instances',
  },
  {
    label: 'Total Revenue',
    getValue: (s, fmt) => fmt(s.totalRevenue ?? 0),
    icon: 'cash-multiple',
    iconColorKey: 'accent',
  },
  {
    label: 'Total Sales',
    getValue: (s) => String(s.totalSales ?? 0),
    icon: 'receipt-outline',
    iconColorKey: 'primary',
  },
  {
    label: 'Licenses Issued',
    getValue: (s) => String(s.licensesIssued ?? 0),
    icon: 'key-outline',
    iconColorKey: 'success',
    screen: 'Licenses',
  },
];

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  iconColor: string;
  onPress?: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  radius: ReturnType<typeof useTheme>['radius'];
}

function StatCard({
  label,
  value,
  icon,
  iconColor,
  onPress,
  colors,
  typography,
  spacing,
  radius,
}: StatCardProps) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.75 } : {};

  return (
    <Wrapper
      {...wrapperProps}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderColor: colors.border,
          padding: spacing[3],
          ...Platform.select({
            android: { elevation: 2 },
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
            },
          }),
        },
      ]}>
      {/* Icon bubble */}
      <View
        style={[
          styles.iconBubble,
          { backgroundColor: iconColor + '1a', borderRadius: 10 },
        ]}>
        <Icon name={icon} size={16} color={iconColor} />
      </View>

      {/* Value */}
      <Text
        style={{
          color: colors.text,
          fontSize: typography.sizes.xl,
          fontWeight: typography.weights.bold,
          fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
          letterSpacing: -0.3,
          marginTop: 8,
        }}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {value}
      </Text>

      {/* Label */}
      <Text
        style={{
          color: colors.textSub,
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.medium,
          fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
          marginTop: 3,
        }}
        numberOfLines={2}>
        {label}
      </Text>
    </Wrapper>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuickStats({ stats, isLoading, onNavigate }: QuickStatsProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const { fmtShort } = useFormatCurrency();

  if (isLoading) {
    return (
      <View style={{ gap: spacing[3] }}>
        {[0, 1].map(row => (
          <View key={row} style={styles.row}>
            {[0, 1, 2].map(col => (
              <Skeleton
                key={col}
                width={undefined}
                height={90}
                borderRadius={radius.md}
                style={{ flex: 1 }}
              />
            ))}
          </View>
        ))}
      </View>
    );
  }

  const rows: StatCardDef[][] = [
    STATS.slice(0, 3),
    STATS.slice(3, 6),
  ];

  return (
    <View style={{ gap: spacing[3] }}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((def, ci) => {
            const value = stats ? def.getValue(stats, fmtShort) : '—';
            return (
              <React.Fragment key={def.label}>
                {ci > 0 && <View style={{ width: spacing[3] }} />}
                <StatCard
                  label={def.label}
                  value={value}
                  icon={def.icon}
                  iconColor={colors[def.iconColorKey]}
                  onPress={def.screen ? () => onNavigate(def.screen!) : undefined}
                  colors={colors}
                  typography={typography}
                  spacing={spacing}
                  radius={radius}
                />
              </React.Fragment>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  card: {
    flex: 1,
    borderWidth: 1,
    gap: 0,
  },
  iconBubble: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default QuickStats;
