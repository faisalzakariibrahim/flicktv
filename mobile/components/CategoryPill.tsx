import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../constants/theme';

interface Props {
  label: string;
  value: string;
  selected: boolean;
  onPress: () => void;
}

export function CategoryPill({ label, selected, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.pill, selected && styles.pillSelected, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
  },
  pillSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  pressed: { opacity: 0.7 },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelSelected: { color: '#000', fontWeight: '700' },
});
