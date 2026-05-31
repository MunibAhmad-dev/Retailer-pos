import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from './Text';
import { Button } from './Button';

interface ActionProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: ActionProps;
  style?: ViewStyle;
}

export function EmptyState({ icon, title, description, action, style }: EmptyStateProps) {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={[
        {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing[8],
          paddingVertical: spacing[12],
          gap: spacing[4],
        },
        style,
      ]}
    >
      {icon ? (
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </View>
      ) : (
        /* Default placeholder illustration */
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="heading2" color={colors.textMuted}>
            ○
          </AppText>
        </View>
      )}

      <View style={{ alignItems: 'center', gap: spacing[2] }}>
        <AppText variant="heading3" color={colors.text} align="center" weight="semibold">
          {title}
        </AppText>
        {description && (
          <AppText variant="body" color={colors.textSub} align="center">
            {description}
          </AppText>
        )}
      </View>

      {action && (
        <Button
          variant={action.variant ?? 'primary'}
          onPress={action.onPress}
          style={{ marginTop: spacing[2] }}
        >
          {action.label}
        </Button>
      )}
    </View>
  );
}

export default EmptyState;
