import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, DeliverStatus, RouteDetail, RouteStatus } from '../../src/api';
import { Badge, Button, Card } from '../../src/components/ui';
import { chooseImage, currentCoords } from '../../src/media';
import { estimateLegMinutes, formatEta, optimizeStopOrder } from '../../src/routeOptimizer';
import { theme } from '../../src/theme';

const DELIVER_OPTS: { key: DeliverStatus; label: string; variant: 'ok' | 'warn' | 'danger' }[] = [
  { key: 'DELIVERED', label: 'Entregado', variant: 'ok' },
  { key: 'PARTIAL', label: 'Parcial', variant: 'warn' },
  { key: 'NOTDELIVERED', label: 'No entregado', variant: 'danger' },
];

export default function RouteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [busy, setBusy] = useState(false);

  // Modales
  const [startOpen, setStartOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [evidenceFor, setEvidenceFor] = useState<string | null>(null);

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

  const toggle = async (itemId: string, done: boolean, needsPhoto: boolean) => {
    let photoUrl: string | undefined;
    if (done && needsPhoto) {
      const uri = await chooseImage();
      if (!uri) return;
      photoUrl = uri;
    }
    setRoute(await api.toggleChecklist(route.id, itemId, done, photoUrl));
  };

  const doneCount = route.events.filter((e) => e.status === 'COMPLETED').length;
  const checklistPending = route.checklist.some((c) => c.required && !c.done);
  const allStopsDone = route.events.length > 0 && doneCount === route.events.length;

  const optimizedPlan = useMemo(() => optimizeStopOrder(route.events), [route.events]);
  const nextStopId = optimizedPlan.find((e) => e.status !== 'COMPLETED')?.id;

  const applyOptimizedOrder = async () => {
    setBusy(true);
    try {
      setRoute(await api.reorderStops(route.id, optimizedPlan.map((e) => e.id)));
    } catch (err) {
      Alert.alert('No se pudo optimizar', String(err));
    } finally {
      setBusy(false);
    }
  };

  const renderActions = () => {
    switch (route.status) {
      case 'PENDING':
        return <Button title="Iniciar checklist" onPress={() => changeStatus('CHECKLIST')} loading={busy} />;
      case 'CHECKLIST':
      case 'CHECKLIST_PENDING':
        return (
          <Button
            title={checklistPending ? 'Completa el checklist obligatorio' : 'Registrar km/gas e iniciar'}
            onPress={() => setStartOpen(true)}
            disabled={checklistPending}
            variant="ok"
            loading={busy}
          />
        );
      case 'ENROUTE':
        return (
          <View style={{ gap: 8 }}>
            <Button
              title="Cerrar destino (km/gas final)"
              variant="ok"
              onPress={() => setCloseOpen(true)}
              loading={busy}
            />
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
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push(`/chat/${route.id}`)}>
            <Text style={styles.quickText}>💬 Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push(`/expenses/${route.id}`)}>
            <Text style={styles.quickText}>🧾 Gastos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickBtn, styles.quickDanger]} onPress={() => router.push(`/incident/${route.id}`)}>
            <Text style={[styles.quickText, { color: theme.danger }]}>⚠️ Incidencia</Text>
          </TouchableOpacity>
        </View>
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
            <TouchableOpacity key={c.id} style={styles.checkItem} onPress={() => toggle(c.id, !c.done, c.photo)}>
              <View style={[styles.checkbox, c.done && styles.checkboxOn]}>
                {c.done && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>{c.label}</Text>
              {c.photo && <Text style={styles.photoTag}>📷</Text>}
              {c.required && <Text style={styles.req}>Obligatorio</Text>}
            </TouchableOpacity>
          ))}
        </Card>
      )}

      <View>
        <Text style={styles.sectionTitle}>Plan optimizado</Text>
        <Card>
          <Text style={styles.planHint}>
            Orden sugerido por prioridad y hora objetivo (ETA). La ruta más corta en tiempo operativo.
          </Text>
          {optimizedPlan.map((e, idx) => {
            const completed = e.status === 'COMPLETED';
            const isNext = e.id === nextStopId;
            const etaMin = estimateLegMinutes(route.totalDuration, route.events.length, idx);
            return (
              <View key={e.id} style={[styles.planRow, isNext && styles.planRowNext]}>
                <View style={[styles.planSeq, completed && styles.posDone, isNext && styles.planSeqNext]}>
                  <Text style={[styles.planSeqText, (completed || isNext) && { color: '#fff' }]}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopLabel}>{e.stop.label}</Text>
                  <Text style={styles.stopAddr}>
                    {formatEta(e.eta)}
                    {etaMin != null ? ` · ~${etaMin} min` : ''}
                    {e.priority === 'URGENT' ? ' · Urgente' : ''}
                  </Text>
                </View>
                {isNext && !completed && route.status === 'ENROUTE' ? (
                  <Text style={styles.nextBadge}>Siguiente</Text>
                ) : null}
              </View>
            );
          })}
          {['ENROUTE', 'PAUSED', 'CHECKLIST', 'CHECKLIST_PENDING', 'PENDING'].includes(route.status) && (
            <Button
              title="Aplicar este orden en la ruta"
              variant="ghost"
              onPress={applyOptimizedOrder}
              loading={busy}
              style={{ marginTop: 12 }}
            />
          )}
        </Card>
      </View>

      <View>
        <Text style={styles.sectionTitle}>Paradas</Text>
        {optimizedPlan.map((e, idx) => {
          const completed = e.status === 'COMPLETED';
          return (
            <Card key={e.id} style={{ marginTop: 10, borderColor: e.id === nextStopId ? theme.brand : theme.ink200, borderWidth: e.id === nextStopId ? 2 : 1 }}>
              <View style={styles.stopRow}>
                <View style={[styles.pos, completed && styles.posDone, e.id === nextStopId && !completed && styles.posNext]}>
                  <Text style={[styles.posText, (completed || e.id === nextStopId) && { color: '#fff' }]}>
                    {completed ? '✓' : idx + 1}
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
                  title="Registrar evidencia"
                  variant="ok"
                  onPress={() => setEvidenceFor(e.id)}
                  style={{ marginTop: 12 }}
                />
              )}
            </Card>
          );
        })}
      </View>

      <View style={{ marginTop: 4, marginBottom: 30 }}>
        {renderActions()}
        {route.status === 'ENROUTE' && !allStopsDone && (
          <Text style={styles.hint}>Registra la evidencia de cada parada antes de cerrar el destino.</Text>
        )}
      </View>

      {/* Modal: checklist de salida (km/gas inicial) */}
      <StartModal
        visible={startOpen}
        onClose={() => setStartOpen(false)}
        onDone={(r) => {
          setRoute(r);
          setStartOpen(false);
        }}
        routeId={route.id}
      />

      {/* Modal: cierre de destino (km/gas final) */}
      <CloseModal
        visible={closeOpen}
        onClose={() => setCloseOpen(false)}
        onDone={(r) => {
          setRoute(r);
          setCloseOpen(false);
        }}
        routeId={route.id}
      />

      {/* Modal: evidencia de parada */}
      <EvidenceModal
        visible={!!evidenceFor}
        onClose={() => setEvidenceFor(null)}
        onDone={(r) => {
          setRoute(r);
          setEvidenceFor(null);
        }}
        routeId={route.id}
        eventId={evidenceFor}
      />
    </ScrollView>
  );
}

// ─────────────────────────── Modales ───────────────────────────

function StartModal({
  visible,
  onClose,
  onDone,
  routeId,
}: {
  visible: boolean;
  onClose: () => void;
  onDone: (r: RouteDetail) => void;
  routeId: string;
}) {
  const [km, setKm] = useState('');
  const [gas, setGas] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!km || !gas) return;
    setBusy(true);
    try {
      const coords = await currentCoords();
      const r = await api.startRoute(routeId, {
        kmInitial: Number(km),
        gasInitial: Number(gas),
        lat: coords.lat,
        lng: coords.lng,
      });
      onDone(r);
      setKm('');
      setGas('');
    } catch (err) {
      Alert.alert('No se pudo iniciar', String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetModal visible={visible} onClose={onClose} title="Checklist de salida">
      <Text style={styles.fieldLabel}>Kilómetros iniciales</Text>
      <TextInput style={styles.modalInput} value={km} onChangeText={setKm} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.ink400} />
      <Text style={styles.fieldLabel}>Gasolina inicial (%)</Text>
      <TextInput style={styles.modalInput} value={gas} onChangeText={setGas} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.ink400} />
      <Button title="Iniciar ruta" variant="ok" onPress={submit} loading={busy} disabled={!km || !gas} style={{ marginTop: 8 }} />
    </SheetModal>
  );
}

function CloseModal({
  visible,
  onClose,
  onDone,
  routeId,
}: {
  visible: boolean;
  onClose: () => void;
  onDone: (r: RouteDetail) => void;
  routeId: string;
}) {
  const [km, setKm] = useState('');
  const [gas, setGas] = useState('');
  const [img, setImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!km || !gas) return;
    setBusy(true);
    try {
      const coords = await currentCoords();
      const r = await api.closeDestination(routeId, {
        kmFinal: Number(km),
        gasFinal: Number(gas),
        finalImg: img ?? undefined,
        finalLat: coords.lat,
        finalLng: coords.lng,
      });
      onDone(r);
      setKm('');
      setGas('');
      setImg(null);
    } catch (err) {
      Alert.alert('No se pudo cerrar', String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetModal visible={visible} onClose={onClose} title="Cierre de destino">
      <Text style={styles.fieldLabel}>Kilómetros finales</Text>
      <TextInput style={styles.modalInput} value={km} onChangeText={setKm} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.ink400} />
      <Text style={styles.fieldLabel}>Gasolina final (%)</Text>
      <TextInput style={styles.modalInput} value={gas} onChangeText={setGas} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={theme.ink400} />
      <TouchableOpacity style={styles.photoBtn} onPress={async () => setImg((await chooseImage()) ?? img)}>
        {img ? <Image source={{ uri: img }} style={styles.preview} /> : <Text style={styles.photoText}>📷 Foto/firma de cierre (opcional)</Text>}
      </TouchableOpacity>
      <Button title="Cerrar destino" variant="ok" onPress={submit} loading={busy} disabled={!km || !gas} style={{ marginTop: 4 }} />
    </SheetModal>
  );
}

function EvidenceModal({
  visible,
  onClose,
  onDone,
  routeId,
  eventId,
}: {
  visible: boolean;
  onClose: () => void;
  onDone: (r: RouteDetail) => void;
  routeId: string;
  eventId: string | null;
}) {
  const [images, setImages] = useState<string[]>([]);
  const [deliver, setDeliver] = useState<DeliverStatus>('DELIVERED');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const addPhoto = async () => {
    const uri = await chooseImage();
    if (uri) setImages((p) => [...p, uri]);
  };

  const submit = async () => {
    if (!eventId) return;
    setBusy(true);
    try {
      const coords = await currentCoords();
      const r = await api.submitEvidence(routeId, eventId, {
        images,
        deliverStatus: deliver,
        comment: comment.trim() || undefined,
        evLat: coords.lat,
        evLng: coords.lng,
      });
      onDone(r);
      setImages([]);
      setComment('');
      setDeliver('DELIVERED');
    } catch (err) {
      Alert.alert('No se pudo registrar', String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetModal visible={visible} onClose={onClose} title="Evidencia de parada">
      <View style={styles.deliverRow}>
        {DELIVER_OPTS.map((o) => (
          <TouchableOpacity
            key={o.key}
            style={[styles.deliverChip, deliver === o.key && styles.deliverChipOn]}
            onPress={() => setDeliver(o.key)}
          >
            <Text style={[styles.deliverText, deliver === o.key && { color: '#fff' }]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.photoRow}>
        {images.map((p, i) => (
          <Image key={i} source={{ uri: p }} style={styles.thumb} />
        ))}
        <TouchableOpacity style={styles.addPhoto} onPress={addPhoto}>
          <Text style={{ fontSize: 22, color: theme.ink400 }}>＋</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={[styles.modalInput, { minHeight: 60, textAlignVertical: 'top' }]}
        value={comment}
        onChangeText={setComment}
        placeholder="Comentario (opcional)"
        placeholderTextColor={theme.ink400}
        multiline
      />
      <Button title="Guardar evidencia" variant="ok" onPress={submit} loading={busy} style={{ marginTop: 4 }} />
    </SheetModal>
  );
}

function SheetModal({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.sheetClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.ink50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.ink50 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: theme.ink900, flex: 1, marginRight: 8 },
  meta: { color: theme.ink500, fontSize: 13, marginTop: 6 },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  quickBtn: { backgroundColor: theme.brand50, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  quickDanger: { backgroundColor: theme.dangerBg },
  quickText: { color: theme.brand, fontWeight: '700', fontSize: 12 },
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
  photoTag: { fontSize: 13 },
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
  planHint: { fontSize: 12, color: theme.ink500, marginBottom: 10, lineHeight: 18 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.ink100 },
  planRowNext: { backgroundColor: theme.brand50, marginHorizontal: -12, paddingHorizontal: 12, borderRadius: 10 },
  planSeq: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.ink100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planSeqNext: { backgroundColor: theme.brand },
  planSeqText: { fontSize: 12, fontWeight: '800', color: theme.ink700 },
  nextBadge: { fontSize: 10, fontWeight: '800', color: theme.brand, textTransform: 'uppercase' },
  posNext: { backgroundColor: theme.brand },
  hint: { fontSize: 12, color: theme.ink400, marginTop: 8, textAlign: 'center' },
  // modal
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '85%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: theme.ink900 },
  sheetClose: { fontSize: 18, color: theme.ink400, padding: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: theme.ink700, marginBottom: 6 },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.ink200,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.ink900,
    marginBottom: 12,
  },
  photoBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.ink200,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginBottom: 12,
  },
  photoText: { color: theme.ink500, fontSize: 13 },
  preview: { width: '100%', height: 140, borderRadius: 8 },
  deliverRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  deliverChip: { flex: 1, borderWidth: 1, borderColor: theme.ink200, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  deliverChipOn: { backgroundColor: theme.brand, borderColor: theme.brand },
  deliverText: { fontSize: 12, fontWeight: '700', color: theme.ink700 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  thumb: { width: 60, height: 60, borderRadius: 8, backgroundColor: theme.ink100 },
  addPhoto: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.ink200,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
