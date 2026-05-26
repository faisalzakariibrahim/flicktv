import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { api } from '../lib/api';
import { useChannelsStore } from '../stores/channelsStore';

type ImportType = 'm3u_url' | 'xtream';

export default function ImportScreen() {
  const router = useRouter();
  const { fetchPlaylists, fetchChannels } = useChannelsStore();

  const [type, setType] = useState<ImportType>('m3u_url');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [xtreamUser, setXtreamUser] = useState('');
  const [xtreamPass, setXtreamPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleImport = async () => {
    setError('');
    if (!name.trim()) { setError('Give your playlist a name'); return; }
    if (!url.trim()) { setError('URL is required'); return; }
    if (type === 'xtream' && (!xtreamUser || !xtreamPass)) { setError('Xtream username and password required'); return; }

    setLoading(true);
    try {
      await api.playlists.create({ name: name.trim(), type, url: url.trim(), xtream_user: xtreamUser || undefined, xtream_pass: xtreamPass || undefined });
      setSuccess(true);
      await fetchPlaylists();
      await fetchChannels();
      setTimeout(() => router.back(), 1500);
    } catch (e: any) {
      setError(e.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <View style={styles.header}>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>Import Playlist</Text>
            <View style={{ width: 56 }} />
          </View>

          {/* Type toggle */}
          <View style={styles.toggle}>
            {(['m3u_url', 'xtream'] as ImportType[]).map(t => (
              <Pressable key={t} style={[styles.toggleBtn, type === t && styles.toggleBtnActive]} onPress={() => setType(t)}>
                <Text style={[styles.toggleText, type === t && styles.toggleTextActive]}>
                  {t === 'm3u_url' ? 'M3U URL' : 'Xtream Codes'}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput style={styles.input} placeholder="Playlist name (e.g. My IPTV)" placeholderTextColor={theme.colors.textMuted} value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder={type === 'm3u_url' ? 'https://example.com/playlist.m3u8' : 'http://server:port'} placeholderTextColor={theme.colors.textMuted} value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />

          {type === 'xtream' && (
            <>
              <TextInput style={styles.input} placeholder="Username" placeholderTextColor={theme.colors.textMuted} value={xtreamUser} onChangeText={setXtreamUser} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="Password" placeholderTextColor={theme.colors.textMuted} value={xtreamPass} onChangeText={setXtreamPass} secureTextEntry />
            </>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}
          {success && <Text style={styles.successText}>✓ Playlist imported! Syncing channels...</Text>}

          <Pressable style={[styles.btn, loading && styles.btnDisabled]} onPress={handleImport} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>Import Playlist</Text>}
          </Pressable>

          <Text style={styles.hint}>
            {type === 'm3u_url'
              ? 'Enter any public M3U or M3U8 playlist URL. Channels sync automatically.'
              : 'Enter your Xtream Codes server details. All live channels will be imported.'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg },
  cancel: { color: theme.colors.textSecondary, fontSize: theme.fontSize.md },
  title: { color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700' },
  toggle: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 4, marginBottom: theme.spacing.md },
  toggleBtn: { flex: 1, paddingVertical: theme.spacing.sm, alignItems: 'center', borderRadius: theme.radius.sm },
  toggleBtnActive: { backgroundColor: theme.colors.accent },
  toggleText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '600' },
  toggleTextActive: { color: '#000' },
  input: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.text, fontSize: theme.fontSize.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  error: { color: theme.colors.error, fontSize: theme.fontSize.sm, marginBottom: theme.spacing.sm },
  successText: { color: theme.colors.accent, fontSize: theme.fontSize.sm, marginBottom: theme.spacing.sm },
  btn: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.full, paddingVertical: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.sm },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#000', fontSize: theme.fontSize.md, fontWeight: '700' },
  hint: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, textAlign: 'center', marginTop: theme.spacing.lg, lineHeight: 20 },
});
