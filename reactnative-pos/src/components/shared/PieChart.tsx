import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { VictoryPie, VictoryAnimation } from 'victory-native';
import { useTheme } from '../../hooks/useTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PieDataPoint {
  x: string;
  y: number;
  color?: string;
}

interface PieChartProps {
  data: PieDataPoint[];
  title: string;
  centerLabel?: string;
}

// ─── Default palette ──────────────────────────────────────────────────────────

const DEFAULT_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
];

// ─── Component ────────────────────────────────────────────────────────────────

export function PieChart({ data, title, centerLabel }: PieChartProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const screenWidth = Dimensions.get('window').width;
  const chartSize = Math.min(screenWidth - spacing[4] * 4, 220);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  if (!data || data.length === 0) {
    return (
      <View
        style={[styles.empty, { backgroundColor: colors.surface, borderRadius: radius.lg }]}
      >
        <Text style={{ color: colors.textMuted, fontSize: typography.sizes.sm }}>
          No data available
        </Text>
      </View>
    );
  }

  const total = data.reduce((acc, d) => acc + d.y, 0);
  const coloredData = data.map((d, i) => ({
    ...d,
    color: d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }));

  return (
    <Animated.View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing[4],
        borderWidth: 1,
        borderColor: colors.border,
        opacity: fadeAnim,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.semibold,
          marginBottom: spacing[2],
          textAlign: 'center',
        }}
      >
        {title}
      </Text>

      <View style={{ alignItems: 'center' }}>
        <View style={{ width: chartSize, height: chartSize }}>
          <VictoryPie
            data={coloredData}
            width={chartSize}
            height={chartSize}
            innerRadius={chartSize * 0.28}
            padding={16}
            style={{
              data: {
                fill: ({ datum }: { datum: PieDataPoint & { color: string } }) => datum.color,
                stroke: colors.surface,
                strokeWidth: 2,
              },
              labels: { fill: 'transparent' },
            }}
            animate={{ duration: 600 }}
          />

          {/* Center label overlay */}
          {centerLabel ? (
            <View style={[StyleSheet.absoluteFillObject, styles.centerLabel]}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: typography.sizes.sm,
                  fontWeight: typography.weights.bold,
                  textAlign: 'center',
                }}
              >
                {centerLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Legend */}
      <View style={{ marginTop: spacing[3], gap: 6 }}>
        {coloredData.map((item) => {
          const pct = total > 0 ? ((item.y / total) * 100).toFixed(1) : '0';
          return (
            <View key={item.x} style={styles.legendRow}>
              <View
                style={[styles.legendDot, { backgroundColor: item.color }]}
              />
              <Text
                style={{
                  flex: 1,
                  color: colors.textSub,
                  fontSize: typography.sizes.sm,
                }}
                numberOfLines={1}
              >
                {item.x}
              </Text>
              <Text
                style={{
                  color: colors.text,
                  fontSize: typography.sizes.sm,
                  fontWeight: typography.weights.semibold,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {pct}%
              </Text>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

export default PieChart;
