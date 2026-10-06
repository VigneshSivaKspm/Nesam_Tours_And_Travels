// Phase A — security foundation: staff permissions, admin self-signup,
// marketplace/vehicle read scoping, vehicle re-review and delete guards,
// customer status vocabulary and write-once trip evidence, against the real
// firestore.rules on the emulator.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';

let env;
const as = {};
const role = (permissions) => ({ role: 'admin', status: 'active', staffRole: `r_${permissions.join('_') || 'none'}`, permissions });

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'nesam-rules-access',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8089) },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    const put = (p, d) => setDoc(doc(db, p), d);
    // Staff
    await put('admins/legacy', { role: 'admin', status: 'active', name: 'Owner' }); // pre-roles admin = super admin
    await put('admins/sup', { role: 'admin', status: 'active', staffRole: 'super_admin', permissions: [] });
    for (const [id, perms] of Object.entries({
      ops: ['operations'], fin: ['finance'], rep: ['reports'], pri: ['pricing'], con: ['content'], flt: ['fleet'], ppl: ['people'], sys: ['system'], none: [],
    })) await put(`admins/${id}`, role(perms));
    await put('admins/off', { role: 'admin', status: 'inactive', staffRole: 'super_admin' });
    await put('admins/pend', { role: 'pending', status: 'pending', uid: 'pend' });
    await put('staff_roles/r_operations', { name: 'Dispatcher', permissions: ['operations'] });
    await put('admin_audit/a1', { action: 'role_created', actorId: 'legacy' });
    await put('staff/STAFF-1', { name: 'Old record', email: 'old@nesam.test' });
    // Partners
    for (const id of ['v1', 'v2']) await put(`vendors/${id}`, { uid: id, role: 'vendor', status: 'APPROVED' });
    await put('drivers/drvI', { role: 'driver', status: 'Approved', vendorId: '', rating: 5 });
    await put('drivers/drvI2', { role: 'driver', status: 'Approved', vendorId: '', rating: 5 });
    await put('drivers/fdr', { role: 'driver', status: 'Approved', vendorId: 'v1', rating: 5 });
    await put('driver_private/drvI', { bank: { accountNumber: '12345678' } });
    await put('customers/cApproved', { role: 'customer', status: 'Approved' });
    await put('customers/cLegacy', { role: 'customer', status: 'Active' });
    await put('customers/cBlocked', { role: 'customer', status: 'Blocked' });
    // Fleet
    await put('vehicles/vApproved', { vendorId: 'v1', vehicleNumber: 'TN01AB1234', docStatus: 'Approved', status: 'Active', assignedDriverId: 'fdr', assignedDriverName: 'F', rcDocUrl: 'rc1' });
    await put('vehicles/vPendingFree', { vendorId: 'v1', vehicleNumber: 'TN01AB5678', docStatus: 'Pending', assignedDriverId: '' });
    await put('vehicles/vPendingPaired', { vendorId: 'v1', vehicleNumber: 'TN01AB9999', docStatus: 'Pending', assignedDriverId: 'fdr' });
    await put('vehicles/vOther', { vendorId: 'v2', vehicleNumber: 'TN02CD1111', docStatus: 'Approved', assignedDriverId: '' });
    // Bookings
    await put('bookings/b1', { customerId: 'cApproved', status: 'Pending', payment: 'Pending', fare: 945, fareVerified: true });
    await put('booking_secrets/b1', { customerId: 'cApproved', otp: '4321' });
    await put('bookings/done1', { customerId: 'cLegacy', status: 'Completed', payment: 'Paid', fare: 500 });
    await put('bookings/done2', { customerId: 'cBlocked', status: 'Completed', payment: 'Paid', fare: 500 });
    await put('payments/p1', { customerId: 'cApproved', amount: 945 });
    await put('settings/company', { name: 'NESAM' });
  });
  const ctx = (uid) => env.authenticatedContext(uid).firestore();
  for (const id of ['legacy', 'sup', 'ops', 'fin', 'rep', 'pri', 'con', 'flt', 'ppl', 'sys', 'none', 'off', 'pend', 'v1', 'v2', 'drvI', 'drvI2', 'fdr', 'cApproved', 'cLegacy', 'cBlocked']) as[id] = ctx(id);
  as.newStaff = ctx('newStaff');
});

after(async () => {
  await env?.cleanup();
});

let seq = 0;
async function openTrip(extra = {}) {
  const id = `mk${++seq}`;
  await env.withSecurityRulesDisabled(async (c) => {
    const b = writeBatch(c.firestore());
    b.set(doc(c.firestore(), 'bookings', id), { customerId: 'cApproved', status: 'Approved', payment: 'Pending', fare: 500, fareVerified: true, ...extra });
    b.set(doc(c.firestore(), 'marketplace_trips', id), { id, status: 'Open', offeredPayout: 425 });
    await b.commit();
  });
  return id;
}

// ── Staff accounts ──────────────────────────────────────────────────────────

test('staff: a sign-up can only request access — never grant itself a role', async () => {
  const req = { uid: 'newStaff', name: 'New', email: 'new@nesam.test', role: 'pending', status: 'pending', createdAt: serverTimestamp() };
  await assertFails(setDoc(doc(as.newStaff, 'admins/newStaff'), { ...req, staffRole: 'super_admin' }));
  await assertFails(setDoc(doc(as.newStaff, 'admins/newStaff'), { ...req, permissions: ['finance'] }));
  await assertFails(setDoc(doc(as.newStaff, 'admins/newStaff'), { ...req, role: 'admin', status: 'active' }));
  await assertFails(setDoc(doc(as.newStaff, 'admins/someoneElse'), { ...req, uid: 'someoneElse' }));
  await assertSucceeds(setDoc(doc(as.newStaff, 'admins/newStaff'), req));
  await assertFails(updateDoc(doc(as.newStaff, 'admins/newStaff'), { role: 'admin', status: 'active' }));
});

test('staff: admin documents and roles are server-managed; audit and legacy records are super-admin only', async () => {
  for (const who of ['legacy', 'sup', 'ppl']) {
    await assertFails(updateDoc(doc(as[who], 'admins/ops'), { permissions: ['finance'] }));
    await assertFails(deleteDoc(doc(as[who], 'admins/pend')));
    await assertFails(setDoc(doc(as[who], 'staff_roles/new'), { name: 'X', permissions: ['finance'] }));
    await assertFails(setDoc(doc(as[who], 'staff/STAFF-2'), { name: 'X' }));
  }
  await assertSucceeds(getDoc(doc(as.ops, 'staff_roles/r_operations')));
  await assertFails(getDoc(doc(as.pend, 'staff_roles/r_operations')));
  await assertSucceeds(getDoc(doc(as.legacy, 'admin_audit/a1')));
  await assertSucceeds(getDoc(doc(as.sup, 'staff/STAFF-1')));
  await assertFails(getDoc(doc(as.ops, 'admin_audit/a1')));
  await assertFails(getDoc(doc(as.ops, 'staff/STAFF-1')));
});

test('staff: pending, inactive and permission-less accounts get no privileged access', async () => {
  await assertFails(getDoc(doc(as.pend, 'bookings/b1')));
  await assertFails(getDoc(doc(as.off, 'bookings/b1')));
  await assertFails(updateDoc(doc(as.off, 'bookings/b1'), { status: 'Confirmed' }));
  // An active account with no permissions can view operations but change nothing.
  await assertSucceeds(getDoc(doc(as.none, 'bookings/b1')));
  await assertFails(updateDoc(doc(as.none, 'bookings/b1'), { status: 'Confirmed' }));
  await assertFails(setDoc(doc(as.none, 'coupons/c1'), { code: 'X' }));
  await assertFails(getDoc(doc(as.none, 'payments/p1')));
});

// ── Module permissions ──────────────────────────────────────────────────────

test('permissions: operations runs bookings but never payment, invoice or fare fields', async () => {
  await assertSucceeds(updateDoc(doc(as.ops, 'bookings/b1'), { notes: 'Gate 2', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as.ops, 'bookings/b1'), { payment: 'Paid' }));
  await assertFails(updateDoc(doc(as.ops, 'bookings/b1'), { invoiceId: 'inv1' }));
  await assertFails(updateDoc(doc(as.ops, 'bookings/b1'), { fare: 1 }));
  await assertFails(deleteDoc(doc(as.ops, 'bookings/b1')));
  await assertSucceeds(getDoc(doc(as.ops, 'booking_secrets/b1')));
  await assertFails(getDoc(doc(as.fin, 'booking_secrets/b1')));
  await assertFails(setDoc(doc(as.legacy, 'booking_secrets/x'), { otp: '1111' }));
});

test('permissions: finance changes only payment/invoice fields and owns financial records', async () => {
  // Invoice links are finance's; payment records are written only by recordPayment.
  await assertSucceeds(updateDoc(doc(as.fin, 'bookings/b1'), { invoiceId: 'inv1', invoiceNumber: 'INV-1', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as.fin, 'bookings/b1'), { payment: 'Paid', paidAt: serverTimestamp(), paymentReference: 'UTR1', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as.fin, 'bookings/b1'), { paymentSummary: { totalPaid: 945 } }));
  await assertFails(updateDoc(doc(as.fin, 'bookings/b1'), { status: 'Cancelled' }));
  await assertFails(updateDoc(doc(as.fin, 'bookings/b1'), { fare: 1 }));
  await assertFails(setDoc(doc(as.fin, 'payments/p2'), { amount: 1 })); // payment records are written by the server only
  await assertFails(setDoc(doc(as.ops, 'payments/p3'), { amount: 1 }));
  await assertSucceeds(getDoc(doc(as.rep, 'payments/p1')));
  await assertFails(setDoc(doc(as.rep, 'payments/p4'), { amount: 1 }));
  await assertFails(getDoc(doc(as.ops, 'payments/p1')));
  await assertSucceeds(setDoc(doc(as.fin, 'settings/invoice_sequence'), { next: 2 }));
  await assertFails(setDoc(doc(as.fin, 'settings/company'), { name: 'X' }));
  await assertSucceeds(setDoc(doc(as.sys, 'settings/company'), { name: 'NESAM Tours' }));
  await assertSucceeds(getDoc(doc(as.fin, 'driver_private/drvI')));
  await assertFails(getDoc(doc(as.ops, 'driver_private/drvI')));
});

test('permissions: pricing, content, fleet and people stay in their lanes; renames sync only copied names', async () => {
  await assertSucceeds(setDoc(doc(as.pri, 'vehicle_categories/sedan'), { name: 'Sedan', fare: { perKmRate: 14 } }));
  await assertSucceeds(setDoc(doc(as.pri, 'fare_rules/r1'), { name: 'R', serviceName: 'Airport', baseFare: 100 }));
  await assertSucceeds(setDoc(doc(as.pri, 'coupons/c1'), { code: 'X', serviceNames: ['Airport'] }));
  await assertFails(setDoc(doc(as.pri, 'services/s1'), { name: 'Airport' }));
  await assertSucceeds(setDoc(doc(as.con, 'services/s1'), { name: 'Airport', allowedVehicleCategoryNames: ['Sedan'] }));
  await assertFails(setDoc(doc(as.con, 'vehicle_categories/suv'), { name: 'SUV' }));
  // Category rename (pricing) → copied names in services and vehicles only.
  await assertSucceeds(updateDoc(doc(as.pri, 'services/s1'), { allowedVehicleCategoryNames: ['Sedan AC'], updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as.pri, 'services/s1'), { name: 'Hijacked' }));
  await assertSucceeds(updateDoc(doc(as.pri, 'vehicles/vOther'), { category: 'Sedan AC', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as.pri, 'vehicles/vOther'), { docStatus: 'Rejected' }));
  // Service rename (content) → fare rule / coupon copies only.
  await assertSucceeds(updateDoc(doc(as.con, 'fare_rules/r1'), { serviceName: 'Airport Transfer', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as.con, 'fare_rules/r1'), { baseFare: 1 }));
  await assertSucceeds(updateDoc(doc(as.con, 'coupons/c1'), { serviceNames: ['Airport Transfer'], updatedAt: serverTimestamp() }));
  // Fleet pairs vehicles with drivers but cannot approve drivers.
  await assertSucceeds(updateDoc(doc(as.flt, 'drivers/fdr'), { assignedVehicleId: 'vApproved', assignedVehicleNumber: 'TN01AB1234', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as.flt, 'drivers/fdr'), { status: 'Suspended' }));
  await assertSucceeds(updateDoc(doc(as.ppl, 'drivers/fdr'), { status: 'Approved', docStatus: 'Approved' }));
  await assertFails(updateDoc(doc(as.ppl, 'vehicles/vOther'), { docStatus: 'Rejected' }));
  await assertSucceeds(updateDoc(doc(as.flt, 'vehicles/vOther'), { docStatus: 'Approved', reviewedAt: serverTimestamp() }));
});

// ── Marketplace ─────────────────────────────────────────────────────────────

test('marketplace: partners see open offers and their own trips, never other partners’ trips', async () => {
  const id = await openTrip();
  await assertSucceeds(getDoc(doc(as.v1, 'marketplace_trips', id)));
  await assertSucceeds(getDoc(doc(as.drvI, 'marketplace_trips', id)));
  await assertFails(getDoc(doc(as.fdr, 'marketplace_trips', id)));
  await assertFails(getDoc(doc(as.cApproved, 'marketplace_trips', id)));
  // Unfiltered feeds are refused; the status-filtered feed is allowed.
  await assertFails(getDocs(collection(as.v1, 'marketplace_trips')));
  await assertSucceeds(getDocs(query(collection(as.v1, 'marketplace_trips'), where('status', 'in', ['Open', 'Bidding']))));
  await assertSucceeds(getDocs(query(collection(as.drvI, 'marketplace_trips'), where('status', '==', 'Open'))));
  await assertFails(getDocs(query(collection(as.fdr, 'marketplace_trips'), where('status', '==', 'Open'))));

  await assertSucceeds(runTransaction(as.v1, async (tx) => {
    await tx.get(doc(as.v1, 'marketplace_trips', id));
    tx.update(doc(as.v1, 'bookings', id), { status: 'Confirmed', assignedVendorId: 'v1', assignedVendorName: 'v1', vendorPayout: 425, confirmedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    tx.update(doc(as.v1, 'marketplace_trips', id), { status: 'Assigned', assignedVendorId: 'v1', assignedVendorName: 'v1', updatedAt: serverTimestamp() });
  }));
  await assertSucceeds(getDoc(doc(as.v1, 'marketplace_trips', id)));
  await assertFails(getDoc(doc(as.v2, 'marketplace_trips', id)));
  await assertFails(getDoc(doc(as.drvI, 'marketplace_trips', id)));
});

test('marketplace: fleet drivers cannot claim trips around their vendor; independent drivers can', async () => {
  const claim = (db, uid, id) => {
    const b = writeBatch(db);
    b.update(doc(db, 'bookings', id), { status: 'Assigned', tripStage: 'Assigned', assignedDriverId: uid, assignedDriverName: uid, driver: uid, driverPhone: '', assignedVehicleNumber: 'X', driverPayout: 425, assignedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    b.update(doc(db, 'marketplace_trips', id), { status: 'Assigned', assignedDriverId: uid, assignedDriverName: uid, updatedAt: serverTimestamp() });
    return b.commit();
  };
  const id = await openTrip();
  await assertFails(claim(as.fdr, 'fdr', id));
  await assertSucceeds(claim(as.drvI, 'drvI', id));
  await assertSucceeds(getDoc(doc(as.drvI, 'marketplace_trips', id)));
  await assertFails(getDoc(doc(as.drvI2, 'marketplace_trips', id)));
});

// ── Vehicles ────────────────────────────────────────────────────────────────

test('vehicles: readable by staff, the owning vendor and the paired driver only', async () => {
  await assertSucceeds(getDoc(doc(as.ops, 'vehicles/vApproved')));
  await assertSucceeds(getDoc(doc(as.v1, 'vehicles/vApproved')));
  await assertSucceeds(getDoc(doc(as.fdr, 'vehicles/vApproved')));
  await assertFails(getDoc(doc(as.v2, 'vehicles/vApproved')));
  await assertFails(getDoc(doc(as.drvI, 'vehicles/vApproved')));
  await assertFails(getDoc(doc(as.cApproved, 'vehicles/vApproved')));
  await assertFails(getDocs(collection(as.cApproved, 'vehicles')));
  await assertSucceeds(getDocs(query(collection(as.v1, 'vehicles'), where('vendorId', '==', 'v1'))));
});

test('vehicles: changing an approved vehicle’s details sends it back to review', async () => {
  await assertFails(updateDoc(doc(as.v1, 'vehicles/vApproved'), { rcDocUrl: 'rc-replaced', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as.v1, 'vehicles/vApproved'), { vehicleNumber: 'TN01ZZ0001', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as.v1, 'vehicles/vApproved'), { reviewedAt: serverTimestamp(), docStatus: 'Pending' }));
  await assertSucceeds(updateDoc(doc(as.v1, 'vehicles/vApproved'), { status: 'Maintenance', updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(as.v1, 'vehicles/vApproved'), { rcDocUrl: 'rc-renewed', docStatus: 'Pending', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as.v1, 'vehicles/vApproved'), { docStatus: 'Approved' }));
  await assertFails(setDoc(doc(as.v1, 'vehicles/vNew'), { vendorId: 'v1', vehicleNumber: 'TN05AA0001', docStatus: 'Pending', reviewedAt: serverTimestamp() }));
});

test('vehicles: vendors cannot delete approved or driver-paired vehicles', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'vehicles/vApproved2'), { vendorId: 'v1', docStatus: 'Approved', assignedDriverId: '' }));
  await assertFails(deleteDoc(doc(as.v1, 'vehicles/vApproved2')));
  await assertFails(deleteDoc(doc(as.v1, 'vehicles/vPendingPaired')));
  await assertFails(deleteDoc(doc(as.v2, 'vehicles/vPendingFree')));
  await assertSucceeds(deleteDoc(doc(as.v1, 'vehicles/vPendingFree')));
  await assertFails(deleteDoc(doc(as.pri, 'vehicles/vApproved2')));
  await assertSucceeds(deleteDoc(doc(as.flt, 'vehicles/vApproved2')));
});

// ── Customers ───────────────────────────────────────────────────────────────

test('customers: Approved and legacy Active accounts are active; Blocked accounts are not', async () => {
  const review = (id, customerId) => ({ bookingId: id, customerId, status: 'Pending', overallRating: 5 });
  await assertSucceeds(setDoc(doc(as.cLegacy, 'reviews/done1'), review('done1', 'cLegacy')));
  await assertFails(setDoc(doc(as.cBlocked, 'reviews/done2'), review('done2', 'cBlocked')));
  await assertSucceeds(updateDoc(doc(as.ppl, 'customers/cBlocked'), { status: 'Approved' }));
  await assertSucceeds(setDoc(doc(as.cBlocked, 'reviews/done2'), review('done2', 'cBlocked')));
  await assertFails(updateDoc(doc(as.ops, 'customers/cLegacy'), { status: 'Blocked' }));
});

// ── Trip evidence ───────────────────────────────────────────────────────────

test('evidence: pre-trip record, photos and odometer are written only by the verification functions', async () => {
  const id = `ev${++seq}`;
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'bookings', id), { customerId: 'cApproved', status: 'Assigned', assignedDriverId: 'drvI', fare: 500, preTrip: { odometerReading: 100 }, startOdometer: 100 }));
  const ref = doc(as.drvI, 'bookings', id);
  await assertFails(updateDoc(ref, { preTrip: { odometerReading: 100 }, startOdometer: 100, tripStage: 'En Route Pickup', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { preTrip: { odometerReading: 1 }, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { startOdometer: 50, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { vehicleFrontPhoto: 'x', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { tripStage: 'Reached Pickup', reachedPickupAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  // Position and tolls stay with the driver.
  await assertSucceeds(updateDoc(ref, { driverLocation: { lat: 10, lng: 77, heading: null }, updatedAt: serverTimestamp() }));
});

test('notifications: any staff member marks the shared admin inbox read; only engagement edits or deletes', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'notifications/inbox1'), { recipientId: 'admin', recipientType: 'admin', title: 'New vendor', read: false });
    await setDoc(doc(c.firestore(), 'notifications/cust1'), { recipientId: 'cApproved', title: 'Trip update', read: false });
  });
  await assertSucceeds(updateDoc(doc(as.ops, 'notifications/inbox1'), { read: true, readAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as.ops, 'notifications/inbox1'), { title: 'Changed' }));
  await assertFails(updateDoc(doc(as.ops, 'notifications/cust1'), { read: true }));
  await assertFails(deleteDoc(doc(as.ops, 'notifications/inbox1')));
  await assertSucceeds(setDoc(doc(as.ppl, 'notifications/approval1'), { recipientId: 'drvI', title: 'Approved', read: false }));
});

test('bookings: nobody — not even a super admin — creates or prices a booking from a client', async () => {
  await assertFails(setDoc(doc(as.legacy, 'bookings/typed'), { status: 'Pending', fare: 1 }));
  await assertFails(updateDoc(doc(as.legacy, 'bookings/b1'), { fareBreakdown: { total: 1 } }));
  await assertSucceeds(deleteDoc(doc(as.sup, 'bookings/done2')));
  assert.ok(true);
});

// ── Phase B: one source of truth for money ──────────────────────────────────

test('money: price, commission, payouts and the finance snapshot are server-only for every staff role', async () => {
  const id = await openTrip({ commission: { rate: 15, base: 'taxable', source: 'global' } });
  const serverOnly = [
    { fare: 1 }, { fareBreakdown: { total: 1 } }, { fareOverride: null }, { fareVerified: false }, { commission: { rate: 0 } },
    { finance: { partnerPayout: 1 } }, { vendorPayout: 1 }, { driverPayout: 1 }, { payoutSource: 'manual' },
  ];
  for (const who of ['ops', 'fin', 'legacy', 'sup']) {
    for (const change of serverOnly) await assertFails(updateDoc(doc(as[who], 'bookings', id), { ...change, updatedAt: serverTimestamp() }));
  }
  // Who earns from a trip is decided with its payout (marketplace functions or the partner's own claim).
  for (const change of [{ assignedDriverId: 'drvI' }, { assignedVendorId: 'v1' }, { assignedVehicleId: 'vApproved' }, { assignedVehicleNumber: 'TN01AB1234' }, { driver: 'X' }, { driverPhone: '1' }]) {
    await assertFails(updateDoc(doc(as.ops, 'bookings', id), { ...change, updatedAt: serverTimestamp() }));
  }
  // Status changes belong to the booking functions (approve, reject, cancel, assign), never a direct write.
  await assertFails(updateDoc(doc(as.ops, 'bookings', id), { status: 'Cancelled', cancelledAt: serverTimestamp(), cancelledBy: 'admin', updatedAt: serverTimestamp() }));
  // The platform offer is priced by the server; operations can still withdraw it.
  await assertFails(updateDoc(doc(as.ops, 'marketplace_trips', id), { offeredPayout: 9999 }));
  await assertSucceeds(updateDoc(doc(as.ops, 'marketplace_trips', id), { status: 'Closed' }));
  await assertFails(setDoc(doc(as.ops, 'marketplace_trips/forged'), { status: 'Open', offeredPayout: 9999 }));
});

test('money: a completed trip is financially final — operations may only correct contact details', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'bookings/final1'), {
    customerId: 'cApproved', status: 'Completed', payment: 'Pending', fare: 945, customer: 'A', phone: '1', pickup: 'P', drop: 'D',
  }));
  await assertSucceeds(updateDoc(doc(as.ops, 'bookings/final1'), { phone: '+91 98765 43210', notes: 'Corrected', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as.ops, 'bookings/final1'), { status: 'Cancelled' }));
  await assertFails(updateDoc(doc(as.ops, 'bookings/final1'), { pickup: 'Elsewhere' }));
  await assertFails(updateDoc(doc(as.ops, 'bookings/final1'), { tollCharges: 5000 }));
  // Finance links the invoice; the payment itself is recorded by the recordPayment function.
  await assertSucceeds(updateDoc(doc(as.fin, 'bookings/final1'), { invoiceId: 'inv9', invoiceNumber: 'INV-9', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as.fin, 'bookings/final1'), { payment: 'Paid', paidAt: serverTimestamp(), updatedAt: serverTimestamp() }));
});

test('money: payout requests keep their amount and partner; only finance records the outcome', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'payout_requests/pr1'), { driverId: 'drvI', amount: 500, status: 'Pending' }));
  await assertFails(updateDoc(doc(as.fin, 'payout_requests/pr1'), { amount: 5000 }));
  await assertFails(updateDoc(doc(as.fin, 'payout_requests/pr1'), { driverId: 'drvI2' }));
  await assertFails(updateDoc(doc(as.ops, 'payout_requests/pr1'), { status: 'Paid', utr: 'UTR1' }));
  await assertFails(updateDoc(doc(as.drvI, 'payout_requests/pr1'), { status: 'Paid' }));
  await assertSucceeds(updateDoc(doc(as.fin, 'payout_requests/pr1'), { status: 'Paid', utr: 'UTR12345', processedAt: '2026-09-30T10:00:00Z', updatedAt: serverTimestamp() }));
});

test('money: commission policy, ledger and wallets are readable by the right staff and written only by the server', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'business_config/commission'), { base: 'taxable', global: { rate: 15 }, version: 1 });
    await setDoc(doc(c.firestore(), 'wallet_ledger/trip_mk1'), { schema: 2, walletId: 'driver_drvI', driverId: 'drvI', netAmount: 425 });
    await setDoc(doc(c.firestore(), 'wallets/driver_drvI'), { driverId: 'drvI', available: 425 });
  });
  for (const who of ['ops', 'rep', 'fin', 'none']) await assertSucceeds(getDoc(doc(as[who], 'business_config/commission')));
  for (const who of ['pend', 'off', 'drvI', 'v1', 'cApproved']) await assertFails(getDoc(doc(as[who], 'business_config/commission')));
  for (const who of ['fin', 'legacy', 'sup']) {
    await assertFails(setDoc(doc(as[who], 'business_config/commission'), { base: 'total', global: { rate: 0 }, version: 2 }));
    await assertFails(setDoc(doc(as[who], 'wallet_ledger/forged'), { schema: 2, walletId: 'driver_drvI', netAmount: 1 }));
    await assertFails(updateDoc(doc(as[who], 'wallets/driver_drvI'), { available: 99999 }));
  }
  for (const who of ['fin', 'rep']) {
    await assertSucceeds(getDoc(doc(as[who], 'wallet_ledger/trip_mk1')));
    await assertSucceeds(getDoc(doc(as[who], 'wallets/driver_drvI')));
  }
  await assertFails(getDoc(doc(as.ops, 'wallets/driver_drvI')));
  await assertFails(getDoc(doc(as.ops, 'wallet_ledger/trip_mk1')));
});
