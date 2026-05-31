import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  /** Render N stacked text-line skeletons instead of a single block */
  lines?: number;
  animated?: boolean;
  style?: ViewStyle;
}

function SkeletonBlock({
  width,
  height = 16,
  borderRadius,
  animated,
  colors,
  radius,
}: {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  animated: boolean;
  colors: any;
  radius: any;
}) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [animated, shimmer]);

  const opacity = animated
    ? shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] })
    : 0.5;

  return (
    <Animated.View
      style={{
        width: width as any,
        height,
        borderRadius: borderRadius ?? radius.sm,
        backgroundColor: colors.border,
        opacity,
      }}
    />
  );
}

export function Skeleton({
  width,
  height = 16,
  borderRadius,
  lines,
  animated = true,
  style,
}: SkeletonProps) {
  const { colors, radius, spacing } = useTheme();

  if (lines && lines > 1) {
    return (
      <View style={[{ gap: spacing[2] }, style]}>
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBlock
            key={i}
            width={i === lines - 1 ? '65%' : '100%'}
            height={height}
            borderRadius={borderRadius}
            animated={animated}
            colors={colors}
            radius={radius}
          />
        ))}
      </View>
    );
  }

  return (
    <SkeletonBlock
      width={width ?? '100%'}
      height={height}
      borderRadius={borderRadius}
      animated={animated}
      colors={colors}
      radius={radius}
    />
  );
}

export default Skeleton;
