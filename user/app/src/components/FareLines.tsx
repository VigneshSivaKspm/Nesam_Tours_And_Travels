import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FareBreakdown } from '../types';
import { formatINR } from '../utils/format';
import { colors } from '../theme';

/** Line-item fare breakdown (same rows as user/web FareLines.tsx). */
export function fareRows(fare: FareBreakdown, tolls = 0): [string, number][] {
  const rows: [string, number][] = [
    ['Base fare', fare.baseFare],
    [`Distance (${fare.distanceKm} km @ ₹${fare.perKmRate}/km)`, fare.distanceFare],
  ];
  if (fare.timeFare) rows.push([`Time (${fare.durationMin} min)`, fare.timeFare]);
  if (fare.nightCharge) rows.push(['Night charge', fare.nightCharge]);
  if (fare.driverAllowance) rows.push(['Driver allowance (outstation)', fare.driverAllowance]);
  if (fare.minimumFareAdjustment) rows.push(['Minimum fare adjustment', fare.minimumFareAdjustment]);
  if (fare.discount) rows.push(['Promo discount', -fare.discount]);
  rows.push([`GST (${Math.round(fare.gstRate * 100)}%)`, fare.gst]);
  if (tolls) rows.push(['Tolls & parking', tolls]);
  return rows;
}

export function FareLines({ fare, tolls = 0 }: { fare: FareBreakdown; tolls?: number }) {
  return (
    <View>
      {fareRows(fare, tolls).map(([k, v]) => (
        <View key={k} style={styles.row}>
          <Text style={styles.label}>{k}</Text>
          <Text style={[styles.value, v < 0 && { color: colors.success }]}>{v < 0 ? `−${formatINR(-v)}` : formatINR(v)}</Text>
        </View>
      ))}
      <View style={[styles.row, styles.total]}>
        <Text style={styles.totalText}>Total</Text>
        <Text style={styles.totalText}>{formatINR(fare.total + tolls)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, gap: 12 },
  label: { flex: 1, fontSize: 13, color: colors.muted },
  value: { fontSize: 13, fontWeight: '700', color: colors.ink },
  total: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, paddingTop: 8 },
  totalText: { fontSize: 15, fontWeight: '800', color: colors.ink },
});
