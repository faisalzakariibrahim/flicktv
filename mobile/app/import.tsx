import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { api } from '../lib/api';
import { useChannelsStore } from '../stores/channelsStore';
import { useAuthStore } from '../stores/authStore';

type ImportType = 'm3u_url' | 'xtream';

const PRESET_SOURCES = [
  {
    name: 'IPTV-Org — All Channels',
    description: '8 000+ free channels worldwide',
    url: 'https://iptv-org.github.io/iptv/index.m3u',
    badge: 'Popular',
  },
  {
    name: 'IPTV-Org — News',
    description: 'Global news channels only',
    url: 'https://iptv-org.github.io/iptv/categories/news.m3u',
    badge: 'News',
  },
  {
    name: 'IPTV-Org — Sports',
    description: 'Sports channels worldwide',
    url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
    badge: 'Sports',
  },
  {
    name: 'IPTV-Org — Movies',
    description: 'Movies & cinema channels',
    url: 'https://iptv-org.github.io/iptv/categories/movies.m3u',
    badge: 'Movies',
  },
  {
    name: 'IPTV-Org — Music',
    description: 'Music video channels',
    url: 'https://iptv-org.github.io/iptv/categories/music.m3u',
    badge: 'Music',
  },
  {
    name: 'IPTV-Org — Kids',
    description: "Children's TV channels",
    url: 'https://iptv-org.github.io/iptv/categories/kids.m3u',
    badge: 'Kids',
  },
  {
    name: 'IPTV-Org — Documentary',
    description: 'Documentary & educational',
    url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u',
    badge: 'Docs',
  },
  {
    name: 'clubTivi — Free IPTV',
    description: 'Curated European channels',
    url: 'https://raw.githubusercontent.com/Free-IPTV/Countries/master/index.m3u',
    badge: 'Europe',
  },
  {
    name: 'Open TV — Public Sources',
    description: 'Open-source IPTV collection',
    url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/int.m3u',
    badge: 'Open',
  },
];

const BADGE_COLORS: Record<string, string> = {
  Popular: '#00ff88',
  News:    '#3b9edd',
  Sports:  '#f59e0b',
  Movies:  '#a855f7',
  Music:   '#ec4899',
  Kids:    '#22d3ee',
  Docs:    '#84cc16',
  Europe:  '#f97316',
  Open:    '#6366f1',
};

export default function ImportScreen() {
  const router = useRouter();
  const { session } = useAuthStore();
  const { fetchPlaylists, fetchChannels } = useChannelsStore();

  const [type, setType] = useState<ImportType>('m3u_url');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [xtreamUser, setXtreamUser] = useState('');
  const [xtreamPass, setXtreamPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [importingPreset, setImportingPreset] = useState<string | null>(null);

  const requireSignIn = () => {
    Alert.alert('Sign In Required', 'Create a free account to import and save playlists.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign In', onPress: () => { router.back(); router.push('/(auth)/login'); } },
    ]);
  };

  const doImport = async (importName: string, importUrl: string, importType: ImportType = 'm3u_url') => {
    if (!session) { requireSignIn(); return; }
    setError('');
    setLoading(true);
    try {
      await api.playlists.create({ name: importName, type: importType, url: importUrl, xtream_user: xtreamUser || undefined, xtream_pass: xtreamPass || undefined });
      setSuccess(true);
      await fetchPlaylists();
      await fetchChannels();
      setTimeout(() => router.back(), 1500);
    } catch (e: any) {
      setError(e.message || 'Import failed');
    } finally {
      setLoading(false);
      setImportingPreset(null);
    }
  };

  const handleImport = async () => {
    if (!name.trim()) { setError('Give your playlist a name'); return; }
    if (!url.trim()) { setError('URL is required'); return; }
    if (type === 'xtream' && (!xtreamUser || !xtreamPass)) { setError('Xtream username and password required'); return; }
    await doImport(name.trim(), url.trim(), type);
  };

  const handlePreset = async (preset: typeof PRESET_SOURCES[0]) => {
    setImportingPreset(preset.url);
    await doImport(preset.name, preset.url);
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

          {/* ── Free Sources ──────────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>Free Sources — One Tap Import</Text>
          <View style={styles.presetGrid}>
            {PRESET_SOURCES.map(preset => {
              const isImporting = importingPreset === preset.url;
              const badgeColor = BADGE_COLORS[preset.badge] || theme.colors.accent;
              return (
                <Pressable
                  key={preset.url}
                  style={[styles.presetCard, isImporting && styles.presetCardActive]}
                  onPress={() => !loading && handlePreset(preset)}
                  disabled={loading}
                >
                  <View style={[styles.badge, { backgroundColor: badgeColor + '22', borderColor: badgeColor }]}>
                    <Text style={[styles.badgeText, { color: badgeColor }]}>{preset.badge}</Text>
                  </View>
                  <Text style={styles.presetName} numberOfLines={1}>{preset.name}</Text>
                  <Text style={styles.presetDesc} numberOfLines={2}>{preset.description}</Text>
                  {isImporting && <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 6 }} size="small" />}
                </Pressable>
              );
            })}
          </View>

          {/* ── Divider ───────────────────────────────────────────────────── */}
          <View style={styles.divider}>
            <View style={styles.divLine} />
            <Text style={styles.divText}>or add custom</Text>
            <View style={styles.divLine} />
          </View>

          {/* ── Type toggle ───────────────────────────────────────────────── */}
          <View style={styles.toggle}>
            {(['m3u_url', 'xtream'] as ImportType[]).map(t => (
              <Pressable key={t} style={[styles.toggleBtn, type === t && styles.toggleBtnActive]} onPress={() => setType(t)}>
                <Text style={[styles.toggleText, type === t && styles.toggleTextActive]}>
                  {t === 'm3u_url' ? 'M3U URL' : 'Xtream Codes'}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput style={styles.input} placeholder="Playlist name" placeholderTextColor={theme.colors.textMuted} value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder={type === 'm3u_url' ? 'https://example.com/playlist.m3u8' : 'http://server:port'} placeholderTextColor={theme.colors.textMuted} value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />

          {type === 'xtream' && (
            <>
              <TextInput style={styles.input} placeholder="Username" placeholderTextColor={theme.colors.textMuted} value={xtreamUser} onChangeText={setXtreamUser} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="Password" placeholderTextColor={theme.colors.textMuted} value={xtreamPass} onChangeText={setXtreamPass} secureTextEntry />
            </>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}
          {success && <Text style={styles.successText}>✓ Playlist imported! Syncing channels...</Text>}

          <Pressable style={[styles.btn, (loading || !name || !url) && styles.btnDisabled]} onPress={handleImport} disabled={loading || !name.trim() || !url.trim()}>
            {loading && !importingPreset ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>Import Playlist</Text>}
          </Pressable>

          <Text style={styles.hint}>
            {type === 'm3u_url'
              ? 'Paste any public M3U or M3U8 URL. Channels sync automatically.'
              : 'Enter your Xtream Codes server details. All live channels will be imported.'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.md, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg },
  cancel: { color: theme.colors.textSecondary, fontSize: theme.fontSize.md },
  title: { color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700' },
  sectionLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: theme.spacing.sm },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: theme.spacing.lg },
  presetCard: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
  },
  presetCardActive: { borderColor: theme.colors.accent },
  badge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  presetName: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: '700', marginBottom: 2 },
  presetDesc: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 15 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: theme.spacing.md },
  divLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  divText: { color: theme.colors.textMuted, marginHorizontal: theme.spacing.sm, fontSize: theme.fontSize.sm },
  toggle: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 4, marginBottom: theme.spacing.md },
  toggleBtn: { flex: 1, paddingVertical: theme.spacing.sm, alignItems: 'center', borderRadius: theme.radius.sm },
  toggleBtnActive: { backgroundColor: theme.colors.accent },
  toggleText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '600' },
  toggleTextActive: { color: '#000' },
  input: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.text, fontSize: theme.fontSize.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  error: { color: theme.colors.error, fontSize: theme.fontSize.sm, marginBottom: theme.spacing.sm },
  successText: { color: theme.colors.accent, fontSize: theme.fontSize.sm, marginBottom: theme.spacing.sm },
  btn: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.full, paddingVertical: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.sm },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#000', fontSize: theme.fontSize.md, fontWeight: '700' },
  hint: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, textAlign: 'center', marginTop: theme.spacing.lg, lineHeight: 20 },
});
