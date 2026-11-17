import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { PrimaryButton, QuietButton } from '../components/Buttons';
import { Dialog, dialogStyles } from '../components/Dialog';
import { ProfileMark } from '../components/ProfileMark';
import { C } from '../theme';

export function ProfileDialog({
  name,
  email,
  uri,
  onPhoto,
  onClear,
  onSignOut,
  onClose,
}: {
  name: string;
  email: string;
  uri: string | null;
  onPhoto: (uri: string) => void;
  onClear: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choosePhoto = async () => {
    setBusy(true);
    setNote(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setNote('Photo access is off. You can still use an anonymous picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) onPhoto(result.assets[0].uri);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog onClose={onClose}>
      <Text style={dialogStyles.title}>Your profile</Text>
      <Text style={dialogStyles.sub}>Starts as an anonymous picture. Choose a photo to replace it.</Text>
      <View style={styles.preview}>
        <ProfileMark uri={uri} size={72} />
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{email}</Text>
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <View style={dialogStyles.actions}>
        <PrimaryButton label={busy ? 'Opening…' : 'Choose a photo'} onPress={choosePhoto} disabled={busy} />
        {uri ? <QuietButton label="Use anonymous picture" onPress={onClear} /> : null}
        <QuietButton label="Sign out" onPress={onSignOut} />
        <QuietButton label="Done" onPress={onClose} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  preview: {
    alignItems: 'center',
    marginTop: 18,
  },
  name: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '700',
    color: C.ink,
  },
  email: {
    marginTop: 2,
    fontSize: 13,
    color: C.muted,
  },
  note: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    color: C.muted,
  },
});
