// The booking workflow end to end, through the real compiled functions and the
// Firestore emulator: create → fare/discount/adjustment → approve → assign /
// reassign / remove → payments (partial, multi-collector) → cancellation and
// refunds → penalties → unassigned alerts → legal acceptance.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { PROJECT, call, installFakeNetwork, resetSent, restoreNetwork, sent, failing } from './harness.mjs';

const { db } = await import('../../functions/lib/admin.js');
const { createBooking } = await import('../../functions/lib/commerce.js');
const { createAdminBooking, overrideBookingFare } = await import('../../functions/lib/adminBookings.js');
const ops = await import('../../functions/lib/bookingOps.js');
const { recordPayment, voidPayment, derivedPaymentFields } = await import('../../functions/lib/bookingPayments.js');
const { saveFareAdjustment } = await import('../../functions/lib/fareConfig.js');
const penalties = await import('../../functions/lib/penalties.js');
const { runUnassignedAlerts } = await import('../../functions/lib/scheduler.js');
const legal = await import('../../functions/lib/legal.js');
const { recomputeWallet } = await import('../../functions/lib/ledger.js');

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8089) } });
  await env.clearFirestore();
  installFakeNetwork();
  const set = (p, d) => db.doc(p).set(d);
  await set('admins/ops', { role: 'admin', status: 'active', name: 'Ops Desk' }); // super admin (no staffRole)
  await set('admins/opsOnly', { role: 'admin', status: 'active', name: 'Dispatcher', staffRole: 'dispatch', permissions: ['operations'] });
  await set('admins/finOnly', { role: 'admin', status: 'active', name: 'Accountant', staffRole: 'acct', permissions: ['finance'] });
  await set('admins/compOnly', { role: 'admin', status: 'active', name: 'Compliance', staffRole: 'comp', permissions: ['compliance'] });
  await set('business_config/commission', { base: 'taxable', global: { rate: 15 }, services: {}, categories: {}, version: 1 });
  const fare = { baseKm: 500, perKmRate: 15, minimumFare: 0, nightAllowance: 0, driverAllowance: 0, waitingChargePerHour: 0, tollIncluded: false, parkingIncluded: false, permitCharge: 0, carrierCharge: 250 };
  await set('vehicle_categories/pkg10k', { name: 'Sedan', code: 'SEDAN', status: 'Active', seatingCapacity: 4, fare: { ...fare, baseFare: 10000 } });
  await set('vehicle_categories/pay10k', { name: 'Mini', code: 'MINI', status: 'Active', seatingCapacity: 4, fare: { ...fare, baseFare: 9524 } });
  await set('customers/cust', { status: 'Approved', name: 'Priya', phone: '+919800000011', email: 'priya@example.com' });
  await set('drivers/drvA', { role: 'driver', status: 'Approved', vendorId: '', name: 'Driver A', phone: '+919811111111', presenceStatus: 'Online', vehicleType: 'Sedan' });
  await set('drivers/drvB', { role: 'driver', status: 'Approved', vendorId: '', name: 'Driver B', phone: '+919822222222', presenceStatus: 'Online', vehicleType: 'Sedan' });
  await set('drivers/drvOff', { role: 'driver', status: 'Approved', vendorId: '', name: 'Offline', presenceStatus: 'Offline', vehicleType: 'Hatchback' });
  await set('drivers/drvPend', { role: 'driver', status: 'Pending', vendorId: '', name: 'Pending' });
  await set('drivers/fd1', { role: 'driver', status: 'Approved', vendorId: 'v1', name: 'Fleet One', phone: '+919833333333', presenceStatus: 'Online' });
  await set('vendors/v1', { role: 'vendor', status: 'APPROVED', companyName: 'Fleet Co', phone: '+919844444444' });
  await set('vehicles/veh1', { vendorId: 'v1', vehicleNumber: 'TN01AB1234', docStatus: 'Approved', status: 'Active', assignedDriverId: 'fd1' });
});
after(async () => { restoreNetwork(); await db.terminate(); await env?.cleanup(); });

const pin = (lat, lng, address, name) => ({ lat, lng, address, name });
const adminReq = (requestId, extra = {}) => ({
  requestId, customerName: 'Walk-in Caller', customerPhone: '98765 43210', categoryId: 'pkg10k', tripType: 'One Way', paymentMethod: 'Cash',
  pickupPoint: pin(10.01, 77.47, 'Theni Bus Stand, Theni', 'Theni Bus Stand'), dropPoint: pin(10.1, 77.5, 'Bodinayakanur, Theni', 'Bodinayakanur'),
  customerWhatsapp: { sameAsMobile: true }, ...extra,
});
const quote = async (extra = {}) => (await call(createAdminBooking, 'ops', { ...adminReq('quote_req_0001', extra), quoteOnly: true }));
const create = async (id, extra = {}, who = 'ops') => {
  const q = await call(createAdminBooking, who, { ...adminReq(id, extra), quoteOnly: true });
  return call(createAdminBooking, who, { ...adminReq(id, extra), expectedFare: q.quote.total });
};
const booking = async (id) => (await db.doc(`bookings/${id}`).get()).data();
const approve = (id) => call(ops.approveBooking, 'ops', { bookingId: id });

test('fare: the base fare is calculated, never typed; discount is percentage or fixed, one at a time', async () => {
  const none = await quote();
  assert.equal(none.quote.baseFare, 10000);
  assert.equal(none.quote.subtotal, 10000);
  assert.equal(none.quote.total, 10500); // GST 5% on top, as for every booking
  const pct = await quote({ discount: { type: 'percentage', value: 10 } });
  assert.equal(pct.quote.taxableAmount, 9000);
  assert.equal(pct.quote.discount, 1000);
  assert.equal(pct.quote.discountDetail.type, 'percentage');
  const fixed = await quote({ discount: { type: 'fixed', value: 500 } });
  assert.equal(fixed.quote.taxableAmount, 9500);
  // The discount is stored apart from the base fare, which is untouched.
  assert.equal(pct.quote.baseFare, 10000);
  // Invalid discounts are refused, and a discount never makes the payable amount negative.
  await assert.rejects(quote({ discount: { type: 'percentage', value: 150 } }), /cannot exceed 100%/);
  await assert.rejects(quote({ discount: { type: 'fixed', value: 0 } }), /greater than zero/);
  await assert.rejects(quote({ discount: { type: 'bogus', value: 5 } }), /percentage or a fixed/);
  const huge = await quote({ discount: { type: 'fixed', value: 900000 } });
  assert.equal(huge.quote.total, 0);
  // The breakup states what is included and what is payable separately.
  const by = Object.fromEntries(none.breakup.lines.map((l) => [l.key, l]));
  assert.equal(by.base.treatment, 'included');
  assert.equal(by.toll.treatment, 'extra');
  assert.equal(by.carrier.amount, 250);
  assert.equal(by.carrier.treatment, 'extra');
  assert.equal(none.breakup.packageTotal, none.quote.total);
});

test('fare: changing the vehicle category recalculates the quote on the server', async () => {
  const sedan = await quote({ categoryId: 'pkg10k' });
  const mini = await quote({ categoryId: 'pay10k' });
  assert.equal(sedan.quote.total, 10500);
  assert.equal(mini.quote.total, 10000);
  assert.equal(mini.categoryName, 'Mini');
});

test('global adjustment: +10% → ₹11,000, −10% → ₹9,000, applied once and never compounded; windows respected', async () => {
  await assert.rejects(call(saveFareAdjustment, 'opsOnly', { enabled: true, name: 'Festival', direction: 'increase', percent: 10, reason: 'Diwali' }), /does not include pricing/);
  await call(saveFareAdjustment, 'ops', { enabled: true, name: 'Festival pricing', direction: 'increase', percent: 10, reason: 'Diwali season', startDate: '', endDate: '' });
  const up = await quote();
  assert.equal(up.quote.subtotalBeforeAdjustment, 10000);
  assert.equal(up.quote.subtotal, 11000);
  assert.equal(up.quote.globalAdjustment.amount, 1000);
  // Saving the same setting again does not stack on the previous one.
  const v1 = (await db.doc('business_config/fare_adjustment').get()).data().version;
  await call(saveFareAdjustment, 'ops', { enabled: true, name: 'Festival pricing', direction: 'increase', percent: 10, reason: 'Diwali season', expectedVersion: v1 });
  assert.equal((await quote()).quote.subtotal, 11000);
  // A public copy (no internal reason) is what the customer apps read.
  const pub = (await db.doc('public_config/fare_adjustment').get()).data();
  assert.equal(pub.percent, 10);
  assert.equal(pub.reason, undefined);
  // Decrease, then a stale edit is refused.
  await call(saveFareAdjustment, 'ops', { enabled: true, name: 'Promo', direction: 'decrease', percent: 10, reason: 'Promotion', expectedVersion: v1 + 1 });
  assert.equal((await quote()).quote.subtotal, 9000);
  await assert.rejects(call(saveFareAdjustment, 'ops', { enabled: true, name: 'Other', direction: 'increase', percent: 5, reason: 'Stale edit', expectedVersion: 1 }), /changed by someone else/);
  // An adjustment outside its dates does not apply.
  const past = '2020-01-01';
  await call(saveFareAdjustment, 'ops', { enabled: true, name: 'Old', direction: 'increase', percent: 50, reason: 'Past sale', startDate: past, endDate: '2020-01-31', expectedVersion: v1 + 2 });
  assert.equal((await quote()).quote.subtotal, 10000);
  // Validation.
  await assert.rejects(call(saveFareAdjustment, 'ops', { enabled: true, name: 'X', direction: 'increase', percent: 150, reason: 'too much' }), /0 to 100/);
  await assert.rejects(call(saveFareAdjustment, 'ops', { enabled: true, name: 'X', direction: 'decrease', percent: 100, reason: 'free rides' }), /below 100%/);
  const v = (await db.doc('business_config/fare_adjustment').get()).data().version;
  await call(saveFareAdjustment, 'ops', { enabled: false, name: '', direction: 'increase', percent: 0, reason: '', expectedVersion: v });
  assert.equal((await quote()).quote.subtotal, 10000);
});

test('admin booking: map pins, WhatsApp, optional email, discount and advance are stored; Pending and hidden from partners', async () => {
  const q = await call(createAdminBooking, 'ops', { ...adminReq('flow_book_0001', { customerEmail: 'caller@example.com', discount: { type: 'percentage', value: 10, reason: 'Regular customer' }, pickupAddress: 'Door 4' }), quoteOnly: true });
  const res = await call(createAdminBooking, 'ops', {
    ...adminReq('flow_book_0001', { customerEmail: 'caller@example.com', discount: { type: 'percentage', value: 10, reason: 'Regular customer' }, pickupAddress: 'Door 4' }),
    expectedFare: q.quote.total, advance: { amount: 2000, method: 'UPI', reference: 'UPI-REF-123' },
  });
  assert.equal(res.fare, 9450); // 9,000 taxable + 5% GST
  const b = await booking('flow_book_0001');
  assert.equal(b.status, 'Pending');
  assert.equal(b.tripSubStatus, 'Not Started');
  assert.equal(b.pickupAddress, 'Door 4, Theni Bus Stand, Theni');
  assert.equal(b.pickupLat, 10.01);
  assert.equal(b.pickupLatitude, 10.01);
  assert.equal(b.pickupLng, 77.47);
  assert.equal(b.pickupLongitude, 77.47);
  assert.equal(b.pickupSource, 'map_pin');
  assert.equal(b.phone, '+919876543210');
  assert.deepEqual(b.customerWhatsapp, { countryCode: '+91', number: '9876543210', e164: '+919876543210', sameAsMobile: true });
  assert.equal(b.customerEmail, 'caller@example.com');
  assert.equal(b.discountDetails.type, 'percentage');
  assert.equal(b.discountDetails.amount, 1000);
  assert.equal(b.discountDetails.reason, 'Regular customer');
  assert.equal(b.fareBreakdown.baseFare, 10000);
  assert.ok(b.fareBreakup.lines.length > 5);
  assert.ok(b.pickupAt);
  // Advance recorded as its own transaction, collected by the admin.
  const txns = await db.collection('bookings/flow_book_0001/payment_transactions').get();
  assert.equal(txns.size, 1);
  assert.equal(txns.docs[0].data().kind, 'advance');
  assert.equal(txns.docs[0].data().collectorType, 'admin');
  assert.equal(b.paymentSummary.totalPaid, 2000);
  assert.equal(b.paymentSummary.balanceDue, 7450);
  assert.equal(b.paymentStatus, 'Partially Paid');
  // The marketplace record is hidden until approval and shows no exact address.
  const m = (await db.doc('marketplace_trips/flow_book_0001').get()).data();
  assert.equal(m.status, 'Awaiting Approval');
  assert.equal(m.pickup.address, 'Theni Bus Stand');
  assert.equal(m.pickup.lat, 10.01);
  assert.equal(JSON.stringify(m).includes('Door 4'), false);
  assert.equal(JSON.stringify(m).includes('9876543210'), false);
  assert.deepEqual(m.eligibleVehicleTypes.includes('sedan'), true);
  // Audit and an admin notification (new-booking tone) were written.
  const audit = await db.collection('audit_logs').where('bookingId', '==', 'flow_book_0001').get();
  assert.ok(audit.docs.some((d) => d.data().action === 'booking_created'));
  assert.ok(audit.docs.some((d) => d.data().action === 'discount_applied'));
  const notes = await db.collection('notifications').where('bookingId', '==', 'flow_book_0001').get();
  assert.ok(notes.docs.some((d) => d.data().sound === 'new_booking' && d.data().category === 'bookings' && d.data().recipientId === 'admin'));
  // Replay is idempotent.
  const again = await call(createAdminBooking, 'ops', { ...adminReq('flow_book_0001'), expectedFare: q.quote.total });
  assert.equal(again.bookingId, b.bookingId);
});

test('admin booking: validation of phone, WhatsApp, email, pins, discount and advance', async () => {
  const bad = (extra, re) => assert.rejects(call(createAdminBooking, 'ops', { ...adminReq('bad_book_0001', extra), quoteOnly: true }), re);
  await bad({ customerPhone: '12345' }, /10-digit/);
  await bad({ customerEmail: 'not-an-email' }, /valid email/);
  await bad({ customerWhatsapp: { sameAsMobile: false, countryCode: '+91', number: '12345' } }, /valid 10-digit WhatsApp/);
  await bad({ customerWhatsapp: { sameAsMobile: false, countryCode: '91', number: '9876543210' } }, /country code/);
  await bad({ pickupPoint: pin(40, 10, 'Somewhere abroad', 'X') }, /point in India/);
  await bad({ pickupPoint: pin(10.01, 77.47, '', 'X') }, /address/);
  await bad({ dropPoint: pin(10.01, 77.47, 'Same place', 'Same') }, /different/);
  await bad({ paymentMethod: 'Cheque' }, /how the customer will pay/);
  await bad({ categoryId: 'nope' }, /not bookable/);
  await assert.rejects(call(createAdminBooking, 'ops', { ...adminReq('bad_book_0002'), expectedFare: 10500, advance: { amount: 100, method: 'UPI', reference: 'x' } }), /reference/);
  await assert.rejects(call(createAdminBooking, 'ops', { ...adminReq('bad_book_0003'), expectedFare: 10500, advance: { amount: 999999, method: 'Cash' } }), /more than the fare|advance/);
  // A WhatsApp number in another country is accepted.
  const intl = await quote({ customerWhatsapp: { sameAsMobile: false, countryCode: '+971', number: '501234567' } });
  assert.equal(intl.quote.total, 10500);
  // The email is optional: nothing stored when blank.
  const noEmail = await create('flow_book_noem');
  assert.equal((await booking('flow_book_noem')).customerEmail, '');
  assert.equal(noEmail.fare, 10500);
});

test('permissions: discounts and overrides need pricing/finance; staff without operations cannot create bookings', async () => {
  await assert.rejects(call(createAdminBooking, 'opsOnly', { ...adminReq('perm_book_0001', { discount: { type: 'fixed', value: 100 } }), quoteOnly: true }), /pricing or finance/);
  await assert.rejects(call(createAdminBooking, 'finOnly', { ...adminReq('perm_book_0002'), quoteOnly: true }), /does not include operations/);
  await assert.rejects(call(createAdminBooking, null, adminReq('perm_book_0003')), /Sign in/);
  await assert.rejects(call(createAdminBooking, 'cust', adminReq('perm_book_0004')), /Only active admins/);
  // A fare override is a finance action with a reason.
  const q = await quote();
  await assert.rejects(call(createAdminBooking, 'opsOnly', { ...adminReq('perm_book_0005'), expectedFare: q.quote.total, override: { fare: 9000, reason: 'Corporate rate agreed' } }), /finance access/);
  await assert.rejects(call(createAdminBooking, 'ops', { ...adminReq('perm_book_0006'), expectedFare: q.quote.total, override: { fare: 9000, reason: 'short' } }), /reason of at least 10/);
  const o = await call(createAdminBooking, 'ops', { ...adminReq('perm_book_0007'), expectedFare: q.quote.total, override: { fare: 9000, reason: 'Corporate rate agreed with client' } });
  assert.equal(o.fare, 9000);
  const b = await booking('perm_book_0007');
  assert.equal(b.fareOverride.calculatedFare, 10500);
  assert.equal(b.fareOverride.byUid, 'ops');
  assert.ok((await db.collection('audit_logs').where('bookingId', '==', 'perm_book_0007').get()).docs.some((d) => d.data().action === 'fare_override'));
});

test('approval: Pending → Approved opens it to partners; invalid transitions are refused; rejection closes it', async () => {
  const id = 'flow_book_0001';
  // Cannot assign before approval.
  await assert.rejects(call(ops.assignDriver, 'ops', { bookingId: id, driverId: 'drvA', reason: '' }), /Approve the booking/);
  await assert.rejects(call(ops.approveBooking, 'finOnly', { bookingId: id }), /does not include operations/);
  const r = await approve(id);
  assert.equal(r.ok, true);
  assert.ok(r.partnersNotified >= 2, 'eligible online drivers and approved vendors are notified');
  const b = await booking(id);
  assert.equal(b.status, 'Approved');
  assert.equal(b.approvedBy, 'ops');
  assert.equal((await db.doc(`marketplace_trips/${id}`).get()).data().status, 'Open');
  // Eligible partners got a new-trip tone; the Hatchback/offline/pending drivers did not.
  const forA = await db.collection('notifications').where('recipientId', '==', 'drvA').get();
  assert.ok(forA.docs.some((d) => d.data().sound === 'new_booking' && d.data().bookingId === id));
  assert.equal((await db.collection('notifications').where('recipientId', '==', 'drvOff').get()).size, 0);
  assert.equal((await db.collection('notifications').where('recipientId', '==', 'fd1').get()).size, 0);
  assert.ok((await db.collection('notifications').where('recipientId', '==', 'v1').get()).size >= 1);
  // The customer's confirmation went out on every channel that is configured.
  assert.ok(sent.whatsapp.length >= 1 && sent.sms.length >= 1);
  assert.ok(JSON.stringify(sent.whatsapp[0]).includes('Booking') || JSON.stringify(sent.whatsapp[0]).includes('booking') || JSON.stringify(sent.whatsapp[0]).includes('NT'));
  assert.ok(sent.email.length >= 1, 'email sent because an address was given');
  // Approving twice, or approving a rejected booking, is an invalid transition.
  await assert.rejects(approve(id), /already Approved/);
  await create('flow_book_rej1');
  await assert.rejects(call(ops.rejectBooking, 'ops', { bookingId: 'flow_book_rej1', reason: 'no' }), /reason/);
  await call(ops.rejectBooking, 'ops', { bookingId: 'flow_book_rej1', reason: 'Outside our service area' });
  assert.equal((await booking('flow_book_rej1')).status, 'Rejected');
  assert.equal((await db.doc('marketplace_trips/flow_book_rej1').get()).data().status, 'Closed');
  await assert.rejects(approve('flow_book_rej1'), /rejected booking cannot/);
  // Approve needs a verified fare and a marketplace record.
  await db.doc('bookings/legacy_nofare').set({ status: 'Pending', bookingId: 'LEG-1', fare: '₹1,500', customer: 'Old' });
  await assert.rejects(approve('legacy_nofare'), /Verify the fare/);
});

test('assignment: assign → reassign → remove, each recorded; availability conflicts are caught', async () => {
  const id = 'flow_book_0001';
  await assert.rejects(call(ops.assignDriver, 'ops', { bookingId: id, driverId: 'drvPend', reason: '' }), /approved driver/);
  const first = await call(ops.assignDriver, 'ops', { bookingId: id, driverId: 'drvA', reason: '' });
  assert.equal(first.action, 'assign');
  let b = await booking(id);
  assert.equal(b.status, 'Assigned');
  assert.equal(b.assignedDriverId, 'drvA');
  assert.equal(b.tripSubStatus, 'Not Started');
  assert.equal(typeof b.driverPayout, 'number');
  assert.equal((await db.doc(`marketplace_trips/${id}`).get()).data().status, 'Assigned');
  // Reassigning needs a reason and a different driver.
  await assert.rejects(call(ops.assignDriver, 'ops', { bookingId: id, driverId: 'drvB', reason: '' }), /reason/);
  await assert.rejects(call(ops.assignDriver, 'ops', { bookingId: id, driverId: 'drvA', reason: 'same driver again' }), /already assigned/);
  const re = await call(ops.assignDriver, 'ops', { bookingId: id, driverId: 'drvB', reason: 'Driver A unavailable' });
  assert.equal(re.action, 'reassign');
  b = await booking(id);
  assert.equal(b.assignedDriverId, 'drvB');
  // A fleet driver moves the trip onto the vendor (payout switches owner).
  await call(ops.assignDriver, 'ops', { bookingId: id, driverId: 'fd1', reason: 'Fleet capacity', vehicleId: 'veh1' });
  b = await booking(id);
  assert.equal(b.assignedVendorId, 'v1');
  assert.equal(typeof b.vendorPayout, 'number');
  assert.equal(b.driverPayout, undefined);
  assert.equal(b.assignedVehicleNumber, 'TN01AB1234');
  await call(ops.assignDriver, 'ops', { bookingId: id, driverId: 'drvB', reason: 'Back to independent' });
  b = await booking(id);
  assert.equal(b.vendorPayout, undefined);
  assert.equal(typeof b.driverPayout, 'number');
  // The history keeps every change: old driver, new driver, who, when, why — never overwritten.
  const hist = (await db.collection(`bookings/${id}/assignments`).get()).docs.map((d) => d.data());
  assert.equal(hist.length, 4);
  const reassign = hist.find((h) => h.action === 'reassign' && h.newDriver.id === 'drvB' && h.oldDriver.id === 'drvA');
  assert.ok(reassign);
  assert.equal(reassign.changedBy, 'ops');
  assert.equal(reassign.reason, 'Driver A unavailable');
  assert.ok(reassign.at);
  // Notifications: old driver told it was removed; new driver told it was assigned.
  const old = await db.collection('notifications').where('recipientId', '==', 'drvA').get();
  assert.ok(old.docs.some((d) => d.data().title === 'Trip reassigned'));
  // Remove: back to Approved and open to partners again.
  const rm = await call(ops.assignDriver, 'ops', { bookingId: id, reason: 'Customer asked to wait' });
  assert.equal(rm.action, 'remove');
  b = await booking(id);
  assert.equal(b.status, 'Approved');
  assert.equal(b.assignedDriverId, '');
  assert.equal(b.driverPayout, undefined);
  assert.equal((await db.doc(`marketplace_trips/${id}`).get()).data().status, 'Open');
  await assert.rejects(call(ops.assignDriver, 'ops', { bookingId: id, reason: 'again' }), /no assignment to remove/);
  // A driver already on a nearby trip is a conflict unless the admin confirms.
  await call(ops.assignDriver, 'ops', { bookingId: id, driverId: 'drvA', reason: '' });
  await create('flow_book_clash');
  await approve('flow_book_clash');
  await assert.rejects(call(ops.assignDriver, 'ops', { bookingId: 'flow_book_clash', driverId: 'drvA', reason: '' }), /already has trip/);
  const forced = await call(ops.assignDriver, 'ops', { bookingId: 'flow_book_clash', driverId: 'drvA', reason: '', force: true });
  assert.equal(forced.action, 'assign');
  // Only operations staff may assign.
  await assert.rejects(call(ops.assignDriver, 'finOnly', { bookingId: id, driverId: 'drvB', reason: 'x' }), /operations/);
});

test('payments: ₹2,000 UPI + ₹3,000 cash by the driver + ₹5,000 bank by admin on ₹10,000 = Paid, balance 0', async () => {
  const q = await call(createAdminBooking, 'ops', { ...adminReq('pay_book_0001', { categoryId: 'pay10k' }), quoteOnly: true });
  assert.equal(q.quote.total, 10000);
  await call(createAdminBooking, 'ops', { ...adminReq('pay_book_0001', { categoryId: 'pay10k' }), expectedFare: 10000, advance: { amount: 2000, method: 'UPI', reference: 'UPI-ADV-1' } });
  await approve('pay_book_0001');
  await call(ops.assignDriver, 'ops', { bookingId: 'pay_book_0001', driverId: 'drvB', reason: '' });
  // The driver records the cash he collected — always as himself.
  const cash = await call(recordPayment, 'drvB', { bookingId: 'pay_book_0001', amount: 3000, method: 'Cash', requestId: 'pay_cash_00001', notes: 'Collected at pickup' });
  assert.equal(cash.summary.totalPaid, 5000);
  assert.equal(cash.summary.balanceDue, 5000);
  assert.equal(cash.summary.status, 'Partially Paid');
  // Overpayment, missing reference and unknown methods are refused.
  await assert.rejects(call(recordPayment, 'ops', { bookingId: 'pay_book_0001', amount: 5000.5, method: 'Bank Transfer', reference: 'NEFT-1', requestId: 'pay_over_00001', collectorType: 'admin' }), /more than the balance/);
  await assert.rejects(call(recordPayment, 'ops', { bookingId: 'pay_book_0001', amount: 5000, method: 'Bank Transfer', requestId: 'pay_noref_0001', collectorType: 'admin' }), /reference/);
  await assert.rejects(call(recordPayment, 'ops', { bookingId: 'pay_book_0001', amount: 5000, method: 'Barter', requestId: 'pay_bad_000001', collectorType: 'admin' }), /payment method/);
  await assert.rejects(call(recordPayment, 'ops', { bookingId: 'pay_book_0001', amount: 0, method: 'Cash', requestId: 'pay_zero_00001', collectorType: 'admin' }), /greater than zero/);
  // A stranger, a customer or finance without the booking cannot record for the driver.
  await assert.rejects(call(recordPayment, 'drvA', { bookingId: 'pay_book_0001', amount: 100, method: 'Cash', requestId: 'pay_other_0001' }), /cannot record/);
  await assert.rejects(call(recordPayment, 'cust', { bookingId: 'pay_book_0001', amount: 100, method: 'Cash', requestId: 'pay_cust_00001' }), /cannot record/);
  await assert.rejects(call(recordPayment, 'opsOnly', { bookingId: 'pay_book_0001', amount: 100, method: 'Cash', requestId: 'pay_opsonly_01', collectorType: 'admin' }), /finance access/);
  const bank = await call(recordPayment, 'finOnly', { bookingId: 'pay_book_0001', amount: 5000, method: 'Bank Transfer', reference: 'NEFT-998877', requestId: 'pay_bank_00001', collectorType: 'admin' });
  assert.equal(bank.summary.totalPaid, 10000);
  assert.equal(bank.summary.balanceDue, 0);
  assert.equal(bank.summary.status, 'Paid');
  // Replaying a request records nothing twice.
  const dup = await call(recordPayment, 'finOnly', { bookingId: 'pay_book_0001', amount: 5000, method: 'Bank Transfer', reference: 'NEFT-998877', requestId: 'pay_bank_00001', collectorType: 'admin' });
  assert.equal(dup.duplicate, true);
  const b = await booking('pay_book_0001');
  assert.equal(b.paymentSummary.totalPaid, 10000);
  assert.equal(b.paymentSummary.transactions, 3);
  assert.equal(b.paymentSummary.partnerCashHeld, 3000);
  assert.equal(b.payment, 'Paid');
  assert.equal(b.paymentStatus, 'Paid');
  assert.ok(b.paidAt);
  // History keeps all three, with the method, amount and collector of each.
  const rows = (await db.collection('bookings/pay_book_0001/payment_transactions').get()).docs.map((d) => d.data()).sort((a, c) => a.amount - c.amount);
  assert.deepEqual(rows.map((r) => [r.amount, r.method, r.collectorType]), [[2000, 'UPI', 'admin'], [3000, 'Cash', 'driver'], [5000, 'Bank Transfer', 'admin']]);
  assert.equal(rows[1].collectorId, 'drvB');
  assert.equal(rows[1].collectorName, 'Driver B');
  assert.equal(rows[2].reference, 'NEFT-998877');
  // Mirrored for the Payments screen and audited.
  const mirror = await db.collection('payments').where('bookingDocumentId', '==', 'pay_book_0001').get();
  assert.equal(mirror.size, 3);
  assert.ok((await db.collection('audit_logs').where('bookingId', '==', 'pay_book_0001').get()).docs.filter((d) => d.data().action === 'payment_recorded').length >= 2);
  // Fully paid: nothing more can be taken.
  await assert.rejects(call(recordPayment, 'finOnly', { bookingId: 'pay_book_0001', amount: 1, method: 'Cash', requestId: 'pay_extra_0001', collectorType: 'admin' }), /already fully paid/);
  // Voiding keeps the record and reopens the balance; only finance may void.
  const id = (await db.collection('bookings/pay_book_0001/payment_transactions').where('method', '==', 'Bank Transfer').get()).docs[0].id;
  await assert.rejects(call(voidPayment, 'opsOnly', { bookingId: 'pay_book_0001', paymentId: id, reason: 'entered twice by mistake' }), /finance/);
  await assert.rejects(call(voidPayment, 'finOnly', { bookingId: 'pay_book_0001', paymentId: id, reason: 'short' }), /at least 10/);
  const v = await call(voidPayment, 'finOnly', { bookingId: 'pay_book_0001', paymentId: id, reason: 'entered twice by mistake' });
  assert.equal(v.summary.totalPaid, 5000);
  assert.equal(v.summary.status, 'Partially Paid');
  assert.equal((await db.doc(`bookings/pay_book_0001/payment_transactions/${id}`).get()).data().status, 'Voided');
  await assert.rejects(call(voidPayment, 'finOnly', { bookingId: 'pay_book_0001', paymentId: id, reason: 'voiding again please' }), /already voided/);
});

test('payments: status is derived from transactions, and the cash a driver holds feeds the partner ledger', async () => {
  // Re-derive purely from stored transactions: the label cannot be typed in.
  const rows = (await db.collection('bookings/pay_book_0001/payment_transactions').get()).docs.map((d) => d.data());
  const b = await booking('pay_book_0001');
  const { summary } = derivedPaymentFields({ ...b, status: 'Assigned' }, rows);
  assert.equal(summary.status, b.paymentSummary.status);
  assert.equal(summary.totalPaid, b.paymentSummary.totalPaid);
  // Tolls are due only after the trip ends.
  const done = derivedPaymentFields({ ...b, status: 'Completed', tollCharges: 300 }, rows).summary;
  assert.equal(done.amountDue, 10300);
  // Legacy bookings that were marked paid before transactions existed still read as paid.
  await db.doc('bookings/legacy_paid').set({ status: 'Completed', fare: 1500, payment: 'Paid', customer: 'Old' });
  const legacy = derivedPaymentFields({ status: 'Completed', fare: 1500, payment: 'Paid' }, []).summary;
  assert.equal(legacy.status, 'Unpaid'); // transactions are the truth; the trigger keeps legacy docs untouched
  assert.equal((await booking('legacy_paid')).payment, 'Paid');
});

test('cancellation and refund: cancelled-by, charge, eligibility, status flow, audit; customer cancels get the same record', async () => {
  const id = 'canc_book_0001';
  await call(createAdminBooking, 'ops', { ...adminReq(id, { categoryId: 'pay10k' }), expectedFare: 10000, advance: { amount: 4000, method: 'UPI', reference: 'UPI-ADV-2' } });
  await approve(id);
  await assert.rejects(call(ops.cancelBooking, 'ops', { bookingId: id, reason: '' }), /reason/);
  await assert.rejects(call(ops.cancelBooking, 'opsOnly', { bookingId: id, reason: 'Customer called to cancel', cancellationCharge: 500 }), /finance access/);
  await assert.rejects(call(ops.cancelBooking, 'ops', { bookingId: id, reason: 'Customer called to cancel', cancellationCharge: 500, refundAmount: 3600 }), /cannot exceed ₹3,500/);
  const r = await call(ops.cancelBooking, 'ops', { bookingId: id, reason: 'Customer called to cancel', cancellationCharge: 500, refundMethod: 'UPI' });
  assert.equal(r.refundAmount, 3500);
  assert.equal(r.amountPaid, 4000);
  const b = await booking(id);
  assert.equal(b.status, 'Cancelled');
  assert.equal(b.cancellation.cancelledBy.type, 'admin');
  assert.equal(b.cancellation.cancelledBy.id, 'ops');
  assert.equal(b.cancellation.charge, 500);
  assert.equal(b.cancellation.reason, 'Customer called to cancel');
  assert.ok(b.cancellation.at);
  assert.equal(b.refund.status, 'Pending');
  assert.equal(b.refund.amount, 3500);
  assert.equal((await db.doc(`marketplace_trips/${id}`).get()).data().status, 'Closed');
  await assert.rejects(approve(id), /cancelled booking cannot/);
  await assert.rejects(call(recordPayment, 'finOnly', { bookingId: id, amount: 10, method: 'Cash', requestId: 'pay_cancel_0001', collectorType: 'admin' }), /cannot take new payments/);
  // The refund moves Pending → Processing → Completed with a reference; invalid moves are refused.
  await assert.rejects(call(ops.updateRefund, 'opsOnly', { bookingId: id, status: 'Processing' }), /finance/);
  await assert.rejects(call(ops.updateRefund, 'finOnly', { bookingId: id, status: 'Completed' }), /method and its transaction reference/);
  await assert.rejects(call(ops.updateRefund, 'finOnly', { bookingId: id, status: 'Pending' }), /Processing, Completed/);
  await call(ops.updateRefund, 'finOnly', { bookingId: id, status: 'Processing', method: 'UPI' });
  await call(ops.updateRefund, 'finOnly', { bookingId: id, status: 'Completed', method: 'UPI', reference: 'REFUND-UTR-1', note: 'Paid back' });
  const done = await booking(id);
  assert.equal(done.refund.status, 'Completed');
  assert.equal(done.refund.reference, 'REFUND-UTR-1');
  assert.equal(done.refund.processedBy, 'finOnly');
  assert.ok(done.refund.processedAt);
  assert.equal(done.refund.history.length, 2);
  await assert.rejects(call(ops.updateRefund, 'finOnly', { bookingId: id, status: 'Failed' }), /cannot become/);
  assert.ok((await db.collection('audit_logs').where('bookingId', '==', id).get()).docs.map((d) => d.data().action).includes('refund_completed'));
  // A booking with nothing paid has no refund to process.
  await create('canc_book_0002');
  await call(ops.cancelBooking, 'ops', { bookingId: 'canc_book_0002', reason: 'Duplicate booking' });
  const none = await booking('canc_book_0002');
  assert.equal(none.refund.status, 'Not Applicable');
  await assert.rejects(call(ops.updateRefund, 'finOnly', { bookingId: 'canc_book_0002', status: 'Processing' }), /no refund to process/);
  // A rejected booking returns any advance in full.
  await call(createAdminBooking, 'ops', { ...adminReq('canc_book_0003', { categoryId: 'pay10k' }), expectedFare: 10000, advance: { amount: 1000, method: 'Cash' } });
  await call(ops.rejectBooking, 'ops', { bookingId: 'canc_book_0003', reason: 'Cannot serve that route' });
  assert.equal((await booking('canc_book_0003')).refund.amount, 1000);
  assert.equal((await booking('canc_book_0003')).refund.status, 'Pending');
});

test('penalties: issuing needs compliance access and valid details', async () => {
  const id = 'flow_book_0001';
  const issue = (extra = {}) => call(penalties.issuePenalty, 'compOnly', { party: 'Driver', partyId: 'drvA', category: 'Late Arrival', reason: 'Arrived 40 minutes late', description: 'Customer complained', amount: 300, incidentDate: new Date().toISOString().slice(0, 10), bookingId: id, ...extra });
  await assert.rejects(call(penalties.issuePenalty, 'finOnly', { party: 'Driver', partyId: 'drvA' }), /compliance/);
  await assert.rejects(issue({ amount: 0 }), /greater than zero/);
  await assert.rejects(issue({ amount: 999999 }), /cannot exceed/);
  await assert.rejects(issue({ category: 'Nonsense' }), /category/);
  await assert.rejects(issue({ reason: 'bad' }), /10 characters/);
});

test('penalties: lifecycle', async () => {
  const id = 'flow_book_0001';
  const today = new Date().toISOString().slice(0, 10);
  const mk = async (extra = {}) => (await call(penalties.issuePenalty, 'compOnly', { party: 'Driver', partyId: 'drvA', category: 'Late Arrival', reason: 'Arrived 40 minutes late', description: 'Customer complained', amount: 300, incidentDate: today, bookingId: id, requestId: `pen_req_${Math.random().toString(36).slice(2, 12)}`, ...extra })).id;
  const p1 = await mk();
  const doc1 = (await db.doc(`penalties/${p1}`).get()).data();
  assert.equal(doc1.status, 'Pending');
  assert.equal(doc1.acknowledged, false);
  assert.equal(doc1.requiresAcknowledgement, true);
  assert.equal(doc1.issuedBy, 'compOnly');
  assert.equal(doc1.bookingCode.startsWith('NT'), true);
  assert.equal(doc1.description, 'Customer complained');
  // The partner is notified with a critical penalty alert and a CTA.
  const n = (await db.collection('notifications').where('recipientId', '==', 'drvA').get()).docs.map((d) => d.data()).find((d) => d.category === 'penalties');
  assert.ok(n);
  assert.equal(n.severity, 'critical');
  assert.equal(n.cta.page, 'penalties');
  // Only the penalised partner can acknowledge, and only after confirming they read it.
  await assert.rejects(call(penalties.acknowledgePenalty, 'drvB', { penaltyId: p1, confirmed: true }), /not issued to you/);
  await assert.rejects(call(penalties.acknowledgePenalty, 'drvA', { penaltyId: p1 }), /Tick the box/);
  await call(penalties.acknowledgePenalty, 'drvA', { penaltyId: p1, confirmed: true });
  const acked = (await db.doc(`penalties/${p1}`).get()).data();
  assert.equal(acked.acknowledged, true);
  assert.equal(acked.status, 'Acknowledged');
  assert.equal(acked.acknowledgedBy, 'drvA');
  assert.ok(acked.acknowledgedAt);
  assert.equal(acked.acknowledgementText, 'I have read and understood the penalty information.');
  assert.equal((await call(penalties.acknowledgePenalty, 'drvA', { penaltyId: p1, confirmed: true })).already, true);
  // Dispute needs a reason; the admin is told.
  await assert.rejects(call(penalties.disputePenalty, 'drvA', { penaltyId: p1, note: 'short' }), /at least 10/);
  await call(penalties.disputePenalty, 'drvA', { penaltyId: p1, note: 'I was stuck behind an accident' });
  assert.equal((await db.doc(`penalties/${p1}`).get()).data().status, 'Disputed');
  assert.ok((await db.collection('notifications').where('recipientId', '==', 'admin').get()).docs.some((d) => d.data().title === 'Penalty disputed'));
  // Staff: uphold, then deduct (finance) — the deduction is a debit in the partner ledger.
  await assert.rejects(call(penalties.transitionPenalty, 'compOnly', { penaltyId: p1, status: 'Deducted' }), /finance/);
  await assert.rejects(call(penalties.transitionPenalty, 'compOnly', { penaltyId: p1, status: 'Pending', note: 'x' }), /decision note/);
  await call(penalties.transitionPenalty, 'compOnly', { penaltyId: p1, status: 'Pending', note: 'Evidence does not support the dispute' });
  await call(penalties.transitionPenalty, 'finOnly', { penaltyId: p1, status: 'Deducted' });
  const ded = (await db.doc(`penalties/${p1}`).get()).data();
  assert.equal(ded.status, 'Deducted');
  assert.equal(ded.history.length >= 4, true);
  const led = (await db.doc(`wallet_ledger/penalty_${p1}`).get()).data();
  assert.equal(led.type, 'penalty_deduction');
  assert.equal(led.direction, 'debit');
  assert.equal(led.netAmount, 300);
  assert.equal(led.driverId, 'drvA');
  assert.equal((await db.doc('wallets/driver_drvA').get()).data().available, -300);
  await assert.rejects(call(penalties.transitionPenalty, 'ops', { penaltyId: p1, status: 'Waived', note: 'too late now' }), /cannot become/);
  // Waive and pay paths, and replay protection on issue.
  const p2 = await mk();
  await call(penalties.transitionPenalty, 'compOnly', { penaltyId: p2, status: 'Waived', note: 'First offence' });
  assert.equal((await db.doc(`penalties/${p2}`).get()).data().status, 'Waived');
  const p3 = await mk();
  await assert.rejects(call(penalties.transitionPenalty, 'finOnly', { penaltyId: p3, status: 'Paid' }), /payment reference/);
  await call(penalties.transitionPenalty, 'finOnly', { penaltyId: p3, status: 'Paid', reference: 'CASH-RCPT-77' });
  assert.equal((await db.doc(`penalties/${p3}`).get()).data().status, 'Paid');
  const rid = 'pen_replay_0001';
  const a = await mk({ requestId: rid });
  const b = await mk({ requestId: rid });
  assert.equal(a, b);
  // A vendor can be penalised too and sees their own.
  const vp = (await call(penalties.issuePenalty, 'compOnly', { party: 'Vendor', partyId: 'v1', category: 'Vehicle Condition', reason: 'Vehicle was unclean on pickup', amount: 500, incidentDate: today })).id;
  await call(penalties.acknowledgePenalty, 'v1', { penaltyId: vp, confirmed: true });
  assert.equal((await db.doc(`penalties/${vp}`).get()).data().acknowledgedBy, 'v1');
  await recomputeWallet('driver', 'drvA');
});

test('unassigned alerts: warning within 3 h, critical within 1 h, once per level; assigned and Pending bookings are ignored', async () => {
  const now = new Date();
  const mk = async (id, hoursAhead, status = 'Approved', extra = {}) => db.doc(`bookings/${id}`).set({
    bookingId: `AL-${id}`, status, customer: 'Alert Test', pickup: 'A', drop: 'B', pickupAt: new Date(now.getTime() + hoursAhead * 3600000), assignedDriverId: '', ...extra,
  });
  await mk('al_far', 8);
  await mk('al_warn', 2.5);
  await mk('al_crit', 0.5);
  await mk('al_late', -0.25);
  await mk('al_pending', 0.5, 'Pending');
  await mk('al_assigned', 0.5, 'Assigned', { assignedDriverId: 'drvA' });
  const r1 = await runUnassignedAlerts(now);
  assert.equal(r1.warnings, 1);
  assert.equal(r1.criticals, 2);
  const alerts = async (id) => (await db.collection('notifications').where('bookingId', '==', id).get()).docs.map((d) => d.data());
  assert.equal((await alerts('al_far')).length, 0);
  assert.equal((await alerts('al_pending')).length, 0);
  assert.equal((await alerts('al_assigned')).length, 0);
  const warn = (await alerts('al_warn'))[0];
  assert.equal(warn.severity, 'warning');
  assert.match(warn.message, /\d{2}:\d{2} (AM|PM)/); // 12-hour pickup time
  assert.equal(warn.cta.label, 'Assign driver');
  const crit = (await alerts('al_crit'))[0];
  assert.equal(crit.severity, 'critical');
  assert.equal(crit.title, 'URGENT: no driver assigned');
  assert.equal((await booking('al_warn')).unassignedAlert.severity, 'warning');
  // Running again must not repeat the same alert.
  const r2 = await runUnassignedAlerts(now);
  assert.equal(r2.warnings + r2.criticals, 0);
  assert.equal((await alerts('al_warn')).length, 1);
  // 90 minutes later the warning booking is inside the critical window: exactly one more alert, for the new level.
  const later = new Date(now.getTime() + 90 * 60000);
  const r3 = await runUnassignedAlerts(later);
  assert.equal(r3.criticals >= 1, true);
  const warnAlerts = await alerts('al_warn');
  assert.equal(warnAlerts.length, 2);
  assert.deepEqual(warnAlerts.map((a) => a.severity).sort(), ['critical', 'warning']);
  // The windows come from settings/operations.
  await db.doc('settings/operations').set({ unassignedAlertHours: 12, unassignedCriticalHours: 6 });
  const r4 = await runUnassignedAlerts(now);
  assert.equal(r4.warnings >= 1, true);
  assert.equal((await alerts('al_far')).length, 1);
  await db.doc('settings/operations').delete();
  // Acknowledgement is recorded.
  await call(ops.acknowledgeUnassignedAlert, 'ops', { bookingId: 'al_warn' });
  assert.equal((await booking('al_warn')).unassignedAlert.acknowledgedBy, 'ops');
});

test('legal: drafts are not enforced; publishing makes acceptance mandatory; a new version asks again; records are kept', async () => {
  const customerDocs = async () => (await call(legal.getLegalStatus, 'cust', { role: 'customer' }));
  await assert.rejects(call(legal.seedLegalDocuments, 'opsOnly'), /super admin/);
  const seeded = await call(legal.seedLegalDocuments, 'ops');
  assert.ok(seeded.created >= 10);
  // Drafts exist but nothing is required yet, so booking is not blocked.
  assert.deepEqual((await customerDocs()).missing, []);
  const seeded2 = await call(legal.seedLegalDocuments, 'ops');
  assert.equal(seeded2.created, 0);
  await assert.rejects(call(legal.publishLegalDocument, 'opsOnly', { type: 'terms', role: 'customer', title: 'Terms', body: 'x'.repeat(60) }), /system/);
  const draft = (await db.doc('legal_documents/terms_customer').get()).data();
  const pub = await call(legal.publishLegalDocument, 'ops', { type: 'terms', role: 'customer', title: draft.title, body: draft.body, checkboxText: 'I agree to the Terms & Conditions and Privacy Policy.', requiresAcceptance: true, changeSummary: 'First release' });
  assert.equal(pub.version, 1);
  await call(legal.publishLegalDocument, 'ops', { type: 'privacy', role: 'customer', title: 'Privacy', body: 'P'.repeat(80), requiresAcceptance: true, changeSummary: 'First release' });
  const miss = (await customerDocs()).missing;
  assert.deepEqual(miss.map((m) => m.key).sort(), ['privacy_customer', 'terms_customer']);
  // A customer booking is refused until they accept (and the error tells the app what to show).
  const req = (requestId) => ({ requestId, pickup: { name: 'P', address: 'Theni', lat: 10.01, lng: 77.47 }, drop: { name: 'D', address: 'Bodi', lat: 10.1, lng: 77.5 }, categoryId: 'pkg10k', tripType: 'One Way', paymentMethod: 'Cash', expectedFare: 10500 });
  await assert.rejects(call(createBooking, 'cust', req('legal_book_0001')), (e) => /accept/.test(e.message) && e.details?.legalRequired === true);
  await assert.rejects(call(legal.acceptLegalDocuments, 'cust', { role: 'customer', accept: miss.map((m) => ({ key: m.key, version: m.version })) }), /Tick the box/);
  await assert.rejects(call(legal.acceptLegalDocuments, 'cust', { role: 'customer', confirmed: true, accept: [{ key: 'terms_customer', version: 99 }] }), /updated/);
  await call(legal.acceptLegalDocuments, 'cust', { role: 'customer', confirmed: true, accept: miss.map((m) => ({ key: m.key, version: m.version })), checkboxText: 'I agree to the Terms & Conditions and Privacy Policy.', device: { platform: 'web', appVersion: '1.0' } });
  assert.deepEqual((await customerDocs()).missing, []);
  const rec = (await db.doc('legal_acceptances/cust_terms_customer_v1').get()).data();
  assert.equal(rec.userId, 'cust');
  assert.equal(rec.role, 'customer');
  assert.equal(rec.version, 1);
  assert.equal(rec.checkboxText, 'I agree to the Terms & Conditions and Privacy Policy.');
  assert.ok(rec.acceptedAt);
  assert.equal(rec.device.platform, 'web');
  const ok = await call(createBooking, 'cust', req('legal_book_0002'));
  assert.ok(ok.id);
  const created = await booking('legal_book_0002');
  assert.equal(created.status, 'Pending');
  assert.equal((await db.doc('marketplace_trips/legal_book_0002').get()).data().status, 'Awaiting Approval');
  assert.equal(created.customerWhatsapp.sameAsMobile, true);
  // A material change: version 2 asks everyone again, and v1 acceptances are kept.
  const v2 = await call(legal.publishLegalDocument, 'ops', { type: 'terms', role: 'customer', title: draft.title, body: `${draft.body}\n\nAdded section.`, requiresAcceptance: true, changeSummary: 'New cancellation terms' });
  assert.equal(v2.version, 2);
  assert.deepEqual((await customerDocs()).missing.map((m) => m.key), ['terms_customer']);
  assert.equal((await db.doc('legal_acceptances/cust_terms_customer_v1').get()).exists, true);
  await assert.rejects(call(createBooking, 'cust', req('legal_book_0003')), /accept/);
  // Version history is immutable and the staff panel can read it.
  assert.equal((await db.collection('legal_documents/terms_customer/versions').get()).size, 2);
  // Legal events are audited.
  assert.ok((await db.collection('audit_logs').where('action', '==', 'legal_published').get()).size >= 3);
});

test('old bookings: records with none of the new fields still load, approve and take payments', async () => {
  await db.doc('bookings/old_style').set({
    bookingId: 'NT-OLD-1', customerId: 'cust', customer: 'Old Customer', phone: '+91 9800000000', pickup: 'Theni', drop: 'Madurai', date: '07 Oct 2026', time: '06:30 PM',
    fare: 1500, fareVerified: true, commission: { rate: 15, base: 'taxable', source: 'global', policyVersion: 1 }, payment: 'Pending', paymentMethod: 'Cash', status: 'Pending', fareBreakdown: { total: 1500, subtotal: 1429, taxableAmount: 1429, gst: 71, gstRate: 0.05, discount: 0 },
  });
  await db.doc('marketplace_trips/old_style').set({ status: 'Open', offeredPayout: 1200, bookingId: 'NT-OLD-1', pickup: { address: 'Theni' }, drop: { address: 'Madurai' } });
  // The migration hides the trip that was open before approval existed (dry run first).
  const dry = await call(ops.migrateMarketplaceVisibility, 'ops', {});
  assert.equal(dry.dryRun, true);
  assert.ok(dry.tripsToHide >= 1);
  assert.equal((await db.doc('marketplace_trips/old_style').get()).data().status, 'Open');
  await assert.rejects(call(ops.migrateMarketplaceVisibility, 'opsOnly', { dryRun: false }), /super admin/);
  await call(ops.migrateMarketplaceVisibility, 'ops', { dryRun: false });
  assert.equal((await db.doc('marketplace_trips/old_style').get()).data().status, 'Awaiting Approval');
  await approve('old_style');
  assert.equal((await db.doc('marketplace_trips/old_style').get()).data().status, 'Open');
  const pay = await call(recordPayment, 'finOnly', { bookingId: 'old_style', amount: 500, method: 'Cash', requestId: 'pay_old_000001', collectorType: 'admin' });
  assert.equal(pay.summary.balanceDue, 1000);
  assert.equal((await booking('old_style')).fareBreakup, undefined);
});

test('customer notices over every channel report each result; one failing channel never blocks another', async () => {
  resetSent();
  failing.add('whatsapp');
  await create('chan_book_0001', { customerEmail: 'chan@example.com' });
  const r = await approve('chan_book_0001');
  const by = Object.fromEntries(r.customerChannels.map((c) => [c.channel, c.status]));
  assert.equal(by.whatsapp, 'failed');
  assert.equal(by.sms, 'sent');
  assert.equal(by.email, 'sent');
  const rows = (await db.collection('notification_deliveries').where('bookingId', '==', 'chan_book_0001').get()).docs.map((d) => d.data());
  assert.ok(rows.some((d) => d.channel === 'whatsapp' && d.status === 'failed' && d.error));
  assert.ok(rows.some((d) => d.channel === 'sms' && d.status === 'sent' && d.providerMessageId));
  assert.ok(rows.some((d) => d.channel === 'email' && d.status === 'sent'));
  assert.ok(rows.some((d) => d.channel === 'in_app'));
  resetSent();
});
