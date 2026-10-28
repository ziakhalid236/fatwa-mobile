import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useApp, API_BASE_URL } from '@/lib/store';
import { uiStyles } from '@/components/ui';

type Message = { id: string; role: 'user' | 'assistant'; text: string };

export default function QuestionsScreen({ askSignal = 0 }: { askSignal?: number }) {
  const colors = useColors();
  const { profile } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'السلام علیکم۔ میں اسلامی رہنمائی کے لیے حاضر ہوں۔ اپنا سوال لکھیں؛ میں فقہ حنفی اور علمائے دیوبند کے اصولوں کے مطابق عمومی جواب دوں گا۔ یہ چیٹ باقاعدہ فتویٰ نہیں ہے۔',
    },
  ]);
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
          history: nextMessages.slice(-8).map(({ role, text }) => ({ role, content: text })),
          language: 'ur',
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
      <View style={[styles.hero, { backgroundColor: colors.forest }]}>
        <View style={styles.heroIcon}><MaterialCommunityIcons name="chat-processing-outline" size={23} color={colors.gold} /></View>
        <Text style={styles.heroEyebrow}>ISLAMIC GUIDANCE</Text>
        <Text style={styles.heroTitle}>Ask your question</Text>
        <Text style={styles.heroCopy}>A private conversation for general Islamic guidance. Official fatwas are published separately by the admin team.</Text>
      </View>

      <View style={styles.notice}>
        <Feather name="info" size={15} color={colors.primary} />
        <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>چیٹ کا جواب عمومی رہنمائی ہے؛ ذاتی یا حساس معاملے میں مستند مفتی سے رجوع کریں۔</Text>
      </View>

      <View style={styles.messages}>
        {messages.map((item) => (
          <View key={item.id} style={[styles.messageRow, item.role === 'user' && styles.userRow]}>
            {item.role === 'assistant' ? <View style={[styles.avatar, { backgroundColor: colors.primary }]}><MaterialCommunityIcons name="book-open-page-variant" size={16} color="#FFFFFF" /></View> : null}
            <View style={[styles.bubble, item.role === 'user' ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.bubbleText, { color: item.role === 'user' ? colors.primaryForeground : colors.foreground }]}>{item.text}</Text>
            </View>
          </View>
        ))}
        {busy ? <View style={styles.messageRow}><View style={[styles.avatar, { backgroundColor: colors.primary }]}><MaterialCommunityIcons name="book-open-page-variant" size={16} color="#FFFFFF" /></View><View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border }]}><ActivityIndicator color={colors.primary} /></View></View> : null}
      </View>

      {error ? <Text style={[styles.error, { color: colors.coral }]}>{error}</Text> : null}
      <View style={[styles.composer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={`السلام علیکم ${profile.name ? profile.name : ''}، اپنا سوال لکھیں`}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { color: colors.foreground }]}
          multiline
          maxLength={4000}
          textAlignVertical="top"
          onSubmitEditing={() => void send()}
        />
        <Pressable onPress={() => void send()} disabled={!input.trim() || busy} style={[styles.send, { backgroundColor: input.trim() && !busy ? colors.primary : colors.muted }]} accessibilityRole="button" accessibilityLabel="Send question">
          <Feather name="send" size={17} color="#FFFFFF" />
        </Pressable>
      </View>
      <Text style={[styles.footer, { color: colors.mutedForeground }]}>جواب کو official fatwa نہ سمجھیں۔ شائع شدہ فتوے Fatwa tab میں الگ دکھائے جاتے ہیں۔</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 25, padding: 20, marginTop: 5, marginBottom: 14 },
  heroIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', marginBottom: 14 },
  heroEyebrow: { color: '#BFE6D2', fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  heroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 31, fontWeight: '800', marginTop: 6 },
  heroCopy: { color: '#D5E7DB', fontSize: 12.5, lineHeight: 19, marginTop: 8 },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 14, backgroundColor: '#EAF6F0', marginBottom: 16 },
  noticeText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
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
