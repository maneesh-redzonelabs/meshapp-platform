import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { ComplianceViolation } from '../types/shared';
import { Button } from './ui';

/**
 * Blocking modal shown whenever a compliance scan returns verdict==='blocked'.
 * Per the NMC-ethics rules there is no override/bypass: the only way forward
 * is to edit the text and call runComplianceScan() again.
 */
export function ComplianceModal({
  visible, violations, onEditAndRescan, onDismiss,
}: {
  visible: boolean;
  violations: ComplianceViolation[];
  onEditAndRescan: () => void;
  onDismiss: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Content needs changes</Text>
          <Text style={styles.subtitle}>
            This content was flagged against MeshApp's NMC guideline rules and cannot be
            saved or published yet. There is no override — please edit the flagged text and
            re-scan.
          </Text>
          <ScrollView style={{ maxHeight: 320, marginVertical: 12 }}>
            {violations.length === 0 ? (
              <Text style={styles.subtitle}>No violation details were returned.</Text>
            ) : violations.map((v, idx) => (
              <View key={`${v.category}-${idx}`} style={styles.violationCard}>
                <Text style={styles.violationCategory}>
                  {v.severity === 'block' ? '⛔' : '⚠️'} {v.category}
                </Text>
                <Text style={styles.violationExcerpt}>"{v.excerpt}"</Text>
                <Text style={styles.violationGuidance}>{v.guidance}</Text>
              </View>
            ))}
          </ScrollView>
          <Button title="Edit and re-scan" onPress={onEditAndRescan} />
          <View style={{ height: 10 }} />
          <Button title="Close" variant="ghost" onPress={onDismiss} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(14,7,32,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  title: { fontSize: 19, fontWeight: '800', color: colors.danger, marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  violationCard: {
    backgroundColor: colors.surfaceTint,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.surfaceTint100,
  },
  violationCategory: { fontWeight: '700', color: colors.text, marginBottom: 4 },
  violationExcerpt: { fontStyle: 'italic', color: colors.text, marginBottom: 6 },
  violationGuidance: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18 },
});
