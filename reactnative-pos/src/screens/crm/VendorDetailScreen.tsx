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
import { getInstanceVendors, getInstancePurchases } from '../../api/instances';
import type { Vendor, Purchase } from '../../api/instances';
import { SCREENS } from '../../navigation/screens';
import type { CRMStackParamList } from '../../navigation/MainNavigator';

// ─── Types ────────────────────────────────────────────────────────────────────

type NavProp = NativeStackNavigationProp<CRMStackParamList, typeof SCREENS.VENDOR_DETAIL>;
type RoutePropType = RouteProp<CRMStackParamList, typeof SCREENS.VENDOR_DETAIL>;

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

function ActionButton({
  label,
  icon,
  color,
  onPress,
}: {
  label: string;
  icon: string;
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

// ─── Purchase Row ─────────────────────────────────────────────────────────────

function PurchaseRow({ purchase }: { purchase: Purchase }) {
  const { colors, typography, spacing, radius } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing[3],
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      }}>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.medium,
            fontFamily: typography.fontFamily,
          }}>
          Purchase #{String(purchase.id).slice(-6)}
        </Text>
        <Text
          style={{
            color: colors.textMuted,
            fontSize: typography.sizes.xs,
            marginTop: 1,
            fontFamily: typography.fontFamily,
          }}>
          {formatDate(purchase.created_at)}
        </Text>
      </View>
      <Text
        style={{
          color: colors.warning,
          fontSize: typography.sizes.sm,
          fontWeight: typography.weights.bold,
          fontFamily: typography.fontFamily,
          fontVariant: ['tabular-nums'],
        }}>
        Rs {purchase.total.toLocaleString()}
      </Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VendorDetailScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();

  const { vendorId } = route.params;
  const instanceId: string = (route.params as any).instanceId ?? '';

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msgVisible, setMsgVisible] = useState(false);

  const fetchData = useCallback(
    async (refresh = false) => {
      if (!instanceId) {
        setLoading(false);
        return;
      }
      refresh ? setRefreshing(true) : setLoading(true);
      try {
        const [vendorList, purchaseList] = await Promise.all([
          getInstanceVendors(instanceId),
          getInstancePurchases(instanceId),
        ]);
        const found = vendorList.find(v => String(v.id) === String(vendorId));
        setVendor(found ?? null);
        // Filter purchases belonging to this vendor by vendor_name or id
        const vName = found?.name ?? '';
        const filtered = purchaseList.filter(
          p =>
            (p as any).vendor_id === Number(vendorId) ||
            (p as any).vendor_name === vName,
        );
        setPurchases(filtered.slice(0, 20));
      } catch {
        setVendor(null);
        setPurchases([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [instanceId, vendorId],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCall = () => {
    if (vendor?.phone) Linking.openURL(`tel:${vendor.phone}`);
  };

  const handleWhatsApp = () => {
    if (vendor?.phone) {
      const phone = vendor.phone.replace(/\D/g, '');
      const e164 = phone.startsWith('92') ? phone : `92${phone.slice(-10)}`;
      Linking.openURL(`whatsapp://send?phone=+${e164}`).catch(() =>
        Linking.openURL(`https://wa.me/+${e164}`),
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
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!vendor) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <DetailHeader title="Vendor" navigation={navigation} />
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: typography.sizes.base,
              fontFamily: typography.fontFamily,
            }}>
            Vendor not found
          </Text>
        </View>
      </View>
    );
  }

  const hasBalance = vendor.balance > 0;
  const ini = initials(vendor.name);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <DetailHeader title="Vendor Detail" navigation={navigation} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {/* Avatar + name */}
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
              backgroundColor: colors.accent + '22',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing[4],
            }}>
            <Text
              style={{
                color: colors.accent,
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
            {vendor.name}
          </Text>
          {vendor.phone ? (
            <Text
              style={{
                color: colors.textSub,
                fontSize: typography.sizes.base,
                marginTop: spacing[1],
                fontFamily: typography.fontFamily,
              }}>
              {vendor.phone}
            </Text>
          ) : null}
          {(vendor as any).address ? (
            <Text
              style={{
                color: colors.textMuted,
                fontSize: typography.sizes.sm,
                marginTop: spacing[1],
                textAlign: 'center',
                fontFamily: typography.fontFamily,
              }}>
              {(vendor as any).address}
            </Text>
          ) : null}
        </View>

        {/* Balance card */}
        <View
          style={{
            marginHorizontal: spacing[4],
            marginBottom: spacing[4],
            backgroundColor: hasBalance
              ? colors.warning + '10'
              : colors.success + '10',
            borderRadius: radius.xl,
            borderWidth: 1.5,
            borderColor: hasBalance
              ? colors.warning + '40'
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
            Outstanding Payable
          </Text>
          <Text
            style={{
              color: hasBalance ? colors.warning : colors.success,
              fontSize: typography.sizes['4xl'],
              fontWeight: typography.weights.black,
              fontFamily: typography.fontFamily,
              fontVariant: ['tabular-nums'],
            }}>
            Rs {Math.abs(vendor.balance).toLocaleString()}
          </Text>
          <Text
            style={{
              color: hasBalance
                ? colors.warning + 'aa'
                : colors.success + 'aa',
              fontSize: typography.sizes.sm,
              marginTop: spacing[1],
              fontFamily: typography.fontFamily,
            }}>
            {hasBalance ? 'Amount Payable' : 'Account Clear'}
          </Text>
        </View>

        {/* Action buttons */}
        {vendor.phone ? (
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

        {/* Details */}
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
            Vendor Details
          </Text>
          <DetailItem
            label="Total Purchases"
            value={
              (vendor as any).totalPurchases != null
                ? `Rs ${Number((vendor as any).totalPurchases).toLocaleString()}`
                : `${purchases.length} purchase${purchases.length !== 1 ? 's' : ''}`
            }
            color={colors.accent}
          />
          <DetailItem label="Since" value={formatDate((vendor as any).createdAt)} />
          <DetailItem
            label="Last Activity"
            value={formatDate((vendor as any).updatedAt)}
          />
          {(vendor as any).email ? (
            <DetailItem label="Email" value={(vendor as any).email} />
          ) : null}
        </View>

        {/* Recent purchases */}
        {purchases.length > 0 && (
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
                marginBottom: spacing[2],
              }}>
              Recent Purchases
            </Text>
            {purchases.map(p => (
              <PurchaseRow key={String(p.id)} purchase={p} />
            ))}
          </View>
        )}

        {/* Payment reminder */}
        {hasBalance && vendor.phone && (
          <TouchableOpacity
            onPress={() => setMsgVisible(true)}
            activeOpacity={0.8}
            style={{
              marginHorizontal: spacing[4],
              marginBottom: spacing[4],
              backgroundColor: colors.warning,
              borderRadius: radius.lg,
              paddingVertical: spacing[4],
              alignItems: 'center',
            }}>
            <Text
              style={{
                color: '#ffffff',
                fontSize: typography.sizes.base,
                fontWeight: typography.weights.semibold,
                fontFamily: typography.fontFamily,
              }}>
              Send Payment Reminder
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {vendor.phone && (
        <MessageModal
          visible={msgVisible}
          onClose={() => setMsgVisible(false)}
          recipient={{ name: vendor.name, phone: vendor.phone }}
          type="vendor"
          amount={vendor.balance}
          templateType="reminder"
        />
      )}
    </View>
  );
}

// ─── Detail Item ──────────────────────────────────────────────────────────────

function DetailItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
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

export default VendorDetailScreen;
