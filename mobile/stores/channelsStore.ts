import { create } from 'zustand';
import { api } from '../lib/api';

const PAGE_SIZE = 200;

interface Channel {
  id: string;
  name: string;
  stream_url: string;
  logo_url?: string;
  category?: string;
  group_title?: string;
  country?: string;
  is_hd?: boolean;
  is_4k?: boolean;
  is_live?: boolean;
  is_working?: boolean;
}

interface ChannelsStore {
  channels: Channel[];
  trending: Channel[];
  favorites: Channel[];
  history: any[];
  playlists: any[];
  loading: boolean;
  selectedCategory: string;
  totalChannels: number;
  currentPage: number;
  hasMore: boolean;
  searchQuery: string;
  categoryTotals: Record<string, number>;
  fetchChannels: (params?: Record<string, string>) => Promise<void>;
  loadMoreChannels: () => Promise<void>;
  fetchTrending: () => Promise<void>;
  fetchFavorites: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  fetchPlaylists: () => Promise<void>;
  fetchCategoryTotals: () => Promise<void>;
  toggleFavorite: (channelId: string) => Promise<boolean>;
  setCategory: (cat: string) => void;
  searchChannels: (query: string) => Promise<Channel[]>;
  goToPage: (page: number) => Promise<void>;
}

export const useChannelsStore = create<ChannelsStore>((set, get) => ({
  channels: [],
  trending: [],
  favorites: [],
  history: [],
  playlists: [],
  loading: false,
  selectedCategory: 'all',
  totalChannels: 0,
  currentPage: 1,
  hasMore: false,
  searchQuery: '',
  categoryTotals: {},

  fetchChannels: async (params) => {
    set({ loading: true });
    try {
      const cat = get().selectedCategory;
      const query = cat !== 'all' ? { ...params, category: cat } : (params || {});
      const res = await api.channels.list(query);
      const channels = res.channels || [];
      const total = res.total || 0;
      // Track per-category totals
      const totals = { ...get().categoryTotals };
      if (cat !== 'all') {
        totals[cat] = total;
      } else {
        totals['all'] = total;
      }
      set({
        channels,
        totalChannels: total,
        currentPage: 1,
        hasMore: channels.length < total && channels.length > 0,
        categoryTotals: totals,
      });
    } catch (e) {
      console.error('fetchChannels', e);
    } finally {
      set({ loading: false });
    }
  },

  loadMoreChannels: async () => {
    const { currentPage, selectedCategory } = get();
    const nextPage = currentPage + 1;
    try {
      const params: Record<string, string> = { page: String(nextPage) };
      if (selectedCategory !== 'all') params.category = selectedCategory;
      const res = await api.channels.list(params);
      const newChannels = res.channels || [];
      const total = res.total || 0;
      if (newChannels.length === 0) return;
      set({
        channels: [...get().channels, ...newChannels],
        currentPage: nextPage,
        hasMore: get().channels.length + newChannels.length < total,
        totalChannels: total,
      });
    } catch (e) {
      console.error('loadMoreChannels', e);
    }
  },

  goToPage: async (page: number) => {
    if (page < 1) return;
    set({ loading: true });
    try {
      const { selectedCategory } = get();
      const params: Record<string, string> = { page: String(page) };
      if (selectedCategory !== 'all') params.category = selectedCategory;
      const res = await api.channels.list(params);
      const channels = res.channels || [];
      const total = res.total || 0;
      set({
        channels,
        currentPage: page,
        hasMore: channels.length < total && channels.length > 0,
        totalChannels: total,
      });
    } catch (e) {
      console.error('goToPage', e);
    } finally {
      set({ loading: false });
    }
  },

  fetchCategoryTotals: async () => {
    try {
      // Fetch total for "all" first
      const allRes = await api.channels.list({ limit: '1' });
      const totals: Record<string, number> = { all: allRes.total || 0 };

      // Fetch totals for each category in parallel
      const categories = ['news', 'sports', 'movies', 'kids', 'music', 'documentary', 'entertainment', 'religious'];
      const results = await Promise.allSettled(
        categories.map(cat => api.channels.list({ category: cat, limit: '1' }))
      );

      categories.forEach((cat, i) => {
        const result = results[i];
        if (result.status === 'fulfilled') {
          totals[cat] = result.value.total || 0;
        }
      });

      set({ categoryTotals: totals });
    } catch (e) {
      console.error('fetchCategoryTotals', e);
    }
  },

  fetchTrending: async () => {
    try {
      const res = await api.channels.trending();
      set({ trending: res.channels || [] });
    } catch (e) {
      console.error('fetchTrending', e);
    }
  },

  fetchFavorites: async () => {
    try {
      const res = await api.channels.favorites();
      set({ favorites: res.channels || [] });
    } catch (e) {
      console.error('fetchFavorites', e);
    }
  },

  fetchHistory: async () => {
    try {
      const res = await api.users.history();
      set({ history: res.history || [] });
    } catch (e) {
      console.error('fetchHistory', e);
    }
  },

  fetchPlaylists: async () => {
    try {
      const res = await api.playlists.list();
      set({ playlists: res.playlists || [] });
    } catch (e) {
      console.error('fetchPlaylists', e);
    }
  },

  toggleFavorite: async (channelId) => {
    const res = await api.channels.favorite(channelId);
    await get().fetchFavorites();
    return res.favorited;
  },

  setCategory: (cat) => {
    set({ selectedCategory: cat });
    get().fetchChannels();
  },

  searchChannels: async (query: string) => {
    if (!query.trim()) return [];
    try {
      const res = await api.channels.search(query.trim());
      return res.channels || [];
    } catch (e) {
      console.error('searchChannels', e);
      return [];
    }
  },
}));
