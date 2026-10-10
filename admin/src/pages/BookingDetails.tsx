import { useEffect, useMemo, useState, type ReactNode } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, auth } from "../services/firebase";
import { InvoiceActionError, issueInvoiceForBooking } from "../services/invoiceService";
import type { Booking, Driver, Vehicle, Vendor } from "../types";
import FareOverrideModal from "../components/FareOverrideModal";
import FareBreakupView from "../components/FareBreakupView";
import { Notice, primaryBtn, secondaryBtn } from "../components/FormKit";
import { Toast, useToast } from "../components/Feedback";
import { AlertBadge, StatusBadge } from "../components/booking/BookingBadges";
import { ApproveDialog, AssignDriverModal, CancelBookingModal, RecordPaymentModal, RefundModal, RejectDialog, VoidPaymentDialog } from "../components/booking/BookingActions";
import { AssignmentHistory, PaymentsPanel, VehicleVerificationPanel, VerifyCustomerModal, type AssignmentRow, type PaymentRow, type VerificationDoc } from "../components/booking/BookingPanels";
import { useCan } from "../components/AccessContext";
import { parseAmount } from "../utils/analytics";
import { describeDataError, subscribeDrivers, subscribeToCollection, subscribeToDocument, subscribeVehicles, subscribeVendors } from "../services/adminFirestoreService";
import { acknowledgeUnassignedAlert } from "../services/bookingOpsService";
import { tripSubStatusOf, unassignedSeverity } from "../domain/bookingFlow";
import { useNow } from "../hooks/useNow";
import { useOperationsSettings } from "../hooks/useOperationsSettings";
import { bookingPickupDate, formatDate, formatDateTime12, formatTime12, relativeFromNow, toDate } from "../utils/time";
import { subscribeBookingById } from "../services/bookingSubscription";

const rupees = (n: number) => `₹${(Math.round(n * 100) / 100).toLocaleString("en-IN")}`;
const stamp = (v: unknown) => {
  const d = toDate(v as never);
  return d ? formatDateTime12(d) : null;
};
const mapLink = (lat?: number, lng?: number) => (typeof lat === "number" && typeof lng === "number" ? `https://www.google.com/maps?q=${lat},${lng}` : null);

function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-bold text-[#111] flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-[#E21B23]" />{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-[#555] uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-sm font-medium text-[#111] break-words">{children || "—"}</div>
    </div>
  );
}

type Dialog = "approve" | "reject" | "assign" | "cancel" | "pay" | "refund" | "fare" | "verify" | null;

export default function BookingDetails({ bookingId, onBack }: { bookingId: string; onBack: () => void }) {
  const [booking, setBooking] = useState<Booking | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[] | null>(null);
  const [events, setEvents] = useState<{ id: string; type: string; actorRole?: string; at?: unknown; reason?: string; note?: string }[] | null>(null);
  const [verification, setVerification] = useState<VerificationDoc | null | undefined>(undefined);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [voiding, setVoiding] = useState<PaymentRow | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const { toast, show } = useToast(9000);
  const canFinance = useCan("finance");
  const canOps = useCan("operations");
  const now = useNow(30000);
  const ops = useOperationsSettings();

  useEffect(() => {
    setBooking(undefined);
    setLoadError(null);
    setPayments(null);
    setAssignments(null);
    setEvents(null);
    setVerification(undefined);
    const unsubs = [
      subscribeBookingById(bookingId, setBooking, setLoadError),
      subscribeDrivers(setDrivers),
      subscribeVehicles(setVehicles),
      subscribeVendors(setVendors),
      subscribeToCollection<PaymentRow>(`bookings/${bookingId}/payment_transactions`, setPayments, (m) => { setPaymentsError(m); setPayments([]); }),
      subscribeToCollection<AssignmentRow>(`bookings/${bookingId}/assignments`, setAssignments, () => setAssignments([])),
      subscribeToCollection<{ id: string; type: string; at?: unknown }>(`bookings/${bookingId}/events`, setEvents, () => setEvents([])),
      subscribeToDocument<VerificationDoc>(`vehicle_verifications/${bookingId}`, setVerification, (m) => { setVerificationError(m); setVerification(null); }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [bookingId, retry]);

  const pickup = booking ? bookingPickupDate(booking) : null;
  const severity = booking ? unassignedSeverity(booking, pickup?.getTime() ?? null, now.getTime(), { warningHours: ops.warningHours, criticalHours: ops.criticalHours }) : "none";
  const sub = booking ? tripSubStatusOf(booking) : "Not Started";
  const timeline = useMemo(() => {
    if (!booking) return [];
    const b = booking as Booking & Record<string, unknown>;
    const rows: { label: string; time: string | null; done: boolean; where?: string }[] = [
      { label: "Booking created", time: stamp(b.createdAt), done: true },
      { label: "Approved by admin", time: stamp(b.approvedAt), done: !!b.approvedAt || !["Pending", "Rejected"].includes(b.status) },
      { label: "Driver assigned", time: stamp(b.assignedAt), done: !!b.assignedDriverId },
      // Driver steps: Reached Pickup Location → (boarding OTP) → Trip Started → Trip Ended.
      { label: "Reached pickup location", time: stamp(b.reachedPickupAt), done: ["Reached Pickup", "Trip Started", "Trip Ended"].includes(sub), where: mapLink(booking.reachedPickupLocation?.lat, booking.reachedPickupLocation?.lng) ?? undefined },
      { label: "Customer boarding OTP verified", time: stamp(b.boardingVerifiedAt), done: !!b.boardingVerifiedAt },
      { label: "Trip started", time: stamp(b.tripStartedAt ?? b.startedAt), done: ["Trip Started", "Trip Ended"].includes(sub) && b.status !== "Pending", where: mapLink(booking.tripStartedLocation?.lat, booking.tripStartedLocation?.lng) ?? undefined },
      { label: "Trip ended", time: stamp(b.tripEndedAt ?? b.completedAt), done: booking.status === "Completed", where: mapLink(booking.tripEndedLocation?.lat, booking.tripEndedLocation?.lng) ?? undefined },
    ];
    // Steps an older booking passed without a stored time say so instead of guessing.
    return rows.map((r) => ({ ...r, time: r.time ?? (r.done ? "Time not recorded" : null) }));
  }, [booking, sub]);

  if (booking === undefined && !loadError) return <div className="p-6 text-sm text-[#555]" role="status">Loading booking…</div>;
  if (loadError) {
    return (
      <div className="p-6 max-w-md">
        <Notice tone="error"><div className="flex justify-between gap-3"><span>{loadError}</span><button onClick={() => setRetry((n) => n + 1)} className="underline font-semibold">Retry</button></div></Notice>
        <button onClick={onBack} className={`${secondaryBtn} mt-3`}>Back to bookings</button>
      </div>
    );
  }
  if (!booking) {
    return (
      <div className="p-6 text-center space-y-2">
        <div className="text-base font-bold text-[#111]">Booking not found</div>
        <div className="text-sm text-[#555]">The booking “{bookingId}” does not exist or was removed.</div>
        <button onClick={onBack} className={secondaryBtn}>Back to bookings</button>
      </div>
    );
  }

  const fare = parseAmount(booking.fare);
  const fb = booking.fareBreakdown;
  const tolls = booking.tollCharges && booking.tollCharges > 0 ? booking.tollCharges : 0;
  const assignedDriver = booking.assignedDriverId ? drivers.find((d) => d.id === booking.assignedDriverId) : undefined;
  const driverName = booking.assignedDriverName || booking.driver || assignedDriver?.name || "";
  const done = (text: string) => { setDialog(null); setVoiding(null); show(text); };
  const open = ["Approved", "Confirmed", "Assigned"].includes(booking.status);
  const cancellable = ["Approved", "Confirmed", "Assigned", "Ongoing"].includes(booking.status);
  const isCompleted = booking.status === "Completed";
  const toll = (booking.tolls ?? []) as { id: string; name: string; amount: number; receiptPhotoUrl?: string }[];

  const approveTolls = async () => {
    try {
      await updateDoc(doc(db, "bookings", booking.id), { tollsApproved: true, updatedAt: serverTimestamp() });
      show("Toll receipts approved.");
    } catch (e) {
      show(describeDataError(e), "error");
    }
  };

  const issueInvoice = async () => {
    if (invoiceBusy) return;
    setInvoiceBusy(true);
    try {
      const { invoiceNumber } = await issueInvoiceForBooking(booking, auth.currentUser?.uid || "");
      show(`Tax invoice ${invoiceNumber} issued — see Finance › Invoices.`);
    } catch (e) {
      show(e instanceof InvoiceActionError ? e.message : "Could not issue the invoice. Please try again.", "error");
    } finally {
      setInvoiceBusy(false);
    }
  };

  const ackAlert = async () => {
    try {
      await acknowledgeUnassignedAlert(booking.id);
      show("Alert acknowledged.");
    } catch (e) {
      show(e instanceof Error ? e.message : "Could not acknowledge the alert.", "error");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <Toast toast={toast} />
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="text-sm font-semibold text-[#555] hover:text-[#111]">← Back to bookings</button>
        <span className="text-sm font-mono font-bold text-[#E21B23]">{booking.bookingId || booking.id}</span>
        <StatusBadge status={booking.status} />
        <AlertBadge severity={severity} label={pickup ? relativeFromNow(pickup, now).replace(/^in /, "") : undefined} />
        <div className="ml-auto flex flex-wrap gap-2">
          {canOps && booking.status === "Pending" && <button onClick={() => setDialog("approve")} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700">Approve booking</button>}
          {canOps && booking.status === "Pending" && <button onClick={() => setDialog("reject")} className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-red-300 text-red-700 hover:bg-red-50">Reject</button>}
          {canOps && open && <button onClick={() => setDialog("assign")} className={primaryBtn}>{booking.assignedDriverId ? "Change / reassign driver" : "Assign driver"}</button>}
          {canOps && <button onClick={() => setDialog("verify")} className={secondaryBtn}>Verify customer</button>}
          {canOps && cancellable && <button onClick={() => setDialog("cancel")} className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-red-300 text-red-700 hover:bg-red-50">Cancel booking</button>}
          {canFinance && isCompleted && <button onClick={issueInvoice} disabled={invoiceBusy} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#111] disabled:opacity-60">{invoiceBusy ? "Issuing…" : "Generate tax invoice"}</button>}
        </div>
      </div>

      {severity === "critical" || severity === "warning" ? (
        <Notice tone={severity === "critical" ? "error" : "warn"}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span><strong>{severity === "critical" ? "Urgent: " : ""}No driver is assigned</strong> and pickup is {pickup ? `${formatTime12(pickup)} (${relativeFromNow(pickup, now)})` : "soon"}.{booking.unassignedAlert?.acknowledgedByName ? ` Acknowledged by ${booking.unassignedAlert.acknowledgedByName}.` : ""}</span>
            {canOps && !booking.unassignedAlert?.acknowledgedBy && <button onClick={ackAlert} className="underline font-semibold">Acknowledge</button>}
          </div>
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card title="Customer" right={booking.customerVerified ? <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-300 rounded px-2 py-0.5">✓ Verified</span> : <span className="text-xs text-[#555]">Not verified</span>}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Fact label="Name">{booking.customer}</Fact>
              <Fact label="Mobile">{booking.phone || booking.customerPhone}</Fact>
              <Fact label="WhatsApp">{booking.customerWhatsapp?.e164 ? `${booking.customerWhatsapp.e164}${booking.customerWhatsapp.sameAsMobile ? " (same)" : ""}` : booking.phone}</Fact>
              <Fact label="Email">{booking.customerEmail}</Fact>
            </div>
          </Card>

          <Card title="Trip">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Fact label="Pickup">
                <div>{booking.pickupAddress || booking.pickup}</div>
                {mapLink(booking.pickupLat, booking.pickupLng) && <a className="text-xs font-semibold text-[#E21B23] hover:underline" href={mapLink(booking.pickupLat, booking.pickupLng)!} target="_blank" rel="noreferrer">{booking.pickupLat?.toFixed(5)}, {booking.pickupLng?.toFixed(5)} · open map</a>}
              </Fact>
              <Fact label="Drop">
                <div>{booking.dropAddress || booking.drop}</div>
                {mapLink(booking.dropLat, booking.dropLng) && <a className="text-xs font-semibold text-[#E21B23] hover:underline" href={mapLink(booking.dropLat, booking.dropLng)!} target="_blank" rel="noreferrer">{booking.dropLat?.toFixed(5)}, {booking.dropLng?.toFixed(5)} · open map</a>}
              </Fact>
              <Fact label="Service">{booking.service}{booking.tripType ? ` · ${booking.tripType}` : ""}</Fact>
              <Fact label="Pickup date">{pickup ? formatDate(pickup) : booking.date}</Fact>
              <Fact label="Pickup time">{pickup ? formatTime12(pickup) : booking.time}</Fact>
              <Fact label="Vehicle">{booking.vehicleCategory || booking.vehicle}</Fact>
              <Fact label="Distance">{booking.distanceKm ? `${booking.distanceKm} km` : ""}</Fact>
              <Fact label="Est. duration">{fb?.durationMin ? `${fb.durationMin} min` : ""}</Fact>
              <Fact label="Trip progress">{sub}</Fact>
            </div>
            {booking.notes && <p className="mt-3 text-sm text-[#333]"><strong>Notes:</strong> {booking.notes}</p>}
          </Card>

          <Card title="Driver & assignment" right={canOps && open ? <button onClick={() => setDialog("assign")} className="text-sm font-semibold text-[#E21B23] hover:underline">{booking.assignedDriverId ? "Change" : "Assign"}</button> : undefined}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <Fact label="Driver">{driverName || "Not assigned"}</Fact>
              <Fact label="Phone">{driverName ? booking.driverPhone || assignedDriver?.phone : ""}</Fact>
              <Fact label="Vehicle no.">{booking.assignedVehicleNumber}</Fact>
              <Fact label="Fleet">{booking.assignedVendorId ? booking.assignedVendorName || "Vendor fleet" : driverName ? "Independent driver" : ""}</Fact>
            </div>
            <div className="text-xs font-bold uppercase text-[#555] mb-2">Assignment history</div>
            <AssignmentHistory rows={assignments} />
          </Card>

          <Card title="Vehicle verification photos"><VehicleVerificationPanel doc={verification} error={verificationError} /></Card>

          <Card title="Trip timeline">
            <ol className="space-y-4">
              {timeline.map((t) => (
                <li key={t.label} className="flex items-start gap-3">
                  <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs shrink-0 ${t.done ? "bg-[#E21B23]" : "bg-white border-2 border-[#D4D4D4]"}`}>{t.done ? "✓" : ""}</span>
                  <div>
                    <div className={`text-sm font-semibold ${t.done ? "text-[#111]" : "text-[#777]"}`}>{t.label}</div>
                    <div className="text-xs text-[#555]">{t.time ?? "—"}{t.where && <> · <a href={t.where} target="_blank" rel="noreferrer" className="font-semibold text-[#E21B23] hover:underline">location</a></>}</div>
                  </div>
                </li>
              ))}
              {(booking.status === "Cancelled" || booking.status === "Rejected") && (
                <li className="flex items-start gap-3"><span className="mt-0.5 w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">✕</span><div><div className="text-sm font-semibold text-red-700">{booking.status}</div><div className="text-xs text-[#555]">{stamp(booking.cancellation?.at ?? booking.cancelledAt) ?? ""}</div></div></li>
              )}
            </ol>
          </Card>

          <Card title="Activity log">
            {events === null ? <p className="text-sm text-[#555]">Loading…</p> : events.length === 0 ? <p className="text-sm text-[#555]">No activity recorded.</p> : (
              <ul className="space-y-1.5 max-h-72 overflow-auto">
                {[...events].sort((a, b) => (toDate(b.at as never)?.getTime() ?? 0) - (toDate(a.at as never)?.getTime() ?? 0)).map((e) => (
                  <li key={e.id} className="text-sm flex justify-between gap-3"><span className="text-[#222]">{e.type.replace(/_/g, " ")}{e.actorRole ? <span className="text-[#555]"> · {e.actorRole}</span> : null}{e.reason || e.note ? <span className="text-[#555]"> — {e.reason || e.note}</span> : null}</span><span className="text-xs text-[#555] whitespace-nowrap">{stamp(e.at) ?? ""}</span></li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Fare">
            {booking.globalAdjustmentApplied && <div className="mb-3"><Notice tone="info"><strong>{booking.globalAdjustmentApplied.name}</strong>: {booking.globalAdjustmentApplied.direction === "increase" ? "+" : "−"}{booking.globalAdjustmentApplied.percent}% ({booking.globalAdjustmentApplied.amount >= 0 ? "+" : "−"}{rupees(Math.abs(booking.globalAdjustmentApplied.amount))})</Notice></div>}
            <FareBreakupView breakup={booking.fareBreakup} total={fare} />
            {booking.discountDetails && booking.discountDetails.amount > 0 && (
              <div className="mt-3 text-sm rounded-lg bg-green-50 border border-green-200 p-2.5 text-green-900">
                Discount stored separately: {booking.discountDetails.type === "percentage" ? `${booking.discountDetails.value}%` : booking.discountDetails.type === "fixed" ? `flat ${rupees(booking.discountDetails.value)}` : "promo"} = <strong>{rupees(booking.discountDetails.amount)}</strong>{booking.discountDetails.reason ? ` — ${booking.discountDetails.reason}` : ""}{booking.discountDetails.byName ? ` (by ${booking.discountDetails.byName})` : ""}
              </div>
            )}
            {!fb && <div className="mt-3"><Notice tone="warn">This fare was entered without the booking engine.{booking.fareVerified !== true && " Verify it before invoicing or payouts."}</Notice></div>}
            {tolls > 0 && (
              <div className="mt-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Tolls {booking.tollsApproved ? "(approved)" : "(awaiting approval)"}</span><strong>{rupees(tolls)}</strong></div>
                {toll.length > 0 && <ul className="text-xs text-[#555]">{toll.map((t) => <li key={t.id}>{t.name}: {rupees(t.amount)}{t.receiptPhotoUrl ? <> · <a className="text-[#E21B23] font-semibold" href={t.receiptPhotoUrl} target="_blank" rel="noreferrer">receipt</a></> : null}</li>)}</ul>}
                {canFinance && !booking.tollsApproved && <button onClick={approveTolls} className={secondaryBtn}>Approve toll receipts</button>}
              </div>
            )}
            {booking.fareOverride && (
              <div className="mt-3"><Notice tone="warn"><div className="font-semibold">Fare set by {booking.fareOverride.byName || "an admin"}{booking.fareOverride.calculatedFare != null && ` — calculated ${rupees(booking.fareOverride.calculatedFare)}`}</div><div className="text-xs">Reason: {booking.fareOverride.reason}</div></Notice></div>
            )}
            {canFinance && !["Cancelled", "Rejected"].includes(booking.status) && (
              <button onClick={() => setDialog("fare")} className={`${secondaryBtn} w-full mt-3`}>{booking.fareVerified === true ? "Exceptional fare change…" : "Verify / set fare…"}</button>
            )}
          </Card>

          <PaymentsPanel
            booking={booking} rows={payments} error={paymentsError} canRecord={canFinance} canVoid={canFinance}
            onRecord={() => setDialog("pay")} onVoid={setVoiding} onRefund={() => setDialog("refund")}
          />
        </div>
      </div>

      {dialog === "approve" && <ApproveDialog booking={booking} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "reject" && <RejectDialog booking={booking} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "assign" && <AssignDriverModal booking={booking} drivers={drivers} vehicles={vehicles} vendors={vendors} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "cancel" && <CancelBookingModal booking={booking} canCharge={canFinance} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "pay" && <RecordPaymentModal booking={booking} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "refund" && <RefundModal booking={booking} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "verify" && <VerifyCustomerModal booking={booking} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === "fare" && <FareOverrideModal booking={booking} onClose={() => setDialog(null)} onDone={(f) => done(`Fare updated to ${rupees(f)}`)} />}
      {voiding && <VoidPaymentDialog booking={booking} paymentId={voiding.id} amountLabel={`${rupees(voiding.amount)} ${voiding.method}`} onClose={() => setVoiding(null)} onDone={done} />}
    </div>
  );
}
