import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: TextInputProps['keyboardType'];
  inputMode?: TextInputProps['inputMode'];
  multiline?: boolean;
  error?: string | null;
  onBlur?: () => void;
  onFocus?: () => void;
  onLayoutY?: (y: number) => void;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  maxLength?: number;
  returnKeyType?: TextInputProps['returnKeyType'];
  blurOnSubmit?: boolean;
  onSubmitEditing?: () => void;
  prefix?: string;
  inputAccessoryViewID?: string;
};

export const Field = forwardRef<TextInputInstance, FieldProps>(function Field(
  {
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType,
    inputMode,
    multiline,
    error,
    onBlur,
    onFocus,
    onLayoutY,
    autoCapitalize,
    autoCorrect,
    autoComplete,
    textContentType,
    maxLength,
    returnKeyType,
    blurOnSubmit,
    onSubmitEditing,
    prefix,
    inputAccessoryViewID,
  },
  ref,
) {
  return (
    <View style={styles.wrap} onLayout={(event) => onLayoutY?.(event.nativeEvent.layout.y)}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, multiline && styles.notesBox, error ? styles.boxError : null]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          placeholderTextColor={C.faint}
          keyboardType={keyboardType}
          inputMode={inputMode}
          multiline={multiline}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoComplete={autoComplete}
          textContentType={textContentType}
          maxLength={maxLength}
          returnKeyType={returnKeyType}
          blurOnSubmit={blurOnSubmit}
          onSubmitEditing={onSubmitEditing}
          inputAccessoryViewID={inputAccessoryViewID}
          accessibilityLabel={label}
          selectionColor={C.teal}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[styles.input, multiline && styles.notes, prefix ? styles.inputWithPrefix : null]}
        />
      </View>
      <FieldWarning message={error} />
    </View>
  );
});

export function FieldWarning({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.warning} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle" size={15} color={C.warn} style={styles.warningIcon} />
      <Text style={styles.warningText}>{message}</Text>
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
  box: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: C.field,
    borderWidth: 1.5,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
  },
  notesBox: {
    minHeight: 88,
    alignItems: 'flex-start',
  },
  boxError: {
    borderColor: C.warn,
    backgroundColor: C.warnBg,
  },
  prefix: {
    marginLeft: 14,
    fontSize: 16,
    fontWeight: '700',
    color: C.ink,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    fontSize: 16,
    color: C.ink,
  },
  inputWithPrefix: {
    paddingLeft: 6,
  },
  notes: {
    minHeight: 88,
    paddingTop: 12,
    paddingBottom: 12,
  },
  warning: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  warningIcon: {
    marginTop: 1,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: C.warn,
  },
});
