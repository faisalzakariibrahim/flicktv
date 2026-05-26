import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChannelCard } from '../../components/ChannelCard';
import { CategoryPill } from '../../components/CategoryPill';
import { theme } from '../../constants/theme';
import { api } from '../../lib/api';

const CATS = [
  { label: 'All Live', value: 'all' },
  { label: 'News', value: 'news' },
  { label: 'Sports', value: 'sports' },
  { label: 'Movies', value: 'movies' },
  { label: 'Entertainment', value: 'entertainment' },
];

export default function LiveScreen() {
  const router = useRouter();
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');

  const load = async (cat: string) => {
    setLoading(true);
    try {
      const params: any = { is_live: 'true', limit: '100' };
      if (cat !== 'all') params.category = cat;
      const res = await api.channels.list(params);
      setChannels(res.channels || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(category); }, [category]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Live TV</Text>
        <View style={styles.dot} />
      </View>

      <FlatList
        horizontal
        data={CATS}
        keyExtractor={i => i.value}
        renderItem={({ item }) => (
          <CategoryPill label={item.label} value={item.value} selected={category === item.value} onPress={() => setCategory(item.value)} />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pills}
      />

      {loading ? (
        <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={channels}
          keyExtractor={i => i.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <ChannelCard channel={item} onPress={() => router.push(`/player/${item.id}`)} />
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No live channels found</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md },
  title: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: '800', marginRight: theme.spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.live },
  pills: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md },
  grid: { padding: theme.spacing.md },
  row: { justifyContent: 'space-between', marginBottom: theme.spacing.sm },
  cardWrap: { flex: 1, marginHorizontal: 4 },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 40, fontSize: theme.fontSize.md },
});
