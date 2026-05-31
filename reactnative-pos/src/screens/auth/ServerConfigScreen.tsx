/**
 * ServerConfigScreen.tsx
 *
 * Modal screen to override the backend base URL.
 * Useful for switching between dev / staging / production environments
 * without rebuilding the app.
 *
 * Behaviour:
 *   - Pre-fills with the currently saved URL (MMKV key: 'backend_url').
 *   - Falls back to the production default when cleared.
 *   - On save: persists to MMKV so the axios client picks it up on the next request.
 *   - On discard: navigates back without saving.
 *
 * Dependencies:
 *   react-native-mmkv            — persistence
 *   react-native-reanimated      — entrance animation
 *   react-native-toast-message   — success / error feedback
 *   react-native-vector-icons    — icons
 */

import React, {useCallback, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {DARK_COLORS, LIGHT_COLORS} from '@/theme/colors';
import {spacing, radius} from '@/theme/spacing';
import {FontSizes, FontWeights} from '@/theme/typography';
import {mmkv} from '@/utils/storage';
import type {AuthStackParamList} from '@/navigation/AuthStack';
import {SCREENS} from '@/navigation/screens';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_URL = 'https://osatechcloud.cloud';
const BACKEND_URL_KEY = 'backend_url';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<
  AuthStackParamList,
  typeof SCREENS.SERVER_CONFIG
>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ServerConfigScreen({navigation}: Props) {
  const isDark = useColorScheme() !== 'light';
  const C = isDark ? DARK_COLORS : LIGHT_COLORS;

  // Pre-fill with saved URL, falling back to the production default
  const [url, setUrl] = useState<string>(
    () => mmkv.getString(BACKEND_URL_KEY) ?? DEFAULT_URL,
  );
  const [focused, setFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Button press animation
  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{scale: btnScale.value}],
  }));

  // Input border animation
  const borderAnim = useSharedValue(0);
  const inputBorderStyle = useAnimatedStyle(() => ({
    borderColor: borderAnim.value === 1 ? C.primary : C.border,
    borderWidth: borderAnim.value === 1 ? 1.5 : 1,
  }));

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const trimmed = url.trim();

    if (!trimmed) {
      // User cleared the field — reset to default
      mmkv.delete(BACKEND_URL_KEY);
      Toast.show({
        type: 'success',
        text1: 'Reset to default',
        text2: DEFAULT_URL,
      });
      navigation.goBack();
      return;
    }

    if (!isValidUrl(trimmed)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid URL',
        text2: 'Enter a valid http:// or https:// URL.',
      });
      return;
    }

    btnScale.value = withSpring(0.96, {}, () => {
      btnScale.value = withSpring(1);
    });

    setIsSaving(true);
    try {
      // Persist
      mmkv.set(BACKEND_URL_KEY, trimmed);

      Toast.show({
        type: 'success',
        text1: 'Server URL saved',
        text2: trimmed,
      });

      navigation.goBack();
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Save failed',
        text2: 'Could not persist the URL. Try again.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [url, navigation, btnScale]);

  const handleReset = useCallback(() => {
    setUrl(DEFAULT_URL);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, {backgroundColor: C.bg}]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={C.bg}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 20}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Header */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(80)}
            style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
              style={[styles.backBtn, {backgroundColor: C.elevated, borderColor: C.border}]}
              accessibilityRole="button"
              accessibilityLabel="Go back">
              <Icon name="arrow-left" size={20} color={C.text} />
            </TouchableOpacity>

            <View style={styles.headerTextGroup}>
              <Text style={[styles.headerTitle, {color: C.text}]}>
                Server Configuration
              </Text>
              <Text style={[styles.headerSub, {color: C.textSub}]}>
                Override the backend base URL
              </Text>
            </View>
          </Animated.View>

          {/* Card */}
          <Animated.View
            entering={FadeInUp.duration(500).delay(200)}
            style={[
              styles.card,
              {
                backgroundColor: isDark
                  ? 'rgba(17, 17, 24, 0.92)'
                  : 'rgba(255, 255, 255, 0.95)',
                borderColor: C.border,
              },
            ]}>

            {/* Icon + label */}
            <View style={styles.fieldLabel}>
              <Icon name="server-network" size={16} color={C.primary} />
              <Text style={[styles.labelText, {color: C.textSub}]}>
                {' '}Backend URL
              </Text>
            </View>

            {/* URL input */}
            <Animated.View
              style={[
                styles.inputWrapper,
                {backgroundColor: C.elevated},
                inputBorderStyle,
              ]}>
              <Icon
                name="link-variant"
                size={18}
                color={focused ? C.primary : C.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, {color: C.text}]}
                placeholder={DEFAULT_URL}
                placeholderTextColor={C.textMuted}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                textContentType="URL"
                returnKeyType="done"
                onSubmitEditing={handleSave}
                onFocus={() => {
                  setFocused(true);
                  borderAnim.value = withTiming(1, {duration: 200});
                }}
                onBlur={() => {
                  setFocused(false);
                  borderAnim.value = withTiming(0, {duration: 200});
                }}
                selectTextOnFocus
              />
              {url !== DEFAULT_URL && url.length > 0 && (
                <TouchableOpacity
                  onPress={() => setUrl('')}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <Icon name="close-circle" size={18} color={C.textMuted} />
                </TouchableOpacity>
              )}
            </Animated.View>

            {/* Hint */}
            <View style={styles.hintRow}>
              <Icon name="information-outline" size={13} color={C.textMuted} />
              <Text style={[styles.hintText, {color: C.textMuted}]}>
                {' '}Include the protocol. Example: https://api.example.com
              </Text>
            </View>

            {/* Current value badge */}
            {mmkv.getString(BACKEND_URL_KEY) && (
              <View
                style={[
                  styles.currentBadge,
                  {backgroundColor: C.elevated, borderColor: C.border},
                ]}>
                <Icon name="check-circle-outline" size={13} color={C.success} />
                <Text
                  style={[styles.currentText, {color: C.textSub}]}
                  numberOfLines={1}>
                  {' '}Active: {mmkv.getString(BACKEND_URL_KEY)}
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            {/* Save button */}
            <Animated.View style={btnStyle}>
              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel="Save server URL"
                style={{borderRadius: radius.lg, overflow: 'hidden'}}>
                <LinearGradient
                  colors={
                    isSaving
                      ? [C.textMuted, C.textMuted]
                      : ['#6366f1', '#4f46e5']
                  }
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={styles.saveBtn}>
                  <Icon
                    name={isSaving ? 'loading' : 'content-save'}
                    size={18}
                    color="#ffffff"
                    style={styles.saveBtnIcon}
                  />
                  <Text style={styles.saveBtnText}>
                    {isSaving ? 'Saving…' : 'Save & Apply'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {/* Reset to default */}
            <TouchableOpacity
              onPress={handleReset}
              style={[
                styles.resetBtn,
                {borderColor: C.border, backgroundColor: C.elevated},
              ]}
              accessibilityRole="button"
              accessibilityLabel="Reset to default URL">
              <Icon name="restore" size={16} color={C.textSub} />
              <Text style={[styles.resetBtnText, {color: C.textSub}]}>
                {' '}Reset to Default
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Info card */}
          <Animated.View
            entering={FadeInUp.duration(400).delay(350)}
            style={[
              styles.infoCard,
              {backgroundColor: C.elevated, borderColor: C.border},
            ]}>
            <Icon
              name="shield-lock-outline"
              size={16}
              color={C.warning}
              style={styles.infoIcon}
            />
            <Text style={[styles.infoText, {color: C.textSub}]}>
              Only change this if you are running a self-hosted instance.
              The default URL points to the official OsaTech cloud.
            </Text>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {flex: 1},
  flex: {flex: 1},

  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.s6,
    paddingTop: spacing.s8,
    paddingBottom: spacing.s12,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.s6,
    gap: spacing.s4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  headerSub: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.regular,
  },

  // Card
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.s6,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
    marginBottom: spacing.s4,
  },

  // Field label
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.s3,
  },
  labelText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },

  // Input
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.s4,
    height: 52,
  },
  inputIcon: {
    marginRight: spacing.s3,
  },
  input: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.regular,
    paddingVertical: 0,
  },

  // Hint
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.s2,
    paddingHorizontal: spacing.s1,
  },
  hintText: {
    fontSize: FontSizes.xs,
    flex: 1,
  },

  // Current badge
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingVertical: spacing.s2,
    paddingHorizontal: spacing.s3,
    marginTop: spacing.s3,
  },
  currentText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
    flex: 1,
  },

  // Divider
  divider: {
    height: 1,
    marginVertical: spacing.s5,
    opacity: 0.12,
    backgroundColor: '#ffffff',
  },

  // Save button
  saveBtn: {
    height: 52,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnIcon: {
    marginRight: spacing.s2,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    letterSpacing: 0.3,
  },

  // Reset button
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.s3,
  },
  resetBtnText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },

  // Info card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.s4,
  },
  infoIcon: {
    marginTop: 1,
    marginRight: spacing.s2,
  },
  infoText: {
    fontSize: FontSizes.xs,
    lineHeight: 18,
    flex: 1,
  },
});
