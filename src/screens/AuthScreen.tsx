import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { signIn, signUp, type ApiUser } from '../api';
import { PrimaryButton, QuietButton } from '../components/Buttons';
import { Field } from '../components/Field';
import { LogoMark } from '../components/LogoMark';
import { C, cardShadow, layout } from '../theme';

/** Sign in, or create an account. Every trip belongs to an account, so this comes before Home. */
export function AuthScreen({ onSignedIn }: { onSignedIn: (token: string, user: ApiUser) => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signingUp = mode === 'signup';
  const ready =
    email.trim().length > 0 && password.length >= (signingUp ? 8 : 1) && (!signingUp || name.trim().length > 0);

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = signingUp
        ? await signUp(name.trim(), email.trim(), password)
        : await signIn(email.trim(), password);
      onSignedIn(result.token, result.user);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not sign in');
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(signingUp ? 'signin' : 'signup');
    setError(null);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={layout.fill}>
      <ScrollView contentContainerStyle={[layout.scroll, styles.scroll]} keyboardShouldPersistTaps="handled">
        <View style={styles.brandLockup}>
          <LogoMark />
          <Text style={styles.brand}>CoDrive</Text>
        </View>
        <Text style={styles.hero}>{signingUp ? 'Join the crew.' : 'Welcome back.'}</Text>
        <Text style={styles.heroSub}>
          {signingUp
            ? 'Create an account to start trips and join the ones your friends share with you.'
            : 'Sign in to see your trips. Only the people on a trip can see its stops and costs.'}
        </Text>

        <View style={styles.card}>
          {signingUp ? <Field label="Your name" value={name} onChangeText={setName} placeholder="Ava" maxLength={60} /> : null}
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" kind="email" maxLength={254} />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={signingUp ? 'At least 8 characters' : 'Your password'}
            kind={signingUp ? 'new-password' : 'password'}
            maxLength={200}
            onSubmitEditing={ready && !busy ? submit : undefined}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <PrimaryButton
              label={busy ? (signingUp ? 'Creating…' : 'Signing in…') : signingUp ? 'Create Account' : 'Sign In'}
              onPress={submit}
              disabled={!ready || busy}
              loading={busy}
            />
            <QuietButton label={signingUp ? 'I already have an account' : 'New here? Create an account'} onPress={switchMode} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
  },
  brand: {
    fontSize: 18,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.3,
  },
  hero: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.8,
  },
  heroSub: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: C.muted,
    maxWidth: 340,
  },
  card: {
    marginTop: 24,
    backgroundColor: C.white,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 6,
    ...cardShadow,
  },
  error: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    color: C.orange,
  },
  actions: {
    marginTop: 18,
  },
});
