import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Pill } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import type { Fatwa, UserQuestion } from '@/lib/types';
import { formatCount } from '@/components/PostCard';

export function FatwaCard({
  fatwa,
  onOpen,
}: {
  fatwa: Fatwa;
  onOpen: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[styles.fatwaCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      testID={`fatwa-card-${fatwa.id}`}
    >
      <View style={styles.fatwaHead}>
        <Pill label={fatwa.category} icon="scale-balance" />
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>{fatwa.date}</Text>
      </View>

      <View style={styles.questionBlock}>
        <View style={[styles.qBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.qBadgeText}>Q</Text>
        </View>
        <Text style={[styles.questionText, { color: colors.foreground }]} numberOfLines={3}>
          {fatwa.question}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.answerBlock}>
        <View style={[styles.aBadge, { backgroundColor: colors.goldSoft }]}>
          <Text style={[styles.aBadgeText, { color: colors.gold }]}>A</Text>
        </View>
        <Text style={[styles.answerText, { color: colors.mutedForeground }]} numberOfLines={4}>
          {fatwa.answer}
        </Text>
      </View>

      <View style={[styles.fatwaFooter, { borderTopColor: colors.border }]}>
        <View style={styles.scholarRow}>
          <Feather name="award" size={14} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.scholarText, { color: colors.foreground }]} numberOfLines={1}>{fatwa.institution}</Text>
            <Text style={[styles.sourceText, { color: colors.mutedForeground }]} numberOfLines={1}>{fatwa.scholar}</Text>
          </View>
        </View>
        <Pressable
          onPress={onOpen}
          style={({ pressed }) => [styles.readButton, { opacity: pressed ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={`Read full fatwa: ${fatwa.question}`}
          testID={`fatwa-open-${fatwa.id}`}
        >
          <Text style={[styles.readText, { color: colors.primary }]}>Read</Text>
          <Feather name="chevron-right" size={15} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const statusTone = (status: UserQuestion['status']) =>
  status === 'Answered' ? 'primary' : status === 'Under review' ? 'gold' : 'muted';

export function QuestionCard({
  question,
  onOpen,
}: {
  question: UserQuestion;
  onOpen?: () => void;
}) {
  const colors = useColors();
  const tone = statusTone(question.status);
  return (
    <View
      style={[styles.questionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      testID={`question-card-${question.id}`}
    >
      <View style={styles.fatwaHead}>
        <Pill label={question.category} icon="tag-outline" />
        <Pill
          label={question.status}
          icon={question.status === 'Answered' ? 'check-circle' : 'clock-outline'}
          tone={tone === 'muted' ? 'muted' : tone}
        />
      </View>
      <Text style={[styles.questionTitle, { color: colors.foreground }]} numberOfLines={3}>
        {question.question}
      </Text>
      {question.answer ? (
        <View style={[styles.answerBox, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.answerLabel, { color: colors.primary }]}>
            {question.answeredBy ? `ANSWER FROM ${question.answeredBy.toUpperCase()}` : 'ANSWER'}
          </Text>
          <Text style={[styles.answerBody, { color: colors.foreground }]} numberOfLines={5}>
            {question.answer}
          </Text>
        </View>
      ) : (
        <Text style={[styles.pendingText, { color: colors.mutedForeground }]}>
          Your question is with the scholars. You will be notified when an answer is published.
        </Text>
      )}
      <View style={[styles.questionFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>{question.submittedAt}</Text>
        {onOpen ? (
          <Pressable onPress={onOpen} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.readText, { color: colors.primary }]}>Details</Text>
          </Pressable>
        ) : (
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>ID {question.id}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fatwaCard: { borderRadius: 24, borderWidth: 1, padding: 17, marginBottom: 14 },
  fatwaHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  meta: { fontSize: 10.5, fontWeight: '500' },
  questionBlock: { flexDirection: 'row', gap: 10 },
  qBadge: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  qBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  questionText: { flex: 1, fontSize: 15.5, lineHeight: 23, fontWeight: '700', letterSpacing: -0.2 },
  divider: { height: 1, marginVertical: 13, marginLeft: 34 },
  answerBlock: { flexDirection: 'row', gap: 10 },
  aBadge: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  aBadgeText: { fontSize: 12, fontWeight: '800' },
  answerText: { flex: 1, fontSize: 13, lineHeight: 20 },
  fatwaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
  },
  scholarRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  scholarText: { fontSize: 11.5, fontWeight: '600', flex: 1 },
  sourceText: { fontSize: 10.5, marginTop: 2 },
  readButton: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  readText: { fontSize: 12.5, fontWeight: '700' },
  questionCard: { borderRadius: 22, borderWidth: 1, padding: 16, marginBottom: 12 },
  questionTitle: { fontSize: 14.5, lineHeight: 21, fontWeight: '700', marginTop: 4, marginBottom: 13 },
  answerBox: { borderRadius: 14, padding: 12, marginBottom: 12 },
  answerLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
  answerBody: { fontSize: 12.5, lineHeight: 19 },
  pendingText: { fontSize: 11.5, lineHeight: 17, marginBottom: 12 },
  questionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 10,
  },
});
