import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HeaderAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  /** 'back' shows a back chevron, 'menu' is a placeholder for drawer toggle */
  leftAction?: 'back' | 'menu' | React.ReactNode;
  rightAction?: HeaderAction;
  searchable?: boolean;
  onSearch?: (query: string) => void;
  style?: ViewStyle;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Header({
  title,
  subtitle,
  leftAction,
  rightAction,
  searchable,
  onSearch,
  style,
}: HeaderProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [searchActive, setSearchActive] = useState(false);
  const [query, setQuery] = useState('');

  const topPad = insets.top + (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0);

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };

  const handleSearchChange = (text: string) => {
    setQuery(text);
    onSearch?.(text);
  };

  const handleSearchClose = () => {
    setSearchActive(false);
    setQuery('');
    onSearch?.('');
  };

  // ── Left element ────────────────────────────────────────────────────────────
  let leftEl: React.ReactNode = null;
  if (leftAction === 'back') {
    leftEl = (
      <TouchableOpacity
        onPress={handleBack}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.iconBtn}
      >
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '300' }}>
          ‹
        </Text>
      </TouchableOpacity>
    );
  } else if (leftAction === 'menu') {
    leftEl = (
      <View style={styles.iconBtn}>
        <View style={[styles.menuLine, { backgroundColor: colors.text }]} />
        <View style={[styles.menuLine, styles.menuLineShort, { backgroundColor: colors.text }]} />
        <View style={[styles.menuLine, { backgroundColor: colors.text }]} />
      </View>
    );
  } else if (React.isValidElement(leftAction)) {
    leftEl = leftAction;
  }

  // ── Right element ───────────────────────────────────────────────────────────
  let rightEl: React.ReactNode = null;
  if (searchable && !searchActive) {
    rightEl = (
      <TouchableOpacity
        onPress={() => setSearchActive(true)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.iconBtn}
      >
        <Text style={{ color: colors.text, fontSize: 18 }}>⌕</Text>
      </TouchableOpacity>
    );
  } else if (rightAction) {
    const isPrimary = rightAction.variant !== 'ghost';
    rightEl = (
      <TouchableOpacity
        onPress={rightAction.onPress}
        style={[
          styles.rightBtn,
          {
            backgroundColor: isPrimary ? colors.primary : 'transparent',
            borderRadius: radius.sm,
            borderWidth: isPrimary ? 0 : 1,
            borderColor: colors.border,
          },
        ]}
      >
        <Text
          style={{
            color: isPrimary ? colors.primaryFg : colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.semibold,
          }}
        >
          {rightAction.label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        {
          paddingTop: topPad,
          backgroundColor: colors.bg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        style,
      ]}
    >
      {/* Main row */}
      <View
        style={[
          styles.row,
          {
            paddingHorizontal: spacing[4],
            paddingBottom: spacing[3],
            paddingTop: spacing[2],
            gap: spacing[2],
          },
        ]}
      >
        {/* Left */}
        {leftEl ? <View style={styles.sideSlot}>{leftEl}</View> : null}

        {/* Title / search input */}
        <View style={{ flex: 1 }}>
          {searchActive ? (
            <TextInput
              autoFocus
              value={query}
              onChangeText={handleSearchChange}
              placeholder="Search..."
              placeholderTextColor={colors.textMuted}
              style={{
                color: colors.text,
                fontSize: typography.sizes.base,
                fontWeight: typography.weights.medium,
                padding: 0,
              }}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          ) : (
            <>
              <Text
                style={{
                  color: colors.text,
                  fontSize: typography.sizes.xl,
                  fontWeight: typography.weights.bold,
                }}
                numberOfLines={1}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text
                  style={{
                    color: colors.textSub,
                    fontSize: typography.sizes.sm,
                    marginTop: 1,
                  }}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {/* Right */}
        {searchActive ? (
          <TouchableOpacity onPress={handleSearchClose}>
            <Text
              style={{
                color: colors.primary,
                fontSize: typography.sizes.sm,
                fontWeight: typography.weights.semibold,
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        ) : rightEl ? (
          <View style={styles.sideSlot}>{rightEl}</View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideSlot: {
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  menuLine: {
    width: 20,
    height: 2,
    borderRadius: 1,
    marginVertical: 2,
  },
  menuLineShort: {
    width: 14,
    alignSelf: 'flex-start',
  },
});

export default Header;
