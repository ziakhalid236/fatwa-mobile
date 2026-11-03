import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { API_BASE_URL, useApp } from '@/lib/store';
import type { MembershipPlan } from '@/lib/types';

const PLANS = [
  { key: 'premium' as const, title: 'Premium', detail: 'Unlimited text and photo posts · 5 videos each day', icon: 'award' as const },
  { key: 'high_premium' as const, title: 'High Premium', detail: 'Unlimited text, photo, and video posts', icon: 'zap' as const },
];

export default function MembershipScreen() {
  const colors = useColors();
  const nav = useNav();
  const { profile, signedIn, authHeaders, membership, refreshMembership } = useApp();
  const [busyPlan, setBusyPlan] = useState<MembershipPlan | null>(null);
  const [message, setMessage] = useState('');
  const [requested, setRequested] = useState<MembershipPlan | null>(null);

  const requestPlan = async (plan: MembershipPlan) => {
    setMessage('');
    if (!signedIn || !profile.id) { setMessage('پہلے اپنے Fatwa اکاؤنٹ میں سائن اِن کریں۔'); return; }
    setBusyPlan(plan);
    try {
      const response = await fetch(`${API_BASE_URL}/api/subscription/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ plan }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; status?: string };
      if (!response.ok) throw new Error(payload.error || 'درخواست جمع نہیں ہو سکی۔');
      setRequested(plan);
      setMessage('آپ کی درخواست Admin Panel میں بھیج دی گئی ہے۔ منظوری کے بعد membership خود بخود فعال ہو جائے گی۔');
      await refreshMembership();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'درخواست جمع نہیں ہو سکی۔');
    } finally {
      setBusyPlan(null);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.hero, { backgroundColor: colors.forest }]}>
        <Feather name="star" size={22} color={colors.gold} />
        <Text style={styles.heroEyebrow}>YOUR MEMBERSHIP</Text>
        <Text style={styles.heroTitle}>{membership.plan === 'high_premium' ? 'High Premium' : membership.plan === 'premium' ? 'Premium' : 'Free plan'}</Text>
        <Text style={styles.heroCopy}>{membership.plan === 'free' ? 'Plan منتخب کریں؛ منظوری Admin Panel سے ہوگی۔' : 'آپ کی membership فعال ہے۔'}</Text>
        <View style={styles.usageRow}>
          <Text style={styles.usageText}>{membership.usage.postLimit == null ? 'Unlimited posts' : `${membership.usage.posts} of ${membership.usage.postLimit} posts today`}</Text>
          <Text style={styles.usageText}>{membership.usage.videoLimit == null ? 'Unlimited videos' : `${membership.usage.videos} of ${membership.usage.videoLimit} videos today`}</Text>
        </View>
      </View>

      {!signedIn ? <View style={[styles.notice, { backgroundColor: colors.goldSoft }]}><Text style={[styles.noticeText, { color: colors.foreground }]}>درخواست دینے کے لیے پہلے اکاؤنٹ بنائیں یا سائن اِن کریں۔</Text><Pressable onPress={() => nav.goTab('profile')}><Text style={[styles.link, { color: colors.primary }]}>Profile کھولیں</Text></Pressable></View> : null}

      <Text style={[styles.section, { color: colors.foreground }]}>Admin approval plans</Text>
      <Text style={[styles.intro, { color: colors.mutedForeground }]}>یہاں کوئی Google Play payment نہیں ہوگی۔ آپ کی درخواست Admin Panel میں جائے گی، جہاں منتظم approve یا reject کرے گا۔</Text>
      {PLANS.map((plan) => {
        const active = membership.plan === plan.key;
        const waiting = requested === plan.key;
        return (
          <View key={plan.key} style={[styles.plan, { backgroundColor: colors.card, borderColor: active ? colors.primary : colors.border }]}>
            <View style={[styles.planIcon, { backgroundColor: plan.key === 'high_premium' ? colors.goldSoft : colors.primarySoft }]}><Feather name={plan.icon} size={19} color={plan.key === 'high_premium' ? colors.gold : colors.primary} /></View>
            <View style={styles.planInfo}>
              <Text style={[styles.planTitle, { color: colors.foreground }]}>{plan.title}</Text>
              <Text style={[styles.copy, { color: colors.mutedForeground }]}>{plan.detail}</Text>
              <Pressable disabled={!signedIn || busyPlan !== null || active || waiting} onPress={() => void requestPlan(plan.key)} style={[styles.buy, { backgroundColor: active ? colors.muted : colors.primary, opacity: !signedIn || busyPlan !== null || waiting ? 0.6 : 1 }]}>
                {busyPlan === plan.key ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.buyText}>{active ? 'Current plan' : waiting ? 'Request submitted' : 'Submit for approval'}</Text>}
              </Pressable>
            </View>
          </View>
        );
      })}
      {message ? <Text style={[styles.message, { color: colors.foreground }]} accessibilityRole="alert">{message}</Text> : null}
      <Text style={[styles.footnote, { color: colors.mutedForeground }]}>Admin approval کے بعد plan اور limits محفوظ طریقے سے server سے refresh ہوں گے۔</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 18, paddingBottom: 32 },
  hero: { borderRadius: 24, padding: 21, marginTop: 7, marginBottom: 20 },
  heroEyebrow: { color: '#C6E5D4', fontSize: 9, fontWeight: '800', letterSpacing: 1.3, marginTop: 14 },
  heroTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '800', marginTop: 5 },
  heroCopy: { color: '#D6E9DF', fontSize: 12.5, lineHeight: 19, marginTop: 5 },
  usageRow: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', marginTop: 16, paddingTop: 13, gap: 5 },
  usageText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' },
  section: { fontSize: 18, fontWeight: '800', marginBottom: 7 },
  intro: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  plan: { borderWidth: 1.5, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 11 },
  planIcon: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  planInfo: { flex: 1 },
  planTitle: { fontSize: 15, fontWeight: '800' },
  copy: { fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  buy: { minHeight: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 11, paddingHorizontal: 10 },
  buyText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' },
  notice: { borderRadius: 15, padding: 13, marginBottom: 12, gap: 8 },
  noticeText: { fontSize: 12, lineHeight: 18 },
  link: { fontSize: 12, fontWeight: '800' },
  message: { fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 10 },
  footnote: { fontSize: 10.5, lineHeight: 16, textAlign: 'center', marginTop: 13 },
});
