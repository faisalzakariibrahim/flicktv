import { Tabs } from 'expo-router';
import { theme } from '../../constants/theme';

function TabIcon({ symbol, focused }: { symbol: string; focused: boolean }) {
  const { Text } = require('react-native');
  return (
    <Text style={{ fontSize: 20, color: focused ? theme.colors.accent : theme.colors.textMuted }}>
      {symbol}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          paddingBottom: 6,
          height: 60,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon symbol="⊞" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: 'Sports',
          tabBarIcon: ({ focused }) => <TabIcon symbol="⚽" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused }) => <TabIcon symbol="⌕" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorites',
          tabBarIcon: ({ focused }) => <TabIcon symbol="♥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon symbol="◯" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
