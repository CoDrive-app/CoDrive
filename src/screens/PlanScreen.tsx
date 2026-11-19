import { useRef, type ComponentRef } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, CATEGORY_COLORS, cardShadow, layout } from '../theme';
import type { Trip, Waypoint } from '../types';
import type { AddressSuggestion } from '../api';
import { searchAnchor } from '../route';
import { StatusBadge } from '../components/StatusBadge';
import { StopSearch } from '../components/StopSearch';
import { TrashIcon } from '../components/TrashIcon';
import { TripHeader } from '../components/TripHeader';
import { VoteButton } from '../components/VoteButton';
import { useKeyboardLift } from '../useKeyboard';

function removeLabel(stop: Waypoint) {
  if (stop.role === 'start') return 'Remove start';
  if (stop.role === 'end') return 'Remove end';
  return 'Remove suggestion';
}

export function PlanScreen({
  trip,
  draft,
  onDraft,
  onPickPlace,
  onVote,
  onRemove,
  userId,
  onSetRole,
  roleBusy,
  notice,
  onInvite,
}: {
  trip: Trip;
  draft: string;
  onDraft: (value: string) => void;
  onPickPlace: (place: AddressSuggestion) => void;
  onVote: (id: string, direction: 'up' | 'down') => void;
  /** Asks to remove a stop. */
  onRemove: (id: string) => void;
  /** The signed-in account. You can remove your own suggestions; the owner can remove any stop. */
  userId: string;
  /** Makes a stop the fixed Start or End, or turns that off. Only the owner sees these buttons. */
  onSetRole: (id: string, role: 'start' | 'end') => void;
  /** True while a start or end change is saving. */
  roleBusy: boolean;
  /** A message to show above the stops, like a failed save. */
  notice: string | null;
  onInvite: () => void;
}) {
  const owner = trip.role === 'owner';
  // Lifts the search box and its suggestions above the keyboard, where the keyboard would cover them.
  const composer = useRef<ComponentRef<typeof View>>(null);
  const lift = useKeyboardLift(composer);
  // Only the owner can remove the Start or End. Anyone can remove their own suggestions, and the owner anyone's.
  const canRemove = (stop: Waypoint) => (stop.role ? owner : owner || stop.proposedById === userId);
  return (
    <View style={layout.fill}>
      <ScrollView style={layout.fill} contentContainerStyle={layout.scroll} showsVerticalScrollIndicator={false}>
        <TripHeader trip={trip} onInvite={onInvite} />
        <Text style={layout.section}>Proposed stops</Text>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {trip.waypoints.map((stop) => (
          <View
            key={stop.id}
            // A stop of a known kind gets an outline in that kind's colour, matching its chip and its map pin.
            style={[styles.card, stop.category && { borderWidth: 2, borderColor: CATEGORY_COLORS[stop.category] }]}
          >
            <Image source={{ uri: stop.image }} style={styles.photo} />
            <StatusBadge status={stop.status} />
            <View style={styles.body}>
              <Text style={styles.title}>{stop.title}</Text>
              <Text style={styles.meta}>
                {stop.note || stop.detail} · Proposed by {stop.proposedBy}
              </Text>
              {typeof stop.latitude !== 'number' ? (
                <Text style={styles.noLocation}>No location, so this stop can't be on the route.</Text>
              ) : null}
              {owner && typeof stop.latitude === 'number' ? (
                <View style={styles.roleRow}>
                  {(['start', 'end'] as const).map((role) => {
                    const on = stop.role === role;
                    const name = role === 'start' ? 'start' : 'end';
                    return (
                      <TouchableOpacity
                        key={role}
                        style={[styles.roleChip, on && styles.roleChipOn]}
                        onPress={() => onSetRole(stop.id, role)}
                        disabled={roleBusy}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on, disabled: roleBusy }}
                        accessibilityLabel={on ? `${stop.title} is the fixed ${name}. Tap to unfix it.` : `Make ${stop.title} the ${name}`}
                      >
                        <Ionicons name={on ? 'flag' : 'flag-outline'} size={13} color={on ? C.white : C.muted} />
                        <Text style={[styles.roleText, on && styles.roleTextOn]}>{on ? (role === 'start' ? 'Start' : 'End') : `Make ${name}`}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
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
                {canRemove(stop) ? (
                  <TouchableOpacity
                    style={styles.remove}
                    onPress={() => onRemove(stop.id)}
                    activeOpacity={0.6}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`${removeLabel(stop)}: ${stop.title}`}
                  >
                    <TrashIcon />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      <View ref={composer} style={[styles.composer, { marginBottom: lift }]}>
        <StopSearch
          value={draft}
          onChangeText={onDraft}
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
  noLocation: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: C.orange,
  },
  notice: {
    marginBottom: 10,
    fontSize: 13,
    color: C.ink,
  },
  roleRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
  },
  roleChipOn: {
    backgroundColor: C.teal,
    borderColor: C.teal,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.muted,
  },
  roleTextOn: {
    color: C.white,
  },
  remove: {
    marginLeft: 'auto',
    padding: 6,
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
