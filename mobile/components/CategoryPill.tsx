import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../constants/theme';

interface Props {
  label: string;
  value: string;
  icon?: string;
  selected: boolean;
  onPress: () => void;
}

export function CategoryPill({ label, icon, selected, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.pill, selected && styles.pillSelected, pressed && styles.pressed]}
      onPress={onPress}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
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
});
