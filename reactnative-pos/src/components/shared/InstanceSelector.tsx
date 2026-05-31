/**
 * InstanceSelector — Compact bottom sheet for selecting the active store.
 *
 * Usage:
 *   <InstanceSelector
 *     visible={sheetOpen}
 *     onClose={() => setSheetOpen(false)}
 *     onSelect={(id, name) => selectInstance(id, name)}
 *   />
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
} from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useRef, useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { Instance } from '../../api/instances';
import { useInstanceSelector } from '../../hooks/useInstanceSelector';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InstanceSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (id: string, name: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Status = Instance['status'];

function statusColor(
  status: Status,
  colors: ReturnType<typeof useTheme>['colors'],
): string {
  switch (status) {
    case 'approved': return colors.success;
    case 'pending':  return colors.warning;
    case 'blocked':  return colors.danger;
    default:         return colors.textMuted;
  }
}

function statusLabel(status: Status): string {
  switch (status) {
    case 'approved': return 'Active';
    case 'pending':  return 'Pending';
    case 'blocked':  return 'Blocked';
    default:         return status;
  }
}

// ─── Row component ────────────────────────────────────────────────────────────

interface InstanceRowProps {
  item: Instance;
  isSelected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  typography: ReturnType<typeof useTheme>['typography'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  radius: ReturnType<typeof useTheme>['radius'];
}

function InstanceRow({
  item,
  isSelected,
  onPress,
  colors,
  typography,
  spacing,
  radius,
}: InstanceRowProps) {
  const sColor = statusColor(item.status, colors);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.row,
        {
          backgroundColor: isSelected ? colors.primary + '12' : colors.surface,
          borderColor: isSelected ? colors.primary + '44' : colors.border,
          borderRadius: radius.md,
          padding: spacing[4],
          marginBottom: spacing[2],
          borderWidth: 1,
        },
      ]}>
      {/* Avatar */}
      <View
        style={[
          styles.avatar,
          {
            backgroundColor: colors.primary + '1a',
            borderRadius: radius.md,
          },
        ]}>
        <Text
          style={{
            color: colors.primary,
            fontSize: typography.sizes.base,
            fontWeight: typography.weights.bold,
            fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
          }}>
          {(item.name ?? 'S').charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Details */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.text,
            fontSize: typography.sizes.base,
            fontWeight: typography.weights.semibold,
            fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
          }}
          numberOfLines={1}>
          {item.name}
        </Text>
        {item.owner_name ? (
          <Text
            style={{
              color: colors.textSub,
              fontSize: typography.sizes.xs,
              marginTop: 2,
              fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
            }}
            numberOfLines={1}>
            {item.owner_name}
          </Text>
        ) : null}
      </View>

      {/* Status badge */}
      <View
        style={[
          styles.badge,
          { backgroundColor: sColor + '18', borderColor: sColor + '44' },
        ]}>
        <View style={[styles.dot, { backgroundColor: sColor }]} />
        <Text
          style={{
            color: sColor,
            fontSize: typography.sizes.xs,
            fontWeight: typography.weights.semibold,
            fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
          }}>
          {statusLabel(item.status)}
        </Text>
      </View>

      {/* Selection indicator */}
      {isSelected ? (
        <View
          style={[
            styles.checkCircle,
            { backgroundColor: colors.primary, marginLeft: spacing[2] },
          ]}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
            ✓
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InstanceSelector({ visible, onClose, onSelect }: InstanceSelectorProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const { instances, selectedId, isLoading } = useInstanceSelector();

  const sheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['50%', '80%'], []);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  const handleSelect = useCallback(
    (item: Instance) => {
      onSelect(item.id, item.name);
      onClose();
    },
    [onSelect, onClose],
  );

  const renderItem = useCallback(
    ({ item }: { item: Instance }) => (
      <InstanceRow
        item={item}
        isSelected={selectedId === item.id}
        onPress={() => handleSelect(item)}
        colors={colors}
        typography={typography}
        spacing={spacing}
        radius={radius}
      />
    ),
    [selectedId, handleSelect, colors, typography, spacing, radius],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
      backgroundStyle={{ backgroundColor: colors.bg }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
        ]}>
        <Text
          style={{
            color: colors.text,
            fontSize: typography.sizes.lg,
            fontWeight: typography.weights.bold,
            fontFamily: Platform.OS === 'android' ? 'Inter' : undefined,
          }}>
          Select Store
        </Text>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text
            style={{
              color: colors.primary,
              fontSize: typography.sizes.base,
              fontWeight: typography.weights.semibold,
            }}>
            Done
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={[styles.emptyBox, { paddingHorizontal: spacing[4] }]}>
          <Text style={{ color: colors.textMuted, fontSize: typography.sizes.sm }}>
            Loading stores...
          </Text>
        </View>
      ) : instances.length === 0 ? (
        <View style={[styles.emptyBox, { paddingHorizontal: spacing[4] }]}>
          <Text style={{ color: colors.textMuted, fontSize: typography.sizes.sm }}>
            No stores found.
          </Text>
        </View>
      ) : (
        <FlatList
          data={instances}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </BottomSheetModal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
});

export default InstanceSelector;
