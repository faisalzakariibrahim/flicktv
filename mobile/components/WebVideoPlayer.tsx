import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  uri: string;
  style?: object;
  onError?: () => void;
}

// Injected once into the document head
let cssInjected = false;
function injectVideoJsCSS() {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/video.js@8/dist/video-js.min.css';
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.textContent = `
    .video-js { width: 100%; height: 100%; background: #000; }
    .video-js .vjs-big-play-button {
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      width: 70px; height: 70px;
      line-height: 70px;
      border: 3px solid #00ff88;
      background: rgba(0,0,0,0.6);
    }
    .video-js .vjs-big-play-button:hover { background: #00ff88; color: #000; }
    .vjs-flicktv .vjs-play-progress { background: #00ff88; }
    .vjs-flicktv .vjs-volume-level { background: #00ff88; }
    .vjs-flicktv .vjs-slider:focus { box-shadow: 0 0 1em #00ff88; }
    .video-js .vjs-control-bar {
      background: linear-gradient(transparent, rgba(0,0,0,0.85));
      height: 42px;
      padding: 0 8px;
    }
  `;
  document.head.appendChild(style);
}

export function WebVideoPlayer({ uri, style, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    injectVideoJsCSS();

    let cancelled = false;

    Promise.all([
      import('video.js'),
      import('@videojs/http-streaming'),
    ]).then(([{ default: videojs }]) => {
      if (cancelled || !containerRef.current) return;

      // Create video element
      const videoEl = document.createElement('video');
      videoEl.className = 'video-js vjs-flicktv vjs-big-play-centered';
      videoEl.setAttribute('playsinline', '');
      containerRef.current.appendChild(videoEl);

      const type = uri.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4';
      const player = videojs(videoEl, {
        autoplay: true,
        controls: true,
        fluid: false,
        fill: true,
        preload: 'auto',
        liveui: true,
        html5: {
          vhs: {
            overrideNative: true,
            enableLowInitialPlaylist: true,
            smoothQualityChange: true,
            handleManifestRedirects: true,
            experimentalBufferBasedABR: true,
            maxPlaylistRetries: 3,
            // Live stream: start at live edge, not beginning
            liveEdgeOffset: 3,
          },
          nativeVideoTracks: false,
          nativeAudioTracks: false,
          nativeTextTracks: false,
        },
        sources: [{ src: uri, type }],
      });

      player.on('error', () => { onError?.(); });

      // Timeout: if no playback starts within 15s, treat as error
      let startupTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        startupTimer = null;
        if (!player.paused() === false && player.readyState() < 3) {
          onError?.();
        }
      }, 15000);

      player.on('playing', () => {
        if (startupTimer) { clearTimeout(startupTimer); startupTimer = null; }
      });

      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Source change without re-mounting the player
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !uri) return;
    player.src({ src: uri, type: uri.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4' });
    player.play().catch(() => {});
  }, [uri]);

  return (
    <View style={[styles.container, style]}>
      {/* @ts-ignore — web-only div */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
});
