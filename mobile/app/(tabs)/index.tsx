import { useEffect, useCallback, useState, useMemo } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryPill } from '../../components/CategoryPill';
import { ChannelCard } from '../../components/ChannelCard';
import { theme } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { useChannelsStore } from '../../stores/channelsStore';
import { api } from '../../lib/api';

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

const PAGE_SIZE = 200;

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
          <View style={{ width: 150, marginRight: 8 }}>
            <ChannelCard channel={item} onPress={() => onPress(item.id)} />
          </View>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.md }}
      />
    </View>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  totalChannels,
  displayedCount,
  onPageChange,
  loading,
}: {
  currentPage: number;
  totalPages: number;
  totalChannels: number;
  displayedCount: number;
  onPageChange: (page: number) => void;
  loading: boolean;
}) {
  // Generate page numbers to show
  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) return [1, 2, 3, 4, 5];
    if (currentPage >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
  }, [currentPage, totalPages]);

  return (
    <View style={styles.pagination}>
      <View style={styles.paginationInfo}>
        <Text style={styles.paginationText}>
          Showing {displayedCount.toLocaleString()} of {totalChannels.toLocaleString()} channels
        </Text>
        <Text style={styles.paginationPage}>Page {currentPage} of {totalPages}</Text>
      </View>
      <View style={styles.paginationButtons}>
        <Pressable
          style={[styles.pageBtn, (currentPage <= 1 || loading) && styles.pageBtnDisabled]}
          onPress={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || loading}
        >
          <Text style={[styles.pageBtnText, (currentPage <= 1 || loading) && styles.pageBtnTextDisabled]}>◀ Prev</Text>
        </Pressable>

        <View style={styles.pageNumbers}>
          {pageNumbers.map(pageNum => (
            <Pressable
              key={pageNum}
              style={[styles.pageNumBtn, currentPage === pageNum && styles.pageNumBtnActive]}
              onPress={() => onPageChange(pageNum)}
              disabled={loading}
            >
              <Text style={[styles.pageNumText, currentPage === pageNum && styles.pageNumTextActive]}>
                {pageNum}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.pageBtn, (currentPage >= totalPages || loading) && styles.pageBtnDisabled]}
          onPress={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || loading}
        >
          <Text style={[styles.pageBtnText, (currentPage >= totalPages || loading) && styles.pageBtnTextDisabled]}>Next ▶</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    channels, trending, history, loading, selectedCategory,
    totalChannels, currentPage, hasMore, categoryTotals,
    fetchChannels, fetchTrending, fetchHistory, setCategory,
  } = useChannelsStore();

  const [inlineSearch, setInlineSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchChannels();
    fetchTrending();
    fetchHistory();
  }, []);

  // Handle page change with direct API call
  const handlePageChange = useCallback(async (page: number) => {
    const store = useChannelsStore.getState();
    const maxPage = Math.ceil(store.totalChannels / PAGE_SIZE);
    if (page < 1 || page > maxPage) return;

    useChannelsStore.setState({ loading: true });
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (store.selectedCategory !== 'all') params.category = store.selectedCategory;
      const res = await api.channels.list(params);
      const newChannels = res.channels || [];
      const total = res.total || 0;
      useChannelsStore.setState({
        channels: newChannels,
        currentPage: page,
        totalChannels: total,
        hasMore: page < Math.ceil(total / PAGE_SIZE),
      });
    } catch (e) {
      console.error('page change', e);
    } finally {
      useChannelsStore.setState({ loading: false });
    }
  }, []);

  const handleCategoryChange = useCallback((value: string) => {
    setInlineSearch('');
    setIsSearching(false);
    setCategory(value);
    fetchChannels(value === 'all' ? undefined : { category: value });
  }, [setCategory, fetchChannels]);

  const goToPlayer = (id: string) => router.push(`/player/${id}`);

  const featuredChannel = trending[0] || channels[0];
  const recentHistory = history.slice(0, 10).map(h => ({
    id: h.channel_id, name: h.channel_name, logo_url: h.channel_logo, is_live: true,
  }));

  // Compute total pages
  const totalPages = Math.max(1, Math.ceil(totalChannels / PAGE_SIZE));
  const categoryTotal = selectedCategory !== 'all'
    ? (categoryTotals[selectedCategory] || totalChannels)
    : totalChannels;

  // Inline search: filter locally across loaded channels, or search server if query is substantial
  const displayChannels = useMemo(() => {
    if (!inlineSearch.trim()) return channels;
    const q = inlineSearch.toLowerCase();
    return channels.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.category?.toLowerCase().includes(q) ||
      c.country?.toLowerCase().includes(q) ||
      c.group_title?.toLowerCase().includes(q)
    );
  }, [channels, inlineSearch]);

  // Server-side search when user submits
  const handleInlineSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setIsSearching(false);
      fetchChannels();
      return;
    }
    setIsSearching(true);
    useChannelsStore.setState({ loading: true });
    try {
      const params: Record<string, string> = { search: query.trim(), limit: '200' };
      if (selectedCategory !== 'all') params.category = selectedCategory;
      const res = await api.channels.list(params);
      useChannelsStore.setState({
        channels: res.channels || [],
        totalChannels: res.total || 0,
        currentPage: 1,
        hasMore: false,
      });
    } catch (e) {
      console.error('inline search', e);
    } finally {
      useChannelsStore.setState({ loading: false });
    }
  }, [selectedCategory, fetchChannels]);

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

        {/* ── Inline Search ───────────────────────────────────────────── */}
        <View style={styles.inlineSearchBar}>
          <Text style={styles.inlineSearchIcon}>⌕</Text>
          <TextInput
            style={styles.inlineSearchInput}
            placeholder="Search channels, countries, categories..."
            placeholderTextColor={theme.colors.textMuted}
            value={inlineSearch}
            onChangeText={setInlineSearch}
            onSubmitEditing={() => handleInlineSearch(inlineSearch)}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {inlineSearch.length > 0 && (
            <Pressable
              onPress={() => { setInlineSearch(''); setIsSearching(false); fetchChannels(); }}
              style={styles.inlineSearchClear}
            >
              <Text style={styles.inlineSearchClearText}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* ── Hero ────────────────────────────────────────────────────── */}
        {!inlineSearch && !isSearching && featuredChannel && (
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
              count={item.value === 'all' ? categoryTotals['all'] : categoryTotals[item.value]}
            />
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pills}
          style={styles.pillsRow}
        />

        {/* ── Continue Watching ────────────────────────────────────────── */}
        {!inlineSearch && !isSearching && recentHistory.length > 0 && (
          <SectionRow title="Continue Watching" data={recentHistory} onPress={goToPlayer} />
        )}

        {/* ── Trending ─────────────────────────────────────────────────── */}
        {!inlineSearch && !isSearching && <SectionRow title="Trending Now 🔥" data={trending} onPress={goToPlayer} />}

        {/* ── All Channels / Search Results ────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {isSearching && inlineSearch.trim()
                ? `Search: "${inlineSearch.trim()}"`
                : selectedCategory === 'all'
                  ? 'All Channels'
                  : CATEGORIES.find(c => c.value === selectedCategory)?.label
              }
            </Text>
            <Text style={styles.sectionCount}>
              {(isSearching && inlineSearch.trim()
                ? totalChannels
                : inlineSearch.trim()
                  ? displayChannels.length
                  : categoryTotal
              ).toLocaleString()} channels
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 20, marginLeft: theme.spacing.md }} />
          ) : displayChannels.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>{inlineSearch.trim() ? '🔍' : '📺'}</Text>
              <Text style={styles.emptyTitle}>
                {inlineSearch.trim() ? `No results for "${inlineSearch.trim()}"` : 'No channels yet'}
              </Text>
              {!inlineSearch.trim() && (
                <Pressable style={styles.importBtn} onPress={() => router.push('/import')}>
                  <Text style={styles.importBtnText}>+ Import Playlist</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <>
              <FlatList
                data={displayChannels}
                keyExtractor={i => i.id}
                numColumns={4}
                renderItem={({ item }) => (
                  <ChannelCard channel={item} onPress={() => goToPlayer(item.id)} />
                )}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
                contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: 8 }}
                columnWrapperStyle={{ gap: 8 }}
              />

              {/* Pagination Controls */}
              {!inlineSearch.trim() && !isSearching && categoryTotal > PAGE_SIZE && (
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalChannels={categoryTotal}
                  displayedCount={channels.length}
                  onPageChange={handlePageChange}
                  loading={loading}
                />
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

  // Inline search
  inlineSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    height: 42,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: 8,
  },
  inlineSearchIcon: { color: theme.colors.textMuted, fontSize: 16 },
  inlineSearchInput: { flex: 1, color: theme.colors.text, fontSize: theme.fontSize.sm },
  inlineSearchClear: { padding: 4 },
  inlineSearchClearText: { color: theme.colors.textMuted, fontSize: 14 },

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

  // Pagination
  pagination: {
    marginTop: 16,
    marginHorizontal: theme.spacing.md,
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  paginationInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  paginationText: { color: theme.colors.textSecondary, fontSize: theme.fontSize.xs, fontWeight: '600' },
  paginationPage: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  paginationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pageBtnDisabled: { opacity: 0.35 },
  pageBtnText: { color: theme.colors.accent, fontSize: theme.fontSize.sm, fontWeight: '700' },
  pageBtnTextDisabled: { color: theme.colors.textMuted },
  pageNumbers: { flexDirection: 'row', gap: 4 },
  pageNumBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageNumBtnActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  pageNumText: { color: theme.colors.textSecondary, fontSize: theme.fontSize.xs, fontWeight: '700' },
  pageNumTextActive: { color: '#000' },

  // Empty state
  empty:        { alignItems: 'center', paddingVertical: 40, paddingHorizontal: theme.spacing.md },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyTitle:   { color: theme.colors.textSecondary, fontSize: theme.fontSize.md, marginBottom: 16 },
  importBtn: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.full, paddingHorizontal: 24, paddingVertical: 10 },
  importBtnText:{ color: '#000', fontWeight: '800', fontSize: theme.fontSize.sm },
});
