import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { VictoryBar, VictoryChart, VictoryAxis, VictoryLabel } from 'victory-native';
import { useTheme } from '../../hooks/useTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BarDataPoint {
  x: string;
  y: number;
}

interface BarChartProps {
  data: BarDataPoint[];
  title: string;
  color?: string;
  height?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BarChart({ data, title, color, height = 200 }: BarChartProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const barColor = color ?? colors.primary;
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - spacing[4] * 4;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  if (!data || data.length === 0) {
    return (
      <View
        style={[
          styles.empty,
          { backgroundColor: colors.surface, borderRadius: radius.lg, height },
        ]}
      >
        <Text style={{ color: colors.textMuted, fontSize: typography.sizes.sm }}>
          No data available
        </Text>
      </View>
    );
  }

  const maxY = Math.max(...data.map((d) => d.y));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing[4],
          borderWidth: 1,
          borderColor: colors.border,
          opacity: fadeAnim,
        },
      ]}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.semibold,
          marginBottom: spacing[2],
        }}
      >
        {title}
      </Text>

      <VictoryChart
        width={chartWidth}
        height={height}
        padding={{ top: 24, bottom: 36, left: 48, right: 16 }}
        domainPadding={{ x: 20 }}
      >
        <VictoryAxis
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
          tickFormat={(v: number) => formatValue(v)}
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
              strokeOpacity: 0.4,
            },
          }}
        />
        <VictoryBar
          data={data}
          style={{
            data: {
              fill: barColor,
              fillOpacity: 0.9,
              rx: 4,
            },
          }}
          animate={{
            duration: 500,
            onLoad: { duration: 500 },
          }}
          labelComponent={
            <VictoryLabel
              dy={-6}
              style={{
                fill: colors.textSub,
                fontSize: 9,
                fontFamily: 'Inter',
              }}
            />
          }
          labels={({ datum }: { datum: BarDataPoint }) =>
            datum.y > 0 ? formatValue(datum.y) : ''
          }
        />
      </VictoryChart>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BarChart;
