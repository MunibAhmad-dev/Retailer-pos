import { useColorScheme } from 'react-native';
import { useCallback } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { DARK_COLORS, LIGHT_COLORS, Colors } from '../theme/colors';

const TYPOGRAPHY = {
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    black: '900' as const,
  },
  /** Primary font — Inter on Android, system default elsewhere */
  fontFamily: 'Inter',
} as const;

const SPACING = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export type Typography = typeof TYPOGRAPHY;
export type Spacing = typeof SPACING;
export type BorderRadius = typeof RADIUS;

interface ThemeValue {
  colors: Colors;
  typography: Typography;
  spacing: Spacing;
  radius: BorderRadius;
  isDark: boolean;
  toggleTheme: () => void;
}

export function useTheme(): ThemeValue {
  const systemScheme = useColorScheme();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  const isDark =
    theme === 'dark' || (theme === 'system' && systemScheme !== 'light');

  const colors: Colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const toggleTheme = useCallback(() => {
    if (theme === 'dark') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else {
      // system — switch to explicit opposite of current appearance
      setTheme(isDark ? 'light' : 'dark');
    }
  }, [theme, isDark, setTheme]);

  return {
    colors,
    typography: TYPOGRAPHY,
    spacing: SPACING,
    radius: RADIUS,
    isDark,
    toggleTheme,
  };
}
