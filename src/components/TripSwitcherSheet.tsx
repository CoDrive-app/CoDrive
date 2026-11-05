import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { money } from '../data';
import { C } from '../theme';
import type { Trip } from '../types';
import { Dialog, dialogStyles } from './Dialog';

export function TripSwitcherSheet({
  trips,
  selectedId,
  onSelect,
  onClose,
}: {
  trips: Trip[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog onClose={onClose} sheet fitContent>
      <Text style={[dialogStyles.title, styles.title]}>Switch trip</Text>
      <ScrollView bounces={false} contentContainerStyle={styles.list}>
        {trips.map((item) => {
          const selected = item.id === selectedId;
          const spent = item.expenses.reduce((sum, expense) => sum + expense.amount, 0);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.row, selected && styles.rowSelected]}
              onPress={() => {
                onSelect(item.id);
                onClose();
              }}
              activeOpacity={0.75}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Image source={{ uri: item.image }} style={styles.thumb} />
              <View style={styles.copy}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {item.dates} · {money(spent)} of ${item.budget.toFixed(0)}
                </Text>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={22} color={C.teal} /> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: 6,
    marginBottom: 10,
  },
  list: {
    paddingBottom: 8,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
  },
  rowSelected: {
    backgroundColor: C.field,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: C.field,
  },
  copy: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: C.ink,
  },
  meta: {
    marginTop: 2,
    fontSize: 12,
    color: C.muted,
  },
});
