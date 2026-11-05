import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FieldWarning } from './Field';
import { formatLong, fromIso, startOfDay, toIso } from '../tripForm';
import { C } from '../theme';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function DateField({
  label,
  value,
  open,
  onPress,
  onSelect,
  minimumDate,
  maximumDate,
  error,
  onLayoutY,
}: {
  label: string;
  value: string;
  open: boolean;
  onPress: () => void;
  onSelect: (iso: string) => void;
  minimumDate: Date;
  maximumDate: Date;
  error?: string | null;
  onLayoutY?: (y: number) => void;
}) {
  const min = startOfDay(minimumDate);
  const max = startOfDay(maximumDate);
  const selected = fromIso(value);
  const [cursor, setCursor] = useState(() => monthOf(selected && inRange(selected, min, max) ? selected : min));
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      const current = fromIso(value);
      setCursor(monthOf(current && inRange(current, min, max) ? current : min));
    }
    wasOpen.current = open;
  }, [open, value, min, max]);

  const labelText = selected ? formatLong(value) : 'Select a date';
  const previous = shiftMonth(cursor, -1);
  const next = shiftMonth(cursor, 1);

  return (
    <View style={styles.wrap} onLayout={(event) => onLayoutY?.(event.nativeEvent.layout.y)}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={selected ? `${label}, ${labelText}` : `${label}, select a date`}
        accessibilityHint="Opens a calendar"
        accessibilityState={{ expanded: open }}
        style={[styles.box, error ? styles.boxError : null]}
      >
        <Text style={[styles.value, selected ? styles.valueSet : null]}>{labelText}</Text>
        <Ionicons name="calendar-outline" size={20} color={C.teal} />
      </Pressable>
      <FieldWarning message={error} />
      {open ? (
        <View style={styles.calendar}>
          <View style={styles.monthRow}>
            <Pressable
              onPress={() => setCursor(previous)}
              disabled={!monthHits(previous, min, max)}
              accessibilityLabel="Previous month"
              style={styles.chevron}
            >
              <Ionicons name="chevron-back" size={20} color={monthHits(previous, min, max) ? C.teal : C.faint} />
            </Pressable>
            <Text style={styles.monthLabel}>
              {MONTHS[cursor.month]} {cursor.year}
            </Text>
            <Pressable
              onPress={() => setCursor(next)}
              disabled={!monthHits(next, min, max)}
              accessibilityLabel="Next month"
              style={styles.chevron}
            >
              <Ionicons name="chevron-forward" size={20} color={monthHits(next, min, max) ? C.teal : C.faint} />
            </Pressable>
          </View>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((day) => (
              <Text key={day} style={styles.weekday}>
                {day}
              </Text>
            ))}
          </View>
          {chunk(buildMonth(cursor.year, cursor.month), 7).map((week, index) => (
            <View key={`${cursor.year}-${cursor.month}-${index}`} style={styles.weekRow}>
              {week.map((day, dayIndex) => {
                if (!day) return <View key={`empty-${dayIndex}`} style={styles.day} />;
                const iso = toIso(day);
                const disabled = !inRange(day, min, max);
                const isSelected = value === iso;
                const isToday = iso === toIso(new Date());
                return (
                  <Pressable
                    key={iso}
                    disabled={disabled}
                    onPress={() => onSelect(iso)}
                    accessibilityRole="button"
                    accessibilityLabel={formatLong(iso)}
                    accessibilityState={{ selected: isSelected, disabled }}
                    style={[styles.day, isSelected ? styles.daySelected : null, isToday && !isSelected ? styles.dayToday : null]}
                  >
                    <Text style={[styles.dayText, isSelected ? styles.dayTextSelected : null, disabled ? styles.dayTextDisabled : null]}>
                      {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function monthOf(date: Date) {
  return { year: date.getFullYear(), month: date.getMonth() };
}

function shiftMonth(cursor: { year: number; month: number }, delta: number) {
  const next = new Date(cursor.year, cursor.month + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

function monthHits(cursor: { year: number; month: number }, min: Date, max: Date) {
  const first = new Date(cursor.year, cursor.month, 1);
  const last = new Date(cursor.year, cursor.month + 1, 0);
  return startOfDay(last) >= min && startOfDay(first) <= max;
}

function inRange(date: Date, min: Date, max: Date) {
  const day = startOfDay(date).getTime();
  return day >= min.getTime() && day <= max.getTime();
}

function buildMonth(year: number, month: number) {
  const first = new Date(year, month, 1);
  const count = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let index = 0; index < first.getDay(); index += 1) cells.push(null);
  for (let day = 1; day <= count; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function chunk<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: C.body,
    marginBottom: 6,
  },
  box: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: C.field,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  boxError: {
    borderColor: C.warn,
    backgroundColor: C.warnBg,
  },
  value: {
    fontSize: 16,
    color: C.faint,
  },
  valueSet: {
    color: C.ink,
  },
  calendar: {
    marginTop: 8,
    backgroundColor: C.field,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 10,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: C.ink,
  },
  chevron: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    marginBottom: 4,
  },
  day: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginVertical: 1,
  },
  daySelected: {
    backgroundColor: C.teal,
  },
  dayToday: {
    borderWidth: 1.5,
    borderColor: C.teal,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
  },
  dayTextSelected: {
    color: C.white,
  },
  dayTextDisabled: {
    color: C.faint,
  },
});
