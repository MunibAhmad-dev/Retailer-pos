// ─── Spacing Scale (8pt grid) ─────────────────────────────────────────────────
export const spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s8: 32,
  s10: 40,
  s12: 48,
  s16: 64,
} as const;

export type Spacing = typeof spacing;
export type SpacingKey = keyof Spacing;

// ─── Border Radius Scale ──────────────────────────────────────────────────────
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export type Radius = typeof radius;
export type RadiusKey = keyof Radius;
