/**
 * EditProfileScreen.tsx
 *
 * Edit user profile. Lets the admin update username and display name.
 * Calls a stubbed updateMe API and persists changes via authStore.setUser.
 *
 * Features:
 *  - Animated avatar with initials
 *  - Animated input focus borders
 *  - Inline validation (non-empty username)
 *  - Save button with loading spinner
 *  - Success toast on save
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';

import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';

// ─── API stub ─────────────────────────────────────────────────────────────────

interface UpdateMePayload {
  username?: string;
  displayName?: string;
}

/** Stub — replace with real API call from @/api/auth once endpoint exists */
async function updateMe(_payload: UpdateMePayload): Promise<void> {
  await new Promise(res => setTimeout(res, 900));
  // Uncomment when backend is ready:
  // await put('/api/auth/me', payload);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ─── Animated Input ───────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  icon: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  autoCapitalize?: 'none' | 'words' | 'sentences';
  returnKeyType?: 'next' | 'done';
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput>;
  error?: string;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}

function Field({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = 'none',
  returnKeyType = 'done',
  onSubmitEditing,
  inputRef,
  error,
  colors,
  isDark,
}: FieldProps) {
  const borderAnim = useSharedValue(0);
  const [focused, setFocused] = useState(false);

  const animBorder = useAnimatedStyle(() => ({
    borderColor: error
      ? colors.danger
      : borderAnim.value === 1
      ? colors.primary
      : colors.border,
    borderWidth: borderAnim.value === 1 ? 1.5 : 1,
  }));

  return (
    <View style={fieldStyles.wrapper}>
      <Text style={[fieldStyles.label, { color: colors.textSub }]}>{label}</Text>
      <Animated.View
        style={[
          fieldStyles.inputRow,
          { backgroundColor: isDark ? colors.elevated : colors.bg },
          animBorder,
        ]}
      >
        <Icon
          name={icon}
          size={18}
          color={focused ? colors.primary : colors.textMuted}
          style={fieldStyles.icon}
        />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={[fieldStyles.input, { color: colors.text }]}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => {
            setFocused(true);
            borderAnim.value = withTiming(1, { duration: 180 });
          }}
          onBlur={() => {
            setFocused(false);
            borderAnim.value = withTiming(0, { duration: 180 });
          }}
        />
      </Animated.View>
      {error ? (
        <Text style={[fieldStyles.errorText, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const { colors, isDark, spacing, radius } = useTheme();
  const { user } = useAuth();
  const setUser = useAuthStore(s => s.setUser);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState(user?.username ?? '');
  const [displayName, setDisplayName] = useState(
    (user as any)?.displayName ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ username?: string }>({});

  const displayNameRef = useRef<TextInput>(null);

  const initials = getInitials(username || 'Admin');

  // ── Validate ──────────────────────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    const errs: { username?: string } = {};
    if (!username.trim()) {
      errs.username = 'Username is required';
    } else if (username.trim().length < 3) {
      errs.username = 'At least 3 characters required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [username]);

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    if (saving) return;

    setSaving(true);
    try {
      await updateMe({
        username: username.trim(),
        displayName: displayName.trim() || undefined,
      });

      // Optimistically update local user state
      if (user) {
        setUser({
          ...user,
          username: username.trim(),
          // displayName is not in AdminUser type yet — cast for safety
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        } as any);
      }

      Toast.show({
        type: 'success',
        text1: 'Profile updated',
        text2: 'Your changes have been saved.',
      });

      if (navigation.canGoBack()) navigation.goBack();
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Save failed',
        text2: 'Could not update profile. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  }, [username, displayName, validate, saving, user, setUser, navigation]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[screen.root, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header ── */}
        <View
          style={[
            screen.header,
            {
              paddingTop: insets.top + spacing[2],
              paddingHorizontal: spacing[4],
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => navigation.canGoBack() && navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={screen.backBtn}
          >
            <Icon name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>

          <Text style={[screen.headerTitle, { color: colors.text }]}>
            Edit Profile
          </Text>

          {/* Save button in header */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[
              screen.saveBtn,
              { backgroundColor: saving ? colors.textMuted : colors.primary },
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={screen.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            screen.scroll,
            {
              paddingHorizontal: spacing[4],
              paddingTop: spacing[6],
              paddingBottom: insets.bottom + 80,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Avatar ── */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(80)}
            style={screen.avatarSection}
          >
            <View style={screen.avatarOuter}>
              <LinearGradient
                colors={['#6366f1', '#4f46e5']}
                style={screen.avatar}
              >
                <Text style={screen.avatarText}>{initials}</Text>
              </LinearGradient>
              {/* Camera badge */}
              <View
                style={[
                  screen.cameraBadge,
                  { backgroundColor: colors.primary, borderColor: colors.bg },
                ]}
              >
                <Icon name="camera-outline" size={13} color="#fff" />
              </View>
            </View>
            <Text style={[screen.changePhotoText, { color: colors.primary }]}>
              Change Photo
            </Text>
          </Animated.View>

          {/* ── Role badge (non-editable) ── */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(140)}
            style={[
              screen.roleBadgeRow,
              {
                backgroundColor: isDark
                  ? 'rgba(99,102,241,0.15)'
                  : 'rgba(79,70,229,0.08)',
                borderColor: isDark
                  ? 'rgba(99,102,241,0.25)'
                  : 'rgba(79,70,229,0.18)',
              },
            ]}
          >
            <Icon name="shield-account-outline" size={15} color={colors.primary} />
            <Text style={[screen.roleText, { color: colors.primary }]}>
              {(user?.role ?? 'admin').toUpperCase()}
            </Text>
            <Text style={[screen.roleSub, { color: colors.textMuted }]}>
              · Role cannot be changed here
            </Text>
          </Animated.View>

          {/* ── Fields ── */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(200)}
            style={screen.fields}
          >
            <Field
              label="Username"
              icon="account-outline"
              value={username}
              onChangeText={v => {
                setUsername(v);
                if (errors.username) setErrors(e => ({ ...e, username: undefined }));
              }}
              placeholder="e.g. admin_user"
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => displayNameRef.current?.focus()}
              error={errors.username}
              colors={colors}
              isDark={isDark}
            />

            <Field
              label="Display Name"
              icon="badge-account-outline"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g. Ahmad Raza"
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSave}
              inputRef={displayNameRef}
              colors={colors}
              isDark={isDark}
            />
          </Animated.View>

          {/* ── Info row ── */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(280)}
            style={[
              screen.infoRow,
              {
                backgroundColor: isDark
                  ? 'rgba(99,102,241,0.08)'
                  : 'rgba(79,70,229,0.05)',
                borderColor: colors.border,
              },
            ]}
          >
            <Icon name="information-outline" size={16} color={colors.textMuted} />
            <Text style={[screen.infoText, { color: colors.textMuted }]}>
              Username changes apply to your login credentials.
            </Text>
          </Animated.View>

          {/* ── Full-width Save button ── */}
          <Animated.View entering={FadeInDown.duration(500).delay(340)}>
            <Pressable onPress={handleSave} disabled={saving} style={{ borderRadius: 14, overflow: 'hidden' }}>
              <LinearGradient
                colors={saving ? [colors.textMuted, colors.textMuted] : ['#6366f1', '#4f46e5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={screen.saveFullBtn}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Icon name="content-save-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={screen.saveFullBtnText}>Save Changes</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const screen = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  scroll: {
    gap: 0,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarOuter: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  changePhotoText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
    marginBottom: 28,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  roleSub: {
    fontSize: 12,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  fields: {
    gap: 20,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  saveFullBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveFullBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
});

const fieldStyles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 2,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  errorText: {
    fontSize: 12,
    marginLeft: 2,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
});
