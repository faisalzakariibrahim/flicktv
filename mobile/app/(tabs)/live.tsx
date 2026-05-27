import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, View, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { api } from '../../lib/api';

const SPORTS = [
  { key: 'soccer',            label: '⚽ Football' },
  { key: 'basketball',        label: '🏀 Basketball' },
  { key: 'american-football', label: '🏈 NFL' },
  { key: 'hockey',            label: '🏒 Hockey' },
];

// Verified live sites for fallback browser (HTTP 200 confirmed)
const FALLBACK_SITES = [
  { name: 'Yalla Shoot',    url: 'https://yalla-shoot-new.com/' },
  { name: 'Koora Live Hub', url: 'https://kooralivehub.com/' },
  { name: 'Live Koora',     url: 'https://livekoora.today/' },
  { name: 'Koora TV',       url: 'https://kooratv.life/' },
  { name: 'Koora CDF',      url: 'https://koora.cfd/' },
  { name: 'TV96',           url: 'https://tv96.cfd/' },
  { name: 'Stream2Watch',   url: 'https://www.stream2watch.com/' },
  { name: 'Camel TV',       url: 'https://www.camel1.tv/' },
];

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function StatusBadge({ event }: { event: any }) {
  if (event.isLive) {
    return (
      <View style={badge.live}>
        <View style={badge.dot} />
        <Text style={badge.liveText}>{event.statusText || 'LIVE'}</Text>
      </View>
    );
  }
  if (event.isFinished) {
    return <View style={badge.ft}><Text style={badge.ftText}>FT</Text></View>;
  }
  return <Text style={badge.time}>{formatTime(event.startTime)}</Text>;
}

const badge = StyleSheet.create({
  live: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dc262222', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#dc2626' },
  liveText: { color: '#dc2626', fontSize: 10, fontWeight: '800' },
  ft: { backgroundColor: theme.colors.surface, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  ftText: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' },
  time: { color: theme.colors.accent, fontSize: 12, fontWeight: '700' },
});

function MatchCard({ event, onPress }: { event: any; onPress: () => void }) {
  return (
    <Pressable style={[card.root, event.isLive && card.rootLive]} onPress={onPress}>
      <View style={card.leagueRow}>
        <Text style={card.league}>{event.leagueFlag} {event.league}</Text>
        <StatusBadge event={event} />
      </View>

      <View style={card.teamsRow}>
        <View style={card.team}>
          {event.homeLogo ? (
            <Image source={{ uri: event.homeLogo }} style={card.logo} resizeMode="contain" />
          ) : <View style={card.logoPlaceholder} />}
          <Text style={card.teamName} numberOfLines={2}>{event.homeTeam}</Text>
        </View>

        <View style={card.scoreBox}>
          {event.isLive || event.isFinished ? (
            <Text style={[card.score, event.isLive && card.scoreLive]}>
              {event.homeScore ?? 0} – {event.awayScore ?? 0}
            </Text>
          ) : (
            <Text style={card.vs}>VS</Text>
          )}
        </View>

        <View style={card.team}>
          {event.awayLogo ? (
            <Image source={{ uri: event.awayLogo }} style={card.logo} resizeMode="contain" />
          ) : <View style={card.logoPlaceholder} />}
          <Text style={card.teamName} numberOfLines={2}>{event.awayTeam}</Text>
        </View>
      </View>

      {(event.isLive || event.isScheduled) && (
        <View style={card.watchRow}>
          <Text style={card.watchText}>▶  Watch Live</Text>
        </View>
      )}
    </Pressable>
  );
}

const card = StyleSheet.create({
  root: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md, marginBottom: 10 },
  rootLive: { borderColor: '#dc262255' },
  leagueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  league: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
  teamsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  team: { flex: 1, alignItems: 'center', gap: 6 },
  logo: { width: 40, height: 40 },
  logoPlaceholder: { width: 40, height: 40, backgroundColor: theme.colors.border, borderRadius: 20 },
  teamName: { color: theme.colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  scoreBox: { paddingHorizontal: 16, alignItems: 'center' },
  score: { color: theme.colors.text, fontSize: 22, fontWeight: '800' },
  scoreLive: { color: '#dc2626' },
  vs: { color: theme.colors.textMuted, fontSize: 16, fontWeight: '700' },
  watchRow: { marginTop: 10, backgroundColor: theme.colors.accent + '15', borderRadius: 6, paddingVertical: 6, alignItems: 'center' },
  watchText: { color: theme.colors.accent, fontSize: 12, fontWeight: '700' },
});

export default function LiveSportsScreen() {
  const router = useRouter();
  const [sport, setSport] = useState('soccer');
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (s = sport, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.sports.schedule(s);
      setEvents(res.events || []);
    } catch (e) {
      console.error('sports schedule', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sport]);

  useEffect(() => { load(sport); }, [sport]);

  const openMatch = (event: any) => {
    // Pick a fallback site and open the browser so the user can find the stream
    const site = FALLBACK_SITES[0];
    if (Platform.OS === 'web') {
      window.open(site.url, '_blank');
    } else {
      router.push({ pathname: '/sports-browser', params: { url: site.url, name: `${event.homeTeam} vs ${event.awayTeam}` } });
    }
  };

  const live = events.filter(e => e.isLive);
  const upcoming = events.filter(e => e.isScheduled);
  const finished = events.filter(e => e.isFinished);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>

      {/* Sport selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sportPills}>
        {SPORTS.map(s => (
          <Pressable key={s.key} style={[styles.pill, sport === s.key && styles.pillActive]} onPress={() => setSport(s.key)}>
            <Text style={[styles.pillText, sport === s.key && styles.pillTextActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.accent} size="large" /></View>
      ) : (
        <FlatList
          data={[
            ...(live.length ? [{ type: 'header', label: `◉ Live Now (${live.length})` }, ...live.map(e => ({ type: 'match', ...e }))] : []),
            ...(upcoming.length ? [{ type: 'header', label: `⏱ Upcoming (${upcoming.length})` }, ...upcoming.map(e => ({ type: 'match', ...e }))] : []),
            ...(finished.length ? [{ type: 'header', label: `✓ Finished (${finished.length})` }, ...finished.map(e => ({ type: 'match', ...e }))] : []),
          ]}
          keyExtractor={(item: any) => item.id || item.label}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(sport, true); }} tintColor={theme.colors.accent} />}
          renderItem={({ item }: { item: any }) => {
            if (item.type === 'header') {
              return <Text style={styles.sectionHeader}>{item.label}</Text>;
            }
            return <MatchCard event={item} onPress={() => openMatch(item)} />;
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyTitle}>No matches today</Text>
              <Text style={styles.emptyText}>Check back later or browse live streams below</Text>
              <View style={styles.fallbackGrid}>
                {FALLBACK_SITES.map(site => (
                  <Pressable key={site.url} style={styles.fallbackCard}
                    onPress={() => Platform.OS === 'web' ? window.open(site.url, '_blank') : router.push({ pathname: '/sports-browser', params: { url: site.url, name: site.name } })}>
                    <Text style={styles.fallbackName}>{site.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  sportPills: { paddingHorizontal: theme.spacing.md, paddingVertical: 10, gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  pillActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  pillText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: theme.spacing.md, paddingTop: 4 },
  sectionHeader: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8, marginBottom: 8 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700', marginBottom: 6 },
  emptyText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginBottom: 20 },
  fallbackGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  fallbackCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, paddingVertical: 8 },
  fallbackName: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
});
