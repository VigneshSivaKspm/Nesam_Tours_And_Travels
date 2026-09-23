import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Colors } from '../theme/colors';

interface BookingScreenProps {
  onBack: () => void;
}

export function BookingScreen({ onBack }: BookingScreenProps) {
  const [step, setStep] = useState('service');
  const [serviceType, setServiceType] = useState('One Way');
  const [pickup, setPickup] = useState('Chennai International Airport (MAA)');
  const [drop, setDrop] = useState('Tidel Park, OMR, Chennai');
  const [vehicle, setVehicle] = useState('Sedan (Dzire / Etios)');
  const [travelDate, setTravelDate] = useState('26 Aug 2026');
  const [travelTime, setTravelTime] = useState('07:00 AM');
  const [isCorporate, setIsCorporate] = useState(false);
  const [gstin, setGstin] = useState('33AAACN9042K1Z8');
  const [paymentMethod, setPaymentMethod] = useState('Razorpay UPI');
  const [bookingId, setBookingId] = useState('');

  const baseFare = 1200;
  const kmFare = 1450;
  const driverBatta = 300;
  const tollCharges = 150;
  const subtotal = baseFare + kmFare + driverBatta + tollCharges;
  const gst = Math.round(subtotal * 0.05);
  const totalFare = subtotal + gst;

  const handleConfirmBooking = () => {
    const generatedId = 'NST' + Math.floor(10000 + Math.random() * 90000);
    setBookingId(generatedId);
    setStep('success');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book NESAM Ride</Text>
        <Text style={styles.tag}>GST TAX INVOICE</Text>
      </View>

      {/* STEP 1: SERVICE TYPE & ROUTE */}
      {step === 'service' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Service Category</Text>

          <View style={styles.grid}>
            {[
              'One Way', 'Round Trip', 'Local Hourly', 'Airport Transfer',
              'Multi-City', 'Scheduled', 'Corporate', 'Recurring Package'
            ].map(st => (
              <TouchableOpacity
                key={st}
                style={[styles.chip, serviceType === st && styles.chipActive]}
                onPress={() => setServiceType(st)}
              >
                <Text style={[styles.chipText, serviceType === st && styles.chipTextActive]}>{st}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Pickup Location</Text>
          <TextInput style={styles.input} value={pickup} onChangeText={setPickup} />

          <Text style={styles.label}>Drop Destination</Text>
          <TextInput style={styles.input} value={drop} onChangeText={setDrop} />

          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('details')}>
            <Text style={styles.primaryBtnText}>Choose Fleet Vehicle →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 2: VEHICLE & PASSENGER DETAILS */}
      {step === 'details' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Choose Fleet Vehicle</Text>

          {['Sedan (Dzire / Etios)', 'SUV (Innova / Ertiga)', 'Premium SUV (Crysta)', 'Tempo Traveller (12+ Seater)'].map(v => (
            <TouchableOpacity
              key={v}
              style={[styles.vehicleCard, vehicle === v && styles.vehicleCardActive]}
              onPress={() => setVehicle(v)}
            >
              <Text style={styles.vehicleName}>{v}</Text>
              <Text style={styles.vehiclePrice}>Base: ₹1,200 + ₹14/KM</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.label}>Travel Date & Time</Text>
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1 }]} value={travelDate} onChangeText={setTravelDate} />
            <TextInput style={[styles.input, { flex: 1 }]} value={travelTime} onChangeText={setTravelTime} />
          </View>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setIsCorporate(!isCorporate)}
          >
            <Text style={styles.checkIcon}>{isCorporate ? '☑' : '☐'}</Text>
            <Text style={styles.checkLabel}>Corporate Ride (Enter Company GSTIN)</Text>
          </TouchableOpacity>

          {isCorporate && (
            <View>
              <Text style={styles.label}>Company GSTIN Number</Text>
              <TextInput style={styles.input} value={gstin} onChangeText={setGstin} />
            </View>
          )}

          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('payment')}>
            <Text style={styles.primaryBtnText}>Proceed to Payment →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 3: FARE BREAKDOWN & PAYMENT */}
      {step === 'payment' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fare Breakdown & Taxes</Text>

          <View style={styles.fareBox}>
            <View style={styles.fareRow}><Text style={styles.fareLabel}>Base Fare ({vehicle}):</Text><Text style={styles.fareVal}>₹{baseFare}</Text></View>
            <View style={styles.fareRow}><Text style={styles.fareLabel}>Distance Tariff (180 KM):</Text><Text style={styles.fareVal}>₹{kmFare}</Text></View>
            <View style={styles.fareRow}><Text style={styles.fareLabel}>Driver Batta:</Text><Text style={styles.fareVal}>₹{driverBatta}</Text></View>
            <View style={styles.fareRow}><Text style={styles.fareLabel}>Toll & State Permit:</Text><Text style={styles.fareVal}>₹{tollCharges}</Text></View>
            <View style={styles.fareRow}><Text style={styles.fareLabel}>5% Statutory GST:</Text><Text style={styles.fareVal}>₹{gst}</Text></View>
            <View style={[styles.fareRow, { borderTopWidth: 1, paddingTop: 6, marginTop: 4 }]}>
              <Text style={styles.totalLabel}>TOTAL FARE:</Text>
              <Text style={styles.totalVal}>₹{totalFare}</Text>
            </View>
          </View>

          <Text style={styles.cardTitle}>Select Payment Method</Text>
          {['Razorpay UPI', 'Credit / Debit Card', 'Net Banking', 'Cash on Drop'].map(pm => (
            <TouchableOpacity
              key={pm}
              style={[styles.pmCard, paymentMethod === pm && styles.pmCardActive]}
              onPress={() => setPaymentMethod(pm)}
            >
              <Text style={styles.pmText}>{pm}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirmBooking}>
            <Text style={styles.primaryBtnText}>Confirm & Pay ₹{totalFare}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 4: SUCCESS CONFIRMATION */}
      {step === 'success' && (
        <View style={styles.card}>
          <Text style={styles.successTitle}>✓ Booking Confirmed!</Text>
          <Text style={styles.bookingIdText}>Booking ID: {bookingId}</Text>
          <Text style={styles.otpText}>Customer Boarding OTP: 8842</Text>

          <View style={styles.detailsBox}>
            <Text style={styles.detailText}>Vehicle: {vehicle}</Text>
            <Text style={styles.detailText}>Driver: Senthil Nathan (+91 98400 12345)</Text>
            <Text style={styles.detailText}>Pickup: {pickup}</Text>
            <Text style={styles.detailText}>Drop: {drop}</Text>
            <Text style={styles.detailText}>Total Paid: ₹{totalFare} ({paymentMethod})</Text>
          </View>

          <TouchableOpacity
            style={styles.downloadBtn}
            onPress={() => Alert.alert('PDF Invoice', `GST Tax Invoice PDF for ${bookingId} sent to email & WhatsApp!`)}
          >
            <Text style={styles.downloadBtnText}>📄 Download PDF E-Ticket Invoice</Text>
          </TouchableOpacity>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightBg },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyBetween: 'space-between', marginBottom: 16 },
  backText: { color: Colors.primary, fontWeight: '800', fontSize: 13 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: Colors.black, marginLeft: 12 },
  tag: { marginLeft: 'auto', backgroundColor: Colors.black, color: Colors.white, fontSize: 8, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: '900', color: Colors.black, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.grayLight, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 11, fontWeight: '700', color: Colors.black },
  chipTextActive: { color: Colors.white, fontWeight: '900' },

  label: { fontSize: 11, fontWeight: '700', color: Colors.black, marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10, fontSize: 12, fontWeight: '600', color: Colors.black },
  row: { flexDirection: 'row', gap: 8 },

  vehicleCard: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, marginBottom: 8 },
  vehicleCardActive: { borderColor: Colors.primary, backgroundColor: '#FEF2F2' },
  vehicleName: { fontSize: 13, fontWeight: '800', color: Colors.black },
  vehiclePrice: { fontSize: 11, color: Colors.secondaryText, marginTop: 2 },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 12 },
  checkIcon: { fontSize: 16, color: Colors.primary },
  checkLabel: { fontSize: 12, fontWeight: '700', color: Colors.black },

  fareBox: { backgroundColor: Colors.grayLight, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  fareLabel: { fontSize: 11, color: Colors.secondaryText },
  fareVal: { fontSize: 11, fontWeight: '700', color: Colors.black },
  totalLabel: { fontSize: 13, fontWeight: '900', color: Colors.primary },
  totalVal: { fontSize: 15, fontWeight: '900', color: Colors.primary },

  pmCard: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10, marginBottom: 6 },
  pmCardActive: { borderColor: Colors.primary, backgroundColor: '#FEF2F2' },
  pmText: { fontSize: 12, fontWeight: '700', color: Colors.black },

  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  primaryBtnText: { color: Colors.white, fontWeight: '900', fontSize: 13 },

  successTitle: { fontSize: 18, fontWeight: '900', color: Colors.success, textAlign: 'center' },
  bookingIdText: { fontSize: 14, fontWeight: '900', color: Colors.black, textAlign: 'center', marginTop: 4 },
  otpText: { fontSize: 16, fontWeight: '900', color: Colors.primary, textAlign: 'center', marginTop: 4, fontFamily: 'monospace' },
  detailsBox: { backgroundColor: Colors.grayLight, padding: 12, borderRadius: 10, marginVertical: 14 },
  detailText: { fontSize: 11, color: Colors.black, marginBottom: 4, fontWeight: '600' },
  downloadBtn: { backgroundColor: Colors.black, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  downloadBtnText: { color: Colors.white, fontWeight: '900', fontSize: 12 }
});
