import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { ComingSoon } from '../../components/ui';
import { colors } from '../../theme/colors';

export default function VideoCallScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ComingSoon label="Video Call" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgDark, justifyContent: 'center' },
});
