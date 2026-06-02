import { Image, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { theme } from '../constants/theme';

interface Props {
  channel: {
    id: string;
    name: string;
    logo_url?: string;
    category?: string;
    is_hd?: boolean;
    is_4k?: boolean;
    is_live?: boolean;
  };
  onPress: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function ChannelCard({ channel, onPress }: Props) {
  const imgH = 96;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      {/* Thumbnail */}
      <View style={[styles.thumb, { height: imgH }]}>
        {channel.logo_url ? (
          <Image source={{ uri: channel.logo_url }} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={styles.fallback}>
            <Text style={styles.fallbackText}>{channel.name[0]?.toUpperCase()}</Text>
          </View>
        )}

        {/* Live badge */}
        {channel.is_live && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}

        {/* Quality badge */}
        {(channel.is_4k || channel.is_hd) && (
          <View style={[styles.qualityBadge, channel.is_4k && styles.qualityBadge4k]}>
            <Text style={styles.qualityText}>{channel.is_4k ? '4K' : 'HD'}</Text>
          </View>
        )}

        {/* Bottom gradient overlay */}
        <View style={styles.gradientOverlay} />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{channel.name}</Text>
        {channel.category && (
          <Text style={styles.category} numberOfLines={1}>
            {channel.category.charAt(0).toUpperCase() + channel.category.slice(1)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...Platform.select({
      web: { cursor: 'pointer' as any },
    }),
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  thumb: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  logo: { width: '70%', height: '70%' },
  fallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.accentDim + '33',
    borderWidth: 1,
    borderColor: theme.colors.accent + '44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: { color: theme.colors.accent, fontSize: theme.fontSize.lg, fontWeight: '800' },
  liveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.live,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  qualityBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  qualityBadge4k: { borderColor: theme.colors.accent + '66' },
  qualityText: { color: theme.colors.textSecondary, fontSize: 9, fontWeight: '700' },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: 'transparent',
  },
  info: { padding: 10, paddingTop: 8 },
  name: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: '700', marginBottom: 2 },
  category: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
});
