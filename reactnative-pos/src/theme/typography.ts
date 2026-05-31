import { Platform, TextStyle } from 'react-native';

// ─── Font Family ─────────────────────────────────────────────────────────────
const fontFamily = Platform.OS === 'android' ? 'Inter' : undefined;

// ─── Font Sizes ──────────────────────────────────────────────────────────────
export const FontSizes = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export type FontSizeKey = keyof typeof FontSizes;

// ─── Font Weights ─────────────────────────────────────────────────────────────
export const FontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  black: '900' as const,
};

export type FontWeightKey = keyof typeof FontWeights;

// ─── Line Heights ─────────────────────────────────────────────────────────────
export const LineHeights = {
  xs: 16,
  sm: 18,
  base: 22,
  lg: 24,
  xl: 28,
  '2xl': 32,
  '3xl': 38,
  '4xl': 44,
} as const;

export type LineHeightKey = keyof typeof LineHeights;

// ─── Helper ───────────────────────────────────────────────────────────────────
export function createTextStyle(
  size: FontSizeKey,
  weight: FontWeightKey = 'regular',
  lineHeightKey?: LineHeightKey,
): TextStyle {
  return {
    fontSize: FontSizes[size],
    fontWeight: FontWeights[weight],
    lineHeight: LineHeights[lineHeightKey ?? size],
    ...(fontFamily ? { fontFamily } : {}),
  };
}

// ─── Pre-built Text Styles ───────────────────────────────────────────────────
export const TextStyles = {
  heading1: createTextStyle('4xl', 'bold'),
  heading2: createTextStyle('3xl', 'bold'),
  heading3: createTextStyle('2xl', 'semibold'),
  body: createTextStyle('base', 'regular'),
  bodySmall: createTextStyle('sm', 'regular'),
  caption: createTextStyle('xs', 'regular'),
  label: createTextStyle('sm', 'medium'),
  numeric: {
    ...createTextStyle('base', 'semibold'),
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  },
} as const;
