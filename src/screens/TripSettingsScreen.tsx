import { useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import type { Spot } from '../api';
import { AddressField } from '../components/AddressField';
import { PrimaryButton } from '../components/Buttons';
import { DateField } from '../components/DateField';
import { Field } from '../components/Field';
import { WheelPicker } from '../components/WheelPicker';
import { crewFromName, crewMemberLocked } from '../crew';
import { parseTripDates } from '../dates';
import { joinLimit, setLimit, splitLimit, toggleDriver } from '../drivers';
import { endpoint, spotFor, spotOf } from '../stops';
import { C, layout } from '../theme';
import type { Crew, Driver, Trip } from '../types';

export type TripSettings = {
  title: string;
  start: string;
  end: string;
  /** Only set while the text still matches a place picked from the suggestions. */
  startSpot: Spot | null;
  endSpot: Spot | null;
  startDate: string;
  endDate: string;
  /** 0 when no budget is set. */
  budget: number;
  image: string;
  drivers: Driver[];
  crew: Crew[];
};

type Draft = {
  title: string;
  start: string;
  end: string;
  startSpot: Spot | null;
  endSpot: Spot | null;
  startDate: string;
  endDate: string;
  budget: string;
  image: string;
  drivers: Driver[];
  crew: Crew[];
};

function draftFrom(trip: Trip): Draft {
  const fallback = parseTripDates(trip.dates);
  const startStop = endpoint(trip, 'start');
  const endStop = endpoint(trip, 'end');
  return {
    title: trip.title,
    start: startStop?.title ?? '',
    end: endStop?.title ?? '',
    startSpot: spotOf(startStop),
    endSpot: spotOf(endStop),
    startDate: trip.startDate ?? fallback.start,
    endDate: trip.endDate ?? fallback.end,
    budget: trip.budget > 0 ? String(trip.budget) : '',
    image: trip.image,
    drivers: trip.drivers.filter((driver) => trip.crew.some((member) => member.id === driver.crewId)),
    crew: trip.crew,
  };
}

/** The draft in a form that can be compared, so the Save button knows if anything changed. */
function snapshot(draft: Draft) {
  const start = draft.start.trim();
  const end = draft.end.trim();
  const crewOrder = draft.crew.map((member) => member.id);
  return JSON.stringify({
    title: draft.title.trim(),
    start,
    end,
    startSpot: spotFor(start, draft.startSpot),
    endSpot: spotFor(end, draft.endSpot),
    startDate: draft.startDate,
    endDate: draft.endDate,
    budget: draft.budget.trim() === '' ? 0 : Number(draft.budget),
    image: draft.image,
    crew: draft.crew,
    drivers: [...draft.drivers].sort((a, b) => crewOrder.indexOf(a.crewId) - crewOrder.indexOf(b.crewId)),
  });
}

/**
 * Everything about a trip except its stops: name, start and end, dates, budget, picture, crew, and who drives.
 * Changes are kept in a draft until Save, so half-typed addresses never reach the route.
 */
export function TripSettingsScreen({
  trip,
  onSave,
  focus,
}: {
  trip: Trip;
  onSave: (settings: TripSettings) => void;
  /** Scrolls to this field and puts the cursor in it when the screen opens. */
  focus?: 'budget';
}) {
  const scroller = useRef<ScrollView>(null);
  const initial = useMemo(() => draftFrom(trip), [trip]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [crewName, setCrewName] = useState('');
  const [crewNote, setCrewNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const change = (patch: Partial<Draft>) => {
    setSaved(false);
    setDraft((current) => ({ ...current, ...patch }));
  };

  const budgetText = draft.budget.trim();
  const budgetValue = budgetText === '' ? 0 : Number(budgetText);
  const budgetOk = budgetText === '' || (Number.isFinite(budgetValue) && budgetValue > 0);
  const datesOk = !draft.startDate || !draft.endDate || draft.endDate >= draft.startDate;
  const valid = draft.title.trim().length > 0 && budgetOk && datesOk && draft.crew.length > 0;
  const dirty = snapshot(draft) !== snapshot(initial);

  const start = draft.start.trim();
  const end = draft.end.trim();
  const startSpot = spotFor(start, draft.startSpot);
  const endSpot = spotFor(end, draft.endSpot);
  const routeHint =
    !start || !end
      ? 'Fill in both Start and End to build the route.'
      : !startSpot || !endSpot
        ? 'Pick Start and End from the suggestions so the route can be drawn.'
        : null;

  const addCrew = () => {
    const person = crewFromName(crewName, draft.crew.length);
    if (!person) return;
    if (draft.crew.some((member) => member.name.toLowerCase() === person.name.toLowerCase())) {
      setCrewNote(`${person.name} is already on this trip.`);
      return;
    }
    setCrewNote(null);
    setCrewName('');
    change({ crew: [...draft.crew, person] });
  };

  const removeCrew = (id: string) => {
    const member = draft.crew.find((item) => item.id === id);
    if (!member || crewMemberLocked(draft.crew, member)) return;
    change({
      crew: draft.crew.filter((item) => item.id !== id),
      drivers: draft.drivers.filter((driver) => driver.crewId !== id),
    });
  };

  const choosePhoto = async () => {
    setBusy(true);
    setPhotoNote(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPhotoNote('Photo access is off, so this trip will keep its current picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) change({ image: result.assets[0].uri });
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!valid || !dirty) return;
    onSave({
      title: draft.title.trim(),
      start,
      end,
      startSpot,
      endSpot,
      startDate: draft.startDate,
      endDate: draft.endDate,
      budget: budgetValue,
      image: draft.image,
      drivers: draft.drivers.filter((driver) => draft.crew.some((member) => member.id === driver.crewId)),
      crew: draft.crew,
    });
    setSaved(true);
  };

  return (
    <View style={layout.fill}>
      <ScrollView
        ref={scroller}
        style={layout.fill}
        contentContainerStyle={layout.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Trip settings</Text>
        <Text style={styles.sub}>Only the name is needed. Fill in the rest whenever you are ready.</Text>

        <Field label="Trip name" value={draft.title} onChangeText={(value) => change({ title: value })} placeholder="North Shore Getaway" />
        <AddressField
          label="Start"
          value={draft.start}
          onChangeText={(value) => change({ start: value })}
          placeholder="Ala Moana"
          onPick={(place) => change({ startSpot: { name: place.name, latitude: place.latitude, longitude: place.longitude } })}
        />
        <AddressField
          label="End"
          value={draft.end}
          onChangeText={(value) => change({ end: value })}
          placeholder="Turtle Bay"
          onPick={(place) => change({ endSpot: { name: place.name, latitude: place.latitude, longitude: place.longitude } })}
        />
        {routeHint ? <Text style={styles.hint}>{routeHint}</Text> : null}
        <DateField
          label="Start date"
          value={draft.startDate}
          onChange={(value) => change({ startDate: value, endDate: draft.endDate && draft.endDate < value ? '' : draft.endDate })}
          placeholder="Select a date"
        />
        <DateField
          label="End date"
          value={draft.endDate}
          onChange={(value) => change({ endDate: value })}
          placeholder="Select a date"
          min={draft.startDate}
        />
        <View onLayout={(event) => focus === 'budget' && scroller.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 12), animated: true })}>
          <Field
            label="Budget"
            value={draft.budget}
            onChangeText={(value) => change({ budget: value })}
            placeholder="500"
            numeric
            autoFocus={focus === 'budget'}
          />
        </View>

        <Text style={styles.label}>Picture</Text>
        <TouchableOpacity onPress={choosePhoto} activeOpacity={0.85} disabled={busy} accessibilityLabel="Change the trip picture">
          <Image source={{ uri: draft.image }} style={styles.picture} />
        </TouchableOpacity>
        <Text style={styles.hint}>{busy ? 'Opening…' : 'Tap the picture to change it'}</Text>
        {photoNote ? <Text style={styles.hint}>{photoNote}</Text> : null}

        <Text style={layout.section}>Crew</Text>
        <Text style={styles.sub}>Add the people coming on this trip. Save to keep the list.</Text>
        {draft.crew.map((member) => {
          const locked = crewMemberLocked(draft.crew, member);
          return (
            <View key={member.id} style={styles.crewRow}>
              <View style={[styles.avatar, { backgroundColor: member.color }]}>
                <Text style={styles.avatarText}>{member.initial}</Text>
              </View>
              <View style={styles.crewCopy}>
                <Text style={styles.name} numberOfLines={1}>
                  {member.name}
                </Text>
                {member.id === 'you' ? <Text style={styles.role}>Stays on the trip</Text> : null}
              </View>
              <TouchableOpacity
                style={styles.remove}
                onPress={() => removeCrew(member.id)}
                disabled={locked}
                activeOpacity={0.7}
                accessibilityLabel={locked ? `${member.name} stays on the trip` : `Remove ${member.name}`}
              >
                <Ionicons name="close" size={18} color={locked ? C.line : C.muted} />
              </TouchableOpacity>
            </View>
          );
        })}
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Add a name"
            placeholderTextColor={C.faint}
            value={crewName}
            onChangeText={(value) => {
              setCrewName(value);
              setCrewNote(null);
            }}
            onSubmitEditing={addCrew}
            returnKeyType="done"
            autoCapitalize="words"
            maxLength={40}
          />
          <TouchableOpacity
            style={[styles.add, crewName.trim().length === 0 && styles.addOff]}
            onPress={addCrew}
            disabled={crewName.trim().length === 0}
            activeOpacity={0.85}
            accessibilityLabel="Add to crew"
          >
            <Ionicons name="add" size={22} color={C.white} />
          </TouchableOpacity>
        </View>
        {crewNote ? <Text style={styles.hint}>{crewNote}</Text> : null}

        <Text style={layout.section}>Drivers</Text>
        <Text style={styles.sub}>
          Tick who can drive, then set how long each driver can go before a rotation is due. Each limit can be from 1 to 12 hours.
        </Text>
        {draft.crew.map((member) => {
          const driver = draft.drivers.find((item) => item.crewId === member.id);
          const parts = driver ? splitLimit(driver.limitMinutes) : null;
          return (
            <View key={member.id} style={styles.driverRow}>
              <TouchableOpacity
                style={styles.who}
                onPress={() => change({ drivers: toggleDriver(draft.drivers, member.id) })}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: Boolean(driver) }}
                accessibilityLabel={`${member.name} can drive`}
              >
                <Ionicons
                  name={driver ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={driver ? C.teal : C.faint}
                />
                <View style={[styles.avatar, { backgroundColor: member.color }]}>
                  <Text style={styles.avatarText}>{member.initial}</Text>
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {member.name}
                </Text>
              </TouchableOpacity>
              {parts ? (
                <View style={styles.wheels}>
                  <WheelPicker
                    label={`${member.name} driving hours`}
                    unit="hr"
                    count={12}
                    min={1}
                    value={parts.hours}
                    onChange={(hours) =>
                      change({
                        drivers: setLimit(draft.drivers, member.id, joinLimit(hours, hours === 12 ? 0 : parts.minutes)),
                      })
                    }
                  />
                  <WheelPicker
                    label={`${member.name} driving minutes`}
                    unit="min"
                    pad
                    count={parts.hours === 12 ? 1 : 60}
                    value={parts.minutes}
                    onChange={(minutes) =>
                      change({ drivers: setLimit(draft.drivers, member.id, joinLimit(parts.hours, minutes)) })
                    }
                  />
                </View>
              ) : null}
            </View>
          );
        })}
        {draft.drivers.length === 0 ? <Text style={styles.hint}>No drivers picked yet.</Text> : null}

        {!valid ? (
          <Text style={styles.hint}>
            {draft.title.trim().length === 0
              ? 'Give the trip a name.'
              : !budgetOk
                ? 'The budget must be a number above 0, or left empty.'
                : 'The end date cannot be before the start date.'}
          </Text>
        ) : null}
        <View style={styles.save}>
          <PrimaryButton label={saved && !dirty ? 'Saved' : 'Save changes'} onPress={save} disabled={!valid || !dirty} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.4,
  },
  sub: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: C.muted,
  },
  label: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '600',
    color: C.body,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: C.muted,
  },
  picture: {
    width: '100%',
    height: 140,
    borderRadius: 14,
  },
  driverRow: {
    marginTop: 10,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: C.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  who: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.white,
  },
  name: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
  },
  wheels: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  crewRow: {
    marginTop: 10,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: C.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  crewCopy: {
    flex: 1,
  },
  role: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: C.teal,
  },
  remove: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  addInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: C.field,
    paddingHorizontal: 14,
    fontSize: 16,
    color: C.ink,
  },
  add: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: C.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOff: {
    opacity: 0.4,
  },
  save: {
    marginTop: 20,
  },
});
