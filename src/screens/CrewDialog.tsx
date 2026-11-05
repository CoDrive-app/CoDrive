import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';
import type { Trip } from '../types';
import { QuietButton } from '../components/Buttons';
import { Dialog, dialogStyles } from '../components/Dialog';

export function CrewDialog({
  trip,
  onClose,
  onAdd,
  onRemove,
}: {
  trip: Trip;
  onClose: () => void;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState('');

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
  };

  return (
    <Dialog onClose={onClose}>
      <Text style={dialogStyles.title}>Crew</Text>
      <Text style={dialogStyles.sub}>Add or remove people on {trip.title}.</Text>
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {trip.createdBy === 'you' && !trip.crew.some((person) => person.id === 'you') ? (
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: '#E26D5A' }]}>
              <Text style={styles.initial}>Y</Text>
            </View>
            <View style={styles.copy}>
              <Text style={styles.name}>You</Text>
              <Text style={styles.role}>Trip creator</Text>
            </View>
          </View>
        ) : null}
        {trip.crew.map((person) => {
          const creator = person.id === trip.createdBy;
          const locked = creator || trip.crew.length <= 1;
          return (
            <View key={person.id} style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: person.color }]}>
                <Text style={styles.initial}>{person.initial}</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.name}>{person.name}</Text>
                {creator ? <Text style={styles.role}>Trip creator</Text> : null}
              </View>
              <TouchableOpacity
                style={styles.remove}
                onPress={() => onRemove(person.id)}
                disabled={locked}
                activeOpacity={0.7}
                accessibilityLabel={locked ? `${person.name} stays on the trip` : `Remove ${person.name}`}
              >
                <Ionicons name="close" size={18} color={locked ? C.line : C.muted} />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Add a name"
          placeholderTextColor={C.faint}
          value={name}
          onChangeText={setName}
          onSubmitEditing={add}
          returnKeyType="done"
          autoCapitalize="words"
        />
        <TouchableOpacity style={styles.add} onPress={add} activeOpacity={0.85} accessibilityLabel="Add to crew">
          <Ionicons name="add" size={22} color={C.white} />
        </TouchableOpacity>
      </View>
      <QuietButton label="Done" onPress={onClose} />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  list: {
    height: 220,
    marginTop: 14,
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: C.white,
    fontSize: 14,
    fontWeight: '700',
  },
  copy: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: C.ink,
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
    marginTop: 12,
  },
  input: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.field,
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
