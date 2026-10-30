import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Linking, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StarPattern } from '@/components/Art';
import { AuthPanel } from '@/components/AuthPanel';
import { LogoMark, PrimaryButton } from '@/components/ui';
import { ensureNotificationPermissions } from '@/lib/adhan';
import { detectPlace } from '@/lib/geo';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/lib/store';
import { WEB_BASE_URL } from '@/screens/LegalScreen';
import { IMAGE_PICKER_OPTIONS } from '@/lib/upload';

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
  const { saveProfile, uploadAvatar, completeOnboarding, profile, setProfile, signedIn } = useApp();
  const [step, setStep] = useState<Step>('permissions');
  const [busy, setBusy] = useState(false);
  const [notificationState, setNotificationState] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [locationState, setLocationState] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [name, setName] = useState(profile.name);
  const [country, setCountry] = useState(profile.country);
  const [city, setCity] = useState(profile.city);
  const [avatar, setAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [error, setError] = useState('');

  React.useEffect(() => { if (profile.name && !name) setName(profile.name); }, [profile.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const allowPermissions = async () => {
    setBusy(true);
    try {
      const notifications = await ensureNotificationPermissions().catch(() => false);
      setNotificationState(notifications || Platform.OS === 'web' ? 'granted' : 'denied');
      const found = await detectPlace();
      setLocationState(found.granted ? 'granted' : 'denied');
      if (found.place) {
        if (found.place.city) setCity(found.place.city);
        if (found.place.country) setCountry(found.place.country);
      }
    } finally {
      setBusy(false);
      setStep('account');
    }
  };

  const pickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ ...IMAGE_PICKER_OPTIONS, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (!result.canceled && result.assets[0]?.uri) setAvatar(result.assets[0]);
    } catch {
      setError('Could not open your photos. You can add a picture later from Settings.');
    }
  };

  const createAccount = async () => {
    setError('');
    if (name.trim().length < 2 || country.trim().length < 2 || city.trim().length < 2) {
      setError('Please enter your name, country and city.');
      return;
    }
    setBusy(true);
    try {
      await saveProfile({ name, country, city });
      if (avatar) {
        try {
          await uploadAvatar(avatar);
        } catch {
          setProfile({ avatarUri: undefined });
        }
      }
      completeOnboarding();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={[colors.forest, colors.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <StarPattern opacity={0.13} size={50} />
            <View style={styles.logoRing}><LogoMark size={52} /></View>
            <Text style={styles.heroTitle}>{step === 'permissions' ? 'Welcome to Fatwa' : signedIn ? 'Complete your profile' : 'Sign in or create account'}</Text>
            <Text style={styles.heroCopy}>
              {step === 'permissions' ? 'Authentic guidance, community reminders and prayer tools in one place.' : 'Your name and city are shown on your posts, and nearby posts appear first in your feed.'}
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
              {!signedIn ? <AuthPanel onDone={(needsProfile) => { if (!needsProfile) completeOnboarding(); }} /> : null}
              <Pressable onPress={() => void pickAvatar()} style={styles.avatarWrap} accessibilityRole="button" accessibilityLabel="Choose profile picture" testID="onboarding-avatar">
                <View style={[styles.avatar, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
                  {avatar ? <Image source={{ uri: avatar.uri }} style={styles.avatarImage} contentFit="cover" /> : <Feather name="camera" size={26} color={colors.primary} />}
                </View>
                <Text style={[styles.avatarText, { color: colors.primary }]}>{avatar ? 'Change picture' : 'Add profile picture'}</Text>
              </Pressable>

              <Text style={[styles.label, { color: colors.foreground }]}>Full name</Text>
              <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.mutedForeground} autoCapitalize="words" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} testID="onboarding-name" />
              <Text style={[styles.label, { color: colors.foreground }]}>Country</Text>
              <TextInput value={country} onChangeText={setCountry} placeholder="Your country" placeholderTextColor={colors.mutedForeground} autoCapitalize="words" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} testID="onboarding-country" />
              <Text style={[styles.label, { color: colors.foreground }]}>City</Text>
              <TextInput value={city} onChangeText={setCity} placeholder="Your city" placeholderTextColor={colors.mutedForeground} autoCapitalize="words" style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} testID="onboarding-city" />

              {error ? (
                <View style={[styles.error, { backgroundColor: colors.coralSoft, borderColor: colors.coral }]} accessibilityRole="alert">
                  <Feather name="alert-circle" size={16} color={colors.coral} />
                  <Text style={[styles.errorText, { color: colors.foreground }]}>{error}</Text>
                </View>
              ) : null}

              <PrimaryButton label={busy ? 'Creating…' : 'Create account'} icon="user-check" onPress={() => void createAccount()} loading={busy} testID="onboarding-create" />
              <Pressable onPress={completeOnboarding} style={styles.skip} accessibilityRole="button" testID="onboarding-skip">
                <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip for now</Text>
              </Pressable>
              {busy ? <ActivityIndicator style={{ marginTop: 6 }} color={colors.primary} /> : null}
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
  avatarWrap: { alignItems: 'center', marginBottom: 18 },
  avatar: { width: 92, height: 92, borderRadius: 46, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 12.5, fontWeight: '800', marginTop: 9 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, fontSize: 14, marginBottom: 14 },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 14 },
  errorText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
});
