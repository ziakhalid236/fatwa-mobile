import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FatwaCard } from '@/components/cards';
import { EmptyState, SectionTitle, uiStyles } from '@/components/ui';
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

export default function FatwaScreen() {
  const colors = useColors();
  const nav = useNav();
  const { fatwas } = useApp();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<FatwaCategory | 'All'>('All');

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return fatwas.filter((fatwa) => {
      const categoryMatch = category === 'All' || fatwa.category === category;
      const termMatch =
        !term ||
        fatwa.question.toLowerCase().includes(term) ||
        fatwa.answer.toLowerCase().includes(term) ||
        fatwa.category.toLowerCase().includes(term);
      return categoryMatch && termMatch;
    });
  }, [category, fatwas, search]);

  return (
    <View style={uiStyles.screenPadding}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>FATWA LIBRARY</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Published rulings</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Every entry shows the question first and the reviewed answer below it.
        </Text>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={17} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search a question or topic"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          returnKeyType="search"
          accessibilityLabel="Search fatwas"
        />
        {search.length ? (
          <Pressable onPress={() => setSearch('')} accessibilityLabel="Clear search">
            <Feather name="x-circle" size={17} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsScroll}
      >
        {(['All', ...categories] as Array<FatwaCategory | 'All'>).map((item) => {
          const active = category === item;
          return (
            <Pressable
              key={item}
              onPress={() => setCategory(item)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.foreground }]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionTitle title={category === 'All' ? 'All fatwas' : category} subtitle={`${visible.length} entries`} />

      {visible.length ? (
        visible.map((fatwa) => (
          <FatwaCard
            key={fatwa.id}
            fatwa={fatwa}
            onOpen={() => nav.push({ name: 'fatwa', fatwaId: fatwa.id })}
          />
        ))
      ) : (
        <EmptyState
          icon="search"
          title="No fatwas found"
          copy="Try a different search term or choose another topic."
        />
      )}

      <View style={[styles.cta, { backgroundColor: colors.primarySoft }]}>
        <MaterialCommunityIcons name="comment-question-outline" size={22} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.ctaTitle, { color: colors.foreground }]}>Cannot find your answer?</Text>
          <Text style={[styles.ctaCopy, { color: colors.mutedForeground }]}>
            Send your question and a scholar will review it.
          </Text>
        </View>
        <Pressable
          onPress={nav.openAsk}
          style={[styles.ctaButton, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
        >
          <Text style={[styles.ctaButtonText, { color: colors.primaryForeground }]}>Ask</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: 8, marginBottom: 16 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 6 },
  title: { fontSize: 23, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 12.5, lineHeight: 19, marginTop: 6 },
  searchBar: {
    borderWidth: 1,
    borderRadius: 16,
    height: 50,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 13,
  },
  searchInput: { flex: 1, fontSize: 13.5, height: '100%' },
  chipsScroll: { marginHorizontal: -18, marginBottom: 4 },
  chips: { gap: 8, paddingHorizontal: 18, paddingBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: '700' },
  cta: {
    borderRadius: 20,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  ctaTitle: { fontSize: 13.5, fontWeight: '700', marginBottom: 3 },
  ctaCopy: { fontSize: 11.5, lineHeight: 16 },
  ctaButton: { borderRadius: 13, paddingHorizontal: 16, paddingVertical: 10 },
  ctaButtonText: { fontSize: 12.5, fontWeight: '800' },
});
