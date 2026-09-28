// Fleet wallet, payouts and transaction history (native port of vendor/web
// WalletPayoutScreen.tsx; balances are derived — see utils/wallet.ts).
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useVendorData } from '../context/VendorData';
import { Badge, Button, Card, EmptyState, Notice, Row, Screen, Segmented, Sheet, TextField } from '../components/ui';
import { MIN_PAYOUT, requestVendorPayout, validateVendorPayout, VendorActionError } from '../services/vendorService';
import { walletTransactions } from '../utils/wallet';
import { validateUpi } from '../utils/validation';
import { formatINR } from '../utils/format';
import { describeDataError } from '../utils/retry';
import { colors, space, type } from '../theme';

export function WalletScreen() {
  const { wallet, bookings, payouts, profile } = useVendorData();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const txns = useMemo(() => walletTransactions(bookings, payouts, profile.commissionRate), [bookings, payouts, profile.commissionRate]);

  return (
    <Screen edges={[]}>
      {open ? (
        <PayoutSheet
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            setDone(true);
          }}
        />
      ) : null}
      <Card>
        <Text style={type.tiny}>AVAILABLE TO WITHDRAW</Text>
        <Text style={styles.balance}>{formatINR(wallet.available)}</Text>
        <Text style={type.small}>
          {formatINR(wallet.pending)} pending · {formatINR(wallet.paidOut)} paid out
        </Text>
        <Button title="Request payout" disabled={wallet.available < MIN_PAYOUT} onPress={() => setOpen(true)} style={{ marginTop: space.md }} />
        {wallet.available < MIN_PAYOUT ? <Text style={[type.small, { marginTop: space.sm }]}>Payouts can be requested once your balance reaches {formatINR(MIN_PAYOUT)}.</Text> : null}
      </Card>
      {done ? <Notice tone="success" message="Payout request submitted. The NESAM finance team will process it and share the UTR." /> : null}

      <Card>
        <Text style={[type.h3, { marginBottom: space.sm }]}>Earnings summary</Text>
        <Row label="Completed trips" value={String(wallet.completedTrips)} />
        <Row label="Gross fares" value={formatINR(wallet.grossFares)} />
        <Row label={`Platform commission (${Math.round(profile.commissionRate * 100)}%)`} value={`− ${formatINR(wallet.commission)}`} />
        <Row label="Toll & parking reimbursed" value={`+ ${formatINR(wallet.tolls)}`} />
        <Row label="Net fleet earnings" value={formatINR(wallet.netEarnings + wallet.tolls)} bold />
        <Row label="This month (net)" value={formatINR(wallet.monthNet)} />
        <Text style={[type.tiny, { marginTop: space.sm }]}>Net payout per trip is the rate you accepted; commission is the difference from the customer fare.</Text>
      </Card>

      <Card>
        <Text style={type.h3}>Settlement account</Text>
        <Text style={[type.body, { marginTop: 4 }]}>{profile.bankAccountName || 'Not on file'}</Text>
        <Text style={type.small}>
          {profile.bankAccountNumber} {profile.ifscCode ? `· ${profile.ifscCode}` : ''}
        </Text>
        {profile.upiId ? <Text style={type.small}>UPI {profile.upiId}</Text> : null}
        <Text style={[type.tiny, { marginTop: 4 }]}>Bank changes after approval are handled by NESAM support.</Text>
      </Card>

      <Text style={[type.h3, styles.section]}>Transactions</Text>
      {txns.length === 0 ? (
        <EmptyState title="No transactions yet" message="Trip credits and payouts appear here." />
      ) : (
        txns.map((t) => (
          <View key={t.id} style={styles.txn}>
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{t.title}</Text>
              <Text style={type.tiny} numberOfLines={1}>
                {t.subtitle}
              </Text>
              {t.atMs ? <Text style={type.tiny}>{new Date(t.atMs).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text style={[styles.amount, { color: t.kind === 'credit' ? colors.success : colors.ink }]}>
                {t.kind === 'credit' ? '+' : '−'} {formatINR(t.amount)}
              </Text>
              {t.kind === 'debit' ? <Badge label={t.status} tone={t.status === 'Paid' ? 'success' : t.status === 'Pending' ? 'warning' : 'neutral'} /> : null}
            </View>
          </View>
        ))
      )}
    </Screen>
  );
}

function PayoutSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { identity, wallet, profile } = useVendorData();
  const [amount, setAmount] = useState(String(wallet.available));
  const [method, setMethod] = useState<'UPI' | 'Bank Transfer'>(profile.upiId ? 'UPI' : 'Bank Transfer');
  const [upiId, setUpiId] = useState(profile.upiId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const value = Number(amount);
    const invalid = validateVendorPayout(value, wallet.available);
    if (invalid) return setError(invalid);
    if (method === 'UPI') {
      const upiErr = upiId.trim() ? validateUpi(upiId) : 'Enter a UPI ID.';
      if (upiErr) return setError(upiErr);
    }
    if (method === 'Bank Transfer' && !profile.bankAccountNumber) return setError('No bank account on file. Contact NESAM support.');
    const details = method === 'UPI' ? upiId.trim() : `${profile.bankAccountName} · ${profile.bankAccountNumber} · ${profile.ifscCode}`;
    setBusy(true);
    setError('');
    try {
      await requestVendorPayout(identity, value, wallet.available, method, details);
      onDone();
    } catch (e) {
      setError(e instanceof VendorActionError ? e.message : describeDataError(e));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Sheet visible onClose={onClose} title="Request payout" dismissible={!busy}>
      <Text style={[type.small, { marginBottom: space.md }]}>
        Available {formatINR(wallet.available)} · minimum {formatINR(MIN_PAYOUT)}
      </Text>
      <TextField label="Amount (₹)" value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" />
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
        <TextField label="UPI ID" value={upiId} onChangeText={(t) => setUpiId(t.trim())} autoCapitalize="none" placeholder="business@okhdfcbank" />
      ) : (
        <Card>
          <Text style={type.body}>{profile.bankAccountName || 'No account on file'}</Text>
          <Text style={type.small}>
            {profile.bankAccountNumber} {profile.ifscCode}
          </Text>
        </Card>
      )}
      <Notice message={error} />
      <Button title={busy ? 'Submitting…' : 'Confirm request'} loading={busy} onPress={() => void submit()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  balance: { fontSize: 32, fontWeight: '900', color: colors.ink, marginVertical: 4 },
  section: { marginTop: space.md, marginBottom: space.sm },
  txn: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  amount: { fontSize: 15, fontWeight: '900' },
});
