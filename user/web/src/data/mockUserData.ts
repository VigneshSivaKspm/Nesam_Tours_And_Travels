export interface UserProfile {
  name: string;
  phone: string;
  email: string;
  photoUrl: string;
  walletBalance: number;
  emergencyContact: string;
  language: string;
}

export interface LocationItem {
  id: string;
  name: string;
  address: string;
  type: 'home' | 'work' | 'favorite' | 'recent' | 'airport' | 'other';
  lat?: number;
  lng?: number;
}

export interface VehicleOption {
  id: string;
  name: string;
  category: 'Hatchback' | 'Sedan' | 'SUV' | 'Premium SUV' | 'Tempo Traveller';
  passengers: number;
  luggage: number;
  basePrice: number;
  perKmRate: number;
  image: string;
  tagline: string;
  eta: string;
}

export interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  rating: number;
  tripsCount: number;
  vehicleName: string;
  vehicleNumber: string;
  photoUrl: string;
  verified: boolean;
  currentLat: number;
  currentLng: number;
}

export interface TripRecord {
  id: string;
  bookingId: string;
  pickup: LocationItem;
  drop: LocationItem;
  tripType: 'One Way' | 'Round Trip' | 'Local' | 'Airport' | 'Outstation';
  date: string;
  time: string;
  vehicle: VehicleOption;
  driver?: DriverInfo;
  fare: number;
  status: 'Confirmed' | 'Driver Assigned' | 'Driver Near Pickup' | 'Driver Arrived' | 'Trip Started' | 'Completed' | 'Cancelled' | 'Pending';
  paymentStatus: 'Paid' | 'Pending' | 'Refunded';
  paymentMethod: string;
  distanceKm: number;
  duration: string;
  otp?: string;
  rating?: number;
  reviewComment?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  category: 'Bookings' | 'Driver' | 'Payments' | 'Offers' | 'Support' | 'System';
  read: boolean;
}

export interface SupportTicket {
  id: string;
  category: string;
  bookingId?: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  createdAt: string;
}

// ── INITIAL USER PROFILE ────────────────────────────────────────
export const currentUser: UserProfile = {
  name: 'Valued Customer',
  phone: '+91 85319 70197',
  email: 'customer@nesam.in',
  photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  walletBalance: 500,
  emergencyContact: '+91 85319 70197',
  language: 'English',
};

// ── POPULAR & SAVED LOCATIONS ──────────────────────────────────
export const savedPlaces: LocationItem[] = [
  { id: 'loc-1', name: 'Home', address: 'Nanjakavundanpalayam, Gobichettipalayam, Erode', type: 'home', lat: 11.4549, lng: 77.4382 },
  { id: 'loc-2', name: 'Work / Office', address: 'Tidel Park, ELCOT SEZ, Coimbatore', type: 'work', lat: 11.0267, lng: 77.0315 },
  { id: 'loc-3', name: 'Coimbatore Airport', address: 'Civil Aerodrome Post, Coimbatore', type: 'airport', lat: 11.0300, lng: 77.0434 },
  { id: 'loc-4', name: 'Chennai Airport', address: 'Meenambakkam, Chennai', type: 'airport', lat: 12.9941, lng: 80.1709 },
  { id: 'loc-5', name: 'Salem Central Bus Stand', address: 'Zaheerabad, Salem', type: 'favorite', lat: 11.6643, lng: 78.1460 },
];

export const recentLocations: LocationItem[] = [
  { id: 'rec-1', name: 'Erode Railway Station', address: 'Railway Colony, Erode', type: 'recent' },
  { id: 'rec-2', name: 'BrookeFields Mall', address: 'Krishnaswamy Road, Coimbatore', type: 'recent' },
  { id: 'rec-3', name: 'PSG College of Technology', address: 'Peelamedu, Coimbatore', type: 'recent' },
];

// ── VEHICLE OPTIONS ─────────────────────────────────────────────
export const vehicleCategories: VehicleOption[] = [
  {
    id: 'veh-hatch',
    name: 'WagonR / Indica',
    category: 'Hatchback',
    passengers: 4,
    luggage: 1,
    basePrice: 350,
    perKmRate: 11,
    image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=300&auto=format&fit=crop&q=80',
    tagline: 'Pocket-friendly rides for daily commute',
    eta: '3 mins away',
  },
  {
    id: 'veh-sedan',
    name: 'Dzire / Etios',
    category: 'Sedan',
    passengers: 4,
    luggage: 2,
    basePrice: 450,
    perKmRate: 13,
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=300&auto=format&fit=crop&q=80',
    tagline: 'Comfortable sedans with AC & extra legroom',
    eta: '4 mins away',
  },
  {
    id: 'veh-suv',
    name: 'Innova / Ertiga',
    category: 'SUV',
    passengers: 6,
    luggage: 3,
    basePrice: 750,
    perKmRate: 18,
    image: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=300&auto=format&fit=crop&q=80',
    tagline: 'Spacious 6-seater for family & outstation',
    eta: '6 mins away',
  },
  {
    id: 'veh-prem-suv',
    name: 'Innova Crysta',
    category: 'Premium SUV',
    passengers: 7,
    luggage: 4,
    basePrice: 950,
    perKmRate: 22,
    image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=300&auto=format&fit=crop&q=80',
    tagline: 'Luxury travel with top-rated captains',
    eta: '8 mins away',
  },
  {
    id: 'veh-tt',
    name: 'Tempo Traveller (12 Seater)',
    category: 'Tempo Traveller',
    passengers: 12,
    luggage: 8,
    basePrice: 1800,
    perKmRate: 28,
    image: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=300&auto=format&fit=crop&q=80',
    tagline: 'Group travel & temple tours across TN',
    eta: '15 mins away',
  },
];

// ── MOCK DRIVERS ────────────────────────────────────────────────
export const sampleDrivers: DriverInfo[] = [
  {
    id: 'drv-1',
    name: 'Kumar M.',
    phone: '+91 98765 43210',
    rating: 4.8,
    tripsCount: 1420,
    vehicleName: 'Toyota Innova Crysta',
    vehicleNumber: 'TN 38 XX 1234',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    verified: true,
    currentLat: 11.4421,
    currentLng: 77.4290,
  },
  {
    id: 'drv-2',
    name: 'Ramesh P.',
    phone: '+91 94567 11223',
    rating: 4.9,
    tripsCount: 980,
    vehicleName: 'Maruti Suzuki Dzire',
    vehicleNumber: 'TN 33 AB 5678',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    verified: true,
    currentLat: 11.4500,
    currentLng: 77.4300,
  },
  {
    id: 'drv-3',
    name: 'Suresh K.',
    phone: '+91 97865 33445',
    rating: 4.7,
    tripsCount: 650,
    vehicleName: 'Toyota Etios',
    vehicleNumber: 'TN 37 C 9012',
    photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    verified: true,
    currentLat: 11.4350,
    currentLng: 77.4400,
  },
];

// ── SAMPLE TRIP RECORDS ─────────────────────────────────────────
export const initialTrips: TripRecord[] = [
  {
    id: 'trip-101',
    bookingId: 'NST10245',
    pickup: savedPlaces[0],
    drop: savedPlaces[2],
    tripType: 'Airport',
    date: '24 Aug 2026',
    time: '06:30 AM',
    vehicle: vehicleCategories[2], // Innova
    driver: sampleDrivers[0],
    fare: 2850,
    status: 'Trip Started',
    paymentStatus: 'Paid',
    paymentMethod: 'UPI (Razorpay)',
    distanceKm: 92,
    duration: '2 hr 15 min',
    otp: '8821',
  },
  {
    id: 'trip-102',
    bookingId: 'NST10246',
    pickup: savedPlaces[0],
    drop: savedPlaces[1],
    tripType: 'Outstation',
    date: '18 Aug 2026',
    time: '08:00 AM',
    vehicle: vehicleCategories[1],
    driver: sampleDrivers[1],
    fare: 1850,
    status: 'Completed',
    paymentStatus: 'Paid',
    paymentMethod: 'Credit Card',
    distanceKm: 68,
    duration: '1 hr 45 min',
    otp: '4419',
    rating: 5,
    reviewComment: 'Very polite driver and extremely clean car. Reached on time!',
  },
  {
    id: 'trip-103',
    bookingId: 'NST10247',
    pickup: savedPlaces[0],
    drop: savedPlaces[3],
    tripType: 'One Way',
    date: '10 Aug 2026',
    time: '05:00 AM',
    vehicle: vehicleCategories[3],
    driver: sampleDrivers[2],
    fare: 6400,
    status: 'Completed',
    paymentStatus: 'Paid',
    paymentMethod: 'UPI',
    distanceKm: 390,
    duration: '6 hr 30 min',
    otp: '9120',
    rating: 5,
  },
  {
    id: 'trip-104',
    bookingId: 'NST10248',
    pickup: recentLocations[0],
    drop: savedPlaces[0],
    tripType: 'Local',
    date: '02 Aug 2026',
    time: '04:15 PM',
    vehicle: vehicleCategories[0],
    fare: 450,
    status: 'Cancelled',
    paymentStatus: 'Refunded',
    paymentMethod: 'Wallet',
    distanceKm: 18,
    duration: '35 mins',
  },
];

// ── NOTIFICATIONS ───────────────────────────────────────────────
export const initialNotifications: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Driver Assigned for NST10245',
    message: 'Your driver Kumar M. (TN 38 XX 1234) has been assigned for your ride at 06:30 AM.',
    time: '10 mins ago',
    category: 'Driver',
    read: false,
  },
  {
    id: 'notif-2',
    title: 'Payment Successful',
    message: 'Payment of ₹2,850 was successfully processed via Razorpay UPI.',
    time: '15 mins ago',
    category: 'Payments',
    read: false,
  },
  {
    id: 'notif-3',
    title: 'Special Offer: NESAM200',
    message: 'Get flat ₹200 off on your next outstation cab to Coimbatore or Chennai!',
    time: '1 day ago',
    category: 'Offers',
    read: true,
  },
  {
    id: 'notif-4',
    title: 'Invoice Ready',
    message: 'Invoice for booking NST10246 is available for download.',
    time: '6 days ago',
    category: 'Bookings',
    read: true,
  },
];

// ── COUPONS / OFFERS ────────────────────────────────────────────
export const availableOffers = [
  {
    code: 'NESAM200',
    title: 'FLAT ₹200 OFF',
    desc: 'Valid on all Airport & Outstation bookings above ₹1,500',
    expiry: '31 Aug 2026',
    discountAmount: 200,
  },
  {
    code: 'FIRST50',
    title: '50% OFF UP TO ₹150',
    desc: 'Valid on your first local rental ride with NESAM',
    expiry: '15 Sep 2026',
    discountAmount: 150,
  },
  {
    code: 'FESTIVE10',
    title: '10% EXTRA DISCOUNT',
    desc: 'Special discount for Tempo Traveller group bookings',
    expiry: '30 Sep 2026',
    discountAmount: 300,
  },
];

// ── SUPPORT TICKETS ─────────────────────────────────────────────
export const initialTickets: SupportTicket[] = [
  {
    id: 'TCK-881',
    category: 'Refund Issue',
    bookingId: 'NST10248',
    description: 'Trip cancelled by driver, awaiting wallet credit reflection.',
    status: 'Resolved',
    createdAt: '03 Aug 2026',
  },
];
