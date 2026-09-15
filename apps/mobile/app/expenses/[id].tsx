import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, Expense } from '../../src/api';
import { Button, Card } from '../../src/components/ui';
import { chooseImage } from '../../src/media';
import { theme } from '../../src/theme';

const PAYMENT_TYPES = ['Efectivo', 'Tarjeta', 'Transferencia', 'Vale'];

export default function ExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [concept, setConcept] = useState('');
  const [paymentType, setPaymentType] = useState(PAYMENT_TYPES[0]);
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const route = await api.route(id);
    setExpenses(route.expenses ?? []);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const addImage = async () => {
    const uri = await chooseImage();
    if (uri) setImage(uri);
  };

  const save = async () => {
    if (!id || !concept.trim() || !amount || !image) return;
    setBusy(true);
    try {
      const route = await api.saveExpense(id, {
        concept: concept.trim(),
        paymentType,
        amount: Number(amount),
        comment: comment.trim() || undefined,
        imageUrl: image,
      });
      setExpenses(route.expenses ?? []);
      setConcept('');
      setAmount('');
      setComment('');
      setImage(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Card>
        <Text style={styles.title}>Nuevo gasto</Text>
        <TextInput style={styles.input} placeholder="Concepto" value={concept} onChangeText={setConcept} placeholderTextColor={theme.ink400} />
        <View style={styles.chips}>
          {PAYMENT_TYPES.map((p) => (
            <TouchableOpacity key={p} style={[styles.chip, paymentType === p && styles.chipOn]} onPress={() => setPaymentType(p)}>
              <Text style={[styles.chipText, paymentType === p && { color: '#fff' }]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={styles.input} placeholder="Monto" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor={theme.ink400} />
        <TextInput style={styles.input} placeholder="Comentario (opcional)" value={comment} onChangeText={setComment} placeholderTextColor={theme.ink400} />
        <TouchableOpacity style={styles.photoBtn} onPress={addImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.preview} />
          ) : (
            <Text style={styles.photoText}>📷  Comprobante (requerido)</Text>
          )}
        </TouchableOpacity>
        <Button title="Guardar gasto" onPress={save} loading={busy} disabled={!concept.trim() || !amount || !image} style={{ marginTop: 4 }} />
      </Card>

      <Text style={styles.sectionTitle}>Gastos registrados</Text>
      {expenses.length === 0 && <Text style={styles.empty}>Aún no hay gastos.</Text>}
      {expenses.map((e) => (
        <Card key={e.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Image source={{ uri: e.imageUrl }} style={styles.thumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.expConcept}>{e.concept}</Text>
            <Text style={styles.expMeta}>{e.paymentType} · {e.status}</Text>
          </View>
          <Text style={styles.expAmount}>${e.amount.toFixed(2)}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.ink50 },
  title: { fontSize: 16, fontWeight: '800', color: theme.ink900, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.ink900, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: theme.ink200,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.ink900,
    marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { borderWidth: 1, borderColor: theme.ink200, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: theme.brand, borderColor: theme.brand },
  chipText: { fontSize: 12, color: theme.ink700, fontWeight: '600' },
  photoBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.ink200,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginBottom: 8,
  },
  photoText: { color: theme.ink500, fontSize: 13 },
  preview: { width: '100%', height: 140, borderRadius: 8 },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: theme.ink100 },
  expConcept: { fontSize: 14, fontWeight: '600', color: theme.ink900 },
  expMeta: { fontSize: 12, color: theme.ink500 },
  expAmount: { fontSize: 15, fontWeight: '800', color: theme.ink900 },
  empty: { color: theme.ink400, fontSize: 13 },
});
