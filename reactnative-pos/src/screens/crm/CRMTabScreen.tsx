import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { getInstances, getInstanceLoans } from '../../api/instances';
import type { Instance } from '../../api/instances';
import CustomersScreen from './CustomersScreen';
import VendorsScreen from './VendorsScreen';
import LoansScreen from './LoansScreen';

// ─── Types ────────────────────────────────────────────────────────────────────

type Segment = 'customers' | 'vendors' | 'loans';

// ─── Component ────────────────────────────────────────────────────────────────

export function CRMTabScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const [segment, setSegment] = useState<Segment>('customers');
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  // Loan summary totals
  const [totalReceivable, setTotalReceivable] = useState(0);
  const [totalPayable, setTotalPayable] = useState(0);
  const [loansLoading, setLoansLoading] = useState(false);

  // Load instances once
  useEffect(() => {
    getInstances({ status: 'approved', limit: 100 })
      .then(res => {
        const list = res.data ?? [];
        setInstances(list);
        if (list.length > 0 && !selectedInstanceId) {
          setSelectedInstanceId(list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Load loan summary when instance changes
  useEffect(() => {
    if (!selectedInstanceId) return;
    setLoansLoading(true);
    getInstanceLoans(selectedInstanceId)
      .then(data => {
        const receivable =
          (data as any).totalReceivable ??
          (data as any).totalCustomerBalance ??
          0;
        const payable =
          (data as any).totalPayable ??
          (data as any).totalVendorBalance ??
          0;
        setTotalReceivable(receivable);
        setTotalPayable(payable);
      })
      .catch(() => {})
      .finally(() => setLoansLoading(false));
  }, [selectedInstanceId]);

  const segments: { key: Segment; label: string }[] = [
    { key: 'customers', label: 'Customers' },
    { key: 'vendors', label: 'Vendors' },
    { key: 'loans', label: 'Loans' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Top bar with safe area */}
      <View
        style={{
          paddingTop: insets.top + (Platform.OS === 'android' ? 8 : 0),
          backgroundColor: colors.bg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          paddingBottom: spacing[3],
        }}>
        {/* Title row */}
        <View
          style={{
            paddingHorizontal: spacing[4],
            paddingTop: spacing[3],
            paddingBottom: spacing[2],
          }}>
          <Text
            style={{
              color: colors.text,
              fontSize: typography.sizes['2xl'],
              fontWeight: typography.weights.bold,
              fontFamily: typography.fontFamily,
            }}>
            CRM
          </Text>
          <Text
            style={{
              color: colors.textSub,
              fontSize: typography.sizes.sm,
              marginTop: 2,
              fontFamily: typography.fontFamily,
            }}>
            Customers, Vendors & Loans
          </Text>
        </View>

        {/* Summary cards */}
        <View
          style={{
            flexDirection: 'row',
            gap: spacing[3],
            paddingHorizontal: spacing[4],
            marginBottom: spacing[3],
          }}>
          <SummaryCard
            label="Total Receivable"
            amount={totalReceivable}
            color={colors.success}
            loading={loansLoading}
          />
          <SummaryCard
            label="Total Payable"
            amount={totalPayable}
            color={colors.danger}
            loading={loansLoading}
          />
        </View>

        {/* Segment control */}
        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: spacing[4],
            backgroundColor: colors.elevated,
            borderRadius: radius.lg,
            padding: 4,
            gap: 4,
          }}>
          {segments.map(seg => {
            const active = segment === seg.key;
            return (
              <TouchableOpacity
                key={seg.key}
                onPress={() => setSegment(seg.key)}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  paddingVertical: spacing[2],
                  borderRadius: radius.md,
                  backgroundColor: active ? colors.primary : 'transparent',
                  alignItems: 'center',
                }}>
                <Text
                  style={{
                    color: active ? colors.primaryFg : colors.textSub,
                    fontSize: typography.sizes.sm,
                    fontWeight: active
                      ? typography.weights.semibold
                      : typography.weights.regular,
                    fontFamily: typography.fontFamily,
                  }}>
                  {seg.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {segment === 'customers' && (
          <CustomersScreen
            instanceId={selectedInstanceId}
            instances={instances}
            onInstanceChange={setSelectedInstanceId}
            embedded
          />
        )}
        {segment === 'vendors' && (
          <VendorsScreen
            instanceId={selectedInstanceId}
            instances={instances}
            onInstanceChange={setSelectedInstanceId}
            embedded
          />
        )}
        {segment === 'loans' && (
          <LoansScreen
            instanceId={selectedInstanceId}
            instances={instances}
            onInstanceChange={setSelectedInstanceId}
            embedded
          />
        )}
      </View>
    </View>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  amount: number;
  color: string;
  loading?: boolean;
}

function SummaryCard({ label, amount, color, loading }: SummaryCardProps) {
  const { colors, typography, spacing, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
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
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Text
          style={{
            color,
            fontSize: typography.sizes.lg,
            fontWeight: typography.weights.bold,
            fontFamily: typography.fontFamily,
            fontVariant: ['tabular-nums'],
          }}
          numberOfLines={1}>
          Rs {amount.toLocaleString()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({});

export default CRMTabScreen;
