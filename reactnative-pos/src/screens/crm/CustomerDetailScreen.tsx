import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { useTheme } from '../../hooks/useTheme';
import { MessageModal } from '../../components/shared/MessageModal';
import { getInstanceCustomers } from '../../api/instances';
import type { Customer } from '../../api/instances';
import { SCREENS } from '../../navigation/screens';
import type { CRMStackParamList } from '../../navigation/MainNavigator';

// ─── Types ────────────────────────────────────────────────────────────────────

type NavProp = NativeStackNavigationProp<CRMStackParamList, typeof SCREENS.CUSTOMER_DETAIL>;
type RoutePropType = RouteProp<CRMStackParamList, typeof SCREENS.CUSTOMER_DETAIL>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Action Button ────────────────────────────────────────────────────────────

interface ActionButtonProps {
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
}

function ActionButton({ label, icon, color, onPress }: ActionButtonProps) {
  const { colors, typography, spacing, radius } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flex: 1,
        alignItems: 'center',
        backgroundColor: color + '15',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: color + '35',
        paddingVertical: spacing[3],
        gap: spacing[1],
      }}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text
        style={{
          color,
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.semibold,
          fontFamily: typography.fontFamily,
        }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Stat Item ────────────────────────────────────────────────────────────────

function StatItem({ label, value, color }: { label: string; value: string; color?: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={{ marginBottom: spacing[4] }}>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: typography.sizes.xs,
          fontFamily: typography.fontFamily,
          marginBottom: 2,
        }}>
        {label}
      </Text>
      <Text
        style={{
          color: color ?? colors.text,
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.semibold,
          fontFamily: typography.fontFamily,
        }}>
        {value}
      </Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomerDetailScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();

  const { customerId } = route.params;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msgVisible, setMsgVisible] = useState(false);

  // We need to find which instance this customer belongs to.
  // The navigator should pass instanceId as a route param in a real app.
  // For now we try to resolve it from the parent navigation state.
  const instanceId: string =
    (route.params as any).instanceId ?? '';

  const fetchCustomer = useCallback(
    async (refresh = false) => {
      if (!instanceId) {
        setLoading(false);
        return;
      }
      refresh ? setRefreshing(true) : setLoading(true);
      try {
        const list = await getInstanceCustomers(instanceId);
        const found = list.find(c => String(c.id) === String(customerId));
        setCustomer(found ?? null);
      } catch {
        setCustomer(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [instanceId, customerId],
  );

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  const handleCall = () => {
    if (customer?.phone) Linking.openURL(`tel:${customer.phone}`);
  };

  const handleWhatsApp = () => {
    if (customer?.phone) {
      const phone = customer.phone.replace(/\D/g, '');
      const e164 = phone.startsWith('92') ? phone : `92${phone.slice(-10)}`;
      Linking.openURL(`whatsapp://send?phone=+${e164}`).catch(() =>
        Linking.openURL(`https://wa.me/+${e164}`),
      );
    }
  };

  const handleSMS = () => {
    if (customer?.phone) {
      Linking.openURL(
        `sms:${customer.phone}${Platform.OS === 'ios' ? '&' : '?'}body=`,
      );
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!customer) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <DetailHeader title="Customer" navigation={navigation} />
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: typography.sizes.base,
              fontFamily: typography.fontFamily,
            }}>
            Customer not found
          </Text>
        </View>
      </View>
    );
  }

  const hasBalance = customer.balance > 0;
  const ini = initials(customer.name);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <DetailHeader title="Customer Detail" navigation={navigation} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchCustomer(true)}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
        }}>
        {/* Avatar + name header */}
        <View
          style={{
            alignItems: 'center',
            paddingVertical: spacing[8],
            paddingHorizontal: spacing[4],
          }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.primary + '22',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing[4],
            }}>
            <Text
              style={{
                color: colors.primary,
                fontSize: typography.sizes['2xl'],
                fontWeight: typography.weights.bold,
                fontFamily: typography.fontFamily,
              }}>
              {ini}
            </Text>
          </View>
          <Text
            style={{
              color: colors.text,
              fontSize: typography.sizes['2xl'],
              fontWeight: typography.weights.bold,
              fontFamily: typography.fontFamily,
              textAlign: 'center',
            }}>
            {customer.name}
          </Text>
          {customer.phone ? (
            <Text
              style={{
                color: colors.textSub,
                fontSize: typography.sizes.base,
                marginTop: spacing[1],
                fontFamily: typography.fontFamily,
              }}>
              {customer.phone}
            </Text>
          ) : null}
          {(customer as any).address ? (
            <Text
              style={{
                color: colors.textMuted,
                fontSize: typography.sizes.sm,
                marginTop: spacing[1],
                textAlign: 'center',
                fontFamily: typography.fontFamily,
              }}>
              {(customer as any).address}
            </Text>
          ) : null}
        </View>

        {/* Balance card */}
        <View
          style={{
            marginHorizontal: spacing[4],
            marginBottom: spacing[4],
            backgroundColor: hasBalance
              ? colors.danger + '10'
              : colors.success + '10',
            borderRadius: radius.xl,
            borderWidth: 1.5,
            borderColor: hasBalance
              ? colors.danger + '40'
              : colors.success + '40',
            padding: spacing[6],
            alignItems: 'center',
          }}>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: typography.sizes.sm,
              fontFamily: typography.fontFamily,
              marginBottom: spacing[2],
            }}>
            Outstanding Balance
          </Text>
          <Text
            style={{
              color: hasBalance ? colors.danger : colors.success,
              fontSize: typography.sizes['4xl'],
              fontWeight: typography.weights.black,
              fontFamily: typography.fontFamily,
              fontVariant: ['tabular-nums'],
            }}>
            Rs {Math.abs(customer.balance).toLocaleString()}
          </Text>
          <Text
            style={{
              color: hasBalance ? colors.danger + 'aa' : colors.success + 'aa',
              fontSize: typography.sizes.sm,
              marginTop: spacing[1],
              fontFamily: typography.fontFamily,
            }}>
            {hasBalance ? 'Amount Owed' : 'Account Clear'}
          </Text>
        </View>

        {/* Action buttons */}
        {customer.phone ? (
          <View
            style={{
              flexDirection: 'row',
              gap: spacing[3],
              marginHorizontal: spacing[4],
              marginBottom: spacing[4],
            }}>
            <ActionButton
              label="Call"
              icon="📞"
              color={colors.success}
              onPress={handleCall}
            />
            <ActionButton
              label="WhatsApp"
              icon="💬"
              color="#25D366"
              onPress={handleWhatsApp}
            />
            <ActionButton
              label="SMS"
              icon="✉️"
              color={colors.primary}
              onPress={handleSMS}
            />
            {hasBalance && (
              <ActionButton
                label="Reminder"
                icon="🔔"
                color={colors.warning}
                onPress={() => setMsgVisible(true)}
              />
            )}
          </View>
        ) : null}

        {/* Stats */}
        <View
          style={{
            marginHorizontal: spacing[4],
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing[4],
            marginBottom: spacing[4],
          }}>
          <Text
            style={{
              color: colors.text,
              fontSize: typography.sizes.base,
              fontWeight: typography.weights.semibold,
              fontFamily: typography.fontFamily,
              marginBottom: spacing[4],
            }}>
            Account Details
          </Text>
          <StatItem
            label="Total Purchases"
            value={
              (customer as any).totalPurchases != null
                ? `Rs ${Number((customer as any).totalPurchases).toLocaleString()}`
                : '—'
            }
            color={colors.primary}
          />
          <StatItem
            label="Member Since"
            value={formatDate((customer as any).createdAt)}
          />
          <StatItem
            label="Last Activity"
            value={formatDate((customer as any).updatedAt)}
          />
          {(customer as any).email ? (
            <StatItem label="Email" value={(customer as any).email} />
          ) : null}
        </View>

        {/* Send reminder button */}
        {hasBalance && customer.phone && (
          <TouchableOpacity
            onPress={() => setMsgVisible(true)}
            activeOpacity={0.8}
            style={{
              marginHorizontal: spacing[4],
              marginBottom: spacing[4],
              backgroundColor: colors.primary,
              borderRadius: radius.lg,
              paddingVertical: spacing[4],
              alignItems: 'center',
            }}>
            <Text
              style={{
                color: colors.primaryFg,
                fontSize: typography.sizes.base,
                fontWeight: typography.weights.semibold,
                fontFamily: typography.fontFamily,
              }}>
              Send Balance Reminder
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Message modal */}
      {customer.phone && (
        <MessageModal
          visible={msgVisible}
          onClose={() => setMsgVisible(false)}
          recipient={{ name: customer.name, phone: customer.phone }}
          type="customer"
          amount={customer.balance}
          templateType="balance"
        />
      )}
    </View>
  );
}

// ─── Detail Header ────────────────────────────────────────────────────────────

function DetailHeader({
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

export default CustomerDetailScreen;
