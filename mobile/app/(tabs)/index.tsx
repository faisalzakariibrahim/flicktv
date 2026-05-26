import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChannelCard } from '../../components/ChannelCard';
import { CategoryPill } from '../../components/CategoryPill';
import { theme } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { useChannelsStore } from '../../stores/channelsStore';

const CATEGORIES = [
  { label: 'All', value: 'all' },
  { label: 'News', value: 'news' },
  { label: 'Sports', value: 'sports' },
  { label: 'Movies', value: 'movies' },
  { label: 'Kids', value: 'kids' },
  { label: 'Music', value: 'music' },
  { label: 'Documentary', value: 'documentary' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, session } = useAuthStore();
  const { channels, trending, history, loading, selectedCategory, fetchChannels, fetchTrending, fetchHistory, setCategory } = useChannelsStore();

  useEffect(() => {
    if (!session) return;
    fetchChannels();
    fetchTrending();
    fetchHistory();
  }, [session]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.brandName}>FlickTV</Text>
          </View>
          <Pressable style={styles.aiBtn} onPress={() => router.push('/ai')}>
            <Text style={styles.aiBtnText}>✦ Flick AI</Text>
          </Pressable>
        </View>

        {/* Category pills */}
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={i => i.value}
          renderItem={({ item }) => (
            <CategoryPill
              label={item.label}
              value={item.value}
              selected={selectedCategory === item.value}
              onPress={() => setCategory(item.value)}
            />
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pills}
        />

        {/* Continue Watching */}
        {history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Continue Watching</Text>
            <FlatList
              horizontal
              data={history.slice(0, 10)}
              keyExtractor={i => i.id}
              renderItem={({ item }) => (
                <ChannelCard
                  size="sm"
                  channel={{ id: item.channel_id, name: item.channel_name, logo_url: item.channel_logo, is_live: true }}
                  onPress={() => router.push(`/player/${item.channel_id}`)}
                />
              )}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        )}

        {/* Trending */}
        {trending.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trending Now</Text>
            <FlatList
              horizontal
              data={trending}
              keyExtractor={i => i.id}
              renderItem={({ item }) => (
                <ChannelCard channel={item} onPress={() => router.push(`/player/${item.id}`)} />
              )}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        )}

        {/* All Channels */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Channels</Text>
          {loading ? (
            <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 20 }} />
          ) : channels.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No channels yet</Text>
              <Pressable style={styles.importBtn} onPress={() => router.push('/import')}>
                <Text style={styles.importBtnText}>+ Import Playlist</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              horizontal
              data={channels}
              keyExtractor={i => i.id}
              renderItem={({ item }) => (
                <ChannelCard channel={item} onPress={() => router.push(`/player/${item.id}`)} />
              )}
              showsHorizontalScrollIndicator={false}
            />
          )}
        </View>

        <View style={{ height: theme.spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.md, paddingBottom: theme.spacing.sm },
  greeting: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
  brandName: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: '800' },
  aiBtn: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.full, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderWidth: 1, borderColor: theme.colors.accent },
  aiBtnText: { color: theme.colors.accent, fontSize: theme.fontSize.sm, fontWeight: '600' },
  pills: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md },
  section: { paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.lg },
  sectionTitle: { color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700', marginBottom: theme.spacing.sm },
  empty: { alignItems: 'center', paddingVertical: theme.spacing.xl },
  emptyText: { color: theme.colors.textMuted, fontSize: theme.fontSize.md, marginBottom: theme.spacing.md },
  importBtn: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.full, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.sm },
  importBtnText: { color: '#000', fontWeight: '700', fontSize: theme.fontSize.md },
});
