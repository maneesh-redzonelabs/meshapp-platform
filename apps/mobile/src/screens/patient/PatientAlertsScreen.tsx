import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { ComingSoon } from '../../components/ui';
import { colors } from '../../theme/colors';

export default function PatientAlertsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ComingSoon label="Alerts" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center' },
});
