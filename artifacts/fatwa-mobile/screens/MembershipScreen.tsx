import { Feather } from '@expo/vector-icons';
import Crypto from 'expo-crypto';
import { ErrorCode, getAvailablePurchases, purchaseErrorListener, purchaseUpdatedListener, restorePurchases, useIAP, type ProductSubscription, type Purchase, type PurchaseAndroid } from 'expo-iap';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { API_BASE_URL, useApp } from '@/lib/store';
import type { MembershipPlan } from '@/lib/types';

const PRODUCT_ID = 'fatwa_membership';
const PLANS = [
  { id: 'premium-monthly', key: 'premium' as const, title: 'Premium', detail: 'Unlimited text and photo posts · 5 videos each day', icon: 'award' as const },
  { id: 'high-premium-monthly', key: 'high_premium' as const, title: 'High Premium', detail: 'Unlimited text, photo, and video posts', icon: 'zap' as const },
];

export default function MembershipScreen() {
  if (Platform.OS !== 'android') return <MembershipUnavailable />;
  return <AndroidMembershipScreen />;
}

function MembershipUnavailable() {
  const colors = useColors();
  const nav = useNav();
  return <View style={styles.center}><Feather name="smartphone" size={30} color={colors.primary} /><Text style={[styles.title, { color: colors.foreground }]}>Memberships on Android</Text><Text style={[styles.copy, { color: colors.mutedForeground }]}>Google Play subscriptions are available in the Android app. Your plan can still be restored there.</Text><Pressable onPress={nav.back}><Text style={[styles.link, { color: colors.primary }]}>Back</Text></Pressable></View>;
}

function AndroidMembershipScreen() {
  const colors = useColors();
  const nav = useNav();
  const { profile, signedIn, authHeaders, membership, refreshMembership } = useApp();
  const { connected, subscriptions, fetchProducts, requestPurchase, finishTransaction } = useIAP();
  const [busyPlan, setBusyPlan] = useState<MembershipPlan | 'restore' | null>(null);
  const [message, setMessage] = useState('');
  const [restoreStatus, setRestoreStatus] = useState('');
  const processingTokens = useRef(new Set<string>());
  const processPurchaseRef = useRef<(purchase: Purchase) => Promise<void>>(async () => undefined);
  processPurchaseRef.current = async (purchase) => {
    const androidPurchase = purchase as PurchaseAndroid;
    const token = androidPurchase.purchaseToken;
    if (!token || androidPurchase.purchaseState !== 'purchased' || androidPurchase.productId !== PRODUCT_ID) return;
    if (processingTokens.current.has(token)) return;
    processingTokens.current.add(token);
    setBusyPlan('restore');
    setMessage('Verifying your purchase securely…');
    try {
      const response = await fetch(`${API_BASE_URL}/api/subscription/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ purchaseToken: token }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; plan?: MembershipPlan };
      if (!response.ok || !payload.plan) throw new Error(payload.error || 'Google Play could not verify this purchase. Please try again.');
      await finishTransaction({ purchase, isConsumable: false });
      await refreshMembership();
      setMessage(`${payload.plan === 'high_premium' ? 'High Premium' : 'Premium'} is active on this account.`);
      setRestoreStatus('verified');
    } catch (error) {
      processingTokens.current.delete(token);
      setMessage(error instanceof Error ? error.message : 'Purchase verification failed. Please restore again.');
      setRestoreStatus('failed');
    } finally {
      setBusyPlan(null);
    }
  };

  const fetchProductsRef = useRef(fetchProducts);
  fetchProductsRef.current = fetchProducts;
  useEffect(() => {
    if (connected) void fetchProductsRef.current({ skus: [PRODUCT_ID], type: 'subs' }).catch(() => setMessage('Could not load Google Play prices. Check your connection and try again.'));
  }, [connected]);
  useEffect(() => {
    const updated = purchaseUpdatedListener((purchase) => { void processPurchaseRef.current(purchase); });
    const errors = purchaseErrorListener((error) => {
      if (error.code !== ErrorCode.UserCancelled) setMessage(error.message || 'Google Play could not complete the purchase.');
      setBusyPlan(null);
    });
    return () => { updated.remove(); errors.remove(); };
  }, []);

  const product = subscriptions.find((item) => item.id === PRODUCT_ID);
  const offerFor = (basePlanId: string) => product?.subscriptionOffers?.find((offer) => offer.basePlanIdAndroid === basePlanId);

  const buy = async (plan: (typeof PLANS)[number]) => {
    setMessage('');
    if (!signedIn || !profile.id) { setMessage('Sign in to your Fatwa account before subscribing.'); return; }
    const offer = offerFor(plan.id);
    if (!connected || !offer?.offerTokenAndroid) { setMessage('This plan is not available from Google Play yet. Check the product and base-plan setup.'); return; }
    setBusyPlan(plan.key);
    try {
      const obfuscatedAccountId = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `fatwa:${profile.id}`);
      await requestPurchase({
        type: 'subs',
        request: { google: { skus: [PRODUCT_ID], obfuscatedAccountId, subscriptionOffers: [{ sku: PRODUCT_ID, offerToken: offer.offerTokenAndroid }] } },
      });
    } catch (error) {
      setBusyPlan(null);
      setMessage(error instanceof Error ? error.message : 'Google Play could not start the purchase.');
    }
  };

  const restore = async () => {
    setBusyPlan('restore'); setMessage(''); setRestoreStatus('checking');
    try {
      await restorePurchases();
      const purchases = await getAvailablePurchases();
      const owned = purchases.filter((purchase) => purchase.productId === PRODUCT_ID && purchase.purchaseState === 'purchased');
      if (!owned.length) {
        setRestoreStatus('empty');
        setMessage('No active Fatwa membership was found for this Google Play account.');
        setBusyPlan(null);
        return;
      }
      for (const purchase of owned) await processPurchaseRef.current(purchase);
    } catch (error) {
      setRestoreStatus('failed');
      setBusyPlan(null);
      setMessage(error instanceof Error ? error.message : 'Could not restore purchases. Please try again.');
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.hero, { backgroundColor: colors.forest }]}>
        <Feather name="star" size={22} color={colors.gold} />
        <Text style={styles.heroEyebrow}>YOUR MEMBERSHIP</Text>
        <Text style={styles.heroTitle}>{membership.plan === 'high_premium' ? 'High Premium' : membership.plan === 'premium' ? 'Premium' : 'Free plan'}</Text>
        <Text style={styles.heroCopy}>{membership.plan === 'free' ? 'Share a few reflections, or unlock more room for the community.' : 'Your membership is active. Limits are enforced securely by Fatwa.'}</Text>
        <View style={styles.usageRow}>
          <Text style={styles.usageText}>{membership.usage.postLimit == null ? 'Unlimited posts' : `${membership.usage.posts} of ${membership.usage.postLimit} posts today`}</Text>
          <Text style={styles.usageText}>{membership.usage.videoLimit == null ? 'Unlimited videos' : `${membership.usage.videos} of ${membership.usage.videoLimit} videos today`}</Text>
        </View>
      </View>

      {!signedIn ? <View style={[styles.notice, { backgroundColor: colors.goldSoft }]}><Text style={[styles.noticeText, { color: colors.foreground }]}>Create or sign in to your Fatwa account before purchasing. Membership follows your account, not just this phone.</Text><Pressable onPress={() => nav.goTab('profile')}><Text style={[styles.link, { color: colors.primary }]}>Go to Profile</Text></Pressable></View> : null}
      {membership.expiresAt ? <Text style={[styles.expiry, { color: colors.mutedForeground }]}>Current access through {new Date(membership.expiresAt).toLocaleDateString()}</Text> : null}

      <Text style={[styles.section, { color: colors.foreground }]}>Choose a plan</Text>
      {PLANS.map((plan) => {
        const offer = offerFor(plan.id);
        const active = membership.plan === plan.key;
        return (
          <View key={plan.id} style={[styles.plan, { backgroundColor: colors.card, borderColor: active ? colors.primary : colors.border }]}>
            <View style={[styles.planIcon, { backgroundColor: plan.key === 'high_premium' ? colors.goldSoft : colors.primarySoft }]}><Feather name={plan.icon} size={19} color={plan.key === 'high_premium' ? colors.gold : colors.primary} /></View>
            <View style={styles.planInfo}>
              <View style={styles.planHead}><Text style={[styles.planTitle, { color: colors.foreground }]}>{plan.title}</Text><Text style={[styles.price, { color: colors.primary }]}>{offer?.displayPrice || product?.displayPrice || '—'}</Text></View>
              <Text style={[styles.copy, { color: colors.mutedForeground }]}>{plan.detail}</Text>
              <Pressable disabled={!signedIn || busyPlan !== null || active} onPress={() => void buy(plan)} style={[styles.buy, { backgroundColor: active ? colors.muted : colors.primary, opacity: !signedIn || busyPlan !== null ? 0.6 : 1 }]} accessibilityRole="button">
                {busyPlan === plan.key ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.buyText}>{active ? 'Current plan' : 'Continue with Google Play'}</Text>}
              </Pressable>
            </View>
          </View>
        );
      })}

      <Pressable onPress={() => void restore()} disabled={busyPlan !== null || !signedIn} style={[styles.restore, { borderColor: colors.border, opacity: busyPlan !== null || !signedIn ? 0.6 : 1 }]} accessibilityRole="button">
        {busyPlan === 'restore' ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="refresh-cw" size={15} color={colors.primary} />}
        <Text style={[styles.restoreText, { color: colors.primary }]}>{restoreStatus === 'checking' ? 'Checking purchases…' : 'Restore purchases'}</Text>
      </Pressable>
      {message ? <Text style={[styles.message, { color: restoreStatus === 'failed' ? colors.coral : colors.mutedForeground }]} accessibilityRole="alert">{message}</Text> : null}
      <Text style={[styles.footnote, { color: colors.mutedForeground }]}>Subscriptions and renewal are managed by Google Play. Prices and availability appear in the Play purchase sheet. You can cancel in Google Play settings.</Text>
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
  section: { fontSize: 18, fontWeight: '800', marginBottom: 11 },
  plan: { borderWidth: 1.5, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 11 },
  planIcon: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  planInfo: { flex: 1 },
  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  planTitle: { fontSize: 15, fontWeight: '800' },
  price: { fontSize: 13, fontWeight: '800' },
  copy: { fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  buy: { minHeight: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 11, paddingHorizontal: 10 },
  buyText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' },
  notice: { borderRadius: 15, padding: 13, marginBottom: 12, gap: 8 },
  noticeText: { fontSize: 12, lineHeight: 18 },
  expiry: { fontSize: 11, marginBottom: 12 },
  restore: { minHeight: 44, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  restoreText: { fontSize: 12, fontWeight: '800' },
  message: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 10 },
  footnote: { fontSize: 10.5, lineHeight: 16, textAlign: 'center', marginTop: 13 },
  center: { flex: 1, minHeight: 280, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 12 },
  title: { fontSize: 21, fontWeight: '800', textAlign: 'center' },
  link: { fontSize: 12, fontWeight: '800', marginTop: 5 },
});
