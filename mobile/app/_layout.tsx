import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../stores/authStore';

export default function RootLayout() {
  const { session, loading, loadSession } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => { loadSession(); }, []);

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth) router.replace('/(auth)/login');
    else if (session && inAuth) router.replace('/(tabs)');
  }, [session, loading]);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0D0D0D' } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="player/[channelId]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="import" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ai" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
