import { Pressable, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';

// Only sites that returned HTTP 200 in live testing
const SPORTS_SITES = [
  { name: 'Yalla Shoot',    url: 'https://yalla-shoot-new.com/',   icon: '⚽', color: '#22c55e' },
  { name: 'Koora Live Hub', url: 'https://kooralivehub.com/',      icon: '🏆', color: '#f59e0b' },
  { name: 'Live Koora',     url: 'https://livekoora.today/',       icon: '📺', color: '#3b82f6' },
  { name: 'Koora TV',       url: 'https://kooratv.life/',          icon: '📺', color: '#2563eb' },
  { name: 'Koora CDF',      url: 'https://koora.cfd/',             icon: '🎯', color: '#8b5cf6' },
  { name: 'TV96',           url: 'https://tv96.cfd/',              icon: '📡', color: '#ec4899' },
  { name: 'Stream2Watch',   url: 'https://www.stream2watch.com/',  icon: '▶',  color: '#06b6d4' },
];

export default function LiveSportsScreen() {
  const router = useRouter();

  const openSite = (url: string, name: string) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.open(url, '_blank');
      return;
    }
    router.push({ pathname: '/sports-browser', params: { url, name } });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.title}>Live Sports</Text>
          <Text style={styles.sub}>Browse live matches from top streaming sites</Text>
        </View>

        <View style={styles.tip}>
          <Text style={styles.tipText}>
            ◉  Streams are auto-detected — when a match loads the player launches automatically
          </Text>
        </View>

        <View style={styles.grid}>
          {SPORTS_SITES.map(site => (
            <Pressable
              key={site.url}
              style={styles.card}
              onPress={() => openSite(site.url, site.name)}
            >
              <View style={[styles.iconWrap, { backgroundColor: site.color + '22', borderColor: site.color + '55' }]}>
                <Text style={styles.icon}>{site.icon}</Text>
              </View>
              <Text style={styles.cardName}>{site.name}</Text>
              <Text style={styles.cardUrl} numberOfLines={1}>
                {site.url.replace(/https?:\/\//, '').replace(/\/$/, '')}
              </Text>
              <View style={[styles.liveChip, { borderColor: site.color }]}>
                <View style={[styles.liveDot, { backgroundColor: site.color }]} />
                <Text style={[styles.liveText, { color: site.color }]}>LIVE</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: theme.spacing.md, paddingBottom: 0 },
  title: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: '800' },
  sub: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginTop: 2 },
  tip: {
    margin: theme.spacing.md,
    backgroundColor: theme.colors.accent + '11',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.accent + '33',
    padding: theme.spacing.sm,
  },
  tipText: { color: theme.colors.accent, fontSize: theme.fontSize.xs, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: theme.spacing.md, gap: 12 },
  card: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  icon: { fontSize: 22 },
  cardName: { color: theme.colors.text, fontSize: theme.fontSize.md, fontWeight: '700', marginBottom: 2 },
  cardUrl: { color: theme.colors.textMuted, fontSize: 10, marginBottom: 10 },
  liveChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1, borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3, gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});
