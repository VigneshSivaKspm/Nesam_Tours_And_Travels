import React, { useState } from 'react';
import { LatLng, TripRecord, UserProfile } from '../types';
import { raiseSos } from '../services/rideService';
import { getCurrentPosition } from '../services/geoService';
import { EMERGENCY_NUMBER, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../config/constants';
import { googleMapsLink, isValidLatLng } from '../utils/geo';
import { formatPhone, localMobile } from '../utils/format';
import { describeError } from '../utils/retry';
import { Modal, Spinner } from './ui';

export function buildTripShareText(trip: TripRecord, where: LatLng | null): string {
  const d = trip.driver;
  const lines = [
    `I'm on a NESAM Tours & Travels ride (booking ${trip.bookingId}).`,
    `From: ${trip.pickup.name}`,
    `To: ${trip.drop.name}`,
  ];
  if (d) lines.push(`Driver: ${d.name}${d.phone ? ` (${formatPhone(d.phone)})` : ''}`, `Vehicle: ${[d.vehicleModel, d.vehicleNumber].filter(Boolean).join(' · ') || trip.categoryName}`);
  if (where && isValidLatLng(where)) lines.push(`Current location: ${googleMapsLink(where)}`);
  return lines.join('\n');
}

export async function shareTrip(trip: TripRecord, where: LatLng | null): Promise<'shared' | 'whatsapp' | 'cancelled'> {
  const text = buildTripShareText(trip, where);
  if (navigator.share) {
    try {
      await navigator.share({ title: `NESAM ride ${trip.bookingId}`, text });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  return 'whatsapp';
}

interface SafetyCenterModalProps {
  open: boolean;
  onClose: () => void;
  trip: TripRecord;
  profile: UserProfile;
  /** Best known position of the rider (driver position during a trip). */
  location: LatLng | null;
}

export const SafetyCenterModal: React.FC<SafetyCenterModalProps> = ({ open, onClose, trip, profile, location }) => {
  const [alerting, setAlerting] = useState(false);
  const [alertState, setAlertState] = useState<'idle' | 'sent' | 'failed'>('idle');
  const [alertError, setAlertError] = useState('');

  const emergencyLocal = localMobile(profile.emergencyContact);

  const sendAlert = async () => {
    setAlerting(true);
    setAlertError('');
    try {
      let where = location;
      if (!where) where = await getCurrentPosition(8000).catch(() => null);
      await raiseSos(trip, profile, where);
      setAlertState('sent');
    } catch (e) {
      setAlertState('failed');
      setAlertError(describeError(e, 'The alert could not be sent.'));
    } finally {
      setAlerting(false);
    }
  };

  const smsBody = encodeURIComponent(`EMERGENCY — I need help.\n${buildTripShareText(trip, location)}`);

  return (
    <Modal open={open} onClose={onClose} title="Safety centre">
      <div className="space-y-3">
        <a
          href="tel:112"
          className="flex items-center justify-center gap-2 w-full py-3 bg-red-600 text-white font-bold rounded-xl text-[14px]"
        >
          🆘 Call Emergency (112)
        </a>

        <a href="tel:+919840012345" className="flex items-center justify-center gap-2 w-full py-3 border-2 border-[#E21B23] text-[#E21B23] font-bold rounded-xl text-[13px]">
          📞 Call NESAM Support
        </a>

        {emergencyLocal && (
          <a
            href={`sms:+91${emergencyLocal}?body=${smsBody}`}
            className="flex items-center gap-3 p-3.5 rounded-2xl border border-gray-200 bg-gray-50 hover:border-gray-300"
          >
            <span className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center">💬</span>
            <span className="flex-1">
              <span className="block text-xs font-black text-gray-900">Text my emergency contact</span>
              <span className="block text-[11px] text-gray-500">{formatPhone(emergencyLocal)} · includes trip & location</span>
            </span>
          </a>
        )}

        <button
          onClick={() => {
            const shareText = `I'm traveling with NESAM Tours & Travels. Track my trip or contact support: +919840012345`;
            if (navigator.share) {
              try { navigator.share({ title: 'NESAM Trip Share', text: shareText }); } catch {}
            } else {
              const waLink = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
              window.open(waLink, '_blank');
            }
          }}
          className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-gray-200 bg-gray-50 hover:border-gray-300 text-left"
        >
          <span className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center">↗</span>
          <span className="flex-1">
            <span className="block text-xs font-black text-gray-900">Share trip details</span>
            <span className="block text-[11px] text-gray-500">Send driver, vehicle and current location to anyone</span>
          </span>
        </button>

        {trip.driver && (
          <div className="p-3 bg-gray-100 rounded-2xl text-[11px] text-gray-700">
            <div className="font-bold text-gray-900 mb-0.5">Your ride</div>
            <div className="flex justify-between gap-2">
              <span>{trip.driver.name}</span>
              <span className="font-bold">{trip.driver.vehicleNumber || trip.categoryName}</span>
            </div>
            <div className="text-gray-500">Booking {trip.bookingId}</div>
          </div>
        )}
      </div>
    </Modal>
  );
};
