import React from 'react';
import { Text, TextStyle, StyleSheet, I18nManager } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type Variant =
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'label'
  | 'numeric';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold' | 'black';
type Align = 'auto' | 'left' | 'right' | 'center' | 'justify';

interface AppTextProps {
  variant?: Variant;
  color?: string;
  weight?: Weight;
  align?: Align;
  numberOfLines?: number;
  children: React.ReactNode;
  style?: TextStyle;
}

const variantMap: Record<Variant, { size: keyof ReturnType<typeof useTheme>['typography']['sizes']; weight: Weight; lineHeight: number }> = {
  heading1:  { size: '4xl', weight: 'bold',     lineHeight: 44 },
  heading2:  { size: '3xl', weight: 'bold',     lineHeight: 38 },
  heading3:  { size: '2xl', weight: 'semibold', lineHeight: 32 },
  body:      { size: 'base', weight: 'regular', lineHeight: 22 },
  bodySmall: { size: 'sm',  weight: 'regular',  lineHeight: 20 },
  caption:   { size: 'xs',  weight: 'regular',  lineHeight: 16 },
  label:     { size: 'sm',  weight: 'medium',   lineHeight: 18 },
  numeric:   { size: 'xl',  weight: 'bold',     lineHeight: 28 },
};

export function AppText({
  variant = 'body',
  color,
  weight,
  align,
  numberOfLines,
  children,
  style,
}: AppTextProps) {
  const { colors, typography } = useTheme();

  const variantStyle = variantMap[variant];
  const resolvedWeight = weight ?? variantStyle.weight;
  const resolvedAlign = align ?? (I18nManager.isRTL ? 'right' : 'left');

  const textStyle: TextStyle = {
    fontSize: typography.sizes[variantStyle.size],
    fontWeight: typography.weights[resolvedWeight],
    lineHeight: variantStyle.lineHeight,
    color: color ?? colors.text,
    textAlign: resolvedAlign,
    fontFamily: typography.fontFamily,
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  };

  return (
    <Text
      style={[textStyle, style]}
      numberOfLines={numberOfLines}
      allowFontScaling={false}
    >
      {children}
    </Text>
  );
}

export default AppText;
