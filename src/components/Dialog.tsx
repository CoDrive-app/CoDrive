import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';

export function Dialog({
  children,
  onClose,
  sheet,
  fitContent,
}: {
  children: ReactNode;
  onClose: () => void;
  sheet?: boolean;
  fitContent?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[dialogStyles.overlay, sheet && dialogStyles.sheetOverlay]}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close dialog" />
      <View
        style={[
          dialogStyles.card,
          sheet && dialogStyles.sheet,
          sheet && fitContent && dialogStyles.sheetFit,
          sheet && { paddingBottom: Math.max(insets.bottom, 10) },
        ]}
      >
        {sheet ? <View style={dialogStyles.handle} /> : null}
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}

export const dialogStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(17, 28, 22, 0.58)',
    justifyContent: 'center',
    paddingHorizontal: 18,
    zIndex: 40,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 8,
    maxHeight: '90%',
    shadowColor: '#1C1917',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  sheetOverlay: {
    justifyContent: 'flex-end',
    paddingHorizontal: 0,
  },
  sheet: {
    width: '100%',
    height: '94%',
    maxHeight: '94%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: 10,
  },
  sheetFit: {
    height: undefined,
    maxHeight: '75%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.line,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.3,
  },
  sub: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: C.muted,
  },
  actions: {
    marginTop: 18,
  },
  center: {
    textAlign: 'center',
  },
});
