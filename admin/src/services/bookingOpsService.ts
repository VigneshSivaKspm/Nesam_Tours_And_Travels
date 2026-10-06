/**
 * Admin booking operations. Every one is a server function that validates the
 * booking state machine, checks the caller's permission and writes an audit
 * entry; the screens only collect input and show the result.
 */
import { callFunction, newId } from "./callables";

export interface ChannelResult {
  channel: string;
  status: string;
  error?: string;
}

export const approveBooking = (bookingId: string, note = "") =>
  callFunction<unknown, { ok: boolean; partnersNotified: number; customerChannels: ChannelResult[] }>("approveBooking", { bookingId, note }, 120000);

export const rejectBooking = (bookingId: string, reason: string) => callFunction<unknown, { ok: boolean }>("rejectBooking", { bookingId, reason });

export interface CancelInput {
  bookingId: string;
  reason: string;
  cancellationCharge?: number;
  refundEligible?: boolean;
  refundAmount?: number;
  refundMethod?: string;
}
export const cancelBooking = (i: CancelInput) => callFunction<CancelInput, { ok: boolean; refundAmount: number; amountPaid: number }>("cancelBooking", i);

export interface RefundUpdate {
  bookingId: string;
  status: "Processing" | "Completed" | "Failed" | "Rejected";
  method?: string;
  reference?: string;
  note?: string;
  amount?: number;
}
export const updateRefund = (i: RefundUpdate) => callFunction<RefundUpdate, { ok: boolean }>("updateRefund", i);

export interface AssignInput {
  bookingId: string;
  /** Empty / omitted removes the current assignment. */
  driverId?: string;
  vehicleId?: string;
  reason: string;
  force?: boolean;
}
export const assignDriver = (i: AssignInput) => callFunction<AssignInput, { ok: boolean; action: "assign" | "reassign" | "remove" }>("assignDriver", i);

export const acknowledgeUnassignedAlert = (bookingId: string) => callFunction<unknown, { ok: boolean }>("acknowledgeUnassignedAlert", { bookingId });

export type PaymentMethodName = "Cash" | "UPI" | "Bank Transfer";
export type CollectorType = "admin" | "driver" | "vendor" | "staff" | "system";

export interface PaymentInput {
  bookingId: string;
  amount: number;
  method: string;
  kind?: "advance" | "partial" | "final";
  collectorType: CollectorType;
  reference?: string;
  notes?: string;
  paymentDate?: string;
  /** Idempotency key: a retried request never records the payment twice. */
  requestId?: string;
}
export const recordPayment = (i: PaymentInput) =>
  callFunction<PaymentInput, { id: string; duplicate: boolean }>("recordPayment", { ...i, requestId: i.requestId ?? newId("pay") });

export const voidPayment = (bookingId: string, paymentId: string, reason: string) =>
  callFunction<unknown, unknown>("voidPayment", { bookingId, paymentId, reason });

export interface FareAdjustmentInput {
  enabled: boolean;
  name: string;
  direction: "increase" | "decrease";
  percent: number;
  startDate: string;
  endDate: string;
  reason: string;
  expectedVersion?: number;
}
export const saveFareAdjustment = (i: FareAdjustmentInput) => callFunction<FareAdjustmentInput, { version: number }>("saveFareAdjustment", i);

export interface IssuePenaltyInput {
  party: "Driver" | "Vendor";
  partyId: string;
  category: string;
  reason: string;
  description: string;
  amount: number;
  customerCompensation?: number;
  bookingId?: string;
  incidentDate: string;
  requestId?: string;
}
export const issuePenalty = (i: IssuePenaltyInput) =>
  callFunction<IssuePenaltyInput, { id: string; duplicate: boolean }>("issuePenalty", { ...i, requestId: i.requestId ?? newId("pen") });

export const transitionPenalty = (penaltyId: string, status: "Pending" | "Paid" | "Deducted" | "Waived", note = "", reference = "") =>
  callFunction<unknown, { status: string }>("transitionPenalty", { penaltyId, status, note, reference });

export const sendVerificationCode = (bookingId: string, channels: ("whatsapp" | "sms" | "email")[]) =>
  callFunction<unknown, { sent: ChannelResult[]; expiresInMinutes: number }>("sendVerificationCode", { bookingId, channels });

export const verifyCustomerCode = (bookingId: string, code: string) => callFunction<unknown, { verified: boolean }>("verifyCustomerCode", { bookingId, code });

export interface LegalPublishInput {
  type: string;
  role: string;
  title: string;
  body: string;
  checkboxText: string;
  requiresAcceptance: boolean;
  changeSummary: string;
}
export const publishLegalDocument = (i: LegalPublishInput) => callFunction<LegalPublishInput, { key: string; version: number }>("publishLegalDocument", i);
export const seedLegalDocuments = () => callFunction<unknown, { created: number; total: number }>("seedLegalDocuments", {});

export interface RequiredLegalDoc { key: string; title: string; version: number; type: string; checkboxText: string }
export const getLegalStatus = (role: string) => callFunction<unknown, { missing: RequiredLegalDoc[]; required: RequiredLegalDoc[] }>("getLegalStatus", { role });
export const acceptLegalDocuments = (role: string, docs: RequiredLegalDoc[], checkboxText: string) =>
  callFunction<unknown, { accepted: number }>("acceptLegalDocuments", {
    role, confirmed: true, accept: docs.map((d) => ({ key: d.key, version: d.version })), checkboxText, source: "admin_web",
    device: { platform: "web", appVersion: "admin" },
  });
