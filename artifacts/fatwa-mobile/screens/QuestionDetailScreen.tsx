import { Feather } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { InfoBanner, SectionTitle, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/lib/store';

export default function QuestionDetailScreen({ questionId }: { questionId: string }) {
  const colors = useColors();
  const { questions } = useApp();
  const question = questions.find((item) => item.id === questionId);

  if (!question) {
    return <View style={uiStyles.screenPadding}><InfoBanner icon="info" text="This question is not available on this device yet." /></View>;
  }

  return (
    <ScrollView contentContainerStyle={uiStyles.screenPadding}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>ANSWERED QUESTION</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Your question and answer</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Reviewed guidance connected to your original question.</Text>
      </View>
      <SectionTitle title="Your question" subtitle={`${question.category} · ${question.city}, ${question.country}`} />
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.meta}><Feather name="user" size={15} color={colors.primary} /><Text style={[styles.metaText, { color: colors.mutedForeground }]}>{question.name} · {question.gender === 'unspecified' ? 'Not specified' : question.gender}</Text></View>
        <Text style={[styles.question, { color: colors.foreground }]}>{question.question}</Text>
      </View>
      <SectionTitle title="Scholar's answer" />
      <View style={[styles.answerCard, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
        <View style={styles.meta}><Feather name="check-circle" size={16} color={colors.primary} /><Text style={[styles.answerBy, { color: colors.primary }]}>{question.answeredBy || 'Review team'}</Text></View>
        <Text style={[styles.answer, { color: colors.foreground }]}>{question.answer || 'The answer is still under review.'}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: 10, marginBottom: 18 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 7 },
  title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 7 },
  card: { borderWidth: 1, borderRadius: 22, padding: 18, marginBottom: 14 },
  answerCard: { borderWidth: 1, borderRadius: 22, padding: 19, marginBottom: 24 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  metaText: { fontSize: 11.5, fontWeight: '600' },
  answerBy: { fontSize: 12.5, fontWeight: '800' },
  question: { fontSize: 16.5, lineHeight: 26, fontWeight: '700' },
  answer: { fontSize: 15.5, lineHeight: 26 },
});
