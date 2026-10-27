import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { QuestionCard } from '@/components/cards';
import { EmptyState, InfoBanner, PrimaryButton, SectionTitle, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { useApp } from '@/lib/store';
import type { FatwaCategory } from '@/lib/types';

const categories: FatwaCategory[] = [
  'Aqeedah',
  'Namaz',
  'Roza',
  'Zakat',
  'Hajj & Umrah',
  'Nikah & Family',
  'Muamalat',
  'Tafseer & Quran',
];

type Step = 'list' | 'details' | 'question' | 'review' | 'done';

export default function QuestionsScreen({ askSignal = 0 }: { askSignal?: number }) {
  const colors = useColors();
  const nav = useNav();
  const { profile, questions, submitQuestion, setProfile } = useApp();

  const [step, setStep] = useState<Step>('list');
  const [name, setName] = useState(profile.name);
  const [gender, setGender] = useState<'male' | 'female' | 'unspecified'>('unspecified');
  const [city, setCity] = useState(profile.city);
  const [country, setCountry] = useState('Pakistan');
  const [questionText, setQuestionText] = useState('');
  const [category, setCategory] = useState<FatwaCategory>('Namaz');
  const [submitting, setSubmitting] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...questions].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)),
    [questions],
  );

  const startAsk = useCallback(() => {
    setName(profile.name);
    setGender('unspecified');
    setCity(profile.city);
    setCountry('Pakistan');
    setQuestionText('');
    setCategory('Namaz');
    setStep('details');
  }, [profile.city, profile.name]);

  useEffect(() => {
    if (askSignal > 0) startAsk();
  }, [askSignal, startAsk]);

  const continueFromDetails = () => {
    if (name.trim().length < 2 || city.trim().length < 2 || country.trim().length < 2) {
      Alert.alert('A little more detail', 'Enter your name, country, and city to continue.');
      return;
    }
    setStep('question');
  };

  const continueFromQuestion = () => {
    if (questionText.trim().length < 20) {
      Alert.alert('Add more detail', 'Please describe your question in at least 20 characters.');
      return;
    }
    setStep('review');
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const entry = await submitQuestion({
        name: name.trim(),
        gender,
        city: city.trim(),
        country: country.trim(),
        question: questionText.trim(),
        category,
      });
      setLastId(entry.id);
      setStep('done');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Could not submit', error instanceof Error ? error.message : 'Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'details' || step === 'question' || step === 'review') {
    const stepIndex = step === 'details' ? 0 : step === 'question' ? 1 : 2;
    return (
      <View style={uiStyles.screenPadding}>
        <View style={styles.steps}>
          {['Your details', 'Question', 'Review'].map((label, index) => (
            <View key={label} style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  { backgroundColor: stepIndex >= index ? colors.primary : colors.muted },
                ]}
              >
                <Text
                  style={[
                    styles.stepNumber,
                    { color: stepIndex >= index ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {index + 1}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  { color: stepIndex >= index ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>

        {step === 'details' ? (
          <>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>Your details</Text>
            <Text style={[styles.formHelper, { color: colors.mutedForeground }]}>
              This helps the scholar understand your question. It stays private.
            </Text>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Full name *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              autoCapitalize="words"
              testID="ask-name"
            />
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Country *</Text>
            <TextInput
              value={country}
              onChangeText={setCountry}
              placeholder="Enter your country"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              autoCapitalize="words"
              testID="ask-country"
            />
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>City / area *</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Enter your city"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              autoCapitalize="words"
              testID="ask-city"
            />
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Gender *</Text>
            <View style={styles.categoryGrid}>
              {(['male', 'female', 'unspecified'] as const).map((item) => {
                const active = gender === item;
                return <Pressable key={item} onPress={() => setGender(item)} style={[styles.categoryChip, { backgroundColor: active ? colors.primarySoft : colors.card, borderColor: active ? colors.primary : colors.border }]}><Text style={[styles.categoryChipText, { color: active ? colors.primary : colors.foreground }]}>{item === 'male' ? 'Male' : item === 'female' ? 'Female' : 'Prefer not to say'}</Text></Pressable>;
              })}
            </View>
            <InfoBanner icon="lock" text="Your identity is only shared with the reviewing scholar." />
          </>
        ) : step === 'question' ? (
          <>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>Your question</Text>
            <Text style={[styles.formHelper, { color: colors.mutedForeground }]}>
              Share the details that will help a scholar understand your situation.
            </Text>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Choose a category *</Text>
            <View style={styles.categoryGrid}>
              {categories.map((item) => {
                const active = category === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setCategory(item)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: active ? colors.primarySoft : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.categoryChipText, { color: active ? colors.primary : colors.foreground }]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Describe your question *</Text>
            <TextInput
              value={questionText}
              onChangeText={setQuestionText}
              placeholder="Include the details that may help a scholar understand your situation…"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                styles.questionInput,
                { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border },
              ]}
              multiline
              textAlignVertical="top"
              maxLength={1200}
              testID="ask-question-text"
            />
            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
              {questionText.length}/1200 characters
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>Review your question</Text>
            <Text style={[styles.formHelper, { color: colors.mutedForeground }]}>
              Check your details before sending to the scholar.
            </Text>
            <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ReviewRow label="Name" value={name} />
              <ReviewRow label="Gender" value={gender === 'unspecified' ? 'Prefer not to say' : gender === 'male' ? 'Male' : 'Female'} />
              <ReviewRow label="Location" value={`${city}, ${country}`} />
              <ReviewRow label="Category" value={category} />
              <View style={[styles.reviewQuestion, { borderTopColor: colors.border }]}>
                <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>QUESTION</Text>
                <Text style={[styles.reviewValue, { color: colors.foreground }]}>{questionText}</Text>
              </View>
            </View>
            <InfoBanner
              icon="info"
              text="Your question is sent to the review team. You will get a notification when an answer is published."
            />
          </>
        )}

        <View style={styles.formActions}>
          <Pressable
            onPress={() => (step === 'details' ? setStep('list') : setStep(step === 'review' ? 'question' : 'details'))}
            style={[styles.backButton, { borderColor: colors.border }]}
            accessibilityRole="button"
          >
            <Feather name="chevron-left" size={18} color={colors.foreground} />
            <Text style={[styles.backButtonText, { color: colors.foreground }]}>Back</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label={step === 'review' ? 'Submit question' : 'Continue'}
              icon={step === 'review' ? 'send' : 'arrow-right'}
              loading={submitting}
              onPress={step === 'details' ? continueFromDetails : step === 'question' ? continueFromQuestion : submit}
              testID={step === 'review' ? 'confirm-question' : 'continue-question'}
            />
          </View>
        </View>
      </View>
    );
  }

  if (step === 'done') {
    return (
      <View style={[uiStyles.screenPadding, styles.doneWrap]}>
        <View style={[styles.doneMark, { backgroundColor: colors.primarySoft }]}>
          <Feather name="check" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.doneTitle, { color: colors.foreground }]}>Question submitted</Text>
        <Text style={[styles.doneBody, { color: colors.mutedForeground }]}>
          Your question has been sent for review. You will receive a notification when the answer is
          published.
        </Text>
        {lastId ? (
          <View style={[styles.doneCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>QUESTION ID</Text>
            <Text style={[styles.doneId, { color: colors.foreground }]}>{lastId}</Text>
          </View>
        ) : null}
        <View style={{ width: '100%', gap: 12 }}>
          <PrimaryButton label="View my questions" icon="list" onPress={() => setStep('list')} />
          <Pressable onPress={nav.openAsk} accessibilityRole="button" style={styles.doneLink}>
            <Text style={[styles.doneLinkText, { color: colors.primary }]}>Ask another question</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={uiStyles.screenPadding}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>YOUR QUESTIONS</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Ask &amp; follow up</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Submit a private question and track the reply from the scholars here.
        </Text>
      </View>

      <PrimaryButton label="Ask a new question" icon="plus" onPress={startAsk} testID="ask-new-question" />

      <View style={{ height: 20 }} />

      <SectionTitle
        title="Your submissions"
        subtitle={questions.length ? `${questions.length} total` : undefined}
      />

      {sorted.length ? (
        sorted.map((question) => <QuestionCard key={question.id} question={question} />)
      ) : (
        <EmptyState
          icon="message-circle"
          title="No questions yet"
          copy="Your private questions and their answers will appear here."
          action="Ask a question"
          onAction={startAsk}
        />
      )}
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.reviewRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.reviewValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: 10, marginBottom: 18 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 7 },
  title: { fontSize: 25, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 7 },
  steps: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 26 },
  stepItem: { alignItems: 'center', gap: 7, minWidth: 78 },
  stepCircle: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNumber: { fontSize: 11.5, fontWeight: '800' },
  stepLabel: { fontSize: 10.5, fontWeight: '600' },
  formTitle: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4, marginBottom: 8 },
  formHelper: { fontSize: 13, lineHeight: 20, marginBottom: 21 },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 13.5,
    marginBottom: 17,
  },
  questionInput: { minHeight: 150, paddingTop: 13, lineHeight: 20 },
  charCount: { fontSize: 10.5, textAlign: 'right', marginTop: -10, marginBottom: 14 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 17 },
  categoryChip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9 },
  categoryChipText: { fontSize: 11.5, fontWeight: '600' },
  reviewCard: { borderWidth: 1, borderRadius: 21, padding: 17, marginBottom: 15 },
  reviewRow: { paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1 },
  reviewLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.9, marginBottom: 6 },
  reviewValue: { fontSize: 13.5, lineHeight: 20, fontWeight: '500' },
  reviewQuestion: { borderTopWidth: 1, paddingTop: 13 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  backButton: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  backButtonText: { fontSize: 13.5, fontWeight: '600' },
  doneWrap: { alignItems: 'center', paddingTop: 40 },
  doneMark: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  doneTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  doneBody: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 20, paddingHorizontal: 10 },
  doneCard: { borderRadius: 16, borderWidth: 1, padding: 14, width: '100%', marginBottom: 20 },
  doneId: { fontSize: 15, fontWeight: '700' },
  doneLink: { alignItems: 'center', paddingVertical: 12 },
  doneLinkText: { fontSize: 13.5, fontWeight: '700' },
});
