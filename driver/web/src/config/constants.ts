import {
  DriverProfile,
  DrivingLicense,
  VehicleDetails,
  DriverEarningsSummary,
  WalletDetails
} from '../types';

export const DEFAULT_DRIVER_PROFILE: DriverProfile = {
  id: 'DRV-1001',
  name: 'Driver Partner',
  phone: '+91 90000 00000',
  email: 'driver@nesam.in',
  photoUrl: '',
  address: 'Tamil Nadu, India',
  emergencyContact: '',
  rating: 5.0,
  totalTrips: 0,
  joiningDate: 'New Partner',
  vendorName: 'Nesam Fleet Partner'
};

export const DEFAULT_LICENSE: DrivingLicense = {
  number: '',
  expiryDate: '',
  status: 'Pending'
};

export const DEFAULT_VEHICLE: VehicleDetails = {
  vehicleNumber: 'Not Assigned',
  vehicleType: 'Sedan',
  make: 'Vehicle',
  model: 'Not Assigned',
  year: '2024',
  capacity: 4,
  color: '',
  rcNumber: '',
  insuranceNumber: '',
  insuranceExpiry: '',
  fitnessExpiry: '',
  statePermitNumber: '',
  status: 'Pending'
};

export const DEFAULT_EARNINGS_SUMMARY: DriverEarningsSummary = {
  todayEarnings: 0,
  thisWeekEarnings: 0,
  thisMonthEarnings: 0,
  lifetimeEarnings: 0,
  totalTripsCompleted: 0,
  acceptanceRate: 100,
  completionRate: 100,
  platformFeeRate: 10
};

export const DEFAULT_WALLET: WalletDetails = {
  availableBalance: 0,
  pendingBalance: 0,
  totalPayouts: 0,
  upiId: '',
  bankAccountName: '',
  bankAccountNumber: '',
  ifscCode: ''
};

export const DEFAULT_WEEKLY_EARNINGS_CHART_DATA = [
  { day: 'Mon', gross: 0, net: 0 },
  { day: 'Tue', gross: 0, net: 0 },
  { day: 'Wed', gross: 0, net: 0 },
  { day: 'Thu', gross: 0, net: 0 },
  { day: 'Fri', gross: 0, net: 0 },
  { day: 'Sat', gross: 0, net: 0 },
  { day: 'Sun', gross: 0, net: 0 }
];
