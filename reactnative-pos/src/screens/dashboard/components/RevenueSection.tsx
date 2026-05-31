/**
 * RevenueSection — Revenue trend chart with period selector (7d / 30d / 3m).
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../../hooks/useTheme';
import { getAnalytics, AnalyticsData, SalesByDay } from '../../../api/dashboard';
import { RevenueChart } from '../../../components/shared/RevenueChart';
import { Skeleton } from '../../../components/ui/Skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '3m';

interface RevenueSectionProps {
  /** Optional pre-fetched analytics data. If not provided, the section fetches its own. */
  analytics?: AnalyticsData;
}

interface PillProps {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  radius: ReturnType<typeof useTheme>['radius'];
}

// ─── Period definitions ───────────────────────────────────────────────────────

const PERIODS: { id: Period; label: string; days: number }[] = [
  { id: '7d',  label: '7D',  days: 7 },
  { id: '30d', label: '30D', days: 30 },
  { id: '3m',  label: '3M',  days: 90 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildChartData(
  salesByDay: SalesByDay[],
  days: number,
): { date: string; revenue: number }[] {
  const cutoff = Date.now() - days * 86_400_000;
  return [...salesByDay]
    .filter(d => new Date(d.date).getTime() >= cutoff)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(d => ({ date: d.date, revenue: d.total }));
}

// ─── PeriodPill ──────────────────────────────────────────────────────────────

function PeriodPill({ label, active, onPress, colors, typography, radius }: PillProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.pill,
        {
          borderRadius: radius.sm,
          backgroundColor: active ? colors.primary : 'transparent',
        },
      ]}>
      <Text
        style={{
          color: active ? colors.primaryFg : colors.textSub,
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.semibold,
          fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
        }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RevenueSection({ analytics: externalAnalytics }: RevenueSectionProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const [period, setPeriod] = useState<Period>('7d');

  // Fetch analytics if not provided by parent
  const { data: fetchedAnalytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['analytics'],
    queryFn: () => getAnalytics(),
    staleTime: 5 * 60 * 1000,
    enabled: !externalAnalytics,
  });

  const analytics = externalAnalytics ?? fetchedAnalytics;
  const selectedPeriod = PERIODS.find(p => p.id === period) ?? PERIODS[0];

  const chartData = useMemo(
    () => buildChartData(analytics?.salesByDay ?? [], selectedPeriod.days),
    [analytics?.salesByDay, selectedPeriod.days],
  );

  const chartPeriod: 'week' | 'month' =
    period === '7d' ? 'week' : 'month';

  return (
    <View style={{ marginBottom: spacing[6] }}>
      {/* Row: title + period pills */}
      <View style={[styles.titleRow, { marginBottom: spacing[3] }]}>
        <Text
          style={{
            color: colors.text,
            fontSize: typography.sizes.lg,
            fontWeight: typography.weights.bold,
            fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
            letterSpacing: -0.2,
          }}>
          Revenue Trend
        </Text>

        {/* Period selector */}
        <View
          style={[
            styles.pillRow,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.sm,
              borderColor: colors.border,
              padding: 3,
            },
          ]}>
          {PERIODS.map(p => (
            <PeriodPill
              key={p.id}
              label={p.label}
              active={period === p.id}
              onPress={() => setPeriod(p.id)}
              colors={colors}
              typography={typography}
              radius={radius}
            />
          ))}
        </View>
      </View>

      {/* Chart area */}
      {isLoading ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            padding: spacing[4],
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
          }}>
          <Skeleton width="50%" height={14} />
          <Skeleton width="100%" height={160} borderRadius={8} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[0, 1, 2, 3, 4].map(i => (
              <Skeleton key={i} width={40} height={10} borderRadius={4} />
            ))}
          </View>
        </View>
      ) : (
        <RevenueChart data={chartData} period={chartPeriod} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 2,
    borderWidth: 1,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
});

export default RevenueSection;
