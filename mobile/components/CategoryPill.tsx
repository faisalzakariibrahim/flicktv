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
      style={[styles.pill, selected && styles.pillSelected]}
      onPress={onPress}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
  },
  pillSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  labelSelected: { color: '#000' },
});
