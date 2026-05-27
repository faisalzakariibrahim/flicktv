import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../lib/api';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, session, signOut } = useAuthStore();
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    if (session) api.users.subscription().then(setSubscription).catch(() => {});
  }, [session]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Guest';
  const email = user?.email || '';
  const isPremium = subscription?.plan === 'premium';
  const freemium = subscription?.freemium;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{displayName[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}
          {session ? (
            <View style={[styles.planBadge, isPremium && styles.planBadgePremium]}>
              <Text style={[styles.planText, isPremium && styles.planTextPremium]}>
                {isPremium ? '★ Premium' : 'Free Plan'}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Guest sign-in prompt */}
        {!session && (
          <View style={styles.section}>
            <Text style={styles.guestText}>Sign in to save favorites, import playlists, and use Flick AI.</Text>
            <Pressable style={styles.signInBtn} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.signInBtnText}>Sign In / Create Account</Text>
            </Pressable>
          </View>
        )}

        {/* Freemium meter */}
        {session && !isPremium && freemium && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Free Streams</Text>
            <View style={styles.meterRow}>
              <View style={styles.meterTrack}>
                <View style={[styles.meterFill, { width: `${(freemium.streams_used / freemium.streams_limit) * 100}%` }]} />
              </View>
              <Text style={styles.meterText}>{freemium.streams_used}/{freemium.streams_limit}</Text>
            </View>
            {freemium.limit_reached && (
              <Text style={styles.limitReached}>Stream limit reached — upgrade for unlimited access</Text>
            )}
            <Pressable style={styles.upgradeBtn}>
              <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
            </Pressable>
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Library</Text>
          {[
            { label: '+ Import Playlist', onPress: () => router.push('/import') },
            { label: '✦ Flick AI Assistant', onPress: () => router.push('/ai') },
          ].map(item => (
            <Pressable key={item.label} style={styles.row} onPress={item.onPress}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowArrow}>›</Text>
            </Pressable>
          ))}
        </View>

        {session && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <Pressable style={[styles.row, styles.signOutRow]} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.version}>FlickTV v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  avatarSection: { alignItems: 'center', paddingVertical: theme.spacing.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.accentDim, justifyContent: 'center', alignItems: 'center', marginBottom: theme.spacing.sm },
  avatarInitial: { color: '#fff', fontSize: theme.fontSize.xxl, fontWeight: '700' },
  name: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: '700' },
  email: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginTop: 2, marginBottom: theme.spacing.sm },
  planBadge: { paddingHorizontal: theme.spacing.md, paddingVertical: 4, borderRadius: theme.radius.full, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  planBadgePremium: { borderColor: theme.colors.accent, backgroundColor: '#1a3a1a' },
  planText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '600' },
  planTextPremium: { color: theme.colors.accent },
  section: { marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.lg },
  sectionTitle: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: theme.spacing.sm },
  guestText: { color: theme.colors.textSecondary, fontSize: theme.fontSize.md, textAlign: 'center', marginBottom: theme.spacing.md },
  signInBtn: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.full, paddingVertical: theme.spacing.md, alignItems: 'center' },
  signInBtnText: { color: '#000', fontSize: theme.fontSize.md, fontWeight: '700' },
  meterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
  meterTrack: { flex: 1, height: 6, backgroundColor: theme.colors.surface, borderRadius: 3, marginRight: theme.spacing.sm, overflow: 'hidden' },
  meterFill: { height: '100%', backgroundColor: theme.colors.accent, borderRadius: 3 },
  meterText: { color: theme.colors.textSecondary, fontSize: theme.fontSize.sm },
  limitReached: { color: theme.colors.error, fontSize: theme.fontSize.sm, marginBottom: theme.spacing.sm },
  upgradeBtn: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.full, paddingVertical: theme.spacing.sm, alignItems: 'center' },
  upgradeBtnText: { color: '#000', fontWeight: '700', fontSize: theme.fontSize.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.xs },
  rowLabel: { color: theme.colors.text, fontSize: theme.fontSize.md },
  rowArrow: { color: theme.colors.textMuted, fontSize: theme.fontSize.lg },
  signOutRow: { borderWidth: 1, borderColor: theme.colors.error + '40', backgroundColor: 'transparent' },
  signOutText: { color: theme.colors.error, fontSize: theme.fontSize.md, fontWeight: '600' },
  version: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, textAlign: 'center', marginBottom: theme.spacing.xl },
});
