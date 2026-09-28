// FAQs, raise a ticket, my tickets (port of user/web SupportScreen.tsx).
import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useCustomerData } from '../context/CustomerData';
import { Badge, Button, Card, Chip, EmptyState, Notice, Screen, Segmented, TextField } from '../components/ui';
import { SUPPORT_CATEGORIES, submitSupportTicket, subscribeToSupportTickets } from '../services/userService';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import type { SupportTicket } from '../types';
import { describeError } from '../utils/retry';
import { colors, radius, space, type } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Support'>;
type Tab = 'faqs' | 'ticket' | 'mine';

const FAQS = [
  { q: 'How do I cancel my booking?', a: 'Open the ride from My Trips and tap “Cancel ride”. The screen shows whether a cancellation fee applies before you confirm.' },
  { q: 'When are driver details shared?', a: 'As soon as a driver is assigned — name, phone, vehicle number and rating appear on your ride screen.' },
  { q: 'What is the boarding code?', a: 'A 4-digit code shown on your ride screen. Share it with your driver only once you are in the car; the trip cannot start without it.' },
  { q: 'How are tolls charged?', a: 'Tolls, parking and permits paid by the driver are added to your final receipt against actual receipts.' },
];

export function SupportScreen({ route }: Props) {
  const { profile } = useCustomerData();
  const [tab, setTab] = useState<Tab>(route.params?.bookingId ? 'ticket' : 'faqs');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [category, setCategory] = useState(SUPPORT_CATEGORIES[0]!);
  const [bookingId, setBookingId] = useState(route.params?.bookingId ?? '');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [listError, setListError] = useState('');

  useEffect(
    () => subscribeToSupportTickets(profile.uid, setTickets, (e) => setListError(describeError(e, 'Couldn’t load your tickets.'))),
    [profile.uid],
  );

  const submit = async () => {
    if (description.trim().length < 10) return setError('Please describe the issue in at least 10 characters.');
    if (sending) return undefined;
    setSending(true);
    setError('');
    try {
      await submitSupportTicket(profile, { category, bookingId, description });
      setDescription('');
      setBookingId('');
      setSubmitted(true);
      setTab('mine');
    } catch (e) {
      setError(describeError(e, 'We couldn’t submit your ticket. Please try again or call support.'));
    } finally {
      setSending(false);
    }
    return undefined;
  };

  return (
    <Screen edges={[]}>
      <Segmented
        options={[
          { value: 'faqs', label: 'FAQs' },
          { value: 'ticket', label: 'Raise ticket' },
          { value: 'mine', label: `My tickets (${tickets.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />
      <View style={{ height: space.md }} />

      {tab === 'faqs' ? (
        <>
          {FAQS.map((f) => (
            <Card key={f.q}>
              <Text style={type.h3}>{f.q}</Text>
              <Text style={[type.small, { marginTop: 4 }]}>{f.a}</Text>
            </Card>
          ))}
          <Card style={{ alignItems: 'center' }}>
            <Text style={type.h3}>Still need help?</Text>
            <Button title={`Call helpline ${SUPPORT_PHONE_DISPLAY}`} onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} style={{ marginTop: space.md, alignSelf: 'stretch' }} />
          </Card>
        </>
      ) : null}

      {tab === 'ticket' ? (
        <Card>
          <Text style={[type.label, { marginBottom: space.sm }]}>Issue category</Text>
          <View style={styles.chips}>
            {SUPPORT_CATEGORIES.map((c) => (
              <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>
          <TextField label="Booking ID (optional)" value={bookingId} onChangeText={setBookingId} autoCapitalize="characters" placeholder="e.g. NT260928-ABCDE" />
          <Text style={[type.label, { marginBottom: 6 }]}>Describe the issue</Text>
          <TextInput
            value={description}
            onChangeText={(v) => setDescription(v.slice(0, 2000))}
            multiline
            placeholder="Tell us what happened…"
            placeholderTextColor={colors.faint}
            style={styles.textarea}
          />
          <Notice message={error} />
          <Button title={sending ? 'Submitting…' : 'Submit ticket'} loading={sending} onPress={() => void submit()} />
        </Card>
      ) : null}

      {tab === 'mine' ? (
        <>
          {submitted ? <Notice tone="success" message="Ticket submitted. Our team will get back to you." /> : null}
          <Notice message={listError} />
          {tickets.length === 0 ? (
            <EmptyState title="No tickets yet" message="Tickets you raise appear here with their status." />
          ) : (
            tickets.map((t) => (
              <Card key={t.id}>
                <View style={styles.ticketHead}>
                  <Text style={[type.h3, { flex: 1 }]}>{t.category}</Text>
                  <Badge label={t.status} tone={t.status === 'Resolved' || t.status === 'Closed' ? 'success' : 'warning'} />
                </View>
                {t.bookingId ? <Text style={type.tiny}>Booking {t.bookingId}</Text> : null}
                <Text style={[type.body, { marginTop: 4 }]}>{t.description}</Text>
                <Text style={[type.tiny, { marginTop: 4 }]}>Submitted {t.createdAt}</Text>
              </Card>
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  textarea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 110,
    textAlignVertical: 'top',
    color: colors.ink,
    marginBottom: space.md,
  },
  ticketHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
