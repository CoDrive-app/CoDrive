import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';
import type { Crew } from '../types';
import { PrimaryButton, QuietButton } from '../components/Buttons';
import { Dialog, dialogStyles } from '../components/Dialog';

export function SwapDriverDialog({
  crew,
  driverId,
  choice,
  reason,
  onChoice,
  onReason,
  onConfirm,
  onClose,
}: {
  crew: Crew[];
  driverId?: string;
  choice: string | null;
  reason: string;
  onChoice: (id: string) => void;
  onReason: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const alone = crew.length < 2;
  const next = crew.find((person) => person.id === choice);
  return (
    <Dialog onClose={onClose} sheet>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Swap drivers</Text>
        <Text style={styles.body}>
          Hand the wheel to anyone on the crew, whenever you want. A reason is optional.
        </Text>
        {crew.map((person) => {
          const selected = person.id === choice;
          const driving = person.id === driverId;
          return (
            <TouchableOpacity
              key={person.id}
              style={[styles.row, selected && styles.rowOn]}
              onPress={() => onChoice(person.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.swatch, { backgroundColor: person.color }]}>
                <Text style={styles.initial}>{person.initial}</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.name}>{person.name}</Text>
                <Text style={styles.meta}>{driving ? 'Driving now' : 'Ready to drive'}</Text>
              </View>
              <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? C.teal : C.faint} />
            </TouchableOpacity>
          );
        })}
        {alone ? (
          <Text style={styles.alone}>Add someone else to the crew before you can hand off the wheel.</Text>
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Any reason — tired, traffic, just because"
            placeholderTextColor={C.faint}
            value={reason}
            onChangeText={onReason}
          />
        )}
        <View style={dialogStyles.actions}>
          <PrimaryButton
            label={next && next.id !== driverId ? `${next.name} takes the wheel` : 'Keep the current driver'}
            onPress={onConfirm}
            disabled={alone || !choice}
          />
          <QuietButton label="Cancel" onPress={onClose} />
        </View>
      </ScrollView>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.3,
  },
  body: {
    marginTop: 8,
    marginBottom: 14,
    fontSize: 14,
    lineHeight: 20,
    color: C.muted,
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: C.field,
  },
  rowOn: {
    backgroundColor: '#E7F6F3',
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: C.white,
    fontWeight: '700',
    fontSize: 15,
  },
  copy: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: C.ink,
  },
  meta: {
    marginTop: 2,
    fontSize: 12,
    color: C.muted,
  },
  alone: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: C.muted,
  },
  input: {
    marginTop: 8,
    height: 46,
    borderRadius: 14,
    backgroundColor: C.field,
    paddingHorizontal: 14,
    fontSize: 15,
    color: C.ink,
  },
});
