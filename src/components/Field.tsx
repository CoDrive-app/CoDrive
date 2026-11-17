import { StyleSheet, Text, TextInput, View } from 'react-native';
import { sanitizeDecimal } from '../input';
import { C } from '../theme';

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  numeric,
  multiline,
  maxLength,
  onSubmitEditing,
  autoFocus,
  kind,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  /** Only accepts digits and one decimal point, and opens the number keypad. */
  numeric?: boolean;
  multiline?: boolean;
  maxLength?: number;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
  /** Sign-in fields: no autocorrect or capitals, the email keyboard, and hidden password text. */
  kind?: 'email' | 'password' | 'new-password';
}) {
  const account = kind
    ? {
        autoCapitalize: 'none' as const,
        autoCorrect: false,
        secureTextEntry: kind !== 'email',
        autoComplete: kind === 'email' ? ('email' as const) : kind === 'password' ? ('current-password' as const) : ('new-password' as const),
        textContentType: kind === 'email' ? ('emailAddress' as const) : kind === 'password' ? ('password' as const) : ('newPassword' as const),
      }
    : {};
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={numeric ? (text: string) => onChangeText(sanitizeDecimal(text)) : onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        keyboardType={numeric ? 'decimal-pad' : kind === 'email' ? 'email-address' : 'default'}
        inputMode={numeric ? 'decimal' : kind === 'email' ? 'email' : undefined}
        {...account}
        multiline={multiline}
        maxLength={maxLength}
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        returnKeyType={onSubmitEditing ? 'done' : undefined}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.notes]}
      />
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
    fontSize: 16,
    color: C.ink,
  },
  notes: {
    height: 88,
    paddingTop: 12,
    paddingBottom: 12,
  },
});
