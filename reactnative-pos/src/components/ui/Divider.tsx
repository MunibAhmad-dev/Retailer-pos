import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from './Text';

interface DividerProps {
  label?: string;
  style?: ViewStyle;
  color?: string;
  thickness?: number;
}

export function Divider({ label, style, color, thickness = 1 }: DividerProps) {
  const { colors, spacing } = useTheme();
  const lineColor = color ?? colors.border;

  if (!label) {
    return (
      <View
        style={[
          { height: thickness, backgroundColor: lineColor },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[3],
        },
        style,
      ]}
    >
      <View style={{ flex: 1, height: thickness, backgroundColor: lineColor }} />
      <AppText variant="caption" color={colors.textMuted}>
        {label}
      </AppText>
      <View style={{ flex: 1, height: thickness, backgroundColor: lineColor }} />
    </View>
  );
}

export default Divider;
