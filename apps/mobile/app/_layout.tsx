import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/auth';
import { theme } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: theme.ink900,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: theme.ink50 },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="routes" options={{ title: 'Mis rutas' }} />
          <Stack.Screen name="route/[id]" options={{ title: 'Ruta' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
