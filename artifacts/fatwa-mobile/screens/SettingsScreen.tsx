import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SectionTitle, uiStyles } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useNav } from '@/lib/nav';
import { useApp } from '@/lib/store';

export default function SettingsScreen() {
  const colors = useColors();
  const nav = useNav();
  const { settings, setSettings, prayerCity } = useApp();

  return (
    <View style={uiStyles.screenPadding}>
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>PREFERENCES</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Manage alerts, adhan sound, and prayer tools.</Text>
      </View>

      <SectionTitle title="Notifications" />
      <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Feather name="bell" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]}>Push notifications</Text>
          <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>Receive answers and Fatwa updates</Text>
        </View>
        <Switch
          value={settings.notificationsEnabled}
          onValueChange={(value) => setSettings({ notificationsEnabled: value })}
          trackColor={{ false: colors.border, true: colors.teal }}
          thumbColor="#FFFFFF"
        />
      </View>

      <SectionTitle title="Prayer tools" />
      <Pressable
        onPress={() => nav.push({ name: 'prayerSettings' })}
        style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons name="compass-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]}>Qibla & Adhan alarms</Text>
          <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>Prayer city: {prayerCity.name}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>

      <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <MaterialCommunityIcons name="volume-high" size={19} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]}>Adhan sound</Text>
          <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]}>Play sound when an alarm is due</Text>
        </View>
        <Switch
          value={settings.adhanSound}
          onValueChange={(value) => setSettings({ adhanSound: value })}
          trackColor={{ false: colors.border, true: colors.teal }}
          thumbColor="#FFFFFF"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: 8, marginBottom: 18 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 12.5, lineHeight: 19, marginTop: 6 },
  row: { borderRadius: 18, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 11 },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 13.5, fontWeight: '700', marginBottom: 3 },
  rowSubtitle: { fontSize: 11.5 },
});
