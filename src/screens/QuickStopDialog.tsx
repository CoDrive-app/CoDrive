import { Image, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PrimaryButton, QuietButton } from '../components/Buttons';
import { Dialog, dialogStyles } from '../components/Dialog';
import { STOP_IMAGES } from '../data';
import { C, CATEGORY_COLORS } from '../theme';
import type { StopCategory } from '../types';

export type QuickKind = 'gas' | 'food' | 'rest';

/**
 * PREVIEW ONLY. Example results for the Find Gas / Find Food / Find Rest buttons, so the design can be tried before
 * the real search exists. Nothing here is searched for or saved. The names are made up.
 */
export const QUICK_PREVIEW: Record<
  QuickKind,
  { label: string; category: StopCategory; name: string; kind: string; distance: string; detour: string; offRoute?: string }
> = {
  gas: {
    label: 'Find Gas',
    category: 'gas',
    name: 'Kam Hwy Gas & Go',
    kind: 'Gas station',
    distance: '1.4 mi from you',
    detour: 'Adds about 4 min to the drive',
  },
  food: {
    label: 'Find Food',
    category: 'food',
    name: 'North Shore Shrimp Shack',
    kind: 'Restaurant',
    distance: '2.1 mi from you',
    detour: 'Adds about 6 min to the drive',
  },
  rest: {
    label: 'Find Rest',
    category: 'lodging',
    name: 'Waialua Beach Park Restrooms',
    kind: 'Public restroom',
    distance: '6.3 mi from you',
    detour: 'Adds about 15 min to the drive',
    offRoute: "You're about 6 miles from the route, so the trip owner needs to approve this stop before it's added.",
  },
};

/** Suggests the nearest place of one kind and asks whether to add it to the route. A preview with example places. */
export function QuickStopDialog({ kind, onAdd, onClose }: { kind: QuickKind; onAdd: () => void; onClose: () => void }) {
  const place = QUICK_PREVIEW[kind];
  const color = CATEGORY_COLORS[place.category];
  return (
    <Dialog onClose={onClose}>
      <View style={styles.titleRow}>
        <Text style={dialogStyles.title}>{place.offRoute ? 'Ask to add this stop?' : 'Add this stop?'}</Text>
        <View style={styles.previewTag}>
          <Text style={styles.previewText}>Preview</Text>
        </View>
      </View>
      <Text style={dialogStyles.sub}>The nearest {place.kind.toLowerCase()} to you.</Text>

      <View style={[styles.place, { borderColor: color }]}>
        <Image source={{ uri: STOP_IMAGES[place.category][0] }} style={styles.photo} />
        <View style={styles.placeBody}>
          <Text style={styles.placeName}>{place.name}</Text>
          <Text style={[styles.placeKind, { color }]}>{place.kind}</Text>
          <Text style={styles.placeMeta}>
            {place.distance} · {place.detour}
          </Text>
        </View>
      </View>

      {place.offRoute ? (
        <View style={styles.warning}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color={C.orange} />
          <Text style={styles.warningText}>{place.offRoute}</Text>
        </View>
      ) : null}

      <View style={dialogStyles.actions}>
        <PrimaryButton label={place.offRoute ? 'Ask the owner' : 'Add'} onPress={onAdd} />
        <QuietButton label="No thank you" onPress={onClose} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  previewTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C.field,
  },
  previewText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
  },
  place: {
    marginTop: 14,
    borderWidth: 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 120,
  },
  placeBody: {
    padding: 12,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '700',
    color: C.ink,
  },
  placeKind: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  placeMeta: {
    marginTop: 4,
    fontSize: 13,
    color: C.muted,
  },
  warning: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: C.sun,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: C.body,
  },
});
