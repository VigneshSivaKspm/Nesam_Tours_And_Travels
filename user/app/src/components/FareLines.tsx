import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { FareLine, TripRecord } from '../types';
import { linesFromBreakdown } from '../utils/fareBreakup';
import { formatINR } from '../utils/format';
import { Badge } from './ui';
import { colors, space } from '../theme';

/** The lines to show for a booked trip: the server's breakup, else one rebuilt from the stored fare. */
export function tripFareLines(trip: TripRecord): FareLine[] {
  if (trip.fareLines.length) return trip.fareLines;
  return trip.fareBreakdown ? linesFromBreakdown(trip.fareBreakdown) : [{ key: 'fare', label: 'Ride fare', amount: trip.fare, treatment: 'included', detail: '' }];
}

const money = (n: number) => (n < 0 ? `−${formatINR(-n)}` : formatINR(n));

/**
 * Fare breakup in three groups, each line labelled: what the total includes,
 * what is payable separately (at a rate or at actuals), and what does not apply.
 * The total is always the package total — extras are never silently added to it.
 */
export function FareLines({ lines, total, tolls = 0, estimated = false }: { lines: FareLine[]; total: number; tolls?: number; estimated?: boolean }) {
  const included = lines.filter((l) => l.treatment === 'included');
  const extra = lines.filter((l) => l.treatment === 'extra');
  const na = lines.filter((l) => l.treatment === 'not_applicable');
  return (
    <View>
      <Text style={styles.group}>INCLUDED IN THE {estimated ? 'ESTIMATE' : 'FARE'}</Text>
      {included.map((l) => (
        <View key={l.key} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{l.label}</Text>
            {l.detail ? <Text style={styles.detail}>{l.detail}</Text> : null}
          </View>
          <Text style={[styles.value, (l.amount ?? 0) < 0 && { color: colors.success }]}>{l.amount === null ? 'Included' : money(l.amount)}</Text>
        </View>
      ))}
      {tolls > 0 ? (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Tolls & parking recorded</Text>
            <Text style={styles.detail}>Paid by the driver during the trip</Text>
          </View>
          <Text style={styles.value}>{money(tolls)}</Text>
        </View>
      ) : null}
      <View style={[styles.row, styles.total]}>
        <Text style={styles.totalText}>{estimated ? 'Estimated total' : 'Total'}</Text>
        <Text style={styles.totalText}>{formatINR(total + tolls)}</Text>
      </View>

      {extra.length ? (
        <>
          <Text style={[styles.group, { marginTop: space.md }]}>PAYABLE SEPARATELY (NOT IN THE TOTAL)</Text>
          {extra.map((l) => (
            <View key={l.key} style={styles.row}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>{l.label}</Text>
                  <Badge label="Extra" tone="warning" />
                </View>
                {l.detail ? <Text style={styles.detail}>{l.detail}</Text> : null}
              </View>
              <Text style={styles.value}>{l.amount === null ? 'At actuals' : money(l.amount)}</Text>
            </View>
          ))}
        </>
      ) : null}
      {na.length ? <Text style={[styles.detail, { marginTop: space.sm }]}>Not applicable: {na.map((l) => l.label).join(', ')}.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { fontSize: 11, fontWeight: '800', color: colors.muted, letterSpacing: 0.6, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 4, gap: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  label: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  detail: { fontSize: 12, color: colors.muted, marginTop: 1 },
  value: { fontSize: 14, fontWeight: '700', color: colors.ink },
  total: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, paddingTop: 8 },
  totalText: { fontSize: 16, fontWeight: '800', color: colors.ink },
});
