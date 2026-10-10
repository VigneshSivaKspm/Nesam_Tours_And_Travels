// Pure booking rules shared by the booking steps (unit-tested).
import { SCHEDULE_MAX_DAYS, SCHEDULE_MIN_LEAD_MIN } from '../config/constants';
import type { RideCategory } from '../types';
import { formatINR } from './format';

/** Why a schedule can't be booked, or '' when it can. */
export function scheduleProblem(at: Date | null, now = Date.now()): string {
  if (!at) return '';
  const lead = (at.getTime() - now) / 60000;
  if (lead < SCHEDULE_MIN_LEAD_MIN) return `Scheduled rides need at least ${SCHEDULE_MIN_LEAD_MIN} minutes’ notice.`;
  if (lead > SCHEDULE_MAX_DAYS * 1440) return `You can schedule up to ${SCHEDULE_MAX_DAYS} days ahead.`;
  return '';
}

/** Same rules as the booking server (functions/src/bookingBuild.ts whatsappContact). */
export function whatsappProblem(same: boolean, code: string, number: string): string {
  if (same) return '';
  const digits = number.replace(/[\s()-]/g, '');
  if (!/^\+[1-9]\d{0,2}$/.test(code.trim())) return 'Enter the country code, for example +91.';
  if (!/^\d+$/.test(digits)) return 'Enter the WhatsApp number (digits only).';
  if (code.trim() === '+91') return /^[6-9]\d{9}$/.test(digits) ? '' : 'Enter a valid 10-digit WhatsApp number.';
  return digits.length >= 6 && digits.length <= 14 ? '' : 'Enter a valid WhatsApp number for that country code.';
}

/** "200 km included · Extra km ₹15" from the category's own configuration. */
export function inclusionLine(c: RideCategory, outstation: boolean): string {
  const parts: string[] = [];
  if (c.fare.baseKm > 0) parts.push(`${c.fare.baseKm} km included`);
  const extra = c.fare.extras?.extraKmRate ?? (outstation && c.fare.outstationPerKmRate ? c.fare.outstationPerKmRate : c.fare.perKmRate);
  if (extra > 0) parts.push(`Extra km ${formatINR(extra)}`);
  return parts.join(' · ');
}
