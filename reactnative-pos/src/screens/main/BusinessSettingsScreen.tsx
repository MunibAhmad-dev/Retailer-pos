import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function BusinessSettingsScreen() {
  return (
    <View style={s.root}>
      <Text style={s.text}>BusinessSettingsScreen</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0f' },
  text: { color: '#ffffff', fontSize: 16 },
});
