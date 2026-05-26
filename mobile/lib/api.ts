import { supabase } from './supabase';

// For production, set this to your Railway URL
const API_BASE = 'http://192.168.1.158:3001';

export class UpgradeRequiredError extends Error {
  streamsUsed: number;
  streamsLimit: number;
  constructor(msg: string, used: number, limit: number) {
    super(msg);
    this.name = 'UpgradeRequiredError';
    this.streamsUsed = used;
    this.streamsLimit = limit;
  }
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers, ...options.headers } });

  if (res.status === 402) {
    const body = await res.json();
    throw new UpgradeRequiredError(body.message, body.streams_used, body.streams_limit);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  playlists: {
    list: () => request<any>('/api/playlists'),
    create: (data: any) => request<any>('/api/playlists', { method: 'POST', body: JSON.stringify(data) }),
    sync: (id: string) => request<any>(`/api/playlists/${id}/sync`, { method: 'POST' }),
    delete: (id: string) => request<any>(`/api/playlists/${id}`, { method: 'DELETE' }),
  },
  channels: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>(`/api/channels${q}`);
    },
    trending: () => request<any>('/api/channels/trending'),
    get: (id: string) => request<any>(`/api/channels/${id}`),
    favorite: (id: string) => request<any>(`/api/channels/${id}/favorite`, { method: 'POST' }),
    favorites: () => request<any>('/api/channels/me/favorites'),
    recordWatch: (id: string, data: any) => request<any>(`/api/channels/${id}/watch`, { method: 'POST', body: JSON.stringify(data) }),
  },
  users: {
    me: () => request<any>('/api/users/me'),
    update: (data: any) => request<any>('/api/users/me', { method: 'PUT', body: JSON.stringify(data) }),
    history: () => request<any>('/api/users/me/history'),
    clearHistory: () => request<any>('/api/users/me/history', { method: 'DELETE' }),
    subscription: () => request<any>('/api/users/me/subscription'),
  },
  ai: {
    chat: (message: string, sessionId?: string, context?: any) =>
      request<any>('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message, sessionId, context }) }),
    recommendations: () => request<any>('/api/ai/recommendations'),
    voiceSearch: (transcript: string) =>
      request<any>('/api/ai/voice-search', { method: 'POST', body: JSON.stringify({ transcript }) }),
  },
  stream: {
    proxyUrl: async (streamUrl: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      return `${API_BASE}/api/proxy/stream?url=${encodeURIComponent(streamUrl)}&token=${session.access_token}`;
    },
    health: (url: string) =>
      request<any>('/api/stream/health', { method: 'POST', body: JSON.stringify({ url }) }),
  },
};
