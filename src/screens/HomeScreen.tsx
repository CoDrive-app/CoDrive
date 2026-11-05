import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, cardShadow, layout } from '../theme';
import type { Trip } from '../types';
import { AvatarStack } from '../components/AvatarStack';
import { PrimaryButton } from '../components/Buttons';
import { LogoMark } from '../components/LogoMark';
import { ProfileMark } from '../components/ProfileMark';

export function HomeScreen({
  trips,
  profileUri,
  onOpen,
  onCreate,
  onDelete,
  onEdit,
  onProfile,
  onStart,
  onCrew,
}: {
  trips: Trip[];
  profileUri: string | null;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onProfile: () => void;
  onStart: (id: string) => void;
  onCrew: (id: string) => void;
}) {
  return (
    <ScrollView style={layout.fill} contentContainerStyle={layout.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.brandRow}>
        <View style={styles.brandLockup}>
          <LogoMark />
          <Text style={styles.brand}>CoDrive</Text>
        </View>
        <TouchableOpacity onPress={onProfile} activeOpacity={0.8} accessibilityLabel="Change profile picture">
          <ProfileMark uri={profileUri} size={36} />
        </TouchableOpacity>
      </View>

      <Text style={styles.hero}>Adventure is better{'\n'}together.</Text>
      <Text style={styles.heroSub}>
        Plan routes, log coordinates, rotate drivers, and split expenses live with your crew.
      </Text>
      <PrimaryButton
        compact
        label="Start a New Trip"
        onPress={onCreate}
        icon={<Ionicons name="add" size={18} color={C.white} />}
      />

      <Text style={layout.section}>Your Expeditions</Text>
      {trips.length === 0 ? <Text style={styles.empty}>No expeditions yet.</Text> : null}
      {trips.map((trip) => (
        <View key={trip.id} style={styles.expedition}>
          <View style={styles.expeditionRow}>
            <TouchableOpacity style={styles.expeditionMain} onPress={() => onOpen(trip.id)} activeOpacity={0.86}>
              <Image source={{ uri: trip.image }} style={styles.thumb} />
              <View style={styles.copy}>
                <Text style={styles.title} numberOfLines={1}>
                  {trip.title}
                </Text>
                <Text style={styles.date}>{trip.dates}</Text>
                {trip.status === 'live' ? <Text style={styles.live}>On the road</Text> : null}
              </View>
              <AvatarStack people={trip.crew} size={26} />
            </TouchableOpacity>
            {trip.createdBy === 'you' ? (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => onCrew(trip.id)}
                activeOpacity={0.7}
                accessibilityLabel={`Manage crew for ${trip.title}`}
              >
                <Ionicons name="people-outline" size={16} color={C.muted} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => onEdit(trip.id)}
              activeOpacity={0.7}
              accessibilityLabel={`Edit ${trip.title}`}
            >
              <Ionicons name="pencil" size={15} color={C.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => onDelete(trip.id)}
              activeOpacity={0.7}
              accessibilityLabel={`Delete ${trip.title}`}
            >
              <Ionicons name="close" size={16} color={C.muted} />
            </TouchableOpacity>
          </View>
          {trip.status === 'planning' ? (
            <TouchableOpacity
              style={styles.launch}
              onPress={() => onStart(trip.id)}
              activeOpacity={0.85}
              accessibilityLabel={`Start ${trip.title}`}
            >
              <Ionicons name="navigate" size={16} color={C.white} />
              <Text style={styles.launchText}>Start journey</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brand: {
    fontSize: 18,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.3,
  },
  hero: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.8,
  },
  heroSub: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: C.muted,
    maxWidth: 340,
  },
  expedition: {
    backgroundColor: C.white,
    borderRadius: 18,
    paddingLeft: 12,
    paddingTop: 12,
    paddingRight: 8,
    paddingBottom: 12,
    marginBottom: 12,
    ...cardShadow,
  },
  expeditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  launch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    marginRight: 4,
    marginLeft: 0,
    backgroundColor: C.teal,
    borderRadius: 12,
    minHeight: 40,
  },
  launchText: {
    color: C.white,
    fontSize: 14,
    fontWeight: '700',
  },
  live: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: C.teal,
  },
  expeditionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    fontSize: 14,
    color: C.muted,
    marginBottom: 8,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: C.ink,
  },
  date: {
    marginTop: 3,
    fontSize: 13,
    color: C.muted,
  },
});
