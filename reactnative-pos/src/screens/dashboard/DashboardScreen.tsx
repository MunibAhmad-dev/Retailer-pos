/**
 * DashboardScreen — Main monitoring dashboard for OsaTech POS Cloud Admin.
 *
 * Sections:
 *  1. Header      — Greeting, date, notification bell (with badge), refresh
 *  2. Revenue Strip — Horizontal scroll cards: Today, Monthly, Net Profit, Expenses
 *  3. Smart Alerts  — Collapsible chips: expiring/expired licenses + pending stores
 *  4. Revenue Chart — 7-day area chart with 7D / 30D / 3M period selector
 *  5. Quick Stats Grid — 2×3 grid of key metrics
 *  6. Top Products — Horizontal scroll product cards
 *  7. Store Activity — Top-5 stores ranked by revenue
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import {
  getStats,
  getAnalytics,
  type DashboardStats,
  type AnalyticsData,
  type SalesByDay,
} from '@/api/dashboard';
import { getNotifications } from '@/api/notifications';
import { Skeleton } from '@/components/ui/Skeleton';
import { RevenueChart } from '@/components/shared/RevenueChart';
import { SCREENS } from '@/navigation/screens';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-PK', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildChartData(
  salesByDay: SalesByDay[],
  period: '7D' | '30D' | '3M',
): { date: string; revenue: number }[] {
  const days = period === '7D' ? 7 : period === '30D' ? 30 : 90;
  const cutoff = Date.now() - days * 86_400_000;
  return salesByDay
    .filter(d => new Date(d.date).getTime() >= cutoff)
    .sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )
    .map(d => ({ date: d.date, revenue: d.total }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface RevenueCardProps {
  label: string;
  value: string;
  subtitle?: string;
  gradient: string[];
  icon: string;
}

function RevenueCard({
  label,
  value,
  subtitle,
  gradient,
  icon,
}: RevenueCardProps) {
  return (
    <LinearGradient
      colors={gradient as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={rcStyles.card}>
      <View style={rcStyles.iconRow}>
        <View style={rcStyles.iconWrap}>
          <Icon name={icon} size={16} color="rgba(255,255,255,0.9)" />
        </View>
        <Text style={rcStyles.label}>{label}</Text>
      </View>
      <Text style={rcStyles.value} numberOfLines={1}>
        {value}
      </Text>
      {subtitle ? <Text style={rcStyles.subtitle}>{subtitle}</Text> : null}
    </LinearGradient>
  );
}

const rcStyles = StyleSheet.create({
  card: {
    width: 160,
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '500',
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
    flex: 1,
  },
  value: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
  },
});

function RevenueCardSkeleton({ colors }: { colors: any }) {
  return (
    <View
      style={[
        rcStyles.card,
        {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
      ]}>
      <View style={{ gap: 10 }}>
        <View
          style={{
            width: 80,
            height: 12,
            borderRadius: 6,
            backgroundColor: colors.border,
          }}
        />
        <View
          style={{
            width: 100,
            height: 24,
            borderRadius: 8,
            backgroundColor: colors.border,
          }}
        />
        <View
          style={{
            width: 60,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.border,
          }}
        />
      </View>
    </View>
  );
}

interface AlertChipProps {
  icon: string;
  label: string;
  count: number;
  color: string;
  onPress?: () => void;
}

function AlertChip({ icon, label, count, color, onPress }: AlertChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: color + '18',
        borderWidth: 1,
        borderColor: color + '44',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
        marginRight: 8,
        marginBottom: 8,
      }}>
      <Text style={{ fontSize: 14 }}>{icon}</Text>
      <Text
        style={{
          color,
          fontSize: 12,
          fontWeight: '600',
          fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
        }}>
        {label}
      </Text>
      <View
        style={{
          backgroundColor: color,
          borderRadius: 999,
          minWidth: 18,
          height: 18,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
        }}>
        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
          {count > 99 ? '99+' : count}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

interface StatCellProps {
  label: string;
  value: string;
  icon: string;
  iconColor: string;
  onPress?: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  radius: ReturnType<typeof useTheme>['radius'];
}

function StatCell({
  label,
  value,
  icon,
  iconColor,
  onPress,
  colors,
  spacing,
  radius,
}: StatCellProps) {
  const Wrapper: any = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.75 } : {};
  return (
    <Wrapper
      {...wrapperProps}
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing[3],
        borderWidth: 1,
        borderColor: colors.border,
        gap: 8,
        ...Platform.select({
          android: { elevation: 2 },
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
          },
        }),
      }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: iconColor + '1a',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icon} size={16} color={iconColor} />
      </View>
      <Text
        style={{
          color: colors.text,
          fontSize: 18,
          fontWeight: '700',
          fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
          letterSpacing: -0.3,
        }}
        numberOfLines={1}>
        {value}
      </Text>
      <Text
        style={{
          color: colors.textSub,
          fontSize: 11,
          fontWeight: '500',
          fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
        }}
        numberOfLines={2}>
        {label}
      </Text>
    </Wrapper>
  );
}

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
}

function SectionHeader({
  title,
  action,
  colors,
  spacing,
}: SectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing[3],
      }}>
      <Text
        style={{
          color: colors.text,
          fontSize: 17,
          fontWeight: '700',
          fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
          letterSpacing: -0.2,
        }}>
        {title}
      </Text>
      {action ? (
        <TouchableOpacity
          onPress={action.onPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text
            style={{
              color: colors.primary,
              fontSize: 13,
              fontWeight: '600',
              fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
            }}>
            {action.label}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { colors, spacing, radius, isDark } = useTheme();
  const { user } = useAuth();
  const { fmtShort } = useFormatCurrency();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<'7D' | '30D' | '3M'>('7D');
  const [alertsOpen, setAlertsOpen] = useState(true);

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['stats'],
    queryFn: getStats,
    staleTime: 60_000,
  });

  const { data: analytics, isLoading: analyticsLoading } =
    useQuery<AnalyticsData>({
      queryKey: ['analytics'],
      queryFn: () => getAnalytics(),
      staleTime: 300_000,
    });

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    staleTime: 120_000,
  });

  // ─── Derived data ────────────────────────────────────────────────────────
  const notifCount = notifications?.length ?? 0;

  const todayRevenue = useMemo(() => {
    if (!analytics?.salesByDay) {
      return 0;
    }
    const today = new Date().toISOString().slice(0, 10);
    return analytics.salesByDay.find(d => d.date === today)?.total ?? 0;
  }, [analytics?.salesByDay]);

  const monthRevenue = useMemo(() => {
    if (!analytics?.salesByDay) {
      return 0;
    }
    const month = new Date().toISOString().slice(0, 7);
    return analytics.salesByDay
      .filter(d => d.date.startsWith(month))
      .reduce((s, d) => s + d.total, 0);
  }, [analytics?.salesByDay]);

  const netProfit = analytics?.totals?.profit ?? 0;
  const totalExpenses = analytics?.totals?.expenses ?? 0;

  const chartData = useMemo(
    () => buildChartData(analytics?.salesByDay ?? [], chartPeriod),
    [analytics?.salesByDay, chartPeriod],
  );

  const expiringCriticalCount = stats?.expiringCritical?.length ?? 0;
  const expiringWarningCount = stats?.expiringWarning?.length ?? 0;
  const expiredCount = stats?.expired?.length ?? 0;
  const pendingCount = stats?.pending ?? 0;
  const totalAlerts =
    expiringCriticalCount + expiringWarningCount + expiredCount + pendingCount;

  const topStores = useMemo(() => {
    if (!analytics?.revenueByInstance) {
      return [];
    }
    return [...analytics.revenueByInstance]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [analytics?.revenueByInstance]);

  const topProducts = useMemo(
    () => (analytics?.topProducts ?? []).slice(0, 10),
    [analytics?.topProducts],
  );

  // ─── Pull-to-refresh ─────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['stats'] }),
      queryClient.invalidateQueries({ queryKey: ['analytics'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const toggleAlerts = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAlertsOpen(v => !v);
  };

  // ─── Styles ───────────────────────────────────────────────────────────────
  const s = useMemo(
    () => buildStyles(colors, spacing, radius),
    [colors, spacing, radius],
  );

  const topInset = insets.top + (Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0);
  const periodOptions: ('7D' | '30D' | '3M')[] = ['7D', '30D', '3M'];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: topInset }]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[
          s.content,
          { paddingBottom: insets.bottom + 96 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }>
        {/* ── 1. Header ──────────────────────────────────────────────── */}
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>
              {getGreeting()},{' '}
              <Text style={s.username}>{user?.username ?? 'Admin'}</Text>
            </Text>
            <Text style={s.dateText}>{formatDate()}</Text>
          </View>

          <View style={s.headerActions}>
            <TouchableOpacity
              onPress={onRefresh}
              style={s.headerIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="refresh" size={20} color={colors.textSub} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate(SCREENS.NOTIFICATIONS)}
              style={s.headerIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="bell-outline" size={22} color={colors.textSub} />
              {notifCount > 0 && (
                <View style={s.notifBadge}>
                  <Text style={s.notifBadgeText}>
                    {notifCount > 9 ? '9+' : notifCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 2. Revenue Strip ─────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.revenueStrip}>
          {statsLoading || analyticsLoading ? (
            <>
              {[0, 1, 2, 3].map(i => (
                <RevenueCardSkeleton key={i} colors={colors} />
              ))}
            </>
          ) : (
            <>
              <RevenueCard
                label="Today's Revenue"
                value={fmtShort(todayRevenue)}
                subtitle="Sales today"
                gradient={['#6366f1', '#8b5cf6']}
                icon="trending-up"
              />
              <RevenueCard
                label="Monthly Revenue"
                value={fmtShort(monthRevenue)}
                subtitle={new Date().toLocaleString('default', {
                  month: 'long',
                })}
                gradient={['#0ea5e9', '#6366f1']}
                icon="calendar-month"
              />
              <RevenueCard
                label="Net Profit"
                value={fmtShort(netProfit)}
                subtitle={netProfit >= 0 ? 'Profitable' : 'Loss'}
                gradient={
                  netProfit >= 0
                    ? ['#10b981', '#059669']
                    : ['#ef4444', '#dc2626']
                }
                icon="chart-areaspline"
              />
              <RevenueCard
                label="Total Expenses"
                value={fmtShort(totalExpenses)}
                subtitle="All time"
                gradient={['#f59e0b', '#d97706']}
                icon="cash-minus"
              />
            </>
          )}
        </ScrollView>

        {/* ── 3. Smart Alerts ──────────────────────────────────────── */}
        {(statsLoading || totalAlerts > 0) && (
          <View style={s.section}>
            <TouchableOpacity
              onPress={toggleAlerts}
              activeOpacity={0.75}
              style={s.alertsHeader}>
              <View style={s.alertsHeaderLeft}>
                <Icon
                  name="alert-circle-outline"
                  size={18}
                  color={colors.warning}
                />
                <Text style={s.alertsTitle}>
                  {statsLoading ? 'Alerts' : `Alerts (${totalAlerts})`}
                </Text>
              </View>
              <Icon
                name={alertsOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>

            {alertsOpen && (
              <View>
                {statsLoading ? (
                  <View style={{ gap: 8 }}>
                    <Skeleton
                      width="100%"
                      height={44}
                      borderRadius={radius.md}
                    />
                    <Skeleton
                      width="80%"
                      height={44}
                      borderRadius={radius.md}
                    />
                  </View>
                ) : (
                  <View style={s.chipsRow}>
                    {expiringCriticalCount > 0 && (
                      <AlertChip
                        icon="alert"
                        label="Expiring Critical"
                        count={expiringCriticalCount}
                        color={colors.danger}
                        onPress={() => navigation.navigate(SCREENS.TAB_SETTINGS)}
                      />
                    )}
                    {expiringWarningCount > 0 && (
                      <AlertChip
                        icon="clock-alert-outline"
                        label="Expiring Soon"
                        count={expiringWarningCount}
                        color={colors.warning}
                        onPress={() => navigation.navigate(SCREENS.TAB_SETTINGS)}
                      />
                    )}
                    {expiredCount > 0 && (
                      <AlertChip
                        icon="close-circle-outline"
                        label="Expired"
                        count={expiredCount}
                        color={colors.danger}
                        onPress={() => navigation.navigate(SCREENS.TAB_SETTINGS)}
                      />
                    )}
                    {pendingCount > 0 && (
                      <AlertChip
                        icon="store-clock-outline"
                        label="Pending Approval"
                        count={pendingCount}
                        color={colors.accent}
                        onPress={() =>
                          navigation.navigate(SCREENS.TAB_INVENTORY)
                        }
                      />
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── 4. Revenue Chart ─────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader
            title="Revenue Trend"
            colors={colors}
            spacing={spacing}
          />
          <View style={s.periodSelector}>
            {periodOptions.map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => setChartPeriod(p)}
                style={[
                  s.periodBtn,
                  chartPeriod === p && { backgroundColor: colors.primary },
                ]}>
                <Text
                  style={[
                    s.periodBtnText,
                    {
                      color:
                        chartPeriod === p ? colors.primaryFg : colors.textSub,
                    },
                  ]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {analyticsLoading ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                padding: spacing[4],
                borderWidth: 1,
                borderColor: colors.border,
                gap: 12,
              }}>
              <Skeleton width="50%" height={14} />
              <Skeleton width="100%" height={160} borderRadius={8} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <Skeleton key={i} width={40} height={10} borderRadius={4} />
                ))}
              </View>
            </View>
          ) : (
            <RevenueChart
              data={chartData}
              period={
                chartPeriod === '7D'
                  ? 'week'
                  : chartPeriod === '30D'
                  ? 'month'
                  : 'month'
              }
            />
          )}
        </View>

        {/* ── 5. Quick Stats Grid ──────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader title="Overview" colors={colors} spacing={spacing} />
          {statsLoading ? (
            <View style={{ gap: spacing[3] }}>
              {[0, 1].map(row => (
                <View key={row} style={s.statsRow}>
                  {[0, 1, 2].map(col => (
                    <Skeleton
                      key={col}
                      width={undefined}
                      height={90}
                      borderRadius={radius.md}
                      style={{ flex: 1 }}
                    />
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <View style={{ gap: spacing[3] }}>
              <View style={s.statsRow}>
                <StatCell
                  label="Total Stores"
                  value={String(stats?.totalInstances ?? 0)}
                  icon="store-outline"
                  iconColor={colors.primary}
                  colors={colors}
                  spacing={spacing}
                  radius={radius}
                />
                <View style={{ width: spacing[3] }} />
                <StatCell
                  label="Active Today"
                  value={String(stats?.activeToday ?? 0)}
                  icon="lightning-bolt"
                  iconColor={colors.success}
                  colors={colors}
                  spacing={spacing}
                  radius={radius}
                />
                <View style={{ width: spacing[3] }} />
                <StatCell
                  label="Pending"
                  value={String(stats?.pending ?? 0)}
                  icon="clock-outline"
                  iconColor={colors.warning}
                  colors={colors}
                  spacing={spacing}
                  radius={radius}
                />
              </View>

              <View style={s.statsRow}>
                <StatCell
                  label="All-Time Revenue"
                  value={fmtShort(stats?.totalRevenue ?? 0)}
                  icon="cash-multiple"
                  iconColor={colors.accent}
                  colors={colors}
                  spacing={spacing}
                  radius={radius}
                />
                <View style={{ width: spacing[3] }} />
                <StatCell
                  label="Total Sales"
                  value={String(stats?.totalSales ?? 0)}
                  icon="receipt-outline"
                  iconColor={colors.primary}
                  colors={colors}
                  spacing={spacing}
                  radius={radius}
                />
                <View style={{ width: spacing[3] }} />
                <StatCell
                  label="Licenses Issued"
                  value={String(stats?.licensesIssued ?? 0)}
                  icon="key-outline"
                  iconColor={colors.success}
                  colors={colors}
                  spacing={spacing}
                  radius={radius}
                />
              </View>
            </View>
          )}
        </View>

        {/* ── 6. Top Products ──────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader
            title="Top Selling Products"
            action={{
              label: 'See All',
              onPress: () => navigation.navigate(SCREENS.TAB_INVENTORY),
            }}
            colors={colors}
            spacing={spacing}
          />
          {analyticsLoading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[0, 1, 2, 3].map(i => (
                <View
                  key={i}
                  style={{
                    width: 130,
                    marginRight: 12,
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    padding: spacing[3],
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 8,
                  }}>
                  <Skeleton width="70%" height={12} />
                  <Skeleton width="90%" height={10} />
                  <Skeleton width={50} height={22} borderRadius={radius.full} />
                </View>
              ))}
            </ScrollView>
          ) : topProducts.length === 0 ? (
            <View style={s.emptyBox}>
              <Icon
                name="package-variant-closed"
                size={32}
                color={colors.textMuted}
              />
              <Text style={s.emptyText}>No product data available</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: spacing[4] }}>
              {topProducts.map((p, idx) => (
                <View
                  key={p.product_id ?? idx}
                  style={[
                    s.productCard,
                    {
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      borderColor: colors.border,
                    },
                  ]}>
                  <View
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor:
                        idx === 0
                          ? '#f59e0b'
                          : idx === 1
                          ? '#6366f1'
                          : colors.elevated,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text
                      style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                      {idx + 1}
                    </Text>
                  </View>

                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: colors.primary + '1a',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8,
                    }}>
                    <Icon
                      name="package-variant"
                      size={20}
                      color={colors.primary}
                    />
                  </View>

                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 13,
                      fontWeight: '600',
                      fontFamily:
                        Platform.OS === 'android' ? 'Inter' : undefined,
                      marginBottom: 4,
                    }}
                    numberOfLines={2}>
                    {p.name}
                  </Text>

                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: 11,
                      fontFamily:
                        Platform.OS === 'android' ? 'Inter' : undefined,
                      marginBottom: 8,
                    }}>
                    {p.quantity} units
                  </Text>

                  <View
                    style={{
                      backgroundColor: colors.success + '18',
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      alignSelf: 'flex-start',
                    }}>
                    <Text
                      style={{
                        color: colors.success,
                        fontSize: 11,
                        fontWeight: '700',
                        fontFamily:
                          Platform.OS === 'android' ? 'Inter' : undefined,
                      }}>
                      {fmtShort(p.revenue)}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── 7. Store Activity ────────────────────────────────────── */}
        <View style={[s.section, { marginBottom: 0 }]}>
          <SectionHeader
            title="Top Stores by Revenue"
            action={{
              label: 'View All',
              onPress: () => navigation.navigate(SCREENS.TAB_INVENTORY),
            }}
            colors={colors}
            spacing={spacing}
          />
          {analyticsLoading ? (
            <View style={{ gap: spacing[3] }}>
              {[0, 1, 2, 3, 4].map(i => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    padding: spacing[4],
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}>
                  <Skeleton width={40} height={40} borderRadius={radius.full} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="60%" height={13} />
                    <Skeleton width="40%" height={10} />
                  </View>
                  <Skeleton width={60} height={22} borderRadius={radius.full} />
                </View>
              ))}
            </View>
          ) : topStores.length === 0 ? (
            <View style={s.emptyBox}>
              <Icon
                name="store-off-outline"
                size={32}
                color={colors.textMuted}
              />
              <Text style={s.emptyText}>No store activity yet</Text>
            </View>
          ) : (
            <View style={{ gap: spacing[3] }}>
              {topStores.map((store, idx) => (
                <TouchableOpacity
                  key={store.instance_id ?? idx}
                  activeOpacity={0.75}
                  style={[
                    s.storeRow,
                    {
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() =>
                    navigation.navigate('InstanceDetail', {
                      instanceId: store.instance_id,
                    })
                  }>
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      backgroundColor: colors.primary + '1a',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: colors.primary + '33',
                    }}>
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 15,
                        fontWeight: '700',
                        fontFamily:
                          Platform.OS === 'android' ? 'Inter' : undefined,
                      }}>
                      {(store.instance_name ?? 'S').charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 14,
                        fontWeight: '600',
                        fontFamily:
                          Platform.OS === 'android' ? 'Inter' : undefined,
                      }}
                      numberOfLines={1}>
                      {store.instance_name ?? `Store ${idx + 1}`}
                    </Text>
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontSize: 11,
                        marginTop: 2,
                        fontFamily:
                          Platform.OS === 'android' ? 'Inter' : undefined,
                      }}>
                      Revenue: {fmtShort(store.revenue)}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View
                      style={{
                        backgroundColor: colors.success + '18',
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}>
                      <Text
                        style={{
                          color: colors.success,
                          fontSize: 11,
                          fontWeight: '700',
                          fontFamily:
                            Platform.OS === 'android' ? 'Inter' : undefined,
                        }}>
                        #{idx + 1}
                      </Text>
                    </View>
                    <Icon
                      name="chevron-right"
                      size={16}
                      color={colors.textMuted}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

function buildStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  spacing: ReturnType<typeof useTheme>['spacing'],
  radius: ReturnType<typeof useTheme>['radius'],
) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    content: { paddingHorizontal: spacing[4] },

    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingTop: spacing[4],
      paddingBottom: spacing[5],
    },
    greeting: {
      color: colors.textSub,
      fontSize: 13,
      fontWeight: '500',
      fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
      marginBottom: 3,
    },
    username: { color: colors.text, fontWeight: '700' },
    dateText: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    headerIconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    notifBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

    revenueStrip: { paddingBottom: spacing[5] },

    section: { marginBottom: spacing[6] },

    alertsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing[3],
    },
    alertsHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    alertsTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
      fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
    },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap' },

    periodSelector: {
      flexDirection: 'row',
      gap: 4,
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.border,
      alignSelf: 'flex-start',
      marginBottom: spacing[3],
    },
    periodBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
    periodBtnText: {
      fontSize: 12,
      fontWeight: '600',
      fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
    },

    statsRow: { flexDirection: 'row' },

    productCard: {
      width: 130,
      marginRight: 12,
      padding: spacing[3],
      borderWidth: 1,
      ...Platform.select({
        android: { elevation: 2 },
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.07,
          shadowRadius: 4,
        },
      }),
    },

    storeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      padding: spacing[4],
      borderWidth: 1,
      ...Platform.select({
        android: { elevation: 2 },
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 3,
        },
      }),
    },

    emptyBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing[10],
      gap: spacing[3],
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
    },
  });
}
