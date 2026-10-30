import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Linking, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StarPattern } from '@/components/Art';
import { AuthPanel } from '@/components/AuthPanel';
import { LogoMark, PrimaryButton } from '@/components/ui';
import { ensureNotificationPermissions } from '@/lib/adhan';
import { detectPlace } from '@/lib/geo';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/lib/store';
import { WEB_BASE_URL } from '@/screens/LegalScreen';

type Step = 'permissions' | 'account';

function PermissionRow({ icon, title, copy, state }: { icon: keyof typeof Feather.glyphMap; title: string; copy: string; state: 'idle' | 'granted' | 'denied' }) {
  const colors = useColors();
  return (
    <View style={[styles.permRow, { backgroundColor: colors.card, borderColor: state === 'granted' ? colors.primary : colors.border }]}>
      <View style={[styles.permIcon, { backgroundColor: colors.primarySoft }]}>
        <Feather name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.permTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.permCopy, { color: colors.mutedForeground }]}>{copy}</Text>
      </View>
      {state === 'granted' ? <Feather name="check-circle" size={20} color={colors.primary} /> : state === 'denied' ? <Feather name="x-circle" size={20} color={colors.mutedForeground} /> : null}
    </View>
  );
}

export default function OnboardingScreen() {
  const colors = useColors();
  const { completeOnboarding, signedIn } = useApp();
  const [step, setStep] = useState<Step>('permissions');
  const [busy, setBusy] = useState(false);
  const [notificationState, setNotificationState] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [locationState, setLocationState] = useState<'idle' | 'granted' | 'denied'>('idle');

  const allowPermissions = async () => {
    setBusy(true);
    try {
      const notifications = await ensureNotificationPermissions().catch(() => false);
      setNotificationState(notifications || Platform.OS === 'web' ? 'granted' : 'denied');
      const found = await detectPlace();
      setLocationState(found.granted ? 'granted' : 'denied');
    } finally {
      setBusy(false);
      setStep('account');
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={[colors.forest, colors.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <StarPattern opacity={0.13} size={50} />
            <View style={styles.logoRing}><LogoMark size={52} /></View>
            <Text style={styles.heroTitle}>{step === 'permissions' ? 'Welcome to Fatwa' : 'Sign in to continue'}</Text>
            <Text style={styles.heroCopy}>
              {step === 'permissions' ? 'Authentic guidance, community reminders and prayer tools in one place.' : 'Use Google or your email. No forms to fill in.'}
            </Text>
          </LinearGradient>

          {step === 'permissions' ? (
            <View style={styles.body}>
              <PermissionRow icon="bell" title="Notifications" copy="Know when your post is received, approved, or a question is answered." state={notificationState} />
              <PermissionRow icon="map-pin" title="Location" copy="Show posts from your city first and set accurate prayer times." state={locationState} />
              <View style={{ height: 8 }} />
              <PrimaryButton label={busy ? 'Please wait…' : 'Allow and continue'} icon="check" onPress={() => void allowPermissions()} loading={busy} testID="onboarding-allow" />
              <Pressable onPress={() => setStep('account')} style={styles.skip} accessibilityRole="button" testID="onboarding-not-now">
                <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Not now</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.body}>
              {!signedIn ? <AuthPanel onDone={() => completeOnboarding()} /> : null}
              <Pressable onPress={completeOnboarding} style={styles.skip} accessibilityRole="button" testID="onboarding-skip">
                <Text style={[styles.skipText, { color: colors.mutedForeground }]}>{signedIn ? 'Continue' : 'Skip for now'}</Text>
              </Pressable>
              <Text style={[styles.skipText, { color: colors.mutedForeground, textAlign: 'center', marginTop: 10, lineHeight: 18 }]}>
                By continuing you agree to the{' '}
                <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={() => void Linking.openURL(`${WEB_BASE_URL}/terms.html`)}>Terms of Use</Text>
                {' '}and{' '}
                <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={() => void Linking.openURL(`${WEB_BASE_URL}/privacy-policy.html`)}>Privacy Policy</Text>.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, padding: 18, paddingBottom: 32 },
  hero: { borderRadius: 32, padding: 26, paddingTop: 34, paddingBottom: 30, gap: 10, marginTop: 8, overflow: 'hidden' },
  logoRing: { width: 70, height: 70, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(230,211,163,0.55)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: -0.6, marginTop: 8 },
  heroCopy: { color: '#DCEFE7', fontSize: 13.5, lineHeight: 21 },
  body: { marginTop: 20 },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderRadius: 20, padding: 15, marginBottom: 12 },
  permIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  permTitle: { fontSize: 14.5, fontWeight: '800', marginBottom: 3 },
  permCopy: { fontSize: 12, lineHeight: 18 },
  skip: { alignItems: 'center', paddingVertical: 14 },
  skipText: { fontSize: 13, fontWeight: '700' },
});
