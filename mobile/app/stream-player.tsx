import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebVideoPlayer } from '../components/WebVideoPlayer';

export default function StreamPlayerScreen() {
  const { url, title } = useLocalSearchParams<{ url: string; title: string }>();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';

  const player = useVideoPlayer(
    !isWeb && url ? { uri: url } : null,
    p => { p.play(); }
  );

  return (
    <View style={styles.root}>
      {/* Close button */}
      <Pressable style={styles.closeBtn} onPress={() => router.back()}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>

      {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}

      {url && isWeb && (
        <WebVideoPlayer uri={url} style={StyleSheet.absoluteFill} />
      )}
      {url && !isWeb && (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          allowsFullscreen
          allowsPictureInPicture
          nativeControls
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  closeBtn: {
    position: 'absolute', top: 50, left: 16, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20, width: 36, height: 36,
    justifyContent: 'center', alignItems: 'center',
  },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  title: {
    position: 'absolute', top: 54, left: 60, right: 16, zIndex: 10,
    color: '#fff', fontSize: 14, fontWeight: '600',
  },
});
