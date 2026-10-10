// Wallet, payout requests and ledger (port of driver/web WalletPayoutScreen.tsx).
// Every number here is the server's (wallets/driver_{uid}, wallet_ledger); the
// app never computes a balance.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDriverData } from '../context/DriverData';
import { Badge, Button, Card, EmptyState, Notice, Segmented, Sheet, TextField } from '../components/ui';
import { DriverActionError, MIN_PAYOUT, requestPayout, validatePayoutAmount } from '../services/driverService';
import { formatINR } from '../utils/format';
import { formatDateTime12 } from '../utils/time';
import { describeError } from '../utils/retry';
import { colors, space, type } from '../theme';

const ENTRY_LABEL: Record<string, string> = {
  trip_earning: 'Trip earning',
  toll_reimbursement: 'Toll reimbursement',
  cash_collected: 'Cash fare you collected',
  payout: 'Payout',
};
const ENTRY_STATUS: Record<string, string> = {
  pending: 'Awaiting customer payment',
  available: 'Available',
  reserved: 'Held for payout',
  completed: 'Completed',
  cancelled: 'Released',
};

export function WalletScreen() {
  const { account, wallet, walletError, payouts, ledger } = useDriverData();
  const { driver, bank } = account;
  const [open, setOpen] = useState(false);
  const withdrawable = Math.max(0, Math.floor(wallet.available));
  const fleet = !!driver.vendorId;

  if (fleet && ledger.length === 0 && payouts.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={type.h1}>Wallet</Text>
          <Card>
            <Text style={type.h3}>Settled by your fleet</Text>
            <Text style={[type.body, { marginTop: 4 }]}>
              You drive for {driver.vendorName || 'a fleet operator'}. They receive the payout for your trips and pay you directly, so NESAM does not keep a
              wallet balance for you.
            </Text>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {open ? <PayoutSheet key="payout" withdrawable={withdrawable} onClose={() => setOpen(false)} /> : null}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.h1}>Wallet</Text>
        <Notice message={walletError} />
        <Card>
          <Text style={type.tiny}>AVAILABLE TO WITHDRAW</Text>
          <Text style={[styles.balance, wallet.available < 0 && { color: colors.danger }]}>{formatINR(wallet.available)}</Text>
          {wallet.available < 0 ? (
            <Text style={[type.small, { color: colors.danger }]}>Cash fares you collected exceed your earnings; upcoming earnings settle this first.</Text>
          ) : null}
          <Text style={type.small}>
            {formatINR(wallet.pending)} awaiting customer payment • {formatINR(wallet.reserved)} held for requests • {formatINR(wallet.paidOut)} paid out
          </Text>
          <Button title="Request payout" disabled={withdrawable < MIN_PAYOUT} onPress={() => setOpen(true)} style={{ marginTop: space.md }} />
          {withdrawable < MIN_PAYOUT ? (
            <Text style={[type.small, { marginTop: space.sm }]}>You can request a payout once your available balance reaches {formatINR(MIN_PAYOUT)}.</Text>
          ) : null}
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
          <Text style={[type.tiny, { marginTop: 4 }]}>NESAM pays only to this saved account. Change it from Profile › Contact & bank.</Text>
        </Card>

        <Text style={[type.h3, styles.section]}>Payout requests</Text>
        {payouts.length === 0 ? (
          <EmptyState title="No payout requests yet" />
        ) : (
          payouts.map((po) => (
            <Card key={po.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>{po.method}</Text>
                {po.details ? (
                  <Text style={type.small} numberOfLines={1}>
                    {po.details}
                  </Text>
                ) : null}
                <Text style={type.tiny}>Requested {po.requestedAt}</Text>
                {po.utr ? <Text style={type.tiny}>UTR {po.utr}</Text> : null}
                {po.processedAt ? <Text style={type.tiny}>Processed {formatDateTime12(po.processedAt)}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={type.h3}>{formatINR(po.amount)}</Text>
                <Badge label={po.status} tone={po.status === 'Paid' ? 'success' : po.status === 'Pending' ? 'warning' : 'neutral'} />
              </View>
            </Card>
          ))
        )}

        <Text style={[type.h3, styles.section]}>Ledger</Text>
        {ledger.length === 0 ? (
          <EmptyState title="No entries yet" message="Earnings, cash collected and payouts recorded by NESAM appear here." />
        ) : (
          ledger.slice(0, 50).map((e) => (
            <View key={e.id} style={styles.credit}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>
                  {ENTRY_LABEL[e.type] ?? e.type}
                  {e.bookingCode ? ` · ${e.bookingCode}` : ''}
                </Text>
                <Text style={type.tiny}>
                  {e.createdAt ? formatDateTime12(e.createdAt) : ''}
                  {ENTRY_STATUS[e.status] ? ` · ${ENTRY_STATUS[e.status]}` : ''}
                </Text>
              </View>
              <Text style={[styles.creditAmt, e.direction === 'debit' && { color: colors.danger }]}>
                {e.direction === 'debit' ? '− ' : '+ '}
                {formatINR(e.amount)}
              </Text>
            </View>
          ))
        )}
        <Text style={[type.tiny, { marginTop: space.md }]}>Driver ID {driver.id.slice(0, 8).toUpperCase()}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function PayoutSheet({ withdrawable, onClose }: { withdrawable: number; onClose: () => void }) {
  const { account } = useDriverData();
  const { bank } = account;
  const [amount, setAmount] = useState(String(withdrawable));
  const [method, setMethod] = useState<'UPI' | 'Bank Transfer'>(bank.accountNumber || !bank.upiId ? 'Bank Transfer' : 'UPI');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const value = Number(amount);
    const invalid = validatePayoutAmount(value, withdrawable);
    if (invalid) return setError(invalid);
    // The server pays only to the account saved in the profile.
    if (method === 'UPI' && !bank.upiId) return setError('No UPI ID in your profile. Add one from Profile first.');
    if (method === 'Bank Transfer' && !bank.accountNumber) return setError('No bank account in your profile. Add one from Profile first.');
    setSubmitting(true);
    setError('');
    try {
      await requestPayout(value, withdrawable, method);
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
          <Notice tone="success" message="Payout request submitted. The amount is held from your balance until NESAM finance pays it." />
          <Button title="Done" onPress={onClose} />
        </>
      ) : (
        <>
          <Text style={[type.small, { marginBottom: space.md }]}>
            Available {formatINR(withdrawable)} · minimum {formatINR(MIN_PAYOUT)}
          </Text>
          <TextField label="Amount (₹)" value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, '').slice(0, 7))} keyboardType="number-pad" />
          <Segmented
            options={[
              { value: 'Bank Transfer', label: 'Bank (NEFT/IMPS)' },
              { value: 'UPI', label: 'UPI' },
            ]}
            value={method}
            onChange={setMethod}
          />
          <Card style={{ marginTop: space.md }}>
            <Text style={type.tiny}>PAID TO</Text>
            {method === 'UPI' ? (
              <Text style={type.body}>{bank.upiId || 'No UPI ID in your profile'}</Text>
            ) : (
              <>
                <Text style={type.body}>{bank.accountHolder || 'No account on file'}</Text>
                {bank.accountNumber ? (
                  <Text style={type.small}>
                    A/c ••••{bank.accountNumber.slice(-4)} • {bank.ifsc}
                  </Text>
                ) : null}
              </>
            )}
          </Card>
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
