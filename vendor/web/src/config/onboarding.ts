import type { BusinessRegType, IdentityProofType, OnboardingSection } from '../types';

export const VENDOR_KYC_COLLECTION = 'vendor_kyc';
export const VENDOR_INVITES_COLLECTION = 'vendor_invites';

/** Must match storage.rules validUpload(). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_UPLOAD_TYPES = 'image/jpeg,image/png,image/webp,application/pdf';
export const MAX_FILES_PER_FIELD = 10;

export const VEHICLE_TYPES = [
  'Hatchback',
  'Sedan',
  'SUV',
  'MUV',
  'Luxury',
  'Tempo Traveller',
  'Mini Bus',
  'Bus',
  'Commercial',
] as const;

export const BUSINESS_REG_TYPES: { value: BusinessRegType; label: string; placeholder: string }[] = [
  { value: 'GST', label: 'GST Certificate', placeholder: '33ABCDE1234F1Z5' },
  { value: 'BUSINESS_REGISTRATION', label: 'Business Registration', placeholder: 'U12345TN2020PTC123456' },
  { value: 'TRADE_LICENSE', label: 'Trade License', placeholder: 'TL/2024/001234' },
];

export const IDENTITY_PROOF_TYPES: { value: IdentityProofType; label: string; placeholder: string }[] = [
  { value: 'AADHAAR', label: 'Aadhaar Card', placeholder: '1234 5678 9012' },
  { value: 'PAN', label: 'PAN Card', placeholder: 'ABCDE1234F' },
  { value: 'PASSPORT', label: 'Passport', placeholder: 'A1234567' },
];

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

/** Wizard order. Index == onboardingStep stored on the vendor doc. */
export const ONBOARDING_STEPS: { key: OnboardingSection | 'review'; title: string; short: string }[] = [
  { key: 'business', title: 'Personal & Business Info', short: 'Business' },
  { key: 'documents', title: 'Document Uploads', short: 'Documents' },
  { key: 'fleet', title: 'Fleet & Vehicle Details', short: 'Fleet' },
  { key: 'payout', title: 'Payout & Banking', short: 'Payout' },
  { key: 'review', title: 'Review & Submit', short: 'Submit' },
];

export const SECTION_LABELS: Record<OnboardingSection, string> = {
  business: 'Personal & Business Info',
  documents: 'Documents',
  fleet: 'Fleet & Vehicles',
  payout: 'Payout & Banking',
};

/** Storage sub-folders under vendors/{uid}/onboarding/. */
export type UploadCategory =
  | 'business_registration'
  | 'identity_proof'
  | 'vehicle_rc'
  | 'vehicle_photos'
  | 'vehicle_insurance';
