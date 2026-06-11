import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../constants/theme';

interface Props {
  label: string;
  value: string;
  icon?: string;
  selected: boolean;
  onPress: () => void;
  count?: number;
}

export function CategoryPill({ label, icon, selected, onPress, count }: Props) {
  const formatCount = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toString();
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.pill, selected && styles.pillSelected, pressed && styles.pressed]}
      onPress={onPress}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      {count !== undefined && count > 0 && (
        <Text style={[styles.count, selected && styles.countSelected]}>
          {formatCount(count)}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
    gap: 6,
  },
  pillSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  pressed: { opacity: 0.7 },
  icon: {
    fontSize: 14,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelSelected: { color: '#000', fontWeight: '700' },
  count: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  countSelected: {
    color: '#000',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
});
