import React from 'react';
import {
  View,
  TouchableOpacity,
  ViewStyle,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type CardVariant = 'default' | 'elevated' | 'outlined';

interface CardProps {
  variant?: CardVariant;
  padding?: number;
  onPress?: () => void;
  style?: ViewStyle;
  children: React.ReactNode;
}

export function Card({
  variant = 'default',
  padding,
  onPress,
  style,
  children,
}: CardProps) {
  const { colors, spacing, radius, isDark } = useTheme();

  const resolvedPadding = padding ?? spacing[4];

  const backgroundColor =
    variant === 'elevated' ? colors.elevated : colors.surface;

  const borderStyle: ViewStyle =
    variant === 'outlined'
      ? { borderWidth: 1, borderColor: colors.border }
      : {};

  const shadowStyle: ViewStyle =
    variant === 'elevated'
      ? Platform.OS === 'android'
        ? { elevation: 8 }
        : {
            shadowColor: isDark ? '#000000' : '#1a1a2e',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.38 : 0.12,
            shadowRadius: 8,
          }
      : variant === 'default'
      ? Platform.OS === 'android'
        ? { elevation: 3 }
        : {
            shadowColor: isDark ? '#000000' : '#1a1a2e',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.25 : 0.08,
            shadowRadius: 4,
          }
      : {};

  const containerStyle: ViewStyle = {
    backgroundColor,
    borderRadius: radius.lg,
    padding: resolvedPadding,
    ...borderStyle,
    ...shadowStyle,
  };

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onPress}
        style={[containerStyle, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[containerStyle, style]}>{children}</View>;
}

export default Card;
