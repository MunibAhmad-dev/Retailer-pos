import React, { forwardRef, useCallback } from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useTheme } from '../../hooks/useTheme';

interface BottomSheetProps {
  snapPoints: (string | number)[];
  children: React.ReactNode;
  onClose?: () => void;
  enablePanDownToClose?: boolean;
  style?: ViewStyle;
}

export type BottomSheetRef = GorhomBottomSheet;

export const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(
  (
    {
      snapPoints,
      children,
      onClose,
      enablePanDownToClose = true,
      style,
    },
    ref,
  ) => {
    const { colors, radius } = useTheme();

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      [],
    );

    return (
      <GorhomBottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={enablePanDownToClose}
        onClose={onClose}
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: colors.elevated,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
        }}
        handleIndicatorStyle={{
          backgroundColor: colors.border,
          width: 40,
          height: 4,
          borderRadius: 2,
          marginTop: 4,
        }}
      >
        <BottomSheetView
          style={[
            {
              flex: 1,
              paddingHorizontal: 16,
              paddingBottom: 32,
            },
            style,
          ]}
        >
          {children}
        </BottomSheetView>
      </GorhomBottomSheet>
    );
  },
);

BottomSheet.displayName = 'BottomSheet';

export default BottomSheet;
