import { Image, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { theme } from '../constants/theme';

// Country code to flag emoji mapping (common ones)
const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺', DE: '🇩🇪', FR: '🇫🇷',
  IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹', BR: '🇧🇷', MX: '🇲🇽', AR: '🇦🇷',
  JP: '🇯🇵', KR: '🇰🇷', CN: '🇨🇳', IN: '🇮🇳', PK: '🇵🇰', BD: '🇧🇩',
  RU: '🇷🇺', UA: '🇺🇦', PL: '🇵🇱', NL: '🇳🇱', BE: '🇧🇪', SE: '🇸🇪',
  NO: '🇳🇴', DK: '🇩🇰', FI: '🇫🇮', TR: '🇹🇷', SA: '🇸🇦', AE: '🇦🇪',
  EG: '🇪🇬', ZA: '🇿🇦', NG: '🇳🇬', KE: '🇰🇪', TH: '🇹🇭', VN: '🇻🇳',
  ID: '🇮🇩', MY: '🇲🇾', PH: '🇵🇭', SG: '🇸🇬', NZ: '🇳🇿', IE: '🇮🇪',
  CH: '🇨🇭', AT: '🇦🇹', CZ: '🇨🇿', RO: '🇷🇴', HU: '🇭🇺', GR: '🇬🇷',
  IL: '🇮🇱', QA: '🇶🇦', KW: '🇰🇼', CO: '🇨🇴', CL: '🇨🇱', PE: '🇵🇪',
  VE: '🇻🇪', EC: '🇪🇨', BO: '🇧🇴', PY: '🇵🇾', UY: '🇺🇾', CR: '🇨🇷',
  PA: '🇵🇦', GT: '🇬🇹', HN: '🇭🇳', SV: '🇸🇻', NI: '🇳🇮', DO: '🇩🇴',
  HT: '🇭🇹', JM: '🇯🇲', TT: '🇹🇹', BB: '🇧🇧', CU: '🇨🇺', PR: '🇵🇷',
  IS: '🇮🇸', LU: '🇱🇺', MT: '🇲🇹', CY: '🇨🇾', SK: '🇸🇰', SI: '🇸🇮',
  HR: '🇭🇷', BA: '🇧🇦', RS: '🇷🇸', ME: '🇲🇪', MK: '🇲🇰', AL: '🇦🇱',
  BG: '🇧🇬', EE: '🇪🇪', LV: '🇱🇻', LT: '🇱🇹', BY: '🇧🇾', MD: '🇲🇩',
  GE: '🇬🇪', AM: '🇦🇲', AZ: '🇦🇿', KZ: '🇰🇿', UZ: '🇺🇿', KG: '🇰🇬',
  TJ: '🇹🇯', MN: '🇲🇳', TW: '🇹🇼', HK: '🇭🇰', MO: '🇲🇴', LK: '🇱🇰',
  NP: '🇳🇵', MM: '🇲🇲', KH: '🇰🇭', LA: '🇱🇦', BN: '🇧🇳', TL: '🇹🇱',
  FJ: '🇫🇯', PG: '🇵🇬', SB: '🇸🇧', VU: '🇻🇺', WS: '🇼🇸', TO: '🇹🇴',
  AF: '🇦🇫', IR: '🇮🇷', IQ: '🇮🇶', SY: '🇸🇾', LB: '🇱🇧', JO: '🇯🇴',
  PS: '🇵🇸', OM: '🇴🇲', YE: '🇾🇪', BH: '🇧🇭',
};

function getFlagEmoji(countryCode?: string): string {
  if (!countryCode) return '';
  const code = countryCode.toUpperCase();
  return COUNTRY_FLAGS[code] || '';
}

function getCategoryLabel(category?: string): string {
  if (!category) return '';
  const labels: Record<string, string> = {
    news: '📰 News',
    sports: '⚽ Sports',
    movies: '🎬 Movies',
    kids: '🧒 Kids',
    music: '🎵 Music',
    documentary: '🌍 Documentary',
    entertainment: '🎭 Entertainment',
    religious: '🙏 Religious',
    lifestyle: '✨ Lifestyle',
    education: '📚 Education',
    gaming: '🎮 Gaming',
    science: '🔬 Science',
    travel: '✈️ Travel',
    food: '🍕 Food',
    fashion: '👗 Fashion',
    auto: '🚗 Auto',
    tech: '💻 Tech',
  };
  return labels[category.toLowerCase()] || category.charAt(0).toUpperCase() + category.slice(1);
}

interface Props {
  channel: {
    id: string;
    name: string;
    logo_url?: string;
    category?: string;
    group_title?: string;
    country?: string;
    is_hd?: boolean;
    is_4k?: boolean;
    is_live?: boolean;
  };
  onPress: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function ChannelCard({ channel, onPress }: Props) {
  const imgH = 96;
  const flag = getFlagEmoji(channel.country);
  const categoryLabel = getCategoryLabel(channel.category);

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

        {/* Country flag */}
        {flag ? (
          <View style={styles.flagBadge}>
            <Text style={styles.flagText}>{flag}</Text>
          </View>
        ) : null}

        {/* Bottom gradient overlay */}
        <View style={styles.gradientOverlay} />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{channel.name}</Text>
        {channel.group_title && channel.group_title !== channel.name && (
          <Text style={styles.groupTitle} numberOfLines={1}>{channel.group_title}</Text>
        )}
        {categoryLabel ? (
          <Text style={styles.category} numberOfLines={1}>{categoryLabel}</Text>
        ) : null}
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
  flagBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  flagText: { fontSize: 14 },
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
  groupTitle: { color: theme.colors.textSecondary, fontSize: theme.fontSize.xs, marginBottom: 2 },
  category: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
});
