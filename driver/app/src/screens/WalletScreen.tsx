// Wallet, payout requests and trip credits (port of driver/web WalletPayoutScreen.tsx).
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDriverData } from '../context/DriverData';
import { Badge, Button, Card, EmptyState, Notice, Segmented, Sheet, TextField } from '../components/ui';
import { DriverActionError, MIN_PAYOUT, requestPayout, validatePayoutAmount } from '../services/driverService';
import { UPI_RE } from '../validation/kyc';
import { formatINR } from '../utils/format';
import { describeError } from '../utils/retry';
import { colors, space, type } from '../theme';

export function WalletScreen() {
  const { account, wallet, payouts, completedTrips } = useDriverData();
  const { driver, bank } = account;
  const [open, setOpen] = useState(false);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {open ? <PayoutSheet key="payout" onClose={() => setOpen(false)} /> : null}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.h1}>Wallet</Text>
        <Card>
          <Text style={type.tiny}>AVAILABLE TO WITHDRAW</Text>
          <Text style={styles.balance}>{formatINR(wallet.availableBalance)}</Text>
            <Text style={type.small}>Withdrawals include settled non-cash independent trips only. Fleet earnings are paid through your vendor.</Text>
          <Text style={type.small}>
            {formatINR(wallet.pendingPayouts)} in pending requests • {formatINR(wallet.totalPaidOut)} paid out
          </Text>
          <Button title="Request payout" disabled={wallet.availableBalance < MIN_PAYOUT} onPress={() => setOpen(true)} style={{ marginTop: space.md }} />
          {wallet.availableBalance < MIN_PAYOUT ? <Text style={[type.small, { marginTop: space.sm }]}>You can request a payout once your balance reaches {formatINR(MIN_PAYOUT)}.</Text> : null}
        </Card>

        <Card>
          <Text style={type.h3}>Payout account</Text>
          <Text style={[type.body, { marginTop: 4 }]}>{bank.accountHolder || 'No account on file'}</Text>
          {bank.accountNumber ? (
            <Text style={type.small}>
              A/c ••••{bank.accountNumber.slice(-4)} • {bank.ifsc}
              {bank.bankName ? ` • ${bank.bankName}` : ''}
            </Text>
          ) : null}
          {bank.upiId ? <Text style={type.small}>UPI {bank.upiId}</Text> : null}
          <Text style={[type.tiny, { marginTop: 4 }]}>Change it from Profile › Contact & bank.</Text>
        </Card>

        <Text style={[type.h3, styles.section]}>Payout requests</Text>
        {payouts.length === 0 ? (
          <EmptyState title="No payout requests yet" />
        ) : (
          payouts.map((po) => (
            <Card key={po.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>{po.method}</Text>
                <Text style={type.small} numberOfLines={1}>
                  {po.details}
                </Text>
                <Text style={type.tiny}>Requested {po.requestedAt}</Text>
                {po.utr ? <Text style={type.tiny}>UTR {po.utr}</Text> : null}
                {po.processedAt ? <Text style={type.tiny}>Processed {new Date(po.processedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={type.h3}>{formatINR(po.amount)}</Text>
                <Badge label={po.status} tone={po.status === 'Paid' ? 'success' : po.status === 'Pending' ? 'warning' : 'neutral'} />
              </View>
            </Card>
          ))
        )}

        <Text style={[type.h3, styles.section]}>Trip credits</Text>
        {completedTrips.length === 0 ? (
          <EmptyState title="No credits yet" message="Earnings from completed trips appear here." />
        ) : (
          completedTrips.slice(0, 30).map((t) => (
            <View key={t.id} style={styles.credit}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>Trip {t.bookingId}</Text>
                <Text style={type.tiny}>{t.completedAt?.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
              </View>
              <Text style={styles.creditAmt}>+ {formatINR(t.driverEarnings + t.tollCharges)}</Text>
            </View>
          ))
        )}
        <Text style={[type.tiny, { marginTop: space.md }]}>Driver ID {driver.id.slice(0, 8).toUpperCase()}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function PayoutSheet({ onClose }: { onClose: () => void }) {
  const { account, wallet } = useDriverData();
  const { driver, bank } = account;
  const [amount, setAmount] = useState(String(wallet.availableBalance));
  const [method, setMethod] = useState<'UPI' | 'Bank Transfer'>(bank.upiId ? 'UPI' : 'Bank Transfer');
  const [upiId, setUpiId] = useState(bank.upiId);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const value = Number(amount);
    const invalid = validatePayoutAmount(value, wallet.availableBalance);
    if (invalid) return setError(invalid);
    if (method === 'UPI' && !UPI_RE.test(upiId.trim())) return setError('Enter a valid UPI ID.');
    if (method === 'Bank Transfer' && !bank.accountNumber) return setError('No bank account on file. Add one from your profile.');
    const details = method === 'UPI' ? upiId.trim() : `${bank.accountHolder} • A/c ••••${bank.accountNumber.slice(-4)} • ${bank.ifsc}`;
    setSubmitting(true);
    setError('');
    try {
      await requestPayout(driver, value, wallet.availableBalance, method, details);
      setDone(true);
    } catch (e) {
      setError(e instanceof DriverActionError ? e.message : describeError(e, 'Could not submit the payout request.'));
    } finally {
      setSubmitting(false);
    }
    return undefined;
  };

  return (
    <Sheet visible onClose={onClose} title="Request payout" dismissible={!submitting}>
      {done ? (
        <>
          <Notice tone="success" message="Payout request submitted. The NESAM finance team will process it shortly." />
          <Button title="Done" onPress={onClose} />
        </>
      ) : (
        <>
          <Text style={[type.small, { marginBottom: space.md }]}>Available {formatINR(wallet.availableBalance)} · minimum {formatINR(MIN_PAYOUT)}</Text>
          <TextField label="Amount (₹)" value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, '').slice(0, 7))} keyboardType="number-pad" />
          <Segmented
            options={[
              { value: 'UPI', label: 'UPI' },
              { value: 'Bank Transfer', label: 'Bank (NEFT/IMPS)' },
            ]}
            value={method}
            onChange={setMethod}
          />
          <View style={{ height: space.md }} />
          {method === 'UPI' ? (
            <TextField label="UPI ID" value={upiId} onChangeText={(t) => setUpiId(t.trim())} autoCapitalize="none" placeholder="name@okaxis" />
          ) : (
            <Card>
              <Text style={type.body}>{bank.accountHolder || 'No account on file'}</Text>
              {bank.accountNumber ? (
                <Text style={type.small}>
                  A/c ••••{bank.accountNumber.slice(-4)} • {bank.ifsc}
                </Text>
              ) : null}
            </Card>
          )}
          <Notice message={error} />
          <Button title={submitting ? 'Submitting…' : 'Confirm request'} loading={submitting} onPress={() => void submit()} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  balance: { fontSize: 32, fontWeight: '900', color: colors.ink, marginVertical: 4 },
  section: { marginTop: space.md, marginBottom: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  credit: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  creditAmt: { fontWeight: '900', color: colors.success },
});
