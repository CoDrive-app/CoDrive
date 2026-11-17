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
  onJoin,
  onDelete,
  onEdit,
  onProfile,
  loading,
  loadError,
}: {
  trips: Trip[];
  profileUri: string | null;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onProfile: () => void;
  loading?: boolean;
  loadError?: string | null;
}) {
  return (
    <ScrollView style={layout.fill} contentContainerStyle={layout.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.brandRow}>
        <View style={styles.brandLockup}>
          <LogoMark />
          <Text style={styles.brand}>CoDrive</Text>
        </View>
        <TouchableOpacity onPress={onProfile} activeOpacity={0.8} accessibilityLabel="Your profile">
          <ProfileMark uri={profileUri} size={36} />
        </TouchableOpacity>
      </View>

      <Text style={styles.hero}>Adventure is better{'\n'}together.</Text>
      <Text style={styles.heroSub}>
        Plan routes, log coordinates, rotate drivers, and split expenses live with your crew.
      </Text>
      <View style={styles.actions}>
        <PrimaryButton
          compact
          label="Start a New Trip"
          onPress={onCreate}
          icon={<Ionicons name="add" size={18} color={C.white} />}
        />
        <TouchableOpacity style={styles.join} onPress={onJoin} activeOpacity={0.8}>
          <Ionicons name="enter-outline" size={17} color={C.teal} />
          <Text style={styles.joinText}>Join with a Code</Text>
        </TouchableOpacity>
      </View>

      <Text style={layout.section}>Your Expeditions</Text>
      {loadError ? <Text style={styles.empty}>{loadError}</Text> : null}
      {!loadError && trips.length === 0 ? (
        <Text style={styles.empty}>{loading ? 'Loading your trips…' : 'No expeditions yet.'}</Text>
      ) : null}
      {trips.map((trip) => (
        <View key={trip.id} style={styles.expedition}>
          <TouchableOpacity style={styles.expeditionMain} onPress={() => onOpen(trip.id)} activeOpacity={0.86}>
            <Image source={{ uri: trip.image }} style={styles.thumb} />
            <View style={styles.copy}>
              <Text style={styles.title} numberOfLines={1}>
                {trip.title}
              </Text>
              <Text style={styles.date}>{trip.dates}</Text>
            </View>
            <AvatarStack people={trip.crew} size={26} />
          </TouchableOpacity>
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
            accessibilityLabel={trip.role === 'member' ? `Leave ${trip.title}` : `Delete ${trip.title}`}
          >
            <Ionicons name="close" size={16} color={C.muted} />
          </TouchableOpacity>
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
  actions: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
  },
  join: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.teal,
  },
  joinText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.teal,
  },
  expedition: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 18,
    paddingLeft: 12,
    paddingVertical: 12,
    paddingRight: 8,
    marginBottom: 12,
    ...cardShadow,
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
