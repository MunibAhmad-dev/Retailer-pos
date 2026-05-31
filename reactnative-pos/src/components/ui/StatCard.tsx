import React from 'react';
import {
  View,
  TouchableOpacity,
  ViewStyle,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from './Text';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: number;
  color?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

function TrendIndicator({ trend, colors }: { trend: number; colors: any }) {
  const isPositive = trend >= 0;
  const trendColor = isPositive ? colors.success : colors.danger;
  const arrow = isPositive ? '▲' : '▼';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <AppText variant="caption" color={trendColor} weight="semibold">
        {arrow} {Math.abs(trend).toFixed(1)}%
      </AppText>
    </View>
  );
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color,
  onPress,
  style,
}: StatCardProps) {
  const { colors, spacing, radius, isDark } = useTheme();

  const accentColor = color ?? colors.primary;

  const shadowStyle: ViewStyle =
    Platform.OS === 'android'
      ? { elevation: 4 }
      : {
          shadowColor: isDark ? '#000000' : '#1a1a2e',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: 6,
        };

  const cardStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadowStyle,
  };

  const content = (
    <View style={{ flexDirection: 'row', minHeight: 90 }}>
      {/* Accent strip */}
      <View
        style={{
          width: 4,
          backgroundColor: accentColor,
          borderTopLeftRadius: radius.lg,
          borderBottomLeftRadius: radius.lg,
        }}
      />

      {/* Body */}
      <View style={{ flex: 1, padding: spacing[4], gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <AppText variant="label" color={colors.textSub}>
            {title}
          </AppText>
          {icon && <View>{icon}</View>}
        </View>

        <AppText variant="heading3" weight="bold" color={colors.text}>
          {String(value)}
        </AppText>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {trend !== undefined && (
            <TrendIndicator trend={trend} colors={colors} />
          )}
          {subtitle && (
            <AppText variant="caption" color={colors.textMuted}>
              {subtitle}
            </AppText>
          )}
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={[cardStyle, style]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={[cardStyle, style]}>{content}</View>;
}

export default StatCard;
