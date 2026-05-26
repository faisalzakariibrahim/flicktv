import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { api } from '../lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function AIScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', content: "Hi! I'm Flick AI. I can help you find channels, fix streams, or give you recommendations. What are you looking for?" },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const listRef = useRef<FlatList>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.ai.chat(text, sessionId);
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: res.message };
      setMessages(m => [...m, aiMsg]);
      if (res.sessionId) setSessionId(res.sessionId);
    } catch (e: any) {
      setMessages(m => [...m, { id: Date.now().toString(), role: 'assistant', content: 'Sorry, I had trouble responding. Please try again.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const QUICK = ['Find sports channels', 'Recommend something for me', 'Show news channels', 'Fix broken stream'];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>

        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>✦ Flick AI</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => listRef.current?.scrollToEnd()}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              {item.role === 'assistant' && <Text style={styles.aiLabel}>✦ Flick AI</Text>}
              <Text style={[styles.bubbleText, item.role === 'user' && styles.userText]}>{item.content}</Text>
            </View>
          )}
          ListFooterComponent={loading ? <ActivityIndicator color={theme.colors.accent} style={{ marginVertical: 8 }} /> : null}
        />

        {/* Quick suggestions */}
        {messages.length <= 1 && (
          <FlatList
            horizontal
            data={QUICK}
            keyExtractor={i => i}
            contentContainerStyle={styles.quickRow}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable style={styles.quickChip} onPress={() => { setInput(item); }}>
                <Text style={styles.quickText}>{item}</Text>
              </Pressable>
            )}
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask Flick AI anything..."
            placeholderTextColor={theme.colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <Pressable style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]} onPress={send} disabled={!input.trim() || loading}>
            <Text style={styles.sendIcon}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  close: { color: theme.colors.textMuted, fontSize: theme.fontSize.lg, width: 32 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { color: theme.colors.accent, fontSize: theme.fontSize.lg, fontWeight: '700' },
  messages: { padding: theme.spacing.md, paddingBottom: theme.spacing.sm },
  bubble: { maxWidth: '80%', borderRadius: theme.radius.lg, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  aiBubble: { backgroundColor: theme.colors.surface, alignSelf: 'flex-start' },
  userBubble: { backgroundColor: theme.colors.accent, alignSelf: 'flex-end' },
  aiLabel: { color: theme.colors.accent, fontSize: theme.fontSize.xs, fontWeight: '700', marginBottom: 4 },
  bubbleText: { color: theme.colors.text, fontSize: theme.fontSize.md, lineHeight: 22 },
  userText: { color: '#000' },
  quickRow: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm },
  quickChip: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.full, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, marginRight: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border },
  quickText: { color: theme.colors.textSecondary, fontSize: theme.fontSize.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border },
  input: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.text, fontSize: theme.fontSize.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, maxHeight: 120, marginRight: theme.spacing.sm },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.accent, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: '#000', fontSize: theme.fontSize.lg, fontWeight: '700' },
});
