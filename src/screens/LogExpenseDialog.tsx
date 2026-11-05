import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { PrimaryButton, QuietButton } from '../components/Buttons';
import { Dialog, dialogStyles } from '../components/Dialog';
import { Field } from '../components/Field';
import { C } from '../theme';

export const MAX_EXPENSE_PHOTOS = 4;

export function LogExpenseDialog({
  tripTitle,
  name,
  amount,
  notes,
  photos,
  onName,
  onAmount,
  onNotes,
  onPhotos,
  onLog,
  onClose,
  canLog,
  submitting,
  error,
}: {
  tripTitle: string;
  name: string;
  amount: string;
  notes: string;
  photos: string[];
  onName: (value: string) => void;
  onAmount: (value: string) => void;
  onNotes: (value: string) => void;
  onPhotos: (value: string[]) => void;
  onLog: () => void;
  onClose: () => void;
  canLog: boolean;
  submitting?: boolean;
  error?: string | null;
}) {
  const [choosingSource, setChoosingSource] = useState(false);
  const [photoNote, setPhotoNote] = useState<string | null>(null);

  const addPhoto = async (source: 'camera' | 'library') => {
    setChoosingSource(false);
    setPhotoNote(null);
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoNote(
        source === 'camera'
          ? 'Camera access is off. Turn it on in Settings to snap a receipt.'
          : 'Photo access is off. Turn it on in Settings to attach a receipt.',
      );
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, base64: true };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    const data = asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri;
    onPhotos([...photos, data]);
  };

  return (
    <Dialog onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
        <Text style={dialogStyles.title}>Log Expense</Text>
        <Text style={dialogStyles.sub}>Add it to the shared log for {tripTitle}.</Text>

        <Field label="What was it" value={name} onChangeText={onName} placeholder="Gas, dinner, stay" />
        <Field label="Amount" value={amount} onChangeText={onAmount} placeholder="45.00" keyboardType="decimal-pad" />
        <Field
          label="Notes"
          value={notes}
          onChangeText={onNotes}
          placeholder="Who paid, and if it was split"
          multiline
        />

        <Text style={styles.label}>Photos</Text>
        <View style={styles.photos}>
          {photos.map((uri, index) => (
            <View key={`${index}-${uri.length}`} style={styles.thumbWrap}>
              <Image source={{ uri }} style={styles.thumb} />
              <Pressable
                style={styles.remove}
                onPress={() => onPhotos(photos.filter((_, i) => i !== index))}
                accessibilityLabel="Remove photo"
                hitSlop={8}
              >
                <Ionicons name="close" size={14} color={C.white} />
              </Pressable>
            </View>
          ))}
          {photos.length < MAX_EXPENSE_PHOTOS ? (
            <TouchableOpacity
              style={styles.addPhoto}
              onPress={() => setChoosingSource((open) => !open)}
              accessibilityLabel="Add photo"
            >
              <Ionicons name="camera-outline" size={22} color={C.teal} />
              <Text style={styles.addPhotoText}>Add</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {choosingSource ? (
          <View style={styles.sourceCard}>
            <Text style={styles.sourceTitle}>Add a photo from</Text>
            <TouchableOpacity style={styles.sourceRow} onPress={() => addPhoto('camera')}>
              <Ionicons name="camera" size={18} color={C.ink} />
              <Text style={styles.sourceText}>Take photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sourceRow} onPress={() => addPhoto('library')}>
              <Ionicons name="images" size={18} color={C.ink} />
              <Text style={styles.sourceText}>Choose from camera roll</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {photoNote ? <Text style={styles.error}>{photoNote}</Text> : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={dialogStyles.actions}>
          <PrimaryButton
            label={submitting ? 'Logging…' : 'Log Expense'}
            onPress={onLog}
            disabled={!canLog || submitting}
            loading={submitting}
          />
          <QuietButton label="Cancel" onPress={onClose} />
        </View>
      </ScrollView>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  label: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '600',
    color: C.body,
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  thumbWrap: {
    width: 64,
    height: 64,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: C.field,
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: C.teal,
  },
  sourceCard: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: C.field,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  sourceTitle: {
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  sourceText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
  },
  error: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    color: C.muted,
  },
});
