import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';
import type { RestStop } from '../types';
import { PrimaryButton, QuietButton } from '../components/Buttons';
import { Dialog, dialogStyles } from '../components/Dialog';
import { InfoCard } from '../components/InfoCard';

export function RotationDialog({
  driverLine,
  rest,
  onClose,
  onAcknowledge,
  onRemind,
  onSwap,
}: {
  driverLine: string;
  rest: RestStop;
  onClose: () => void;
  onAcknowledge: () => void;
  onRemind: () => void;
  onSwap: () => void;
}) {
  return (
    <Dialog onClose={onClose}>
      <View style={styles.iconWrap}>
        <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.8}>
          <Ionicons name="close" size={18} color={C.orange} />
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Driver Rotation Due</Text>
      <Text style={styles.body}>
        {driverLine}
        <Text style={styles.strong}>2.5{'\u00A0'}hours</Text> without rest.
      </Text>
      <Text style={styles.hint}>For safety, please prepare to safely pull over and rotate drivers.</Text>
      <InfoCard kicker="NEXT REST STOP" title={rest.place} note={rest.note} trailing={rest.distance} />
      <View style={dialogStyles.actions}>
        <PrimaryButton label="Acknowledge Rotation" onPress={onAcknowledge} />
        <QuietButton label="Swap drivers" onPress={onSwap} />
        <QuietButton label="Remind Me in 10 Min" onPress={onRemind} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: C.orange,
    letterSpacing: -0.3,
  },
  body: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    color: C.body,
  },
  strong: {
    fontWeight: '700',
    color: C.ink,
  },
  hint: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: C.muted,
  },
});
