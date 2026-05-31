import React, { useRef, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Animated,
  ViewStyle,
  Platform,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from './Text';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  onFilter?: () => void;
  style?: ViewStyle;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  onClear,
  onFilter,
  style,
}: SearchBarProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const widthAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(widthAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!value) {
      Animated.timing(widthAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  };

  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  const borderColor = isFocused ? colors.primary : colors.border;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[2],
        },
        style,
      ]}
    >
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor,
          paddingHorizontal: spacing[3],
          height: 44,
          gap: spacing[2],
        }}
      >
        {/* Search icon (text placeholder — replace with react-native-vector-icons) */}
        <AppText variant="body" color={colors.textMuted}>
          ⌕
        </AppText>

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={{
            flex: 1,
            fontSize: typography.sizes.base,
            fontFamily: typography.fontFamily,
            color: colors.text,
            height: 44,
          }}
          returnKeyType="search"
          clearButtonMode="never"
        />

        {value.length > 0 && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppText variant="body" color={colors.textMuted}>
              ✕
            </AppText>
          </TouchableOpacity>
        )}
      </View>

      {onFilter && (
        <TouchableOpacity
          onPress={onFilter}
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: colors.elevated,
            borderWidth: 1.5,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="body" color={colors.textSub}>
            ⊞
          </AppText>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default SearchBar;
