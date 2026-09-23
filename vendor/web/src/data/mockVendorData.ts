import {
  VendorProfile,
  FleetVehicle,
  FleetDriver,
  OpenTrip,
  BidProposal,
  VendorTrip,
  WalletDetails,
  PayoutRequest,
  TransactionRecord
} from '../types';

export const INITIAL_VENDOR_PROFILE: VendorProfile = {
  id: 'VEN-9042',
  companyName: 'Nesam Express Fleet Services Pvt Ltd',
  contactPerson: 'K. Rajasekhar (Managing Director)',
  phone: '+91 98401 55667',
  email: 'operations@nesamexpress.com',
  gstin: '33AAACN9042K1Z8',
  panNumber: 'AAACN9042K',
  address: 'Suite 402, Royal Towers, Mount Road, Chennai, Tamil Nadu - 600002',
  city: 'Chennai',
  totalFleetSize: 12,
  totalDriversCount: 10,
  verificationStatus: 'Approved',
  joinedDate: '10 Feb 2024',
  bankAccountName: 'Nesam Express Fleet Services Pvt Ltd',
  bankAccountNumber: 'XXXX XXXX 9042',
  ifscCode: 'ICIC0000102',
  upiId: 'nesamexpress@icici'
};

export const INITIAL_FLEET_VEHICLES: FleetVehicle[] = [
  {
    id: 'VEH-101',
    vehicleNumber: 'TN 09 BX 4821',
    category: 'Sedan',
    make: 'Maruti Suzuki',
    model: 'Dzire Tour S',
    year: '2023',
    seatingCapacity: 4,
    status: 'On Trip',
    assignedDriverId: 'DRV-7892',
    assignedDriverName: 'Muthu Kumar',
    rcDocUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400&auto=format&fit=crop&q=80',
    insuranceDocUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=400&auto=format&fit=crop&q=80',
    fitnessDocUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&auto=format&fit=crop&q=80',
    statePermitDocUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&auto=format&fit=crop&q=80',
    docStatus: 'Approved'
  },
  {
    id: 'VEH-102',
    vehicleNumber: 'TN 01 CV 9820',
    category: 'SUV',
    make: 'Toyota',
    model: 'Innova Crysta VX',
    year: '2024',
    seatingCapacity: 7,
    status: 'Active',
    assignedDriverId: 'DRV-8821',
    assignedDriverName: 'Karthik Raja',
    rcDocUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400&auto=format&fit=crop&q=80',
    insuranceDocUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=400&auto=format&fit=crop&q=80',
    fitnessDocUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&auto=format&fit=crop&q=80',
    statePermitDocUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&auto=format&fit=crop&q=80',
    docStatus: 'Approved'
  },
  {
    id: 'VEH-103',
    vehicleNumber: 'TN 14 AX 5512',
    category: 'Tempo Traveller',
    make: 'Force Motors',
    model: 'Monobus 14-Seater',
    year: '2023',
    seatingCapacity: 14,
    status: 'Active',
    assignedDriverId: 'DRV-9011',
    assignedDriverName: 'Sundaram P',
    rcDocUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400&auto=format&fit=crop&q=80',
    insuranceDocUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=400&auto=format&fit=crop&q=80',
    fitnessDocUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&auto=format&fit=crop&q=80',
    statePermitDocUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&auto=format&fit=crop&q=80',
    docStatus: 'Approved'
  }
];

export const INITIAL_FLEET_DRIVERS: FleetDriver[] = [
  {
    id: 'DRV-7892',
    name: 'Muthu Kumar',
    phone: '+91 98450 12345',
    email: 'muthu@nesamexpress.com',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    licenseNumber: 'TN-01-2018-0094821',
    licenseExpiry: '24 Nov 2030',
    status: 'On Trip',
    assignedVehicleNumber: 'TN 09 BX 4821',
    rating: 4.9,
    totalTrips: 342,
    docStatus: 'Approved'
  },
  {
    id: 'DRV-8821',
    name: 'Karthik Raja',
    phone: '+91 97900 44321',
    email: 'karthik@nesamexpress.com',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    licenseNumber: 'TN-09-2019-0081290',
    licenseExpiry: '14 Aug 2032',
    status: 'Available',
    assignedVehicleNumber: 'TN 01 CV 9820',
    rating: 4.8,
    totalTrips: 218,
    docStatus: 'Approved'
  },
  {
    id: 'DRV-9011',
    name: 'Sundaram P',
    phone: '+91 94441 22900',
    email: 'sundaram@nesamexpress.com',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    licenseNumber: 'TN-14-2020-0012894',
    licenseExpiry: '10 Oct 2035',
    status: 'Available',
    assignedVehicleNumber: 'TN 14 AX 5512',
    rating: 4.95,
    totalTrips: 189,
    docStatus: 'Approved'
  }
];

export const INITIAL_OPEN_TRIPS: OpenTrip[] = [
  {
    id: 'TRIP-MARKET-901',
    bookingId: 'NESAM-BK-8821',
    route: 'Chennai to Puducherry Outstation Package',
    pickup: { address: 'T. Nagar, Usman Road, Chennai', city: 'Chennai', time: '07:00 AM' },
    drop: { address: 'White Town, Promenade Beach, Puducherry', city: 'Puducherry' },
    travelDate: 'Tomorrow, 26 Aug 2026',
    vehicleCategory: 'Sedan',
    distanceKm: 165,
    offeredPayout: 4200,
    status: 'Bidding'
  },
  {
    id: 'TRIP-MARKET-902',
    bookingId: 'NESAM-BK-8835',
    route: 'Chennai Airport to Tirupati Temple Pilgrimage (2 Days)',
    pickup: { address: 'Chennai International Airport Terminal 2', city: 'Chennai', time: '09:30 AM' },
    drop: { address: 'Tirumala Tirupati Devasthanams, AP', city: 'Tirupati' },
    travelDate: '27 Aug 2026',
    vehicleCategory: 'SUV',
    distanceKm: 310,
    offeredPayout: 8500,
    status: 'Bidding'
  },
  {
    id: 'TRIP-MARKET-903',
    bookingId: 'NESAM-BK-8840',
    route: 'Corporate Event Delegation Charter',
    pickup: { address: 'ITC Grand Chola, Guindy', city: 'Chennai', time: '06:00 AM' },
    drop: { address: 'Mahabalipuram Convention Center, ECR', city: 'Mahabalipuram' },
    travelDate: '28 Aug 2026',
    vehicleCategory: 'Tempo Traveller',
    distanceKm: 120,
    offeredPayout: 9800,
    status: 'Bidding'
  }
];

export const INITIAL_BID_PROPOSALS: BidProposal[] = [
  {
    id: 'BID-401',
    tripId: 'TRIP-MARKET-901',
    bookingId: 'NESAM-BK-8821',
    offeredPayout: 4200,
    vendorCounterRate: 4500,
    biddingNote: 'Clean Dzire Tour S with experienced outstation driver.',
    submittedAt: 'Today, 10:15 AM',
    status: 'Pending Review'
  }
];

export const INITIAL_VENDOR_TRIPS: VendorTrip[] = [
  {
    id: 'VTRIP-1001',
    bookingId: 'NESAM-BK-4082',
    customerName: 'Senthil Nathan',
    customerPhone: '+91 97910 88231',
    pickupAddress: 'Chennai Airport Gate 4',
    dropAddress: 'Hotel Grand Chola, Guindy',
    scheduledTime: 'Today, 02:30 PM',
    vehicleNumber: 'TN 09 BX 4821',
    driverId: 'DRV-7892',
    driverName: 'Muthu Kumar',
    driverPhone: '+91 98450 12345',
    grossFare: 780,
    platformFee: 78,
    vendorPayout: 702,
    status: 'In Progress'
  }
];

export const INITIAL_WALLET: WalletDetails = {
  availableBalance: 48500,
  pendingBalance: 4500,
  lifetimeEarnings: 582000,
  upiId: 'nesamexpress@icici',
  bankAccountName: 'Nesam Express Fleet Services Pvt Ltd',
  bankAccountNumber: 'XXXX XXXX 9042',
  ifscCode: 'ICIC0000102'
};

export const INITIAL_PAYOUT_REQUESTS: PayoutRequest[] = [
  {
    id: 'VPO-501',
    amount: 25000,
    requestedAt: '22 Aug 2026, 02:00 PM',
    processedAt: '22 Aug 2026, 04:30 PM',
    payoutMethod: 'Bank Transfer',
    targetDetails: 'ICICI Bank - 9042',
    status: 'Completed'
  }
];

export const INITIAL_TRANSACTIONS: TransactionRecord[] = [
  {
    id: 'VTXN-901',
    tripId: 'NESAM-BK-4050',
    type: 'Trip Revenue',
    amount: 1450,
    isCredit: true,
    timestamp: 'Today, 11:20 AM',
    description: 'Fleet payout for NESAM-BK-4050 (Chennai to ECR)',
    status: 'Success'
  },
  {
    id: 'VTXN-900',
    type: 'Payout Withdrawal',
    amount: 25000,
    isCredit: false,
    timestamp: '22 Aug 2026',
    description: 'Bank Transfer payout to ICICI 9042',
    status: 'Success'
  }
];
