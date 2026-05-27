import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UpgradeModal } from '../../components/UpgradeModal';
import { WebVideoPlayer } from '../../components/WebVideoPlayer';
import { theme } from '../../constants/theme';
import { api, UpgradeRequiredError } from '../../lib/api';
import { useChannelsStore } from '../../stores/channelsStore';

const isWeb = Platform.OS === 'web';

export default function PlayerScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const router = useRouter();
  const { toggleFavorite, favorites } = useChannelsStore();

  const [channel, setChannel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [streamError, setStreamError] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState({ used: 0, limit: 3 });
  const [isFav, setIsFav] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  const player = useVideoPlayer(
    !isWeb && streamUrl ? { uri: streamUrl, contentType: streamUrl.includes('.m3u8') ? 'hls' : undefined } : null,
    p => { if (!isWeb && streamUrl) p.play(); }
  );

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  useEffect(() => {
    loadChannel();
  }, [channelId]);

  const loadChannel = async () => {
    try {
      const res = await api.channels.get(channelId);
      setChannel(res.channel);
      setIsFav(favorites.some(f => f.id === channelId));

      // Get proxied stream URL (freemium check happens here on backend)
      const proxied = await api.stream.proxyUrl(res.channel.stream_url);
      setStreamUrl(proxied);

      // Record watch
      api.channels.recordWatch(channelId, { device_type: 'mobile' }).catch(() => {});
    } catch (e: any) {
      if (e instanceof UpgradeRequiredError) {
        setUpgradeInfo({ used: e.streamsUsed, limit: e.streamsLimit });
        setShowUpgrade(true);
      } else {
        setError(e.message || 'Failed to load channel');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFavorite = async () => {
    const fav = await toggleFavorite(channelId);
    setIsFav(fav);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={styles.loadingText}>Loading stream...</Text>
      </View>
    );
  }

  if (error || streamError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>📡</Text>
        <Text style={styles.errorTitle}>Stream Unavailable</Text>
        <Text style={styles.errorSub}>
          {channel?.name ? `${channel.name} is not streaming right now.` : 'This stream could not be loaded.'}
        </Text>
        <View style={styles.errorBtns}>
          <Pressable style={styles.retryBtn} onPress={() => { setStreamError(false); setError(''); loadChannel(); }}>
            <Text style={styles.retryBtnText}>↺ Retry</Text>
          </Pressable>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>‹ Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Video — web uses hls.js, native uses expo-video */}
      {streamUrl && isWeb && (
        <WebVideoPlayer uri={streamUrl} style={StyleSheet.absoluteFill} onError={() => setStreamError(true)} />
      )}
      {streamUrl && !isWeb && (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          allowsFullscreen
          allowsPictureInPicture
          nativeControls={false}
        />
      )}

      {/* Overlay controls — only on native (web uses native <video> controls) */}
      {!isWeb && (
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <Text style={styles.iconBtnText}>‹ Back</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable style={styles.iconBtn} onPress={handleFavorite}>
            <Text style={[styles.iconBtnText, { color: isFav ? theme.colors.accent : '#fff' }]}>
              {isFav ? '♥' : '♡'}
            </Text>
          </Pressable>
        </View>

        {/* Center play/pause */}
        <Pressable style={styles.centerBtn} onPress={() => isPlaying ? player.pause() : player.play()}>
          <Text style={styles.centerBtnText}>{isPlaying ? '⏸' : '▶'}</Text>
        </Pressable>

        {/* Bottom info */}
        <View style={styles.bottomBar}>
          <Text style={styles.channelName}>{channel?.name}</Text>
          {channel?.is_live && (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
          {channel?.category && <Text style={styles.channelCat}>{channel.category}</Text>}
        </View>
      </SafeAreaView>
      )}

      {/* Web: back button overlay */}
      {isWeb && (
        <View style={styles.webTopBar}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}>
            <Text style={styles.iconBtnText}>‹ Back</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable style={styles.iconBtn} onPress={handleFavorite}>
            <Text style={[styles.iconBtnText, { color: isFav ? theme.colors.accent : '#fff' }]}>
              {isFav ? '♥' : '♡'}
            </Text>
          </Pressable>
        </View>
      )}

      <UpgradeModal
        visible={showUpgrade}
        streamsUsed={upgradeInfo.used}
        streamsLimit={upgradeInfo.limit}
        onClose={() => { setShowUpgrade(false); router.back(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: theme.colors.textSecondary, marginTop: theme.spacing.md },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorTitle: { color: '#fff', fontSize: theme.fontSize.xl, fontWeight: '800', marginBottom: 8 },
  errorSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, textAlign: 'center', marginBottom: 28, paddingHorizontal: 32 },
  errorBtns: { flexDirection: 'row', gap: 12 },
  retryBtn: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.full, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { color: '#000', fontWeight: '800', fontSize: theme.fontSize.sm },
  backBtn: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.full, paddingHorizontal: 24, paddingVertical: 10, borderWidth: 1, borderColor: theme.colors.border },
  backBtnText: { color: theme.colors.text, fontWeight: '600', fontSize: theme.fontSize.sm },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  webTopBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 },
  topBar: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, backgroundColor: 'rgba(0,0,0,0.4)' },
  iconBtn: { padding: theme.spacing.sm },
  iconBtnText: { color: '#fff', fontSize: theme.fontSize.lg, fontWeight: '600' },
  centerBtn: { alignSelf: 'center', width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  centerBtnText: { color: '#fff', fontSize: 28 },
  bottomBar: { padding: theme.spacing.md, backgroundColor: 'rgba(0,0,0,0.5)' },
  channelName: { color: '#fff', fontSize: theme.fontSize.lg, fontWeight: '700' },
  livePill: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.live, marginRight: 4 },
  liveText: { color: theme.colors.live, fontSize: theme.fontSize.xs, fontWeight: '700' },
  channelCat: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginTop: 2 },
});
