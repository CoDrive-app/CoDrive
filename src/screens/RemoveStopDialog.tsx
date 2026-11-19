import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, QuietButton } from '../components/Buttons';
import { Dialog, dialogStyles } from '../components/Dialog';
import { C } from '../theme';

/** Checks before a stop is removed, because it goes for the whole crew along with its votes. */
export function RemoveStopDialog({
  stopTitle,
  onConfirm,
  onClose,
  submitting,
  error,
}: {
  stopTitle: string;
  onConfirm: () => void;
  onClose: () => void;
  submitting?: boolean;
  error?: string | null;
}) {
  return (
    <Dialog onClose={onClose}>
      <Text style={dialogStyles.title}>Remove this stop?</Text>
      <Text style={dialogStyles.sub}>
        {stopTitle} and its votes will be removed for everyone on the trip. This can't be undone.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={dialogStyles.actions}>
        <PrimaryButton
          label={submitting ? 'Removing…' : 'Remove stop'}
          onPress={onConfirm}
          disabled={submitting}
          loading={submitting}
          danger
        />
        <QuietButton label="Cancel" onPress={onClose} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  error: {
    marginTop: 10,
    fontSize: 13,
    color: C.ink,
  },
});
