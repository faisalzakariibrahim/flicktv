import { useEffect, useCallback } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable,
  ScrollView, StyleSheet, Text, View, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryPill } from '../../components/CategoryPill';
import { ChannelCard } from '../../components/ChannelCard';
import { theme } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { useChannelsStore } from '../../stores/channelsStore';

const CATEGORIES = [
  { label: 'All',          value: 'all',          icon: '⊞' },
  { label: 'News',         value: 'news',         icon: '📰' },
  { label: 'Sports',       value: 'sports',       icon: '⚽' },
  { label: 'Movies',       value: 'movies',       icon: '🎬' },
  { label: 'Kids',         value: 'kids',         icon: '🧒' },
  { label: 'Music',        value: 'music',        icon: '🎵' },
  { label: 'Documentary',  value: 'documentary',  icon: '🌍' },
  { label: 'Entertainment',value: 'entertainment',icon: '🎭' },
  { label: 'Religious',    value: 'religious',    icon: '🙏' },
];

function HeroChannel({ channel, onPress }: { channel: any; onPress: () => void }) {
  return (
    <Pressable style={styles.hero} onPress={onPress}>
      <View style={styles.heroBg}>
        {channel.logo_url ? (
          <Image source={{ uri: channel.logo_url }} style={styles.heroBgImg} resizeMode="cover" blurRadius={20} />
        ) : null}
        <View style={styles.heroDim} />
      </View>

      <View style={styles.heroContent}>
        {channel.logo_url ? (
          <Image source={{ uri: channel.logo_url }} style={styles.heroLogo} resizeMode="contain" />
        ) : (
          <View style={styles.heroLogoFallback}>
            <Text style={styles.heroLogoText}>{channel.name[0]}</Text>
          </View>
        )}
        <View style={styles.heroMeta}>
          {channel.is_live && (
            <View style={styles.heroLiveBadge}>
              <View style={styles.heroLiveDot} />
              <Text style={styles.heroLiveText}>LIVE NOW</Text>
            </View>
          )}
          <Text style={styles.heroTitle} numberOfLines={2}>{channel.name}</Text>
          {channel.category && (
            <Text style={styles.heroCategory}>
              {channel.category.charAt(0).toUpperCase() + channel.category.slice(1)}
              {channel.is_hd ? ' · HD' : ''}
              {channel.is_4k ? ' · 4K' : ''}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.heroActions}>
        <Pressable style={styles.playBtn} onPress={onPress}>
          <Text style={styles.playBtnText}>▶  Watch Now</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function SectionRow({ title, data, onPress }: { title: string; data: any[]; onPress: (id: string) => void }) {
  if (!data.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <FlatList
        horizontal
        data={data}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <ChannelCard channel={item} onPress={() => onPress(item.id)} size="md" />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.md }}
      />
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { channels, trending, history, loading, selectedCategory, totalChannels, fetchChannels, fetchTrending, fetchHistory, setCategory, loadMoreChannels } = useChannelsStore();

  useEffect(() => {
    fetchChannels();
    fetchTrending();
    fetchHistory();
  }, []);

  const handleCategoryChange = useCallback((value: string) => {
    setCategory(value);
    fetchChannels(value === 'all' ? undefined : { category: value });
  }, []);

  const goToPlayer = (id: string) => router.push(`/player/${id}`);

  const featuredChannel = trending[0] || channels[0];
  const recentHistory = history.slice(0, 10).map(h => ({
    id: h.channel_id, name: h.channel_name, logo_url: h.channel_logo, is_live: true,
  }));

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <View style={styles.brandDot} />
            <Text style={styles.brandName}>FlickTV</Text>
          </View>
          <View style={styles.topActions}>
            <Pressable style={styles.aiChip} onPress={() => router.push('/ai')}>
              <Text style={styles.aiChipText}>✦ Flick AI</Text>
            </Pressable>
            <Pressable style={styles.avatarBtn} onPress={() => router.push('/(tabs)/profile')}>
              <Text style={styles.avatarText}>
                {user?.email?.[0]?.toUpperCase() || '◯'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── Hero ────────────────────────────────────────────────────── */}
        {featuredChannel && (
          <HeroChannel channel={featuredChannel} onPress={() => goToPlayer(featuredChannel.id)} />
        )}

        {/* ── Categories ──────────────────────────────────────────────── */}
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={i => i.value}
          renderItem={({ item }) => (
            <CategoryPill
              label={item.label}
              icon={item.icon}
              value={item.value}
              selected={selectedCategory === item.value}
              onPress={() => handleCategoryChange(item.value)}
            />
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pills}
          style={styles.pillsRow}
        />

        {/* ── Continue Watching ────────────────────────────────────────── */}
        {recentHistory.length > 0 && (
          <SectionRow title="Continue Watching" data={recentHistory} onPress={goToPlayer} />
        )}

        {/* ── Trending ─────────────────────────────────────────────────── */}
        <SectionRow title="Trending Now 🔥" data={trending} onPress={goToPlayer} />

        {/* ── All Channels ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {selectedCategory === 'all' ? 'All Channels' : CATEGORIES.find(c => c.value === selectedCategory)?.label}
            </Text>
            <Text style={styles.sectionCount}>{totalChannels.toLocaleString()} channels</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 20, marginLeft: theme.spacing.md }} />
          ) : channels.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📺</Text>
              <Text style={styles.emptyTitle}>No channels yet</Text>
              <Pressable style={styles.importBtn} onPress={() => router.push('/import')}>
                <Text style={styles.importBtnText}>+ Import Playlist</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <FlatList
                horizontal
                data={channels}
                keyExtractor={i => i.id}
                renderItem={({ item }) => (
                  <ChannelCard channel={item} onPress={() => goToPlayer(item.id)} />
                )}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: theme.spacing.md }}
              />
              {channels.length < totalChannels && (
                <Pressable style={styles.loadMoreBtn} onPress={loadMoreChannels}>
                  <Text style={styles.loadMoreText}>Load More ({channels.length} of {totalChannels.toLocaleString()})</Text>
                </Pressable>
              )}
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flex: 1 },

  // Top bar
  topBar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: 12 },
  brand:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.accent },
  brandName:   { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: '900', letterSpacing: -0.5 },
  topActions:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiChip: {
    backgroundColor: theme.colors.accent + '18',
    borderWidth: 1,
    borderColor: theme.colors.accent + '55',
    borderRadius: theme.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  aiChipText:  { color: theme.colors.accent, fontSize: theme.fontSize.xs, fontWeight: '700' },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: theme.colors.textSecondary, fontSize: theme.fontSize.sm, fontWeight: '700' },

  // Hero
  hero:     { marginHorizontal: theme.spacing.md, borderRadius: theme.radius.lg, overflow: 'hidden', height: 220, marginBottom: theme.spacing.md, position: 'relative' },
  heroBg:   { ...StyleSheet.absoluteFillObject },
  heroBgImg:{ width: '100%', height: '100%', opacity: 0.4 },
  heroDim:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,8,8,0.55)' },
  heroContent: { position: 'absolute', bottom: 56, left: 16, right: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  heroLogo: { width: 72, height: 72, borderRadius: 14, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  heroLogoFallback: { width: 72, height: 72, borderRadius: 14, backgroundColor: theme.colors.accentDim + '22', borderWidth: 1, borderColor: theme.colors.accent + '44', justifyContent: 'center', alignItems: 'center' },
  heroLogoText: { color: theme.colors.accent, fontSize: 28, fontWeight: '800' },
  heroMeta: { flex: 1 },
  heroLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  heroLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.live },
  heroLiveText: { color: theme.colors.live, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heroTitle:    { color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '800', lineHeight: 24 },
  heroCategory: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginTop: 3 },
  heroActions:  { position: 'absolute', bottom: 14, left: 16, right: 16 },
  playBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.full,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignSelf: 'flex-start',
  },
  playBtnText: { color: '#000', fontSize: theme.fontSize.sm, fontWeight: '800' },

  // Category pills
  pillsRow: { marginBottom: theme.spacing.sm },
  pills:    { paddingHorizontal: theme.spacing.md, paddingVertical: 4, gap: 0 },

  // Sections
  section:       { marginBottom: theme.spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, marginBottom: 12 },
  sectionTitle:  { color: theme.colors.text, fontSize: theme.fontSize.md, fontWeight: '800', paddingHorizontal: theme.spacing.md, marginBottom: 12 },
  sectionCount:  { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, fontWeight: '600' },

  // Empty state
  empty:        { alignItems: 'center', paddingVertical: 40, paddingHorizontal: theme.spacing.md },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyTitle:   { color: theme.colors.textSecondary, fontSize: theme.fontSize.md, marginBottom: 16 },
  importBtn: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.full, paddingHorizontal: 24, paddingVertical: 10 },
  importBtnText:{ color: '#000', fontWeight: '800', fontSize: theme.fontSize.sm },
  loadMoreBtn: { marginHorizontal: theme.spacing.md, marginTop: 12, paddingVertical: 12, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  loadMoreText: { color: theme.colors.accent, fontWeight: '700', fontSize: theme.fontSize.sm },
});
