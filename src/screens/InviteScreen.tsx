import { useState } from 'react';
import { Linking, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { slug } from '../data';
import { C, cardShadow, layout } from '../theme';
import type { Trip } from '../types';
import { PrimaryButton } from '../components/Buttons';
import { QrMark } from '../components/QrMark';

export function InviteScreen({ trip, onDone }: { trip: Trip; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const joinKey = trip.shareCode ?? slug(trip.title);
  const url = `https://codrive.app/join/${joinKey}`;

  const copyLink = async () => {
    try {
      const clipboard = (
        globalThis as { navigator?: { clipboard?: { writeText: (value: string) => Promise<void> } } }
      ).navigator?.clipboard;
      if (Platform.OS === 'web' && clipboard) {
        await clipboard.writeText(url);
      } else {
        await Share.share({ message: url });
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const open = (target: string) => {
    Linking.openURL(target).catch(() => {
      Share.share({ message: url }).catch(() => undefined);
    });
  };

  const actions = [
    { icon: 'chatbubble-outline' as const, label: 'Messages', onPress: () => open(`sms:&body=${encodeURIComponent(url)}`) },
    { icon: 'call-outline' as const, label: 'Phone', onPress: () => Share.share({ message: url }).catch(() => undefined) },
    {
      icon: 'mail-outline' as const,
      label: 'Mail',
      onPress: () =>
        open(`mailto:?subject=${encodeURIComponent('Join my CoDrive trip')}&body=${encodeURIComponent(url)}`),
    },
    {
      icon: 'share-outline' as const,
      label: 'Share',
      onPress: () => Share.share({ message: `Join ${trip.title} on CoDrive\n${url}` }).catch(() => undefined),
    },
  ];

  return (
    <View style={[styles.layer, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Invite Your Crew</Text>
        <Text style={styles.sub}>Get everyone on the same live map.</Text>
        <View style={styles.qrCard}>
          <QrMark />
        </View>
        <Text style={styles.hint}>
          Share the code below. Your crew signs in, taps Join with a Code on Home, and enters it.
        </Text>
        {trip.shareCode ? (
          <View style={styles.codeBlock}>
            <Text style={styles.codeLabel}>Share code</Text>
            <Text style={styles.code}>{trip.shareCode}</Text>
          </View>
        ) : null}
        <TouchableOpacity style={styles.link} onPress={copyLink} activeOpacity={0.85}>
          <Text style={styles.linkText} numberOfLines={1}>
            {copied ? 'Link copied' : `codrive.app/join/${joinKey}`}
          </Text>
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={C.teal} />
        </TouchableOpacity>
        <View style={styles.shareRow}>
          {actions.map((action) => (
            <TouchableOpacity key={action.label} style={styles.shareItem} onPress={action.onPress} activeOpacity={0.8}>
              <View style={styles.shareCircle}>
                <Ionicons name={action.icon} size={20} color={C.teal} />
              </View>
              <Text style={styles.shareLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <View style={[layout.dock, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <PrimaryButton label="Done" onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: C.cream,
    zIndex: 50,
  },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.7,
  },
  sub: {
    marginTop: 6,
    fontSize: 15,
    color: C.muted,
  },
  qrCard: {
    alignSelf: 'center',
    marginTop: 28,
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 14,
    ...cardShadow,
  },
  hint: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: C.muted,
    paddingHorizontal: 12,
  },
  codeBlock: {
    marginTop: 18,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.muted,
  },
  code: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
    color: C.ink,
  },
  link: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EFEBE4',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: C.ink,
  },
  shareRow: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shareItem: {
    width: 72,
    alignItems: 'center',
  },
  shareCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  shareLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
  },
});
