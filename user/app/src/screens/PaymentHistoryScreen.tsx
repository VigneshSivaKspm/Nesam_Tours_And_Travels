// Payment history: what each booking cost, what has been paid and refunds,
// from the server-derived payment summary on the customer's own bookings.
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCustomerData } from '../context/CustomerData';
import { EmptyState } from '../components/ui';
import { formatDate, formatINR } from '../utils/format';
import { paymentRows } from '../utils/tripView';
import { colors, radius, space } from '../theme';

export function PaymentHistoryScreen() {
  const navigation = useNavigation();
  const { trips, profile } = useCustomerData();
  const rows = paymentRows(trips);
  const refunds = trips.filter((t) => t.refund && t.refund.amount > 0);

  return (
    <FlatList
      style={{ backgroundColor: colors.page }}
      contentContainerStyle={styles.list}
      data={rows}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={
        <View style={styles.summary}>
          <Text style={styles.sumLabel}>Refund credits</Text>
          <Text style={styles.sumValue}>{formatINR(profile.walletBalance)}</Text>
          <Text style={styles.sumNote}>
            {refunds.length ? `${refunds.length} refund${refunds.length === 1 ? '' : 's'} on cancelled bookings below.` : 'Refunds for cancelled bookings appear here.'}
          </Text>
        </View>
      }
      ListEmptyComponent={<EmptyState title="No payments yet" message="Completed trips and any refunds will be listed here." />}
      renderItem={({ item: t }) => {
        const when = t.completedAt ?? t.cancelledAt ?? t.createdAt;
        const total = t.status === 'Completed' ? t.fare + t.tollCharges : t.cancellationFee;
        return (
          <Pressable style={styles.row} onPress={() => navigation.navigate('ActiveRide', { bookingId: t.id })} accessibilityRole="button" accessibilityLabel={`Booking ${t.bookingId}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.route} numberOfLines={1}>
                {t.pickup.name} → {t.drop.name}
              </Text>
              <Text style={styles.meta}>
                {when ? formatDate(when) : t.date} · {t.bookingId}
              </Text>
              <Text style={styles.meta}>
                {t.status === 'Completed' ? `${t.paymentMethod} · ${t.paid ? `paid ${formatINR(t.paid.totalPaid)}${t.paid.balanceDue > 0 ? `, balance ${formatINR(t.paid.balanceDue)}` : ''}` : t.paymentStatus}` : 'Cancelled'}
              </Text>
              {t.refund && t.refund.amount > 0 ? (
                <Text style={styles.refund}>
                  Refund {formatINR(t.refund.amount)} · {t.refund.status}
                </Text>
              ) : null}
            </View>
            <Text style={styles.amount}>{formatINR(total)}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: space.xxl },
  summary: { borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, padding: space.lg, marginBottom: space.lg },
  sumLabel: { fontSize: 15, color: colors.slate },
  sumValue: { fontSize: 28, fontWeight: '900', color: colors.success },
  sumNote: { fontSize: 14, color: colors.slate, marginTop: 4 },
  row: { flexDirection: 'row', gap: space.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, padding: space.lg, marginBottom: space.md },
  route: { fontSize: 16, fontWeight: '800', color: colors.ink },
  meta: { fontSize: 14, color: colors.slate, marginTop: 2 },
  refund: { fontSize: 14, color: colors.success, fontWeight: '700', marginTop: 4 },
  amount: { fontSize: 19, fontWeight: '900', color: colors.ink },
});
