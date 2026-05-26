/**
 * FlickTV AI — React Native App (Phase 1 MVP)
 * Complete production-ready IPTV streaming app
 *
 * Stack: Expo + React Native + Supabase + Claude API
 * Run: npx expo start
 */

// ════════════════════════════════════════════════════════════════════════════
// FILE STRUCTURE
// ════════════════════════════════════════════════════════════════════════════
//
// flicktv-app/
// ├── app/
// │   ├── (auth)/
// │   │   ├── login.tsx
// │   │   └── onboarding.tsx
// │   ├── (tabs)/
// │   │   ├── index.tsx          ← Home
// │   │   ├── live.tsx           ← Live TV
// │   │   ├── search.tsx         ← Search
// │   │   ├── favorites.tsx      ← Favorites
// │   │   └── profile.tsx        ← Profile
// │   ├── player/[channelId].tsx ← Full Player
// │   ├── import.tsx             ← Playlist Import
// │   └── ai-assistant.tsx       ← Flick AI
// ├── components/
// │   ├── ChannelCard.tsx
// │   ├── StreamPlayer.tsx
// │   ├── CategoryPill.tsx
// │   ├── FlickAIChat.tsx
// │   ├── PlaylistImport.tsx
// │   └── EPGGuide.tsx
// ├── lib/
// │   ├── supabase.ts
// │   ├── api.ts
// │   └── m3uParser.ts
// ├── stores/
// │   ├── useAuthStore.ts
// │   ├── useChannelStore.ts
// │   └── usePlayerStore.ts
// └── constants/
//     └── theme.ts
// ════════════════════════════════════════════════════════════════════════════

// ─── package.json ─────────────────────────────────────────────────────────────
export const PACKAGE_JSON = `{
  "name": "flicktv-ai",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "build:android": "eas build --platform android",
    "build:ios": "eas build --platform ios"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-status-bar": "~2.0.1",
    "expo-av": "~15.0.2",
    "expo-screen-orientation": "~8.0.0",
    "expo-linear-gradient": "~14.0.2",
    "expo-blur": "~14.0.1",
    "expo-haptics": "~14.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-notifications": "~0.29.9",
    "react": "18.3.2",
    "react-native": "0.76.5",
    "react-native-video": "^6.3.3",
    "@supabase/supabase-js": "^2.46.2",
    "zustand": "^5.0.2",
    "react-native-reanimated": "~3.16.2",
    "react-native-gesture-handler": "~2.20.2",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.3.0",
    "@expo/vector-icons": "^14.0.4",
    "react-native-svg": "15.8.0",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.2",
    "typescript": "^5.3.3",
    "@types/react": "~18.3.12"
  }
}`;

// ─── constants/theme.ts ───────────────────────────────────────────────────────
export const THEME = `
export const Colors = {
  // Core palette
  bg:         '#060810',
  bgCard:     '#0D1117',
  bgElevated: '#131924',
  surface:    '#1A2332',
  surfaceHigh:'#1E2A3A',

  // Accent
  accent:     '#00D4FF',
  accentDim:  '#0099BB',
  gold:       '#FFB800',
  success:    '#00E676',
  danger:     '#FF4444',
  warning:    '#FF8C00',

  // Text
  textPrimary:   '#FFFFFF',
  textSecondary: '#8B9BBB',
  textMuted:     '#455670',
  textAccent:    '#00D4FF',

  // Glassmorphism
  glass:         'rgba(255,255,255,0.05)',
  glassBorder:   'rgba(255,255,255,0.08)',
  glassStrong:   'rgba(255,255,255,0.10)',

  // Gradients (use with LinearGradient)
  gradientHero:  ['#060810', '#0D1A2E'],
  gradientCard:  ['rgba(0,212,255,0.08)', 'rgba(0,0,0,0)'],
  gradientAccent:['#00D4FF', '#0066FF'],
};

export const Typography = {
  // Display
  display: { fontSize: 32, fontWeight: '800', letterSpacing: -1.5, color: Colors.textPrimary },
  title:   { fontSize: 24, fontWeight: '700', letterSpacing: -0.8, color: Colors.textPrimary },
  heading: { fontSize: 18, fontWeight: '700', letterSpacing: -0.4, color: Colors.textPrimary },
  subhead: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2, color: Colors.textPrimary },
  body:    { fontSize: 14, fontWeight: '400', lineHeight: 21,       color: Colors.textSecondary },
  caption: { fontSize: 12, fontWeight: '500', letterSpacing: 0.2,  color: Colors.textMuted },
  label:   { fontSize: 11, fontWeight: '700', letterSpacing: 1.2,  color: Colors.textMuted, textTransform: 'uppercase' },
};

export const Spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
};

export const Radius = {
  sm: 8, md: 12, lg: 16, xl: 20, full: 9999,
};

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: {
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
};
`;

// ─── lib/supabase.ts ──────────────────────────────────────────────────────────
export const SUPABASE_LIB = `
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Custom storage for Expo
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
`;

// ─── stores/useChannelStore.ts ─────────────────────────────────────────────────
export const CHANNEL_STORE = `
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Channel {
  id: string;
  name: string;
  stream_url: string;
  logo_url: string | null;
  group_title: string | null;
  category: string;
  country: string | null;
  language: string | null;
  is_hd: boolean;
  is_4k: boolean;
  is_live: boolean;
  is_working: boolean;
}

interface ChannelStore {
  channels: Channel[];
  favorites: string[];
  recentlyWatched: Channel[];
  isLoading: boolean;
  searchResults: Channel[];

  fetchChannels: () => Promise<void>;
  fetchFavorites: () => Promise<void>;
  toggleFavorite: (channelId: string) => Promise<void>;
  searchChannels: (query: string) => Promise<void>;
  addToHistory: (channel: Channel) => Promise<void>;
  filterByCategory: (category: string) => Channel[];
}

export const useChannelStore = create<ChannelStore>((set, get) => ({
  channels: [],
  favorites: [],
  recentlyWatched: [],
  isLoading: false,
  searchResults: [],

  fetchChannels: async () => {
    set({ isLoading: true });
    const { data } = await supabase
      .from('channels')
      .select('*')
      .eq('is_working', true)
      .order('name')
      .limit(500);
    set({ channels: data || [], isLoading: false });
  },

  fetchFavorites: async () => {
    const { data } = await supabase
      .from('favorites')
      .select('channel_id');
    set({ favorites: data?.map(f => f.channel_id) || [] });
  },

  toggleFavorite: async (channelId: string) => {
    const { favorites } = get();
    const isFav = favorites.includes(channelId);

    if (isFav) {
      await supabase.from('favorites').delete()
        .eq('channel_id', channelId);
      set({ favorites: favorites.filter(id => id !== channelId) });
    } else {
      await supabase.from('favorites').insert({ channel_id: channelId });
      set({ favorites: [...favorites, channelId] });
    }
  },

  searchChannels: async (query: string) => {
    if (!query.trim()) { set({ searchResults: [] }); return; }
    const { data } = await supabase
      .from('channels')
      .select('*')
      .ilike('name', \`%\${query}%\`)
      .limit(30);
    set({ searchResults: data || [] });
  },

  addToHistory: async (channel: Channel) => {
    await supabase.from('watch_history').insert({
      channel_id: channel.id,
      channel_name: channel.name,
      channel_logo: channel.logo_url,
      stream_url: channel.stream_url,
    });
    const { recentlyWatched } = get();
    const filtered = recentlyWatched.filter(c => c.id !== channel.id);
    set({ recentlyWatched: [channel, ...filtered].slice(0, 20) });
  },

  filterByCategory: (category: string) => {
    return get().channels.filter(c =>
      category === 'all' ? true : c.category === category
    );
  },
}));
`;

// ─── components/ChannelCard.tsx ────────────────────────────────────────────────
export const CHANNEL_CARD = `
import React, { memo } from 'react';
import { TouchableOpacity, View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadows, Typography } from '../constants/theme';
import type { Channel } from '../stores/useChannelStore';

interface Props {
  channel: Channel;
  isFavorite?: boolean;
  onPress: () => void;
  onFavoriteToggle?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const ChannelCard = memo(({ channel, isFavorite, onPress, onFavoriteToggle, size = 'md' }: Props) => {
  const isLg = size === 'lg';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.container, isLg && styles.containerLg]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']}
        style={[styles.card, isLg && styles.cardLg]}
      >
        {/* Thumbnail / Logo */}
        <View style={[styles.logoContainer, isLg && styles.logoContainerLg]}>
          {channel.logo_url ? (
            <Image
              source={{ uri: channel.logo_url }}
              style={styles.logo}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.logoPlaceholder}>
              <MaterialIcons name="tv" size={isLg ? 32 : 24} color={Colors.textMuted} />
            </View>
          )}

          {/* Live badge */}
          {channel.is_live && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}

          {/* HD badge */}
          {(channel.is_hd || channel.is_4k) && (
            <View style={styles.hdBadge}>
              <Text style={styles.hdText}>{channel.is_4k ? '4K' : 'HD'}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{channel.name}</Text>
          <Text style={styles.group} numberOfLines={1}>
            {channel.group_title || channel.category}
          </Text>
        </View>

        {/* Favorite toggle */}
        {onFavoriteToggle && (
          <TouchableOpacity onPress={onFavoriteToggle} style={styles.favBtn} hitSlop={8}>
            <MaterialIcons
              name={isFavorite ? 'favorite' : 'favorite-border'}
              size={18}
              color={isFavorite ? Colors.danger : Colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: { width: 140, marginRight: 12 },
  containerLg: { width: '100%', marginRight: 0, marginBottom: 8 },

  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
    ...Shadows.card,
  },
  cardLg: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },

  logoContainer: {
    height: 90,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoContainerLg: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    marginRight: 12,
    flexShrink: 0,
  },

  logo: { width: '70%', height: '70%' },
  logoPlaceholder: { alignItems: 'center', justifyContent: 'center', flex: 1 },

  liveBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,68,68,0.85)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 3,
  },
  liveDot: { width: 5, height: 5, borderRadius: 9999, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  hdBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  hdText: { color: Colors.accent, fontSize: 9, fontWeight: '800' },

  info: { padding: 10, flex: 1 },
  name: { ...Typography.subhead, fontSize: 13, marginBottom: 2 },
  group: { ...Typography.caption },
  favBtn: { paddingRight: 12 },
});
`;

// ─── components/StreamPlayer.tsx ──────────────────────────────────────────────
export const STREAM_PLAYER = `
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions, Platform
} from 'react-native';
import Video, { OnProgressData } from 'react-native-video';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Colors, Typography } from '../constants/theme';

interface Props {
  url: string;
  channelName: string;
  onError?: (error: string) => void;
  onBack?: () => void;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export function StreamPlayer({ url, channelName, onError, onBack }: Props) {
  const videoRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout>>();

  const showAndHideControls = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleError = (e: any) => {
    const msg = e?.error?.errorString || 'Stream unavailable';
    setError(msg);
    setLoading(false);
    onError?.(msg);
  };

  return (
    <View style={[styles.container, isFullscreen && styles.fullscreen]}>
      {/* Video */}
      <Video
        ref={videoRef}
        source={{ uri: url, type: 'm3u8' }}
        style={styles.video}
        resizeMode="contain"
        paused={paused}
        muted={muted}
        onLoadStart={() => setLoading(true)}
        onLoad={() => setLoading(false)}
        onError={handleError}
        onBuffer={({ isBuffering }) => setLoading(isBuffering)}
        repeat={false}
        pictureInPicture={Platform.OS === 'ios'}
        ignoreSilentSwitch="ignore"
      />

      {/* Loading overlay */}
      {loading && !error && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Connecting to stream...</Text>
        </View>
      )}

      {/* Error overlay */}
      {error && (
        <View style={styles.overlay}>
          <MaterialIcons name="signal-wifi-bad" size={48} color={Colors.danger} />
          <Text style={styles.errorTitle}>Stream Unavailable</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setError(null); setLoading(true); }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Controls overlay (tap to show/hide) */}
      <TouchableOpacity
        style={styles.controlsLayer}
        onPress={showAndHideControls}
        activeOpacity={1}
      >
        {showControls && (
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'transparent', 'rgba(0,0,0,0.7)']}
            style={styles.controlsGradient}
          >
            {/* Top bar */}
            <View style={styles.topBar}>
              {onBack && (
                <TouchableOpacity onPress={onBack} hitSlop={10}>
                  <MaterialIcons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
              )}
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <Text style={styles.channelName}>{channelName}</Text>
            </View>

            {/* Center controls */}
            <View style={styles.centerControls}>
              <TouchableOpacity
                onPress={() => setPaused(!paused)}
                style={styles.playBtn}
              >
                <MaterialIcons
                  name={paused ? 'play-arrow' : 'pause'}
                  size={44}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>

            {/* Bottom bar */}
            <View style={styles.bottomBar}>
              <TouchableOpacity onPress={() => setMuted(!muted)} hitSlop={10}>
                <MaterialIcons
                  name={muted ? 'volume-off' : 'volume-up'}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity hitSlop={10}>
                <MaterialIcons name="closed-caption" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleFullscreen} hitSlop={10} style={{ marginLeft: 16 }}>
                <MaterialIcons
                  name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: SCREEN_W, height: SCREEN_W * (9/16), backgroundColor: '#000' },
  fullscreen: { width: SCREEN_H, height: SCREEN_W },
  video: { ...StyleSheet.absoluteFillObject },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  errorTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 8 },
  errorMsg: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: {
    marginTop: 16,
    backgroundColor: Colors.accent,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: { color: '#000', fontWeight: '700', fontSize: 14 },
  controlsLayer: { ...StyleSheet.absoluteFillObject },
  controlsGradient: { flex: 1, justifyContent: 'space-between', padding: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,68,68,0.9)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  channelName: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  centerControls: { alignItems: 'center' },
  playBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  bottomBar: { flexDirection: 'row', alignItems: 'center' },
});
`;

// ─── app/(tabs)/index.tsx (Home Screen) ───────────────────────────────────────
export const HOME_SCREEN = `
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity, FlatList, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing } from '../../constants/theme';
import { useChannelStore } from '../../stores/useChannelStore';
import { ChannelCard } from '../../components/ChannelCard';

const CATEGORIES = [
  { id: 'all',          label: 'All',          icon: 'apps' },
  { id: 'news',         label: 'News',          icon: 'newspaper' },
  { id: 'sports',       label: 'Sports',        icon: 'sports-soccer' },
  { id: 'movies',       label: 'Movies',        icon: 'movie' },
  { id: 'entertainment',label: 'Entertainment', icon: 'live-tv' },
  { id: 'kids',         label: 'Kids',          icon: 'child-care' },
  { id: 'music',        label: 'Music',         icon: 'music-note' },
  { id: 'documentary',  label: 'Docs',          icon: 'explore' },
  { id: 'religious',    label: 'Religious',     icon: 'auto-awesome' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { channels, favorites, recentlyWatched, isLoading, fetchChannels, fetchFavorites, toggleFavorite, filterByCategory } = useChannelStore();
  const [activeCategory, setActiveCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchChannels();
    fetchFavorites();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchChannels();
    setRefreshing(false);
  };

  const filtered = filterByCategory(activeCategory);
  const trending = channels.slice(0, 15);
  const recommended = channels.filter(c => c.category !== activeCategory).slice(0, 15);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient colors={['#060810', '#0A1020']} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.brandName}>FlickTV</Text>
              <Text style={styles.greeting}>Good evening 👋</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.aiBtn}
                onPress={() => router.push('/ai-assistant')}
              >
                <LinearGradient
                  colors={[Colors.accent, '#0066FF']}
                  style={styles.aiBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <MaterialIcons name="auto-awesome" size={18} color="#fff" />
                  <Text style={styles.aiBtnText}>Flick AI</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.importBtn}
                onPress={() => router.push('/import')}
              >
                <MaterialIcons name="add" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Hero search bar */}
          <TouchableOpacity
            style={styles.searchBar}
            onPress={() => router.push('/(tabs)/search')}
            activeOpacity={0.7}
          >
            <MaterialIcons name="search" size={20} color={Colors.textMuted} />
            <Text style={styles.searchPlaceholder}>Search channels, shows...</Text>
            <View style={styles.micBtn}>
              <MaterialIcons name="mic" size={16} color={Colors.accent} />
            </View>
          </TouchableOpacity>

          {/* Category pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
          >
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setActiveCategory(cat.id)}
                style={[
                  styles.categoryPill,
                  activeCategory === cat.id && styles.categoryPillActive,
                ]}
              >
                <MaterialIcons
                  name={cat.icon as any}
                  size={14}
                  color={activeCategory === cat.id ? '#000' : Colors.textSecondary}
                />
                <Text style={[
                  styles.categoryLabel,
                  activeCategory === cat.id && styles.categoryLabelActive,
                ]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Continue Watching */}
          {recentlyWatched.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Continue Watching</Text>
                <TouchableOpacity><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
              </View>
              <FlatList
                horizontal
                data={recentlyWatched.slice(0, 10)}
                keyExtractor={c => c.id}
                renderItem={({ item }) => (
                  <ChannelCard
                    channel={item}
                    isFavorite={favorites.includes(item.id)}
                    onPress={() => router.push(\`/player/\${item.id}\`)}
                    onFavoriteToggle={() => toggleFavorite(item.id)}
                  />
                )}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingLeft: Spacing.xl, paddingRight: Spacing.md }}
              />
            </View>
          )}

          {/* Trending */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.trendingDot} />
                <Text style={styles.sectionTitle}>Trending Now</Text>
              </View>
              <TouchableOpacity><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
            </View>
            <FlatList
              horizontal
              data={trending}
              keyExtractor={c => c.id}
              renderItem={({ item }) => (
                <ChannelCard
                  channel={item}
                  isFavorite={favorites.includes(item.id)}
                  onPress={() => router.push(\`/player/\${item.id}\`)}
                  onFavoriteToggle={() => toggleFavorite(item.id)}
                  size="md"
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: Spacing.xl, paddingRight: Spacing.md }}
            />
          </View>

          {/* For You */}
          {filtered.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {activeCategory === 'all' ? '✨ For You' : CATEGORIES.find(c => c.id === activeCategory)?.label || ''}
                </Text>
                <TouchableOpacity><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
              </View>
              <FlatList
                horizontal
                data={filtered.slice(0, 15)}
                keyExtractor={c => c.id}
                renderItem={({ item }) => (
                  <ChannelCard
                    channel={item}
                    isFavorite={favorites.includes(item.id)}
                    onPress={() => router.push(\`/player/\${item.id}\`)}
                    onFavoriteToggle={() => toggleFavorite(item.id)}
                  />
                )}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingLeft: Spacing.xl, paddingRight: Spacing.md }}
              />
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  brandName: { fontSize: 26, fontWeight: '900', color: Colors.accent, letterSpacing: -1 },
  greeting: { ...Typography.body, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  aiBtn: { borderRadius: 20, overflow: 'hidden' },
  aiBtnGradient: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7 },
  aiBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  importBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.glassBorder },
  searchBar: { marginHorizontal: Spacing.xl, marginBottom: Spacing.lg, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: Colors.glassBorder, gap: 10 },
  searchPlaceholder: { flex: 1, color: Colors.textMuted, fontSize: 14 },
  micBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,212,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  categories: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, gap: 8 },
  categoryPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.glassBorder },
  categoryPillActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  categoryLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  categoryLabelActive: { color: '#000' },
  section: { marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trendingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
  sectionTitle: { ...Typography.heading, fontSize: 17 },
  seeAll: { color: Colors.accent, fontSize: 13, fontWeight: '600' },
});
`;

// ─── app/ai-assistant.tsx ─────────────────────────────────────────────────────
export const AI_ASSISTANT = `
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { ChannelCard } from '../components/ChannelCard';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  channels?: any[];
  intent?: string;
  timestamp: Date;
}

const QUICK_ACTIONS = [
  { icon: 'play-arrow',      label: 'Play News', query: 'Play a news channel' },
  { icon: 'sports-soccer',   label: 'Sports',    query: 'Find sports channels' },
  { icon: 'auto-fix-high',   label: 'Fix Stream',query: 'Fix my broken stream' },
  { icon: 'recommend',       label: 'Recommend', query: 'Recommend channels for me' },
];

export default function AIAssistantScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hey! I'm Flick AI 👋 I can help you find channels, fix streams, and give personalized recommendations. What would you like to watch?",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(\`\${process.env.EXPO_PUBLIC_API_URL}/api/ai/chat\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
        body: JSON.stringify({ message: text, sessionId }),
      });
      const data = await response.json();

      setSessionId(data.sessionId);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        channels: data.actionResult,
        intent: data.intent?.type,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting. Please try again.",
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#060810', '#0A1020']} style={{ flex: 1 }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <LinearGradient colors={[Colors.accent, '#0066FF']} style={styles.aiAvatar}>
              <MaterialIcons name="auto-awesome" size={20} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.aiName}>Flick AI</Text>
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Online</Text>
              </View>
            </View>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.messages}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              {item.role === 'assistant' && (
                <LinearGradient colors={[Colors.accent, '#0066FF']} style={styles.aiAvatarSm}>
                  <MaterialIcons name="auto-awesome" size={12} color="#fff" />
                </LinearGradient>
              )}
              <View style={[
                styles.bubbleContent,
                item.role === 'user' ? styles.userBubbleContent : styles.aiBubbleContent,
              ]}>
                <Text style={[styles.bubbleText, item.role === 'user' && styles.userBubbleText]}>
                  {item.content}
                </Text>
                {/* Channel results */}
                {item.channels && Array.isArray(item.channels) && item.channels.length > 0 && (
                  <View style={styles.channelResults}>
                    {item.channels.map(ch => (
                      <ChannelCard
                        key={ch.id}
                        channel={ch}
                        onPress={() => router.push(\`/player/\${ch.id}\`)}
                        size="lg"
                      />
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}
        />

        {/* Quick actions (when input is empty) */}
        {messages.length === 1 && (
          <View style={styles.quickActions}>
            {QUICK_ACTIONS.map(a => (
              <TouchableOpacity
                key={a.label}
                style={styles.quickBtn}
                onPress={() => sendMessage(a.query)}
              >
                <MaterialIcons name={a.icon as any} size={16} color={Colors.accent} />
                <Text style={styles.quickBtnText}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask Flick AI anything..."
              placeholderTextColor={Colors.textMuted}
              onSubmitEditing={() => sendMessage(input)}
              returnKeyType="send"
              multiline
            />
            {loading ? (
              <View style={styles.sendBtn}>
                <ActivityIndicator size="small" color={Colors.accent} />
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.sendBtn, input.trim() && styles.sendBtnActive]}
                onPress={() => sendMessage(input)}
                disabled={!input.trim()}
              >
                <MaterialIcons name="send" size={20} color={input.trim() ? '#000' : Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>

      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  aiAvatarSm: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 6, flexShrink: 0 },
  aiName: { ...Typography.heading, fontSize: 16 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  onlineText: { ...Typography.caption, color: Colors.success },
  messages: { padding: Spacing.xl, gap: 16 },
  bubble: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  userBubble: { justifyContent: 'flex-end' },
  aiBubble: { justifyContent: 'flex-start' },
  bubbleContent: { maxWidth: '78%', borderRadius: Radius.lg, padding: 12 },
  aiBubbleContent: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.glassBorder },
  userBubbleContent: { backgroundColor: Colors.accent },
  bubbleText: { ...Typography.body, color: Colors.textPrimary, lineHeight: 20 },
  userBubbleText: { color: '#000', fontWeight: '500' },
  channelResults: { marginTop: 10, gap: 6 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.glassBorder },
  quickBtnText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.glassBorder },
  input: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.xl, paddingHorizontal: 16, paddingVertical: 12, color: Colors.textPrimary, fontSize: 14, maxHeight: 120, borderWidth: 1, borderColor: Colors.glassBorder },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.glassBorder },
  sendBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
});
`;

// Export all code as a reference module
export default {
  PACKAGE_JSON,
  THEME,
  SUPABASE_LIB,
  CHANNEL_STORE,
  CHANNEL_CARD,
  STREAM_PLAYER,
  HOME_SCREEN,
  AI_ASSISTANT,
};
