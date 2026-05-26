import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
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
  size?: 'sm' | 'md';
}

export function ChannelCard({ channel, onPress, size = 'md' }: Props) {
  const isSmall = size === 'sm';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, isSmall && styles.cardSm, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={[styles.logoBox, isSmall && styles.logoBoxSm]}>
        {channel.logo_url ? (
          <Image source={{ uri: channel.logo_url }} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={styles.logoFallback}>
            <Text style={styles.logoInitial}>{channel.name[0]?.toUpperCase()}</Text>
          </View>
        )}
        {channel.is_live && (
          <View style={styles.liveBadge}>
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, isSmall && styles.nameSm]} numberOfLines={1}>
          {channel.name}
        </Text>
        <View style={styles.badges}>
          {channel.category && (
            <Text style={styles.category}>{channel.category}</Text>
          )}
          {channel.is_4k && <Text style={styles.badge4k}>4K</Text>}
          {channel.is_hd && !channel.is_4k && <Text style={styles.badgeHd}>HD</Text>}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    width: 140,
    marginRight: theme.spacing.sm,
  },
  cardSm: { width: 110 },
  pressed: { opacity: 0.75 },
  logoBox: {
    width: '100%',
    height: 90,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBoxSm: { height: 70 },
  logo: { width: '80%', height: '80%' },
  logoFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInitial: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: '700' },
  liveBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: theme.colors.live,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  liveText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  info: { padding: theme.spacing.sm },
  name: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: '600' },
  nameSm: { fontSize: theme.fontSize.xs },
  badges: { flexDirection: 'row', gap: 4, marginTop: 3 },
  category: { color: theme.colors.textMuted, fontSize: 10 },
  badge4k: {
    color: theme.colors.accent,
    fontSize: 9,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: theme.colors.accent,
    paddingHorizontal: 3,
    borderRadius: 3,
  },
  badgeHd: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 3,
    borderRadius: 3,
  },
});
