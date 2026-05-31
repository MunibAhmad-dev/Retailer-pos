import { useColorScheme } from 'react-native';

export const DARK_COLORS = {
  bg: '#0a0a0f',
  surface: '#111118',
  elevated: '#1a1a24',
  border: '#2a2a3a',
  text: '#ffffff',
  textSub: '#8b8fa8',
  textMuted: '#4a4a5e',
  primary: '#6366f1',
  primaryFg: '#ffffff',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  accent: '#8b5cf6',
} as const;

export const LIGHT_COLORS = {
  bg: '#f8f9fc',
  surface: '#ffffff',
  elevated: '#f0f2f8',
  border: '#e5e7f0',
  text: '#0a0a0f',
  textSub: '#64687a',
  textMuted: '#9ca3af',
  primary: '#4f46e5',
  primaryFg: '#ffffff',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  accent: '#7c3aed',
} as const;

export type Colors = typeof DARK_COLORS;

/**
 * Returns the correct color set based on the current color scheme.
 * Falls back to dark mode if the scheme is not detected.
 */
export function useThemeColors(): Colors {
  const scheme = useColorScheme();
  return scheme === 'light' ? LIGHT_COLORS : DARK_COLORS;
}
