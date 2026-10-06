// Phase B — one source of truth for partner money: commission policy,
// immutable finance snapshots, the partner ledger / wallets, payouts, the
// legacy backfill and the marketplace callables that set a partner's payout.
// Runs the compiled functions (functions/lib) against the emulator.
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

process.env.GCLOUD_PROJECT = 'demo-nesam-finance';
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${process.env.FIRESTORE_EMULATOR_PORT || 8089}`;
const { db } = await import('../../functions/lib/admin.js');
const { createBooking } = await import('../../functions/lib/commerce.js');
const { createAdminBooking } = await import('../../functions/lib/adminBookings.js');
const { saveCommissionPolicy } = await import('../../functions/lib/commission.js');
const { requestPartnerPayout, syncBookingFinance, syncPayoutLedger, rebuildPartnerLedger } = await import('../../functions/lib/ledger.js');
const market = await import('../../functions/lib/marketplace.js');
const { calculateFare, mapCategory } = await import('../../functions/lib/domain/pricing.js');
const fin = await import('../../functions/lib/domain/finance.js');

const SEDAN = { name: 'Sedan', code: 'SEDAN', status: 'Active', seatingCapacity: 4, fare: { baseFare: 70, baseKm: 2, perKmRate: 16, waitingChargePerHour: 105, minimumFare: 100, nightAllowance: 50, driverAllowance: 400 } };
const ROUTE = { distanceKm: 10, durationMin: 20 };
const quote = () => calculateFare({ category: mapCategory('sedan', SEDAN), route: ROUTE, tripType: 'One Way', pickupTime: new Date() }).total;
const round2 = (n) => Math.round(n * 100) / 100;

let env;
const realFetch = globalThis.fetch;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-nesam-finance', firestore: { host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8089) } });
  await env.clearFirestore();
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ code: 'Ok', routes: [{ distance: 10000, duration: 1200 }] }) });
  await db.doc('vehicle_categories/sedan').set(SEDAN);
  await db.doc('customers/cust').set({ status: 'Approved', name: 'Test Customer', phone: '+919000000001' });
  await db.doc('admins/root').set({ role: 'admin', status: 'active', name: 'Owner' }); // no staffRole = super admin
  await db.doc('admins/fin').set({ role: 'admin', status: 'active', name: 'Finance', staffRole: 'r_fin', permissions: ['finance'] });
  await db.doc('admins/ops').set({ role: 'admin', status: 'active', name: 'Ops', staffRole: 'r_ops', permissions: ['operations'] });
  await db.doc('admins/opsFin').set({ role: 'admin', status: 'active', name: 'Ops+Fin', staffRole: 'r_of', permissions: ['operations', 'finance'] });
  await db.doc('locations/loc_a').set({ name: 'Theni', status: 'Active', pickupEnabled: true, dropEnabled: true, lat: 10.01, lng: 77.47 });
  await db.doc('locations/loc_b').set({ name: 'Bodi', status: 'Active', pickupEnabled: true, dropEnabled: true, lat: 10.01, lng: 77.35 });
});
after(async () => { globalThis.fetch = realFetch; await db.terminate(); await env?.cleanup(); });

const run = (fn, uid, data) => fn.run({ auth: uid ? { uid, token: { email: `${uid}@nesam.test` } } : undefined, data });
const ride = (requestId) => ({
  requestId, pickup: { name: 'Pickup', address: 'Theni', lat: 10.01, lng: 77.47 }, drop: { name: 'Drop', address: 'Bodi', lat: 10.1, lng: 77.5 },
  categoryId: 'sedan', tripType: 'One Way', paymentMethod: 'UPI', expectedFare: quote(),
});
const phoneBooking = (requestId) => ({
  requestId, customerName: 'Caller', customerPhone: '98765 43210', pickupLocationId: 'loc_a', dropLocationId: 'loc_b',
  categoryId: 'sedan', tripType: 'One Way', paymentMethod: 'Cash', expectedFare: quote(),
});
const ledger = async (walletId) => (await db.collection('wallet_ledger').where('walletId', '==', walletId).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const wallet = async (key) => (await db.doc(`wallets/${key}`).get()).data();
const completedTrip = (id, fields) => db.doc(`bookings/${id}`).set({ bookingId: `NT-${id}`, status: 'Completed', fareVerified: true, ...fields });

// ── Commission policy ───────────────────────────────────────────────────────

test('commission: with no policy, customer and admin bookings are refused — nothing is invented', async () => {
  await assert.rejects(run(createBooking, 'cust', ride('nopolicy_req_01')), /commission policy is not configured/);
  assert.equal((await db.doc('bookings/nopolicy_req_01').get()).exists, false);
  const q = await run(createAdminBooking, 'ops', { ...phoneBooking('nopolicy_req_02'), expectedFare: undefined, quoteOnly: true });
  assert.equal(q.commissionConfigured, false);
  await assert.rejects(run(createAdminBooking, 'ops', phoneBooking('nopolicy_req_03')), /commission policy is not configured/);
  assert.equal((await db.doc('marketplace_trips/nopolicy_req_03').get()).exists, false);
});

test('commission: only finance saves the policy; it is validated, versioned and audited', async () => {
  const policy = { base: 'taxable', global: { rate: 15 }, categories: { sedan: { rate: 20 } }, services: {} };
  await assert.rejects(run(saveCommissionPolicy, 'ops', policy), /finance access/);
  await assert.rejects(run(saveCommissionPolicy, 'fin', { ...policy, base: 'gross' }), /excluding GST or including GST/);
  await assert.rejects(run(saveCommissionPolicy, 'fin', { ...policy, global: { rate: 120 } }), /0 to 100/);
  await assert.rejects(run(saveCommissionPolicy, 'fin', { ...policy, categories: { 'a/b': { rate: 5 } } }), /Invalid category id/);
  assert.equal((await run(saveCommissionPolicy, 'fin', { ...policy, expectedVersion: 0 })).version, 1);
  // A stale editor cannot overwrite a newer version.
  await assert.rejects(run(saveCommissionPolicy, 'fin', { ...policy, global: { rate: 18 }, expectedVersion: 0 }), /changed by someone else/);
  const stored = (await db.doc('business_config/commission').get()).data();
  assert.deepEqual([stored.base, stored.global, stored.categories, stored.version, stored.updatedBy], ['taxable', { rate: 15 }, { sedan: { rate: 20 } }, 1, 'fin']);
  const audit = (await db.collection('admin_audit').where('action', '==', 'commission_policy_saved').get()).docs.map((d) => d.data());
  assert.equal(audit.length, 1);
  assert.equal(audit[0].details.before, null);
  assert.equal(audit[0].details.after.version, 1);
});

test('commission: most specific rule wins (service → category → global); none → not configured', () => {
  const p = fin.parseCommissionPolicy({ base: 'total', global: { rate: 10 }, services: { svc: { rate: 5 } }, categories: { suv: { rate: 12 } }, version: 3 });
  assert.deepEqual(fin.resolveCommission(p, { serviceId: 'svc', categoryId: 'suv' }), { rate: 5, base: 'total', source: 'service:svc', policyVersion: 3 });
  assert.deepEqual(fin.resolveCommission(p, { serviceId: 'other', categoryId: 'suv' }), { rate: 12, base: 'total', source: 'category:suv', policyVersion: 3 });
  assert.equal(fin.resolveCommission(p, { categoryId: 'mini' }).source, 'global');
  const noGlobal = fin.parseCommissionPolicy({ base: 'taxable', global: null, categories: { suv: { rate: 12 } } });
  assert.equal(fin.resolveCommission(noGlobal, { categoryId: 'mini' }), null);
  assert.equal(fin.resolveCommission(null, { categoryId: 'suv' }), null);
  // A malformed stored policy counts as not configured, never as a default.
  assert.equal(fin.parseCommissionPolicy({ global: { rate: 10 } }), null);
  assert.equal(fin.parseCommissionPolicy({ base: 'taxable', global: { rate: -3 } }).global, null);
  // Base: fare excluding GST vs the GST-inclusive total.
  assert.equal(fin.partnerPayoutFor({ taxableAmount: 1000, total: 1050 }, { rate: 20, base: 'taxable' }), 800);
  assert.equal(fin.partnerPayoutFor({ taxableAmount: 1000, total: 1050 }, { rate: 20, base: 'total' }), 840);
});

// ── Snapshots ───────────────────────────────────────────────────────────────

let snapshotTripId;
test('snapshot: a policy change never alters an existing booking, offer or finalized trip', async () => {
  const { id } = await run(createBooking, 'cust', ride('snapshot_req_01'));
  snapshotTripId = id;
  let b = (await db.doc(`bookings/${id}`).get()).data();
  assert.deepEqual(b.commission, { rate: 20, base: 'taxable', source: 'category:sedan', policyVersion: 1 });
  const offer = (await db.doc(`marketplace_trips/${id}`).get()).data().offeredPayout;
  assert.equal(offer, Math.round((b.fareBreakdown.taxableAmount * 80) / 100));

  await run(saveCommissionPolicy, 'fin', { base: 'taxable', global: { rate: 15 }, categories: { sedan: { rate: 30 } }, services: {}, expectedVersion: 1 });
  b = (await db.doc(`bookings/${id}`).get()).data();
  assert.equal(b.commission.rate, 20);
  assert.equal((await db.doc(`marketplace_trips/${id}`).get()).data().offeredPayout, offer);

  // The independent driver completes it at the agreed offer; the customer paid online.
  await db.doc(`bookings/${id}`).update({ status: 'Completed', assignedDriverId: 'indie', driverPayout: offer, payment: 'Paid', paymentMethod: 'UPI' });
  await syncBookingFinance(id);
  const f1 = (await db.doc(`bookings/${id}`).get()).data().finance;
  assert.deepEqual(
    [f1.schema, f1.partnerType, f1.partnerId, f1.partnerPayout, f1.commissionRate, f1.commissionSource, f1.payoutSource],
    [1, 'driver', 'indie', offer, 20, 'category:sedan', 'offered'],
  );
  assert.equal(f1.fareTotal, b.fare);
  assert.equal(f1.platformRevenue, round2(f1.taxableAmount - offer));
  assert.deepEqual(f1.warnings, []);

  // Later policy changes and re-syncs leave the finalized snapshot untouched.
  await run(saveCommissionPolicy, 'fin', { base: 'total', global: { rate: 40 }, categories: {}, services: {}, expectedVersion: 2 });
  await syncBookingFinance(id);
  assert.deepEqual((await db.doc(`bookings/${id}`).get()).data().finance, f1);
  const [entry] = (await ledger('driver_indie')).filter((e) => e.type === 'trip_earning');
  assert.deepEqual([entry.id, entry.netAmount, entry.status, entry.commissionAmount], [`trip_${id}`, offer, 'available', f1.platformRevenue]);
});

test('ledger: duplicate completion delivery credits once; balances live only in the ledger/wallet', async () => {
  await completedTrip('dup_01', { assignedDriverId: 'dupDriver', fare: 1050, driverPayout: 700, payment: 'Paid', paymentMethod: 'UPI' });
  await Promise.all([syncBookingFinance('dup_01'), syncBookingFinance('dup_01'), syncBookingFinance('dup_01')]);
  const entries = await ledger('driver_dupDriver');
  assert.equal(entries.length, 1);
  assert.equal((await wallet('driver_dupDriver')).tripEarnings, 700);
  assert.equal((await db.doc('drivers/dupDriver').get()).exists, false); // no walletBalance counter written anywhere
});

test('ledger: earnings stay pending until the customer payment is verified', async () => {
  await completedTrip('pend_01', { assignedDriverId: 'pendDriver', fare: 1050, driverPayout: 700, payment: 'Pending', paymentMethod: 'UPI' });
  await syncBookingFinance('pend_01');
  let w = await wallet('driver_pendDriver');
  assert.deepEqual([w.available, w.pending], [0, 700]);
  await db.doc('bookings/pend_01').update({ payment: 'Paid' });
  await syncBookingFinance('pend_01');
  w = await wallet('driver_pendDriver');
  assert.deepEqual([w.available, w.pending], [700, 0]);
});

test('ledger: approved tolls are reimbursed on online payments; a cash trip debits the fare the partner kept', async () => {
  await completedTrip('toll_01', { assignedDriverId: 'tollDriver', fare: 1050, driverPayout: 700, payment: 'Paid', paymentMethod: 'UPI', tollCharges: 200, tollsApproved: true });
  await completedTrip('toll_02', { assignedDriverId: 'tollDriver', fare: 1050, driverPayout: 700, payment: 'Paid', paymentMethod: 'UPI', tollCharges: 90, tollsApproved: false });
  await syncBookingFinance('toll_01');
  await syncBookingFinance('toll_02');
  let entries = await ledger('driver_tollDriver');
  assert.deepEqual(entries.filter((e) => e.type === 'toll_reimbursement').map((e) => [e.id, e.netAmount]), [['toll_toll_01', 200]]);
  await db.doc('bookings/toll_02').update({ tollsApproved: true });
  await syncBookingFinance('toll_02');
  assert.equal((await wallet('driver_tollDriver')).tollReimbursements, 290);

  // Cash: fare 6000 collected by the driver, payout 5000 → the driver owes ₹1000.
  await db.doc('drivers/cashDriver').set({ status: 'Approved' });
  await db.doc('driver_private/cashDriver').set({ bank: { upiId: 'cash@bank' } });
  await completedTrip('cash_01', { assignedDriverId: 'cashDriver', fare: 6000, driverPayout: 5000, payment: 'Paid', paymentMethod: 'Cash', tollCharges: 150, tollsApproved: true });
  await syncBookingFinance('cash_01');
  entries = await ledger('driver_cashDriver');
  assert.deepEqual(entries.map((e) => e.type).sort(), ['cash_collected', 'trip_earning']);
  const w = await wallet('driver_cashDriver');
  assert.deepEqual([w.available, w.cashCollected, w.tripEarnings], [-1000, 6000, 5000]);
  await assert.rejects(run(requestPartnerPayout, 'cashDriver', { requestId: 'cash_payout_01', role: 'driver', amount: 100, method: 'UPI' }), /exceed your earnings by ₹1000/);
});

test('attribution: a fleet trip pays the vendor (never the driver); a missing payout is never invented', async () => {
  await completedTrip('fleet_01', { assignedVendorId: 'vendorA', assignedDriverId: 'fleetDriver', fare: 1050, vendorPayout: 800, payment: 'Paid', paymentMethod: 'UPI' });
  await syncBookingFinance('fleet_01');
  assert.equal((await wallet('vendor_vendorA')).available, 800);
  assert.equal((await ledger('driver_fleetDriver')).length, 0);
  assert.equal((await db.doc('wallets/driver_fleetDriver').get()).exists, false);

  // A fleet trip whose agreed payout was never recorded: flagged, no credit.
  await completedTrip('fleet_02', { assignedVendorId: 'vendorA', assignedDriverId: 'fleetDriver', fare: 1050, driverPayout: 900, payment: 'Paid', paymentMethod: 'UPI' });
  await syncBookingFinance('fleet_02');
  const f = (await db.doc('bookings/fleet_02').get()).data().finance;
  assert.deepEqual([f.partnerType, f.partnerPayout, f.platformRevenue], ['vendor', null, null]);
  assert.match(f.warnings.join(' '), /No partner payout/);
  assert.equal((await db.doc('wallet_ledger/trip_fleet_02').get()).exists, false);

  // Unverified fares are never finalized.
  await completedTrip('unverified_01', { assignedDriverId: 'someone', fare: 999, driverPayout: 500, payment: 'Paid', paymentMethod: 'UPI', fareVerified: false });
  await syncBookingFinance('unverified_01');
  assert.equal((await db.doc('bookings/unverified_01').get()).data().finance, undefined);
});

// ── Payouts ─────────────────────────────────────────────────────────────────

test('payouts: reserved atomically from the ledger; concurrent requests reserve once; reject restores; paid completes', async () => {
  await db.doc('drivers/payDriver').set({ status: 'Approved' });
  await db.doc('driver_private/payDriver').set({ bank: { upiId: 'pay@bank' } });
  await completedTrip('pay_trip', { assignedDriverId: 'payDriver', fare: 1260, driverPayout: 1000, payment: 'Paid', paymentMethod: 'UPI' });
  await syncBookingFinance('pay_trip');
  const payload = (requestId, amount = 800) => ({ requestId, role: 'driver', amount, method: 'UPI' });
  const results = await Promise.allSettled([run(requestPartnerPayout, 'payDriver', payload('pay_req_01')), run(requestPartnerPayout, 'payDriver', payload('pay_req_02'))]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const winner = results.find((r) => r.status === 'fulfilled').value.id;
  assert.equal((await run(requestPartnerPayout, 'payDriver', payload(winner))).id, winner); // replay is idempotent
  const req = (await db.doc(`payout_requests/${winner}`).get()).data();
  assert.deepEqual([req.amount, req.details, req.status], [800, 'pay@bank', 'Pending']);
  let w = await wallet('driver_payDriver');
  assert.deepEqual([w.available, w.reserved], [200, 800]);
  await assert.rejects(run(requestPartnerPayout, 'payDriver', payload('pay_req_03', 300)), /Available balance is ₹200/);

  await db.doc(`payout_requests/${winner}`).update({ status: 'Rejected', adminNote: 'Wrong UPI' });
  await syncPayoutLedger(winner);
  w = await wallet('driver_payDriver');
  assert.deepEqual([w.available, w.reserved], [1000, 0]);
  assert.equal((await db.doc(`wallet_ledger/payout_${winner}`).get()).data().status, 'cancelled');

  const { id: second } = await run(requestPartnerPayout, 'payDriver', payload('pay_req_04', 300));
  await db.doc(`payout_requests/${second}`).update({ status: 'Paid', utr: 'UTR123456' });
  await syncPayoutLedger(second);
  w = await wallet('driver_payDriver');
  assert.deepEqual([w.available, w.reserved, w.paidOut], [700, 0, 300]);
});

test('payouts: needs an approved partner, saved payout details and a vendor minimum', async () => {
  await db.doc('drivers/noBank').set({ status: 'Approved' });
  await completedTrip('nobank_trip', { assignedDriverId: 'noBank', fare: 1260, driverPayout: 1000, payment: 'Paid', paymentMethod: 'UPI' });
  await syncBookingFinance('nobank_trip');
  await assert.rejects(run(requestPartnerPayout, 'noBank', { requestId: 'nobank_req_01', role: 'driver', amount: 500, method: 'UPI' }), /Save valid payout details/);
  await db.doc('drivers/pendingDrv').set({ status: 'Pending' });
  await assert.rejects(run(requestPartnerPayout, 'pendingDrv', { requestId: 'pending_req_01', role: 'driver', amount: 500, method: 'UPI' }), /not approved/);
  await db.doc('vendors/vendorA').set({ status: 'APPROVED', companyName: 'Fleet A' });
  await assert.rejects(run(requestPartnerPayout, 'vendorA', { requestId: 'vendor_req_01', role: 'vendor', amount: 400, method: 'UPI' }), /Minimum fleet payout/);
});

// ── Legacy migration ────────────────────────────────────────────────────────

test('backfill: super admin only; dry run changes nothing; applying is idempotent and keeps the legacy record', async () => {
  await completedTrip('legacy_trip', { assignedDriverId: 'legacyDriver', fare: 1000, driverPayout: 700, payment: 'Paid', paymentMethod: 'UPI' });
  await db.doc('wallet_ledger/trip_legacy_trip').set({ driverId: 'legacyDriver', bookingId: 'legacy_trip', amount: 700, type: 'trip' });
  await completedTrip('legacy_unverified', { assignedDriverId: 'legacyDriver', fare: 800, driverPayout: 500, payment: 'Paid', paymentMethod: 'UPI', fareVerified: false });
  await completedTrip('legacy_nopayout', { assignedDriverId: 'legacyDriver', fare: 800, payment: 'Paid', paymentMethod: 'UPI' });
  await db.doc('payout_requests/legacy_payout').set({ driverId: 'legacyDriver', amount: 200, status: 'Paid', method: 'UPI' });

  await assert.rejects(run(rebuildPartnerLedger, 'fin', {}), /super admin/);
  const dry = await run(rebuildPartnerLedger, 'root', {});
  assert.equal(dry.dryRun, true);
  assert.ok(dry.skippedUnverified.includes('NT-legacy_unverified'));
  assert.ok(dry.missingPayout.includes('NT-legacy_nopayout'));
  assert.deepEqual([dry.tripsToFinalize, dry.tripEntriesToCreate, dry.payoutEntriesToCreate], [2, 1, 1]);
  assert.equal((await db.doc('bookings/legacy_trip').get()).data().finance, undefined);
  assert.equal((await db.doc('wallet_ledger/trip_legacy_trip').get()).data().schema, undefined);

  await run(rebuildPartnerLedger, 'root', { dryRun: false });
  const entry = (await db.doc('wallet_ledger/trip_legacy_trip').get()).data();
  assert.deepEqual([entry.schema, entry.netAmount, entry.legacyEntry.amount], [2, 700, 700]);
  assert.equal((await db.doc('bookings/legacy_trip').get()).data().finance.commissionSource, 'legacy');
  const w = await wallet('driver_legacyDriver');
  assert.deepEqual([w.available, w.paidOut], [500, 200]);
  assert.equal((await db.doc('bookings/legacy_unverified').get()).data().finance, undefined);

  const again = await run(rebuildPartnerLedger, 'root', {});
  assert.deepEqual([again.tripsToFinalize, again.tripEntriesToCreate, again.payoutEntriesToCreate], [0, 0, 0]);
  assert.equal((await db.collection('admin_audit').where('action', '==', 'ledger_rebuilt').get()).size, 1);
});

// ── Marketplace callables ───────────────────────────────────────────────────

const pendingBooking = (id, extra = {}) => db.doc(`bookings/${id}`).set({
  bookingId: `NT-${id}`, status: 'Pending', fareVerified: true, fare: 1050, vehicleCategoryId: 'sedan', pickup: 'Theni', drop: 'Bodi',
  fareBreakdown: { taxableAmount: 1000, gst: 50, total: 1050 }, ...extra,
});

test('marketplace: posting prices the offer from the policy; a manual payout needs finance; unverified fares are refused', async () => {
  // Current policy (from the snapshot test): base total, global 40%.
  await pendingBooking('post_01');
  await assert.rejects(run(market.postBookingToMarketplace, 'fin', { booking: 'NT-post_01' }), /operations access/);
  const res = await run(market.postBookingToMarketplace, 'ops', { booking: 'NT-post_01' });
  assert.equal(res.offeredPayout, 630); // 1050 × 60%
  const b = (await db.doc('bookings/post_01').get()).data();
  assert.deepEqual([b.commission.rate, b.commission.base, b.payoutSource], [40, 'total', 'offered']);

  await pendingBooking('post_02');
  await assert.rejects(run(market.postBookingToMarketplace, 'ops', { booking: 'post_02', payout: 700 }), /needs finance access/);
  assert.equal((await run(market.postBookingToMarketplace, 'opsFin', { booking: 'post_02', payout: 700 })).offeredPayout, 700);
  assert.equal((await db.doc('bookings/post_02').get()).data().payoutSource, 'manual');
  await assert.rejects(run(market.postBookingToMarketplace, 'opsFin', { booking: 'post_02', payout: 2000 }), /already in progress|within the customer fare/);

  await pendingBooking('post_03', { fareVerified: false });
  await assert.rejects(run(market.postBookingToMarketplace, 'ops', { booking: 'post_03' }), /Verify the fare first/);
});

test('marketplace: awarding a bid records the bid as the vendor payout and resolves competing bids; one winner under races', async () => {
  await db.doc('vendors/vendorB').set({ status: 'APPROVED', companyName: 'Fleet B' });
  await pendingBooking('award_01');
  await run(market.postBookingToMarketplace, 'ops', { booking: 'award_01' });
  const bids = db.collection('marketplace_trips/award_01/bids');
  await bids.doc('bidA').set({ vendorId: 'vendorA', vendorName: 'Fleet A', vendorCounterRate: 680, status: 'Pending Review' });
  await bids.doc('bidB').set({ vendorId: 'vendorB', vendorName: 'Fleet B', vendorCounterRate: 690, status: 'Pending Review' });
  await bids.doc('bidX').set({ vendorId: 'vendorB', vendorName: 'Fleet B', vendorCounterRate: 5000, status: 'Pending Review' });
  await assert.rejects(run(market.awardMarketplaceBid, 'ops', { tripId: 'award_01', bidId: 'bidX' }), /within the customer fare/);
  await run(market.awardMarketplaceBid, 'ops', { tripId: 'award_01', bidId: 'bidA' });
  const b = (await db.doc('bookings/award_01').get()).data();
  assert.deepEqual([b.status, b.assignedVendorId, b.vendorPayout, b.payoutSource], ['Confirmed', 'vendorA', 680, 'bid']);
  assert.deepEqual((await bids.get()).docs.map((d) => [d.id, d.data().status]).sort(), [['bidA', 'Accepted'], ['bidB', 'Rejected'], ['bidX', 'Rejected']]);
  await assert.rejects(run(market.awardMarketplaceBid, 'ops', { tripId: 'award_01', bidId: 'bidB' }), /already been assigned/);

  await pendingBooking('race_01');
  await run(market.postBookingToMarketplace, 'ops', { booking: 'race_01' });
  const rb = db.collection('marketplace_trips/race_01/bids');
  await rb.doc('r1').set({ vendorId: 'vendorA', vendorCounterRate: 600, status: 'Pending Review' });
  await rb.doc('r2').set({ vendorId: 'vendorB', vendorCounterRate: 610, status: 'Pending Review' });
  const results = await Promise.allSettled([run(market.awardMarketplaceBid, 'ops', { tripId: 'race_01', bidId: 'r1' }), run(market.awardMarketplaceBid, 'ops', { tripId: 'race_01', bidId: 'r2' })]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
});

test('marketplace: assigning an independent driver pays the offer and records their paired vehicle by id', async () => {
  await db.doc('drivers/indie2').set({ status: 'Approved', presenceStatus: 'Online', vendorId: '', name: 'Indie Two', phone: '+91 90000 00002', assignedVehicleId: 'veh_indie', assignedVehicleNumber: 'TN01XY1111' });
  await db.doc('vehicles/veh_indie').set({ vendorId: '', vehicleNumber: 'TN01XY1111', docStatus: 'Approved', status: 'Active', assignedDriverId: 'indie2' });
  await db.doc('drivers/fleetOnline').set({ status: 'Approved', presenceStatus: 'Online', vendorId: 'vendorA', name: 'Fleet Online' });
  await pendingBooking('assign_01');
  const { offeredPayout } = await run(market.postBookingToMarketplace, 'ops', { booking: 'assign_01' });
  await assert.rejects(run(market.assignIndependentDriver, 'ops', { tripId: 'assign_01', driverId: 'fleetOnline' }), /independent driver/);

  await db.doc('vehicles/veh_indie').update({ docStatus: 'Pending' });
  await assert.rejects(run(market.assignIndependentDriver, 'ops', { tripId: 'assign_01', driverId: 'indie2' }), /not approved yet/);
  await db.doc('vehicles/veh_indie').update({ docStatus: 'Approved' });

  await run(market.assignIndependentDriver, 'ops', { tripId: 'assign_01', driverId: 'indie2' });
  const b = (await db.doc('bookings/assign_01').get()).data();
  assert.deepEqual(
    [b.status, b.assignedDriverId, b.driverPayout, b.payoutSource, b.assignedVehicleId, b.assignedVehicleNumber, b.driverPhone],
    ['Assigned', 'indie2', offeredPayout, 'offered', 'veh_indie', 'TN01XY1111', '+91 90000 00002'],
  );
  assert.equal((await db.doc('marketplace_trips/assign_01').get()).data().status, 'Assigned');
});
