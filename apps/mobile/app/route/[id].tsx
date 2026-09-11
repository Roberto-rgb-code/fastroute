import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, RouteDetail, RouteStatus } from '../../src/api';
import { Badge, Button, Card } from '../../src/components/ui';
import { theme } from '../../src/theme';

export default function RouteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setRoute(await api.route(id));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const publishLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({});
      await api.publishLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, routeId: id });
    } catch {
      /* location optional */
    }
  }, [id]);

  // Periodically publish location while enroute
  useEffect(() => {
    if (route?.status !== 'ENROUTE') return;
    publishLocation();
    const t = setInterval(publishLocation, 20000);
    return () => clearInterval(t);
  }, [route?.status, publishLocation]);

  if (!route) {
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.ink500 }}>Cargando…</Text>
      </View>
    );
  }

  const changeStatus = async (status: RouteStatus) => {
    setBusy(true);
    try {
      setRoute(await api.changeStatus(route.id, status));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (itemId: string, done: boolean) => {
    setRoute(await api.toggleChecklist(route.id, itemId, done));
  };

  const completeStop = (eventId: string) => {
    Alert.alert('Confirmar entrega', '¿Marcar esta parada como entregada?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Entregar',
        onPress: async () => {
          let coords: { evLat?: number; evLng?: number } = {};
          try {
            const pos = await Location.getCurrentPositionAsync({});
            coords = { evLat: pos.coords.latitude, evLng: pos.coords.longitude };
          } catch {
            /* optional */
          }
          setRoute(await api.completeStop(route.id, eventId, { deliverStatus: 'DELIVERED', ...coords }));
        },
      },
    ]);
  };

  const doneCount = route.events.filter((e) => e.status === 'COMPLETED').length;
  const checklistPending = route.checklist.some((c) => c.required && !c.done);

  const renderActions = () => {
    switch (route.status) {
      case 'PENDING':
        return <Button title="Iniciar checklist" onPress={() => changeStatus('CHECKLIST')} loading={busy} />;
      case 'CHECKLIST':
      case 'CHECKLIST_PENDING':
        return (
          <Button
            title={checklistPending ? 'Completa el checklist obligatorio' : 'Iniciar ruta'}
            onPress={() => changeStatus('ENROUTE')}
            disabled={checklistPending}
            variant="ok"
            loading={busy}
          />
        );
      case 'ENROUTE':
        return (
          <View style={{ gap: 8 }}>
            <Button title="Finalizar ruta" onPress={() => changeStatus('FINISHED')} loading={busy} />
            <Button title="Pausar" variant="ghost" onPress={() => changeStatus('PAUSED')} />
          </View>
        );
      case 'PAUSED':
        return <Button title="Reanudar" onPress={() => changeStatus('ENROUTE')} loading={busy} />;
      default:
        return null;
    }
  };

  const showChecklist = ['CHECKLIST', 'CHECKLIST_PENDING', 'PENDING'].includes(route.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{route.name}</Text>
          <Badge status={route.status} />
        </View>
        <Text style={styles.meta}>
          {route.vehicle?.plate ?? 'Sin vehículo'} · {route.client?.name ?? 'Sin cliente'}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{doneCount}/{route.events.length}</Text>
            <Text style={styles.statLabel}>Paradas</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {route.totalDistance ? (route.totalDistance / 1000).toFixed(1) + 'km' : '—'}
            </Text>
            <Text style={styles.statLabel}>Distancia</Text>
          </View>
        </View>
      </Card>

      {showChecklist && route.checklist.length > 0 && (
        <Card>
          <Text style={styles.sectionTitle}>Checklist pre-ruta</Text>
          {route.checklist.map((c) => (
            <TouchableOpacity key={c.id} style={styles.checkItem} onPress={() => toggle(c.id, !c.done)}>
              <View style={[styles.checkbox, c.done && styles.checkboxOn]}>
                {c.done && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>{c.label}</Text>
              {c.required && <Text style={styles.req}>Obligatorio</Text>}
            </TouchableOpacity>
          ))}
        </Card>
      )}

      <View>
        <Text style={styles.sectionTitle}>Paradas</Text>
        {route.events.map((e) => {
          const completed = e.status === 'COMPLETED';
          return (
            <Card key={e.id} style={{ marginTop: 10 }}>
              <View style={styles.stopRow}>
                <View style={[styles.pos, completed && styles.posDone]}>
                  <Text style={[styles.posText, completed && { color: '#fff' }]}>
                    {completed ? '✓' : e.position}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopLabel}>{e.stop.label}</Text>
                  <Text style={styles.stopAddr}>{e.stop.address}</Text>
                </View>
                {e.priority === 'URGENT' && <Text style={styles.urgent}>Urgente</Text>}
              </View>
              {route.status === 'ENROUTE' && !completed && (
                <Button
                  title="Marcar entregada"
                  variant="ok"
                  onPress={() => completeStop(e.id)}
                  style={{ marginTop: 12 }}
                />
              )}
            </Card>
          );
        })}
      </View>

      <View style={{ marginTop: 4, marginBottom: 30 }}>{renderActions()}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.ink50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.ink50 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: theme.ink900, flex: 1, marginRight: 8 },
  meta: { color: theme.ink500, fontSize: 13, marginTop: 6 },
  statsRow: { flexDirection: 'row', gap: 24, marginTop: 14 },
  stat: {},
  statValue: { fontSize: 20, fontWeight: '800', color: theme.ink900 },
  statLabel: { fontSize: 12, color: theme.ink500 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.ink900, marginBottom: 4 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: theme.ink200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: theme.ok, borderColor: theme.ok },
  checkMark: { color: '#fff', fontWeight: '800', fontSize: 13 },
  checkLabel: { flex: 1, fontSize: 14, color: theme.ink900 },
  req: { fontSize: 11, color: theme.warn, fontWeight: '700' },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pos: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posDone: { backgroundColor: theme.ok },
  posText: { fontWeight: '800', color: theme.brand },
  stopLabel: { fontSize: 15, fontWeight: '600', color: theme.ink900 },
  stopAddr: { fontSize: 13, color: theme.ink500 },
  urgent: { fontSize: 11, color: theme.danger, fontWeight: '700' },
});
