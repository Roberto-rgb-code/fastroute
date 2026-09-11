import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/auth';
import { theme } from '../src/theme';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.ink50 }}>
        <ActivityIndicator size="large" color={theme.brand} />
      </View>
    );
  }

  return <Redirect href={user ? '/routes' : '/login'} />;
}
