import { useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { theme } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';

type Mode = 'signin' | 'signup';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signInWithEmail, signUpWithEmail } = useAuthStore();

  const handleSubmit = async () => {
    setError('');
    if (!email || !password) { setError('Email and password are required'); return; }
    if (mode === 'signup' && !name) { setError('Name is required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }

    setLoading(true);
    try {
      if (mode === 'signin') await signInWithEmail(email.trim(), password);
      else await signUpWithEmail(email.trim(), password, name.trim());
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.logoRow}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brand}>FlickTV</Text>
        </View>

        <Text style={styles.headline}>
          {mode === 'signin' ? 'Welcome back' : 'Create account'}
        </Text>
        <Text style={styles.sub}>
          {mode === 'signin' ? 'Sign in to continue streaming' : 'Join FlickTV — free to start'}
        </Text>

        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={theme.colors.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor={theme.colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={theme.colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.btnText}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>
          }
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.line} />
        </View>

        <Text style={styles.switchText}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <Text style={styles.switchLink} onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </Text>
        </Text>

        <Text style={styles.freeNote}>✓  3 free streams included • No credit card needed</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: theme.spacing.xl },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.xl },
  logo: { width: 48, height: 48, marginRight: theme.spacing.sm },
  brand: { color: theme.colors.text, fontSize: theme.fontSize.xxl, fontWeight: '800' },
  headline: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: '700', textAlign: 'center' },
  sub: { color: theme.colors.textSecondary, fontSize: theme.fontSize.md, textAlign: 'center', marginBottom: theme.spacing.xl, marginTop: 4 },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  error: { color: theme.colors.error, fontSize: theme.fontSize.sm, marginBottom: theme.spacing.sm, textAlign: 'center' },
  btn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#000', fontSize: theme.fontSize.md, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: theme.spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { color: theme.colors.textMuted, marginHorizontal: theme.spacing.sm, fontSize: theme.fontSize.sm },
  switchText: { color: theme.colors.textSecondary, textAlign: 'center', fontSize: theme.fontSize.sm },
  switchLink: { color: theme.colors.accent, fontWeight: '600' },
  freeNote: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, textAlign: 'center', marginTop: theme.spacing.xl },
});
