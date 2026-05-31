import React, {useMemo} from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';

import {useTheme} from '../../hooks/useTheme';
import {useFormatCurrency} from '../../hooks/useFormatCurrency';
import {Divider} from '../../components/ui/Divider';
import {SCREENS} from '../../navigation/screens';
import type {InventoryStackParamList} from '../../navigation/MainNavigator';
import type {Product} from '../../api/instances';

// ─── Nav types ────────────────────────────────────────────────────────────────

type NavProp = NativeStackNavigationProp<InventoryStackParamList, typeof SCREENS.PRODUCT_DETAIL>;
type DetailRouteProp = RouteProp<InventoryStackParamList, typeof SCREENS.PRODUCT_DETAIL>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
];

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function calcMargin(cost: number, sale: number): number {
  if (!sale || sale <= 0) return 0;
  return ((sale - cost) / sale) * 100;
}

function stockStatus(stock: number): 'out' | 'low' | 'ok' {
  if (stock <= 0) return 'out';
  if (stock < 10) return 'low';
  return 'ok';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatGridItemProps {
  label: string;
  value: string;
  accent?: string;
  mono?: boolean;
}

function StatGridItem({label, value, accent, mono}: StatGridItemProps) {
  const {colors, spacing, radius, typography} = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: '45%',
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing[4],
      }}>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: typography.sizes.xs,
          fontFamily: typography.fontFamily,
          marginBottom: 4,
        }}>
        {label}
      </Text>
      <Text
        style={{
          color: accent ?? colors.text,
          fontSize: typography.sizes.xl,
          fontWeight: typography.weights.bold,
          fontFamily: mono ? Platform.OS === 'android' ? 'monospace' : 'Courier' : typography.fontFamily,
          fontVariant: ['tabular-nums'],
        }}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

interface PriceRowProps {
  label: string;
  value: string;
  accent?: string;
  bordered?: boolean;
}

function PriceRow({label, value, accent, bordered}: PriceRowProps) {
  const {colors, spacing, typography} = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing[3],
        borderTopWidth: bordered ? StyleSheet.hairlineWidth : 0,
        borderTopColor: colors.border,
      }}>
      <Text
        style={{
          color: colors.textSub,
          fontSize: typography.sizes.base,
          fontFamily: typography.fontFamily,
        }}>
        {label}
      </Text>
      <Text
        style={{
          color: accent ?? colors.text,
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.semibold,
          fontFamily: typography.fontFamily,
          fontVariant: ['tabular-nums'],
        }}>
        {value}
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProductDetailScreen() {
  const {colors, spacing, radius, typography, isDark} = useTheme();
  const {formatPKR} = useFormatCurrency();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<DetailRouteProp>();

  // Product object is passed directly from the inventory list for instant display.
  // productId is also available for future deep-link / refresh scenarios.
  const product = route.params?.product as Product | undefined;

  const name = product?.name ?? 'Unknown Product';
  const category = product?.category ?? null;
  const stock = product?.stock ?? 0;
  const costPrice = (product as any)?.costPrice ?? 0;
  const salePrice = (product as any)?.salePrice ?? (product as any)?.price ?? 0;
  const barcode = product?.barcode ?? null;

  const avatarBg = colorFromName(name);
  const initials = getInitials(name);
  const status = stockStatus(stock);
  const marginPct = calcMargin(costPrice, salePrice);
  const grossProfit = salePrice - costPrice;
  const stockValue = stock * salePrice;

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
      ? `Low Stock — ${stock} remaining`
      : `In Stock — ${stock} units`;

  // Stock level bar: cap at 100 units for visual
  const barMax = Math.max(stock, 100);
  const barFill = Math.min(stock / barMax, 1);

  // Shadow style
  const shadowStyle =
    Platform.OS === 'android'
      ? {elevation: 6}
      : {
          shadowColor: isDark ? '#000' : '#1a1a2e',
          shadowOffset: {width: 0, height: 3},
          shadowOpacity: isDark ? 0.35 : 0.12,
          shadowRadius: 8,
        };

  return (
    <View style={{flex: 1, backgroundColor: colors.bg}}>
      {/* ── Back Header ──────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + spacing[2],
          paddingBottom: spacing[3],
          paddingHorizontal: spacing[4],
          backgroundColor: colors.bg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[3],
        }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.md,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
          }}>
          <Text
            style={{
              color: colors.text,
              fontSize: 20,
              fontWeight: '300',
              lineHeight: 24,
            }}>
            ‹
          </Text>
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            color: colors.text,
            fontSize: typography.sizes.lg,
            fontWeight: typography.weights.semibold,
            fontFamily: typography.fontFamily,
          }}
          numberOfLines={1}>
          Product Detail
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 64 + spacing[8],
        }}>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <View
          style={{
            alignItems: 'center',
            paddingTop: spacing[8],
            paddingBottom: spacing[6],
            paddingHorizontal: spacing[4],
          }}>
          {/* Gradient-feel avatar */}
          <View
            style={[
              {
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: avatarBg,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing[4],
              },
              shadowStyle,
            ]}>
            {/* Inner lighter ring for depth */}
            <View
              style={{
                position: 'absolute',
                width: 80,
                height: 80,
                borderRadius: 40,
                borderWidth: 2,
                borderColor: '#ffffff18',
              }}
            />
            <Text
              style={{
                color: '#fff',
                fontSize: 28,
                fontWeight: '700',
                fontFamily: typography.fontFamily,
              }}>
              {initials}
            </Text>
          </View>

          {/* Product Name */}
          <Text
            style={{
              color: colors.text,
              fontSize: typography.sizes['2xl'],
              fontWeight: typography.weights.bold,
              fontFamily: typography.fontFamily,
              textAlign: 'center',
              marginBottom: spacing[2],
            }}>
            {name}
          </Text>

          {/* Badges row */}
          <View style={{flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap', justifyContent: 'center'}}>
            {category ? (
              <View
                style={{
                  backgroundColor: colors.primary + '1a',
                  borderColor: colors.primary + '44',
                  borderWidth: 1,
                  borderRadius: 999,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                }}>
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: typography.sizes.sm,
                    fontWeight: typography.weights.medium,
                    fontFamily: typography.fontFamily,
                  }}>
                  {category}
                </Text>
              </View>
            ) : null}

            <View
              style={{
                backgroundColor: stockColor + '18',
                borderColor: stockColor + '44',
                borderWidth: 1,
                borderRadius: 999,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[1],
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
              }}>
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: stockColor,
                }}
              />
              <Text
                style={{
                  color: stockColor,
                  fontSize: typography.sizes.sm,
                  fontWeight: typography.weights.semibold,
                  fontFamily: typography.fontFamily,
                }}>
                {stockLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Stats Grid ───────────────────────────────────────────────────── */}
        <View style={{paddingHorizontal: spacing[4], gap: spacing[3]}}>
          <View style={{flexDirection: 'row', gap: spacing[3]}}>
            <StatGridItem
              label="Current Stock"
              value={String(stock)}
              accent={stockColor}
            />
            <StatGridItem
              label="Sale Price"
              value={formatPKR(salePrice)}
              accent={colors.text}
            />
          </View>
          <View style={{flexDirection: 'row', gap: spacing[3]}}>
            <StatGridItem
              label="Cost Price"
              value={formatPKR(costPrice)}
            />
            <StatGridItem
              label="Profit Margin"
              value={`${marginPct.toFixed(1)}%`}
              accent={marginPct >= 0 ? colors.success : colors.danger}
            />
          </View>

          {/* Stock Value full-width */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing[4],
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <Text
              style={{
                color: colors.textSub,
                fontSize: typography.sizes.base,
                fontFamily: typography.fontFamily,
              }}>
              Total Stock Value
            </Text>
            <Text
              style={{
                color: colors.success,
                fontSize: typography.sizes.xl,
                fontWeight: typography.weights.bold,
                fontFamily: typography.fontFamily,
                fontVariant: ['tabular-nums'],
              }}>
              {formatPKR(stockValue)}
            </Text>
          </View>

          {/* ── Stock Level Bar ──────────────────────────────────────────────── */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing[4],
              gap: spacing[2],
            }}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
              <Text
                style={{
                  color: colors.textSub,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fontFamily,
                }}>
                Stock Level
              </Text>
              <Text
                style={{
                  color: stockColor,
                  fontSize: typography.sizes.sm,
                  fontWeight: typography.weights.semibold,
                  fontFamily: typography.fontFamily,
                }}>
                {status === 'out' ? 'Critical' : status === 'low' ? 'Low' : 'Healthy'}
              </Text>
            </View>

            {/* Bar track */}
            <View
              style={{
                height: 8,
                backgroundColor: colors.elevated,
                borderRadius: 4,
                overflow: 'hidden',
              }}>
              <View
                style={{
                  height: 8,
                  width: `${barFill * 100}%`,
                  backgroundColor: stockColor,
                  borderRadius: 4,
                }}
              />
            </View>

            <Text
              style={{
                color: colors.textMuted,
                fontSize: typography.sizes.xs,
                fontFamily: typography.fontFamily,
              }}>
              {stock} units available
            </Text>
          </View>

          {/* ── Price Breakdown Card ─────────────────────────────────────────── */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing[4],
              paddingTop: spacing[3],
              paddingBottom: spacing[1],
            }}>
            <Text
              style={{
                color: colors.text,
                fontSize: typography.sizes.base,
                fontWeight: typography.weights.semibold,
                fontFamily: typography.fontFamily,
                marginBottom: spacing[1],
              }}>
              Price Breakdown
            </Text>

            <PriceRow label="Sale Price" value={formatPKR(salePrice)} />
            <PriceRow label="Cost Price" value={formatPKR(costPrice)} bordered />
            <PriceRow
              label="Gross Profit"
              value={formatPKR(grossProfit)}
              accent={grossProfit >= 0 ? colors.success : colors.danger}
              bordered
            />
            <PriceRow
              label="Margin"
              value={`${marginPct.toFixed(2)}%`}
              accent={marginPct >= 0 ? colors.success : colors.danger}
              bordered
            />
          </View>

          {/* ── Barcode ──────────────────────────────────────────────────────── */}
          {barcode ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing[4],
                gap: spacing[2],
              }}>
              <Text
                style={{
                  color: colors.textSub,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fontFamily,
                }}>
                Barcode / SKU
              </Text>
              <View
                style={{
                  backgroundColor: colors.elevated,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: typography.sizes.lg,
                    fontFamily:
                      Platform.OS === 'android' ? 'monospace' : 'Courier New',
                    letterSpacing: 3,
                    textAlign: 'center',
                  }}>
                  {barcode}
                </Text>
              </View>
            </View>
          ) : null}

          {/* ── SKU (if separate from barcode) ───────────────────────────────── */}
          {(product as any)?.sku && (product as any)?.sku !== barcode ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing[4],
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
              <Text
                style={{
                  color: colors.textSub,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fontFamily,
                }}>
                SKU
              </Text>
              <Text
                style={{
                  color: colors.text,
                  fontSize: typography.sizes.base,
                  fontWeight: typography.weights.medium,
                  fontFamily:
                    Platform.OS === 'android' ? 'monospace' : 'Courier New',
                  letterSpacing: 1,
                }}>
                {(product as any).sku}
              </Text>
            </View>
          ) : null}

          {/* ── Unit ─────────────────────────────────────────────────────────── */}
          {(product as any)?.unit ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing[4],
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
              <Text
                style={{
                  color: colors.textSub,
                  fontSize: typography.sizes.sm,
                  fontFamily: typography.fontFamily,
                }}>
                Unit of Measure
              </Text>
              <Text
                style={{
                  color: colors.text,
                  fontSize: typography.sizes.base,
                  fontWeight: typography.weights.medium,
                  fontFamily: typography.fontFamily,
                }}>
                {(product as any).unit}
              </Text>
            </View>
          ) : null}

          {/* ── Metadata row ─────────────────────────────────────────────────── */}
          {product?.createdAt ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: spacing[2],
                paddingBottom: spacing[2],
              }}>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: typography.sizes.xs,
                  fontFamily: typography.fontFamily,
                }}>
                Added {new Date(product.createdAt).toLocaleDateString()}
              </Text>
              {product?.updatedAt && product.updatedAt !== product.createdAt ? (
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: typography.sizes.xs,
                    fontFamily: typography.fontFamily,
                  }}>
                  Updated {new Date(product.updatedAt).toLocaleDateString()}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
