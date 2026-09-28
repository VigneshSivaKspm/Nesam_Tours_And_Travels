// Mandatory pre-trip safety check (native port of driver/web
// PreTripVerificationScreen.tsx). All four live photos and the starting
// odometer are required; nothing is pre-filled.
import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useDriverData } from '../context/DriverData';
import { Button, Card, EmptyState, Notice, Screen, TextField } from '../components/ui';
import { PhotoField } from '../components/forms';
import { submitPreTripVerification } from '../services/driverService';
import { describeError } from '../utils/retry';
import { space, type } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PreTrip'>;

export function PreTripScreen({ route, navigation }: Props) {
  const { activeTrip } = useDriverData();
  const trip = activeTrip?.id === route.params.bookingId ? activeTrip : null;
  const [selfie, setSelfie] = useState(trip?.preTrip?.selfie ?? '');
  const [vehicleFront, setVehicleFront] = useState(trip?.preTrip?.vehicleFront ?? '');
  const [odometer, setOdometer] = useState(trip?.preTrip?.odometer ?? '');
  const [rearSeat, setRearSeat] = useState(trip?.preTrip?.rearSeat ?? '');
  const [reading, setReading] = useState(trip?.preTrip?.odometerReading ? String(trip.preTrip.odometerReading) : '');
  const [showErrors, setShowErrors] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!trip || trip.stage !== 'Assigned') {
    return (
      <Screen edges={[]}>
        <EmptyState
          title={trip ? 'Pre-trip check already done' : 'This trip is no longer assigned to you'}
          message={trip ? 'Continue the trip from the Trip tab.' : 'It may have been cancelled or reassigned.'}
          action={<Button title="Go to trip" onPress={() => navigation.navigate('Tabs', { screen: trip ? 'Trip' : 'Home' })} />}
        />
      </Screen>
    );
  }

  const readingNum = Number(reading);
  const complete = !!(selfie && vehicleFront && odometer && rearSeat && readingNum > 0);
  const folder = `trips/${trip.id}`;
  const onBusy = (busy: boolean) => setUploads((n) => Math.max(0, n + (busy ? 1 : -1)));

  const submit = async () => {
    setShowErrors(true);
    if (uploads > 0) return setError('Please wait for uploads to finish.');
    if (!complete) return setError('All 4 photos and the odometer reading are required.');
    setError('');
    setSubmitting(true);
    try {
      await submitPreTripVerification(trip.id, { selfie, vehicleFront, odometer, rearSeat, odometerReading: readingNum, capturedAt: new Date().toISOString() });
      navigation.navigate('Tabs', { screen: 'Trip' });
    } catch (e) {
      setError(describeError(e, 'Could not submit the pre-trip check. This trip may have been reassigned or cancelled.'));
      setSubmitting(false);
    }
    return undefined;
  };

  return (
    <Screen edges={[]}>
      <Card>
        <Text style={type.tiny}>MANDATORY SAFETY CHECK</Text>
        <Text style={type.h2}>Pre-trip vehicle verification</Text>
        <Text style={[type.small, { marginTop: 4 }]}>
          Trip {trip.bookingId} • Pickup: {trip.pickup.address}
        </Text>
      </Card>
      <Notice tone="warning" message="Capture all 4 live photos before heading to pickup. They are shared with NESAM operations for safety audit." />
      <PhotoField label="1. Driver selfie" hint="Face clearly visible, in uniform" value={selfie} folder={folder} name="selfie" required showError={showErrors} onBusyChange={onBusy} onChange={setSelfie} />
      <PhotoField label="2. Vehicle front & number plate" hint="Plate must be readable" value={vehicleFront} folder={folder} name="vehicle-front" required showError={showErrors} onBusyChange={onBusy} onChange={setVehicleFront} />
      <PhotoField label="3. Odometer / dashboard" hint="Reading clearly visible" value={odometer} folder={folder} name="odometer" required showError={showErrors} onBusyChange={onBusy} onChange={setOdometer} />
      <TextField
        label="Starting odometer reading (km)"
        required
        value={reading}
        onChangeText={(t) => setReading(t.replace(/\D/g, '').slice(0, 7))}
        keyboardType="number-pad"
        placeholder="e.g. 48210"
        error={showErrors && !(readingNum > 0) ? 'Enter the odometer reading.' : undefined}
      />
      <PhotoField label="4. Rear passenger seat" hint="Clean seats and seat covers" value={rearSeat} folder={folder} name="rear-seat" required showError={showErrors} onBusyChange={onBusy} onChange={setRearSeat} />
      <Notice message={error} />
      <Button title={submitting ? 'Submitting…' : uploads > 0 ? 'Uploading…' : 'Submit & start to pickup'} loading={submitting} disabled={uploads > 0} onPress={() => void submit()} style={styles.gap} />
    </Screen>
  );
}

const styles = StyleSheet.create({ gap: { marginTop: space.sm } });
