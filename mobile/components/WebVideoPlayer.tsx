import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  uri: string;
  style?: object;
}

export function WebVideoPlayer({ uri, style }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !uri) return;

    const isHLS = uri.includes('.m3u8') || uri.includes('m3u8');

    if (isHLS) {
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: false });
          hls.loadSource(uri);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
          return () => hls.destroy();
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = uri;
          video.play().catch(() => {});
        }
      });
    } else {
      video.src = uri;
      video.play().catch(() => {});
    }
  }, [uri]);

  return (
    <View style={[styles.container, style]}>
      {/* @ts-ignore — web-only element */}
      <video
        ref={videoRef}
        style={styles.video}
        controls
        autoPlay
        playsInline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { width: '100%', height: '100%', objectFit: 'contain' } as any,
});
