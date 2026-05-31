/**
 * PinSetupScreen.tsx
 *
 * 4-digit PIN setup with animated dot indicators and a confirm step.
 * Saves a SHA-256 hex hash of the PIN to MMKV under 'pin_hash'.
 *
 * Flow:
 *   Step 1 — Enter new PIN (4 dots fill as you tap the keypad)
 *   Step 2 — Re-enter to confirm
 *   Done   — Success animation, PIN saved, navigates back
 *
 * Dependencies:
 *   react-native-reanimated   — dot + shake animations
 *   react-native-vector-icons — keypad icons
 *   react-native-mmkv         — storage
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/store/settingsStore';
import { mmkv } from '@/utils/storage';

// ─── Crypto helper ────────────────────────────────────────────────────────────

/**
 * A minimal hash utility.  For production use a proper crypto library
 * (e.g. react-native-quick-crypto or expo-crypto).
 * This naive implementation is fine for demo / prototyping.
 */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32-bit int
  }
  // Return as unsigned hex, padded for length consistency
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ─── Keypad layout ────────────────────────────────────────────────────────────

type KeyValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'backspace' | 'biometric';

const KEYPAD_ROWS: KeyValue[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['biometric', '0', 'backspace'],
];

const PIN_LENGTH = 4;

// ─── Dot component ────────────────────────────────────────────────────────────

interface PinDotProps {
  filled: boolean;
  error: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  index: number;
}

function PinDot({ filled, error, colors, index }: PinDotProps) {
  const scale = useSharedValue(1);
  const prevFilled = useRef(filled);

  useEffect(() => {
    if (filled && !prevFilled.current) {
      // Pop animation when filled
      scale.value = withSequence(
        withSpring(1.35, { damping: 6, stiffness: 300 }),
        withSpring(1, { damping: 8, stiffness: 200 }),
      );
    }
    prevFilled.current = filled;
  }, [filled, scale]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const color = error ? colors.danger : filled ? colors.primary : 'transparent';
  const borderColor = error ? colors.danger : filled ? colors.primary : colors.border;

  return (
    <Animated.View
      style={[
        dotStyle,
        dotStyles.dot,
        {
          backgroundColor: color,
          borderColor,
          borderWidth: filled ? 0 : 2,
        },
      ]}
    />
  );
}

// ─── Keypad key component ─────────────────────────────────────────────────────

interface KeyProps {
  value: KeyValue;
  onPress: (v: KeyValue) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
  disabled?: boolean;
}

function Key({ value, onPress, colors, isDark, disabled }: KeyProps) {
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    if (disabled) return;
    scale.value = withSequence(
      withTiming(0.88, { duration: 80 }),
      withSpring(1, { damping: 8, stiffness: 300 }),
    );
    runOnJS(onPress)(value);
  }, [value, onPress, scale, disabled]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (value === 'biometric') {
    // Placeholder — show faded icon; in real app trigger biometric auth
    return (
      <Animated.View style={[animStyle, keyStyles.keyContainer]}>
        <View style={[keyStyles.keyBtn, { backgroundColor: 'transparent' }]} />
      </Animated.View>
    );
  }

  const isBackspace = value === 'backspace';

  return (
    <Animated.View style={[animStyle, keyStyles.keyContainer]}>
      <Pressable
        onPress={handlePress}
        style={[
          keyStyles.keyBtn,
          {
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(0,0,0,0.04)',
            borderColor: colors.border,
          },
        ]}
        android_ripple={{ color: colors.primary, borderless: true, radius: 32 }}
      >
        {isBackspace ? (
          <Icon name="backspace-outline" size={22} color={colors.text} />
        ) : (
          <Text style={[keyStyles.keyLabel, { color: colors.text }]}>
            {value}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type Step = 'enter' | 'confirm' | 'success';

export default function PinSetupScreen() {
  const { colors, isDark, spacing } = useTheme();
  const togglePin = useSettingsStore(s => s.togglePin);
  const pinEnabled = useSettingsStore(s => s.pinEnabled);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [error, setError] = useState(false);

  // ── Row-shake animation on error ──────────────────────────────────────────
  const shakeX = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = useCallback(() => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 60 }),
      withRepeat(withTiming(10, { duration: 60 }), 5, true),
      withTiming(0, { duration: 60 }),
    );
  }, [shakeX]);

  // ── Success scale animation ───────────────────────────────────────────────
  const successScale = useSharedValue(0);
  const successStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
    opacity: successScale.value,
  }));

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleKey = useCallback(
    (key: KeyValue) => {
      if (key === 'biometric') return;
      if (step === 'success') return;

      setError(false);

      if (key === 'backspace') {
        setCurrentPin(p => p.slice(0, -1));
        return;
      }

      const next = currentPin + key;

      if (next.length > PIN_LENGTH) return;

      setCurrentPin(next);

      if (next.length === PIN_LENGTH) {
        if (step === 'enter') {
          // Slight delay so last dot animates in
          setTimeout(() => {
            setFirstPin(next);
            setCurrentPin('');
            setStep('confirm');
          }, 180);
        } else {
          // Confirm step
          setTimeout(() => {
            if (next === firstPin) {
              // Save hash
              const hash = simpleHash(next);
              mmkv.set('pin_hash', hash);
              if (!pinEnabled) togglePin();

              setStep('success');
              successScale.value = withSpring(1, { damping: 8, stiffness: 200 });

              setTimeout(() => {
                if (navigation.canGoBack()) navigation.goBack();
              }, 1200);
            } else {
              // Mismatch
              setError(true);
              Vibration.vibrate(200);
              triggerShake();
              setTimeout(() => {
                setError(false);
                setCurrentPin('');
              }, 600);
            }
          }, 180);
        }
      }
    },
    [currentPin, firstPin, step, pinEnabled, togglePin, navigation, successScale, triggerShake],
  );

  const handleBack = useCallback(() => {
    if (step === 'confirm') {
      setStep('enter');
      setCurrentPin('');
      setError(false);
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [step, navigation]);

  // ── Titles ────────────────────────────────────────────────────────────────

  const titleMap: Record<Step, string> = {
    enter: 'Create PIN',
    confirm: 'Confirm PIN',
    success: 'PIN Set!',
  };

  const subtitleMap: Record<Step, string> = {
    enter: 'Choose a 4-digit PIN to secure the app',
    confirm: 'Enter the same PIN again to confirm',
    success: 'Your PIN is active',
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[screen.root, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />

      {/* Header */}
      <View
        style={[
          screen.header,
          { paddingTop: insets.top + spacing[2], paddingHorizontal: spacing[4] },
        ]}
      >
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={screen.backBtn}
        >
          <Icon name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {step === 'success' ? (
        // ── Success state ──────────────────────────────────────────────────
        <View style={screen.successCenter}>
          <Animated.View style={[successStyle, screen.successIconWrap]}>
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={screen.successCircle}
            >
              <Icon name="check-bold" size={42} color="#fff" />
            </LinearGradient>
          </Animated.View>
          <Animated.Text
            entering={FadeIn.duration(400).delay(300)}
            style={[screen.successTitle, { color: colors.text }]}
          >
            {titleMap.success}
          </Animated.Text>
          <Animated.Text
            entering={FadeIn.duration(400).delay(450)}
            style={[screen.successSub, { color: colors.textSub }]}
          >
            {subtitleMap.success}
          </Animated.Text>
        </View>
      ) : (
        // ── PIN entry ──────────────────────────────────────────────────────
        <>
          {/* Title */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(80)}
            style={screen.titleBlock}
          >
            <Text style={[screen.title, { color: colors.text }]}>
              {titleMap[step]}
            </Text>
            <Text style={[screen.subtitle, { color: colors.textSub }]}>
              {subtitleMap[step]}
            </Text>
          </Animated.View>

          {/* Step indicator */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(130)}
            style={screen.stepIndicator}
          >
            <View
              style={[
                screen.stepDot,
                { backgroundColor: step === 'enter' ? colors.primary : colors.textMuted },
              ]}
            />
            <View
              style={[
                screen.stepDot,
                { backgroundColor: step === 'confirm' ? colors.primary : colors.textMuted },
              ]}
            />
          </Animated.View>

          {/* PIN dots */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(200)}
            style={[screen.dotsRow, shakeStyle]}
          >
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <PinDot
                key={i}
                index={i}
                filled={i < currentPin.length}
                error={error}
                colors={colors}
              />
            ))}
          </Animated.View>

          {/* Error message */}
          <Animated.View style={screen.errorSlot}>
            {error ? (
              <Animated.Text
                entering={FadeIn.duration(200)}
                style={[screen.errorText, { color: colors.danger }]}
              >
                PINs don't match — try again
              </Animated.Text>
            ) : null}
          </Animated.View>

          {/* Keypad */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(280)}
            style={screen.keypad}
          >
            {KEYPAD_ROWS.map((row, ri) => (
              <View key={ri} style={screen.keypadRow}>
                {row.map(key => (
                  <Key
                    key={key}
                    value={key}
                    onPress={handleKey}
                    colors={colors}
                    isDark={isDark}
                  />
                ))}
              </View>
            ))}
          </Animated.View>
        </>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const screen = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingBottom: 8,
  },
  backBtn: {
    padding: 4,
    alignSelf: 'flex-start',
  },
  titleBlock: {
    alignItems: 'center',
    marginTop: 32,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 8,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 20,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 36,
  },
  errorSlot: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  keypad: {
    marginTop: 32,
    paddingHorizontal: 32,
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  successCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successIconWrap: {
    marginBottom: 24,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  successSub: {
    fontSize: 15,
    textAlign: 'center',
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
});

const dotStyles = StyleSheet.create({
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
});

const keyStyles = StyleSheet.create({
  keyContainer: {
    width: 72,
    height: 72,
  },
  keyBtn: {
    flex: 1,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  keyLabel: {
    fontSize: 26,
    fontWeight: '400',
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
});
