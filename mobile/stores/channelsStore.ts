import { create } from 'zustand';
import { api } from '../lib/api';

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
  fetchChannels: (params?: Record<string, string>) => Promise<void>;
  fetchTrending: () => Promise<void>;
  fetchFavorites: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  fetchPlaylists: () => Promise<void>;
  toggleFavorite: (channelId: string) => Promise<boolean>;
  setCategory: (cat: string) => void;
}

export const useChannelsStore = create<ChannelsStore>((set, get) => ({
  channels: [],
  trending: [],
  favorites: [],
  history: [],
  playlists: [],
  loading: false,
  selectedCategory: 'all',

  fetchChannels: async (params) => {
    set({ loading: true });
    try {
      const cat = get().selectedCategory;
      const query = cat !== 'all' ? { ...params, category: cat } : params;
      const res = await api.channels.list(query);
      set({ channels: res.channels || [] });
    } catch (e) {
      console.error('fetchChannels', e);
    } finally {
      set({ loading: false });
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
}));
