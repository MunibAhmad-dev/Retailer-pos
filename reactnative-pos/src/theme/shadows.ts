import { Platform, ViewStyle } from 'react-native';

// ─── Shadow Factory ───────────────────────────────────────────────────────────
function makeShadow(
  iosShadowColor: string,
  elevation: number,
  offsetY: number,
  opacity: number,
  blurRadius: number,
): ViewStyle {
  if (Platform.OS === 'android') {
    return { elevation };
  }
  return {
    shadowColor: iosShadowColor,
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: blurRadius,
  };
}

// ─── Shadow Sets ──────────────────────────────────────────────────────────────
export type ShadowPreset = 'sm' | 'md' | 'lg' | 'xl';

export type ShadowSet = Record<ShadowPreset, ViewStyle>;

export const DARK_SHADOWS: ShadowSet = {
  sm: makeShadow('#000000', 2, 1, 0.25, 3),
  md: makeShadow('#000000', 6, 3, 0.32, 6),
  lg: makeShadow('#000000', 12, 6, 0.38, 12),
  xl: makeShadow('#000000', 20, 10, 0.45, 20),
};

export const LIGHT_SHADOWS: ShadowSet = {
  sm: makeShadow('#1a1a2e', 2, 1, 0.08, 3),
  md: makeShadow('#1a1a2e', 6, 3, 0.12, 6),
  lg: makeShadow('#1a1a2e', 12, 6, 0.16, 12),
  xl: makeShadow('#1a1a2e', 20, 10, 0.20, 20),
};
