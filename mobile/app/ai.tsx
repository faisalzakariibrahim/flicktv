import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { api } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  searchResults?: SearchResult[];
}

interface SearchResult {
  id: string;
  name: string;
  logo_url: string | null;
  category: string | null;
  country: string | null;
  is_hd: boolean;
  is_live: boolean;
  stream_url: string;
}

interface Recommendation {
  id: string;
  channel_id: string;
  score: number;
  reason: string;
  channels: {
    id: string;
    name: string;
    logo_url: string | null;
    category: string | null;
  };
}

interface SearchFilters {
  category: string | null;
  country: string | null;
  language: string | null;
  is_hd: boolean | null;
  is_live: boolean | null;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = 'chat' | 'search' | 'recommendations';

// ─── Component ────────────────────────────────────────────────────────────────
export default function AIScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('chat');
  const [chatInput, setChatInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content:
        "Hi! I'm Flick AI. I can help you find channels, fix streams, or recommend something to watch. What are you looking for?",
    },
  ]);
  const [chatSessionId, setChatSessionId] = useState<string | undefined>();
  const [chatLoading, setChatLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchFilters, setSearchFilters] = useState<SearchFilters | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const chatListRef = useRef<FlatList>(null);
  const searchListRef = useRef<FlatList>(null);

  // Load recommendations when tab switches to recommendations
  const loadRecommendations = useCallback(async () => {
    setRecsLoading(true);
    try {
      const res = await api.ai.recommendations();
      setRecs(res.recommendations || []);
    } catch {
      // silent
    } finally {
      setRecsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'recommendations') {
      loadRecommendations();
    }
  }, [tab, loadRecommendations]);

  // ─── Chat ─────────────────────────────────────────────────────────────────
  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };
    setMessages((m) => [...m, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await api.ai.chat(text, chatSessionId);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.message,
        searchResults: res.actionResult,
      };
      setMessages((m) => [...m, aiMsg]);
      if (res.sessionId) setChatSessionId(res.sessionId);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Sorry, I had trouble responding. Please try again.',
        },
      ]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const QUICK = [
    'Find sports channels',
    'Recommend something for me',
    'Show news channels',
    'Fix broken stream',
  ];

  // ─── Search ──────────────────────────────────────────────────────────────
  const runSearch = async () => {
    const q = searchInput.trim();
    if (!q || searchLoading) return;

    setSearchLoading(true);
    setSearchQuery(q);
    try {
      const res = await api.ai.search(q);
      setSearchResults(res.results || []);
      setSearchFilters(res.filters || null);
    } catch {
      setSearchResults([]);
      setSearchFilters(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const SEARCH_EXAMPLES = [
    'Show me soccer channels in Spanish',
    'Find news from Africa',
    'Movie channels that are HD',
    'Kids cartoons',
    'BBC channels',
  ];

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.close}>X</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Flick AI</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {(['chat', 'search', 'recommendations'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === t && styles.tabTextActive,
                ]}
              >
                {t === 'chat'
                  ? 'Chat'
                  : t === 'search'
                  ? 'Smart Search'
                  : 'For You'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Content */}
        {tab === 'chat' && (
          <ChatView
            messages={messages}
            loading={chatLoading}
            input={chatInput}
            setInput={setChatInput}
            onSend={sendChat}
            listRef={chatListRef}
            quickSuggestions={QUICK}
          />
        )}

        {tab === 'search' && (
          <SearchView
            input={searchInput}
            setInput={setSearchInput}
            onSearch={runSearch}
            loading={searchLoading}
            results={searchResults}
            filters={searchFilters}
            query={searchQuery}
            examples={SEARCH_EXAMPLES}
            listRef={searchListRef}
          />
        )}

        {tab === 'recommendations' && (
          <RecommendationsView
            recommendations={recs}
            loading={recsLoading}
            onRefresh={loadRecommendations}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Chat Sub-view ────────────────────────────────────────────────────────────
function ChatView({
  messages,
  loading,
  input,
  setInput,
  onSend,
  listRef,
  quickSuggestions,
}: {
  messages: Message[];
  loading: boolean;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  listRef: React.RefObject<FlatList>;
  quickSuggestions: string[];
}) {
  return (
    <>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === 'user' ? styles.userBubble : styles.aiBubble,
            ]}
          >
            {item.role === 'assistant' && (
              <Text style={styles.aiLabel}>Flick AI</Text>
            )}
            <Text
              style={[
                styles.bubbleText,
                item.role === 'user' && styles.userText,
              ]}
            >
              {item.content}
            </Text>
            {/* Show search results inline if actionResult has channels */}
            {item.searchResults && item.searchResults.length > 0 && (
              <View style={styles.inlineResults}>
                <Text style={styles.inlineResultsTitle}>
                  Found {item.searchResults.length} channel
                  {item.searchResults.length !== 1 ? 's' : ''}:
                </Text>
                {item.searchResults.map((ch: any) => (
                  <View key={ch.id} style={styles.inlineChannel}>
                    <Text style={styles.inlineChannelName}>{ch.name}</Text>
                    {ch.category && (
                      <Text style={styles.inlineChannelCat}>{ch.category}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        ListFooterComponent={
          loading ? (
            <ActivityIndicator
              color={theme.colors.accent}
              style={{ marginVertical: 8 }}
            />
          ) : null
        }
      />

      {messages.length <= 1 && (
        <FlatList
          horizontal
          data={quickSuggestions}
          keyExtractor={(i) => i}
          contentContainerStyle={styles.quickRow}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={styles.quickChip}
              onPress={() => setInput(item)}
            >
              <Text style={styles.quickText}>{item}</Text>
            </Pressable>
          )}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ask Flick AI anything..."
          placeholderTextColor={theme.colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          onSubmitEditing={onSend}
          returnKeyType="send"
        />
        <Pressable
          style={[
            styles.sendBtn,
            (!input.trim() || loading) && styles.sendBtnDisabled,
          ]}
          onPress={onSend}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendIcon}>UP</Text>
        </Pressable>
      </View>
    </>
  );
}

// ─── Search Sub-view ──────────────────────────────────────────────────────────
function SearchView({
  input,
  setInput,
  onSearch,
  loading,
  results,
  filters,
  query,
  examples,
  listRef,
}: {
  input: string;
  setInput: (v: string) => void;
  onSearch: () => void;
  loading: boolean;
  results: SearchResult[];
  filters: SearchFilters | null;
  query: string;
  examples: string[];
  listRef: React.RefObject<FlatList>;
}) {
  return (
    <View style={{ flex: 1 }}>
      {/* Search input */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder='Try "soccer channels in Spanish" or "HD movie channels"'
          placeholderTextColor={theme.colors.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
        <Pressable
          style={[
            styles.searchBtn,
            (!input.trim() || loading) && styles.searchBtnDisabled,
          ]}
          onPress={onSearch}
          disabled={!input.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.searchBtnText}>Search</Text>
          )}
        </Pressable>
      </View>

      {/* Filters badge row */}
      {filters && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filters.category && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                Category: {filters.category}
              </Text>
            </View>
          )}
          {filters.country && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                Country: {filters.country}
              </Text>
            </View>
          )}
          {filters.language && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                Language: {filters.language}
              </Text>
            </View>
          )}
          {filters.is_hd === true && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>HD Only</Text>
            </View>
          )}
          {filters.is_live === true && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>Live Only</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Results or examples */}
      {results.length > 0 ? (
        <>
          <Text style={styles.resultCount}>
            {results.length} result{results.length !== 1 ? 's' : ''} for "
            {query}"
          </Text>
          <FlatList
            ref={listRef}
            data={results}
            keyExtractor={(r) => r.id}
            contentContainerStyle={styles.resultList}
            renderItem={({ item }) => (
              <View style={styles.resultCard}>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <View style={styles.resultMeta}>
                    {item.category && (
                      <Text style={styles.resultCat}>{item.category}</Text>
                    )}
                    {item.country && (
                      <Text style={styles.resultCountry}>{item.country}</Text>
                    )}
                    {item.is_hd && (
                      <View style={styles.hdBadge}>
                        <Text style={styles.hdBadgeText}>HD</Text>
                      </View>
                    )}
                    {item.is_live && (
                      <View style={styles.liveBadge}>
                        <Text style={styles.liveBadgeText}>LIVE</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}
          />
        </>
      ) : !loading && query ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No channels found for "{query}"</Text>
          <Text style={styles.emptySubtext}>Try a different search</Text>
        </View>
      ) : (
        <View style={styles.examplesContainer}>
          <Text style={styles.examplesTitle}>Try these searches:</Text>
          {examples.map((ex) => (
            <Pressable
              key={ex}
              style={styles.exampleChip}
              onPress={() => {
                setInput(ex);
              }}
            >
              <Text style={styles.exampleText}>{ex}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Recommendations Sub-view ─────────────────────────────────────────────────
function RecommendationsView({
  recommendations,
  loading,
  onRefresh,
}: {
  recommendations: Recommendation[];
  loading: boolean;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={styles.loadingText}>
          Analyzing your watch history...
        </Text>
      </View>
    );
  }

  if (recommendations.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No recommendations yet</Text>
        <Text style={styles.emptySubtext}>
          Watch some channels and come back — Flick AI will learn your taste!
        </Text>
        <Pressable style={styles.refreshBtn} onPress={onRefresh}>
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.recsHeader}>
        <Text style={styles.recsTitle}>Recommended for You</Text>
        <Pressable onPress={onRefresh}>
          <Text style={styles.refreshLink}>Refresh</Text>
        </Pressable>
      </View>
      <FlatList
        data={recommendations}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.recsList}
        renderItem={({ item }) => (
          <View style={styles.recCard}>
            <View style={styles.recInfo}>
              <Text style={styles.recName}>
                {item.channels?.name || 'Unknown'}
              </Text>
              {item.channels?.category && (
                <Text style={styles.recCat}>{item.channels.category}</Text>
              )}
              {item.reason && (
                <Text style={styles.recReason}>{item.reason}</Text>
              )}
              <View style={styles.recScore}>
                <View
                  style={[
                    styles.recScoreBar,
                    { width: `${Math.round(item.score * 100)}%` },
                  ]}
                />
                <Text style={styles.recScoreText}>
                  {Math.round(item.score * 100)}% match
                </Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  close: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.lg,
    width: 32,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: theme.colors.accent,
  },
  tabText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  tabTextActive: {
    color: theme.colors.accent,
  },

  // Chat
  messages: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  aiBubble: {
    backgroundColor: theme.colors.surface,
    alignSelf: 'flex-start',
  },
  userBubble: {
    backgroundColor: theme.colors.accent,
    alignSelf: 'flex-end',
  },
  aiLabel: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    marginBottom: 4,
  },
  bubbleText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    lineHeight: 22,
  },
  userText: { color: '#000' },
  quickRow: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  quickChip: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    maxHeight: 120,
    marginRight: theme.spacing.sm,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: {
    color: '#000',
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },

  // Inline search results in chat
  inlineResults: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  inlineResultsTitle: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    marginBottom: 4,
  },
  inlineChannel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  inlineChannelName: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    flex: 1,
  },
  inlineChannelCat: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    textTransform: 'uppercase',
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginRight: theme.spacing.sm,
  },
  searchBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 72,
  },
  searchBtnDisabled: { opacity: 0.4 },
  searchBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
  filterRow: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  filterChip: {
    backgroundColor: theme.colors.accentSubtle,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    marginRight: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.accentGlow,
  },
  filterChipText: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  resultCount: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  resultList: {
    paddingHorizontal: theme.spacing.md,
  },
  resultCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  resultInfo: { flex: 1 },
  resultName: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 6,
  },
  resultCat: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    textTransform: 'uppercase',
  },
  resultCountry: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
  },
  hdBadge: {
    backgroundColor: theme.colors.hd,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  hdBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  liveBadge: {
    backgroundColor: theme.colors.live,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },

  // Examples
  examplesContainer: {
    padding: theme.spacing.md,
  },
  examplesTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginBottom: theme.spacing.md,
  },
  exampleChip: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  exampleText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
  },

  // Recommendations
  recsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  recsTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  refreshLink: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  recsList: {
    paddingHorizontal: theme.spacing.md,
  },
  recCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  recInfo: { flex: 1 },
  recName: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  recCat: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  recReason: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginTop: 4,
    fontStyle: 'italic',
  },
  recScore: {
    marginTop: 8,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  recScoreBar: {
    height: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: 2,
  },
  recScoreText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    marginTop: 2,
  },

  // Shared
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
  },
  emptySubtext: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  refreshBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  refreshBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: theme.fontSize.md,
  },
});
