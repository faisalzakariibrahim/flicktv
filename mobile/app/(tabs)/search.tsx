import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChannelCard } from '../../components/ChannelCard';
import { theme } from '../../constants/theme';
import { api } from '../../lib/api';

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
      const res = await api.channels.list({ search: q.trim(), limit: '50' });
      setResults(res.channels || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search channels..."
          placeholderTextColor={theme.colors.textMuted}
          value={query}
          onChangeText={q => { setQuery(q); search(q); }}
          returnKeyType="search"
          onSubmitEditing={() => search(query)}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable style={styles.clear} onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={i => i.id}
          horizontal={false}
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
              <Text style={styles.empty}>No channels found for "{query}"</Text>
            ) : (
              <Text style={styles.hint}>Search by channel name, category, or country</Text>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: theme.spacing.md, paddingBottom: theme.spacing.sm },
  title: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: '800' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.md },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  clear: { position: 'absolute', right: theme.spacing.md },
  clearText: { color: theme.colors.textMuted, fontSize: theme.fontSize.md },
  grid: { padding: theme.spacing.md },
  row: { justifyContent: 'space-between', marginBottom: theme.spacing.sm },
  cardWrap: { flex: 1, marginHorizontal: 4 },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 40, fontSize: theme.fontSize.md },
  hint: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 60, fontSize: theme.fontSize.md, paddingHorizontal: theme.spacing.xl },
});
