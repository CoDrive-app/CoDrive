import { useEffect, useRef, useState } from 'react';
import {
  Image,
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ScrollViewInstance,
  type TextInputInstance,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { PrimaryButton, QuietButton } from '../components/Buttons';
import { DateField } from '../components/DateField';
import { Dialog, dialogStyles } from '../components/Dialog';
import { Field } from '../components/Field';
import { C } from '../theme';
import {
  endDateBounds,
  samePlace,
  sanitizeBudget,
  sanitizePlace,
  sanitizeTripName,
  startDateBounds,
  tidyBudget,
  tidyLabel,
  tripIssues,
  type TripField,
} from '../tripForm';

const IDLE_MS = 800;
const BUDGET_ACCESSORY = 'trip-budget-done';

export function CreateTripDialog({
  editing,
  name,
  start,
  end,
  startDate,
  endDate,
  budget,
  image,
  onName,
  onStart,
  onEnd,
  onStartDate,
  onEndDate,
  onBudget,
  onImage,
  onSubmit,
  onClose,
  canSubmit,
  submitting,
  error,
}: {
  editing: boolean;
  name: string;
  start: string;
  end: string;
  startDate: string;
  endDate: string;
  budget: string;
  image: string | null;
  onName: (value: string) => void;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  onStartDate: (value: string) => void;
  onEndDate: (value: string) => void;
  onBudget: (value: string) => void;
  onImage: (uri: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  canSubmit: boolean;
  submitting?: boolean;
  error?: string | null;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<'startDate' | 'endDate' | null>(null);
  const [shown, setShown] = useState<Partial<Record<TripField, boolean>>>({});
  const [rejected, setRejected] = useState<Partial<Record<TripField, string>>>({});
  const timers = useRef<Partial<Record<TripField, ReturnType<typeof setTimeout>>>>({});
  const offsets = useRef<Partial<Record<TripField, number>>>({});
  const scrollRef = useRef<ScrollViewInstance>(null);
  const startRef = useRef<TextInputInstance>(null);
  const endRef = useRef<TextInputInstance>(null);
  const budgetRef = useRef<TextInputInstance>(null);

  const issues = tripIssues({ editing, name, start, end, startDate, endDate, budget });
  const startBounds = startDateBounds(editing);
  const endBounds = endDateBounds(editing, startDate);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      Object.values(pending).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  const message = (key: TripField) => rejected[key] || (shown[key] ? issues[key] : null);

  const schedule = (key: TripField) => {
    const existing = timers.current[key];
    if (existing) clearTimeout(existing);
    setShown((current) => ({ ...current, [key]: false }));
    timers.current[key] = setTimeout(() => {
      setShown((current) => ({ ...current, [key]: true }));
    }, IDLE_MS);
  };

  const leave = (key: TripField) => {
    const existing = timers.current[key];
    if (existing) clearTimeout(existing);
    setRejected((current) => ({ ...current, [key]: undefined }));
    setShown((current) => ({ ...current, [key]: true }));
  };

  const closePicker = () => {
    if (!picker) return;
    const closing = picker;
    setPicker(null);
    leave(closing);
  };

  const revealAll = () => {
    (Object.keys(timers.current) as TripField[]).forEach((key) => {
      const timer = timers.current[key];
      if (timer) clearTimeout(timer);
    });
    setPicker(null);
    setShown({ name: true, start: true, end: true, startDate: true, endDate: true, budget: true });
    const order: TripField[] = ['name', 'start', 'end', 'startDate', 'endDate', 'budget'];
    const first = order.find((key) => issues[key]);
    if (!first) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, (offsets.current[first] ?? 0) - 8), animated: true });
  };

  const choosePhoto = async () => {
    setBusy(true);
    setNote(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setNote('Photo access is off, so this trip will keep its current picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) onImage(result.assets[0].uri);
    } finally {
      setBusy(false);
    }
  };

  const changeName = (raw: string) => {
    const next = sanitizeTripName(raw);
    setRejected((current) => ({ ...current, name: next.rejected ?? undefined }));
    onName(next.value);
    schedule('name');
  };

  const changeStart = (raw: string) => {
    const next = sanitizePlace(raw);
    setRejected((current) => ({ ...current, start: next.rejected ?? undefined }));
    onStart(next.value);
    schedule('start');
    if (samePlace(next.value, end)) schedule('end');
  };

  const changeEnd = (raw: string) => {
    const next = sanitizePlace(raw);
    setRejected((current) => ({ ...current, end: next.rejected ?? undefined }));
    onEnd(next.value);
    schedule('end');
  };

  const changeBudget = (raw: string) => {
    const next = sanitizeBudget(raw);
    setRejected((current) => ({ ...current, budget: next.rejected ?? undefined }));
    onBudget(next.value);
    schedule('budget');
  };

  const togglePicker = (key: 'startDate' | 'endDate') => {
    Keyboard.dismiss();
    if (picker === key) {
      setPicker(null);
      leave(key);
      return;
    }
    if (picker) leave(picker);
    setPicker(key);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, (offsets.current[key] ?? 0) - 8), animated: true });
    });
  };

  const pickDate = (key: 'startDate' | 'endDate', iso: string) => {
    if (key === 'startDate') onStartDate(iso);
    else onEndDate(iso);
    setPicker(null);
    leave(key);
    if (key === 'startDate' && endDate) leave('endDate');
  };

  return (
    <Dialog onClose={onClose} sheet>
      <View style={styles.body}>
        <Text style={dialogStyles.title}>{editing ? 'Edit Trip' : 'Start a New Trip'}</Text>
        <Text style={dialogStyles.sub}>
          {editing
            ? 'Update the name, dates, budget, or picture.'
            : 'Name the road, set a budget, then bring your crew along.'}
        </Text>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <Field
            label="Trip name"
            value={name}
            onChangeText={changeName}
            onBlur={() => {
              const next = tidyLabel(name);
              if (next !== name) onName(next);
              leave('name');
            }}
            onFocus={closePicker}
            placeholder="North Shore Getaway"
            autoCapitalize="words"
            autoCorrect
            autoComplete="off"
            textContentType="none"
            inputMode="text"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => startRef.current?.focus()}
            error={message('name')}
            onLayoutY={(y) => {
              offsets.current.name = y;
            }}
          />
          <Field
            ref={startRef}
            label="Start"
            value={start}
            onChangeText={changeStart}
            onBlur={() => {
              const next = tidyLabel(start);
              if (next !== start) onStart(next);
              leave('start');
              if (samePlace(next, end)) leave('end');
            }}
            onFocus={closePicker}
            placeholder="Ala Moana"
            autoCapitalize="words"
            autoCorrect
            autoComplete="off"
            textContentType="none"
            inputMode="text"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => endRef.current?.focus()}
            error={message('start')}
            onLayoutY={(y) => {
              offsets.current.start = y;
            }}
          />
          <Field
            ref={endRef}
            label="End"
            value={end}
            onChangeText={changeEnd}
            onBlur={() => {
              const next = tidyLabel(end);
              if (next !== end) onEnd(next);
              leave('end');
            }}
            onFocus={closePicker}
            placeholder="Turtle Bay"
            autoCapitalize="words"
            autoCorrect
            autoComplete="off"
            textContentType="none"
            inputMode="text"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => togglePicker('startDate')}
            error={message('end')}
            onLayoutY={(y) => {
              offsets.current.end = y;
            }}
          />
          <DateField
            label="Start date"
            value={startDate}
            open={picker === 'startDate'}
            onPress={() => togglePicker('startDate')}
            onSelect={(iso) => pickDate('startDate', iso)}
            minimumDate={startBounds.min}
            maximumDate={startBounds.max}
            error={message('startDate')}
            onLayoutY={(y) => {
              offsets.current.startDate = y;
            }}
          />
          <DateField
            label="End date"
            value={endDate}
            open={picker === 'endDate'}
            onPress={() => togglePicker('endDate')}
            onSelect={(iso) => pickDate('endDate', iso)}
            minimumDate={endBounds.min}
            maximumDate={endBounds.max}
            error={message('endDate')}
            onLayoutY={(y) => {
              offsets.current.endDate = y;
            }}
          />
          <Field
            ref={budgetRef}
            label="Budget"
            value={budget}
            onChangeText={changeBudget}
            onBlur={() => {
              const next = tidyBudget(budget);
              if (next !== budget) onBudget(next);
              leave('budget');
            }}
            onFocus={closePicker}
            placeholder="500"
            prefix="$"
            keyboardType="decimal-pad"
            inputMode="decimal"
            autoComplete="off"
            textContentType="none"
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
            inputAccessoryViewID={Platform.OS === 'ios' ? BUDGET_ACCESSORY : undefined}
            error={message('budget')}
            onLayoutY={(y) => {
              offsets.current.budget = y;
            }}
          />
          <Text style={styles.pictureLabel}>Picture</Text>
          <TouchableOpacity onPress={choosePhoto} activeOpacity={0.85} disabled={busy} accessibilityLabel="Add a trip picture">
            {image ? (
              <Image source={{ uri: image }} style={styles.picture} />
            ) : (
              <View style={styles.pictureEmpty}>
                <Ionicons name="image-outline" size={22} color={C.teal} />
                <Text style={styles.pictureText}>{busy ? 'Opening…' : 'Add a picture'}</Text>
              </View>
            )}
          </TouchableOpacity>
          {image ? <Text style={styles.change}>Tap the picture to change it</Text> : null}
          {note ? <Text style={styles.note}>{note}</Text> : null}
        </ScrollView>
        {error ? <Text style={styles.note}>{error}</Text> : null}
        <View style={dialogStyles.actions}>
          <View style={styles.submitWrap}>
            <PrimaryButton
              label={editing ? 'Save' : submitting ? 'Creating…' : 'Create Trip'}
              onPress={onSubmit}
              disabled={!canSubmit || busy || submitting}
              loading={submitting}
            />
            {!canSubmit && !submitting ? (
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={revealAll}
                accessibilityRole="button"
                accessibilityLabel={editing ? 'Show what to fix before saving' : 'Show what to fix before creating the trip'}
              />
            ) : null}
          </View>
          <QuietButton label="Cancel" onPress={onClose} />
        </View>
      </View>
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={BUDGET_ACCESSORY}>
          <View style={styles.accessory}>
            <TouchableOpacity onPress={() => Keyboard.dismiss()} accessibilityLabel="Done">
              <Text style={styles.accessoryText}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      ) : null}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  submitWrap: {
    position: 'relative',
  },
  pictureLabel: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '600',
    color: C.body,
  },
  picture: {
    width: '100%',
    height: 140,
    borderRadius: 14,
  },
  pictureEmpty: {
    height: 88,
    borderRadius: 12,
    backgroundColor: C.field,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pictureText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.teal,
  },
  change: {
    marginTop: 6,
    fontSize: 12,
    color: C.muted,
  },
  note: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: C.muted,
  },
  accessory: {
    backgroundColor: C.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  accessoryText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.teal,
  },
});
