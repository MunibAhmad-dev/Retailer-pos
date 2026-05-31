export * from './colors';
export * from './typography';
export * from './spacing';
export * from './shadows';

import { Colors, DARK_COLORS, LIGHT_COLORS } from './colors';
import { FontSizes, FontWeights, LineHeights, TextStyles } from './typography';
import { spacing, radius } from './spacing';
import { DARK_SHADOWS, LIGHT_SHADOWS, ShadowSet } from './shadows';

// ─── Full Theme Type ──────────────────────────────────────────────────────────
export interface AppTheme {
  isDark: boolean;
  colors: Colors;
  fontSizes: typeof FontSizes;
  fontWeights: typeof FontWeights;
  lineHeights: typeof LineHeights;
  textStyles: typeof TextStyles;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: ShadowSet;
}

// ─── Theme Factory ────────────────────────────────────────────────────────────
export function createAppTheme(isDark: boolean): AppTheme {
  return {
    isDark,
    colors: isDark ? DARK_COLORS : LIGHT_COLORS,
    fontSizes: FontSizes,
    fontWeights: FontWeights,
    lineHeights: LineHeights,
    textStyles: TextStyles,
    spacing,
    radius,
    shadows: isDark ? DARK_SHADOWS : LIGHT_SHADOWS,
  };
}
