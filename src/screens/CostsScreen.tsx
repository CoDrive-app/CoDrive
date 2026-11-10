import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { money } from '../data';
import { expenseDetails } from '../expenses';
import { C, cardShadow, layout } from '../theme';
import type { Trip } from '../types';
import { PrimaryButton } from '../components/Buttons';
import { ExpenseGlyph } from '../components/ExpenseGlyph';
import { Ring } from '../components/Ring';
import { TripHeader } from '../components/TripHeader';

export function CostsScreen({
  trip,
  onLog,
  onSetBudget,
}: {
  trip: Trip;
  onLog: () => void;
  /** Opens the Trip tab at the Budget field. */
  onSetBudget: () => void;
}) {
  const hasBudget = trip.budget > 0;
  const spent = trip.expenses.reduce((sum, item) => sum + item.amount, 0);
  const remaining = Math.max(0, trip.budget - spent);
  const progress = trip.budget > 0 ? spent / trip.budget : 0;
  const [viewing, setViewing] = useState<string | null>(null);

  return (
    <View style={layout.fill}>
      <ScrollView style={layout.fill} contentContainerStyle={layout.scroll} showsVerticalScrollIndicator={false}>
        <TripHeader trip={trip} />
        {hasBudget ? (
          <View style={styles.budget}>
            <View style={styles.budgetCopy}>
              <Text style={styles.money}>{money(spent)}</Text>
              <Text style={styles.sub}>
                {money(remaining)} remaining of ${trip.budget.toFixed(0)} budget
              </Text>
            </View>
            <Ring progress={progress} />
          </View>
        ) : (
          <View style={styles.noBudget}>
            <Text style={styles.emptyTitle}>No budget yet</Text>
            <Text style={styles.emptyBody}>
              <Text style={styles.link} onPress={onSetBudget} accessibilityRole="link">
                Set a budget
              </Text>{' '}
              to start tracking expenses.
            </Text>
          </View>
        )}

        <Text style={layout.section}>Shared Log</Text>
        {trip.expenses.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No shared costs yet</Text>
            <Text style={styles.emptyBody}>Gas, food, and stays you log will show up here for the whole crew.</Text>
          </View>
        ) : (
          trip.expenses.map((expense) => (
            <View key={expense.id} style={styles.card}>
              <View style={styles.row}>
                <ExpenseGlyph kind={expense.type} />
                <View style={styles.copy}>
                  <Text style={styles.title}>{expense.title}</Text>
                  <Text style={styles.details}>{expenseDetails(expense.paidBy, expense.notes)}</Text>
                </View>
                <Text style={styles.amount}>{money(expense.amount)}</Text>
              </View>
              {expense.photos?.length ? (
                <View style={styles.photos}>
                  {expense.photos.map((uri, index) => (
                    <TouchableOpacity
                      key={`${expense.id}-${index}`}
                      onPress={() => setViewing(uri)}
                      accessibilityLabel={`Open photo ${index + 1} for ${expense.title}`}
                    >
                      <Image source={{ uri }} style={styles.thumb} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
      {hasBudget ? (
        <View style={layout.dock}>
          <PrimaryButton label="Log Expense" onPress={onLog} icon={<Ionicons name="add" size={18} color={C.white} />} />
        </View>
      ) : null}
      <Modal visible={viewing !== null} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewing(null)} accessibilityLabel="Close photo">
          {viewing ? <Image source={{ uri: viewing }} style={styles.full} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  budget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 18,
  },
  budgetCopy: {
    flex: 1,
  },
  money: {
    fontSize: 40,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -1,
  },
  sub: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: C.muted,
  },
  noBudget: {
    marginTop: 18,
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 20,
    ...cardShadow,
  },
  link: {
    fontWeight: '700',
    color: C.teal,
    textDecorationLine: 'underline',
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    ...cardShadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: C.field,
  },
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  full: {
    width: '100%',
    height: '100%',
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: C.ink,
  },
  details: {
    marginTop: 2,
    fontSize: 12,
    color: C.muted,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    color: C.teal,
  },
  empty: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 20,
    ...cardShadow,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.ink,
  },
  emptyBody: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: C.muted,
  },
});

