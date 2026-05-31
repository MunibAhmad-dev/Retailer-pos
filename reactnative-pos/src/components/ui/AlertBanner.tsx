import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from './Text';

type AlertType = 'error' | 'warning' | 'success' | 'info';

interface AlertBannerProps {
  type?: AlertType;
  title: string;
  description?: string;
  onDismiss?: () => void;
  onAction?: () => void;
  actionLabel?: string;
  style?: ViewStyle;
}

export function AlertBanner({
  type = 'info',
  title,
  description,
  onDismiss,
  onAction,
  actionLabel,
  style,
}: AlertBannerProps) {
  const { colors, spacing, radius } = useTheme();
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const typeMap: Record<AlertType, { color: string; icon: string; bg: string }> = {
    error:   { color: colors.danger,  icon: '✕', bg: `${colors.danger}18` },
    warning: { color: colors.warning, icon: '!', bg: `${colors.warning}18` },
    success: { color: colors.success, icon: '✓', bg: `${colors.success}18` },
    info:    { color: colors.primary, icon: 'i', bg: `${colors.primary}18` },
  };

  const { color, icon, bg } = typeMap[type];

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -80,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss?.());
  };

  return (
    <Animated.View
      style={[
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
          backgroundColor: bg,
          borderRadius: radius.md,
          borderLeftWidth: 3,
          borderLeftColor: color,
          padding: spacing[4],
          flexDirection: 'row',
          gap: spacing[3],
          alignItems: 'flex-start',
        },
        style,
      ]}
    >
      {/* Icon badge */}
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        <AppText variant="caption" weight="bold" color="#ffffff">
          {icon}
        </AppText>
      </View>

      {/* Content */}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label" weight="semibold" color={colors.text}>
          {title}
        </AppText>
        {description && (
          <AppText variant="bodySmall" color={colors.textSub}>
            {description}
          </AppText>
        )}
        {onAction && actionLabel && (
          <TouchableOpacity onPress={onAction} style={{ marginTop: spacing[2] }}>
            <AppText variant="label" weight="semibold" color={color}>
              {actionLabel}
            </AppText>
          </TouchableOpacity>
        )}
      </View>

      {/* Dismiss */}
      {onDismiss && (
        <TouchableOpacity
          onPress={handleDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <AppText variant="body" color={colors.textMuted}>
            ✕
          </AppText>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

export default AlertBanner;
