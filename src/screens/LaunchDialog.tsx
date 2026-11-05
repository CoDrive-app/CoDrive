import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { journeyChecks, journeyReady } from '../journey';
import { C } from '../theme';
import type { Trip } from '../types';
import { PrimaryButton, QuietButton } from '../components/Buttons';
import { Dialog, dialogStyles } from '../components/Dialog';

export function LaunchDialog({
  trip,
  onClose,
  onLaunch,
}: {
  trip: Trip;
  onClose: () => void;
  onLaunch: () => void;
}) {
  const checks = journeyChecks(trip);
  const ready = journeyReady(trip);

  return (
    <Dialog onClose={onClose}>
      <Text style={dialogStyles.title}>Ready to roll?</Text>
      <Text style={dialogStyles.sub}>
        {ready
          ? 'Route, crew, dates, and budget look good. Launch when you want the drive to go live.'
          : 'Fix the items below, then you can start the drive.'}
      </Text>
      <View style={styles.list}>
        {checks.map((check) => (
          <View key={check.id} style={styles.row}>
            <Ionicons
              name={check.ok ? 'checkmark-circle' : 'alert-circle'}
              size={22}
              color={check.ok ? C.teal : C.warn}
            />
            <View style={styles.copy}>
              <Text style={styles.label}>{check.label}</Text>
              <Text style={styles.detail}>{check.detail}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={dialogStyles.actions}>
        <PrimaryButton label="Launch journey" onPress={onLaunch} disabled={!ready} />
        <QuietButton label="Keep planning" onPress={onClose} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: C.ink,
  },
  detail: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: C.muted,
  },
});
