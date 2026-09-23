import {
  DriverProfile,
  DrivingLicense,
  VehicleDetails,
  DriverStatus,
  TripDetails,
  DriverEarningsSummary,
  WalletDetails,
  PayoutRequest,
  TransactionRecord
} from '../types';

export const INITIAL_DRIVER_PROFILE: DriverProfile = {
  id: 'DRV-7892',
  name: 'Muthu Kumar',
  phone: '+91 98450 12345',
  email: 'muthu.kumar@nesamtours.com',
  photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  address: 'No. 45, Anna Nagar, Chennai, Tamil Nadu - 600040',
  emergencyContact: '+91 94441 98765 (Wife - Lakshmi)',
  rating: 4.9,
  totalTrips: 342,
  joiningDate: '15 Jan 2024',
  vendorName: 'Nesam Fleet Operations (Self-Owned)'
};

export const INITIAL_LICENSE: DrivingLicense = {
  number: 'TN-01-2018-0094821',
  expiryDate: '24 Nov 2030',
  frontPhotoUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&auto=format&fit=crop&q=80',
  backPhotoUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&auto=format&fit=crop&q=80',
  status: 'Approved'
};

export const INITIAL_VEHICLE: VehicleDetails = {
  vehicleNumber: 'TN 09 BX 4821',
  vehicleType: 'Sedan',
  make: 'Maruti Suzuki',
  model: 'Dzire Tour S',
  year: '2023',
  capacity: 4,
  color: 'Silky Silver',
  rcNumber: 'RC-TN09-2023-9912',
  rcDocUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400&auto=format&fit=crop&q=80',
  insuranceNumber: 'POL-ICICI-8849201',
  insuranceExpiry: '12 Dec 2026',
  insuranceDocUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=400&auto=format&fit=crop&q=80',
  fitnessExpiry: '10 Oct 2027',
  fitnessDocUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&auto=format&fit=crop&q=80',
  statePermitNumber: 'PERMIT-TN-ALL-STATE-2024',
  statePermitDocUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&auto=format&fit=crop&q=80',
  status: 'Approved'
};

export const INITIAL_ACTIVE_TRIP: TripDetails = {
  id: 'TRIP-9904',
  bookingId: 'NESAM-BK-4082',
  customerName: 'Senthil Nathan',
  customerPhone: '+91 97910 88231',
  pickup: {
    address: 'Chennai International Airport Terminal 2 (MAA)',
    lat: 12.9941,
    lng: 80.1709,
    landMark: 'Gate 4 Arrival Pickup Lane'
  },
  drop: {
    address: 'Hotel Grand Chola, Guindy, Chennai',
    lat: 13.0102,
    lng: 80.2157,
    landMark: 'Main Porch'
  },
  pickupDistanceKm: 1.2, // Within 2km restriction!
  distanceKm: 14.5,
  estimatedTimeMin: 32,
  vehicleType: 'Sedan (Dzire)',
  fareAmount: 780,
  driverEarnings: 702,
  platformCommission: 78,
  tollCharges: 50,
  customerOTP: '482910',
  status: 'Assigned',
  scheduledTime: 'Today, 02:30 PM',
  paymentMode: 'Razorpay'
};

export const AVAILABLE_TRIPS: TripDetails[] = [
  {
    id: 'TRIP-9908',
    bookingId: 'NESAM-BK-4101',
    customerName: 'Priya Ramanathan',
    customerPhone: '+91 98840 55123',
    pickup: {
      address: 'T. Nagar, Usman Road, Near GRT Jewellers, Chennai',
      lat: 13.0418,
      lng: 80.2341
    },
    drop: {
      address: 'Mahabalipuram Beach Resort, East Coast Road',
      lat: 12.6269,
      lng: 80.1927
    },
    pickupDistanceKm: 1.8,
    distanceKm: 52.0,
    estimatedTimeMin: 75,
    vehicleType: 'Sedan',
    fareAmount: 2150,
    driverEarnings: 1935,
    platformCommission: 215,
    tollCharges: 110,
    customerOTP: '192834',
    status: 'Assigned',
    scheduledTime: 'Today, 04:00 PM',
    paymentMode: 'Cash'
  },
  {
    id: 'TRIP-9912',
    bookingId: 'NESAM-BK-4115',
    customerName: 'Karthik Subramanian',
    customerPhone: '+91 94440 22331',
    pickup: {
      address: 'Velachery Bypass Road, Phoenix Marketcity Gate 2',
      lat: 12.9915,
      lng: 80.2170
    },
    drop: {
      address: 'SIPCOT IT Park, Siruseri, OMR',
      lat: 12.8259,
      lng: 80.2185
    },
    pickupDistanceKm: 2.5, // > 2km warning
    distanceKm: 21.3,
    estimatedTimeMin: 45,
    vehicleType: 'SUV',
    fareAmount: 1120,
    driverEarnings: 1008,
    platformCommission: 112,
    tollCharges: 40,
    customerOTP: '883920',
    status: 'Assigned',
    scheduledTime: 'Today, 05:15 PM',
    paymentMode: 'Online Wallet'
  }
];

export const INITIAL_EARNINGS_SUMMARY: DriverEarningsSummary = {
  todayEarnings: 2450,
  thisWeekEarnings: 14820,
  thisMonthEarnings: 58400,
  lifetimeEarnings: 482000,
  totalTripsCompleted: 342,
  acceptanceRate: 98,
  completionRate: 100,
  platformFeeRate: 10
};

export const INITIAL_WALLET: WalletDetails = {
  availableBalance: 4250,
  pendingBalance: 702,
  totalPayouts: 142000,
  upiId: 'muthukumar@okaxis',
  bankAccountName: 'Muthu Kumar',
  bankAccountNumber: 'XXXX XXXX 4821',
  ifscCode: 'HDFC0000240'
};

export const INITIAL_PAYOUT_REQUESTS: PayoutRequest[] = [
  {
    id: 'PO-8821',
    amount: 3500,
    requestedAt: '24 Aug 2026, 09:30 AM',
    processedAt: '24 Aug 2026, 11:15 AM',
    payoutMethod: 'UPI',
    targetDetails: 'muthukumar@okaxis',
    status: 'Completed'
  },
  {
    id: 'PO-8799',
    amount: 5000,
    requestedAt: '20 Aug 2026, 06:00 PM',
    processedAt: '21 Aug 2026, 10:00 AM',
    payoutMethod: 'Bank Transfer',
    targetDetails: 'HDFC Bank - 4821',
    status: 'Completed'
  }
];

export const INITIAL_TRANSACTIONS: TransactionRecord[] = [
  {
    id: 'TXN-9012',
    tripId: 'TRIP-9892',
    type: 'Trip Earnings',
    amount: 850,
    isCredit: true,
    timestamp: 'Today, 11:20 AM',
    description: 'Trip payout for NESAM-BK-4050 (Airport to Anna Nagar)',
    status: 'Success'
  },
  {
    id: 'TXN-9011',
    tripId: 'TRIP-9892',
    type: 'Platform Fee',
    amount: 85,
    isCredit: false,
    timestamp: 'Today, 11:20 AM',
    description: '10% NESAM Platform Fee deduction',
    status: 'Success'
  },
  {
    id: 'TXN-9010',
    tripId: 'TRIP-9892',
    type: 'Toll Reimbursement',
    amount: 60,
    isCredit: true,
    timestamp: 'Today, 11:20 AM',
    description: 'Airport Toll Receipt Reimbursement',
    status: 'Success'
  },
  {
    id: 'TXN-8990',
    type: 'Payout Withdrawal',
    amount: 3500,
    isCredit: false,
    timestamp: '24 Aug 2026',
    description: 'Instant UPI Payout to muthukumar@okaxis',
    status: 'Success'
  }
];

export const WEEKLY_EARNINGS_CHART_DATA = [
  { day: 'Mon', earnings: 1850, trips: 4 },
  { day: 'Tue', earnings: 2100, trips: 5 },
  { day: 'Wed', earnings: 2450, trips: 6 },
  { day: 'Thu', earnings: 1900, trips: 4 },
  { day: 'Fri', earnings: 2800, trips: 7 },
  { day: 'Sat', earnings: 3200, trips: 8 },
  { day: 'Sun', earnings: 2520, trips: 6 }
];
