import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { API_BASE_URL, useApp } from '@/lib/store';
import { containsArabic } from '@/lib/post-text';
import { uiStyles } from '@/components/ui';

type Source = { work: string; author?: string; ref?: string; source?: string; url?: string; snippet?: string };
type Message = { id: string; role: 'user' | 'assistant'; text: string; failed?: boolean; sources?: Source[] };

const CHAT_KEY = '@fatwa/chat-history';
const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  text: 'السلام علیکم! میں آپ کا اسلامی رہنمائی کا معاون ہوں۔ نماز، روزہ، زکوٰۃ، نکاح، معاملات یا کوئی بھی دینی سوال اپنی زبان میں پوچھیں۔',
};
const SUGGESTION_SETS = [
  ['زکوٰۃ کا نصاب اور شرح کیا ہے؟', 'روزہ ٹوٹنے کی کیا صورتیں ہیں؟', 'سجدہ سہو کیسے کریں؟'],
  ['نماز قصر کب اور کیسے ادا کی جاتی ہے؟', 'والدین کے حقوق کیا ہیں؟', 'صدقہ اور زکوٰۃ میں کیا فرق ہے؟'],
  ['تہجد کا بہترین وقت کون سا ہے؟', 'قرآن سمجھ کر پڑھنے کا طریقہ کیا ہے؟', 'سفر میں روزے کا کیا حکم ہے؟'],
  ['حلال کمائی کی اہمیت کیا ہے؟', 'نکاح کے بنیادی ارکان کون سے ہیں؟', 'استخارہ کیسے کیا جاتا ہے؟'],
];

// Reads a `data: {"t":"..."}` event stream and calls onText for every piece.
async function readStream(response: Response, onText: (piece: string) => void, onSources?: (sources: Source[]) => void): Promise<boolean> {
  const reader = response.body?.getReader?.();
  if (!reader) return false;
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const event = JSON.parse(data) as { t?: string; sources?: Source[] };
        if (event.t) onText(event.t);
        if (Array.isArray(event.sources) && event.sources.length) onSources?.(event.sources);
      } catch {
        // ignore partial frames
      }
    }
  }
  return true;
}

function Dots() {
  const colors = useColors();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => (value + 1) % 3), 380);
    return () => clearInterval(timer);
  }, []);
  return (
    <View style={styles.dots} accessibilityLabel="Thinking">
      {[0, 1, 2].map((index) => (
        <View key={index} style={[styles.dot, { backgroundColor: colors.primary, opacity: tick === index ? 1 : 0.25 }]} />
      ))}
    </View>
  );
}

export default function QuestionsScreen({ askSignal = 0 }: { askSignal?: number }) {
  const colors = useColors();
  const { profile, settings } = useApp();
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [openSource, setOpenSource] = useState<string | null>(null);
  const [openSourcesPanel, setOpenSourcesPanel] = useState<string | null>(null);
  const [suggestionSet, setSuggestionSet] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const abort = useRef<AbortController | null>(null);
  const lastSignal = useRef(askSignal);

  useEffect(() => {
    void AsyncStorage.getItem(CHAT_KEY).then((raw) => {
      try {
        const saved = raw ? (JSON.parse(raw) as Message[]) : [];
        if (Array.isArray(saved) && saved.length) setMessages(saved.filter((m) => m && typeof m.text === 'string' && !m.failed));
      } catch {
        // start fresh
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded || busy) return;
    void AsyncStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-40))).catch(() => undefined);
  }, [messages, loaded, busy]);

  useEffect(() => {
    if (askSignal > 0 && askSignal !== lastSignal.current) {
      lastSignal.current = askSignal;
      setInput('');
    }
  }, [askSignal]);

  useEffect(() => {
    const timer = setInterval(() => setSuggestionSet((current) => (current + 1) % SUGGESTION_SETS.length), 10_000);
    return () => clearInterval(timer);
  }, []);

  const nearBottom = useRef(true);
  const onScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    nearBottom.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 120;
  }, []);
  const scrollDown = useCallback(() => { if (nearBottom.current) scroller.current?.scrollToEnd({ animated: false }); }, []);

  const ask = useCallback(
    async (question: string, history: Message[]) => {
      const assistantId = `${Date.now()}-a`;
      setBusy(true);
      setMessages([...history, { id: assistantId, role: 'assistant', text: '' }]);
      const controller = new AbortController();
      abort.current = controller;
      const payload = {
        message: question,
        // The Worker appends the new question; send the latest turns only.
        history: history.slice(0, -1).filter((m) => m.id !== 'welcome' && !m.failed).slice(-8).map(({ role, text }) => ({ role, content: text })),
        language: settings.language,
        name: profile.name.trim() || undefined,
      };
      const update = (text: string, failed = false) => setMessages((current) => current.map((m) => (m.id === assistantId ? { ...m, text, failed } : m)));
      const attachSources = (sources: Source[]) => setMessages((current) => current.map((m) => (m.id === assistantId ? { ...m, sources } : m)));
      try {
        let answer = '';
        let streamed = false;
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, stream: true }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const failure = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(failure.error ?? 'جواب حاصل نہیں ہو سکا۔ دوبارہ کوشش کریں۔');
        }
        streamed = await readStream(response, (piece) => {
          answer += piece;
          update(answer);
        }, attachSources);
        if (!streamed || !answer.trim()) {
          // Streaming is unavailable on this device: fall back to one full answer.
          const full = await fetch(`${API_BASE_URL}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
          const data = (await full.json().catch(() => ({}))) as { answer?: string; error?: string; sources?: Source[] };
          if (!full.ok || !data.answer) throw new Error(data.error ?? 'جواب حاصل نہیں ہو سکا۔ دوبارہ کوشش کریں۔');
          answer = data.answer;
          update(answer);
          if (data.sources?.length) attachSources(data.sources);
        }
      } catch (err) {
        if (controller.signal.aborted) {
          setMessages((current) => current.filter((m) => m.id !== assistantId || m.text.trim()));
        } else {
          update(err instanceof Error ? err.message : 'براہ کرم دوبارہ کوشش کریں۔', true);
        }
      } finally {
        abort.current = null;
        setBusy(false);
      }
    },
    [profile.name, settings.language],
  );

  const send = (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    setInput('');
    nearBottom.current = true;
    const history: Message[] = [...messages.filter((m) => !m.failed), { id: `${Date.now()}-u`, role: 'user', text: question }];
    void ask(question, history);
  };

  const retry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser || busy) return;
    const history = messages.filter((m) => !m.failed);
    void ask(lastUser.text, history);
  };

  const newChat = () => {
    abort.current?.abort();
    setMessages([WELCOME]);
    setBusy(false);
    void AsyncStorage.removeItem(CHAT_KEY);
  };

  const onlyWelcome = messages.length === 1;

  return (
    <KeyboardAvoidingView style={[uiStyles.screenPadding, styles.container]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.foreground }]}>Fatwa AI</Text>
        <Pressable onPress={newChat} style={[styles.newChat, { borderColor: colors.border, backgroundColor: colors.card }]} accessibilityRole="button" accessibilityLabel="New chat" testID="chat-new">
          <Feather name="edit" size={13} color={colors.primary} />
          <Text style={[styles.newChatText, { color: colors.primary }]}>New chat</Text>
        </Pressable>
      </View>

      <ScrollView ref={scroller} style={styles.messages} contentContainerStyle={styles.messageList} keyboardShouldPersistTaps="handled" onContentSizeChange={scrollDown} onScroll={onScroll} scrollEventThrottle={64} nestedScrollEnabled>
        {messages.map((item) => {
          const mine = item.role === 'user';
          const rtl = containsArabic(item.text);
          return (
            <View key={item.id} style={[styles.messageRow, mine && styles.userRow]}>
              <View
                style={[
                  styles.bubble,
                  mine ? { backgroundColor: colors.primary, borderBottomRightRadius: 6 } : { backgroundColor: colors.card, borderColor: item.failed ? colors.coral : colors.border, borderBottomLeftRadius: 6 },
                ]}
              >
                {item.text ? (
                  <Text selectable style={[styles.bubbleText, rtl && styles.rtl, { color: mine ? colors.primaryForeground : item.failed ? colors.coral : colors.foreground }]} testID={`chat-${item.role}`}>
                    {item.text.replace(/\*\*(.*?)\*\*/g, '$1')}
                  </Text>
                ) : (
                  <Dots />
                )}
                {!mine && item.sources?.length && item.text ? (() => {
                  const panelOpen = openSourcesPanel === item.id;
                  return (
                    <View style={[styles.sources, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Pressable
                        onPress={() => setOpenSourcesPanel(panelOpen ? null : item.id)}
                        style={styles.sourcesHeader}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.sources.length} references and sources`}
                      >
                        <View style={[styles.sourcesBook, { backgroundColor: colors.primarySoft }]}>
                          <Feather name="book-open" size={23} color={colors.primary} />
                        </View>
                        <View style={styles.sourcesHeaderCopy}>
                          <View style={styles.sourcesTitleRow}>
                            <Text style={[styles.sourcesTitle, { color: colors.foreground }]}>حوالہ جات و مصادر</Text>
                            <View style={[styles.sourceCount, { backgroundColor: colors.primary }]}><Text style={styles.sourceCountText}>{item.sources.length}</Text></View>
                          </View>
                          <Text style={[styles.sourcesSubtitle, { color: colors.mutedForeground }]}>{panelOpen ? 'حوالہ کھولنے کے لیے منتخب کریں' : 'مزید تفصیلات کے لیے کھولیں'}</Text>
                        </View>
                        <View style={[styles.sourcesChevron, { backgroundColor: colors.primarySoft }]}>
                          <Feather name={panelOpen ? 'chevron-up' : 'chevron-down'} size={21} color={colors.primary} />
                        </View>
                      </Pressable>
                      {panelOpen ? (
                        <View style={styles.sourcesList}>
                          {item.sources.map((src, index) => {
                            const key = `${item.id}-${index}`;
                            const open = openSource === key;
                            return (
                              <Pressable key={key} onPress={() => setOpenSource(open ? null : key)} style={[styles.sourceRow, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button">
                                <Text style={[styles.sourceName, { color: colors.primary }]} numberOfLines={open ? 3 : 1}>{src.work}{src.ref && !src.work.includes(src.ref) ? ` · ${src.ref}` : ''}</Text>
                                {open ? (
                                  <>
                                    {src.author ? <Text style={[styles.sourceAuthor, { color: colors.mutedForeground }]}>{src.author}</Text> : null}
                                    {src.snippet ? <Text style={[styles.sourceSnippet, containsArabic(src.snippet) && styles.rtl, { color: colors.mutedForeground }]}>{src.snippet}…</Text> : null}
                                    {src.url ? <Text onPress={() => void Linking.openURL(src.url!).catch(() => undefined)} style={[styles.sourceLink, { color: colors.primary }]}>Open source</Text> : null}
                                  </>
                                ) : null}
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  );
                })() : null}
                {!mine && item.id !== 'welcome' && item.text && !busy ? (
                  <View style={styles.bubbleActions}>
                    {item.failed ? (
                      <Pressable onPress={retry} style={styles.bubbleAction} accessibilityRole="button" testID="chat-retry">
                        <Feather name="refresh-cw" size={13} color={colors.primary} />
                        <Text style={[styles.bubbleActionText, { color: colors.primary }]}>Try again</Text>
                      </Pressable>
                    ) : (
                      <Pressable onPress={() => void Share.share({ message: item.text }).catch(() => undefined)} style={styles.bubbleAction} accessibilityRole="button" accessibilityLabel="Share answer">
                        <Feather name="share-2" size={13} color={colors.mutedForeground} />
                        <Text style={[styles.bubbleActionText, { color: colors.mutedForeground }]}>Share</Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}

        {onlyWelcome ? (
          <View style={styles.suggestions}>
            {SUGGESTION_SETS[suggestionSet].map((suggestion) => (
              <Pressable key={suggestion} onPress={() => send(suggestion)} style={[styles.suggestion, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button" testID="chat-suggestion">
                <Text style={[styles.suggestionText, containsArabic(suggestion) && styles.rtl, { color: colors.foreground }]}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

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
          testID="chat-input"
          onKeyPress={(event) => {
            const key = event.nativeEvent as unknown as { key?: string; shiftKey?: boolean };
            if (Platform.OS === 'web' && key.key === 'Enter' && !key.shiftKey) {
              (event as unknown as { preventDefault?: () => void }).preventDefault?.();
              send();
            }
          }}
        />
        {busy ? (
          <Pressable onPress={() => abort.current?.abort()} style={[styles.send, { backgroundColor: colors.coral }]} accessibilityRole="button" accessibilityLabel="Stop" testID="chat-stop">
            <Feather name="square" size={15} color="#FFFFFF" />
          </Pressable>
        ) : (
          <Pressable onPress={() => send()} disabled={!input.trim()} style={[styles.send, { backgroundColor: input.trim() ? colors.primary : colors.muted }]} accessibilityRole="button" accessibilityLabel="Send question" testID="chat-send">
            <Feather name="send" size={17} color={input.trim() ? '#FFFFFF' : colors.mutedForeground} />
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  head: { marginTop: 2, marginBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 7 },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.6 },
  newChat: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  newChatText: { fontSize: 12, fontWeight: '800' },
  messages: { flex: 1, minHeight: 0, marginBottom: 8 },
  messageList: { gap: 12, paddingBottom: 8 },
  messageRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', maxWidth: '100%' },
  userRow: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubble: { borderWidth: 1, borderColor: 'transparent', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, flexShrink: 1 },
  bubbleText: { fontSize: 14.5, lineHeight: 24 },
  rtl: { textAlign: 'right', writingDirection: 'rtl', lineHeight: 28, fontSize: 15.5 },
  sources: { marginTop: 13, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  sourcesHeader: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  sourcesBook: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sourcesHeaderCopy: { flex: 1, gap: 4 },
  sourcesTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sourcesTitle: { fontSize: 16, fontWeight: '800' },
  sourceCount: { minWidth: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  sourceCountText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  sourcesSubtitle: { fontSize: 11.5, fontWeight: '600' },
  sourcesChevron: { width: 39, height: 39, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sourcesList: { paddingHorizontal: 10, paddingBottom: 10, gap: 6 },
  sourceRow: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, gap: 4 },
  sourceName: { fontSize: 12, fontWeight: '700' },
  sourceAuthor: { fontSize: 11, fontWeight: '600' },
  sourceSnippet: { fontSize: 12, lineHeight: 19 },
  sourceLink: { fontSize: 11, fontWeight: '800' },
  bubbleActions: { flexDirection: 'row', gap: 14, marginTop: 8 },
  bubbleAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bubbleActionText: { fontSize: 11, fontWeight: '700' },
  dots: { flexDirection: 'row', gap: 5, paddingVertical: 8, paddingHorizontal: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  suggestions: { gap: 6, marginTop: 2, flexDirection: 'row', flexWrap: 'wrap' },
  suggestion: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  suggestionText: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  composer: { minHeight: 64, borderWidth: 1, borderRadius: 24, padding: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 46, maxHeight: 120, fontSize: 14, lineHeight: 21, paddingHorizontal: 8, paddingTop: 10 },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  footer: { textAlign: 'center', fontSize: 10, lineHeight: 14, marginTop: 4, marginBottom: 2 },
});
