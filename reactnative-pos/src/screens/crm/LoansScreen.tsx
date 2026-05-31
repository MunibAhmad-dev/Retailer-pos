import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../hooks/useTheme';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoanRow } from '../../components/shared/LoanRow';
import { MessageModal } from '../../components/shared/MessageModal';
import { getInstances, getInstanceLoans } from '../../api/instances';
import type { Instance } from '../../api/instances';
import { SCREENS } from '../../navigation/screens';
import type { CRMStackParamList } from '../../navigation/MainNavigator';

// ─── Types ────────────────────────────────────────────────────────────────────

type NavProp = NativeStackNavigationProp<CRMStackParamList, typeof SCREENS.LOANS>;

type LoanTab = 'receivables' | 'payables' | 'overdue';
type TimeFilter = 'all' | 'today' | 'week' | 'month';

interface LoanEntry {
  id: string | number;
  name: string;
  phone?: string;
  amount: number;
  balance?: number;
  type?: string;
  daysOverdue?: number;
  createdAt?: string;
}

interface Props {
  instanceId?: string | null;
  instances?: Instance[];
  onInstanceChange?: (id: string | null) => void;
  embedded?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(dateStr?: string): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function isWithin(dateStr?: string, filter: TimeFilter = 'all'): boolean {
  if (filter === 'all' || !dateStr) return true;
  const days = daysAgo(dateStr);
  if (filter === 'today') return days < 1;
  if (filter === 'week') return days <= 7;
  if (filter === 'month') return days <= 30;
  return true;
}

// ─── Store Selector ───────────────────────────────────────────────────────────

function StoreSelector({
  stores,
  selectedId,
  onSelect,
}: {
  stores: Instance[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  if (stores.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2],
        gap: spacing[2],
        flexDirection: 'row',
        alignItems: 'center',
      }}>
      {stores.map(store => {
        const active = selectedId === store.id;
        return (
          <TouchableOpacity
            key={store.id}
            onPress={() => onSelect(store.id)}
            activeOpacity={0.75}
            style={{
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[2],
              borderRadius: radius.full,
              backgroundColor: active ? colors.primary + '22' : colors.surface,
              borderWidth: 1.5,
              borderColor: active ? colors.primary + '66' : colors.border,
            }}>
            <Text
              style={{
                color: active ? colors.primary : colors.textSub,
                fontSize: typography.sizes.sm,
                fontWeight: active
                  ? typography.weights.semibold
                  : typography.weights.regular,
                fontFamily: typography.fontFamily,
              }}>
              {(store as any).name ?? (store as any).businessName ?? store.id}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  amount,
  count,
  color,
}: {
  label: string;
  amount: number;
  count: number;
  color: string;
}) {
  const { colors, typography, spacing, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color + '10',
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: color + '30',
        padding: spacing[3],
      }}>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: typography.sizes.xs,
          fontFamily: typography.fontFamily,
          marginBottom: spacing[1],
        }}>
        {label}
      </Text>
      <Text
        style={{
          color,
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.bold,
          fontFamily: typography.fontFamily,
          fontVariant: ['tabular-nums'],
        }}
        numberOfLines={1}>
        Rs {amount.toLocaleString()}
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: typography.sizes.xs,
          fontFamily: typography.fontFamily,
          marginTop: 2,
        }}>
        {count} {count === 1 ? 'party' : 'parties'}
      </Text>
    </View>
  );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────

function TabButton({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  const { colors, typography, spacing, radius } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing[3],
        borderBottomWidth: 2,
        borderBottomColor: active ? color : 'transparent',
      }}>
      <Text
        style={{
          color: active ? color : colors.textSub,
          fontSize: typography.sizes.sm,
          fontWeight: active
            ? typography.weights.semibold
            : typography.weights.regular,
          fontFamily: typography.fontFamily,
        }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Filter Chip ──────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, typography, spacing, radius } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2],
        borderRadius: radius.full,
        backgroundColor: active ? colors.primary + '22' : colors.surface,
        borderWidth: 1.5,
        borderColor: active ? colors.primary + '66' : colors.border,
      }}>
      <Text
        style={{
          color: active ? colors.primary : colors.textSub,
          fontSize: typography.sizes.sm,
          fontWeight: active
            ? typography.weights.semibold
            : typography.weights.regular,
          fontFamily: typography.fontFamily,
        }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LoansScreen({
  instanceId: propInstanceId,
  instances: propInstances,
  onInstanceChange,
  embedded = false,
}: Props) {
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const [instances, setInstances] = useState<Instance[]>(propInstances ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(
    propInstanceId ?? null,
  );

  useEffect(() => {
    if (propInstances) setInstances(propInstances);
  }, [propInstances]);
  useEffect(() => {
    if (propInstanceId !== undefined) setSelectedId(propInstanceId);
  }, [propInstanceId]);

  const handleSelectStore = (id: string | null) => {
    setSelectedId(id);
    onInstanceChange?.(id);
  };

  // Standalone: load instances
  useEffect(() => {
    if (embedded || propInstances) return;
    getInstances({ status: 'approved', limit: 100 })
      .then(res => {
        const list = res.data ?? [];
        setInstances(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch(() => {});
  }, []);

  // Loans data
  const [customerLoans, setCustomerLoans] = useState<LoanEntry[]>([]);
  const [vendorLoans, setVendorLoans] = useState<LoanEntry[]>([]);
  const [totalReceivable, setTotalReceivable] = useState(0);
  const [totalPayable, setTotalPayable] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<LoanTab>('receivables');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  // Message modal
  const [msgVisible, setMsgVisible] = useState(false);
  const [msgRecipient, setMsgRecipient] = useState<{
    name: string;
    phone: string;
    amount: number;
    type: 'customer' | 'vendor';
  } | null>(null);

  const fetchLoans = useCallback(
    async (refresh = false) => {
      if (!selectedId) return;
      refresh ? setRefreshing(true) : setLoading(true);
      try {
        const data = await getInstanceLoans(selectedId);

        // Support both API shapes
        const cLoans: LoanEntry[] = (
          (data as any).customerLoans ?? []
        ).map((l: any) => ({
          id: l.id,
          name: l.name ?? l.partyName ?? '',
          phone: l.phone,
          amount: l.balance ?? l.amount ?? 0,
          daysOverdue: l.dueDate ? daysAgo(l.dueDate) : undefined,
          createdAt: l.createdAt,
          type: 'customer',
        }));

        const vLoans: LoanEntry[] = (
          (data as any).vendorLoans ?? []
        ).map((l: any) => ({
          id: l.id,
          name: l.name ?? l.partyName ?? '',
          phone: l.phone,
          amount: l.balance ?? l.amount ?? 0,
          daysOverdue: l.dueDate ? daysAgo(l.dueDate) : undefined,
          createdAt: l.createdAt,
          type: 'vendor',
        }));

        setCustomerLoans(cLoans);
        setVendorLoans(vLoans);

        const receivable =
          (data as any).totalReceivable ??
          (data as any).totalCustomerBalance ??
          cLoans.reduce((s, l) => s + l.amount, 0);
        const payable =
          (data as any).totalPayable ??
          (data as any).totalVendorBalance ??
          vLoans.reduce((s, l) => s + l.amount, 0);

        setTotalReceivable(receivable);
        setTotalPayable(payable);
      } catch {
        setCustomerLoans([]);
        setVendorLoans([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedId],
  );

  useEffect(() => {
    setCustomerLoans([]);
    setVendorLoans([]);
    fetchLoans();
  }, [selectedId]);

  // Computed lists per tab
  const displayList = useMemo((): LoanEntry[] => {
    let base: LoanEntry[] = [];
    if (activeTab === 'receivables') base = customerLoans;
    else if (activeTab === 'payables') base = vendorLoans;
    else {
      // overdue: both lists with daysOverdue > 0
      base = [
        ...customerLoans.filter(l => (l.daysOverdue ?? 0) > 0),
        ...vendorLoans.filter(l => (l.daysOverdue ?? 0) > 0),
      ].sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0));
    }

    return base
      .filter(l => isWithin(l.createdAt, timeFilter))
      .filter(l => l.amount > 0);
  }, [activeTab, customerLoans, vendorLoans, timeFilter]);

  const overdueCount = useMemo(
    () =>
      [...customerLoans, ...vendorLoans].filter(l => (l.daysOverdue ?? 0) > 0)
        .length,
    [customerLoans, vendorLoans],
  );

  const openMsgModal = (entry: LoanEntry) => {
    if (!entry.phone) return;
    setMsgRecipient({
      name: entry.name,
      phone: entry.phone,
      amount: entry.amount,
      type: (entry.type as any) ?? 'customer',
    });
    setMsgVisible(true);
  };

  const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
  ];

  const ListHeader = (
    <View>
      {/* Store selector */}
      <StoreSelector
        stores={instances}
        selectedId={selectedId}
        onSelect={handleSelectStore}
      />

      {/* Summary cards */}
      <View
        style={{
          flexDirection: 'row',
          gap: spacing[3],
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
        }}>
        <SummaryCard
          label="Receivable"
          amount={totalReceivable}
          count={customerLoans.filter(l => l.amount > 0).length}
          color={colors.success}
        />
        <SummaryCard
          label="Payable"
          amount={totalPayable}
          count={vendorLoans.filter(l => l.amount > 0).length}
          color={colors.danger}
        />
        <SummaryCard
          label="Overdue"
          amount={[...customerLoans, ...vendorLoans]
            .filter(l => (l.daysOverdue ?? 0) > 0)
            .reduce((s, l) => s + l.amount, 0)}
          count={overdueCount}
          color={colors.warning}
        />
      </View>

      {/* Tab bar */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: spacing[4],
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          marginBottom: spacing[3],
        }}>
        <TabButton
          label="Receivables"
          active={activeTab === 'receivables'}
          color={colors.success}
          onPress={() => setActiveTab('receivables')}
        />
        <TabButton
          label="Payables"
          active={activeTab === 'payables'}
          color={colors.danger}
          onPress={() => setActiveTab('payables')}
        />
        <TabButton
          label={`Overdue${overdueCount > 0 ? ` (${overdueCount})` : ''}`}
          active={activeTab === 'overdue'}
          color={colors.warning}
          onPress={() => setActiveTab('overdue')}
        />
      </View>

      {/* Time filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing[4],
          gap: spacing[2],
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: spacing[3],
        }}>
        {TIME_FILTERS.map(f => (
          <FilterChip
            key={f.key}
            label={f.label}
            active={timeFilter === f.key}
            onPress={() => setTimeFilter(f.key)}
          />
        ))}
      </ScrollView>
    </View>
  );

  if (loading && customerLoans.length === 0 && vendorLoans.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {!embedded && <ScreenHeader title="Loans" navigation={navigation} />}
        <StoreSelector
          stores={instances}
          selectedId={selectedId}
          onSelect={handleSelectStore}
        />
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {!embedded && <ScreenHeader title="Loans" navigation={navigation} />}

      <FlatList
        data={displayList}
        keyExtractor={item => `${item.type ?? 'loan'}-${item.id}`}
        renderItem={({ item }) => (
          <LoanRow
            name={item.name}
            balance={item.amount}
            phone={item.phone}
            daysOverdue={item.daysOverdue}
            type={
              activeTab === 'payables'
                ? 'vendor'
                : activeTab === 'overdue'
                ? (item.type as any) ?? 'customer'
                : 'customer'
            }
            style={{
              marginHorizontal: spacing[4],
              marginBottom: spacing[3],
            }}
            onPress={() => {
              // Navigate to customer or vendor detail if applicable
            }}
            onMessage={item.phone ? () => openMsgModal(item) : undefined}
          />
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <EmptyState
            title={selectedId ? `No ${activeTab} found` : 'Select a store'}
            subtitle={
              selectedId
                ? `No ${activeTab} entries for the selected period`
                : 'Pick a store above to view loans'
            }
          />
        }
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchLoans(true)}
            tintColor={colors.primary}
          />
        }
      />

      {msgRecipient && (
        <MessageModal
          visible={msgVisible}
          onClose={() => {
            setMsgVisible(false);
            setMsgRecipient(null);
          }}
          recipient={{ name: msgRecipient.name, phone: msgRecipient.phone }}
          type={msgRecipient.type}
          amount={msgRecipient.amount}
          templateType="reminder"
        />
      )}
    </View>
  );
}

// ─── Screen Header ────────────────────────────────────────────────────────────

function ScreenHeader({
  title,
  navigation,
}: {
  title: string;
  navigation: NavProp;
}) {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + (Platform.OS === 'android' ? 8 : 0),
        paddingHorizontal: spacing[4],
        paddingBottom: spacing[3],
        backgroundColor: colors.bg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
      }}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '300' }}>
          ‹
        </Text>
      </TouchableOpacity>
      <Text
        style={{
          color: colors.text,
          fontSize: typography.sizes.xl,
          fontWeight: typography.weights.bold,
          fontFamily: typography.fontFamily,
        }}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({});

export default LoansScreen;
