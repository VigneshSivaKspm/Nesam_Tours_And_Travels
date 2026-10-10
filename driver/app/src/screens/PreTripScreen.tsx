// Mandatory vehicle verification before a trip can start: three photos — vehicle
// front, vehicle rear, dashboard/interior — taken live with the in-app camera.
// There is no gallery picker and no driver selfie. For every photo the server
// issues a random instruction and code; the photo is uploaded to the path it
// names and checked there. A retake is a new instruction and a new upload.
import React, { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useDriverData } from '../context/DriverData';
import { Badge, Button, Card, EmptyState, Notice, Row, Screen, TextField } from '../components/ui';
import { ActionError } from '../services/callables';
import { getCurrentPosition } from '../services/locationService';
import {
  SLOTS,
  createCaptureSession,
  finalizeVehicleVerification,
  getSlotChallenge,
  submitCapturePhoto,
  uploadCapture,
  type CaptureSession,
  type Challenge,
  type Slot,
} from '../services/verificationService';
import { describeError } from '../utils/retry';
import { formatDateTime12 } from '../utils/time';
import { colors, radius, space, type } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PreTrip'>;

const message = (e: unknown, fallback: string) => (e instanceof ActionError ? e.message : describeError(e, fallback));

export function PreTripScreen({ route, navigation }: Props) {
  const { activeTrip } = useDriverData();
  const trip = activeTrip?.id === route.params.bookingId ? activeTrip : null;
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [photos, setPhotos] = useState<Partial<Record<Slot, string>>>({});
  const [reading, setReading] = useState('');
  const [capturing, setCapturing] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Photos can be taken before leaving or at the pickup — any time before Trip Started.
  if (!trip || (trip.subStatus !== 'Not Started' && trip.subStatus !== 'Reached Pickup')) {
    return (
      <Screen edges={[]}>
        <EmptyState
          title={trip ? 'Trip already started' : 'This trip is no longer assigned to you'}
          message={trip ? 'Continue the trip from the Trip tab.' : 'It may have been cancelled or reassigned.'}
          action={<Button title="Go to trip" onPress={() => navigation.navigate('Tabs', { screen: trip ? 'Trip' : 'Home' })} />}
        />
      </Screen>
    );
  }
  if (trip.verificationSubmitted) {
    return (
      <Screen edges={[]}>
        <EmptyState
          title="Vehicle verification submitted"
          message="Your photos were sent to NESAM. Continue the trip from the Trip tab."
          action={<Button title="Go to trip" onPress={() => navigation.navigate('Tabs', { screen: 'Trip' })} />}
        />
      </Screen>
    );
  }

  const allTaken = SLOTS.every((s) => photos[s.slot]);
  const readingNum = Number(reading);

  const start = async () => {
    setError('');
    setBusy(true);
    try {
      setSession(await createCaptureSession(trip.id));
      setPhotos({});
    } catch (e) {
      setError(message(e, 'Could not start the verification.'));
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!session) return;
    if (!allTaken) return setError('Take all three photos first.');
    if (!(readingNum > 0)) return setError('Enter the starting odometer reading.');
    setError('');
    setBusy(true);
    try {
      await finalizeVehicleVerification(session.sessionId, readingNum);
      navigation.navigate('Tabs', { screen: 'Trip' });
    } catch (e) {
      setError(message(e, 'Could not submit the verification.'));
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Screen edges={[]}>
      <Card>
        <Text style={type.tiny}>MANDATORY BEFORE EVERY TRIP</Text>
        <Text style={type.h2}>Vehicle photo verification</Text>
        <Text style={[type.small, { marginTop: 4 }]}>
          Trip {trip.bookingId} • {formatDateTime12(trip.assignedAt) || `${trip.scheduledDate} ${trip.scheduledTime}`}
        </Text>
      </Card>
      <Notice
        tone="warning"
        message="Take each photo now with the camera, following the instruction shown. Photos from the gallery or screenshots are not accepted, and every photo is checked by NESAM."
      />
      <Notice message={error} />

      {!session ? (
        <Card>
          <Text style={type.body}>You will take 3 photos: vehicle front, vehicle rear, and the dashboard / interior. Then enter the odometer reading.</Text>
          <Button title={busy ? 'Starting…' : 'Start verification'} loading={busy} onPress={() => void start()} style={{ marginTop: space.md }} />
        </Card>
      ) : (
        <>
          {SLOTS.map((s) => (
            <Card key={s.slot}>
              <View style={styles.slotHead}>
                <Text style={type.h3}>{s.label}</Text>
                <Badge label={photos[s.slot] ? 'Captured' : 'Required'} tone={photos[s.slot] ? 'success' : 'warning'} />
              </View>
              <Text style={[type.small, { marginVertical: space.sm }]}>{s.hint}</Text>
              {photos[s.slot] ? <Image source={{ uri: photos[s.slot] }} style={styles.thumb} accessibilityLabel={`${s.label} photo`} /> : null}
              <Button
                title={photos[s.slot] ? 'Retake photo' : 'Take photo'}
                variant={photos[s.slot] ? 'secondary' : 'primary'}
                disabled={busy}
                onPress={() => {
                  setError('');
                  setCapturing(s.slot);
                }}
              />
            </Card>
          ))}
          <Card>
            <TextField
              label="Starting odometer reading (km)"
              required
              value={reading}
              onChangeText={(t) => setReading(t.replace(/\D/g, '').slice(0, 7))}
              keyboardType="number-pad"
              placeholder="e.g. 48210"
              hint="Read it from the dashboard photo you just took."
            />
            <Row label="Photos captured" value={`${Object.keys(photos).length} of ${SLOTS.length}`} />
            <Button
              title={busy ? 'Submitting…' : 'Submit verification'}
              loading={busy}
              disabled={!allTaken || !(readingNum > 0)}
              onPress={() => void finish()}
              style={{ marginTop: space.md }}
            />
          </Card>
        </>
      )}

      {session && capturing ? (
        <CaptureModal
          key={capturing}
          session={session}
          slot={capturing}
          onClose={() => setCapturing(null)}
          onDone={(slot, uri) => {
            setPhotos((p) => ({ ...p, [slot]: uri }));
            setCapturing(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

function CaptureModal({ session, slot, onClose, onDone }: { session: CaptureSession; slot: Slot; onClose: () => void; onDone: (slot: Slot, uri: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const label = SLOTS.find((s) => s.slot === slot)!.label;

  const loadChallenge = async () => {
    setError('');
    try {
      const c = await getSlotChallenge(session.sessionId, slot);
      setChallenge(c);
    } catch (e) {
      setError(message(e, 'Could not get the instruction for this photo.'));
    }
  };

  useEffect(() => {
    if (!permission?.granted) return undefined;
    let alive = true;
    getSlotChallenge(session.sessionId, slot)
      .then((c) => alive && setChallenge(c))
      .catch((e) => alive && setError(message(e, 'Could not get the instruction for this photo.')));
    return () => {
      alive = false;
    };
  }, [permission?.granted, session.sessionId, slot]);

  useEffect(() => {
    if (!challenge) return undefined;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((challenge.expiresAtMs - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [challenge]);

  const expired = !!challenge && secondsLeft === 0;

  const shoot = async () => {
    if (!challenge || !camera.current || busy || expired) return;
    setError('');
    setBusy(true);
    try {
      setStatus('Taking photo…');
      const pic = await camera.current.takePictureAsync({ quality: 0.7, skipProcessing: false, shutterSound: false });
      const capturedAt = Date.now();
      setStatus('Uploading…');
      await uploadCapture(challenge, session.sessionId, pic.uri);
      setStatus('Checking…');
      const here = await getCurrentPosition(6000).catch(() => null);
      await submitCapturePhoto({
        sessionId: session.sessionId,
        slot,
        storagePath: challenge.storagePath,
        capturedAt,
        gps: here ? { lat: here.lat, lng: here.lng, accuracy: here.accuracy } : null,
      });
      onDone(slot, pic.uri);
    } catch (e) {
      setError(message(e, 'That photo could not be sent. Please take it again.'));
      // The instruction is single-use: a retry needs a fresh one.
      setChallenge(null);
      void loadChallenge();
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={() => !busy && onClose()}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.modalHead}>
          <Text style={styles.modalTitle}>{label}</Text>
          <Pressable onPress={onClose} disabled={busy} accessibilityRole="button" accessibilityLabel="Close camera">
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        {!permission ? null : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.centerText}>NESAM Driver needs the camera to take the vehicle photos.</Text>
            <Button title={permission.canAskAgain ? 'Allow camera' : 'Camera is blocked in Settings'} disabled={!permission.canAskAgain} onPress={() => void requestPermission()} />
          </View>
        ) : (
          <>
            <View style={styles.cameraBox}>
              <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" mode="picture" onCameraReady={() => setReady(true)} />
              {challenge ? (
                <View style={styles.overlay} pointerEvents="none">
                  <Text style={styles.code}>{challenge.code}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.panel}>
              {challenge ? (
                <>
                  <Text style={styles.instruction}>{challenge.instruction}</Text>
                  <Text style={styles.timer}>{expired ? 'Instruction expired' : `Take the photo within ${secondsLeft}s`}</Text>
                </>
              ) : (
                <Text style={styles.instruction}>Getting your instruction…</Text>
              )}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {status ? <Text style={styles.timer}>{status}</Text> : null}
              {expired || (!challenge && error) ? (
                <Button title="Get a new instruction" variant="secondary" onPress={() => void loadChallenge()} />
              ) : (
                <Pressable
                  onPress={() => void shoot()}
                  disabled={!ready || !challenge || busy}
                  style={[styles.shutter, (!ready || !challenge || busy) && { opacity: 0.4 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Take photo"
                >
                  <View style={styles.shutterInner} />
                </Pressable>
              )}
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  slotHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  thumb: { width: '100%', height: 150, borderRadius: radius.md, marginBottom: space.sm, backgroundColor: colors.border },
  modal: { flex: 1, backgroundColor: '#000' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.lg },
  modalTitle: { color: colors.white, fontSize: 18, fontWeight: '800' },
  close: { color: colors.white, fontSize: 22, padding: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg },
  centerText: { color: colors.white, fontSize: 15, textAlign: 'center' },
  cameraBox: { flex: 1, overflow: 'hidden', borderRadius: radius.lg, marginHorizontal: space.md },
  overlay: { position: 'absolute', top: space.lg, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.md },
  code: { color: '#FDE047', fontSize: 28, fontWeight: '900', letterSpacing: 4 },
  panel: { padding: space.lg, gap: space.sm, alignItems: 'center' },
  instruction: { color: colors.white, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  timer: { color: '#D1D5DB', fontSize: 13 },
  error: { color: '#FCA5A5', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  shutterInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.white },
});
