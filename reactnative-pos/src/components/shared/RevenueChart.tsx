import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import {
  VictoryChart,
  VictoryLine,
  VictoryArea,
  VictoryAxis,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from 'victory-native';
import { useTheme } from '../../hooks/useTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DataPoint {
  date: string;
  revenue: number;
}

interface RevenueChartProps {
  data: DataPoint[];
  period: 'day' | 'week' | 'month';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLabel(date: string, period: 'day' | 'week' | 'month'): string {
  const d = new Date(date);
  if (period === 'day') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', hour12: true });
  }
  if (period === 'week') {
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatRevenue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RevenueChart({ data, period }: RevenueChartProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [activePoint, setActivePoint] = useState<DataPoint | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - spacing[4] * 2 - spacing[4] * 2;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  if (!data || data.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
        <Text style={{ color: colors.textMuted, fontSize: typography.sizes.sm }}>
          No revenue data available
        </Text>
      </View>
    );
  }

  const chartData = data.map((d, i) => ({ x: i, y: d.revenue, label: '' }));
  const maxRevenue = Math.max(...data.map((d) => d.revenue));
  const minRevenue = Math.min(...data.map((d) => d.revenue));

  // Show every Nth label to avoid crowding
  const labelStep = Math.ceil(data.length / 5);
  const tickValues = data
    .map((_, i) => i)
    .filter((i) => i % labelStep === 0 || i === data.length - 1);

  const styles2 = StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing[4],
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing[2],
    },
    title: {
      color: colors.text,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
    tooltip: {
      backgroundColor: colors.elevated,
      borderRadius: radius.sm,
      padding: spacing[2],
      borderWidth: 1,
      borderColor: colors.border,
    },
    tooltipLabel: {
      color: colors.textSub,
      fontSize: typography.sizes.xs,
    },
    tooltipValue: {
      color: colors.primary,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.bold,
    },
  });

  return (
    <Animated.View style={[styles2.container, { opacity: fadeAnim }]}>
      <View style={styles2.header}>
        <Text style={styles2.title}>Revenue Trend</Text>
        {activePoint && (
          <View style={styles2.tooltip}>
            <Text style={styles2.tooltipLabel}>{activePoint.date}</Text>
            <Text style={styles2.tooltipValue}>Rs {activePoint.revenue.toLocaleString()}</Text>
          </View>
        )}
      </View>

      <VictoryChart
        width={chartWidth}
        height={180}
        padding={{ top: 16, bottom: 40, left: 48, right: 16 }}
        domain={{ y: [minRevenue * 0.9, maxRevenue * 1.1] }}
        containerComponent={
          <VictoryVoronoiContainer
            voronoiDimension="x"
            onActivated={(points) => {
              const idx = points[0]?.x;
              if (typeof idx === 'number' && data[idx]) {
                setActivePoint(data[idx]);
              }
            }}
            onDeactivated={() => setActivePoint(null)}
          />
        }
      >
        <VictoryAxis
          tickValues={tickValues}
          tickFormat={(t: number) => (data[t] ? formatLabel(data[t].date, period) : '')}
          style={{
            axis: { stroke: colors.border },
            tickLabels: {
              fill: colors.textMuted,
              fontSize: 10,
              fontFamily: 'Inter',
            },
            grid: { stroke: 'transparent' },
          }}
        />
        <VictoryAxis
          dependentAxis
          tickFormat={(v: number) => formatRevenue(v)}
          style={{
            axis: { stroke: 'transparent' },
            tickLabels: {
              fill: colors.textMuted,
              fontSize: 10,
              fontFamily: 'Inter',
            },
            grid: {
              stroke: colors.border,
              strokeDasharray: '4,4',
              strokeOpacity: 0.5,
            },
          }}
        />
        <VictoryArea
          data={chartData}
          style={{
            data: {
              fill: colors.primary,
              fillOpacity: 0.12,
              stroke: 'transparent',
            },
          }}
          animate={{ duration: 600 }}
          interpolation="monotoneX"
        />
        <VictoryLine
          data={chartData}
          style={{
            data: {
              stroke: colors.primary,
              strokeWidth: 2.5,
            },
          }}
          animate={{ duration: 600 }}
          interpolation="monotoneX"
        />
      </VictoryChart>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RevenueChart;
