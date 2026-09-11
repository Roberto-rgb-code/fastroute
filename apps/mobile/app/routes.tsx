import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, RouteDetail } from '../src/api';
import { useAuth } from '../src/auth';
import { Badge } from '../src/components/ui';
import { theme } from '../src/theme';

export default function Routes() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [routes, setRoutes] = useState<RouteDetail[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setRoutes(await api.myRoutes());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const done = (r: RouteDetail) => r.events.filter((e) => e.status === 'COMPLETED').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hi}>Hola,</Text>
          <Text style={styles.name}>{user?.name ?? 'Conductor'}</Text>
        </View>
        <TouchableOpacity onPress={() => signOut().then(() => router.replace('/login'))}>
          <Text style={styles.logout}>Salir</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={routes}
        keyExtractor={(r) => r.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading ? 'Cargando rutas…' : 'No tienes rutas asignadas.'}
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.routeCard}
            onPress={() => router.push(`/route/${item.id}`)}
          >
            <View style={styles.routeTop}>
              <Text style={styles.routeName}>{item.name}</Text>
              <Badge status={item.status} />
            </View>
            <Text style={styles.routeMeta}>
              {item.vehicle?.plate ?? 'Sin vehículo'} · {item.client?.name ?? 'Sin cliente'}
            </Text>
            <View style={styles.progressRow}>
              <View style={styles.bar}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${item.events.length ? (done(item) / item.events.length) * 100 : 0}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {done(item)}/{item.events.length}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.ink50 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: theme.ink100,
  },
  hi: { color: theme.ink500, fontSize: 13 },
  name: { color: theme.ink900, fontSize: 18, fontWeight: '700' },
  logout: { color: theme.brand, fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  empty: { textAlign: 'center', color: theme.ink400, marginTop: 40 },
  routeCard: {
    backgroundColor: '#fff',
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.ink200,
    padding: 16,
    gap: 8,
  },
  routeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeName: { fontSize: 16, fontWeight: '700', color: theme.ink900, flex: 1, marginRight: 8 },
  routeMeta: { color: theme.ink500, fontSize: 13 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  bar: { flex: 1, height: 6, borderRadius: 999, backgroundColor: theme.ink100, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: theme.brand, borderRadius: 999 },
  progressText: { fontSize: 12, color: theme.ink500, fontWeight: '600' },
});
