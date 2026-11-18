import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, QuietButton } from '../components/Buttons';
import { Dialog, dialogStyles } from '../components/Dialog';
import { Field } from '../components/Field';
import { C } from '../theme';

/** Asks for a short note before a suggested stop is added to the list. */
export function StopNoteDialog({
  stopTitle,
  note,
  onNote,
  onConfirm,
  onClose,
  submitting,
  error,
}: {
  stopTitle: string;
  note: string;
  onNote: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  submitting?: boolean;
  error?: string | null;
}) {
  return (
    <Dialog onClose={onClose}>
      <Text style={dialogStyles.title}>Add a note</Text>
      <Text style={dialogStyles.sub}>Tell the crew why {stopTitle} is worth a stop.</Text>
      <Field
        label="Note"
        value={note}
        onChangeText={onNote}
        placeholder="10 min surf check"
        maxLength={60}
        onSubmitEditing={submitting ? undefined : onConfirm}
      />
      <Text style={styles.hint}>Shows under the stop name. Leave it blank to skip.</Text>
      {error ? <Text style={styles.hint}>{error}</Text> : null}
      <View style={dialogStyles.actions}>
        <PrimaryButton
          label={submitting ? 'Adding…' : 'Add Stop'}
          onPress={onConfirm}
          disabled={submitting}
          loading={submitting}
        />
        <QuietButton label="Cancel" onPress={onClose} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: C.muted,
  },
});
