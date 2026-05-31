import React from 'react';
import { View, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from './Text';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name: string;
  size?: AvatarSize;
  backgroundColor?: string;
  style?: ViewStyle;
}

const sizeMap: Record<AvatarSize, { dimension: number; fontSize: number }> = {
  sm: { dimension: 32, fontSize: 12 },
  md: { dimension: 40, fontSize: 15 },
  lg: { dimension: 52, fontSize: 19 },
  xl: { dimension: 68, fontSize: 24 },
};

/** Deterministically pick a color from the name so the same name always gets the same color */
function colorFromName(name: string): string {
  const palette = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
    '#f97316', '#a855f7',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 'md', backgroundColor, style }: AvatarProps) {
  const { } = useTheme();
  const { dimension, fontSize } = sizeMap[size];
  const bg = backgroundColor ?? colorFromName(name);
  const initials = getInitials(name);

  return (
    <View
      style={[
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <AppText
        variant="label"
        weight="bold"
        color="#ffffff"
        style={{ fontSize, lineHeight: dimension }}
      >
        {initials}
      </AppText>
    </View>
  );
}

export default Avatar;
