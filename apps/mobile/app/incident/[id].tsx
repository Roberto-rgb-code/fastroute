import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, IncidentReason } from '../../src/api';
import { Button, Card } from '../../src/components/ui';
import { chooseImage, currentCoords } from '../../src/media';
import { theme } from '../../src/theme';

const REASONS: { key: IncidentReason; label: string }[] = [
  { key: 'CAR_ACCIDENT', label: 'Accidente' },
  { key: 'HOSPITAL', label: 'Hospital' },
  { key: 'WC', label: 'Baño' },
  { key: 'RESTAURANT', label: 'Comida' },
  { key: 'PARKING', label: 'Estacionamiento' },
  { key: 'TRAFFIC', label: 'Tráfico' },
  { key: 'GAS', label: 'Gasolina' },
  { key: 'ROBBERY', label: 'Robo' },
  { key: 'OTHER', label: 'Otro' },
];

export default function IncidentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [reason, setReason] = useState<IncidentReason>('OTHER');
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const addPhoto = async () => {
    if (photos.length >= 5) return;
    const uri = await chooseImage();
    if (uri) setPhotos((p) => [...p, uri]);
  };

  const submit = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const coords = await currentCoords();
      await api.addIncident(id, {
        reason,
        comment: comment.trim() || undefined,
        photos,
        lat: coords.lat,
        lng: coords.lng,
      });
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Card>
        <Text style={styles.title}>Reportar incidencia</Text>
        <View style={styles.chips}>
          {REASONS.map((r) => (
            <TouchableOpacity key={r.key} style={[styles.chip, reason === r.key && styles.chipOn]} onPress={() => setReason(r.key)}>
              <Text style={[styles.chipText, reason === r.key && { color: '#fff' }]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Comentario (opcional)"
          value={comment}
          onChangeText={setComment}
          multiline
          placeholderTextColor={theme.ink400}
        />
        <View style={styles.photoRow}>
          {photos.map((p, i) => (
            <Image key={i} source={{ uri: p }} style={styles.thumb} />
          ))}
          {photos.length < 5 && (
            <TouchableOpacity style={styles.addPhoto} onPress={addPhoto}>
              <Text style={{ fontSize: 22, color: theme.ink400 }}>＋</Text>
            </TouchableOpacity>
          )}
        </View>
        <Button title="Enviar incidencia" variant="danger" onPress={submit} loading={busy} style={{ marginTop: 4 }} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.ink50 },
  title: { fontSize: 16, fontWeight: '800', color: theme.ink900, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: theme.ink200, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: theme.danger, borderColor: theme.danger },
  chipText: { fontSize: 12, color: theme.ink700, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: theme.ink200,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 70,
    fontSize: 14,
    color: theme.ink900,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
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
