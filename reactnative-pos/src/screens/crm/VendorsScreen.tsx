import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../hooks/useTheme';
import { SearchBar } from '../../components/ui/SearchBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { VendorCard } from '../../components/shared/VendorCard';
import { getInstances, getInstanceVendors } from '../../api/instances';
import type { Instance, Vendor } from '../../api/instances';
import { SCREENS } from '../../navigation/screens';
import type { CRMStackParamList } from '../../navigation/MainNavigator';

// ─── Types ────────────────────────────────────────────────────────────────────

type NavProp = NativeStackNavigationProp<CRMStackParamList, typeof SCREENS.VENDORS>;

interface Props {
  instanceId?: string | null;
  instances?: Instance[];
  onInstanceChange?: (id: string | null) => void;
  embedded?: boolean;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function VendorSkeleton() {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing[4],
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
      }}>
      <Skeleton width={44} height={44} borderRadius={22} />
      <View style={{ flex: 1, gap: spacing[2] }}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="38%" height={11} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: spacing[2] }}>
        <Skeleton width={70} height={14} />
        <Skeleton width={40} height={11} />
      </View>
    </View>
  );
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
              backgroundColor: active ? colors.accent + '22' : colors.surface,
              borderWidth: 1.5,
              borderColor: active ? colors.accent + '66' : colors.border,
            }}>
            <Text
              style={{
                color: active ? colors.accent : colors.textSub,
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

// ─── Summary Pill ─────────────────────────────────────────────────────────────

function SummaryPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const { colors, typography, spacing, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color + '12',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: color + '30',
        paddingVertical: spacing[2],
        paddingHorizontal: spacing[3],
      }}>
      <Text
        style={{
          color,
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.bold,
          fontFamily: typography.fontFamily,
          fontVariant: ['tabular-nums'],
        }}
        numberOfLines={1}>
        {value}
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: typography.sizes.xs,
          fontFamily: typography.fontFamily,
        }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VendorsScreen({
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

  // Fetch instances (standalone)
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

  // Vendors data
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const fetchVendors = useCallback(
    async (refresh = false) => {
      if (!selectedId) return;
      refresh ? setRefreshing(true) : setLoading(true);
      try {
        const data = await getInstanceVendors(selectedId);
        setVendors(Array.isArray(data) ? data : []);
      } catch {
        setVendors([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedId],
  );

  useEffect(() => {
    setVendors([]);
    fetchVendors();
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return vendors
      .filter(
        v =>
          v.name.toLowerCase().includes(q) ||
          (v.phone ?? '').includes(q),
      )
      .sort((a, b) => b.balance - a.balance);
  }, [vendors, query]);

  const totalPayable = useMemo(
    () => filtered.reduce((sum, v) => sum + (v.balance > 0 ? v.balance : 0), 0),
    [filtered],
  );

  const ListHeader = (
    <View>
      <StoreSelector
        stores={instances}
        selectedId={selectedId}
        onSelect={handleSelectStore}
      />
      <View style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[2] }}>
        <SearchBar
          placeholder="Search vendors..."
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: spacing[4],
          gap: spacing[3],
          marginBottom: spacing[2],
        }}>
        <SummaryPill
          label="Total"
          value={String(filtered.length)}
          color={colors.accent}
        />
        <SummaryPill
          label="Total Payable"
          value={`Rs ${totalPayable.toLocaleString()}`}
          color={colors.warning}
        />
      </View>
    </View>
  );

  if (loading && vendors.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {!embedded && (
          <ScreenHeader title="Vendors" navigation={navigation} />
        )}
        <StoreSelector
          stores={instances}
          selectedId={selectedId}
          onSelect={handleSelectStore}
        />
        <View
          style={{
            flex: 1,
            paddingHorizontal: spacing[4],
            paddingTop: spacing[3],
            gap: spacing[3],
          }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <VendorSkeleton key={i} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {!embedded && <ScreenHeader title="Vendors" navigation={navigation} />}

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <VendorCard
            vendor={item}
            style={{ marginHorizontal: spacing[4], marginBottom: spacing[3] }}
            onPress={() =>
              navigation.navigate(SCREENS.VENDOR_DETAIL, {
                vendorId: String(item.id),
              })
            }
          />
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <EmptyState
            title={selectedId ? 'No vendors found' : 'Select a store'}
            subtitle={
              selectedId
                ? query
                  ? 'Try a different search term'
                  : 'No vendors have been added yet'
                : 'Pick a store above to view its vendors'
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
            onRefresh={() => fetchVendors(true)}
            tintColor={colors.accent}
          />
        }
      />
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

export default VendorsScreen;
