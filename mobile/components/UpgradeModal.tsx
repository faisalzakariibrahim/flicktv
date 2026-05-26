import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import { api } from '../lib/api';

interface Props {
  visible: boolean;
  streamsUsed: number;
  streamsLimit: number;
  onClose: () => void;
}

export function UpgradeModal({ visible, streamsUsed, streamsLimit, onClose }: Props) {
  const handleUpgrade = async () => {
    try {
      await api.users.me();
      // In production: launch in-app purchase flow here
      // For now, just close — upgrade happens via the backend /upgrade route
      alert('In-app purchases coming soon! Contact support to upgrade.');
    } catch {}
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.icon}>▶</Text>
          <Text style={styles.title}>Free Streams Used Up</Text>
          <Text style={styles.body}>
            You've watched {streamsUsed} of {streamsLimit} free streams.{'\n'}
            Upgrade to Premium for unlimited streaming.
          </Text>

          <View style={styles.features}>
            {['Unlimited channels', 'HD & 4K quality', 'Flick AI assistant', 'No interruptions'].map(f => (
              <Text key={f} style={styles.feature}>✓  {f}</Text>
            ))}
          </View>

          <Pressable style={styles.upgradeBtn} onPress={handleUpgrade}>
            <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
          </Pressable>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  box: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  icon: { fontSize: 40, color: theme.colors.accent, marginBottom: theme.spacing.md },
  title: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: '700', marginBottom: theme.spacing.sm },
  body: { color: theme.colors.textSecondary, fontSize: theme.fontSize.md, textAlign: 'center', lineHeight: 22, marginBottom: theme.spacing.lg },
  features: { width: '100%', marginBottom: theme.spacing.lg },
  feature: { color: theme.colors.accent, fontSize: theme.fontSize.md, marginBottom: theme.spacing.xs },
  upgradeBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  upgradeBtnText: { color: '#000', fontSize: theme.fontSize.md, fontWeight: '700' },
  closeBtn: { padding: theme.spacing.sm },
  closeBtnText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
});
