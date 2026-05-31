import React from 'react';
import {
  TouchableOpacity,
  View,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from './Text';

// react-native-haptic-feedback is optional — gracefully skip if not installed
let HapticFeedback: any = null;
try {
  HapticFeedback = require('react-native-haptic-feedback').default;
} catch (_) {}

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

const sizeMap = {
  sm: { height: 36, paddingHorizontal: 12, fontSize: 13, iconSize: 14 },
  md: { height: 48, paddingHorizontal: 20, fontSize: 15, iconSize: 16 },
  lg: { height: 56, paddingHorizontal: 28, fontSize: 17, iconSize: 18 },
} as const;

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  onPress,
  children,
  style,
}: ButtonProps) {
  const { colors, radius, typography } = useTheme();
  const { height, paddingHorizontal, fontSize } = sizeMap[size];

  const handlePress = () => {
    if (disabled || loading) return;
    if (HapticFeedback) {
      HapticFeedback.trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    onPress?.();
  };

  const getVariantStyle = (): { container: ViewStyle; text: string } => {
    switch (variant) {
      case 'primary':
        return {
          container: { backgroundColor: colors.primary },
          text: colors.primaryFg,
        };
      case 'secondary':
        return {
          container: { backgroundColor: colors.elevated },
          text: colors.text,
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: colors.primary,
          },
          text: colors.primary,
        };
      case 'ghost':
        return {
          container: { backgroundColor: 'transparent' },
          text: colors.primary,
        };
      case 'danger':
        return {
          container: { backgroundColor: colors.danger },
          text: '#ffffff',
        };
      case 'success':
        return {
          container: { backgroundColor: colors.success },
          text: '#ffffff',
        };
    }
  };

  const { container: variantContainer, text: textColor } = getVariantStyle();

  const containerStyle: ViewStyle = {
    height,
    paddingHorizontal,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    opacity: disabled ? 0.45 : 1,
    gap: 8,
    ...variantContainer,
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[containerStyle, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {leftIcon && <View>{leftIcon}</View>}
          <AppText
            variant={size === 'sm' ? 'label' : 'body'}
            weight="semibold"
            color={textColor}
          >
            {children}
          </AppText>
          {rightIcon && <View>{rightIcon}</View>}
        </>
      )}
    </TouchableOpacity>
  );
}

export default Button;
