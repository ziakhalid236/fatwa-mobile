import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useApp, API_BASE_URL } from '@/lib/store';
import { uiStyles } from '@/components/ui';

type Message = { id: string; role: 'user' | 'assistant'; text: string };

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  text: 'السلام علیکم۔ اپنا سوال لکھیں، میں سمجھ کر اسی زبان میں جواب دوں گا جس میں آپ لکھیں گے۔',
};

export default function QuestionsScreen({ askSignal = 0 }: { askSignal?: number }) {
  const colors = useColors();
  const { profile, settings } = useApp();
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lastSignal = useRef(askSignal);

  useEffect(() => {
    if (askSignal > 0 && askSignal !== lastSignal.current) {
      lastSignal.current = askSignal;
      setInput('');
    }
  }, [askSignal]);

  const send = async () => {
    const message = input.trim();
    if (!message || busy) return;
    setError('');
    setInput('');
    const userMessage: Message = { id: `${Date.now()}-user`, role: 'user', text: message };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          // Exclude the message we are about to send; the Worker appends it.
          history: messages.slice(-8).map(({ role, text }) => ({ role, content: text })),
          language: settings.language,
          name: profile.name.trim() || undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { answer?: string; error?: string };
      if (!response.ok || !payload.answer) throw new Error(payload.error ?? 'جواب حاصل نہیں ہو سکا۔');
      setMessages((current) => [...current, { id: `${Date.now()}-assistant`, role: 'assistant', text: payload.answer! }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'براہ کرم دوبارہ کوشش کریں۔');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={uiStyles.screenPadding}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>ISLAMIC GUIDANCE</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Ask your question</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Write in English, اردو or العربية. Answers are general guidance, not a formal fatwa.
        </Text>
      </View>

      <View style={styles.messages}>
        {messages.map((item) => (
          <View key={item.id} style={[styles.messageRow, item.role === 'user' && styles.userRow]}>
            {item.role === 'assistant' ? (
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <MaterialCommunityIcons name="book-open-page-variant" size={16} color="#FFFFFF" />
              </View>
            ) : null}
            <View style={[styles.bubble, item.role === 'user' ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.bubbleText, { color: item.role === 'user' ? colors.primaryForeground : colors.foreground }]}>{item.text}</Text>
            </View>
          </View>
        ))}
        {busy ? (
          <View style={styles.messageRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <MaterialCommunityIcons name="book-open-page-variant" size={16} color="#FFFFFF" />
            </View>
            <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          </View>
        ) : null}
      </View>

      {error ? <Text style={[styles.error, { color: colors.coral }]}>{error}</Text> : null}

      <View style={[styles.composer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="اپنا سوال لکھیں…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { color: colors.foreground }]}
          multiline
          maxLength={4000}
          textAlignVertical="top"
          onSubmitEditing={() => void send()}
        />
        <Pressable
          onPress={() => void send()}
          disabled={!input.trim() || busy}
          style={[styles.send, { backgroundColor: input.trim() && !busy ? colors.primary : colors.muted }]}
          accessibilityRole="button"
          accessibilityLabel="Send question"
        >
          <Feather name="send" size={17} color="#FFFFFF" />
        </Pressable>
      </View>
      <Text style={[styles.footer, { color: colors.mutedForeground }]}>
        جواب کو official fatwa نہ سمجھیں۔ شائع شدہ فتوے Fatwa tab میں الگ دکھائے جاتے ہیں۔
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: 10, marginBottom: 18 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 7 },
  title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 7 },
  messages: { gap: 12, marginBottom: 12 },
  messageRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', maxWidth: '94%' },
  userRow: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatar: { width: 29, height: 29, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  bubble: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, maxWidth: '88%' },
  bubbleText: { fontSize: 13.5, lineHeight: 22 },
  composer: { minHeight: 76, borderWidth: 1, borderRadius: 20, padding: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 52, maxHeight: 120, fontSize: 13.5, lineHeight: 21, paddingHorizontal: 4, paddingTop: 7 },
  send: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: 12, lineHeight: 18, marginBottom: 8 },
  footer: { textAlign: 'center', fontSize: 10.5, lineHeight: 16, marginTop: 12, paddingHorizontal: 12 },
});
