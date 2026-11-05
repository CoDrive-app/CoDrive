import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../theme';
import type { Waypoint } from '../types';

/** The details of a stop whose pin was tapped on the map. */
export function StopCard({
  stop,
  time,
  fromLast,
  onClose,
}: {
  stop: Waypoint;
  time: string;
  /** Distance from the stop before, already written out. */
  fromLast: string | null;
  onClose: () => void;
}) {
  const facts = [time, stop.stop, fromLast].filter((fact) => fact && fact !== '—');
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: stop.pin }]} />
        <Text style={styles.title} numberOfLines={2}>
          {stop.title}
        </Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Close stop details" hitSlop={12}>
          <MaterialCommunityIcons name="close" size={20} color={C.muted} />
        </TouchableOpacity>
      </View>
      {facts.length > 0 ? <Text style={styles.facts}>{facts.join(' · ')}</Text> : null}
      <Text style={styles.note} numberOfLines={3}>
        {stop.note ?? stop.detail}
      </Text>
      <View style={styles.footer}>
        <Text style={styles.by} numberOfLines={1}>
          Suggested by {stop.proposedBy}
        </Text>
        <View style={styles.votes} accessibilityLabel={`${stop.likes} thumbs up, ${stop.dislikes} thumbs down`}>
          <MaterialCommunityIcons name="thumb-up-outline" size={15} color={C.teal} />
          <Text style={styles.count}>{stop.likes}</Text>
          <MaterialCommunityIcons name="thumb-down-outline" size={15} color={C.orange} />
          <Text style={styles.count}>{stop.dislikes}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 36,
    backgroundColor: C.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: C.ink,
  },
  facts: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: C.teal,
  },
  note: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: C.body,
  },
  footer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  by: {
    flex: 1,
    fontSize: 12,
    color: C.muted,
  },
  votes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  count: {
    marginRight: 6,
    fontSize: 12,
    fontWeight: '700',
    color: C.ink,
  },
});
