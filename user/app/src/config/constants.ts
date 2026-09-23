import { CustomerProfile, VehicleCategory, TripRecord } from '../types';

export const currentCustomer: CustomerProfile = {
  name: 'Sriram',
  phone: '+91 98412 33456',
  email: 'sriram.m@email.com',
  photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  walletBalance: 500,
  emergencyContact: '+91 98412 33456',
};

export const vehicles: VehicleCategory[] = [
  { id: 'v1', name: 'WagonR / Hatchback', passengers: 4, luggage: 1, ratePerKm: 11, baseFare: 350, image: '🚗' },
  { id: 'v2', name: 'Dzire / Etios Sedan', passengers: 4, luggage: 2, ratePerKm: 13, baseFare: 450, image: '🚘' },
  { id: 'v3', name: 'Toyota Innova SUV', passengers: 6, luggage: 3, ratePerKm: 18, baseFare: 750, image: '🚙' },
  { id: 'v4', name: 'Innova Crysta Premium', passengers: 7, luggage: 4, ratePerKm: 22, baseFare: 950, image: '🚙' },
  { id: 'v5', name: 'Tempo Traveller (12 Seater)', passengers: 12, luggage: 8, ratePerKm: 28, baseFare: 1800, image: '🚐' },
];

export const defaultTrips: TripRecord[] = [];
