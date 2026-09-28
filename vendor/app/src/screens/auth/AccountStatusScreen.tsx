// Pending / rejected / suspended (native port of vendor/web AccountStatusScreen.tsx).
import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { VendorRecord } from '../../types/vendor';
import { SECTION_LABELS } from '../../config/onboarding';
import { Button, Card, Notice, Screen } from '../../components/ui';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../../config/constants';
import { colors, space, type } from '../../theme';

const LOCKED = ['Add & manage fleet vehicles', 'Onboard and assign drivers', 'Accept trips & bid in the marketplace', 'Earnings, wallet & payouts'];

function Hero({ icon, color, title, body }: { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; body: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[styles.icon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={34} color={color} />
      </View>
      <Text style={[type.h1, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.small, { textAlign: 'center', marginTop: space.sm }]}>{body}</Text>
    </View>
  );
}

function Footer({ onSignOut }: { onSignOut: () => void }) {
  return (
    <View style={styles.footer}>
      <Button title={`Call partner support (${SUPPORT_PHONE_DISPLAY})`} variant="secondary" onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
      <Button title="Sign out" variant="ghost" onPress={onSignOut} style={{ marginTop: space.sm }} />
    </View>
  );
}

export function AccountStatusScreen({ record, onSignOut, onReapply }: { record: VendorRecord; onSignOut: () => void; onReapply?: () => void }) {
  const businessName = record.business?.businessName || 'your business';

  if (record.status === 'SUSPENDED') {
    return (
      <Screen>
        <Card style={styles.card}>
          <Hero icon="ban" color={colors.muted} title="Account suspended" body={`Operations for ${businessName} are paused by the NESAM team. Contact partner support to resolve this.`} />
          {record.review?.note ? <Notice tone="warning" message={record.review.note} style={{ marginTop: space.lg }} /> : null}
          <Footer onSignOut={onSignOut} />
        </Card>
      </Screen>
    );
  }

  if (record.status === 'REJECTED') {
    return (
      <Screen>
        <Card style={styles.card}>
          <Hero icon="close-circle" color={colors.danger} title="Application not approved" body={`We couldn’t approve ${businessName} with the information provided.`} />
          {record.review?.note ? <Notice message={`Reason from the verification team: ${record.review.note}`} style={{ marginTop: space.lg }} /> : null}
          {record.review?.flaggedSections.length ? (
            <Text style={[type.small, { marginTop: space.sm }]}>Sections to fix: {record.review.flaggedSections.map((s) => SECTION_LABELS[s]).join(', ')}</Text>
          ) : null}
          {onReapply ? <Button title="Correct details & reapply" onPress={onReapply} style={{ marginTop: space.lg }} /> : null}
          <Footer onSignOut={onSignOut} />
        </Card>
      </Screen>
    );
  }

  const submitted = record.submittedAt ? new Date(record.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  return (
    <Screen>
      <Card style={styles.card}>
        <Hero
          icon="time"
          color={colors.warning}
          title="Verification pending"
          body={`Thanks for applying, ${record.business?.vendorName?.split(' ')[0] || 'partner'}! Our team is reviewing the details and documents for ${businessName}. Usually 24–48 business hours.`}
        />
        <View style={styles.steps}>
          <Step done label="Application submitted" sub={submitted} />
          <Step active label="Documents under review" sub="Usually within 24–48 business hours" />
          <Step label="Account activated" sub="You’ll be taken to your dashboard automatically" />
        </View>
        <View style={styles.locked}>
          <Text style={type.tiny}>UNLOCKS AFTER APPROVAL</Text>
          {LOCKED.map((l) => (
            <View key={l} style={styles.lockRow}>
              <Ionicons name="lock-closed" size={12} color={colors.faint} />
              <Text style={type.small}>{l}</Text>
            </View>
          ))}
        </View>
        <Text style={[type.tiny, { textAlign: 'center', marginTop: space.md, color: colors.success }]}>This screen updates automatically when your status changes</Text>
        <Footer onSignOut={onSignOut} />
      </Card>
    </Screen>
  );
}

function Step({ label, sub, done, active }: { label: string; sub?: string; done?: boolean; active?: boolean }) {
  return (
    <View style={styles.step}>
      <Ionicons name={done ? 'checkmark-circle' : active ? 'time' : 'lock-closed'} size={20} color={done ? colors.success : active ? colors.warning : colors.faint} />
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { fontWeight: '700', color: done || active ? colors.ink : colors.faint }]}>{label}</Text>
        {sub ? <Text style={type.tiny}>{sub}</Text> : null}
      </View>
    </View>
  );
}

export function LoadErrorScreen({ message, onRetry, onSignOut }: { message: string; onRetry: () => void; onSignOut: () => void }) {
  return (
    <Screen>
      <Card style={styles.card}>
        <Text style={type.h2}>Couldn’t load your account</Text>
        <Notice message={message} style={{ marginTop: space.md }} />
        <Button title="Try again" onPress={onRetry} />
        <Button title="Sign out" variant="secondary" onPress={onSignOut} style={{ marginTop: space.sm }} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space.xl },
  icon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  steps: { marginTop: space.lg, gap: space.md },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  locked: { marginTop: space.lg, backgroundColor: colors.bg, borderRadius: 12, padding: space.md, gap: 6 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  footer: { marginTop: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
