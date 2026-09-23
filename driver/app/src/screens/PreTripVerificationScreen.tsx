import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput } from 'react-native';
import { Colors } from '../theme/colors';
import { TripDetails } from '../types/driver';

interface PreTripVerificationScreenProps {
  trip: TripDetails;
  onComplete: (odometer: number) => void;
  onCancel: () => void;
}

export const PreTripVerificationScreen: React.FC<PreTripVerificationScreenProps> = ({
  trip,
  onComplete,
  onCancel
}) => {
  const [selfie, setSelfie] = useState<string>('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80');
  const [vehicleFront, setVehicleFront] = useState<string>('https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=500&auto=format&fit=crop&q=80');
  const [odometerPhoto, setOdometerPhoto] = useState<string>('https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=500&auto=format&fit=crop&q=80');
  const [rearSeat, setRearSeat] = useState<string>('https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=500&auto=format&fit=crop&q=80');
  const [startOdometer, setStartOdometer] = useState<string>('84290');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerBox}>
        <Text style={styles.tag}>MANDATORY SAFETY AUDIT</Text>
        <Text style={styles.title}>Pre-Trip Live Verification</Text>
        <Text style={styles.subtitle}>Upload 4 mandatory live photos before starting trip navigation.</Text>
      </View>

      {/* Grid of 4 photos */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Live Driver Selfie</Text>
        <Image source={{ uri: selfie }} style={styles.photoPreview} />
        <TouchableOpacity style={styles.captureBtn} onPress={() => {}}>
          <Text style={styles.captureBtnText}>📷 Recapture Selfie</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. Vehicle Front & License Plate</Text>
        <Image source={{ uri: vehicleFront }} style={styles.photoPreview} />
        <TouchableOpacity style={styles.captureBtn} onPress={() => {}}>
          <Text style={styles.captureBtnText}>📷 Recapture Vehicle Front</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>3. Dashboard / Odometer Reading</Text>
        <Image source={{ uri: odometerPhoto }} style={styles.photoPreview} />
        <Text style={styles.inputLabel}>Start Odometer Reading (KM)</Text>
        <TextInput
          style={styles.textInput}
          value={startOdometer}
          onChangeText={setStartOdometer}
          keyboardType="numeric"
        />
        <TouchableOpacity style={styles.captureBtn} onPress={() => {}}>
          <Text style={styles.captureBtnText}>📷 Recapture Odometer Photo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>4. Rear Passenger Seat Photo</Text>
        <Image source={{ uri: rearSeat }} style={styles.photoPreview} />
        <TouchableOpacity style={styles.captureBtn} onPress={() => {}}>
          <Text style={styles.captureBtnText}>📷 Recapture Rear Seat</Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <TouchableOpacity
        style={styles.submitBtn}
        onPress={() => onComplete(Number(startOdometer) || 84290)}
      >
        <Text style={styles.submitBtnText}>Submit Verification & Start Pickup</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  headerBox: { backgroundColor: Colors.black, borderRadius: 16, padding: 16, marginBottom: 16 },
  tag: { color: Colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: Colors.white, fontSize: 18, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: Colors.black, marginBottom: 8 },
  photoPreview: { width: '100%', height: 160, borderRadius: 8, marginBottom: 8 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: Colors.black, marginTop: 6 },
  textInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 8, fontSize: 14, fontWeight: '800', fontFamily: 'monospace', marginTop: 4, marginBottom: 8 },
  captureBtn: { backgroundColor: Colors.darkCharcoal, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  captureBtnText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  submitBtn: { backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: Colors.white, fontSize: 14, fontWeight: '900' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  cancelBtnText: { color: Colors.secondaryText, fontSize: 12, fontWeight: '700' }
});
