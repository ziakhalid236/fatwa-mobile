import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { API_BASE_URL, useApp } from '@/lib/store';
import { IMAGE_PICKER_OPTIONS, uploadImages } from '@/lib/upload';

const MAX_SHOTS = 3;

export function ReportModal({ visible, page, onClose }: { visible: boolean; page: string; onClose: () => void }) {
  const colors = useColors();
  const { authHeaders, profile } = useApp();
  const [message, setMessage] = useState('');
  const [shots, setShots] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const close = () => { setMessage(''); setShots([]); setDone(false); setError(''); onClose(); };

  const pick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ ...IMAGE_PICKER_OPTIONS, allowsMultipleSelection: true, selectionLimit: MAX_SHOTS - shots.length, quality: 0.7 });
      if (result.canceled) return;
      setShots((cur) => [...cur, ...result.assets].slice(0, MAX_SHOTS));
    } catch { setError('Could not open your photos.'); }
  };

  const send = async () => {
    if (message.trim().length < 5) { setError('Please describe the problem in a few words.'); return; }
    setBusy(true); setError('');
    try {
      const fields = { message: message.trim(), page, appVersion: String(Constants.expoConfig?.version ?? ''), platform: Platform.OS, name: profile.name || '' };
      let res: Response;
      if (shots.length) res = await uploadImages(`${API_BASE_URL}/api/reports`, shots, 'screenshots', fields, authHeaders());
      else { const form = new FormData(); Object.entries(fields).forEach(([k, v]) => form.append(k, v)); res = await fetch(`${API_BASE_URL}/api/reports`, { method: 'POST', body: form, headers: authHeaders() }); }
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? 'Could not send your report.');
      setDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send your report.'); } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]}>
          <View style={styles.grab} />
          <View style={styles.head}>
            <View style={[styles.icon, { backgroundColor: colors.coralSoft }]}><Feather name="flag" size={18} color={colors.coral} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>Report a problem</Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>Tell us what went wrong. Our team reads every report.</Text>
            </View>
            <Pressable onPress={close} hitSlop={10}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
          </View>
          {done ? (
            <View style={styles.doneBox}>
              <Feather name="check-circle" size={44} color={colors.primary} />
              <Text style={[styles.title, { color: colors.foreground, marginTop: 12 }]}>Thank you</Text>
              <Text style={[styles.sub, { color: colors.mutedForeground, textAlign: 'center' }]}>Your report was sent to the Fatwa team.</Text>
              <Pressable onPress={close} style={[styles.btn, { backgroundColor: colors.primary, marginTop: 18, alignSelf: 'stretch' }]}><Text style={styles.btnText}>Close</Text></Pressable>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
              <TextInput
                value={message} onChangeText={setMessage} multiline maxLength={3000} editable={!busy}
                placeholder="Describe the problem…" placeholderTextColor={colors.mutedForeground} textAlignVertical="top"
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              />
              <Text style={[styles.label, { color: colors.foreground }]}>Screenshots (up to {MAX_SHOTS})</Text>
              <View style={styles.shots}>
                {shots.map((s, i) => (
                  <View key={s.uri + i} style={styles.shot}>
                    <Image source={{ uri: s.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    <Pressable onPress={() => setShots((cur) => cur.filter((_, j) => j !== i))} style={styles.shotX}><Feather name="x" size={12} color="#fff" /></Pressable>
                  </View>
                ))}
                {shots.length < MAX_SHOTS ? (
                  <Pressable onPress={pick} style={[styles.shot, styles.add, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    <Feather name="plus" size={22} color={colors.primary} />
                  </Pressable>
                ) : null}
              </View>
              {error ? <Text style={[styles.err, { color: colors.coral }]}>{error}</Text> : null}
              <Pressable onPress={send} disabled={busy} style={[styles.btn, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : <><Feather name="send" size={16} color="#fff" /><Text style={styles.btnText}>Send report</Text></>}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,30,22,0.55)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 28 },
  grab: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: '#c9c9c0', marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  input: { minHeight: 120, borderWidth: 1, borderRadius: 16, padding: 14, fontSize: 14, lineHeight: 21 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  shots: { flexDirection: 'row', gap: 10 },
  shot: { width: 84, height: 84, borderRadius: 14, overflow: 'hidden' },
  add: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  shotX: { position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  err: { fontSize: 12, fontWeight: '600', marginTop: 10 },
  btn: { marginTop: 18, height: 50, borderRadius: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  doneBox: { alignItems: 'center', paddingVertical: 20 },
});
