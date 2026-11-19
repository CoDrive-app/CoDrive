import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { QuietButton } from '../components/Buttons';
import { Dialog, dialogStyles } from '../components/Dialog';
import { money } from '../data';
import { EXPENSE_TYPES } from '../expenses';
import { settle } from '../settle';
import { C } from '../theme';
import type { ExpenseType, Trip } from '../types';

/**
 * Pick which kinds of expense to split, and see each person's even share, what they paid,
 * and who should pay whom so everyone is even. Only shows the amounts; nothing is saved.
 */
export function SettleUpDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  // Only the kinds this trip has expenses for, each starting ticked.
  const kinds = EXPENSE_TYPES.filter((kind) => trip.expenses.some((expense) => expense.type === kind.value));
  const [chosen, setChosen] = useState<ExpenseType[]>(kinds.map((kind) => kind.value));
  const result = useMemo(() => settle(trip.expenses, trip.crew, chosen), [trip.expenses, trip.crew, chosen]);

  const toggle = (value: ExpenseType) =>
    setChosen((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  const totalOf = (value: ExpenseType) =>
    trip.expenses.filter((expense) => expense.type === value).reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <Dialog onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={dialogStyles.title}>Settle up</Text>
        <Text style={dialogStyles.sub}>Pick which costs to split evenly between everyone on the trip.</Text>

        <View style={styles.kinds}>
          {kinds.map((kind) => {
            const on = chosen.includes(kind.value);
            return (
              <TouchableOpacity
                key={kind.value}
                style={styles.kind}
                onPress={() => toggle(kind.value)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`Split ${kind.label}`}
              >
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? C.teal : C.faint} />
                <Text style={styles.kindLabel}>{kind.label}</Text>
                <Text style={styles.kindAmount}>{money(totalOf(kind.value))}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {result.count === 0 ? (
          <Text style={styles.empty}>Tick at least one kind of cost to see the split.</Text>
        ) : (
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryBig}>{money(result.share)} each</Text>
              <Text style={styles.summarySub}>
                {money(result.total)} split {trip.crew.length} {trip.crew.length === 1 ? 'way' : 'ways'}
              </Text>
            </View>

            <Text style={styles.heading}>What each person paid</Text>
            {result.people.map((person) => (
              <View key={person.member.id} style={styles.person}>
                <View style={[styles.avatar, { backgroundColor: person.member.color }]}>
                  <Text style={styles.avatarText}>{person.member.initial}</Text>
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {person.member.name}
                </Text>
                <Text style={styles.paid}>{money(person.paid)}</Text>
                <Text style={[styles.balance, person.balance > 0 ? styles.ahead : person.balance < 0 ? styles.behind : null]}>
                  {person.balance > 0 ? `+${money(person.balance)}` : person.balance < 0 ? `−${money(-person.balance)}` : 'even'}
                </Text>
              </View>
            ))}

            <Text style={styles.heading}>To even up</Text>
            {result.payments.length === 0 ? (
              <Text style={styles.empty}>Everyone's even. Nobody owes anything.</Text>
            ) : (
              result.payments.map((payment, index) => (
                <View key={`${payment.from.id}-${payment.to.id}-${index}`} style={styles.payment}>
                  <Text style={styles.paymentText}>
                    <Text style={styles.strong}>{payment.from.name}</Text> pays <Text style={styles.strong}>{payment.to.name}</Text>
                  </Text>
                  <Text style={styles.paymentAmount}>{money(payment.amount)}</Text>
                </View>
              ))
            )}
          </>
        )}

        {result.skipped > 0 ? (
          <Text style={styles.note}>
            {result.skipped === 1 ? '1 cost is' : `${result.skipped} costs are`} left out because someone not on the trip paid
            for {result.skipped === 1 ? 'it' : 'them'}.
          </Text>
        ) : null}

        <View style={dialogStyles.actions}>
          <QuietButton label="Done" onPress={onClose} />
        </View>
      </ScrollView>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  kinds: {
    marginTop: 12,
  },
  kind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  kindLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
  },
  kindAmount: {
    fontSize: 14,
    color: C.muted,
  },
  summary: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.field,
  },
  summaryBig: {
    fontSize: 24,
    fontWeight: '700',
    color: C.ink,
  },
  summarySub: {
    marginTop: 2,
    fontSize: 13,
    color: C.muted,
  },
  heading: {
    marginTop: 18,
    marginBottom: 6,
    fontSize: 15,
    fontWeight: '700',
    color: C.ink,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.white,
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: C.ink,
  },
  paid: {
    fontSize: 14,
    color: C.body,
  },
  balance: {
    width: 84,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
    color: C.muted,
  },
  ahead: {
    color: C.teal,
  },
  behind: {
    color: C.orange,
  },
  payment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  paymentText: {
    flex: 1,
    fontSize: 14,
    color: C.body,
  },
  strong: {
    fontWeight: '700',
    color: C.ink,
  },
  paymentAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: C.ink,
  },
  empty: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: C.muted,
  },
  note: {
    marginTop: 14,
    fontSize: 12,
    lineHeight: 17,
    color: C.muted,
  },
});
