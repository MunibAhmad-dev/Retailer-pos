import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {useTheme} from '../../hooks/useTheme';
import {useFormatCurrency} from '../../hooks/useFormatCurrency';
import {SearchBar} from '../../components/ui/SearchBar';
import {Skeleton} from '../../components/ui/Skeleton';
import {EmptyState} from '../../components/ui/EmptyState';
import {getInstances, getInstanceProducts} from '../../api/instances';
import type {Instance, Product} from '../../api/instances';
import {SCREENS} from '../../navigation/screens';
import type {InventoryStackParamList} from '../../navigation/MainNavigator';

// ─── Types ────────────────────────────────────────────────────────────────────

type NavProp = NativeStackNavigationProp<InventoryStackParamList, typeof SCREENS.INVENTORY>;

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

interface InventoryStats {
  total: number;
  outOfStock: number;
  lowStock: number;
  totalValue: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stockStatus(stock: number): 'out' | 'low' | 'ok' {
  if (stock <= 0) return 'out';
  if (stock < 10) return 'low';
  return 'ok';
}

function colorFromName(name: string, palette: string[]): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatChipProps {
  label: string;
  value: string | number;
  accent: string;
}

function StatChip({label, value, accent}: StatChipProps) {
  const {colors, spacing, radius, typography} = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing[3],
        minWidth: 80,
      }}>
      <Text
        style={{
          color: accent,
          fontSize: typography.sizes['2xl'],
          fontWeight: typography.weights.bold,
          fontFamily: typography.fontFamily,
          fontVariant: ['tabular-nums'],
        }}
        numberOfLines={1}>
        {value}
      </Text>
      <Text
        style={{
          color: colors.textSub,
          fontSize: typography.sizes.xs,
          fontFamily: typography.fontFamily,
          marginTop: 2,
        }}>
        {label}
      </Text>
    </View>
  );
}

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  accent?: string;
}

function FilterChip({label, active, onPress, accent}: FilterChipProps) {
  const {colors, spacing, radius, typography} = useTheme();
  const bg = active
    ? (accent ?? colors.primary) + '22'
    : colors.surface;
  const borderColor = active ? (accent ?? colors.primary) + '66' : colors.border;
  const textColor = active ? (accent ?? colors.primary) : colors.textSub;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2],
        borderRadius: radius.full,
        backgroundColor: bg,
        borderWidth: 1.5,
        borderColor,
      }}>
      <Text
        style={{
          color: textColor,
          fontSize: typography.sizes.sm,
          fontWeight: active ? typography.weights.semibold : typography.weights.regular,
          fontFamily: typography.fontFamily,
        }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Product Row ──────────────────────────────────────────────────────────────

interface ProductRowProps {
  product: Product;
  onPress: () => void;
}

function ProductRow({product, onPress}: ProductRowProps) {
  const {colors, spacing, radius, typography} = useTheme();
  const {formatPKR} = useFormatCurrency();

  const name = product.name ?? '';
  const avatarBg = colorFromName(name, AVATAR_PALETTE);
  const initials = getInitials(name);
  const status = stockStatus(product.stock ?? 0);

  const stockColor =
    status === 'out'
      ? colors.danger
      : status === 'low'
      ? colors.warning
      : colors.success;

  const stockLabel =
    status === 'out'
      ? 'Out of Stock'
      : status === 'low'
      ? `Low: ${product.stock}`
      : `${product.stock} in stock`;

  const salePrice = (product as any).salePrice ?? (product as any).price ?? 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
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
      {/* Color Avatar */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: avatarBg,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
        <Text
          style={{
            color: '#fff',
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.bold,
            fontFamily: typography.fontFamily,
          }}>
          {initials}
        </Text>
      </View>

      {/* Name + Category */}
      <View style={{flex: 1, minWidth: 0}}>
        <Text
          style={{
            color: colors.text,
            fontSize: typography.sizes.base,
            fontWeight: typography.weights.semibold,
            fontFamily: typography.fontFamily,
          }}
          numberOfLines={1}>
          {name}
        </Text>
        {product.category ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 3,
            }}>
            <View
              style={{
                backgroundColor: colors.primary + '1a',
                borderColor: colors.primary + '40',
                borderWidth: 1,
                borderRadius: 999,
                paddingHorizontal: 7,
                paddingVertical: 1,
                alignSelf: 'flex-start',
              }}>
              <Text
                style={{
                  color: colors.primary,
                  fontSize: typography.sizes.xs,
                  fontWeight: typography.weights.medium,
                  fontFamily: typography.fontFamily,
                }}>
                {product.category}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Right: stock pill + price */}
      <View style={{alignItems: 'flex-end', gap: 4, flexShrink: 0}}>
        {/* Stock pill */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: stockColor + '18',
            borderColor: stockColor + '44',
            borderWidth: 1,
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: stockColor,
            }}
          />
          <Text
            style={{
              color: stockColor,
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.semibold,
              fontFamily: typography.fontFamily,
            }}>
            {stockLabel}
          </Text>
        </View>

        {/* Sale price */}
        <Text
          style={{
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.bold,
            fontFamily: typography.fontFamily,
            fontVariant: ['tabular-nums'],
          }}>
          {formatPKR(salePrice)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Skeleton Row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  const {colors, spacing, radius} = useTheme();
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
      <View style={{flex: 1, gap: spacing[2]}}>
        <Skeleton width="65%" height={14} />
        <Skeleton width="40%" height={11} />
      </View>
      <View style={{alignItems: 'flex-end', gap: spacing[2]}}>
        <Skeleton width={80} height={22} borderRadius={999} />
        <Skeleton width={60} height={13} />
      </View>
    </View>
  );
}

// ─── Store Selector ───────────────────────────────────────────────────────────

interface StoreSelectorProps {
  stores: Instance[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function StoreSelector({stores, selectedId, onSelect}: StoreSelectorProps) {
  const {colors, spacing, radius, typography} = useTheme();

  if (stores.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: spacing[4],
        gap: spacing[2],
        flexDirection: 'row',
        alignItems: 'center',
      }}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => onSelect(null)}
        style={{
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
          borderRadius: radius.full,
          backgroundColor: selectedId === null ? colors.primary + '22' : colors.surface,
          borderWidth: 1.5,
          borderColor: selectedId === null ? colors.primary + '66' : colors.border,
        }}>
        <Text
          style={{
            color: selectedId === null ? colors.primary : colors.textSub,
            fontSize: typography.sizes.sm,
            fontWeight: selectedId === null ? typography.weights.semibold : typography.weights.regular,
            fontFamily: typography.fontFamily,
          }}>
          All Stores
        </Text>
      </TouchableOpacity>

      {stores.map(store => {
        const active = selectedId === store.id;
        return (
          <TouchableOpacity
            key={store.id}
            activeOpacity={0.75}
            onPress={() => onSelect(store.id)}
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
                fontWeight: active ? typography.weights.semibold : typography.weights.regular,
                fontFamily: typography.fontFamily,
              }}
              numberOfLines={1}>
              {store.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function InventoryScreen() {
  const {colors, spacing, radius, typography} = useTheme();
  const {formatPKR} = useFormatCurrency();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  // ── State ──────────────────────────────────────────────────────────────────
  const [stores, setStores] = useState<Instance[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<StockFilter>('all');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const storesRes = await getInstances({status: 'approved', limit: 100});
      const storeList = storesRes.data ?? [];
      setStores(storeList);

      // Fetch products from selected store or first available store
      const targetId = selectedStoreId ?? storeList[0]?.id ?? null;
      if (!targetId) {
        setAllProducts([]);
        return;
      }

      const products = await getInstanceProducts(targetId);
      setAllProducts(Array.isArray(products) ? products : []);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived Stats ──────────────────────────────────────────────────────────
  const stats = useMemo<InventoryStats>(() => {
    return allProducts.reduce<InventoryStats>(
      (acc, p) => {
        const stock = p.stock ?? 0;
        const salePrice = (p as any).salePrice ?? (p as any).price ?? 0;
        acc.total += 1;
        if (stock <= 0) acc.outOfStock += 1;
        else if (stock < 10) acc.lowStock += 1;
        acc.totalValue += stock * salePrice;
        return acc;
      },
      {total: 0, outOfStock: 0, lowStock: 0, totalValue: 0},
    );
  }, [allProducts]);

  // ── Filtered List ──────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    return allProducts.filter(p => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const stock = p.stock ?? 0;
      switch (activeFilter) {
        case 'in_stock':
          return stock >= 10;
        case 'low_stock':
          return stock > 0 && stock < 10;
        case 'out_of_stock':
          return stock <= 0;
        default:
          return true;
      }
    });
  }, [allProducts, search, activeFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleProductPress = useCallback(
    (product: Product) => {
      navigation.navigate(SCREENS.PRODUCT_DETAIL, {
        productId: String(product.id),
        product,
      });
    },
    [navigation],
  );

  const handleStoreSelect = useCallback((id: string | null) => {
    setSelectedStoreId(id);
  }, []);

  // ── Render Item ────────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({item}: {item: Product}) => (
      <ProductRow
        product={item}
        onPress={() => handleProductPress(item)}
      />
    ),
    [handleProductPress],
  );

  const keyExtractor = useCallback(
    (item: Product) => String(item.id),
    [],
  );

  const ItemSeparator = useCallback(
    () => <View style={{height: spacing[2]}} />,
    [spacing],
  );

  // ── Bottom padding for floating tab bar ───────────────────────────────────
  const bottomPad = insets.bottom + 64 + 16; // tab bar height + margin

  // ── Loading skeleton ──────────────────────────────────────────────────────
  const renderSkeleton = () => (
    <View style={{paddingHorizontal: spacing[4], gap: spacing[2]}}>
      {Array.from({length: 10}).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );

  return (
    <View style={{flex: 1, backgroundColor: colors.bg}}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + spacing[2],
          paddingBottom: spacing[3],
          paddingHorizontal: spacing[4],
          backgroundColor: colors.bg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: spacing[3],
        }}>
        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
          <Text
            style={{
              color: colors.text,
              fontSize: typography.sizes.xl,
              fontWeight: typography.weights.bold,
              fontFamily: typography.fontFamily,
            }}>
            Inventory
          </Text>
          <View
            style={{
              backgroundColor: colors.primary + '18',
              borderRadius: radius.full,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[1],
            }}>
            <Text
              style={{
                color: colors.primary,
                fontSize: typography.sizes.xs,
                fontWeight: typography.weights.semibold,
                fontFamily: typography.fontFamily,
              }}>
              {stats.total} products
            </Text>
          </View>
        </View>

        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search products, categories..."
        />
      </View>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <FlatList
        data={loading ? [] : filteredProducts}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={ItemSeparator}
        contentContainerStyle={{
          paddingHorizontal: spacing[4],
          paddingTop: spacing[3],
          paddingBottom: bottomPad,
          gap: 0,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {/* Quick Stats Row */}
            <View style={{flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3]}}>
              <StatChip
                label="Total"
                value={stats.total}
                accent={colors.primary}
              />
              <StatChip
                label="Out of Stock"
                value={stats.outOfStock}
                accent={colors.danger}
              />
              <StatChip
                label="Low Stock"
                value={stats.lowStock}
                accent={colors.warning}
              />
            </View>

            {/* Total Value full width */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing[3],
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing[3],
              }}>
              <Text
                style={{
                  color: colors.textSub,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fontFamily,
                }}>
                Total Inventory Value
              </Text>
              <Text
                style={{
                  color: colors.success,
                  fontSize: typography.sizes.lg,
                  fontWeight: typography.weights.bold,
                  fontFamily: typography.fontFamily,
                  fontVariant: ['tabular-nums'],
                }}>
                {formatPKR(stats.totalValue)}
              </Text>
            </View>

            {/* Store Selector */}
            {stores.length > 1 && (
              <View style={{marginHorizontal: -spacing[4], marginBottom: spacing[3]}}>
                <StoreSelector
                  stores={stores}
                  selectedId={selectedStoreId}
                  onSelect={handleStoreSelect}
                />
              </View>
            )}

            {/* Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{marginBottom: spacing[3]}}
              contentContainerStyle={{gap: spacing[2], flexDirection: 'row', alignItems: 'center'}}>
              <FilterChip
                label="All"
                active={activeFilter === 'all'}
                onPress={() => setActiveFilter('all')}
              />
              <FilterChip
                label="In Stock"
                active={activeFilter === 'in_stock'}
                onPress={() => setActiveFilter('in_stock')}
                accent={colors.success}
              />
              <FilterChip
                label="Low Stock"
                active={activeFilter === 'low_stock'}
                onPress={() => setActiveFilter('low_stock')}
                accent={colors.warning}
              />
              <FilterChip
                label="Out of Stock"
                active={activeFilter === 'out_of_stock'}
                onPress={() => setActiveFilter('out_of_stock')}
                accent={colors.danger}
              />
            </ScrollView>

            {/* Loading skeletons */}
            {loading && renderSkeleton()}

            {/* Error Banner */}
            {error && !loading && (
              <View
                style={{
                  backgroundColor: colors.danger + '18',
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.danger + '44',
                  padding: spacing[3],
                  marginBottom: spacing[3],
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[2],
                }}>
                <Text style={{fontSize: 15}}>⚠</Text>
                <Text
                  style={{
                    flex: 1,
                    color: colors.danger,
                    fontSize: typography.sizes.sm,
                    fontFamily: typography.fontFamily,
                  }}>
                  {error}
                </Text>
                <TouchableOpacity onPress={fetchData}>
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: typography.sizes.sm,
                      fontWeight: typography.weights.semibold,
                      fontFamily: typography.fontFamily,
                    }}>
                    Retry
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <EmptyState
              title={search ? 'No products found' : 'No inventory data'}
              description={
                search
                  ? `No products match "${search}". Try a different search term.`
                  : 'No products are available for this store yet.'
              }
              action={
                search
                  ? {label: 'Clear search', onPress: () => setSearch(''), variant: 'outline'}
                  : undefined
              }
            />
          ) : null
        }
      />
    </View>
  );
}
