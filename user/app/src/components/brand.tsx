// Brand pieces shared by the redesigned customer screens.
import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { colors, radius, space } from '../theme';

const LOGO = require('../../assets/logo.png') as number;

/** NESAM mark + wordmark, with an optional action on the right (e.g. support). */
export function BrandHeader({ right }: { right?: React.ReactNode }) {
  return (
    <View style={styles.brandRow}>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors accessible={false} />
      <View style={{ flex: 1 }} accessible accessibilityRole="header" accessibilityLabel="NESAM Tours and Travels Private Limited">
        <Text style={styles.word}>NESAM</Text>
        <Text style={styles.sub}>TOURS & TRAVELS</Text>
        <Text style={styles.pvt}>PRIVATE LIMITED</Text>
      </View>
      {right}
    </View>
  );
}

/** Round icon button used in headers. */
export function IconButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}>
      <Ionicons name={icon} size={26} color={colors.ink} />
    </Pressable>
  );
}

/** Back arrow, title and "Step n of 3" for the booking steps. */
export function StepHeader({ title, step, onBack }: { title: string; step: number; onBack: () => void }) {
  return (
    <View style={styles.stepRow}>
      <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
        <Ionicons name="arrow-back" size={26} color={colors.ink} />
      </Pressable>
      <Text style={styles.stepTitle} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.stepCount}>Step {step} of 3</Text>
    </View>
  );
}

/** "Need help booking?" banner with the real support number. */
export function SupportBanner() {
  return (
    <Pressable
      onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)}
      style={({ pressed }) => [styles.support, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`Need help booking? Call NESAM support on ${SUPPORT_PHONE_DISPLAY}`}
    >
      <Ionicons name="headset-outline" size={30} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.supportTitle}>Need help booking?</Text>
        <Text style={styles.supportSub}>Our support team is here to help.</Text>
      </View>
      <Ionicons name="call" size={18} color={colors.primary} />
      <Text style={styles.supportPhone}>{SUPPORT_PHONE_DISPLAY}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  logo: { width: 64, height: 64 },
  word: { fontSize: 28, fontWeight: '900', color: colors.primary, letterSpacing: 0.5, lineHeight: 30 },
  sub: { fontSize: 13, fontWeight: '900', color: colors.ink, letterSpacing: 1 },
  pvt: { fontSize: 10, fontWeight: '700', color: colors.ink, letterSpacing: 2.5 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: colors.ink },
  stepCount: { fontSize: 14, color: colors.slate, fontWeight: '600' },
  support: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: space.lg,
    marginTop: space.lg,
    flexWrap: 'wrap',
  },
  supportTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  supportSub: { fontSize: 13, color: colors.slate, marginTop: 2 },
  supportPhone: { fontSize: 18, fontWeight: '900', color: colors.primary },
});
