// Live offers. The Web screen filtered on a non-existent `active` field
// (always empty); this uses the same isCouponLive() check as fare validation.
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button, Card, EmptyState, Screen } from '../components/ui';
import { isCouponLive, subscribeToCoupons } from '../services/pricingService';
import type { Coupon } from '../types';
import { colors, space, type } from '../theme';

export function OffersScreen() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => subscribeToCoupons(setCoupons), []);
  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const live = useMemo(() => (coupons ?? []).filter((c) => isCouponLive(c)), [coupons]);

  return (
    <Screen edges={[]}>
      <Text style={[type.small, { marginBottom: space.md }]}>Enter a code under “Promo code” when booking. Offers are checked again against your fare.</Text>
      {coupons === null ? (
        <Text style={type.small}>Loading offers…</Text>
      ) : live.length === 0 ? (
        <EmptyState title="No offers right now" message="Check back soon." />
      ) : (
        live.map((c) => (
          <Card key={c.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>
                {c.discountType === 'PERCENTAGE'
                  ? `${c.discountValue}% off${c.maximumDiscount ? ` (up to ₹${c.maximumDiscount})` : ''}`
                  : `₹${c.discountValue} off`}
              </Text>
              <Text style={type.small}>{c.description || c.name}</Text>
              <Text style={type.tiny}>
                {c.minimumBookingAmount ? `Min fare ₹${c.minimumBookingAmount} · ` : ''}
                {c.firstBookingOnly ? 'First ride only · ' : ''}
                {c.validUntil ? `Valid till ${c.validUntil}` : 'No expiry'}
              </Text>
            </View>
            <Button
              small
              variant="secondary"
              title={copied === c.code ? 'Copied!' : c.code}
              onPress={() => {
                void Clipboard.setStringAsync(c.code).then(() => setCopied(c.code));
              }}
              accessibilityLabel={`Copy code ${c.code}`}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderColor: colors.primaryBorder },
});
