import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { uiStyles } from '@/components/ui';
import { LEGAL_PAGES, LEGAL_UPDATED } from '@/data/legal';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { API_BASE_URL } from '@/lib/store';

export const WEB_BASE_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://fatwa-admin.pages.dev').replace(/\/$/, '');

export function LegalIndex() {
  const colors = useColors();
  const nav = useNav();
  return (
    <View style={uiStyles.screenPadding}>
      <Text style={[styles.lead, { color: colors.mutedForeground }]}>Version {LEGAL_UPDATED}</Text>
      {LEGAL_PAGES.map((page) => (
        <Pressable key={page.key} onPress={() => nav.push({ name: 'legal', pageKey: page.key })} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button" testID={`legal-${page.key}`}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>{page.title}</Text>
            <Text style={[styles.copy, { color: colors.mutedForeground }]}>{page.subtitle}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      ))}
    </View>
  );
}

export default function LegalScreen({ pageKey }: { pageKey: string }) {
  const colors = useColors();
  const page = LEGAL_PAGES.find((p) => p.key === pageKey) ?? LEGAL_PAGES[0];
  return (
    <View style={uiStyles.screenPadding}>
      <Text style={[styles.h1, { color: colors.foreground }]}>{page.title}</Text>
      <Text style={[styles.lead, { color: colors.mutedForeground }]}>Last updated: {LEGAL_UPDATED}</Text>
      {page.sections.map((section) => (
        <View key={section.heading} style={{ marginBottom: 14 }}>
          <Text style={[styles.h2, { color: colors.primary }]}>{section.heading}</Text>
          {section.paragraphs.map((text, i) => <Text key={i} style={[styles.body, { color: colors.foreground }]}>{text}</Text>)}
        </View>
      ))}
      <Pressable onPress={() => void Linking.openURL(WEB_BASE_URL + page.url)} accessibilityRole="link">
        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12.5 }}>Open web version</Text>
      </Pressable>
      <Text style={[styles.lead, { color: colors.mutedForeground, marginTop: 14 }]}>{API_BASE_URL.includes('staging') ? 'Staging build' : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 6 },
  h2: { fontSize: 14.5, fontWeight: '800', marginTop: 12, marginBottom: 4 },
  lead: { fontSize: 11.5, marginTop: 4, marginBottom: 14 },
  body: { fontSize: 13.5, lineHeight: 21, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 18, padding: 15, marginBottom: 10 },
  title: { fontSize: 14.5, fontWeight: '700' },
  copy: { fontSize: 11.5, marginTop: 3 },
});
