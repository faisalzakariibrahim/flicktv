import { useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChannelCard } from '../../components/ChannelCard';
import { theme } from '../../constants/theme';
import { api } from '../../lib/api';

const QUICK = ['News', 'Sports', 'Movies', 'Kids', 'Music', 'Documentary'];

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.channels.list({ search: q.trim(), limit: '60' });
      setResults(res.channels || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => { setQuery(''); setResults([]); setSearched(false); };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.input}
            placeholder="Channels, categories, countries..."
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={q => { setQuery(q); search(q); }}
            returnKeyType="search"
            onSubmitEditing={() => search(query)}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={clear} style={styles.clearBtn}>
              <Text style={styles.clearText}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Quick categories ─────────────────────────────────────── */}
      {!searched && (
        <View style={styles.quickSection}>
          <Text style={styles.quickLabel}>Browse by category</Text>
          <View style={styles.quickGrid}>
            {QUICK.map(cat => (
              <Pressable
                key={cat}
                style={styles.quickChip}
                onPress={() => { setQuery(cat); search(cat); }}
              >
                <Text style={styles.quickChipText}>{cat}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* ── Results ──────────────────────────────────────────────── */}
      {loading ? (
        <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={i => i.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <ChannelCard channel={item} onPress={() => router.push(`/player/${item.id}`)} />
            </View>
          )}
          ListEmptyComponent={
            searched ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>No results for "{query}"</Text>
                <Text style={styles.emptyText}>Try a different name or category</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: theme.spacing.md, paddingTop: 8, paddingBottom: 12 },
  title:  { color: theme.colors.text, fontSize: theme.fontSize.xxl, fontWeight: '900', marginBottom: 14, letterSpacing: -0.5 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    height: 46,
    gap: 8,
  },
  searchIcon: { color: theme.colors.textMuted, fontSize: 18 },
  input: { flex: 1, color: theme.colors.text, fontSize: theme.fontSize.md },
  clearBtn: { padding: 4 },
  clearText: { color: theme.colors.textMuted, fontSize: 14 },

  quickSection: { paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.md },
  quickLabel:   { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  quickGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quickChipText: { color: theme.colors.textSecondary, fontSize: theme.fontSize.sm, fontWeight: '600' },

  grid:    { padding: theme.spacing.md, paddingTop: 4 },
  row:     { justifyContent: 'space-between', marginBottom: theme.spacing.sm },
  cardWrap:{ flex: 1, marginHorizontal: 4 },

  empty:     { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle:{ color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700', marginBottom: 6 },
  emptyText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
});
