/**
 * ReportsScreen — Analytics & reporting hub for OsaTech POS Cloud Admin.
 *
 * Sections:
 *  1. Header — title, last-refreshed time, Share Report button
 *  2. Date range picker — Today | Week | Month | Custom (date input)
 *  3. Summary cards — Total Revenue, Total Profit, Total Expenses, Net Margin %
 *  4. Chart tabs — Revenue | Profit & Loss | Top Products | Categories
 *     Revenue:      Line chart + avg / best / worst metrics
 *     Profit & Loss: Grouped bar chart + monthly breakdown table
 *     Top Products: Horizontal bar chart + ranked list
 *     Categories:   Pie chart + legend
 */

import React, {
  useCallback,
  useMemo,
  useState,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Share,
  Animated,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

import { useTheme } from '@/hooks/useTheme';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import {
  getAnalytics,
  AnalyticsData,
  SalesByDay,
  ProfitLossEntry,
} from '@/api/dashboard';
import { RevenueChart } from '@/components/shared/RevenueChart';
import { BarChart } from '@/components/shared/BarChart';
import { PieChart } from '@/components/shared/PieChart';
import { Skeleton } from '@/components/ui/Skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

type DateRange = 'today' | 'week' | 'month' | 'custom';

type ChartTab = 'revenue' | 'pl' | 'products' | 'categories';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function getRangeDates(range: DateRange, customFrom: string, customTo: string) {
  const today = new Date();
  if (range === 'today') {
    return { from: toISODate(today), to: toISODate(today) };
  }
  if (range === 'week') {
    return { from: toISODate(addDays(today, -6)), to: toISODate(today) };
  }
  if (range === 'month') {
    return { from: toISODate(addDays(today, -29)), to: toISODate(today) };
  }
  return { from: customFrom, to: customTo };
}

function filterByRange(
  days: SalesByDay[],
  from: string,
  to: string,
): SalesByDay[] {
  return days.filter((d) => d.date >= from && d.date <= to);
}

function filterPLByRange(
  pl: ProfitLossEntry[],
  from: string,
  to: string,
): ProfitLossEntry[] {
  return pl.filter((d) => d.date >= from && d.date <= to);
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function calcMargin(revenue: number, profit: number): number {
  if (revenue === 0) return 0;
  return (profit / revenue) * 100;
}

function formatPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

// Build monthly rows for P&L table
interface MonthRow {
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
}

function buildMonthlyBreakdown(pl: ProfitLossEntry[]): MonthRow[] {
  const map: Record<string, MonthRow> = {};
  for (const entry of pl) {
    const month = entry.date.slice(0, 7);
    if (!map[month]) {
      const d = new Date(entry.date);
      map[month] = {
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        revenue: 0,
        expenses: 0,
        profit: 0,
      };
    }
    map[month].revenue += entry.revenue;
    map[month].expenses += entry.expenses;
    map[month].profit += entry.profit;
  }
  return Object.values(map).reverse().slice(0, 12);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  gradient: string[];
  icon: string;
  valueColor?: string;
}

function SummaryCard({ label, value, gradient, icon }: SummaryCardProps) {
  return (
    <LinearGradient
      colors={gradient as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={summaryCardStyles.card}
    >
      <View style={summaryCardStyles.iconRow}>
        <View style={summaryCardStyles.iconWrap}>
          <Icon name={icon} size={14} color="rgba(255,255,255,0.9)" />
        </View>
        <Text style={summaryCardStyles.label} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={summaryCardStyles.value} numberOfLines={1}>{value}</Text>
    </LinearGradient>
  );
}

const summaryCardStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '500',
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
    flex: 1,
  },
  value: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
    letterSpacing: -0.3,
  },
});

// Metric row below revenue chart
interface MetricPillProps {
  label: string;
  value: string;
  colors: any;
}

function MetricPill({ label, value, colors }: MetricPillProps) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.elevated,
        borderRadius: 10,
        padding: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 10,
          fontWeight: '500',
          fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
          marginBottom: 3,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.text,
          fontSize: 13,
          fontWeight: '700',
          fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const { colors, spacing, radius, isDark } = useTheme();
  const { fmtShort, formatPKR } = useFormatCurrency();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [dateRange, setDateRange] = useState<DateRange>('week');
  const [customFrom, setCustomFrom] = useState<string>(
    toISODate(addDays(new Date(), -7)),
  );
  const [customTo, setCustomTo] = useState<string>(toISODate(new Date()));
  const [activeTab, setActiveTab] = useState<ChartTab>('revenue');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Tab indicator animation
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const TAB_ORDER: ChartTab[] = ['revenue', 'pl', 'products', 'categories'];

  useEffect(() => {
    const idx = TAB_ORDER.indexOf(activeTab);
    Animated.spring(tabIndicatorAnim, {
      toValue: idx,
      useNativeDriver: false,
      tension: 100,
      friction: 12,
    }).start();
  }, [activeTab]);

  // ─── Query ─────────────────────────────────────────────────────────────────
  const { from, to } = useMemo(
    () => getRangeDates(dateRange, customFrom, customTo),
    [dateRange, customFrom, customTo],
  );

  const {
    data: analytics,
    isLoading,
  } = useQuery<AnalyticsData>({
    queryKey: ['analytics', from, to],
    queryFn: () => getAnalytics({ date_from: from, date_to: to }),
    staleTime: 300_000,
  });

  // ─── Derived ───────────────────────────────────────────────────────────────
  const filteredSales = useMemo(
    () => filterByRange(analytics?.salesByDay ?? [], from, to),
    [analytics?.salesByDay, from, to],
  );

  const filteredPL = useMemo(
    () => filterPLByRange(analytics?.profitLossData ?? [], from, to),
    [analytics?.profitLossData, from, to],
  );

  const totalRevenue = useMemo(
    () => filteredSales.reduce((s, d) => s + d.total, 0),
    [filteredSales],
  );

  const totalExpenses = useMemo(
    () => filteredPL.reduce((s, d) => s + d.expenses, 0),
    [filteredPL],
  );

  const totalProfit = useMemo(
    () => filteredPL.reduce((s, d) => s + d.profit, 0),
    [filteredPL],
  );

  const netMargin = useMemo(
    () => calcMargin(totalRevenue, totalProfit),
    [totalRevenue, totalProfit],
  );

  // Revenue chart data
  const revenueChartData = useMemo(
    () =>
      filteredSales
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((d) => ({ date: d.date, revenue: d.total })),
    [filteredSales],
  );

  const avgRevenue = useMemo(() => {
    if (filteredSales.length === 0) return 0;
    return totalRevenue / filteredSales.length;
  }, [filteredSales, totalRevenue]);

  const highestDay = useMemo(
    () =>
      filteredSales.reduce(
        (best, d) => (d.total > best.total ? d : best),
        filteredSales[0] ?? { date: '-', total: 0 },
      ),
    [filteredSales],
  );

  const lowestDay = useMemo(
    () =>
      filteredSales.reduce(
        (worst, d) => (d.total < worst.total ? d : worst),
        filteredSales[0] ?? { date: '-', total: 0 },
      ),
    [filteredSales],
  );

  // P&L bar chart — revenue bars
  const plRevenueBarData = useMemo(
    () =>
      buildMonthlyBreakdown(filteredPL).map((r) => ({
        x: r.label,
        y: r.revenue,
      })),
    [filteredPL],
  );

  const plExpenseBarData = useMemo(
    () =>
      buildMonthlyBreakdown(filteredPL).map((r) => ({
        x: r.label,
        y: r.expenses,
      })),
    [filteredPL],
  );

  const monthlyRows = useMemo(
    () => buildMonthlyBreakdown(filteredPL),
    [filteredPL],
  );

  // Top products bar chart
  const topProducts = useMemo(
    () => (analytics?.topProducts ?? []).slice(0, 10),
    [analytics?.topProducts],
  );

  const topProductsBarData = useMemo(
    () =>
      [...topProducts]
        .sort((a, b) => b.revenue - a.revenue)
        .map((p) => ({ x: p.name.slice(0, 12), y: p.revenue })),
    [topProducts],
  );

  // Categories pie (using planDistribution as proxy — adapt to your schema)
  const categoriesPieData = useMemo(() => {
    if (!analytics?.planDistribution?.length) return [];
    return analytics.planDistribution.map((d) => ({
      x: d.plan,
      y: d.count,
    }));
  }, [analytics?.planDistribution]);

  // ─── Pull-to-refresh ───────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['analytics'] });
    setLastRefreshed(new Date());
    setRefreshing(false);
  }, [queryClient]);

  // ─── Share report ──────────────────────────────────────────────────────────
  const onShare = useCallback(async () => {
    const rangeLabel =
      dateRange === 'today'
        ? 'Today'
        : dateRange === 'week'
        ? 'Last 7 days'
        : dateRange === 'month'
        ? 'Last 30 days'
        : `${from} to ${to}`;

    const topP = topProducts
      .slice(0, 5)
      .map(
        (p, i) =>
          `  ${i + 1}. ${p.name} — ${p.quantity} units — ${fmtShort(p.revenue)}`,
      )
      .join('\n');

    const message = `OsaTech POS — Report (${rangeLabel})
${'─'.repeat(36)}
Total Revenue : ${formatPKR(totalRevenue)}
Total Profit  : ${formatPKR(totalProfit)}
Total Expenses: ${formatPKR(totalExpenses)}
Net Margin    : ${formatPct(netMargin)}

Top Products:
${topP || '  No data'}

Generated: ${new Date().toLocaleString('en-PK')}`;

    try {
      await Share.share({ message, title: `POS Report — ${rangeLabel}` });
    } catch (_) {
      // user dismissed — no-op
    }
  }, [
    dateRange,
    from,
    to,
    totalRevenue,
    totalProfit,
    totalExpenses,
    netMargin,
    topProducts,
    fmtShort,
    formatPKR,
  ]);

  // ─── Styles ────────────────────────────────────────────────────────────────
  const s = useMemo(
    () => buildStyles(colors, spacing, radius),
    [colors, spacing, radius],
  );

  const statusBarHeight =
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  const topInset = insets.top + statusBarHeight;

  const RANGE_OPTIONS: { key: DateRange; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'custom', label: 'Custom' },
  ];

  const CHART_TABS: { key: ChartTab; label: string; icon: string }[] = [
    { key: 'revenue', label: 'Revenue', icon: 'trending-up' },
    { key: 'pl', label: 'P & L', icon: 'chart-bar' },
    { key: 'products', label: 'Products', icon: 'package-variant' },
    { key: 'categories', label: 'Categories', icon: 'chart-pie' },
  ];

  // ─── Render helpers ────────────────────────────────────────────────────────

  function renderRevenueTab() {
    return (
      <View style={{ gap: spacing[4] }}>
        {isLoading ? (
          <Skeleton width="100%" height={220} borderRadius={radius.lg} />
        ) : (
          <RevenueChart
            data={revenueChartData}
            period={dateRange === 'today' ? 'day' : dateRange === 'week' ? 'week' : 'month'}
          />
        )}

        {/* Metrics row */}
        <View style={{ flexDirection: 'row', gap: spacing[2] }}>
          <MetricPill
            label="Avg / Day"
            value={isLoading ? '...' : fmtShort(avgRevenue)}
            colors={colors}
          />
          <MetricPill
            label="Highest Day"
            value={
              isLoading
                ? '...'
                : highestDay && highestDay.date !== '-'
                ? formatDateShort(highestDay.date)
                : '—'
            }
            colors={colors}
          />
          <MetricPill
            label="Lowest Day"
            value={
              isLoading
                ? '...'
                : lowestDay && lowestDay.date !== '-'
                ? formatDateShort(lowestDay.date)
                : '—'
            }
            colors={colors}
          />
        </View>
      </View>
    );
  }

  function renderPLTab() {
    return (
      <View style={{ gap: spacing[4] }}>
        {isLoading ? (
          <>
            <Skeleton width="100%" height={220} borderRadius={radius.lg} />
            <Skeleton width="100%" height={160} borderRadius={radius.lg} />
          </>
        ) : (
          <>
            {/* Revenue bars */}
            <BarChart
              data={plRevenueBarData}
              title="Revenue by Month"
              color={colors.success}
              height={200}
            />
            {/* Expense bars */}
            <BarChart
              data={plExpenseBarData}
              title="Expenses by Month"
              color={colors.danger}
              height={200}
            />

            {/* Monthly breakdown table */}
            {monthlyRows.length > 0 && (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  overflow: 'hidden',
                }}
              >
                {/* Table header */}
                <View
                  style={[
                    s.tableRow,
                    {
                      backgroundColor: colors.elevated,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  {['Month', 'Revenue', 'Expenses', 'Profit'].map((h) => (
                    <Text
                      key={h}
                      style={[s.tableHeaderCell, { color: colors.textMuted }]}
                    >
                      {h}
                    </Text>
                  ))}
                </View>

                {monthlyRows.map((row, i) => (
                  <View
                    key={row.label}
                    style={[
                      s.tableRow,
                      i < monthlyRows.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[s.tableCell, { color: colors.textSub }]}>
                      {row.label}
                    </Text>
                    <Text style={[s.tableCell, { color: colors.text }]}>
                      {fmtShort(row.revenue)}
                    </Text>
                    <Text style={[s.tableCell, { color: colors.danger }]}>
                      {fmtShort(row.expenses)}
                    </Text>
                    <Text
                      style={[
                        s.tableCell,
                        {
                          color: row.profit >= 0 ? colors.success : colors.danger,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {fmtShort(row.profit)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    );
  }

  function renderProductsTab() {
    return (
      <View style={{ gap: spacing[4] }}>
        {isLoading ? (
          <>
            <Skeleton width="100%" height={220} borderRadius={radius.lg} />
            <Skeleton width="100%" height={160} borderRadius={radius.lg} />
          </>
        ) : (
          <>
            <BarChart
              data={topProductsBarData}
              title="Top 10 Products by Revenue"
              color={colors.primary}
              height={220}
            />

            {/* Ranked list */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
              }}
            >
              {topProducts.length === 0 ? (
                <View
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: spacing[10],
                    gap: spacing[3],
                  }}
                >
                  <Icon name="package-variant-closed" size={32} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                    No product data
                  </Text>
                </View>
              ) : (
                topProducts.map((p, idx) => (
                  <View
                    key={p.product_id ?? idx}
                    style={[
                      s.productRow,
                      idx < topProducts.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    {/* Rank */}
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor:
                          idx === 0
                            ? '#f59e0b'
                            : idx === 1
                            ? colors.primary
                            : idx === 2
                            ? colors.accent
                            : colors.elevated,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: idx < 3 ? '#fff' : colors.textMuted,
                          fontSize: 11,
                          fontWeight: '700',
                        }}
                      >
                        {idx + 1}
                      </Text>
                    </View>

                    {/* Name */}
                    <Text
                      style={{
                        flex: 1,
                        color: colors.text,
                        fontSize: 13,
                        fontWeight: '500',
                        fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
                      }}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>

                    {/* Qty */}
                    <Text
                      style={{
                        color: colors.textSub,
                        fontSize: 12,
                        fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
                        marginRight: spacing[2],
                      }}
                    >
                      {p.quantity} qty
                    </Text>

                    {/* Revenue */}
                    <View
                      style={{
                        backgroundColor: colors.success + '18',
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.success,
                          fontSize: 11,
                          fontWeight: '700',
                        }}
                      >
                        {fmtShort(p.revenue)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </View>
    );
  }

  function renderCategoriesTab() {
    return (
      <View style={{ gap: spacing[4] }}>
        {isLoading ? (
          <Skeleton width="100%" height={300} borderRadius={radius.lg} />
        ) : (
          <PieChart
            data={categoriesPieData}
            title="Sales by Category"
            centerLabel={`${categoriesPieData.length} plans`}
          />
        )}
      </View>
    );
  }

  // ─── Main render ───────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: topInset }]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDark ? 'light-content' : 'dark-content'}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── 1. Header ──────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.screenTitle}>Reports</Text>
            <Text style={s.lastRefreshed}>
              Refreshed {lastRefreshed.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onShare}
            activeOpacity={0.75}
            style={s.shareBtn}
          >
            <Icon name="share-variant-outline" size={16} color={colors.primaryFg} />
            <Text style={s.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* ── 2. Date range picker ───────────────────────────────────────── */}
        <View style={s.rangeRow}>
          {RANGE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setDateRange(opt.key)}
              activeOpacity={0.75}
              style={[
                s.rangeBtn,
                dateRange === opt.key && s.rangeBtnActive,
              ]}
            >
              <Text
                style={[
                  s.rangeBtnText,
                  {
                    color:
                      dateRange === opt.key
                        ? colors.primaryFg
                        : colors.textSub,
                  },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom date inputs */}
        {dateRange === 'custom' && (
          <View style={s.customDateRow}>
            <View style={s.dateInputWrap}>
              <Text style={s.dateInputLabel}>From</Text>
              <TextInput
                value={customFrom}
                onChangeText={setCustomFrom}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                style={[s.dateInput, { color: colors.text, borderColor: colors.border }]}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            <Icon name="arrow-right" size={16} color={colors.textMuted} style={{ marginTop: 20 }} />
            <View style={s.dateInputWrap}>
              <Text style={s.dateInputLabel}>To</Text>
              <TextInput
                value={customTo}
                onChangeText={setCustomTo}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                style={[s.dateInput, { color: colors.text, borderColor: colors.border }]}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </View>
        )}

        {/* ── 3. Summary cards ──────────────────────────────────────────── */}
        <View style={s.summaryGrid}>
          <View style={s.summaryRow}>
            {isLoading ? (
              <>
                <Skeleton width={undefined} height={80} borderRadius={14} style={{ flex: 1 }} />
                <View style={{ width: spacing[2] }} />
                <Skeleton width={undefined} height={80} borderRadius={14} style={{ flex: 1 }} />
              </>
            ) : (
              <>
                <SummaryCard
                  label="Total Revenue"
                  value={fmtShort(totalRevenue)}
                  gradient={['#6366f1', '#8b5cf6']}
                  icon="trending-up"
                />
                <View style={{ width: spacing[2] }} />
                <SummaryCard
                  label="Total Profit"
                  value={fmtShort(totalProfit)}
                  gradient={
                    totalProfit >= 0
                      ? ['#10b981', '#059669']
                      : ['#ef4444', '#dc2626']
                  }
                  icon="chart-areaspline"
                />
              </>
            )}
          </View>

          <View style={[s.summaryRow, { marginTop: spacing[2] }]}>
            {isLoading ? (
              <>
                <Skeleton width={undefined} height={80} borderRadius={14} style={{ flex: 1 }} />
                <View style={{ width: spacing[2] }} />
                <Skeleton width={undefined} height={80} borderRadius={14} style={{ flex: 1 }} />
              </>
            ) : (
              <>
                <SummaryCard
                  label="Total Expenses"
                  value={fmtShort(totalExpenses)}
                  gradient={['#f59e0b', '#d97706']}
                  icon="cash-minus"
                />
                <View style={{ width: spacing[2] }} />
                <SummaryCard
                  label="Net Margin"
                  value={formatPct(netMargin)}
                  gradient={
                    netMargin >= 0
                      ? ['#0ea5e9', '#6366f1']
                      : ['#ef4444', '#dc2626']
                  }
                  icon="percent-outline"
                />
              </>
            )}
          </View>
        </View>

        {/* ── 4. Chart tabs ─────────────────────────────────────────────── */}
        <View style={s.tabContainer}>
          {/* Tab bar */}
          <View style={s.tabBar}>
            {CHART_TABS.map((tab, idx) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.75}
                  style={s.tabItem}
                >
                  <Icon
                    name={tab.icon}
                    size={15}
                    color={isActive ? colors.primary : colors.textMuted}
                  />
                  <Text
                    style={[
                      s.tabLabel,
                      { color: isActive ? colors.primary : colors.textMuted },
                      isActive && { fontWeight: '700' },
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {isActive && <View style={[s.tabUnderline, { backgroundColor: colors.primary }]} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tab content */}
          <View style={{ paddingTop: spacing[4] }}>
            {activeTab === 'revenue' && renderRevenueTab()}
            {activeTab === 'pl' && renderPLTab()}
            {activeTab === 'products' && renderProductsTab()}
            {activeTab === 'categories' && renderCategoriesTab()}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function buildStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  spacing: ReturnType<typeof useTheme>['spacing'],
  radius: ReturnType<typeof useTheme>['radius'],
) {
  const ff = Platform.OS === 'android' ? 'Inter' : undefined;

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: spacing[4],
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: spacing[4],
      paddingBottom: spacing[4],
    },
    screenTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '700',
      fontFamily: ff,
      letterSpacing: -0.5,
    },
    lastRefreshed: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: ff,
      marginTop: 2,
    },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    shareBtnText: {
      color: colors.primaryFg,
      fontSize: 13,
      fontWeight: '600',
      fontFamily: ff,
    },

    // Date range picker
    rangeRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 3,
      marginBottom: spacing[4],
      gap: 2,
    },
    rangeBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: radius.sm,
      alignItems: 'center',
    },
    rangeBtnActive: {
      backgroundColor: colors.primary,
    },
    rangeBtnText: {
      fontSize: 12,
      fontWeight: '600',
      fontFamily: ff,
    },

    // Custom date
    customDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      marginBottom: spacing[4],
    },
    dateInputWrap: {
      flex: 1,
      gap: 4,
    },
    dateInputLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '500',
      fontFamily: ff,
    },
    dateInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingHorizontal: spacing[3],
      paddingVertical: Platform.OS === 'ios' ? 10 : 7,
      fontSize: 13,
      fontFamily: ff,
    },

    // Summary grid
    summaryGrid: {
      marginBottom: spacing[5],
    },
    summaryRow: {
      flexDirection: 'row',
    },

    // Chart tabs
    tabContainer: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[4],
      ...Platform.select({
        android: { elevation: 2 },
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.07,
          shadowRadius: 8,
        },
      }),
    },
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 0,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing[2],
      gap: 3,
      position: 'relative',
    },
    tabLabel: {
      fontSize: 11,
      fontFamily: ff,
      fontWeight: '500',
    },
    tabUnderline: {
      position: 'absolute',
      bottom: 0,
      left: '15%',
      right: '15%',
      height: 2,
      borderRadius: 1,
    },

    // P&L table
    tableRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
    },
    tableHeaderCell: {
      flex: 1,
      fontSize: 11,
      fontWeight: '600',
      fontFamily: ff,
      textAlign: 'right',
    },
    tableCell: {
      flex: 1,
      fontSize: 12,
      fontFamily: ff,
      textAlign: 'right',
    },

    // Product ranked list row
    productRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
    },
  });
}
