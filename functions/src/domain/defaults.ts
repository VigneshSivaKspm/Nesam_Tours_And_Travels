import { RideCategory } from './types';
export const DEFAULT_RIDE_CATEGORIES: RideCategory[] = [
  {
    id: 'mini',
    name: 'Mini',
    description: 'Compact hatchbacks for everyday rides',
    seats: 4,
    matchVehicleTypes: ['hatchback', 'mini'],
    fare: { baseFare: 50, baseKm: 2, perKmRate: 14, perMinuteRate: 1.5, minimumFare: 80, nightCharge: 40, driverAllowance: 300 },
    displayOrder: 1,
  },
  {
    id: 'sedan',
    name: 'Sedan',
    description: 'Comfortable AC sedans with extra legroom',
    seats: 4,
    matchVehicleTypes: ['sedan'],
    fare: { baseFare: 70, baseKm: 2, perKmRate: 16, perMinuteRate: 1.75, minimumFare: 100, nightCharge: 50, driverAllowance: 400 },
    displayOrder: 2,
  },
  {
    id: 'suv',
    name: 'SUV',
    description: 'Spacious 6–7 seaters for family & luggage',
    seats: 6,
    matchVehicleTypes: ['suv'],
    fare: { baseFare: 100, baseKm: 2, perKmRate: 21, perMinuteRate: 2, minimumFare: 150, nightCharge: 75, driverAllowance: 400 },
    displayOrder: 3,
  },
  {
    id: 'premium-suv',
    name: 'Premium SUV',
    description: 'Innova Crysta class with top-rated drivers',
    seats: 7,
    matchVehicleTypes: ['premium suv'],
    fare: { baseFare: 150, baseKm: 2, perKmRate: 26, perMinuteRate: 2.5, minimumFare: 200, nightCharge: 100, driverAllowance: 500 },
    displayOrder: 4,
  },
  {
    id: 'tempo-traveller',
    name: 'Tempo Traveller',
    description: '12-seater for group travel & temple tours',
    seats: 12,
    matchVehicleTypes: ['tempo traveller'],
    fare: { baseFare: 400, baseKm: 5, perKmRate: 30, perMinuteRate: 3, minimumFare: 800, nightCharge: 150, driverAllowance: 600 },
    displayOrder: 5,
  },
];

