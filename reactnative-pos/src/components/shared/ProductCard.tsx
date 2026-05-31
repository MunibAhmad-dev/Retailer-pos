import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Product } from '../../types/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductCardProps {
  product: Product;
  onPress?: () => void;
  style?: ViewStyle;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stockStatus(
  stock: number,
): 'out' | 'low' | 'ok' {
  if (stock <= 0) return 'out';
  if (stock < 10) return 'low';
  return 'ok';
}

function stockLabel(stock: number): string {
  if (stock <= 0) return 'Out of Stock';
  if (stock < 10) return `Low: ${stock} left`;
  return `${stock} in stock`;
}

function margin(cost: number, sale: number): string {
  if (cost <= 0) return '-';
  const pct = ((sale - cost) / cost) * 100;
  return `${pct.toFixed(0)}%`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductCard({ product, onPress, style }: ProductCardProps) {
  const { colors, typography, spacing, radius } = useTheme();

  const status = stockStatus(product.stock);
  const stockColor =
    status === 'out'
      ? colors.danger
      : status === 'low'
      ? colors.warning
      : colors.success;

  const marginPct = margin(product.costPrice, product.salePrice);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing[4],
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {/* Left: name + category */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.text,
              fontSize: typography.sizes.base,
              fontWeight: typography.weights.semibold,
            }}
            numberOfLines={1}
          >
            {product.name}
          </Text>

          {product.category ? (
            <View
              style={[
                styles.categoryBadge,
                { backgroundColor: colors.primary + '1a', borderColor: colors.primary + '33' },
              ]}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: typography.sizes.xs,
                  fontWeight: typography.weights.medium,
                }}
              >
                {product.category}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Right: stock indicator */}
        <View
          style={[
            styles.stockBadge,
            {
              backgroundColor: stockColor + '1a',
              borderColor: stockColor + '33',
            },
          ]}
        >
          <View style={[styles.stockDot, { backgroundColor: stockColor }]} />
          <Text
            style={{
              color: stockColor,
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.semibold,
            }}
          >
            {stockLabel(product.stock)}
          </Text>
        </View>
      </View>

      {/* Price row */}
      <View style={[styles.row, { marginTop: spacing[3] }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textMuted, fontSize: typography.sizes.xs }}>
            Cost
          </Text>
          <Text
            style={{
              color: colors.textSub,
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.medium,
              fontVariant: ['tabular-nums'],
            }}
          >
            Rs {product.costPrice.toLocaleString()}
          </Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: colors.textMuted, fontSize: typography.sizes.xs }}>
            Margin
          </Text>
          <Text
            style={{
              color: colors.success,
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.bold,
            }}
          >
            {marginPct}
          </Text>
        </View>

        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={{ color: colors.textMuted, fontSize: typography.sizes.xs }}>
            Sale Price
          </Text>
          <Text
            style={{
              color: colors.text,
              fontSize: typography.sizes.base,
              fontWeight: typography.weights.bold,
              fontVariant: ['tabular-nums'],
            }}
          >
            Rs {product.salePrice.toLocaleString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 4,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default ProductCard;
