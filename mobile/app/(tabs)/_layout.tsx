import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { theme } from '../../constants/theme';

function TabIcon({ symbol, focused, label }: { symbol: string; focused: boolean; label: string }) {
  return (
    <View style={[icon.wrap, focused && icon.wrapActive]}>
      <Text style={[icon.sym, focused && icon.symActive]}>{symbol}</Text>
    </View>
  );
}

const icon = StyleSheet.create({
  wrap:       { alignItems: 'center', justifyContent: 'center', width: 40, height: 32, borderRadius: 10 },
  wrapActive: { backgroundColor: theme.colors.accent + '18' },
  sym:        { fontSize: 20, color: theme.colors.textMuted },
  symActive:  { color: theme.colors.accent },
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 6,
          height: 62,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon symbol="⊞" focused={focused} label="Home" />,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: 'Sports',
          tabBarIcon: ({ focused }) => <TabIcon symbol="⚽" focused={focused} label="Sports" />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused }) => <TabIcon symbol="⌕" focused={focused} label="Search" />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorites',
          tabBarIcon: ({ focused }) => <TabIcon symbol="♥" focused={focused} label="Favorites" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon symbol="◯" focused={focused} label="Profile" />,
        }}
      />
    </Tabs>
  );
}
