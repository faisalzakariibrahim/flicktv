import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChannelCard } from '../../components/ChannelCard';
import { theme } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { useChannelsStore } from '../../stores/channelsStore';

export default function FavoritesScreen() {
  const router = useRouter();
  const { favorites, loading, fetchFavorites } = useChannelsStore();
  const { session } = useAuthStore();

  useEffect(() => { if (session) fetchFavorites(); }, [session]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Favorites</Text>
        <Text style={styles.count}>{favorites.length} channels</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={favorites}
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
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>♥</Text>
              <Text style={styles.emptyTitle}>No favorites yet</Text>
              <Text style={styles.emptyText}>Tap the heart on any channel to save it here</Text>
              <Pressable style={styles.browseBtn} onPress={() => router.push('/(tabs)/search')}>
                <Text style={styles.browseBtnText}>Browse Channels</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.md },
  title: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: '800' },
  count: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
  grid: { padding: theme.spacing.md },
  row: { justifyContent: 'space-between', marginBottom: theme.spacing.sm },
  cardWrap: { flex: 1, marginHorizontal: 4 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: theme.spacing.xl },
  emptyIcon: { fontSize: 48, color: theme.colors.border, marginBottom: theme.spacing.md },
  emptyTitle: { color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700', marginBottom: theme.spacing.sm },
  emptyText: { color: theme.colors.textMuted, fontSize: theme.fontSize.md, textAlign: 'center', marginBottom: theme.spacing.lg },
  browseBtn: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.full, paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.sm },
  browseBtnText: { color: '#000', fontWeight: '700', fontSize: theme.fontSize.md },
});
