import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchAddresses, type AddressSuggestion } from '../api';
import { C } from '../theme';

const MIN_CHARS = 3;
const PAUSE_MS = 350;

/**
 * A text field that suggests real addresses and places as you type. Only a picked suggestion counts as a place:
 * pressing Done picks the top one, waiting for it if the search is still running, and a check mark shows once picked.
 */
export function AddressField({
  label,
  value,
  onChangeText,
  placeholder,
  onPick,
  picked,
  onFocus,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  /** Called with the chosen suggestion, including its coordinates. */
  onPick?: (item: AddressSuggestion) => void;
  /** True while the text is a place picked from the suggestions. */
  picked?: boolean;
  /** Lets the screen scroll the field above the keyboard. */
  onFocus?: () => void;
}) {
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set when Done was pressed before the search came back, so the top result is picked as soon as it arrives.
  const pickWhenReady = useRef(false);
  // Bumped whenever a search starts or is cancelled, so late answers from older searches are ignored.
  const latest = useRef(0);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      latest.current += 1;
    },
    [],
  );

  const change = (next: string) => {
    onChangeText(next);
    pickWhenReady.current = false;
    if (timer.current) clearTimeout(timer.current);
    latest.current += 1;

    const query = next.trim();
    if (query.length < MIN_CHARS) {
      setResults([]);
      setLoading(false);
      setProblem(null);
      return;
    }

    const ticket = latest.current;
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const found = await searchAddresses(query);
        if (ticket !== latest.current) return;
        if (pickWhenReady.current && found.results.length > 0) {
          pick(found.results[0]);
          return;
        }
        setResults(found.results);
        setProblem(pickWhenReady.current || found.results.length === 0 ? 'No places found. Try another name.' : null);
        pickWhenReady.current = false;
      } catch (error) {
        if (ticket !== latest.current) return;
        setResults([]);
        setProblem(error instanceof Error ? error.message : 'Address search failed');
      } finally {
        if (ticket === latest.current) setLoading(false);
      }
    }, PAUSE_MS);
  };

  const pick = (item: AddressSuggestion) => {
    pickWhenReady.current = false;
    if (timer.current) clearTimeout(timer.current);
    latest.current += 1;
    setResults([]);
    setLoading(false);
    setProblem(null);
    onChangeText(item.name);
    onPick?.(item);
  };

  /** Done on the keyboard: take the top suggestion, or wait for it if the search is still going. */
  const submit = () => {
    if (results.length > 0 && !loading) {
      pick(results[0]);
      return;
    }
    if (loading) {
      pickWhenReady.current = true;
      return;
    }
    if (!picked) {
      setProblem(value.trim().length < MIN_CHARS ? `Type at least ${MIN_CHARS} letters, then pick a place from the list.` : 'No places found. Try another name.');
    }
  };

  // Wait a moment before closing the list, so a tap on a suggestion is not lost to the field losing focus.
  const closeSoon = () => {
    setTimeout(() => {
      // Done closes the keyboard too; a search still finishing for Done must not be cancelled by that.
      if (pickWhenReady.current) return;
      if (timer.current) clearTimeout(timer.current);
      latest.current += 1;
      setResults([]);
      setLoading(false);
    }, 200);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          value={value}
          onChangeText={change}
          onBlur={closeSoon}
          onFocus={onFocus}
          onSubmitEditing={submit}
          returnKeyType="done"
          placeholder={placeholder}
          placeholderTextColor={C.faint}
          autoCorrect={false}
          style={styles.input}
        />
        {loading ? (
          <ActivityIndicator size="small" color={C.teal} style={styles.spinner} />
        ) : picked && value.trim() ? (
          <Ionicons name="checkmark-circle" size={20} color={C.teal} style={styles.spinner} accessibilityLabel="Place picked" />
        ) : null}
      </View>

      {results.length > 0 ? (
        <View style={styles.list}>
          {results.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => pick(item)}
              accessibilityLabel={item.label}
            >
              <Ionicons name="location-outline" size={18} color={C.teal} />
              <View style={styles.copy}>
                <Text style={styles.line1} numberOfLines={1}>
                  {item.line1 || item.label}
                </Text>
                {item.line2 ? (
                  <Text style={styles.line2} numberOfLines={1}>
                    {item.line2}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {problem ? <Text style={styles.problem}>{problem}</Text> : null}
    </View>
  );
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
  input: {
    height: 48,
    borderRadius: 12,
    backgroundColor: C.field,
    paddingHorizontal: 14,
    paddingRight: 44,
    fontSize: 16,
    color: C.ink,
  },
  spinner: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  list: {
    marginTop: 6,
    borderRadius: 14,
    backgroundColor: C.field,
    paddingVertical: 4,
  },
  row: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copy: {
    flex: 1,
  },
  line1: {
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
  },
  line2: {
    marginTop: 1,
    fontSize: 12,
    color: C.muted,
  },
  problem: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: C.muted,
  },
});
