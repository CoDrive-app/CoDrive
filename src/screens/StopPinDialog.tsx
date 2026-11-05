import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import { PrimaryButton, QuietButton } from '../components/Buttons';
import { Dialog, dialogStyles } from '../components/Dialog';
import { TripMap } from '../components/TripMap';
import type { Waypoint } from '../types';

export function StopPinDialog({
  title,
  stops,
  pin,
  onPin,
  onConfirm,
  onClose,
}: {
  title: string;
  stops: Waypoint[];
  pin: { x: number; y: number } | null;
  onPin: (point: { x: number; y: number }) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog onClose={onClose} sheet>
      <Text style={styles.title}>Place {title}</Text>
      <Text style={styles.body}>Tap the map where this stop sits. It shows up with the rest of the route.</Text>
      <View style={styles.map}>
        <TripMap
          stops={stops}
          draft={pin}
          onPick={(x, y) => onPin({ x, y })}
        />
        {!pin ? (
          <View pointerEvents="none" style={styles.hint}>
            <Text style={styles.hintText}>Tap to drop a pin</Text>
          </View>
        ) : null}
      </View>
      <View style={dialogStyles.actions}>
        <PrimaryButton label="Add this stop" onPress={onConfirm} disabled={!pin} />
        <QuietButton label="Cancel" onPress={onClose} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.3,
  },
  body: {
    marginTop: 6,
    marginBottom: 14,
    fontSize: 14,
    lineHeight: 20,
    color: C.muted,
  },
  map: {
    height: 188,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: C.map,
  },
  hint: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    alignItems: 'center',
  },
  hintText: {
    backgroundColor: C.white,
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
    color: C.ink,
  },
});
