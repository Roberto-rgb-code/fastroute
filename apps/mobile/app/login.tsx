import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth';
import { Button } from '../src/components/ui';
import { theme } from '../src/theme';

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('conductor@demo-logistica.local');
  const [password, setPassword] = useState('Driver123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/routes');
    } catch {
      setError('Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.hero, { paddingTop: insets.top + 40 }]}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>FR</Text>
        </View>
        <Text style={styles.title}>FastRoute</Text>
        <Text style={styles.subtitle}>App de conductores</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="tu@correo.com"
        />
        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Button title="Entrar" onPress={submit} loading={loading} style={{ marginTop: 8 }} />
        <TouchableOpacity onPress={() => setPassword('Driver123!')}>
          <Text style={styles.hint}>Demo: conductor@demo-logistica.local / Driver123!</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  hero: {
    backgroundColor: theme.brand,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    alignItems: 'center',
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginTop: 4 },
  form: { padding: 24, gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: theme.ink700, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: theme.ink200,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { color: theme.danger, fontSize: 13, marginTop: 8 },
  hint: { color: theme.ink400, fontSize: 12, textAlign: 'center', marginTop: 16 },
});
