/**
 * SplashScreen.tsx
 *
 * Animated splash screen shown while loading auth state.
 * Renders a pulsing gradient logo with a subtle entrance animation,
 * then fades the entire screen out when `onReady` signals completion.
 *
 * Usage — call `onReady()` from AppNavigator once auth state resolves.
 * The screen plays a 300 ms fade-out before handing off.
 *
 * Dependencies:
 *   react-native-reanimated      — entrance + fade-out animation
 *   react-native-linear-gradient — logo circle gradient
 *   react-native-vector-icons    — POS icon
 */

import React, {useCallback, useEffect} from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {DARK_COLORS, LIGHT_COLORS} from '@/theme/colors';
import {FontSizes, FontWeights} from '@/theme/typography';
import {spacing, radius} from '@/theme/spacing';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SplashScreenProps {
  /**
   * Called by the parent after auth state resolves.
   * The splash plays a short fade-out, then invokes the callback
   * so the parent can unmount / switch navigators.
   */
  onReady?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SplashScreen({onReady}: SplashScreenProps) {
  const isDark = useColorScheme() !== 'light';
  const C = isDark ? DARK_COLORS : LIGHT_COLORS;

  // Shared values ──────────────────────────────────────────────────────────────

  /** Fade out the whole screen when dismissing */
  const screenOpacity = useSharedValue(1);

  /** Subtle pulse scale on the logo ring */
  const ringScale = useSharedValue(1);

  /** Glow opacity behind the logo */
  const glowOpacity = useSharedValue(0.3);

  // Animations ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Continuous subtle pulse: scale 1 → 1.06 → 1, period ~2 s
    ringScale.value = withRepeat(
      withSequence(
        withTiming(1.06, {duration: 900, easing: Easing.inOut(Easing.ease)}),
        withTiming(1.0, {duration: 900, easing: Easing.inOut(Easing.ease)}),
      ),
      -1,   // infinite
      false, // no reverse (the sequence handles both directions)
    );

    // Matching glow pulse
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.55, {duration: 900, easing: Easing.inOut(Easing.ease)}),
        withTiming(0.25, {duration: 900, easing: Easing.inOut(Easing.ease)}),
      ),
      -1,
      false,
    );
  }, [ringScale, glowOpacity]);

  // Public dismiss API ─────────────────────────────────────────────────────────

  const dismiss = useCallback(() => {
    screenOpacity.value = withTiming(
      0,
      {duration: 320, easing: Easing.out(Easing.ease)},
      finished => {
        if (finished && onReady) {
          runOnJS(onReady)();
        }
      },
    );
  }, [screenOpacity, onReady]);

  // Auto-dismiss after a short grace period if parent doesn't call onReady
  // (failsafe — normally parent drives this)
  useEffect(() => {
    if (!onReady) {
      const id = setTimeout(dismiss, 2000);
      return () => clearTimeout(id);
    }
  }, [onReady, dismiss]);

  // Animated styles ────────────────────────────────────────────────────────────

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{scale: ringScale.value}],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // Render ─────────────────────────────────────────────────────────────────────

  return (
    <Animated.View style={[styles.root, {backgroundColor: C.bg}, screenStyle]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={C.bg}
      />

      {/* Content group fades in on mount */}
      <Animated.View
        entering={FadeIn.duration(500).delay(80)}
        style={styles.center}>

        {/* Glow halo behind logo */}
        <Animated.View
          style={[
            styles.glow,
            {backgroundColor: C.primary},
            glowStyle,
          ]}
        />

        {/* Pulsing logo ring */}
        <Animated.View style={ringStyle}>
          <LinearGradient
            colors={['#6366f1', '#8b5cf6']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.logoCircle}>
            <Icon name="point-of-sale" size={48} color="#ffffff" />
          </LinearGradient>
        </Animated.View>

        {/* App name + tagline */}
        <Animated.View
          entering={FadeIn.duration(500).delay(300)}
          style={styles.textGroup}>
          <Text style={[styles.appName, {color: C.text}]}>OsaTech POS</Text>
          <Text style={[styles.tagline, {color: C.textSub}]}>
            Admin Control Center
          </Text>
        </Animated.View>

        {/* Loading dots */}
        <Animated.View
          entering={FadeIn.duration(400).delay(500)}
          style={styles.dotsRow}>
          <LoadingDot delay={0} color={C.primary} />
          <LoadingDot delay={160} color={C.primary} />
          <LoadingDot delay={320} color={C.primary} />
        </Animated.View>
      </Animated.View>

      {/* Version footer */}
      <Animated.View
        entering={FadeIn.duration(400).delay(600)}
        style={styles.footer}>
        <Text style={[styles.footerText, {color: C.textMuted}]}>
          OsaTech &copy; {new Date().getFullYear()}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Loading Dot ─────────────────────────────────────────────────────────────

function LoadingDot({delay, color}: {delay: number; color: string}) {
  const dotOpacity = useSharedValue(0.25);

  useEffect(() => {
    dotOpacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, {duration: 420, easing: Easing.inOut(Easing.ease)}),
          withTiming(0.25, {duration: 420, easing: Easing.inOut(Easing.ease)}),
        ),
        -1,
        false,
      ),
    );
  }, [dotOpacity, delay]);

  const dotStyle = useAnimatedStyle(() => ({opacity: dotOpacity.value}));

  return (
    <Animated.View
      style={[styles.dot, {backgroundColor: color}, dotStyle]}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  center: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },

  // Glow halo
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: radius.full,
    // blur is approximated via large shadow radius on RN
    shadowColor: '#6366f1',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 1,
    shadowRadius: 60,
    elevation: 0,
  },

  // Logo
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },

  // Text
  textGroup: {
    alignItems: 'center',
    marginTop: spacing.s6,
    marginBottom: spacing.s8,
  },
  appName: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    letterSpacing: -0.5,
    marginBottom: spacing.s1,
  },
  tagline: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    letterSpacing: 0.2,
  },

  // Loading dots
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
  },

  // Footer
  footer: {
    paddingBottom: spacing.s8,
  },
  footerText: {
    fontSize: FontSizes.xs,
  },
});
