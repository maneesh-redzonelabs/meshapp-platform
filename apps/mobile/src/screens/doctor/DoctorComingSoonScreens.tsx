import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { ComingSoon } from '../../components/ui';
import { colors } from '../../theme/colors';

function Wrap({ label }: { label: string }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ComingSoon label={label} />
    </SafeAreaView>
  );
}

export const DoctorNetworkScreen = () => <Wrap label="Network" />;
export const DoctorCommunityScreen = () => <Wrap label="Community" />;
export const DoctorMarketScreen = () => <Wrap label="Marketplace" />;
export const DoctorLegalScreen = () => <Wrap label="Medico-Legal Help" />;
export const DoctorHelpScreen = () => <Wrap label="Help Desk" />;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center' },
});
