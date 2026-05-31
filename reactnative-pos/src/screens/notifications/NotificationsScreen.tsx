/**
 * NotificationsScreen — Notification center for OsaTech POS Cloud Admin.
 *
 * Sections:
 *  1. Header — title + "Mark All Read" action
 *  2. Filter bar — All | Alerts | System | Broadcasts
 *  3. FlatList of notification items
 *     - Icon + color based on type
 *     - Title (bold) + body (2 lines, truncated)
 *     - Time ago (right)
 *     - Unread dot
 *     - Swipe to delete (right-action)
 *     - Tap to expand full message (inline expand)
 *  4. Admin broadcasts from getNotifications() shown in the Broadcasts filter
 */

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Platform,
  StatusBar,
  Animated,
  PanResponder,
  LayoutAnimation,
  UIManager,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useTheme } from '@/hooks/useTheme';
import { getNotifications, deleteNotification, AdminNotification } from '@/api/notifications';
import { Skeleton } from '@/components/ui/Skeleton';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifFilter = 'all' | 'alerts' | 'system' | 'broadcasts';

type NotifType =
  | 'license_expiry'
  | 'low_stock'
  | 'overdue_payment'
  | 'system'
  | 'broadcast';

interface LocalNotif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
  /** Only present for admin broadcast items */
  adminId?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
}

function typeConfig(type: NotifType): { icon: string; emoji: string; color: string } {
  switch (type) {
    case 'license_expiry':
      return { icon: 'key-alert', emoji: '🔑', color: '#ef4444' };
    case 'low_stock':
      return { icon: 'package-variant-closed-remove', emoji: '📦', color: '#f59e0b' };
    case 'overdue_payment':
      return { icon: 'credit-card-clock', emoji: '💳', color: '#f97316' };
    case 'system':
      return { icon: 'cog-outline', emoji: '⚙️', color: '#8b8fa8' };
    case 'broadcast':
    default:
      return { icon: 'bullhorn-outline', emoji: '📢', color: '#6366f1' };
  }
}

function filterMatches(n: LocalNotif, filter: NotifFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'broadcasts') return n.type === 'broadcast';
  if (filter === 'system') return n.type === 'system';
  // alerts = license_expiry, low_stock, overdue_payment
  return ['license_expiry', 'low_stock', 'overdue_payment'].includes(n.type);
}

// Convert AdminNotification → LocalNotif
function toLocalNotif(a: AdminNotification): LocalNotif {
  return {
    id: `admin_${a.id}`,
    type: 'broadcast',
    title: a.title,
    body: a.body,
    timestamp: new Date(a.created_at),
    read: false,
    adminId: a.id,
  };
}

// ─── Mock local notifications ─────────────────────────────────────────────────
// These represent device-local alerts (license expiry, stock, payments).
// In a production app, these would come from local storage / push notifications.
const MOCK_LOCAL: LocalNotif[] = [
  {
    id: 'local_1',
    type: 'license_expiry',
    title: 'License Expiring Soon',
    body: 'Store "Al-Noor General Store" license expires in 3 days. Renew now to avoid service interruption.',
    timestamp: new Date(Date.now() - 15 * 60_000),
    read: false,
  },
  {
    id: 'local_2',
    type: 'low_stock',
    title: 'Low Stock Alert',
    body: 'Basmati Rice (5kg) is below the reorder threshold. Only 4 units remaining at Hassan Brothers.',
    timestamp: new Date(Date.now() - 2 * 3600_000),
    read: false,
  },
  {
    id: 'local_3',
    type: 'overdue_payment',
    title: 'Overdue Payment',
    body: 'Customer "Khalid Textile" has an outstanding balance of PKR 45,000 overdue by 12 days.',
    timestamp: new Date(Date.now() - 5 * 3600_000),
    read: true,
  },
  {
    id: 'local_4',
    type: 'license_expiry',
    title: 'License Expired',
    body: 'Store "City Mart Gulberg" license expired yesterday. The store is now in read-only mode.',
    timestamp: new Date(Date.now() - 28 * 3600_000),
    read: true,
  },
  {
    id: 'local_5',
    type: 'system',
    title: 'System Maintenance',
    body: 'Scheduled maintenance on 2024-02-15 from 02:00–04:00 AM. Cloud sync will be paused during this window.',
    timestamp: new Date(Date.now() - 3 * 86_400_000),
    read: true,
  },
  {
    id: 'local_6',
    type: 'system',
    title: 'Database Backup Completed',
    body: 'Nightly backup completed successfully. All 47 instances synced. Next backup: tomorrow at 02:00 AM.',
    timestamp: new Date(Date.now() - 4 * 86_400_000),
    read: true,
  },
];

// ─── SwipeableItem ─────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 80;
const DELETE_WIDTH = 72;

interface SwipeableItemProps {
  onDelete: () => void;
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>['colors'];
}

function SwipeableItem({ onDelete, children, colors }: SwipeableItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const deleteOpacity = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy),
      onPanResponderMove: (_, { dx }) => {
        if (dx < 0) {
          const clamped = Math.max(dx, -DELETE_WIDTH - 20);
          translateX.setValue(clamped);
          deleteOpacity.setValue(Math.min(Math.abs(clamped) / DELETE_WIDTH, 1));
        }
      },
      onPanResponderRelease: (_, { dx }) => {
        if (dx < -SWIPE_THRESHOLD) {
          // Snap to reveal delete button
          Animated.spring(translateX, {
            toValue: -DELETE_WIDTH,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
          Animated.timing(deleteOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }).start();
        } else {
          // Snap back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          Animated.timing(deleteOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const resetSwipe = useCallback(() => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    Animated.timing(deleteOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
  }, [translateX, deleteOpacity]);

  return (
    <View style={{ overflow: 'hidden' }}>
      {/* Delete action behind the item */}
      <Animated.View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: DELETE_WIDTH,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.danger,
          opacity: deleteOpacity,
          borderRadius: 0,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            resetSwipe();
            onDelete();
          }}
          style={{ alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}
        >
          <Icon name="trash-can-outline" size={22} color="#ffffff" />
          <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '600', marginTop: 2 }}>
            Delete
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Main item */}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

// ─── NotificationItem ─────────────────────────────────────────────────────────

interface NotificationItemProps {
  item: LocalNotif;
  onDelete: (id: string) => void;
  onToggleRead: (id: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  radius: ReturnType<typeof useTheme>['radius'];
}

function NotificationItem({
  item,
  onDelete,
  onToggleRead,
  colors,
  spacing,
  radius,
}: NotificationItemProps) {
  const [expanded, setExpanded] = useState(false);
  const cfg = typeConfig(item.type);

  const handlePress = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
    if (!item.read) {
      onToggleRead(item.id);
    }
  }, [item.read, item.id, onToggleRead]);

  const ff = Platform.OS === 'android' ? 'Inter' : undefined;

  return (
    <SwipeableItem
      onDelete={() => onDelete(item.id)}
      colors={colors}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing[3],
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[4],
          backgroundColor: item.read ? colors.surface : colors.surface,
        }}
      >
        {/* Icon */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: cfg.color + '1a',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: cfg.color + '33',
            flexShrink: 0,
          }}
        >
          <Icon name={cfg.icon} size={18} color={cfg.color} />
        </View>

        {/* Content */}
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <Text
              style={{
                flex: 1,
                color: colors.text,
                fontSize: 14,
                fontWeight: item.read ? '500' : '700',
                fontFamily: ff,
                letterSpacing: -0.1,
              }}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 11,
                fontFamily: ff,
                flexShrink: 0,
              }}
            >
              {timeAgo(item.timestamp)}
            </Text>
          </View>

          <Text
            style={{
              color: colors.textSub,
              fontSize: 13,
              fontFamily: ff,
              lineHeight: 19,
            }}
            numberOfLines={expanded ? undefined : 2}
          >
            {item.body}
          </Text>

          {expanded && (
            <TouchableOpacity
              onPress={handlePress}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              style={{ marginTop: 2 }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 12,
                  fontWeight: '600',
                  fontFamily: ff,
                }}
              >
                Show less
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Unread dot */}
        {!item.read && (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.primary,
              marginTop: 6,
              flexShrink: 0,
            }}
          />
        )}
      </TouchableOpacity>
    </SwipeableItem>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { colors, spacing, radius, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<NotifFilter>('all');
  const [localNotifs, setLocalNotifs] = useState<LocalNotif[]>(MOCK_LOCAL);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Admin broadcasts ──────────────────────────────────────────────────────
  const { data: adminNotifs, isLoading: adminLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    staleTime: 120_000,
  });

  // Merge admin broadcasts into the list (deduped by adminId)
  const mergedNotifs = useMemo<LocalNotif[]>(() => {
    const broadcasts: LocalNotif[] = (adminNotifs ?? []).map(toLocalNotif);
    // Dedupe: filter local items that have an adminId present in broadcasts
    const adminIds = new Set(broadcasts.map((b) => b.adminId));
    const filteredLocal = localNotifs.filter(
      (n) => n.adminId == null || !adminIds.has(n.adminId),
    );
    return [...broadcasts, ...filteredLocal].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }, [adminNotifs, localNotifs]);

  // Filtered list
  const displayed = useMemo(
    () => mergedNotifs.filter((n) => filterMatches(n, filter)),
    [mergedNotifs, filter],
  );

  const unreadCount = useMemo(
    () => mergedNotifs.filter((n) => !n.read).length,
    [mergedNotifs],
  );

  // ─── Actions ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (id: string) => {
      const item = mergedNotifs.find((n) => n.id === id);

      if (item?.adminId != null) {
        try {
          await deleteNotification(item.adminId);
          await queryClient.invalidateQueries({ queryKey: ['notifications'] });
        } catch {
          Alert.alert('Error', 'Could not delete notification. Please try again.');
          return;
        }
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setLocalNotifs((prev) => prev.filter((n) => n.id !== id));
    },
    [mergedNotifs, queryClient],
  );

  const handleToggleRead = useCallback((id: string) => {
    setLocalNotifs((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n)),
    );
  }, []);

  const handleMarkAllRead = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLocalNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    setRefreshing(false);
  }, [queryClient]);

  // ─── Styles ────────────────────────────────────────────────────────────────
  const ff = Platform.OS === 'android' ? 'Inter' : undefined;
  const statusBarHeight =
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  const topInset = insets.top + statusBarHeight;

  const FILTERS: { key: NotifFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'alerts', label: 'Alerts' },
    { key: 'system', label: 'System' },
    { key: 'broadcasts', label: 'Broadcasts' },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: topInset,
      }}
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      {/* ── 1. Header ────────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing[4],
          paddingTop: spacing[4],
          paddingBottom: spacing[3],
        }}
      >
        <View>
          <Text
            style={{
              color: colors.text,
              fontSize: 24,
              fontWeight: '700',
              fontFamily: ff,
              letterSpacing: -0.5,
            }}
          >
            Notifications
          </Text>
          {unreadCount > 0 && (
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                fontFamily: ff,
                marginTop: 2,
              }}
            >
              {unreadCount} unread
            </Text>
          )}
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            activeOpacity={0.75}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: colors.primary + '18',
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderWidth: 1,
              borderColor: colors.primary + '33',
            }}
          >
            <Icon name="check-all" size={15} color={colors.primary} />
            <Text
              style={{
                color: colors.primary,
                fontSize: 12,
                fontWeight: '600',
                fontFamily: ff,
              }}
            >
              Mark All Read
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── 2. Filter bar ────────────────────────────────────────────────── */}
      <View
        style={{
          paddingHorizontal: spacing[4],
          paddingBottom: spacing[3],
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 3,
            gap: 2,
          }}
        >
          {FILTERS.map((f) => {
            const isActive = filter === f.key;
            // Count for this filter
            const cnt = mergedNotifs.filter((n) => filterMatches(n, f.key)).length;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.75}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  paddingVertical: 8,
                  borderRadius: radius.sm,
                  backgroundColor: isActive ? colors.primary : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    fontFamily: ff,
                    color: isActive ? colors.primaryFg : colors.textSub,
                  }}
                >
                  {f.label}
                </Text>
                {cnt > 0 && (
                  <View
                    style={{
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: isActive
                        ? 'rgba(255,255,255,0.25)'
                        : colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 3,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: '700',
                        color: isActive ? '#fff' : colors.textMuted,
                      }}
                    >
                      {cnt > 99 ? '99+' : cnt}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── 3. List ──────────────────────────────────────────────────────── */}
      {adminLoading && displayed.length === 0 ? (
        <View style={{ paddingHorizontal: spacing[4], gap: spacing[3] }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                gap: spacing[3],
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: spacing[4],
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Skeleton width={40} height={40} borderRadius={20} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="65%" height={13} />
                <Skeleton width="90%" height={11} />
                <Skeleton width="75%" height={11} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: spacing[4],
            paddingBottom: insets.bottom + 96,
          }}
          ListEmptyComponent={
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 80,
                gap: spacing[3],
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: colors.elevated,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Icon name="bell-off-outline" size={28} color={colors.textMuted} />
              </View>
              <Text
                style={{
                  color: colors.textSub,
                  fontSize: 15,
                  fontWeight: '600',
                  fontFamily: ff,
                }}
              >
                No notifications
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 13,
                  fontFamily: ff,
                  textAlign: 'center',
                }}
              >
                {filter === 'all'
                  ? "You're all caught up!"
                  : `No ${filter} notifications`}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isFirst = index === 0;
            const isLast = index === displayed.length - 1;
            return (
              <View
                style={{
                  backgroundColor: colors.surface,
                  overflow: 'hidden',
                  // Card edges — rounded only on first/last item
                  borderTopLeftRadius: isFirst ? radius.xl : 0,
                  borderTopRightRadius: isFirst ? radius.xl : 0,
                  borderBottomLeftRadius: isLast ? radius.xl : 0,
                  borderBottomRightRadius: isLast ? radius.xl : 0,
                  // Left accent for unread
                  borderLeftWidth: item.read ? 0 : 3,
                  borderLeftColor: item.read
                    ? 'transparent'
                    : typeConfig(item.type).color,
                  // Outer border
                  borderWidth: 1,
                  borderColor: colors.border,
                  // Collapse adjacent borders
                  marginTop: isFirst ? 0 : -1,
                  ...(!isFirst && !isLast && { borderRadius: 0 }),
                  ...Platform.select({
                    android: isFirst ? { elevation: 2 } : {},
                    ios: isFirst
                      ? {
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.07,
                          shadowRadius: 8,
                        }
                      : {},
                  }),
                }}
              >
                <NotificationItem
                  item={item}
                  onDelete={handleDelete}
                  onToggleRead={handleToggleRead}
                  colors={colors}
                  spacing={spacing}
                  radius={radius}
                />
              </View>
            );
          }}
          style={{ backgroundColor: 'transparent' }}
        />
      )}
    </View>
  );
}
