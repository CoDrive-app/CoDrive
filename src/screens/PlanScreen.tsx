import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, cardShadow, layout } from '../theme';
import type { Trip } from '../types';
import type { AddressSuggestion } from '../api';
import { searchAnchor } from '../route';
import { StatusBadge } from '../components/StatusBadge';
import { StopSearch } from '../components/StopSearch';
import { TripHeader } from '../components/TripHeader';
import { VoteButton } from '../components/VoteButton';

export function PlanScreen({
  trip,
  draft,
  onDraft,
  onAdd,
  onPickPlace,
  onVote,
  onRemove,
  onInvite,
}: {
  trip: Trip;
  draft: string;
  onDraft: (value: string) => void;
  onAdd: () => void;
  onPickPlace: (place: AddressSuggestion) => void;
  onVote: (id: string, direction: 'up' | 'down') => void;
  /** Asks to remove a stop. The Start and End have no remove button. */
  onRemove: (id: string) => void;
  onInvite: () => void;
}) {
  return (
    <View style={layout.fill}>
      <ScrollView style={layout.fill} contentContainerStyle={layout.scroll} showsVerticalScrollIndicator={false}>
        <TripHeader trip={trip} onInvite={onInvite} />
        <Text style={layout.section}>Proposed stops</Text>
        {trip.waypoints.map((stop) => (
          <View key={stop.id} style={styles.card}>
            <Image source={{ uri: stop.image }} style={styles.photo} />
            <StatusBadge status={stop.status} />
            {stop.role ? null : (
              <TouchableOpacity
                style={styles.remove}
                onPress={() => onRemove(stop.id)}
                activeOpacity={0.8}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${stop.title}`}
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <View style={styles.body}>
              <Text style={styles.title}>{stop.title}</Text>
              <Text style={styles.meta}>
                {stop.note || stop.detail} · Proposed by {stop.proposedBy}
              </Text>
              <View style={styles.voteRow}>
                <VoteButton
                  kind="up"
                  active={stop.vote === 'up'}
                  count={stop.likes}
                  onPress={() => onVote(stop.id, 'up')}
                  label={`Thumbs up ${stop.title}`}
                />
                <VoteButton
                  kind="down"
                  active={stop.vote === 'down'}
                  count={stop.dislikes}
                  onPress={() => onVote(stop.id, 'down')}
                  label={`Thumbs down ${stop.title}`}
                />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.composer}>
        <StopSearch
          value={draft}
          onChangeText={onDraft}
          onSubmit={onAdd}
          onPick={onPickPlace}
          anchor={searchAnchor(trip)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
    ...cardShadow,
  },
  photo: {
    width: '100%',
    height: 168,
  },
  remove: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28, 25, 23, 0.6)',
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: C.ink,
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: C.muted,
  },
  voteRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.cream,
  },
});
