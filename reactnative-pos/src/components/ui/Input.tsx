import React, { useRef, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  Animated,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from './Text';

type InputVariant = 'outlined' | 'filled';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  secureTextEntry?: boolean;
  multiline?: boolean;
  variant?: InputVariant;
  style?: ViewStyle;
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  helperText,
  leftIcon,
  rightIcon,
  secureTextEntry = false,
  multiline = false,
  variant = 'outlined',
  style,
  ...rest
}: InputProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [secure, setSecure] = useState(secureTextEntry);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(borderAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.timing(borderAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error ? colors.danger : colors.border,
      error ? colors.danger : colors.primary,
    ],
  });

  const containerBackground =
    variant === 'filled' ? colors.elevated : colors.surface;

  const inputHeight = multiline ? 96 : 48;

  return (
    <View style={[{ gap: 6 }, style]}>
      {label && (
        <AppText variant="label" color={colors.textSub}>
          {label}
        </AppText>
      )}

      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          backgroundColor: containerBackground,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor,
          paddingHorizontal: spacing[3],
          minHeight: inputHeight,
          paddingVertical: multiline ? spacing[3] : 0,
        }}
      >
        {leftIcon && (
          <View style={{ marginRight: spacing[2] }}>{leftIcon}</View>
        )}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secure}
          multiline={multiline}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={{
            flex: 1,
            fontSize: typography.sizes.base,
            fontFamily: typography.fontFamily,
            color: colors.text,
            height: multiline ? undefined : inputHeight,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
          {...rest}
        />

        {secureTextEntry ? (
          <TouchableOpacity
            onPress={() => setSecure((s) => !s)}
            style={{ marginLeft: spacing[2] }}
          >
            <AppText variant="caption" color={colors.primary}>
              {secure ? 'Show' : 'Hide'}
            </AppText>
          </TouchableOpacity>
        ) : (
          rightIcon && (
            <View style={{ marginLeft: spacing[2] }}>{rightIcon}</View>
          )
        )}
      </Animated.View>

      {(error || helperText) && (
        <AppText
          variant="caption"
          color={error ? colors.danger : colors.textMuted}
        >
          {error ?? helperText}
        </AppText>
      )}
    </View>
  );
}

export default Input;
