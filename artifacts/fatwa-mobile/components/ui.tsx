import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type Colors = ReturnType<typeof useColors>;

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <Image
      source={require('../assets/images/icon.png')}
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
      accessibilityLabel="Fatwa logo"
    />
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
        ) : null}
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.actionText, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Pill({
  label,
  icon,
  tone = 'primary',
}: {
  label: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  tone?: 'primary' | 'gold' | 'muted';
}) {
  const colors = useColors();
  const map = {
    primary: { bg: colors.primarySoft, fg: colors.primary },
    gold: { bg: colors.goldSoft, fg: colors.gold },
    muted: { bg: colors.muted, fg: colors.mutedForeground },
  } as const;
  const toneColors = map[tone];
  return (
    <View style={[styles.pill, { backgroundColor: toneColors.bg }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={12} color={toneColors.fg} /> : null}
      <Text style={[styles.pillText, { color: toneColors.fg }]}>{label}</Text>
    </View>
  );
}

export function StatChip({
  icon,
  label,
  active,
  onPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  active?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const tint = active ? colors.primary : colors.mutedForeground;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={6}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.statChip, { opacity: pressed && onPress ? 0.6 : 1 }]}
    >
      <Feather name={icon} size={15} color={tint} />
      <Text style={[styles.statText, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  disabled,
  loading,
  testID,
}: {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor: colors.primary,
          shadowColor: colors.shadow,
          shadowOpacity: disabled ? 0 : 0.14,
          shadowRadius: 9,
          shadowOffset: { width: 0, height: 4 },
          elevation: disabled ? 0 : 3,
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed && !disabled ? 0.99 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primaryForeground} size="small" />
      ) : (
        <>
          {icon ? <Feather name={icon} size={17} color={colors.primaryForeground} /> : null}
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function GhostButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.ghostButton,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.82 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      {icon ? <Feather name={icon} size={16} color={colors.foreground} /> : null}
      <Text style={[styles.ghostButtonText, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({
  icon,
  title,
  copy,
  action,
  onAction,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  copy: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <Feather name={icon} size={24} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>{copy}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} style={styles.emptyAction} accessibilityRole="button">
          <Text style={[styles.actionText, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function InfoBanner({
  icon,
  text,
  tone = 'primary',
}: {
  icon: keyof typeof Feather.glyphMap;
  text: string;
  tone?: 'primary' | 'gold';
}) {
  const colors = useColors();
  const bg = tone === 'gold' ? colors.goldSoft : colors.primarySoft;
  const fg = tone === 'gold' ? colors.gold : colors.secondaryForeground;
  return (
    <View style={[styles.infoBanner, { backgroundColor: bg }]}>
      <Feather name={icon} size={15} color={tone === 'gold' ? colors.gold : colors.primary} />
      <Text style={[styles.infoText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function HeroCard({
  eyebrow,
  title,
  subtitle,
  icon,
  actionLabel,
  onAction,
  testID,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  actionLabel: string;
  onAction: () => void;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <LinearGradient
      colors={[colors.forest, colors.green, colors.teal]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.heroText}>
        <View style={styles.heroPill}>
          <View style={styles.heroPillDot} />
          <Text style={styles.heroPillText}>{eyebrow.toUpperCase()}</Text>
        </View>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          testID={testID}
          style={({ pressed }) => [styles.heroButton, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Feather name="edit-3" size={15} color={colors.forest} />
          <Text style={[styles.heroButtonText, { color: colors.forest }]}>{actionLabel}</Text>
          <Feather name="arrow-up-right" size={15} color={colors.forest} />
        </Pressable>
      </View>
      <View style={styles.heroArt} pointerEvents="none">
        <View style={[styles.heroMoon, { backgroundColor: colors.gold }]} />
        <MaterialCommunityIcons name={icon} size={112} color="#FFFFFF" style={styles.heroIcon} />
        <View style={styles.heroHorizon} />
      </View>
    </LinearGradient>
  );
}

export function Avatar({
  size = 40,
  icon = 'user',
}: {
  size?: number;
  icon?: keyof typeof Feather.glyphMap;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primarySoft,
        },
      ]}
    >
      <Feather name={icon} size={size * 0.45} color={colors.primary} />
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  screenPadding: { paddingHorizontal: 18, paddingBottom: 30 },
  card: { borderRadius: 22, borderWidth: 1 },
});

const styles = StyleSheet.create({
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 13, gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.35 },
  sectionSubtitle: { fontSize: 11.5, marginTop: 4 },
  actionText: { fontSize: 12.5, fontWeight: '800' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3 },
  statText: { fontSize: 11.5, fontWeight: '600' },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
  },
  primaryButtonText: { fontSize: 14.5, fontWeight: '700' },
  ghostButton: {
    minHeight: 50,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  ghostButtonText: { fontSize: 13.5, fontWeight: '600' },
  emptyState: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  emptyCopy: { fontSize: 12.5, lineHeight: 19, textAlign: 'center', maxWidth: 270 },
  emptyAction: { marginTop: 14, paddingVertical: 6, paddingHorizontal: 10 },
  infoBanner: {
    borderRadius: 15,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  infoText: { fontSize: 11.5, lineHeight: 17, flex: 1 },
  hero: {
    borderRadius: 26,
    minHeight: 184,
    padding: 18,
    marginBottom: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    position: 'relative',
  },
  heroText: { width: '70%', zIndex: 2 },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  heroPillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#B6F1D6' },
  heroPillText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.1, color: '#E3F6ED' },
  heroTitle: { fontSize: 21, fontWeight: '800', color: '#FFFFFF', lineHeight: 26, letterSpacing: -0.3, maxWidth: 224 },
  heroSubtitle: { fontSize: 12, lineHeight: 17, color: '#DFF1E9', marginTop: 6, maxWidth: 212 },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 12,
  },
  heroButtonText: { fontSize: 12, fontWeight: '800' },
  heroArt: {
    position: 'absolute',
    right: -12,
    bottom: 0,
    width: 132,
    height: 148,
    justifyContent: 'flex-end',
    alignItems: 'center',
    opacity: 0.94,
  },
  heroMoon: { position: 'absolute', width: 23, height: 23, borderRadius: 12, right: 25, top: 12, opacity: 0.95 },
  heroIcon: { marginBottom: 5, opacity: 0.9 },
  heroHorizon: {
    position: 'absolute',
    height: 22,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(3, 57, 47, 0.4)',
  },
  avatar: { alignItems: 'center', justifyContent: 'center' },
});
