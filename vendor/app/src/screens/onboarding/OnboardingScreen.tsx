import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { submitCompleteOnboarding } from '../../services/onboardingService';
import { Colors } from '../../theme/colors';
import type { BusinessInfo, FleetDetails, PayoutDetails, VendorDocuments } from '../../types/vendor';

export function OnboardingScreen() {
  const { user, signOut } = useAuth();
  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Business info
  const [vendorName, setVendorName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [pincode, setPincode] = useState('');

  // Step 2: Documents
  const [gstin, setGstin] = useState('');
  const [panNumber, setPanNumber] = useState('');

  // Step 3: Fleet
  const [fleetSize, setFleetSize] = useState('5');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['Sedan', 'SUV']);

  // Step 4: Bank payout
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upiId, setUpiId] = useState('');

  const toggleType = (t: string) => {
    if (selectedTypes.includes(t)) {
      if (selectedTypes.length > 1) setSelectedTypes(selectedTypes.filter((x) => x !== t));
    } else {
      setSelectedTypes([...selectedTypes, t]);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!vendorName.trim() || !businessName.trim() || !city.trim()) {
        Alert.alert('Incomplete', 'Please fill in vendor name, business name, and city.');
        return;
      }
    }
    if (step === 2) {
      if (!panNumber.trim() && !gstin.trim()) {
        Alert.alert('Incomplete', 'Please provide either PAN or GSTIN for your business.');
        return;
      }
    }
    if (step === 4) {
      if (!accountHolder.trim() || !accountNumber.trim() || !ifsc.trim()) {
        Alert.alert('Incomplete', 'Please provide bank account details for receiving trip payouts.');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const business: BusinessInfo = {
        vendorName: vendorName.trim(),
        businessName: businessName.trim(),
        email: email.trim().toLowerCase(),
        altPhone: '',
        address: {
          line1: addressLine.trim() || city.trim(),
          line2: '',
          city: city.trim(),
          state: 'Tamil Nadu',
          pincode: pincode.trim() || '625531',
        },
      };

      const documents: VendorDocuments = {
        businessRegistration: {
          type: gstin ? 'GST' : 'BUSINESS_REGISTRATION',
          number: gstin.trim().toUpperCase(),
          files: [],
        },
        identityProof: {
          type: 'PAN',
          maskedNumber: panNumber.trim().toUpperCase(),
          files: [],
        },
      };

      const fleet: FleetDetails = {
        vehicleTypes: selectedTypes,
        fleetSize: parseInt(fleetSize) || 5,
        rcFiles: [],
        vehiclePhotos: [],
        insuranceFiles: [],
      };

      const payout: PayoutDetails = {
        accountHolderName: accountHolder.trim(),
        accountNumber: accountNumber.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        upiId: upiId.trim(),
      };

      await submitCompleteOnboarding(user.uid, {
        business,
        documents,
        fleet,
        payout,
      });

      Alert.alert('Submitted!', 'Your application has been submitted for admin review.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <Text style={s.brand}>NESAM FLEET PARTNER</Text>
            <Text style={s.title}>Partner Registration</Text>
            <Text style={s.stepText}>Step {step} of 5</Text>
          </View>

          {step === 1 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Business Information</Text>
              <Field label="Contact Person / Owner Name *" value={vendorName} onChangeText={setVendorName} placeholder="e.g. Senthil Nathan" />
              <Field label="Agency / Travels Name *" value={businessName} onChangeText={setBusinessName} placeholder="e.g. Sri Murugan Travels" />
              <Field label="Email Address" value={email} onChangeText={setEmail} placeholder="business@email.com" keyboardType="email-address" />
              <Field label="City / Region *" value={city} onChangeText={setCity} placeholder="e.g. Madurai, Theni, Chennai" />
              <Field label="Office Address" value={addressLine} onChangeText={setAddressLine} placeholder="Street, Area" />
              <Field label="Pincode" value={pincode} onChangeText={setPincode} placeholder="6-digit pincode" keyboardType="numeric" />
            </View>
          )}

          {step === 2 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Business Verification</Text>
              <Field label="GSTIN (Optional)" value={gstin} onChangeText={(v) => setGstin(v.toUpperCase())} placeholder="15-digit GSTIN" autoCapitalize="characters" />
              <Field label="PAN Number *" value={panNumber} onChangeText={(v) => setPanNumber(v.toUpperCase())} placeholder="10-digit PAN" autoCapitalize="characters" />
              <Text style={s.hint}>Documents will be verified by the NESAM compliance team before activation.</Text>
            </View>
          )}

          {step === 3 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Fleet Details</Text>
              <Field label="Approximate Fleet Size" value={fleetSize} onChangeText={setFleetSize} placeholder="Number of vehicles" keyboardType="numeric" />
              <Text style={s.label}>Vehicle Types in Fleet</Text>
              <View style={s.typesGrid}>
                {['Hatchback', 'Sedan', 'SUV', 'Premium SUV', 'Tempo Traveller'].map((t) => (
                  <Pressable
                    key={t}
                    style={[s.typeChip, selectedTypes.includes(t) && s.typeChipSelected]}
                    onPress={() => toggleType(t)}
                  >
                    <Text style={[s.typeChipText, selectedTypes.includes(t) && s.typeChipTextSelected]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {step === 4 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Payout Banking Details</Text>
              <Text style={s.hint}>Where NESAM will transfer your weekly marketplace earnings.</Text>
              <Field label="Account Holder Name *" value={accountHolder} onChangeText={setAccountHolder} placeholder="As per bank passbook" />
              <Field label="Bank Account Number *" value={accountNumber} onChangeText={setAccountNumber} placeholder="Account number" keyboardType="numeric" />
              <Field label="IFSC Code *" value={ifsc} onChangeText={(v) => setIfsc(v.toUpperCase())} placeholder="e.g. SBIN0001234" autoCapitalize="characters" />
              <Field label="UPI ID (for instant settlement)" value={upiId} onChangeText={setUpiId} placeholder="e.g. travels@upi" autoCapitalize="none" />
            </View>
          )}

          {step === 5 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Review & Submit</Text>
              <Row label="Owner" value={vendorName} />
              <Row label="Agency" value={businessName} />
              <Row label="City" value={city} />
              <Row label="PAN" value={panNumber || '—'} />
              <Row label="Fleet Size" value={`${fleetSize} vehicles (${selectedTypes.join(', ')})`} />
              <Row label="Bank Account" value={`${accountHolder} (${ifsc})`} />
              <Row label="UPI ID" value={upiId || '—'} />
              <Text style={[s.hint, { marginTop: 16 }]}>
                By submitting, you confirm the provided fleet and banking details are accurate.
              </Text>
            </View>
          )}

          <View style={s.actions}>
            {step > 1 && (
              <Pressable style={s.backBtn} onPress={() => setStep(step - 1)}>
                <Text style={s.backBtnText}>Back</Text>
              </Pressable>
            )}
            {step < 5 ? (
              <Pressable style={[s.nextBtn, step === 1 && { flex: 1 }]} onPress={handleNext}>
                <Text style={s.nextBtnText}>Continue →</Text>
              </Pressable>
            ) : (
              <Pressable style={[s.submitBtn, submitting && s.btnDisabled]} onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Submit Application</Text>}
              </Pressable>
            )}
          </View>

          <Pressable style={s.signOutBtn} onPress={signOut}>
            <Text style={s.signOutText}>Sign Out</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: TextInput['props']['keyboardType'];
  autoCapitalize?: TextInput['props']['autoCapitalize'];
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSecondary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'words'}
      />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.reviewRow}>
      <Text style={s.reviewLabel}>{label}</Text>
      <Text style={s.reviewVal} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.darkBg },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 20, paddingTop: 10, alignItems: 'center' },
  brand: { fontSize: 12, fontWeight: '800', color: Colors.primary, letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '900', color: Colors.white, marginTop: 4 },
  stepText: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: Colors.white, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    color: Colors.white,
  },
  hint: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18, marginTop: 6 },
  typesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#2C2C2E',
  },
  typeChipSelected: { backgroundColor: Colors.primary },
  typeChipText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 13 },
  typeChipTextSelected: { color: Colors.white },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: Colors.border },
  reviewLabel: { fontSize: 13, color: Colors.textSecondary },
  reviewVal: { fontSize: 13, fontWeight: '700', color: Colors.white, maxWidth: '60%' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  backBtn: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  nextBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtnText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
  submitBtn: {
    flex: 2,
    backgroundColor: Colors.online,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  signOutBtn: { marginTop: 20, alignItems: 'center' },
  signOutText: { color: Colors.textSecondary, fontSize: 13 },
});