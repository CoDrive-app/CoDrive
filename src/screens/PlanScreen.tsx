import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, cardShadow, layout } from '../theme';
import type { Trip } from '../types';
import { currentDriver, isRouteEnd, isTripCreator } from '../journey';
import { PrimaryButton } from '../components/Buttons';
import { TripHeader } from '../components/TripHeader';
import { TripMap } from '../components/TripMap';

export function PlanScreen({
  trip,
  draft,
  onDraft,
  onAdd,
  onLike,
  onToggleGoing,
  onSwap,
  onInvite,
  onStart,
  onOpenDrive,
  onCrew,
}: {
  trip: Trip;
  draft: string;
  onDraft: (value: string) => void;
  onAdd: () => void;
  onLike: (id: string) => void;
  onToggleGoing: (id: string) => void;
  onSwap: () => void;
  onInvite: () => void;
  onStart: () => void;
  onOpenDrive: () => void;
  onCrew: () => void;
}) {
  const planning = trip.status !== 'live';
  const driver = currentDriver(trip);
  const visiting = trip.waypoints.filter((stop) => stop.going).length;
  const passing = trip.waypoints.length - visiting;
  return (
    <View style={layout.fill}>
      <ScrollView style={layout.fill} contentContainerStyle={layout.scroll} showsVerticalScrollIndicator={false}>
        <TripHeader trip={trip} onInvite={onInvite} onCrew={isTripCreator(trip) ? onCrew : undefined} />
        <View style={styles.driverBar}>
          <View style={[styles.driverDot, { backgroundColor: driver?.color ?? C.teal }]} />
          <Text style={styles.driverText}>{driver?.name ?? 'Crew'} is driving</Text>
          <TouchableOpacity onPress={onSwap} activeOpacity={0.75} accessibilityLabel="Swap drivers">
            <Text style={styles.swap}>Swap</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.mapCard}>
          <TripMap stops={trip.waypoints} />
          <View style={styles.mapCaption}>
            <Text style={styles.mapCaptionText}>
              {trip.waypoints.length === 0
                ? 'Suggested stops show up here once you place them'
                : `${visiting} on the route${passing > 0 ? ` · ${passing} passing by` : ''}`}
            </Text>
          </View>
        </View>
        <Text style={layout.section}>Proposed stops</Text>
        {trip.waypoints.map((stop) => {
          const locked = isRouteEnd(stop);
          return (
            <View key={stop.id} style={[styles.card, !stop.going && styles.cardOff]}>
              <Image source={{ uri: stop.image }} style={styles.photo} />
              <View style={styles.body}>
                <Text style={styles.title}>{stop.title}</Text>
                <Text style={styles.meta}>
                  {stop.detail} · Proposed by {stop.proposedBy}
                </Text>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.likeRow} onPress={() => onLike(stop.id)} activeOpacity={0.7}>
                    <Ionicons
                      name={stop.liked ? 'heart' : 'heart-outline'}
                      size={18}
                      color={stop.liked ? '#E26D5A' : C.muted}
                    />
                    <Text style={styles.likeCount}>{stop.likes}</Text>
                  </TouchableOpacity>
                  {locked ? (
                    <Text style={styles.locked}>On the route</Text>
                  ) : (
                    <TouchableOpacity
                      style={[styles.going, stop.going ? styles.goingOn : styles.goingOff]}
                      onPress={() => onToggleGoing(stop.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={stop.going ? 'checkmark-circle' : 'remove-circle-outline'}
                        size={16}
                        color={stop.going ? C.teal : C.muted}
                      />
                      <Text style={[styles.goingText, stop.going ? styles.goingTextOn : styles.goingTextOff]}>
                        {stop.going ? 'Stopping here' : 'Passing by'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        {planning ? (
          <PrimaryButton
            label="Start journey"
            onPress={onStart}
            icon={<Ionicons name="navigate" size={18} color={C.white} />}
          />
        ) : (
          <TouchableOpacity style={styles.liveRow} onPress={onOpenDrive} activeOpacity={0.8}>
            <Text style={styles.liveLabel}>Journey is live</Text>
            <Text style={styles.liveLink}>Open the drive</Text>
          </TouchableOpacity>
        )}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Suggest a stop, then pin it..."
            placeholderTextColor={C.faint}
            value={draft}
            onChangeText={onDraft}
            onSubmitEditing={onAdd}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.add} onPress={onAdd} activeOpacity={0.85} accessibilityLabel="Place stop on map">
            <Ionicons name="add" size={22} color={C.white} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  driverBar: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.white,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...cardShadow,
  },
  driverDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  driverText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
  },
  swap: {
    fontSize: 14,
    fontWeight: '700',
    color: C.teal,
  },
  mapCard: {
    marginTop: 14,
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: C.map,
  },
  mapCaption: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    alignItems: 'flex-start',
  },
  mapCaptionText: {
    backgroundColor: C.white,
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '700',
    color: C.ink,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
    ...cardShadow,
  },
  cardOff: {
    opacity: 0.72,
  },
  photo: {
    width: '100%',
    height: 168,
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
  actions: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likeCount: {
    fontSize: 13,
    fontWeight: '600',
    color: C.muted,
  },
  locked: {
    fontSize: 12,
    fontWeight: '700',
    color: C.muted,
  },
  going: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  goingOn: {
    backgroundColor: '#E7F6F3',
  },
  goingOff: {
    backgroundColor: C.rest,
  },
  goingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  goingTextOn: {
    color: C.teal,
  },
  goingTextOff: {
    color: C.muted,
  },
  footer: {
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: C.cream,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 4,
  },
  liveLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
  },
  liveLink: {
    fontSize: 14,
    fontWeight: '700',
    color: C.teal,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.white,
    paddingHorizontal: 16,
    fontSize: 15,
    color: C.ink,
  },
  add: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
