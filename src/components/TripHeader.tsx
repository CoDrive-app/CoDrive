import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';
import type { Trip } from '../types';
import { AvatarStack } from './AvatarStack';

export function TripHeader({
  trip,
  onInvite,
  onSwitch,
  onCrew,
}: {
  trip: Trip;
  onInvite?: () => void;
  onSwitch?: () => void;
  onCrew?: () => void;
}) {
  return (
    <View style={styles.header}>
      {onSwitch ? (
        <TouchableOpacity
          style={styles.switcher}
          onPress={onSwitch}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Trip: ${trip.title}`}
          accessibilityHint="Switch trip"
        >
          <Text style={styles.eyebrow}>Trip</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchTitle} numberOfLines={2}>
              {trip.title}
            </Text>
            <Ionicons name="chevron-down" size={20} color={C.ink} />
          </View>
        </TouchableOpacity>
      ) : (
        <Text style={styles.title} numberOfLines={2}>
          {trip.title}
        </Text>
      )}
      {onCrew ? (
        <TouchableOpacity
          style={styles.invite}
          onPress={onCrew}
          activeOpacity={0.8}
          accessibilityLabel="Manage crew"
        >
          <Ionicons name="people-outline" size={18} color={C.teal} />
        </TouchableOpacity>
      ) : null}
      {onInvite ? (
        <TouchableOpacity style={styles.invite} onPress={onInvite} activeOpacity={0.8} accessibilityLabel="Invite crew">
          <Ionicons name="person-add-outline" size={18} color={C.teal} />
        </TouchableOpacity>
      ) : null}
      <AvatarStack people={trip.crew} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.5,
  },
  switcher: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  switchTitle: {
    flexShrink: 1,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.5,
  },
  invite: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
