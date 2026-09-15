import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, Message } from '../../src/api';
import { theme } from '../../src/theme';

/** Chat del conductor con la central (web). Realtime por polling ligero. */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!id) return;
      if (!silent) setLoading(true);
      try {
        const msgs = await api.messages(id);
        setMessages((prev) => (prev.length === msgs.length && silent ? prev : msgs));
        api.markMessagesRead(id).catch(() => undefined);
      } catch {
        /* ignore */
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 6000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending || !id) return;
    setSending(true);
    try {
      const msg = await api.sendMessage(id, body);
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setDraft('');
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: Message }) => {
    const mine = item.sender === 'DRIVER';
    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={[styles.body, mine && { color: '#fff' }]}>{item.body}</Text>
          <Text style={[styles.time, mine ? { color: '#e0e7ff' } : { color: theme.ink400 }]}>
            {mine ? 'Yo' : (item.user?.name ?? 'Central')} ·{' '}
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.brand} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          ListEmptyComponent={
            <Text style={styles.empty}>Aún no hay mensajes. Escribe a la central.</Text>
          }
        />
      )}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Mensaje a la central…"
          placeholderTextColor={theme.ink400}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.4 }]}
          onPress={send}
          disabled={!draft.trim() || sending}
        >
          <Text style={styles.sendText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.ink50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', color: theme.ink400, marginTop: 40, fontSize: 13 },
  row: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: theme.brand },
  bubbleOther: { backgroundColor: '#fff', borderWidth: 1, borderColor: theme.ink200 },
  body: { fontSize: 14, color: theme.ink900 },
  time: { fontSize: 10, marginTop: 3 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: theme.ink200,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 42,
    borderWidth: 1,
    borderColor: theme.ink200,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.ink900,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: theme.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
