/**
 * SettingsScreen.tsx
 *
 * Premium settings screen for OsaTech POS Admin.
 * Design: Revolut/Stripe/Linear — dark-first, grouped sections with rich row items.
 *
 * Sections:
 *  1. Profile Card  — avatar + username + role badge, tappable
 *  2. Business      — business name, backend URL, app version
 *  3. Appearance    — theme (segmented), language (segmented)
 *  4. Security      — biometric toggle, PIN lock, change password, auto-lock
 *  5. Notifications — master + individual toggles
 *  6. Data          — sync interval, clear cache
 *  7. Danger Zone   — logout (red)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInRight,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeBiometrics from 'react-native-biometrics';
import LinearGradient from 'react-native-linear-gradient';

import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useSettingsStore, Theme, Language } from '@/store/settingsStore';
import { mmkv } from '@/utils/storage';
import { SCREENS } from '@/navigation/screens';
import type { SettingsStackParamList } from '@/navigation/MainNavigator';

type NavProp = NativeStackNavigationProp<SettingsStackParamList, typeof SCREENS.SETTINGS>;

const APP_VERSION = '1.0.0';

// ─── Auto-lock options ────────────────────────────────────────────────────────

type AutoLockValue = 'never' | '1min' | '5min' | '15min';

const AUTO_LOCK_OPTIONS: { label: string; value: AutoLockValue }[] = [
  { label: 'Never', value: 'never' },
  { label: '1 min', value: '1min' },
  { label: '5 min', value: '5min' },
  { label: '15 min', value: '15min' },
];

// ─── Sync interval options ────────────────────────────────────────────────────

type SyncIntervalValue = '1min' | '5min' | '15min' | '30min' | 'manual';

const SYNC_INTERVAL_OPTIONS: { label: string; value: SyncIntervalValue }[] = [
  { label: '1 min', value: '1min' },
  { label: '5 min', value: '5min' },
  { label: '15 min', value: '15min' },
  { label: '30 min', value: '30min' },
  { label: 'Manual', value: 'manual' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  colors: ReturnType<typeof useTheme>['colors'];
}

function SectionHeader({ title, colors }: SectionHeaderProps) {
  return (
    <Text style={[sStyles.sectionLabel, { color: colors.textMuted }]}>
      {title.toUpperCase()}
    </Text>
  );
}

interface SectionCardProps {
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}

function SectionCard({ children, colors, isDark }: SectionCardProps) {
  return (
    <View
      style={[
        sStyles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          ...Platform.select({
            android: { elevation: isDark ? 4 : 2 },
            ios: {
              shadowColor: isDark ? '#000' : '#1a1a2e',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.3 : 0.08,
              shadowRadius: 8,
            },
          }),
        },
      ]}
    >
      {children}
    </View>
  );
}

interface RowDividerProps {
  colors: ReturnType<typeof useTheme>['colors'];
}

function RowDivider({ colors }: RowDividerProps) {
  return (
    <View
      style={[sStyles.rowDivider, { backgroundColor: colors.border }]}
    />
  );
}

interface SettingRowProps {
  icon: string;
  iconColor?: string;
  iconBg?: string;
  label: string;
  sublabel?: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  isLast?: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
  danger?: boolean;
}

function SettingRow({
  icon,
  iconColor,
  iconBg,
  label,
  sublabel,
  value,
  onPress,
  right,
  isLast,
  colors,
  isDark,
  danger,
}: SettingRowProps) {
  const resolvedIconColor = iconColor ?? colors.primary;
  const resolvedIconBg = iconBg ?? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(79,70,229,0.10)');

  const content = (
    <View style={sStyles.rowInner}>
      {/* Icon */}
      <View style={[sStyles.iconWrap, { backgroundColor: resolvedIconBg }]}>
        <Icon name={icon} size={20} color={resolvedIconColor} />
      </View>

      {/* Label group */}
      <View style={sStyles.rowText}>
        <Text
          style={[
            sStyles.rowLabel,
            { color: danger ? colors.danger : colors.text },
          ]}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text style={[sStyles.rowSublabel, { color: colors.textSub }]}>
            {sublabel}
          </Text>
        ) : null}
      </View>

      {/* Right slot */}
      <View style={sStyles.rowRight}>
        {right ?? (
          <>
            {value ? (
              <Text
                style={[sStyles.rowValue, { color: colors.textSub }]}
                numberOfLines={1}
              >
                {value}
              </Text>
            ) : null}
            {onPress ? (
              <Icon
                name="chevron-right"
                size={18}
                color={colors.textMuted}
                style={{ marginLeft: 4 }}
              />
            ) : null}
          </>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.65}
          style={sStyles.rowOuter}
        >
          {content}
        </TouchableOpacity>
        {!isLast && <RowDivider colors={colors} />}
      </>
    );
  }

  return (
    <>
      <View style={sStyles.rowOuter}>{content}</View>
      {!isLast && <RowDivider colors={colors} />}
    </>
  );
}

// ─── Segmented Control ────────────────────────────────────────────────────────

interface SegmentOption<T extends string> {
  label: string;
  value: T;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  selected: T;
  onChange: (v: T) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}

function SegmentedControl<T extends string>({
  options,
  selected,
  onChange,
  colors,
  isDark,
}: SegmentedControlProps<T>) {
  return (
    <View
      style={[
        segStyles.track,
        { backgroundColor: isDark ? colors.elevated : colors.bg, borderColor: colors.border },
      ]}
    >
      {options.map((opt, idx) => {
        const isActive = opt.value === selected;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
            style={[
              segStyles.segment,
              isActive && {
                backgroundColor: colors.primary,
              },
              idx === 0 && segStyles.segFirst,
              idx === options.length - 1 && segStyles.segLast,
            ]}
          >
            <Text
              style={[
                segStyles.segText,
                {
                  color: isActive ? colors.primaryFg : colors.textSub,
                  fontWeight: isActive ? '600' : '400',
                },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Select Modal ─────────────────────────────────────────────────────────────

interface SelectOption<T extends string> {
  label: string;
  value: T;
}

interface SelectModalProps<T extends string> {
  visible: boolean;
  title: string;
  options: SelectOption<T>[];
  selected: T;
  onSelect: (v: T) => void;
  onClose: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}

function SelectModal<T extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  colors,
  isDark,
}: SelectModalProps<T>) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={mStyles.overlay} onPress={onClose} />
      <View
        style={[
          mStyles.sheet,
          {
            backgroundColor: colors.elevated,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={mStyles.handle} />
        <Text style={[mStyles.title, { color: colors.text }]}>{title}</Text>
        {options.map(opt => {
          const isActive = opt.value === selected;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => {
                onSelect(opt.value);
                onClose();
              }}
              activeOpacity={0.7}
              style={[
                mStyles.option,
                isActive && { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(79,70,229,0.08)' },
              ]}
            >
              <Text
                style={[
                  mStyles.optionLabel,
                  { color: isActive ? colors.primary : colors.text },
                ]}
              >
                {opt.label}
              </Text>
              {isActive && (
                <Icon name="check-circle" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity onPress={onClose} style={[mStyles.cancelBtn, { borderColor: colors.border }]}>
          <Text style={[mStyles.cancelText, { color: colors.textSub }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Backend URL Modal ────────────────────────────────────────────────────────

interface BackendUrlModalProps {
  visible: boolean;
  current: string;
  onSave: (url: string) => void;
  onClose: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}

function BackendUrlModal({
  visible,
  current,
  onSave,
  onClose,
  colors,
  isDark,
}: BackendUrlModalProps) {
  const [url, setUrl] = useState(current);

  useEffect(() => {
    if (visible) setUrl(current);
  }, [visible, current]);

  const handleSave = () => {
    const trimmed = url.trim().replace(/\/$/, '');
    if (!trimmed) return;
    onSave(trimmed);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={mStyles.overlay} onPress={onClose} />
      <View style={[urlStyles.dialog, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
        <Text style={[urlStyles.title, { color: colors.text }]}>Backend Server URL</Text>
        <Text style={[urlStyles.hint, { color: colors.textSub }]}>
          Enter the base URL for the OsaTech cloud API.
        </Text>
        <View style={[urlStyles.inputWrap, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Icon name="server-network" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://osatechcloud.cloud"
            placeholderTextColor={colors.textMuted}
            style={[urlStyles.input, { color: colors.text }]}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
        </View>
        <View style={urlStyles.btnRow}>
          <TouchableOpacity
            onPress={onClose}
            style={[urlStyles.btn, { borderColor: colors.border, borderWidth: 1 }]}
          >
            <Text style={[urlStyles.btnText, { color: colors.textSub }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            style={{ flex: 1 }}
          >
            <LinearGradient
              colors={['#6366f1', '#4f46e5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={urlStyles.btn}
            >
              <Text style={[urlStyles.btnText, { color: '#fff', fontWeight: '600' }]}>Save</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { colors, isDark, spacing, radius } = useTheme();
  const { user, logout } = useAuth();
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();

  // ── Settings store ──────────────────────────────────────────────────────────
  const theme = useSettingsStore(s => s.theme);
  const language = useSettingsStore(s => s.language);
  const biometricEnabled = useSettingsStore(s => s.biometricEnabled);
  const pinEnabled = useSettingsStore(s => s.pinEnabled);
  const backendUrl = useSettingsStore(s => s.backendUrl);
  const notificationsEnabled = useSettingsStore(s => s.notificationsEnabled);

  const setTheme = useSettingsStore(s => s.setTheme);
  const setLanguage = useSettingsStore(s => s.setLanguage);
  const toggleBiometric = useSettingsStore(s => s.toggleBiometric);
  const togglePin = useSettingsStore(s => s.togglePin);
  const setBackendUrl = useSettingsStore(s => s.setBackendUrl);
  const toggleNotifications = useSettingsStore(s => s.toggleNotifications);

  // ── Local state ─────────────────────────────────────────────────────────────
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [autoLock, setAutoLock] = useState<AutoLockValue>(
    () => (mmkv.getString('settings_autolock') as AutoLockValue | undefined) ?? 'never',
  );
  const [syncInterval, setSyncInterval] = useState<SyncIntervalValue>(
    () => (mmkv.getString('settings_sync_interval') as SyncIntervalValue | undefined) ?? '5min',
  );
  const [lowStockAlerts, setLowStockAlerts] = useState(
    () => mmkv.getBoolean('notif_low_stock') ?? true,
  );
  const [licenseExpiry, setLicenseExpiry] = useState(
    () => mmkv.getBoolean('notif_license_expiry') ?? true,
  );
  const [dailySummary, setDailySummary] = useState(
    () => mmkv.getBoolean('notif_daily_summary') ?? false,
  );
  const [paymentReminders, setPaymentReminders] = useState(
    () => mmkv.getBoolean('notif_payment_reminders') ?? true,
  );

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [showAutoLock, setShowAutoLock] = useState(false);
  const [showSyncInterval, setShowSyncInterval] = useState(false);
  const [showBackendModal, setShowBackendModal] = useState(false);

  // ── Check biometric availability ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const rnBiometrics = new ReactNativeBiometrics();
        const { available } = await rnBiometrics.isSensorAvailable();
        setBiometricAvailable(available);
      } catch {
        setBiometricAvailable(false);
      }
    })();
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleAutoLockChange = useCallback((v: AutoLockValue) => {
    setAutoLock(v);
    mmkv.set('settings_autolock', v);
  }, []);

  const handleSyncIntervalChange = useCallback((v: SyncIntervalValue) => {
    setSyncInterval(v);
    mmkv.set('settings_sync_interval', v);
  }, []);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Clear Cache',
      'This will clear all locally cached data. The app will re-sync from the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            // Clear only cache keys, not auth/settings
            const cacheKeys = [
              'cache_dashboard',
              'cache_inventory',
              'cache_customers',
              'cache_vendors',
              'cache_reports',
            ];
            cacheKeys.forEach(k => mmkv.delete(k));
            Alert.alert('Cache Cleared', 'All cached data has been removed.');
          },
        },
      ],
    );
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out from this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ],
    );
  }, [logout]);

  const handleToggleLowStock = useCallback((v: boolean) => {
    setLowStockAlerts(v);
    mmkv.set('notif_low_stock', v);
  }, []);

  const handleToggleLicenseExpiry = useCallback((v: boolean) => {
    setLicenseExpiry(v);
    mmkv.set('notif_license_expiry', v);
  }, []);

  const handleToggleDailySummary = useCallback((v: boolean) => {
    setDailySummary(v);
    mmkv.set('notif_daily_summary', v);
  }, []);

  const handleTogglePaymentReminders = useCallback((v: boolean) => {
    setPaymentReminders(v);
    mmkv.set('notif_payment_reminders', v);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const initials = getInitials(user?.username ?? 'Admin');

  const autoLockLabel =
    AUTO_LOCK_OPTIONS.find(o => o.value === autoLock)?.label ?? 'Never';

  const syncIntervalLabel =
    SYNC_INTERVAL_OPTIONS.find(o => o.value === syncInterval)?.label ?? '5 min';

  const switchTrack = { false: colors.border, true: colors.primary };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + spacing[4],
            paddingBottom: insets.bottom + 100,
            paddingHorizontal: spacing[4],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Page title ── */}
        <Animated.Text
          entering={FadeInDown.duration(500).delay(50)}
          style={[styles.pageTitle, { color: colors.text }]}
        >
          Settings
        </Animated.Text>

        {/* ── 1. Profile Card ── */}
        <Animated.View entering={FadeInDown.duration(500).delay(100)}>
          <TouchableOpacity
            onPress={() => navigation.navigate(SCREENS.PROFILE as any)}
            activeOpacity={0.75}
            style={[
              styles.profileCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                ...Platform.select({
                  android: { elevation: isDark ? 6 : 3 },
                  ios: {
                    shadowColor: isDark ? '#000' : '#1a1a2e',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isDark ? 0.35 : 0.10,
                    shadowRadius: 12,
                  },
                }),
              },
            ]}
          >
            {/* Gradient strip */}
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileGradientStrip}
            />

            <View style={styles.profileBody}>
              {/* Avatar */}
              <LinearGradient
                colors={['#6366f1', '#4f46e5']}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{initials}</Text>
              </LinearGradient>

              {/* Info */}
              <View style={{ flex: 1, marginLeft: spacing[3] }}>
                <Text style={[styles.profileName, { color: colors.text }]}>
                  {user?.username ?? 'Admin'}
                </Text>
                {user?.email ? (
                  <Text style={[styles.profileSub, { color: colors.textSub }]}>
                    {user.email}
                  </Text>
                ) : null}
                {/* Role badge */}
                <View
                  style={[
                    styles.roleBadge,
                    {
                      backgroundColor: isDark
                        ? 'rgba(99,102,241,0.18)'
                        : 'rgba(79,70,229,0.10)',
                    },
                  ]}
                >
                  <Text style={[styles.roleBadgeText, { color: colors.primary }]}>
                    {(user?.role ?? 'admin').toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Edit chevron */}
              <View style={styles.editChevron}>
                <Text style={[styles.editLabel, { color: colors.textSub }]}>Edit</Text>
                <Icon name="chevron-right" size={18} color={colors.textMuted} />
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* ── 2. Business ── */}
        <Animated.View entering={FadeInDown.duration(500).delay(160)}>
          <SectionHeader title="Business" colors={colors} />
          <SectionCard colors={colors} isDark={isDark}>
            <SettingRow
              icon="store-outline"
              label="Business Name"
              value="OsaTech POS"
              colors={colors}
              isDark={isDark}
            />
            <RowDivider colors={colors} />
            <SettingRow
              icon="server-network"
              label="Backend Server URL"
              value={
                backendUrl.replace('https://', '').replace('http://', '')
              }
              onPress={() => setShowBackendModal(true)}
              colors={colors}
              isDark={isDark}
            />
            <RowDivider colors={colors} />
            <SettingRow
              icon="information-outline"
              label="App Version"
              value={`v${APP_VERSION}`}
              colors={colors}
              isDark={isDark}
              isLast
            />
          </SectionCard>
        </Animated.View>

        {/* ── 3. Appearance ── */}
        <Animated.View entering={FadeInDown.duration(500).delay(220)}>
          <SectionHeader title="Appearance" colors={colors} />
          <SectionCard colors={colors} isDark={isDark}>
            {/* Theme row */}
            <View style={sStyles.rowOuter}>
              <View style={sStyles.rowInner}>
                <View
                  style={[
                    sStyles.iconWrap,
                    { backgroundColor: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(124,58,237,0.10)' },
                  ]}
                >
                  <Icon name="theme-light-dark" size={20} color={colors.accent} />
                </View>
                <View style={sStyles.rowText}>
                  <Text style={[sStyles.rowLabel, { color: colors.text }]}>Theme</Text>
                </View>
              </View>
              <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
                <SegmentedControl<Theme>
                  options={[
                    { label: 'Dark', value: 'dark' },
                    { label: 'Light', value: 'light' },
                    { label: 'System', value: 'system' },
                  ]}
                  selected={theme}
                  onChange={setTheme}
                  colors={colors}
                  isDark={isDark}
                />
              </View>
            </View>
            <RowDivider colors={colors} />
            {/* Language row */}
            <View style={sStyles.rowOuter}>
              <View style={sStyles.rowInner}>
                <View
                  style={[
                    sStyles.iconWrap,
                    { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(5,150,105,0.10)' },
                  ]}
                >
                  <Icon name="translate" size={20} color={colors.success} />
                </View>
                <View style={sStyles.rowText}>
                  <Text style={[sStyles.rowLabel, { color: colors.text }]}>Language</Text>
                </View>
              </View>
              <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
                <SegmentedControl<Language>
                  options={[
                    { label: 'English', value: 'en' },
                    { label: 'اردو', value: 'ur' },
                  ]}
                  selected={language}
                  onChange={setLanguage}
                  colors={colors}
                  isDark={isDark}
                />
              </View>
            </View>
          </SectionCard>
        </Animated.View>

        {/* ── 4. Security ── */}
        <Animated.View entering={FadeInDown.duration(500).delay(280)}>
          <SectionHeader title="Security" colors={colors} />
          <SectionCard colors={colors} isDark={isDark}>
            {/* Biometric */}
            {biometricAvailable && (
              <>
                <SettingRow
                  icon="fingerprint"
                  iconColor={colors.success}
                  iconBg={isDark ? 'rgba(16,185,129,0.15)' : 'rgba(5,150,105,0.10)'}
                  label="Biometric Login"
                  sublabel="Use fingerprint or face ID"
                  right={
                    <Switch
                      value={biometricEnabled}
                      onValueChange={toggleBiometric}
                      trackColor={switchTrack}
                      thumbColor={biometricEnabled ? '#fff' : colors.textMuted}
                    />
                  }
                  colors={colors}
                  isDark={isDark}
                />
                <RowDivider colors={colors} />
              </>
            )}

            {/* PIN Lock */}
            <SettingRow
              icon="lock-outline"
              iconColor={colors.warning}
              iconBg={isDark ? 'rgba(245,158,11,0.15)' : 'rgba(217,119,6,0.10)'}
              label="PIN Lock"
              sublabel={pinEnabled ? 'Active — tap to manage' : 'Set a 4-digit PIN'}
              onPress={() => navigation.navigate(SCREENS.SECURITY_SETTINGS as any)}
              right={
                <Switch
                  value={pinEnabled}
                  onValueChange={() => {
                    if (!pinEnabled) {
                      navigation.navigate(SCREENS.SECURITY_SETTINGS as any);
                    } else {
                      togglePin();
                    }
                  }}
                  trackColor={switchTrack}
                  thumbColor={pinEnabled ? '#fff' : colors.textMuted}
                />
              }
              colors={colors}
              isDark={isDark}
            />
            <RowDivider colors={colors} />

            {/* Change password */}
            <SettingRow
              icon="key-outline"
              iconColor={colors.primary}
              iconBg={isDark ? 'rgba(99,102,241,0.15)' : 'rgba(79,70,229,0.10)'}
              label="Change Password"
              onPress={() => { /* navigate to change password */ }}
              colors={colors}
              isDark={isDark}
            />
            <RowDivider colors={colors} />

            {/* Auto Lock */}
            <SettingRow
              icon="timer-lock-outline"
              iconColor={colors.accent}
              iconBg={isDark ? 'rgba(139,92,246,0.15)' : 'rgba(124,58,237,0.10)'}
              label="Auto Lock"
              value={autoLockLabel}
              onPress={() => setShowAutoLock(true)}
              colors={colors}
              isDark={isDark}
              isLast
            />
          </SectionCard>
        </Animated.View>

        {/* ── 5. Notifications ── */}
        <Animated.View entering={FadeInDown.duration(500).delay(340)}>
          <SectionHeader title="Notifications" colors={colors} />
          <SectionCard colors={colors} isDark={isDark}>
            {/* Master toggle */}
            <SettingRow
              icon="bell-outline"
              iconColor={colors.primary}
              iconBg={isDark ? 'rgba(99,102,241,0.15)' : 'rgba(79,70,229,0.10)'}
              label="Push Notifications"
              sublabel="Master toggle for all alerts"
              right={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={toggleNotifications}
                  trackColor={switchTrack}
                  thumbColor={notificationsEnabled ? '#fff' : colors.textMuted}
                />
              }
              colors={colors}
              isDark={isDark}
            />
            <RowDivider colors={colors} />

            {/* Low Stock */}
            <SettingRow
              icon="package-variant-remove"
              iconColor={colors.warning}
              iconBg={isDark ? 'rgba(245,158,11,0.15)' : 'rgba(217,119,6,0.10)'}
              label="Low Stock Alerts"
              right={
                <Switch
                  value={lowStockAlerts && notificationsEnabled}
                  onValueChange={handleToggleLowStock}
                  disabled={!notificationsEnabled}
                  trackColor={switchTrack}
                  thumbColor={lowStockAlerts ? '#fff' : colors.textMuted}
                />
              }
              colors={colors}
              isDark={isDark}
            />
            <RowDivider colors={colors} />

            {/* License Expiry */}
            <SettingRow
              icon="certificate-outline"
              iconColor={colors.danger}
              iconBg={isDark ? 'rgba(239,68,68,0.15)' : 'rgba(220,38,38,0.10)'}
              label="License Expiry"
              right={
                <Switch
                  value={licenseExpiry && notificationsEnabled}
                  onValueChange={handleToggleLicenseExpiry}
                  disabled={!notificationsEnabled}
                  trackColor={switchTrack}
                  thumbColor={licenseExpiry ? '#fff' : colors.textMuted}
                />
              }
              colors={colors}
              isDark={isDark}
            />
            <RowDivider colors={colors} />

            {/* Daily Summary */}
            <SettingRow
              icon="chart-bar"
              iconColor={colors.success}
              iconBg={isDark ? 'rgba(16,185,129,0.15)' : 'rgba(5,150,105,0.10)'}
              label="Daily Summary"
              right={
                <Switch
                  value={dailySummary && notificationsEnabled}
                  onValueChange={handleToggleDailySummary}
                  disabled={!notificationsEnabled}
                  trackColor={switchTrack}
                  thumbColor={dailySummary ? '#fff' : colors.textMuted}
                />
              }
              colors={colors}
              isDark={isDark}
            />
            <RowDivider colors={colors} />

            {/* Payment Reminders */}
            <SettingRow
              icon="cash-clock"
              iconColor={colors.accent}
              iconBg={isDark ? 'rgba(139,92,246,0.15)' : 'rgba(124,58,237,0.10)'}
              label="Payment Reminders"
              right={
                <Switch
                  value={paymentReminders && notificationsEnabled}
                  onValueChange={handleTogglePaymentReminders}
                  disabled={!notificationsEnabled}
                  trackColor={switchTrack}
                  thumbColor={paymentReminders ? '#fff' : colors.textMuted}
                />
              }
              colors={colors}
              isDark={isDark}
              isLast
            />
          </SectionCard>
        </Animated.View>

        {/* ── 6. Data ── */}
        <Animated.View entering={FadeInDown.duration(500).delay(400)}>
          <SectionHeader title="Data" colors={colors} />
          <SectionCard colors={colors} isDark={isDark}>
            <SettingRow
              icon="sync"
              iconColor={colors.primary}
              iconBg={isDark ? 'rgba(99,102,241,0.15)' : 'rgba(79,70,229,0.10)'}
              label="Sync Interval"
              value={syncIntervalLabel}
              onPress={() => setShowSyncInterval(true)}
              colors={colors}
              isDark={isDark}
            />
            <RowDivider colors={colors} />
            <SettingRow
              icon="trash-can-outline"
              iconColor={colors.warning}
              iconBg={isDark ? 'rgba(245,158,11,0.15)' : 'rgba(217,119,6,0.10)'}
              label="Clear Cache"
              sublabel="Remove all locally cached data"
              onPress={handleClearCache}
              colors={colors}
              isDark={isDark}
              isLast
            />
          </SectionCard>
        </Animated.View>

        {/* ── 7. Danger Zone ── */}
        <Animated.View entering={FadeInDown.duration(500).delay(460)}>
          <SectionHeader title="Danger Zone" colors={colors} />
          <SectionCard colors={colors} isDark={isDark}>
            <SettingRow
              icon="logout"
              iconColor={colors.danger}
              iconBg={isDark ? 'rgba(239,68,68,0.15)' : 'rgba(220,38,38,0.10)'}
              label="Sign Out"
              sublabel="Logout from this device"
              onPress={handleLogout}
              danger
              colors={colors}
              isDark={isDark}
              isLast
            />
          </SectionCard>
        </Animated.View>

        {/* Footer */}
        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          OsaTech POS v{APP_VERSION} · Built with care
        </Text>

      </ScrollView>

      {/* ── Modals ── */}

      <SelectModal<AutoLockValue>
        visible={showAutoLock}
        title="Auto Lock"
        options={AUTO_LOCK_OPTIONS}
        selected={autoLock}
        onSelect={handleAutoLockChange}
        onClose={() => setShowAutoLock(false)}
        colors={colors}
        isDark={isDark}
      />

      <SelectModal<SyncIntervalValue>
        visible={showSyncInterval}
        title="Sync Interval"
        options={SYNC_INTERVAL_OPTIONS}
        selected={syncInterval}
        onSelect={handleSyncIntervalChange}
        onClose={() => setShowSyncInterval(false)}
        colors={colors}
        isDark={isDark}
      />

      <BackendUrlModal
        visible={showBackendModal}
        current={backendUrl}
        onSave={setBackendUrl}
        onClose={() => setShowBackendModal(false)}
        colors={colors}
        isDark={isDark}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { gap: 0 },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 20,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    marginTop: 24,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },

  // Profile card
  profileCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 24,
  },
  profileGradientStrip: {
    height: 4,
    width: '100%',
  },
  profileBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  profileSub: {
    fontSize: 12,
    marginBottom: 6,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  editChevron: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editLabel: {
    fontSize: 13,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
});

// Section / row styles
const sStyles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
    marginBottom: 8,
    marginTop: 8,
    marginLeft: 4,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  rowOuter: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  rowSublabel: {
    fontSize: 12,
    marginTop: 1,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '45%',
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'right',
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68,
  },
});

// Segmented control styles
const segStyles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    height: 36,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segFirst: {
    borderTopLeftRadius: 9,
    borderBottomLeftRadius: 9,
  },
  segLast: {
    borderTopRightRadius: 9,
    borderBottomRightRadius: 9,
  },
  segText: {
    fontSize: 13,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
});

// Modal styles
const mStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4a4a5e',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 2,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
});

// URL modal styles
const urlStyles = StyleSheet.create({
  dialog: {
    margin: 24,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    position: 'absolute',
    left: 0,
    right: 0,
    top: '25%',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  hint: {
    fontSize: 13,
    marginBottom: 16,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 15,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
});
