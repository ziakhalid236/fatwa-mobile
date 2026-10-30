import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { authConfig, GOOGLE_IDS, googleConfigured, googleSignIn, startEmail, verifyEmail, type AuthResult } from '@/lib/auth';
import { API_BASE_URL, useApp } from '@/lib/store';

WebBrowser.maybeCompleteAuthSession();

// Google sign-in through the system browser with the Web client: Google redirects to our HTTPS page,
// which hands the id_token back to the app through the fatwa-mobile://auth link.
const GOOGLE_REDIRECT = `${API_BASE_URL}/auth/google/callback`;
const APP_RETURN = 'fatwa-mobile://auth';

function GoogleButton({ onResult, onError, setBusy }: { onResult: (r: AuthResult) => void; onError: (m: string) => void; setBusy: (b: boolean) => void }) {
  const colors = useColors();
  const start = async () => {
    onError('');
    const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + [
      `client_id=${encodeURIComponent(GOOGLE_IDS.web)}`,
      `redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT)}`,
      'response_type=id_token',
      `scope=${encodeURIComponent('openid email profile')}`,
      `nonce=${nonce}`,
      'prompt=select_account',
    ].join('&');
    try {
      const result = await WebBrowser.openAuthSessionAsync(url, APP_RETURN);
      if (result.type !== 'success') return;
      const query = result.url.split('#').pop()?.split('?').pop() ?? '';
      const params = new URLSearchParams(query);
      const token = params.get('id_token');
      if (!token) { onError(params.get('error') ? 'Google sign-in was cancelled.' : 'Google did not return a sign-in token.'); return; }
      setBusy(true);
      onResult(await googleSignIn(token));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Google sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable onPress={() => void start()} style={[styles.btn, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button" testID="auth-google">
      <View style={styles.g}><Text style={styles.gText}>G</Text></View>
      <Text style={[styles.btnText, { color: colors.foreground }]}>Continue with Google</Text>
    </Pressable>
  );
}

/** Google + email-code sign-in. Calls onDone once a session exists. */
export function AuthPanel({ onDone }: { onDone: (needsProfile: boolean) => void }) {
  const colors = useColors();
  const { applyAuth } = useApp();
  const [cfg, setCfg] = useState({ google: false, email: false });
  const [mode, setMode] = useState<'choose' | 'email' | 'code'>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => { void authConfig().then(setCfg); }, []);
  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(t); }, [cooldown]);

  const finish = (r: AuthResult) => { applyAuth(r); onDone(r.needsProfile); };
  const showGoogle = googleConfigured && cfg.google;
  if (!showGoogle && !cfg.email) return null;

  const sendCode = async () => {
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    setBusy(true);
    try { await startEmail(email.trim()); setMode('code'); setCooldown(45); } catch (e) { setError(e instanceof Error ? e.message : 'Could not send the code.'); } finally { setBusy(false); }
  };
  const verify = async () => {
    setError('');
    if (code.trim().length < 6) { setError('Enter the 6-digit code.'); return; }
    setBusy(true);
    try { finish(await verifyEmail(email.trim(), code.trim())); } catch (e) { setError(e instanceof Error ? e.message : 'Wrong code.'); } finally { setBusy(false); }
  };

  return (
    <View style={styles.wrap}>
      {mode === 'choose' ? (
        <>
          {showGoogle ? <GoogleButton onResult={finish} onError={setError} setBusy={setBusy} /> : null}
          {cfg.email ? (
            <Pressable onPress={() => setMode('email')} style={[styles.btn, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button" testID="auth-email">
              <Feather name="mail" size={19} color={colors.primary} />
              <Text style={[styles.btnText, { color: colors.foreground }]}>Continue with email</Text>
            </Pressable>
          ) : null}
        </>
      ) : mode === 'email' ? (
        <>
          <Text style={[styles.label, { color: colors.foreground }]}>Your email</Text>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="name@example.com" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} testID="auth-email-input" />
          <Pressable onPress={() => void sendCode()} disabled={busy} style={[styles.cta, { backgroundColor: colors.primary }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Send me a code</Text>}</Pressable>
          <Pressable onPress={() => { setMode('choose'); setError(''); }}><Text style={[styles.link, { color: colors.mutedForeground }]}>Back</Text></Pressable>
        </>
      ) : (
        <>
          <Text style={[styles.label, { color: colors.foreground }]}>Enter the 6-digit code sent to {email.trim()}</Text>
          <TextInput value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="000000" placeholderTextColor={colors.mutedForeground} maxLength={6} style={[styles.input, styles.codeInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} testID="auth-code-input" />
          <Pressable onPress={() => void verify()} disabled={busy} style={[styles.cta, { backgroundColor: colors.primary }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Verify and continue</Text>}</Pressable>
          <Pressable disabled={cooldown > 0 || busy} onPress={() => void sendCode()}><Text style={[styles.link, { color: cooldown > 0 ? colors.mutedForeground : colors.primary }]}>{cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}</Text></Pressable>
        </>
      )}
      {error ? <Text style={[styles.err, { color: colors.coral }]} accessibilityRole="alert">{error}</Text> : null}
      {busy && mode === 'choose' ? <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 6 },
  btn: { minHeight: 54, borderWidth: 1, borderRadius: 18, elevation: 2, shadowColor: '#0D594B', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnText: { fontSize: 14.5, fontWeight: '800' },
  g: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  gText: { fontSize: 13, fontWeight: '900', color: '#4285F4' },
  label: { fontSize: 12, fontWeight: '700' },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, fontSize: 15 },
  codeInput: { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: '800' },
  cta: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  link: { textAlign: 'center', fontSize: 13, fontWeight: '700', paddingVertical: 8 },
  err: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
