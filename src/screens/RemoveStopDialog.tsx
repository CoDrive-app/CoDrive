import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, QuietButton } from '../components/Buttons';
import { Dialog, dialogStyles } from '../components/Dialog';
import { C } from '../theme';

/** Checks before a stop is removed, because it goes for the whole crew along with its votes. */
export function RemoveStopDialog({
  stopTitle,
  kind,
  suggestedBy,
  onConfirm,
  onClose,
  submitting,
  error,
}: {
  stopTitle: string;
  /** A suggestion, or the trip's start or end point. */
  kind: 'suggestion' | 'start' | 'end';
  /** Whose suggestion it is, when it isn't yours. */
  suggestedBy?: string;
  onConfirm: () => void;
  onClose: () => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const endpoint = kind === 'start' || kind === 'end';
  const title = endpoint
    ? `Remove the trip's ${kind} point?`
    : suggestedBy
      ? `Remove ${suggestedBy}'s suggestion?`
      : 'Remove your suggestion?';
  const detail = endpoint
    ? `${stopTitle} will no longer be the trip's ${kind} point, for everyone on the trip. This can't be undone.`
    : `${stopTitle} and its votes will be removed for everyone on the trip. This can't be undone.`;
  return (
    <Dialog onClose={onClose}>
      <Text style={dialogStyles.title}>{title}</Text>
      <Text style={dialogStyles.sub}>{detail}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={dialogStyles.actions}>
        <PrimaryButton
          label={submitting ? 'Removing…' : endpoint ? `Remove ${kind}` : 'Remove suggestion'}
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
