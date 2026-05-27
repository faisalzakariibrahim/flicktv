import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { theme } from '../constants/theme';

// Injected into the WebView to intercept XHR/fetch calls and
// postMessage any m3u8 or mp4 URL back to React Native.
const INJECTED_JS = `
(function() {
  var seen = new Set();

  function emit(url) {
    if (!url || seen.has(url)) return;
    var isStream = /\\.m3u8|manifest\\.mpd|\\.mp4|\\.ts(\\?|$)/i.test(url)
      || /\\.m3u8/i.test(url);
    if (!isStream) return;
    seen.add(url);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stream', url }));
  }

  // Intercept XHR
  var OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() { return new OrigXHR(); }
  PatchedXHR.prototype = OrigXHR.prototype;
  var origOpen = OrigXHR.prototype.open;
  OrigXHR.prototype.open = function(method, url) {
    emit(url);
    return origOpen.apply(this, arguments);
  };
  window.XMLHttpRequest = PatchedXHR;

  // Intercept fetch
  var origFetch = window.fetch;
  window.fetch = function(input) {
    emit(typeof input === 'string' ? input : input.url);
    return origFetch.apply(this, arguments);
  };

  // Scan DOM periodically for video/source elements
  setInterval(function() {
    document.querySelectorAll('video, source').forEach(function(el) {
      emit(el.src || el.currentSrc);
    });
  }, 1500);

  true;
})();
`;

export default function SportsBrowserScreen() {
  const { url, name } = useLocalSearchParams<{ url: string; name: string }>();
  const router = useRouter();
  const webviewRef = useRef<WebView>(null);

  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState<string[]>([]);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(url);

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'stream' && msg.url) {
        setStreams(prev => prev.includes(msg.url) ? prev : [...prev, msg.url]);
      }
    } catch {}
  };

  const playStream = (streamUrl: string) => {
    // Navigate to the existing player via a fake channel ID won't work —
    // we pass the stream URL directly as a query param instead.
    router.push({ pathname: '/stream-player', params: { url: streamUrl, title: name } });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>✕</Text>
        </Pressable>
        <View style={styles.urlBar}>
          {loading && <ActivityIndicator color={theme.colors.accent} size="small" style={{ marginRight: 6 }} />}
          <Text style={styles.urlText} numberOfLines={1}>
            {currentUrl?.replace(/https?:\/\//, '')}
          </Text>
        </View>
      </View>

      {/* ── Detected streams banner ───────────────────────────────────────── */}
      {streams.length > 0 && (
        <View style={styles.streamBar}>
          <Text style={styles.streamBarLabel}>◉  {streams.length} stream{streams.length > 1 ? 's' : ''} detected</Text>
          <View style={styles.streamList}>
            {streams.slice(0, 3).map((s, i) => (
              <Pressable key={s} style={styles.streamChip} onPress={() => playStream(s)}>
                <Text style={styles.streamChipText}>▶  Stream {i + 1}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* ── WebView ───────────────────────────────────────────────────────── */}
      <WebView
        ref={webviewRef}
        source={{ uri: url }}
        style={styles.webview}
        injectedJavaScript={INJECTED_JS}
        onMessage={handleMessage}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={nav => {
          setCanGoBack(nav.canGoBack);
          setCanGoForward(nav.canGoForward);
          setCurrentUrl(nav.url);
        }}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        mixedContentMode="always"
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      />

      {/* ── Bottom nav bar ────────────────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        <Pressable style={[styles.navBtn, !canGoBack && styles.navBtnDisabled]} onPress={() => webviewRef.current?.goBack()} disabled={!canGoBack}>
          <Text style={styles.navBtnText}>‹</Text>
        </Pressable>
        <Pressable style={[styles.navBtn, !canGoForward && styles.navBtnDisabled]} onPress={() => webviewRef.current?.goForward()} disabled={!canGoForward}>
          <Text style={styles.navBtnText}>›</Text>
        </Pressable>
        <Pressable style={styles.navBtn} onPress={() => { webviewRef.current?.reload(); setStreams([]); }}>
          <Text style={styles.navBtnText}>↺</Text>
        </Pressable>
        <Pressable style={styles.navBtn} onPress={() => webviewRef.current?.injectJavaScript(`window.location.href = '${url}'; true;`)}>
          <Text style={styles.navBtnText}>⌂</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  backBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  backText: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
  urlBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  urlText: { color: theme.colors.textMuted, fontSize: 12, flex: 1 },
  streamBar: { backgroundColor: theme.colors.accent + '15', borderBottomWidth: 1, borderBottomColor: theme.colors.accent + '44', padding: 10 },
  streamBarLabel: { color: theme.colors.accent, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  streamList: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  streamChip: { backgroundColor: theme.colors.accent, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  streamChipText: { color: '#000', fontSize: 12, fontWeight: '700' },
  webview: { flex: 1 },
  bottomBar: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingBottom: 8 },
  navBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { color: theme.colors.text, fontSize: 20, fontWeight: '600' },
});
