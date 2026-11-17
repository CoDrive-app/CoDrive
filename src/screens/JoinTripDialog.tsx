import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, QuietButton } from '../components/Buttons';
import { Dialog, dialogStyles } from '../components/Dialog';
import { Field } from '../components/Field';
import { C } from '../theme';

/** Joins a trip someone shared with you. The share code is the only way onto someone else's trip. */
export function JoinTripDialog({
  code,
  onCode,
  onSubmit,
  onClose,
  submitting,
  error,
}: {
  code: string;
  onCode: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const canSubmit = code.trim().length >= 4;
  return (
    <Dialog onClose={onClose}>
      <Text style={dialogStyles.title}>Join a Trip</Text>
      <Text style={dialogStyles.sub}>Enter the share code from your invite.</Text>
      <Field
        label="Share code"
        value={code}
        onChangeText={(value) => onCode(value.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase())}
        placeholder="N7XUAUT2"
        maxLength={16}
        onSubmitEditing={canSubmit && !submitting ? onSubmit : undefined}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={dialogStyles.actions}>
        <PrimaryButton
          label={submitting ? 'Joining…' : 'Join Trip'}
          onPress={onSubmit}
          disabled={!canSubmit || submitting}
          loading={submitting}
        />
        <QuietButton label="Cancel" onPress={onClose} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  error: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: C.muted,
  },
});
