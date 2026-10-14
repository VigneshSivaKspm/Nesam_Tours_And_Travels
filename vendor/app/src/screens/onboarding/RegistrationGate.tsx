// Shown to a signed-in phone number that has no vendor account (spec page 13):
// "request registration in the Vendor app; the office issues a one-time
// invitation link". The invitation is redeemed here (or by opening the link);
// redeeming creates the application, and the vendors/{uid} listener then moves
// the app on to the onboarding wizard.
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getRegistrationRequest, redeemVendorInvitation, requestVendorRegistration, type RegistrationState } from '../../services/onboardingService';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../../config/constants';
import { describeDataError } from '../../utils/retry';
import { Button, Card, Notice, TextField } from '../../components/ui';
import { colors, space, type } from '../../theme';

/** Accepts a bare code or a pasted/deep link ("…?invite=CODE"). */
export function inviteTokenFrom(input: string): string {
  const s = input.trim();
  const m = /[?&#]invite=([A-Za-z0-9_-]+)/.exec(s);
  const t = m ? m[1]! : s;
  return /^[A-Za-z0-9_-]{20,64}$/.test(t) ? t : '';
}

export function RegistrationGate({ phone, onSignOut }: { phone: string; onSignOut: () => void }) {
  const [state, setState] = useState<RegistrationState | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'request' | 'redeem' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void getRegistrationRequest().then((r) => {
      if (alive && r) setState(r.status === 'Invited' ? 'invited' : 'requested');
    });
    return () => {
      alive = false;
    };
  }, []);

  const redeem = useCallback(async (raw: string) => {
    const token = inviteTokenFrom(raw);
    if (!token) {
      setError('That does not look like a NESAM invitation link or code. Paste the whole link you received.');
      return;
    }
    setBusy('redeem');
    setError('');
    try {
      await redeemVendorInvitation(token);
      // vendors/{uid} now exists; the gatekeeper's listener opens the wizard.
    } catch (e) {
      setError(describeDataError(e));
      setBusy(null);
    }
  }, []);

  // An invitation link opened on this phone (nesamvendor://…?invite=CODE) redeems itself.
  useEffect(() => {
    let alive = true;
    const handle = (url: string | null) => {
      if (!alive || !url) return;
      const token = inviteTokenFrom(url);
      if (token) {
        setCode(token);
        void redeem(token);
      }
    };
    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => {
      alive = false;
      sub.remove();
    };
  }, [redeem]);

  const request = async () => {
    setBusy('request');
    setError('');
    try {
      setState(await requestVendorRegistration());
    } catch (e) {
      setError(describeDataError(e));
    } finally {
      setBusy(null);
    }
  };

  const requested = state === 'requested' || state === 'invited';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Ionicons name="business" size={44} color={colors.primary} />
          <Text style={[type.h2, { textAlign: 'center', marginTop: space.sm }]}>Become a NESAM fleet partner</Text>
          <Text style={[type.small, { textAlign: 'center', marginTop: 4 }]}>
            Vendor accounts are opened by invitation. {phone} has no vendor account yet.
          </Text>
        </View>

        <Card>
          <Text style={type.h3}>1. Request registration</Text>
          {requested ? (
            <Notice
              tone="success"
              message={state === 'invited' ? 'NESAM has issued an invitation for your number. Paste the link or code below.' : 'Request received. NESAM will contact you with a one-time invitation link.'}
            />
          ) : (
            <>
              <Text style={[type.small, { marginVertical: space.sm }]}>Tell NESAM you want to register {phone}. The office will send you a one-time invitation link.</Text>
              <Button title={busy === 'request' ? 'Sending…' : 'Request registration'} loading={busy === 'request'} onPress={() => void request()} />
            </>
          )}
        </Card>

        <Card style={{ marginTop: space.md }}>
          <Text style={type.h3}>2. I have an invitation</Text>
          <Text style={[type.small, { marginVertical: space.sm }]}>Open the link on this phone, or paste the link or code NESAM sent you. It works once, for {phone} only.</Text>
          <TextField label="Invitation link or code" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} placeholder="Paste here" />
          <Button title={busy === 'redeem' ? 'Checking…' : 'Continue'} loading={busy === 'redeem'} disabled={!code.trim()} onPress={() => void redeem(code)} />
        </Card>

        {error ? <Notice message={error} style={{ marginTop: space.md }} /> : null}

        <View style={styles.footer}>
          <Button title={`Call partner support (${SUPPORT_PHONE_DISPLAY})`} variant="secondary" onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
          <Button title="Sign out" variant="ghost" onPress={onSignOut} style={{ marginTop: space.sm }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  hero: { alignItems: 'center', marginVertical: space.lg },
  footer: { marginTop: space.xl },
});
