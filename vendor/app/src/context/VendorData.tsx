// Live data for an approved vendor, subscribed once per session (the Vendor
// Web dashboard mounted the same listeners in App.tsx). Torn down on sign-out
// because the provider is keyed by uid.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { VendorProfile, VendorRecord } from '../types/vendor';
import type { DriverInviteRecord, FleetDriver, FleetVehicle, MarketTrip, VendorBid, VendorBooking, VendorPayoutRequest } from '../types/operations';
import {
  subscribeToFleetDrivers,
  subscribeToFleetVehicles,
  subscribeToInvites,
  subscribeToMarketplace,
  subscribeToMyBids,
  subscribeToVendorBookings,
  subscribeToVendorPayouts,
  isActiveBooking,
  type VendorIdentity,
} from '../services/vendorService';
import { summarizeVendorWallet, type VendorWallet } from '../utils/wallet';
import { describeDataError } from '../utils/retry';

interface VendorDataValue {
  profile: VendorProfile;
  record: VendorRecord;
  identity: VendorIdentity;
  vehicles: FleetVehicle[];
  drivers: FleetDriver[];
  bookings: VendorBooking[];
  activeBookings: VendorBooking[];
  awaitingDispatch: VendorBooking[];
  marketTrips: MarketTrip[];
  bids: VendorBid[];
  invites: DriverInviteRecord[];
  payouts: VendorPayoutRequest[];
  wallet: VendorWallet;
  errors: { bookings: string; market: string; bids: string };
}

const Ctx = createContext<VendorDataValue | null>(null);

export function useVendorData(): VendorDataValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('VendorDataProvider is missing');
  return v;
}

export function VendorDataProvider({ profile, record, children }: { profile: VendorProfile; record: VendorRecord; children: React.ReactNode }) {
  const vendorId = profile.id;
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [bookings, setBookings] = useState<VendorBooking[]>([]);
  const [marketTrips, setMarketTrips] = useState<MarketTrip[]>([]);
  const [bids, setBids] = useState<VendorBid[]>([]);
  const [invites, setInvites] = useState<DriverInviteRecord[]>([]);
  const [payouts, setPayouts] = useState<VendorPayoutRequest[]>([]);
  const [errors, setErrors] = useState({ bookings: '', market: '', bids: '' });

  useEffect(() => subscribeToFleetVehicles(vendorId, setVehicles), [vendorId]);
  useEffect(() => subscribeToFleetDrivers(vendorId, setDrivers), [vendorId]);
  useEffect(
    () =>
      subscribeToVendorBookings(
        vendorId,
        (b) => {
          setBookings(b);
          setErrors((e) => (e.bookings ? { ...e, bookings: '' } : e));
        },
        (err) => setErrors((e) => ({ ...e, bookings: describeDataError(err) })),
      ),
    [vendorId],
  );
  useEffect(
    () =>
      subscribeToMarketplace(
        (t) => {
          setMarketTrips(t);
          setErrors((e) => (e.market ? { ...e, market: '' } : e));
        },
        (err) => setErrors((e) => ({ ...e, market: describeDataError(err) })),
      ),
    [],
  );
  useEffect(
    () =>
      subscribeToMyBids(
        vendorId,
        (b) => {
          setBids(b);
          setErrors((e) => (e.bids ? { ...e, bids: '' } : e));
        },
        (err) => setErrors((e) => ({ ...e, bids: describeDataError(err) })),
      ),
    [vendorId],
  );
  useEffect(() => subscribeToInvites(vendorId, setInvites), [vendorId]);
  useEffect(() => subscribeToVendorPayouts(vendorId, setPayouts), [vendorId]);

  const value = useMemo<VendorDataValue>(() => {
    const sorted = [...bookings].sort((a, b) => (b.confirmedAt?.getTime() ?? 0) - (a.confirmedAt?.getTime() ?? 0));
    const activeBookings = sorted.filter(isActiveBooking);
    return {
      profile,
      record,
      identity: { id: profile.id, companyName: profile.companyName, phone: profile.phone },
      vehicles,
      drivers,
      bookings: sorted,
      activeBookings,
      awaitingDispatch: activeBookings.filter((b) => b.status === 'Confirmed' || (b.status === 'Assigned' && !b.driverId)),
      marketTrips,
      bids,
      invites,
      payouts,
      wallet: summarizeVendorWallet(sorted, payouts, profile.commissionRate),
      errors,
    };
  }, [profile, record, vehicles, drivers, bookings, marketTrips, bids, invites, payouts, errors]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
