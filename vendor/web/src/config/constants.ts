import { VendorProfile, WalletDetails } from '../types';

export const DEFAULT_VENDOR_PROFILE: VendorProfile = {
  id: 'VEN-1001',
  companyName: 'Vendor Partner Fleet',
  contactPerson: 'Fleet Operations Manager',
  phone: '+91 90000 00000',
  email: 'vendor@nesam.in',
  gstin: '',
  panNumber: '',
  address: 'Tamil Nadu, India',
  city: 'Chennai',
  totalFleetSize: 0,
  totalDriversCount: 0,
  verificationStatus: 'Pending',
  joinedDate: 'New Partner',
  bankAccountName: '',
  bankAccountNumber: '',
  ifscCode: '',
  upiId: ''
};

export const DEFAULT_WALLET: WalletDetails = {
  availableBalance: 0,
  pendingBalance: 0,
  lifetimeEarnings: 0,
  bankAccountName: '',
  bankAccountNumber: '',
  ifscCode: '',
  upiId: ''
};
