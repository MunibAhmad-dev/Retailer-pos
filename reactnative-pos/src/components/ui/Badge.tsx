import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from './Text';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
}

export function Badge({ label, variant = 'neutral', size = 'md', style }: BadgeProps) {
  const { colors } = useTheme();

  const variantMap: Record<BadgeVariant, { bg: string; text: string }> = {
    success: { bg: `${colors.success}22`, text: colors.success },
    warning: { bg: `${colors.warning}22`, text: colors.warning },
    danger:  { bg: `${colors.danger}22`,  text: colors.danger },
    info:    { bg: `${colors.primary}22`, text: colors.primary },
    neutral: { bg: colors.elevated,        text: colors.textSub },
  };

  const { bg, text } = variantMap[variant];

  const sizeStyle: ViewStyle =
    size === 'sm'
      ? { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }
      : { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 };

  return (
    <View
      style={[
        { backgroundColor: bg, alignSelf: 'flex-start' },
        sizeStyle,
        style,
      ]}
    >
      <AppText
        variant="caption"
        weight="semibold"
        color={text}
      >
        {label}
      </AppText>
    </View>
  );
}

export default Badge;
