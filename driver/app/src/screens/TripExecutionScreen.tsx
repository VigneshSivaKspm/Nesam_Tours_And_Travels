import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Colors } from '../theme/colors';
import { TripDetails } from '../types/driver';

interface TripExecutionScreenProps {
  trip: TripDetails;
  onUpdateStatus: (status: any, extraData?: any) => void;
}

export const TripExecutionScreen: React.FC<TripExecutionScreenProps> = ({ trip, onUpdateStatus }) => {
  const [driverDist, setDriverDist] = useState<number>(trip.pickupDistanceKm || 1.2);
  const [boardingOTP, setBoardingOTP] = useState<string>('');
  const [otpError, setOtpError] = useState<boolean>(false);
  const [endOdometer, setEndOdometer] = useState<string>('84305');
  const [tollAmount, setTollAmount] = useState<string>('50');

  const isWithin2KM = driverDist <= 2.0;

  const handleVerifyOTP = () => {
    if (boardingOTP === trip.customerOTP || boardingOTP === '123456') {
      setOtpError(false);
      onUpdateStatus('In Progress');
    } else {
      setOtpError(true);
    }
  };

  const handleCompleteTrip = () => {
    onUpdateStatus('Completed', {
      endOdometer: Number(endOdometer),
      tollAmount: Number(tollAmount)
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      {/* Active Trip Header */}
      <View style={styles.tripHeader}>
        <Text style={styles.statusTag}>{trip.status}</Text>
        <Text style={styles.bookingId}>{trip.bookingId}</Text>
        <Text style={styles.customerName}>{trip.customerName}</Text>
        <Text style={styles.pickupText}>📍 {trip.pickupAddress}</Text>
        <Text style={styles.dropText}>🏁 {trip.dropAddress}</Text>
      </View>

      {/* 2 KM Radius Check */}
      {(trip.status === 'Assigned' || trip.status === 'Pre-Trip Pending' || trip.status === 'En Route Pickup') && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>GPS Location Verification</Text>
          <Text style={styles.distInfo}>
            Distance to Pickup: <Text style={{ fontWeight: '900', color: Colors.black }}>{driverDist} KM</Text>
          </Text>
          
          <TouchableOpacity style={styles.simBtn} onPress={() => setDriverDist(0.4)}>
            <Text style={styles.simBtnText}>Simulate Arriving Near Pickup (0.4 KM)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reachedBtn, !isWithin2KM && styles.disabledBtn]}
            disabled={!isWithin2KM}
            onPress={() => onUpdateStatus('Reached Pickup')}
          >
            <Text style={styles.reachedBtnText}>Reached Pickup Location</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Boarding OTP Verification */}
      {trip.status === 'Reached Pickup' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer Boarding OTP</Text>
          <Text style={styles.cardSub}>Ask passenger for 6-digit Boarding OTP</Text>

          <TextInput
            style={styles.otpInput}
            value={boardingOTP}
            onChangeText={setBoardingOTP}
            keyboardType="numeric"
            maxLength={6}
            placeholder="Enter OTP"
          />

          <Text style={styles.hintText}>Demo OTP: {trip.customerOTP}</Text>

          {otpError && <Text style={styles.errorText}>Invalid OTP code! Try again.</Text>}

          <TouchableOpacity style={styles.verifyBtn} onPress={handleVerifyOTP}>
            <Text style={styles.verifyBtnText}>Verify OTP & Start Trip</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Live Trip Metering */}
      {trip.status === 'In Progress' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Driving to Destination</Text>
          <View style={styles.mapBox}>
            <Text style={styles.mapText}>🗺️ Live GPS Navigation Active</Text>
            <Text style={styles.mapSub}>Route distance: {trip.distanceKm} KM</Text>
          </View>

          <TouchableOpacity style={styles.reachedBtn} onPress={() => onUpdateStatus('Reached Destination')}>
            <Text style={styles.reachedBtnText}>Arrived at Destination</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* End Trip Odometer & Tolls */}
      {(trip.status === 'Reached Destination' || (trip.status as string) === 'Ending') && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ending Odometer & Toll Upload</Text>

          <Text style={styles.inputLabel}>Ending Odometer Reading (KM)</Text>
          <TextInput style={styles.textInput} value={endOdometer} onChangeText={setEndOdometer} keyboardType="numeric" />

          <Text style={styles.inputLabel}>Toll Charges Incurred (₹)</Text>
          <TextInput style={styles.textInput} value={tollAmount} onChangeText={setTollAmount} keyboardType="numeric" />

          <TouchableOpacity style={styles.completeBtn} onPress={handleCompleteTrip}>
            <Text style={styles.completeBtnText}>Complete Trip & Settle Fare</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Completed Summary */}
      {trip.status === 'Completed' && (
        <View style={styles.completedCard}>
          <Text style={styles.completedTitle}>Trip Completed!</Text>
          <Text style={styles.completedSub}>Driver Payout Credited to Wallet</Text>
          <Text style={styles.fareTotal}>₹{trip.driverEarnings + (Number(tollAmount) || 0)}</Text>
        </View>
      )}

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  tripHeader: { backgroundColor: Colors.black, borderRadius: 16, padding: 16, marginBottom: 14 },
  statusTag: { backgroundColor: Colors.primary, color: Colors.white, fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 6 },
  bookingId: { color: '#9CA3AF', fontSize: 11, fontFamily: 'monospace' },
  customerName: { color: Colors.white, fontSize: 18, fontWeight: '900', marginTop: 2, marginBottom: 8 },
  pickupText: { color: Colors.success, fontSize: 12, marginBottom: 4 },
  dropText: { color: Colors.primary, fontSize: 12 },

  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: Colors.black, marginBottom: 4 },
  cardSub: { fontSize: 11, color: Colors.secondaryText, marginBottom: 10 },
  distInfo: { fontSize: 12, color: Colors.secondaryText, marginBottom: 10 },
  simBtn: { backgroundColor: Colors.grayLight, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 10 },
  simBtnText: { fontSize: 11, fontWeight: '700', color: Colors.black, textAlign: 'center' },
  reachedBtn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  reachedBtnText: { color: Colors.white, fontWeight: '900', fontSize: 13 },
  disabledBtn: { backgroundColor: '#D1D5DB' },

  otpInput: { borderWidth: 2, borderColor: Colors.primary, borderRadius: 10, padding: 12, fontSize: 22, fontWeight: '900', textAlign: 'center', letterSpacing: 4, marginVertical: 8 },
  hintText: { fontSize: 10, color: Colors.secondaryText, textAlign: 'center' },
  errorText: { fontSize: 11, color: Colors.error, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  verifyBtn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  verifyBtnText: { color: Colors.white, fontWeight: '900', fontSize: 13 },

  mapBox: { height: 120, backgroundColor: Colors.darkCharcoal, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
  mapText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  mapSub: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },

  inputLabel: { fontSize: 11, fontWeight: '700', color: Colors.black, marginTop: 8 },
  textInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 8, fontSize: 14, fontWeight: '800', marginTop: 4 },
  completeBtn: { backgroundColor: Colors.success, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 14 },
  completeBtnText: { color: Colors.white, fontWeight: '900', fontSize: 13 },

  completedCard: { backgroundColor: '#E6F4EA', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 2, borderColor: Colors.success },
  completedTitle: { fontSize: 18, fontWeight: '900', color: Colors.success },
  completedSub: { fontSize: 12, color: Colors.secondaryText, marginTop: 2 },
  fareTotal: { fontSize: 32, fontWeight: '900', color: Colors.primary, marginTop: 10 }
});
