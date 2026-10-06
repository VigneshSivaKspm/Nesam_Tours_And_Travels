// Messages to the customer over WhatsApp, SMS and email (booking confirmation,
// driver assigned, trip updates, receipts). Each channel is attempted
// independently; one failing never blocks another, and every attempt is logged
// in notification_deliveries with its status.
import { DocumentData } from 'firebase-admin/firestore';
import { db } from './admin';
import { deliveryRow } from './notify';
import { Channel, SendResult, sendEmail, sendSms, sendWhatsApp, toDigits } from './providers';
import { formatDateTime12, formatTime12, pickupInstant } from './domain/time';

export type CustomerMessageKind = 'booking_approved' | 'driver_assigned' | 'booking_cancelled' | 'trip_completed' | 'refund_update';

export interface CustomerContact {
  name: string;
  /** E.164 mobile number. */
  phone: string;
  /** E.164 WhatsApp number; falls back to the mobile number. */
  whatsapp: string;
  email: string;
}

export function contactOf(b: DocumentData): CustomerContact {
  const wa = b.customerWhatsapp && typeof b.customerWhatsapp === 'object' ? b.customerWhatsapp : null;
  const phone = typeof b.phone === 'string' ? b.phone : '';
  return {
    name: typeof b.customer === 'string' ? b.customer : '',
    phone,
    whatsapp: wa && typeof wa.e164 === 'string' && wa.e164 ? wa.e164 : phone,
    email: typeof b.customerEmail === 'string' ? b.customerEmail : '',
  };
}

const rupees = (n: unknown) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

export function pickupWhen(b: DocumentData): string {
  const at = pickupInstant(b);
  return at ? formatDateTime12(at) : `${b.date ?? ''} ${typeof b.time === 'string' ? b.time : ''}`.trim();
}

interface Composed {
  subject: string;
  /** Single-line text for SMS/WhatsApp variables. */
  line: string;
  /** Longer email body. */
  body: string;
}

export function composeCustomerMessage(kind: CustomerMessageKind, b: DocumentData, extra: { otp?: string; reason?: string } = {}): Composed {
  const code = String(b.bookingId || '');
  const when = pickupWhen(b);
  const route = `${b.pickup ?? ''} to ${b.drop ?? ''}`;
  switch (kind) {
    case 'booking_approved': {
      const otpLine = extra.otp ? ` Your boarding OTP is ${extra.otp}. Share it only with your driver at pickup.` : '';
      const line = `Your NESAM booking ${code} is confirmed for ${when}, ${route}. Fare ${rupees(b.fare)}.${otpLine}`;
      return { subject: `Booking ${code} confirmed`, line, body: `Hello ${b.customer ?? ''},\n\n${line}\n\nThank you for choosing NESAM Tours & Travels.` };
    }
    case 'driver_assigned': {
      const line = `Driver assigned for booking ${code}: ${b.assignedDriverName ?? b.driver ?? ''}${b.assignedVehicleNumber ? `, vehicle ${b.assignedVehicleNumber}` : ''}. Pickup ${when}.`;
      return { subject: `Driver assigned — ${code}`, line, body: `Hello ${b.customer ?? ''},\n\n${line}` };
    }
    case 'booking_cancelled': {
      const line = `Your NESAM booking ${code} has been cancelled${extra.reason ? `: ${extra.reason}` : ''}.`;
      return { subject: `Booking ${code} cancelled`, line, body: `Hello ${b.customer ?? ''},\n\n${line}` };
    }
    case 'trip_completed': {
      const line = `Thank you for travelling with NESAM. Trip ${code} is complete. Total ${rupees(b.fare)}.`;
      return { subject: `Trip ${code} completed — receipt`, line, body: `Hello ${b.customer ?? ''},\n\n${line}\n\nPayment received: ${rupees(b.paymentSummary?.totalPaid)}. Balance: ${rupees(b.paymentSummary?.balanceDue)}.` };
    }
    case 'refund_update': {
      const line = `Refund update for booking ${code}: ${extra.reason ?? 'status changed'}.`;
      return { subject: `Refund update — ${code}`, line, body: `Hello ${b.customer ?? ''},\n\n${line}` };
    }
  }
}

const templateFor = (kind: CustomerMessageKind) => process.env[`WHATSAPP_TEMPLATE_${kind.toUpperCase()}`] || process.env.WHATSAPP_TEMPLATE_BOOKING_UPDATE || '';

/**
 * Sends one customer message on every channel that has a destination.
 * Returns each channel's result so the caller can show "WhatsApp failed,
 * SMS sent" instead of a single vague status.
 */
export async function sendCustomerMessage(
  bookingId: string,
  b: DocumentData,
  kind: CustomerMessageKind,
  extra: { otp?: string; reason?: string } = {},
): Promise<SendResult[]> {
  const c = contactOf(b);
  const m = composeCustomerMessage(kind, b, extra);
  const jobs: Promise<SendResult>[] = [];
  const template = templateFor(kind);
  if (toDigits(c.whatsapp).length >= 10) {
    jobs.push(template
      ? sendWhatsApp(c.whatsapp, { name: template, bodyParams: [c.name || 'Customer', m.line] })
      : Promise.resolve({ ok: false, channel: 'whatsapp' as Channel, status: 'not_configured' as const, provider: 'whatsapp_cloud', error: 'No WhatsApp template is configured for this message.' }));
  }
  if (toDigits(c.phone).length >= 10) jobs.push(sendSms(c.phone, { text: m.line, variables: { message: m.line, var1: m.line } }));
  if (c.email) jobs.push(sendEmail(c.email, { subject: m.subject, text: m.body }));
  const results = await Promise.all(jobs);
  const recipient = { recipientId: String(b.customerId || bookingId), recipientType: 'customer' as const, category: 'bookings' as const, title: m.subject, message: m.line, bookingId };
  await Promise.all(results.map((r) => db.collection('notification_deliveries').add(deliveryRow('', recipient, r.channel, r.status === 'sent' ? 'sent' : r.status === 'not_configured' ? 'not_configured' : 'failed', {
    provider: r.provider, providerMessageId: r.providerMessageId ?? '', error: r.error ?? '', kind,
  }))));
  return results;
}

export { formatTime12 };
