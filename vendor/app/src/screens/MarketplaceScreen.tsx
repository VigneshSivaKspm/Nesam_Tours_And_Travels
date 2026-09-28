// Open-trip feed, instant accept and counter-bidding (native port of
// vendor/web MarketplaceBiddingScreen.tsx, wired to the real rules).
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVendorData } from '../context/VendorData';
import { Badge, Button, Card, EmptyState, Notice, Row, Segmented, Sheet, TextField } from '../components/ui';
import { acceptOfferedRate, submitCounterBid, validateCounterRate, VendorActionError, withdrawBid } from '../services/vendorService';
import type { MarketTrip, VendorBid } from '../types/operations';
import { formatINR } from '../utils/format';
import { describeDataError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';

type Tab = 'feed' | 'bids';

export function MarketplaceScreen() {
  const { identity, marketTrips, bids, errors } = useVendorData();
  const [tab, setTab] = useState<Tab>('feed');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [bidTrip, setBidTrip] = useState<MarketTrip | null>(null);

  const pendingByTrip = useMemo(() => {
    const m = new Map<string, VendorBid>();
    for (const b of bids) if (b.status === 'Pending Review' && !m.has(b.tripId)) m.set(b.tripId, b);
    return m;
  }, [bids]);

  const accept = (trip: MarketTrip) =>
    Alert.alert('Accept this trip?', `${trip.route}\nYour payout: ${formatINR(trip.offeredPayout)}\n\nYou will need to dispatch a driver from your fleet.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept trip',
        onPress: () => {
          setBusyId(trip.id);
          setMessage(null);
          acceptOfferedRate(identity, trip)
            .then(() => setMessage({ tone: 'success', text: `Trip ${trip.bookingId} is yours. Dispatch a driver from the Trips tab.` }))
            .catch((e: unknown) => setMessage({ tone: 'error', text: e instanceof VendorActionError ? e.message : describeDataError(e) }))
            .finally(() => setBusyId(null));
        },
      },
    ]);

  const withdraw = (bid: VendorBid) =>
    Alert.alert('Withdraw bid?', `Your counter bid of ${formatINR(bid.vendorCounterRate)} will be removed.`, [
      { text: 'Keep bid', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: () => {
          withdrawBid(bid)
            .then(() => setMessage({ tone: 'success', text: 'Bid withdrawn.' }))
            .catch((e: unknown) => setMessage({ tone: 'error', text: e instanceof VendorActionError ? e.message : describeDataError(e) }));
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {bidTrip ? (
        <BidSheet
          key={bidTrip.id}
          trip={bidTrip}
          onClose={() => setBidTrip(null)}
          onDone={() => {
            setBidTrip(null);
            setMessage({ tone: 'success', text: 'Counter bid submitted. NESAM will review it.' });
          }}
        />
      ) : null}
      <View style={styles.header}>
        <Text style={type.h1}>Marketplace</Text>
        <Text style={[type.small, { marginBottom: space.md }]}>Accept the offered rate instantly or submit a counter bid for NESAM review.</Text>
        <Segmented
          options={[
            { value: 'feed', label: `Open trips (${marketTrips.length})` },
            { value: 'bids', label: `My bids (${bids.length})` },
          ]}
          value={tab}
          onChange={setTab}
        />
        {message ? <Notice tone={message.tone} message={message.text} style={{ marginTop: space.md, marginBottom: 0 }} /> : null}
      </View>

      {tab === 'feed' ? (
        <FlatList
          data={marketTrips}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Notice message={errors.market} />}
          ListEmptyComponent={<EmptyState title="No open trips" message="New trip requests appear here the moment customers book." />}
          renderItem={({ item: t }) => {
            const myBid = pendingByTrip.get(t.id);
            return (
              <Card>
                <View style={styles.rowBetween}>
                  <Text style={type.tiny}>{t.bookingId}</Text>
                  <Badge label={t.vehicleCategory || 'Any vehicle'} tone="warning" />
                </View>
                <Text style={[type.h3, { marginTop: 4 }]}>{t.route}</Text>
                <Text style={type.small} numberOfLines={2}>
                  Pickup: {t.pickup.address}
                </Text>
                <Text style={type.small} numberOfLines={2}>
                  Drop: {t.drop.address}
                </Text>
                <Text style={type.small}>
                  {t.travelDate || 'Date TBC'}
                  {t.pickup.time ? ` · ${t.pickup.time}` : ''}
                  {t.distanceKm ? ` · ${t.distanceKm} km` : ''}
                  {t.service ? ` · ${t.service}` : ''}
                  {t.tripType ? ` · ${t.tripType}` : ''}
                </Text>
                <View style={styles.payRow}>
                  <View>
                    <Text style={type.tiny}>OFFERED PAYOUT</Text>
                    <Text style={styles.payout}>{formatINR(t.offeredPayout)}</Text>
                  </View>
                  {t.bidCount ? <Badge label={`${t.bidCount} bid${t.bidCount > 1 ? 's' : ''}`} tone="info" /> : null}
                </View>
                {myBid ? (
                  <View style={styles.myBid}>
                    <Text style={[type.small, { flex: 1 }]}>Your bid {formatINR(myBid.vendorCounterRate)} is under review.</Text>
                    <Button small variant="ghost" title="Withdraw" onPress={() => withdraw(myBid)} />
                  </View>
                ) : null}
                <View style={styles.actions}>
                  <Button small variant="dark" title="Counter bid" disabled={!!myBid || busyId !== null} onPress={() => setBidTrip(t)} style={{ flex: 1 }} />
                  <Button small title={busyId === t.id ? 'Accepting…' : 'Accept rate'} loading={busyId === t.id} disabled={busyId !== null} onPress={() => accept(t)} style={{ flex: 1 }} />
                </View>
              </Card>
            );
          }}
        />
      ) : (
        <FlatList
          data={bids}
          keyExtractor={(b) => `${b.tripId}/${b.id}`}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Notice message={errors.bids} />}
          ListEmptyComponent={<EmptyState title="No bids yet" message="Counter bids you submit appear here with their review status." />}
          renderItem={({ item: b }) => (
            <Card>
              <View style={styles.rowBetween}>
                <Text style={type.h3}>{b.bookingId}</Text>
                <Badge label={b.status} tone={b.status === 'Accepted' ? 'success' : b.status === 'Pending Review' ? 'warning' : 'neutral'} />
              </View>
              <Row label="Offered payout" value={formatINR(b.offeredPayout)} />
              <Row label="Your counter rate" value={formatINR(b.vendorCounterRate)} bold />
              {b.biddingNote ? <Text style={type.small}>Note: {b.biddingNote}</Text> : null}
              <Text style={type.tiny}>{b.submittedAt ? `Submitted ${b.submittedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Sending…'}</Text>
              {b.status === 'Pending Review' ? <Button small variant="ghost" title="Withdraw bid" onPress={() => withdraw(b)} style={{ alignSelf: 'flex-start' }} /> : null}
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function BidSheet({ trip, onClose, onDone }: { trip: MarketTrip; onClose: () => void; onDone: () => void }) {
  const { identity } = useVendorData();
  const [rate, setRate] = useState(String(Math.round(trip.offeredPayout * 1.1) || ''));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const value = Number(rate);
    const invalid = validateCounterRate(value, trip.offeredPayout);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError('');
    try {
      await submitCounterBid(identity, trip, value, note);
      onDone();
    } catch (e) {
      setError(e instanceof VendorActionError ? e.message : describeDataError(e));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Sheet visible onClose={onClose} title={`Counter bid · ${trip.bookingId}`} dismissible={!busy}>
      <Text style={[type.small, { marginBottom: space.md }]}>
        {trip.route} · offered {formatINR(trip.offeredPayout)}
      </Text>
      <TextField label="Your counter rate (₹)" value={rate} onChangeText={(t) => setRate(t.replace(/\D/g, '').slice(0, 7))} keyboardType="number-pad" />
      <Text style={[type.label, { marginBottom: 6 }]}>Note for NESAM (optional)</Text>
      <TextInput
        value={note}
        onChangeText={(t) => setNote(t.slice(0, 300))}
        placeholder="Vehicle, driver experience, anything that justifies your rate"
        placeholderTextColor={colors.faint}
        multiline
        style={styles.note}
      />
      <Notice message={error} />
      <Button title={busy ? 'Submitting…' : 'Submit counter bid'} loading={busy} onPress={() => void submit()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { padding: space.lg, paddingBottom: space.sm },
  list: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md },
  payout: { fontSize: 22, fontWeight: '900', color: colors.primary },
  myBid: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warningSoft, borderRadius: radius.sm, paddingLeft: space.md, marginTop: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  note: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, minHeight: 72, textAlignVertical: 'top', color: colors.ink, marginBottom: space.md },
});
