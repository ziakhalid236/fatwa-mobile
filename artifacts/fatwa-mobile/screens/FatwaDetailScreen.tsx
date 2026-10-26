import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Avatar, InfoBanner, Pill, PrimaryButton, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { useApp } from '@/lib/store';
import { formatCount } from '@/components/PostCard';

export default function FatwaDetailScreen({ fatwaId }: { fatwaId: string }) {
  const colors = useColors();
  const nav = useNav();
  const { fatwas } = useApp();
  const fatwa = useMemo(() => fatwas.find((item) => item.id === fatwaId), [fatwas, fatwaId]);

  if (!fatwa) {
    return (
      <View style={uiStyles.screenPadding}>
        <Text style={[styles.missing, { color: colors.mutedForeground }]}>
          This fatwa is no longer available.
        </Text>
      </View>
    );
  }

  return (
    <View style={uiStyles.screenPadding}>
      <View style={[styles.head, { backgroundColor: colors.forest }]}>
        <View style={styles.headTop}>
          <Pill label={fatwa.category} tone="primary" />
          <Text style={styles.headDate}>{fatwa.date}</Text>
        </View>
        <View style={styles.questionRow}>
          <View style={[styles.qBadge, { backgroundColor: colors.gold }]}>
            <Text style={styles.qBadgeText}>Q</Text>
          </View>
          <Text style={styles.questionText}>{fatwa.question}</Text>
        </View>
      </View>

      <View style={[styles.answerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.answerHead}>
          <View style={[styles.aBadge, { backgroundColor: colors.goldSoft }]}>
            <Text style={[styles.aBadgeText, { color: colors.gold }]}>A</Text>
          </View>
          <Text style={[styles.answerLabel, { color: colors.gold }]}>THE ANSWER</Text>
        </View>
        <Text style={[styles.answerBody, { color: colors.foreground }]}>{fatwa.answer}</Text>
      </View>

      <View style={[styles.scholarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Avatar size={42} icon="award" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.scholarName, { color: colors.foreground }]}>{fatwa.scholar}</Text>
          <Text style={[styles.scholarMeta, { color: colors.mutedForeground }]}>{fatwa.institution}</Text>
        </View>
        <View style={styles.viewsBox}>
          <Feather name="eye" size={13} color={colors.mutedForeground} />
          <Text style={[styles.viewsText, { color: colors.mutedForeground }]}>
            {formatCount(fatwa.views)}
          </Text>
        </View>
      </View>

      <View style={styles.bannerWrap}>
        <InfoBanner
          icon="shield"
          text="This ruling is attributed to its source institution. For a personal ruling, submit your own question."
        />
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            void Share.share({
              title: fatwa.question,
              message: `${fatwa.question}\n\n${fatwa.answer}\n\nShared from Fatwa.`,
            }).catch(() => undefined);
          }}
          style={[styles.action, { backgroundColor: colors.card, borderColor: colors.border }]}
          accessibilityRole="button"
        >
          <Feather name="share-2" size={17} color={colors.foreground} />
          <Text style={[styles.actionText, { color: colors.foreground }]}>Share</Text>
        </Pressable>
        {fatwa.sourceUrl ? (
          <Pressable
            onPress={() => {
              void Linking.openURL(fatwa.sourceUrl!).catch(() => undefined);
            }}
            style={[styles.action, { backgroundColor: colors.card, borderColor: colors.border }]}
            accessibilityRole="button"
          >
            <Feather name="external-link" size={17} color={colors.foreground} />
            <Text style={[styles.actionText, { color: colors.foreground }]}>Source</Text>
          </Pressable>
        ) : null}
      </View>

      <PrimaryButton label="Ask your own question" icon="edit-3" onPress={nav.openAsk} />

      <View style={styles.note}>
        <MaterialCommunityIcons name="scale-balance" size={16} color={colors.mutedForeground} />
        <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
          Answers may differ with a person&apos;s circumstances and school of thought.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  missing: { fontSize: 14, textAlign: 'center', marginTop: 40 },
  head: { borderRadius: 24, padding: 18, marginTop: 4 },
  headTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headDate: { fontSize: 11, color: '#CFE7DE', fontWeight: '600' },
  questionRow: { flexDirection: 'row', gap: 11 },
  qBadge: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  qBadgeText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  questionText: { flex: 1, fontSize: 19, lineHeight: 26, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.3 },
  answerCard: { borderRadius: 22, borderWidth: 1, padding: 18, marginTop: -12 },
  answerHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 13 },
  aBadge: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  aBadgeText: { fontSize: 13, fontWeight: '800' },
  answerLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  answerBody: { fontSize: 14.5, lineHeight: 25 },
  scholarCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  scholarName: { fontSize: 13.5, fontWeight: '700', marginBottom: 3 },
  scholarMeta: { fontSize: 11.5 },
  viewsBox: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  viewsText: { fontSize: 11.5, fontWeight: '600' },
  bannerWrap: { marginTop: 14, marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  action: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: { fontSize: 13, fontWeight: '700' },
  note: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 18 },
  noteText: { fontSize: 11.5, lineHeight: 17, flex: 1, textAlign: 'center' },
});
