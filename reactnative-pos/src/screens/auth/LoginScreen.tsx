/**
 * LoginScreen.tsx
 *
 * Premium full-screen login for OsaTech POS Admin.
 * Design language: Revolut / Stripe / Linear — dark-first, glass-morphism card.
 *
 * Dependencies used:
 *   react-native-reanimated      — entrance animation
 *   react-native-linear-gradient — logo circle + sign-in button gradient
 *   react-native-vector-icons    — field icons + biometric icon
 *   react-native-biometrics      — optional fingerprint / face auth
 *   react-native-toast-message   — error/success toasts
 *   react-native-mmkv            — remember-me persistence
 *   zustand authStore            — login action
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeBiometrics, {BiometryTypes} from 'react-native-biometrics';
import Toast from 'react-native-toast-message';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {DARK_COLORS, LIGHT_COLORS} from '@/theme/colors';
import {spacing, radius} from '@/theme/spacing';
import {FontSizes, FontWeights} from '@/theme/typography';
import {useAuthStore} from '@/store/authStore';
import {mmkv} from '@/utils/storage';
import type {AuthStackParamList} from '@/navigation/AuthStack';
import {SCREENS} from '@/navigation/screens';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<AuthStackParamList, typeof SCREENS.LOGIN>;

const APP_VERSION = '1.0.0';

// ─── Animated Input Wrapper ───────────────────────────────────────────────────

interface InputFieldProps {
  iconName: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  onToggleSecure?: () => void;
  isPasswordField?: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  autoComplete?: 'username' | 'password' | 'off';
  textContentType?: 'username' | 'password' | 'none';
  returnKeyType?: 'next' | 'done' | 'go';
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput>;
  colors: typeof DARK_COLORS;
}

function InputField({
  iconName,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  onToggleSecure,
  isPasswordField = false,
  autoCapitalize = 'none',
  autoComplete = 'off',
  textContentType = 'none',
  returnKeyType = 'done',
  onSubmitEditing,
  inputRef,
  colors: C,
}: InputFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useSharedValue(0);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: borderAnim.value === 1 ? C.primary : C.border,
    borderWidth: borderAnim.value === 1 ? 1.5 : 1,
  }));

  return (
    <Animated.View
      style={[styles.inputWrapper, {backgroundColor: C.elevated}, borderStyle]}>
      <Icon
        name={iconName}
        size={20}
        color={focused ? C.primary : C.textMuted}
        style={styles.inputIcon}
      />
      <TextInput
        ref={inputRef}
        style={[styles.input, {color: C.text}]}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        textContentType={textContentType}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => {
          setFocused(true);
          borderAnim.value = withTiming(1, {duration: 200});
        }}
        onBlur={() => {
          setFocused(false);
          borderAnim.value = withTiming(0, {duration: 200});
        }}
      />
      {isPasswordField && (
        <TouchableOpacity
          onPress={onToggleSecure}
          hitSlop={{top: 12, bottom: 12, left: 8, right: 8}}>
          <Icon
            name={secureTextEntry ? 'eye-outline' : 'eye-off-outline'}
            size={20}
            color={C.textMuted}
          />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ─── LoginScreen ─────────────────────────────────────────────────────────────

export default function LoginScreen({navigation}: Props) {
  const isDark = useColorScheme() !== 'light';
  const C = isDark ? DARK_COLORS : LIGHT_COLORS;

  // ── Login mode: admin credentials OR store token ───────────────────────────
  const [loginMode, setLoginMode] = useState<'admin' | 'token'>('admin');

  // ── Form state ──────────────────────────────────────────────────────────────
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [storeToken, setStoreToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(
    () => mmkv.getBoolean('remember_me') ?? false,
  );

  // ── Biometric state ─────────────────────────────────────────────────────────
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState<string | null>(null);

  // ── Auth store ──────────────────────────────────────────────────────────────
  const login = useAuthStore(s => s.login);
  const isLoading = useAuthStore(s => s.isLoading);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const passwordRef = useRef<TextInput>(null);

  // ── Button press animation ──────────────────────────────────────────────────
  const btnScale = useSharedValue(1);
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{scale: btnScale.value}],
  }));

  // ── Load remembered credentials ─────────────────────────────────────────────
  useEffect(() => {
    if (rememberMe) {
      const savedUser = mmkv.getString('remembered_username') ?? '';
      if (savedUser) {
        setUsername(savedUser);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Check biometrics on mount ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const rnBiometrics = new ReactNativeBiometrics();
        const {available, biometryType: type} =
          await rnBiometrics.isSensorAvailable();
        setBiometricAvailable(available);
        setBiometryType(type ?? null);
      } catch {
        setBiometricAvailable(false);
      }
    })();
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleLogin = useCallback(async () => {
    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser || !trimmedPass) {
      Toast.show({
        type: 'error',
        text1: 'Missing fields',
        text2: 'Please enter both username and password.',
      });
      return;
    }

    btnScale.value = withSpring(0.96, {}, () => {
      btnScale.value = withSpring(1);
    });

    try {
      await login(trimmedUser, trimmedPass);

      // Persist username if remember-me is on
      mmkv.set('remember_me', rememberMe);
      if (rememberMe) {
        mmkv.set('remembered_username', trimmedUser);
      } else {
        mmkv.delete('remembered_username');
      }

      Toast.show({
        type: 'success',
        text1: 'Welcome back!',
        text2: 'Signed in successfully.',
      });
      // Navigation is handled by AppNavigator via isAuthenticated flag
    } catch {
      // Error message already in authStore; just show toast
      const msg =
        useAuthStore.getState().error ?? 'Login failed. Check your credentials.';
      Toast.show({
        type: 'error',
        text1: 'Sign in failed',
        text2: msg,
      });
    }
  }, [username, password, rememberMe, login, btnScale]);

  // ── Store-token login (store owner path) ───────────────────────────────────
  const handleTokenLogin = useCallback(async () => {
    const token = storeToken.trim();
    if (!token) {
      Toast.show({ type: 'error', text1: 'Token required', text2: 'Paste the token from your POS app Settings.' });
      return;
    }
    btnScale.value = withSpring(0.96, {}, () => { btnScale.value = withSpring(1); });
    try {
      // Validate the token locally by decoding it (JWT — three parts)
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid token format');
      const payload = JSON.parse(atob(parts[1]));
      if (payload.scope !== 'mobile') throw new Error('This token is not a mobile-access token');
      if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error('Token has expired. Go to POS → Settings → Get Mobile App Token to refresh it.');
      // Store the token and treat it as authenticated
      mmkv.set('admin_token', token);
      mmkv.set('mobile_instance_id', payload.instance_id ?? '');
      mmkv.set('mobile_store_name',  payload.store_name  ?? '');
      // Mark as authenticated in the auth store
      useAuthStore.setState({
        token,
        isAuthenticated: true,
        user: { id: 0, username: payload.store_name || payload.instance_id, role: 'store_owner' },
      });
      Toast.show({ type: 'success', text1: `Welcome, ${payload.store_name || 'Store Owner'}!`, text2: 'Signed in as store owner.' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Invalid token', text2: err?.message || 'Paste the correct token from your POS app.' });
    }
  }, [storeToken, btnScale]);

  const handleBiometric = useCallback(async () => {
    const savedUser = mmkv.getString('remembered_username');
    const savedPass = mmkv.getString('remembered_password');

    if (!savedUser || !savedPass) {
      Toast.show({
        type: 'info',
        text1: 'No saved credentials',
        text2: 'Sign in with your username and password first.',
      });
      return;
    }

    try {
      const rnBiometrics = new ReactNativeBiometrics();
      const {success} = await rnBiometrics.simplePrompt({
        promptMessage: 'Authenticate to continue',
        cancelButtonText: 'Cancel',
      });

      if (success) {
        await login(savedUser, savedPass);
        Toast.show({type: 'success', text1: 'Welcome back!'});
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Biometric failed',
        text2: 'Please use your password instead.',
      });
    }
  }, [login]);

  const biometricIconName =
    biometryType === BiometryTypes.FaceID ? 'face-recognition' : 'fingerprint';

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, {backgroundColor: C.bg}]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={C.bg}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* ── Logo + Title ── */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(100)}
            style={styles.header}>
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.logoCircle}>
              <Icon name="point-of-sale" size={40} color="#ffffff" />
            </LinearGradient>

            <Text style={[styles.appName, {color: C.text}]}>OsaTech POS</Text>
            <Text style={[styles.appSub, {color: C.textSub}]}>
              Admin Control Center
            </Text>
          </Animated.View>

          {/* ── Glass Card ── */}
          <Animated.View
            entering={FadeInUp.duration(600).delay(250)}
            style={[
              styles.card,
              {
                backgroundColor: isDark
                  ? 'rgba(17, 17, 24, 0.85)'
                  : 'rgba(255, 255, 255, 0.90)',
                borderColor: C.border,
              },
            ]}>

            {/* ── Mode switcher ── */}
            <View style={{flexDirection:'row', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: radius.md, padding: 3, marginBottom: 18}}>
              {(['admin','token'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setLoginMode(m)}
                  style={{flex:1, paddingVertical:7, borderRadius:radius.sm-2, backgroundColor: loginMode===m ? C.primary : 'transparent', alignItems:'center'}}>
                  <Text style={{fontSize:FontSizes.xs, fontWeight: loginMode===m ? FontWeights.bold : FontWeights.medium, color: loginMode===m ? '#fff' : C.textSub}}>
                    {m === 'admin' ? '🔑  Admin Login' : '🏪  Store Token'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {loginMode === 'admin' ? (
              <>
                {/* Username */}
                <InputField
                  iconName="account-outline"
                  placeholder="Username"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoComplete="username"
                  textContentType="username"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  colors={C}
                />
                <View style={styles.fieldGap} />
                {/* Password */}
                <InputField
                  iconName="lock-outline"
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  isPasswordField
                  onToggleSecure={() => setShowPassword(v => !v)}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  inputRef={passwordRef}
                  colors={C}
                />
                {/* Remember me */}
                <View style={styles.rememberRow}>
                  <Text style={[styles.rememberText, {color: C.textSub}]}>Remember me</Text>
                  <Switch value={rememberMe} onValueChange={v => { setRememberMe(v); mmkv.set('remember_me', v); }}
                    trackColor={{false: C.border, true: C.primary}} thumbColor={rememberMe ? '#ffffff' : C.textMuted} />
                </View>
              </>
            ) : (
              <>
                {/* Store token input */}
                <Text style={{color: C.textSub, fontSize: FontSizes.xs, marginBottom: 8, lineHeight: 16}}>
                  Paste the token from{'\n'}POS App → Settings → Get Mobile App Token
                </Text>
                <InputField
                  iconName="key-variant"
                  placeholder="Paste your store token here…"
                  value={storeToken}
                  onChangeText={setStoreToken}
                  autoCapitalize="none"
                  autoComplete="off"
                  textContentType="none"
                  returnKeyType="done"
                  onSubmitEditing={handleTokenLogin}
                  colors={C}
                />
              </>
            )}

            <View style={styles.fieldGap} />

            {/* Sign In button */}
            <Animated.View style={btnStyle}>
              <Pressable
                onPress={loginMode === 'admin' ? handleLogin : handleTokenLogin}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                style={{borderRadius: radius.lg, overflow: 'hidden'}}>
                <LinearGradient
                  colors={
                    isLoading
                      ? [C.textMuted, C.textMuted]
                      : loginMode === 'token'
                        ? ['#7c3aed', '#6d28d9']
                        : ['#6366f1', '#4f46e5']
                  }
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={styles.signInBtn}>
                  {isLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.signInBtnText}>
                      {loginMode === 'token' ? 'Sign In as Store' : 'Sign In'}
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {/* Biometric button */}
            {biometricAvailable && (
              <Animated.View entering={FadeIn.duration(400).delay(500)}>
                <TouchableOpacity
                  onPress={handleBiometric}
                  style={[
                    styles.biometricBtn,
                    {borderColor: C.border, backgroundColor: C.elevated},
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in with biometrics">
                  <Icon name={biometricIconName} size={22} color={C.primary} />
                  <Text style={[styles.biometricText, {color: C.textSub}]}>
                    {biometryType === BiometryTypes.FaceID
                      ? 'Sign in with Face ID'
                      : 'Sign in with Fingerprint'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Configure Server link */}
            <TouchableOpacity
              onPress={() =>
                (navigation as any).navigate(SCREENS.SERVER_CONFIG)
              }
              style={styles.serverLink}
              accessibilityRole="link"
              accessibilityLabel="Configure server URL">
              <Icon name="server-network" size={13} color={C.textMuted} />
              <Text style={[styles.serverLinkText, {color: C.textMuted}]}>
                {' '}Configure Server
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Footer ── */}
          <Animated.View
            entering={FadeIn.duration(400).delay(600)}
            style={styles.footer}>
            <Text style={[styles.footerText, {color: C.textMuted}]}>
              v{APP_VERSION} · OsaTech &copy; {new Date().getFullYear()}
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.s6,
    paddingVertical: spacing.s12,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: spacing.s8,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.s4,
    shadowColor: '#6366f1',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  appName: {
    fontSize: FontSizes['2xl'],
    fontWeight: FontWeights.bold,
    letterSpacing: -0.5,
    marginBottom: spacing.s1,
  },
  appSub: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    letterSpacing: 0.2,
  },

  // Card
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.s6,
    // subtle glass shadow
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
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
    fontSize: FontSizes.base,
    fontWeight: FontWeights.regular,
    paddingVertical: 0,
  },

  fieldGap: {height: spacing.s3},

  // Remember me
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.s4,
    marginBottom: spacing.s2,
  },
  rememberText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },

  // Sign In button
  signInBtn: {
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInBtnText: {
    color: '#ffffff',
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    letterSpacing: 0.3,
  },

  // Biometric
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.s3,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  biometricText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    marginLeft: spacing.s2,
  },

  // Server link
  serverLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.s5,
  },
  serverLinkText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
  },

  // Footer
  footer: {
    marginTop: spacing.s8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: FontSizes.xs,
  },
});
